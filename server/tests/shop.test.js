// Shop rules with an in-memory store (no database needed): buying is
// idempotent and never goes negative, only owned items can be equipped, and
// the engine only carries known catalogue ids.
import assert from 'node:assert/strict';
import { createShopService, ShopError } from '../src/shop/service.js';
import { DEFAULT_ITEMS, getItem, publicCatalog, sanitizeBoardTheme, sanitizePieceSet } from '../src/shop/catalog.js';
import { GameEngine } from '../src/game/GameEngine.js';
import { GOLD_COLOR } from '../src/game/constants.js';
import { createAccounts } from '../src/accounts/index.js';

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err });
  }
}

/** Same contract as createPgShopStore, kept in memory */
function memoryStore(users) {
  const items = new Map(); // userId → Set(itemId)
  const equipped = new Map(); // userId → { slot: itemId }
  const owned = (u) => items.get(u) || items.set(u, new Set()).get(u);
  return {
    users,
    async inventory(userId) {
      if (!users.has(userId)) return null;
      return { coins: users.get(userId).coins, owned: [...owned(userId)], equipped: { ...(equipped.get(userId) || {}) } };
    },
    async buy(userId, itemId, price) {
      await null; // yield, like a real query would
      const u = users.get(userId);
      if (!u) return { status: 'nouser', coins: 0 };
      if (owned(userId).has(itemId)) return { status: 'owned', coins: u.coins };
      if (u.coins < price) return { status: 'insufficient', coins: u.coins };
      owned(userId).add(itemId);
      u.coins -= price;
      return { status: 'bought', coins: u.coins };
    },
    async equip(userId, slot, itemId) {
      const e = equipped.get(userId) || {};
      if (itemId === null) {
        delete e[slot];
      } else {
        if (!owned(userId).has(itemId)) return false;
        e[slot] = itemId;
      }
      equipped.set(userId, e);
      return true;
    },
    async grant(userId, itemId) {
      owned(userId).add(itemId);
    },
  };
}

const rejects = async (promise, status) => {
  await assert.rejects(promise, (err) => err instanceof ShopError && err.status === status);
};

await test('catalogue: 8 piece sets and 6 boards, defaults free, prices in range', () => {
  const cat = publicCatalog();
  assert.equal(cat.filter((i) => i.slot === 'pieces').length, 8);
  assert.equal(cat.filter((i) => i.slot === 'board').length, 6);
  for (const i of cat) {
    if (i.isDefault) assert.equal(i.price, 0);
    else assert.ok(i.price >= 150 && i.price <= 600, `${i.id} costs ${i.price}`);
  }
  assert.equal(getItem(DEFAULT_ITEMS.pieces).isDefault, true);
  assert.equal(sanitizePieceSet('board:night'), DEFAULT_ITEMS.pieces);
  assert.equal(sanitizeBoardTheme('nope'), DEFAULT_ITEMS.board);
  assert.equal(sanitizeBoardTheme('board:night'), 'board:night');
});

await test('shop: guests see the catalogue with only the defaults', async () => {
  const shop = createShopService(memoryStore(new Map()));
  const v = await shop.view(null);
  assert.equal(v.signedIn, false);
  assert.deepEqual(v.equipped, DEFAULT_ITEMS);
  assert.ok(v.catalog.length > 10);
});

await test('shop: buying deducts the price once; a second purchase is free and idempotent', async () => {
  const store = memoryStore(new Map([['u1', { coins: 500 }]]));
  const shop = createShopService(store);
  const price = getItem('pieces:temple').price;
  const r = await shop.buy('u1', 'pieces:temple');
  assert.equal(r.alreadyOwned, false);
  assert.equal(r.coins, 500 - price);
  const again = await shop.buy('u1', 'pieces:temple');
  assert.equal(again.alreadyOwned, true);
  assert.equal(store.users.get('u1').coins, 500 - price);
  const v = await shop.view('u1');
  assert.ok(v.owned.includes('pieces:temple'));
  assert.ok(v.owned.includes(DEFAULT_ITEMS.pieces));
});

await test('shop: concurrent purchases of one item charge once', async () => {
  const store = memoryStore(new Map([['u1', { coins: 1000 }]]));
  const shop = createShopService(store);
  const price = getItem('board:spring').price;
  const all = await Promise.all([shop.buy('u1', 'board:spring'), shop.buy('u1', 'board:spring'), shop.buy('u1', 'board:spring')]);
  assert.equal(all.filter((r) => !r.alreadyOwned).length, 1);
  assert.equal(store.users.get('u1').coins, 1000 - price);
});

await test('shop: not enough Ryō → 402, nothing bought, balance unchanged', async () => {
  const store = memoryStore(new Map([['u1', { coins: 100 }]]));
  const shop = createShopService(store);
  await rejects(shop.buy('u1', 'pieces:toad'), 402);
  assert.equal(store.users.get('u1').coins, 100);
  assert.ok(!(await shop.view('u1')).owned.includes('pieces:toad'));
});

await test('shop: invalid, unknown and default items cannot be bought', async () => {
  const shop = createShopService(memoryStore(new Map([['u1', { coins: 9999 }]])));
  await rejects(shop.buy('u1', 42), 400);
  await rejects(shop.buy('u1', 'DROP TABLE'), 400);
  await rejects(shop.buy('u1', 'pieces:golden'), 404);
  await rejects(shop.buy('u1', DEFAULT_ITEMS.board), 400);
  await rejects(shop.buy('nobody', 'pieces:temple'), 401);
});

await test('shop: equip only what you own, in its own slot; the default always works', async () => {
  const store = memoryStore(new Map([['u1', { coins: 1000 }]]));
  const shop = createShopService(store);
  await rejects(shop.equip('u1', 'pieces', 'pieces:kunai'), 403);
  await shop.buy('u1', 'pieces:kunai');
  await shop.buy('u1', 'board:night');
  await shop.equip('u1', 'pieces', 'pieces:kunai');
  await shop.equip('u1', 'board', 'board:night');
  assert.deepEqual(await shop.loadout('u1'), { pieces: 'pieces:kunai', board: 'board:night' });
  await rejects(shop.equip('u1', 'board', 'pieces:kunai'), 400);
  await rejects(shop.equip('u1', 'hat', 'pieces:kunai'), 400);
  await shop.equip('u1', 'pieces', DEFAULT_ITEMS.pieces);
  assert.equal((await shop.loadout('u1')).pieces, DEFAULT_ITEMS.pieces);
  assert.equal(await shop.owns('u1', 'board:night'), true);
  assert.equal(await shop.owns('u1', 'board:mist'), false);
  assert.equal(await shop.owns(null, DEFAULT_ITEMS.board), true);
});

await test('shop: an equipped id that left the catalogue falls back to the default', async () => {
  const store = memoryStore(new Map([['u1', { coins: 0 }]]));
  store.inventory = async () => ({ coins: 0, owned: ['pieces:retired'], equipped: { pieces: 'pieces:retired' } });
  const shop = createShopService(store);
  assert.deepEqual(await shop.loadout('u1'), DEFAULT_ITEMS);
});

await test('engine: piece sets travel in the public player data, the board theme only changes in the lobby', () => {
  const e = new GameEngine('T2', 'standard');
  e.addPlayer('p0', 'A');
  e.addPlayer('p1', 'B');
  assert.equal(e.serialize('p1').players.p0.pieceSet, DEFAULT_ITEMS.pieces);
  e.setPieceSet('p0', 'pieces:lantern');
  e.setPieceSet('p1', '<script>');
  const pub = e.serialize(null);
  assert.equal(pub.players.p0.pieceSet, 'pieces:lantern');
  assert.equal(pub.players.p1.pieceSet, DEFAULT_ITEMS.pieces);
  assert.equal(pub.boardTheme, DEFAULT_ITEMS.board);
  assert.ok(e.setBoardTheme('board:valley').success);
  assert.equal(e.serialize('p0').boardTheme, 'board:valley');
  assert.equal(e.setBoardTheme('pieces:toad').boardTheme, DEFAULT_ITEMS.board);
  e.setBoardTheme('board:valley');
  assert.ok(e.startGame().success);
  assert.equal(e.setBoardTheme('board:night').success, false);
  assert.equal(e.serialize(null).boardTheme, 'board:valley');
});

await test('without DATABASE_URL the shop gives defaults and owns nothing', async () => {
  const a = createAccounts({});
  assert.deepEqual(await a.getLoadout('u1'), DEFAULT_ITEMS);
  assert.equal(await a.ownsItem('u1', 'board:night'), false);
  assert.equal(await a.ownsItem('u1', DEFAULT_ITEMS.board), true);
});

await test('admin-only pieces: hidden and owned only for admins, never bought; admin seats are gold', async () => {
  const store = memoryStore(new Map([['adm', { coins: 0 }], ['pl', { coins: 9999 }]]));
  const shop = createShopService(store, { isAdmin: async (id) => id === 'adm' });
  assert.equal(publicCatalog().some((i) => i.id === 'pieces:council'), false);
  const pv = await shop.view('pl');
  assert.equal(pv.catalog.some((i) => i.id === 'pieces:council'), false);
  assert.equal(pv.owned.includes('pieces:council'), false);
  await rejects(shop.buy('pl', 'pieces:council'), 403);
  await rejects(shop.equip('pl', 'pieces', 'pieces:council'), 403);
  const av = await shop.view('adm');
  assert.ok(av.catalog.some((i) => i.id === 'pieces:council' && i.adminOnly));
  assert.ok(av.owned.includes('pieces:council'));
  await rejects(shop.buy('adm', 'pieces:council'), 403);
  await shop.equip('adm', 'pieces', 'pieces:council');
  assert.equal((await shop.loadout('adm')).pieces, 'pieces:council');
  // Losing the role: the set falls back to the default
  const exAdmin = createShopService(store, { isAdmin: async () => false });
  assert.equal((await exAdmin.loadout('adm')).pieces, DEFAULT_ITEMS.pieces);

  const e = new GameEngine('G1', 'standard');
  e.addPlayer('a', 'Ana');
  e.addPlayer('b', 'Beto');
  const blue = e.players.b.color;
  assert.ok(e.setGold('b', true));
  assert.equal(e.players.b.color, GOLD_COLOR);
  e.removePlayer('a');
  assert.equal(e.players.b.color, GOLD_COLOR, 'gold survives the reindex');
  e.setGold('b', false);
  assert.notEqual(e.players.b.color, GOLD_COLOR);
  assert.notEqual(blue, GOLD_COLOR);
});

// ─── Report ───
let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ok  ${r.name}`);
  } else {
    failed++;
    console.log(`  FAIL ${r.name}\n       ${r.err && r.err.stack ? r.err.stack.split('\n').slice(0, 4).join('\n       ') : r.err}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} shop tests passed`);
if (failed > 0) process.exitCode = 1;
