// Admin panel phase B without a database: banned-words normalisation, chat
// mutes, reports (rate limit), sale prices and disabled items, editable Ryō
// rules, ranking exclusions and the weekly reset. Fakes / memory only.
import assert from 'node:assert/strict';
import express from 'express';
import { createWordFilter, cleanWordList, normalizeWord, DEFAULT_BANNED_WORDS } from '../src/admin/wordFilter.js';
import { createMutes, createReportLimiter, muteMessage } from '../src/admin/moderation.js';
import { createRuntime } from '../src/admin/runtime.js';
import { parseMuteDuration } from '../src/admin/routes/moderation.js';
import { parseItemOverride } from '../src/admin/routes/economy.js';
import { ADMIN_HEADER, createAdmin } from '../src/admin/index.js';
import { createSettings } from '../src/admin/settings.js';
import { priceInfo, saleActive, salePrice } from '../src/shop/pricing.js';
import { createShopService } from '../src/shop/service.js';
import { getItem } from '../src/shop/catalog.js';
import { REWARD_RULES, cleanRewardRules, computeRewards } from '../src/accounts/rewards.js';
import { getLeaderboard, leaderboardFilter } from '../src/accounts/store.js';
import { registerSocketHandlers } from '../src/socket/handlers.js';
import { LobbyManager } from '../src/lobby/LobbyManager.js';

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err });
  }
}

const A = '11111111-1111-4111-8111-111111111111'; // admin
const B = '22222222-2222-4222-8222-222222222222'; // player
const HOUR = 3600_000;

// Minimal socket.io stand-in (same idea as admin.test.js)
function fakeIo() {
  const middlewares = [];
  let onConnection = null;
  const sockets = new Map();
  const broadcasts = [];
  const target = (room) => ({
    emit: (ev, data) => broadcasts.push({ room, ev, data }),
    socketsLeave() {},
    fetchSockets: async () => [],
  });
  const io = {
    use: (fn) => middlewares.push(fn),
    on: (ev, fn) => { if (ev === 'connection') onConnection = fn; },
    to: target,
    in: target,
    emit: (ev, data) => broadcasts.push({ room: '*', ev, data }),
    sockets: { adapter: { rooms: new Map() } },
    of: () => ({ sockets }),
  };
  let n = 0;
  async function connect(auth) {
    const handlers = {};
    const socket = {
      id: `s${++n}`,
      handshake: { auth },
      data: {},
      sent: [],
      join() {},
      leave() {},
      emit(ev, data) { socket.sent.push({ ev, data }); },
      on(ev, fn) { handlers[ev] = fn; },
    };
    for (const mw of middlewares) await new Promise((resolve, reject) => mw(socket, (err) => (err ? reject(err) : resolve())));
    sockets.set(socket.id, socket);
    onConnection(socket);
    socket.call = (ev, payload = {}) => new Promise((resolve) => handlers[ev](payload, resolve));
    return socket;
  }
  return { io, connect, broadcasts };
}
const noTimers = { setTimer: () => null, clearTimer: () => {} };

// ─── Banned words ───
await test('banned words: accents, case, leetspeak, stretched letters and plurals; whole words only', () => {
  assert.equal(normalizeWord('PÚTO'), 'puto');
  assert.equal(normalizeWord('m1erd4'), 'mierda');
  assert.equal(normalizeWord('$@p0'), 'sapo');
  assert.equal(normalizeWord('hola!'), '');
  const f = createWordFilter(DEFAULT_BANNED_WORDS);
  assert.equal(f('Eres un PÚTO').text, 'Eres un ***');
  assert.equal(f('m1erd4 total').text, '*** total');
  assert.equal(f('puuuuuta').text, '***');
  assert.equal(f('p3nd3j0s!').text, '***!');
  assert.equal(f('Imbécil').changed, true);
  // No false positives inside other words, and "foro" is not "forro"
  assert.deepEqual(f('foro de computadora'), { text: 'foro de computadora', changed: false });
  assert.equal(f('forrrro').text, '***');
  assert.equal(f('').text, '');
  // The admin list is normalised and de-duplicated
  assert.deepEqual(cleanWordList(['Tonto', 'TONTO', 't0nt0', 'x', '', 42, 'dos palabras']), ['tonto']);
  assert.equal(createWordFilter(['tonto'])('qué T0NT0S').text, 'qué ***');
});

await test('banned words apply to chat and names on the socket, and the list is editable at runtime', async () => {
  const { io, connect, broadcasts } = fakeIo();
  const runtime = createRuntime();
  registerSocketHandlers(io, new LobbyManager(), noTimers, null, { runtime });
  const host = await connect({ playerId: 'h' });
  const created = await host.call('createRoom', { playerName: 'Pendejo99', turnTimeLimit: 0 });
  assert.equal(created.state.players.h.name, '***99');
  await host.call('chatMessage', { message: 'hola m1erda' });
  assert.equal(broadcasts.filter((b) => b.ev === 'chatMessage').at(-1).data.message, 'hola ***');
  await runtime.setBannedWords(['patata'], A);
  await host.call('chatMessage', { message: 'una PATATA y mierda' });
  assert.equal(broadcasts.filter((b) => b.ev === 'chatMessage').at(-1).data.message, 'una *** y mierda');
  await runtime.setBannedWords(null, A);
  assert.equal(runtime.getBannedWords().isDefault, true);
});

// ─── Mutes ───
await test('mute: guests by playerId, accounts by id; muted messages are rejected in Spanish; unmute and game end lift it', async () => {
  const { io, connect, broadcasts } = fakeIo();
  const mutes = createMutes();
  const accounts = { enabled: true, verifySocketToken: async (t) => ({ id: t, name: 'x', email: '' }), accountBlock: async () => null };
  const live = registerSocketHandlers(io, new LobbyManager(), noTimers, accounts, { mutes });
  const host = await connect({ playerId: 'h', token: B });
  const created = await host.call('createRoom', { playerName: 'Cuenta', turnTimeLimit: 0 });
  const guest = await connect({ playerId: 'g' });
  await guest.call('joinRoom', { roomId: created.roomId, playerName: 'Invitado' });

  // Guest muted for 30 minutes
  const who = live.roomPerson(created.roomId, 'g');
  assert.deepEqual(who, { playerId: 'g', userId: null, name: 'Invitado' });
  const entry = await mutes.mute({ ...who, minutes: 30, reason: 'insultos' });
  const denied = await guest.call('chatMessage', { message: 'hola' });
  assert.equal(denied.success, false);
  assert.equal(denied.muted, true);
  assert.match(denied.error, /^Un moderador te silenció: no puedes escribir en el chat hasta el .* Motivo: insultos\.$/);
  assert.equal((await host.call('chatMessage', { message: 'yo sí puedo' })).success, true);
  await mutes.unmute(entry.key);
  assert.equal((await guest.call('chatMessage', { message: 'gracias' })).success, true);

  // Account muted until the game ends: it follows the account (any playerId)
  assert.equal(live.roomPerson(created.roomId, 'h').userId, B);
  await mutes.mute({ userId: B, playerId: 'h', name: 'Cuenta', untilGameEnd: true, roomId: created.roomId });
  const m = await host.call('chatMessage', { message: 'eh' });
  assert.match(m.error, /hasta que termine la partida/);
  assert.equal(mutes.find({ userId: B, playerId: 'otro-dispositivo' }).roomId, created.roomId);
  // The room closes (same as the game ending) → lifted
  assert.equal(live.adminCloseRoom(created.roomId, 'fin'), true);
  assert.equal(mutes.find({ userId: B }), null);

  // Expired mutes disappear by themselves
  const now = Date.now();
  await mutes.mute({ playerId: 'z', minutes: 1 }, now - 2 * 60_000);
  assert.equal(mutes.find({ playerId: 'z' }), null);
  assert.equal(mutes.list().length, 0);
  assert.match(muteMessage({ roomId: 'ABCD' }), /termine la partida/);
  assert.ok(broadcasts.length > 0);
});

await test('mute duration: minutes 1..7 days or until the game ends', () => {
  assert.deepEqual(parseMuteDuration({ minutes: 30 }), { untilGameEnd: false, minutes: 30 });
  assert.deepEqual(parseMuteDuration({ minutes: '15' }), { untilGameEnd: false, minutes: 15 });
  assert.deepEqual(parseMuteDuration({ untilGameEnd: true }), { untilGameEnd: true, minutes: 0 });
  for (const bad of [{}, { minutes: 0 }, { minutes: 7 * 24 * 60 + 1 }, { minutes: 2.5 }, { minutes: '1; DROP' }]) {
    assert.throws(() => parseMuteDuration(bad), /duración/);
  }
});

// ─── Reports ───
await test('report limiter: 3 per 10 min per reporter, the same target only once', () => {
  const check = createReportLimiter({ max: 3, windowMs: 10 * 60_000, sameTargetMs: 10 * 60_000 });
  const t = 1_000_000;
  assert.equal(check('u:1', 'a', t), null);
  assert.match(check('u:1', 'a', t + 1000), /Ya reportaste/);
  assert.equal(check('u:1', 'b', t + 2000), null);
  assert.equal(check('u:1', 'c', t + 3000), null);
  assert.match(check('u:1', 'd', t + 4000), /demasiados reportes/);
  assert.equal(check('u:2', 'd', t + 4000), null, 'other reporters are not affected');
  assert.equal(check('u:1', 'd', t + 11 * 60_000), null, 'the window slides');
});

await test('reportPlayer: same room only, reason required, chat snapshot stored, rate limited', async () => {
  const { io, connect } = fakeIo();
  const saved = [];
  const reports = { create: async (r) => { saved.push(r); return { id: saved.length }; } };
  registerSocketHandlers(io, new LobbyManager(), noTimers, null, { reports });
  const a = await connect({ playerId: 'a' });
  const room = await a.call('createRoom', { playerName: 'Ana', turnTimeLimit: 0 });
  const b = await connect({ playerId: 'b' });
  await b.call('joinRoom', { roomId: room.roomId, playerName: 'Beto' });
  await b.call('chatMessage', { message: 'mensaje feo' });
  const outsider = await connect({ playerId: 'x' });
  assert.equal((await outsider.call('reportPlayer', { targetId: 'b', reason: 'insultos' })).success, false);
  assert.equal((await a.call('reportPlayer', { targetId: 'a', reason: 'insultos' })).success, false, 'not yourself');
  assert.equal((await a.call('reportPlayer', { targetId: 'b', reason: 'odio' })).error, 'Elige un motivo');
  assert.equal((await a.call('reportPlayer', { targetId: 'nadie', reason: 'spam' })).success, false);
  const ok = await a.call('reportPlayer', { targetId: 'b', reason: 'insultos', text: '  me insultó  ', messageId: 1 });
  assert.equal(ok.success, true, ok.error);
  assert.equal(saved[0].targetName, 'Beto');
  assert.equal(saved[0].reporterName, 'Ana');
  assert.equal(saved[0].details, 'me insultó');
  assert.equal(saved[0].roomId, room.roomId);
  assert.deepEqual(saved[0].chatExcerpt.map((m) => [m.message, m.reported]), [['mensaje feo', true]]);
  const again = await a.call('reportPlayer', { targetId: 'b', reason: 'spam' });
  assert.equal(again.success, false);
  assert.match(again.error, /Ya reportaste/);
  assert.equal(saved.length, 1);
});

// ─── Shop: sales and disabled items ───
await test('sale price: % off the (overridden) list price, only between its dates; disabled items', () => {
  const temple = getItem('pieces:temple'); // 150
  const now = Date.parse('2026-10-28T12:00:00Z');
  const sale = { price: null, enabled: true, salePercent: 20, saleStarts: '2026-10-28T00:00:00Z', saleEnds: '2026-10-29T00:00:00Z' };
  assert.equal(salePrice(150, 20), 120);
  assert.equal(salePrice(3, 90), 1, 'never free');
  assert.equal(saleActive(sale, now), true);
  assert.equal(saleActive(sale, Date.parse('2026-10-29T00:00:00Z')), false, 'the end is exclusive');
  assert.equal(saleActive(sale, Date.parse('2026-10-27T23:59:59Z')), false);
  assert.deepEqual(priceInfo(temple, sale, now), {
    price: 120, basePrice: 150, listPrice: 150, salePercent: 20, saleEndsAt: '2026-10-29T00:00:00.000Z', available: true,
  });
  assert.equal(priceInfo(temple, { ...sale, price: 200 }, now).price, 160);
  assert.equal(priceInfo(temple, { ...sale, price: 200 }, now + 2 * 86_400_000).price, 200);
  assert.equal(priceInfo(temple, { price: null, enabled: false }, now).available, false);
  assert.equal(priceInfo(getItem('pieces:classic'), { price: 99, enabled: false }, now).price, 0, 'defaults ignore overrides');
  // Panel validation
  assert.equal(parseItemOverride(temple, { price: 150, enabled: true }, now), null, 'same as the catalogue = no override');
  assert.deepEqual(parseItemOverride(temple, { price: '180', enabled: false }, now), { price: 180, enabled: false, salePercent: null, saleStarts: null, saleEnds: null });
  assert.throws(() => parseItemOverride(temple, { price: 0 }, now), /precio/);
  assert.throws(() => parseItemOverride(temple, { sale: { percent: 95, endsAt: '2026-10-30' } }, now), /descuento/);
  assert.throws(() => parseItemOverride(temple, { sale: { percent: 20, endsAt: '2026-10-01' } }, now), /futuro/);
  assert.throws(() => parseItemOverride(getItem('board:classic'), { price: 10 }, now), /no se puede/);
});

await test('shop service: buys at the sale price (recorded), disabled items cannot be bought but stay owned', async () => {
  const runtime = createRuntime();
  const bought = [];
  const store = {
    inv: { coins: 1000, owned: ['board:night'], equipped: {} },
    async inventory() { return { ...this.inv, owned: [...this.inv.owned] }; },
    async buy(userId, itemId, price, meta) {
      bought.push({ itemId, price, ...meta });
      this.inv.coins -= price;
      this.inv.owned.push(itemId);
      return { status: 'bought', coins: this.inv.coins };
    },
    async equip() { return true; },
  };
  const shop = createShopService(store, { pricing: runtime });
  const now = Date.now();
  await runtime.setShopOverride('pieces:temple', { price: null, enabled: true, salePercent: 50, saleStarts: new Date(now - HOUR).toISOString(), saleEnds: new Date(now + HOUR).toISOString() }, A);
  await runtime.setShopOverride('board:night', { price: null, enabled: false, salePercent: null, saleStarts: null, saleEnds: null }, A);
  await runtime.setShopOverride('board:desert', { price: null, enabled: false, salePercent: null, saleStarts: null, saleEnds: null }, A);
  const view = await shop.view('u1');
  const temple = view.catalog.find((i) => i.id === 'pieces:temple');
  assert.deepEqual([temple.price, temple.listPrice, temple.salePercent], [75, 150, 50]);
  assert.ok(view.catalog.some((i) => i.id === 'board:night' && i.available === false), 'owners still see it');
  assert.ok(!view.catalog.some((i) => i.id === 'board:desert'), 'hidden from everyone else');
  assert.ok(!(await shop.view(null)).catalog.some((i) => i.id === 'board:night'));
  const r = await shop.buy('u1', 'pieces:temple');
  assert.equal(r.price, 75);
  assert.deepEqual(bought[0], { itemId: 'pieces:temple', price: 75, listPrice: 150, salePercent: 50 });
  await assert.rejects(shop.buy('u1', 'pieces:kunai', 150), (e) => e.status === 409 && e.extra.price === 300);
  await assert.rejects(shop.buy('u1', 'board:desert'), (e) => e.status === 410 && /ya no está a la venta/.test(e.message));
  // Equipping an owned, disabled item still works
  assert.deepEqual(await shop.equip('u1', 'board', 'board:night'), { slot: 'board', itemId: 'board:night' });
  await runtime.setShopOverride('pieces:temple', null, A);
  assert.equal((await shop.view(null)).catalog.find((i) => i.id === 'pieces:temple').price, 150);
});

// ─── Ryō rules ───
await test('reward rules edited in the panel are the ones applied at the end of a game', async () => {
  const runtime = createRuntime();
  const summary = {
    gameId: 'g', roomId: 'R', boardType: 'standard', endedBy: 'victory', durationS: 1200,
    players: [
      { playerId: 'p1', accountId: A, vp: 10, won: true, left: false },
      { playerId: 'p2', accountId: B, vp: 4, won: false, left: false },
    ],
  };
  const before = computeRewards(summary, runtime.getRewardRules());
  assert.deepEqual(before.awards.map((a) => a.coins), [20 + 30 + 20, 20 + 8]);
  await runtime.setRewardRules({ finish: 50, win: 0, perVp: 1 }, A);
  assert.deepEqual(computeRewards(summary, runtime.getRewardRules()).awards.map((a) => a.coins), [60, 54]);
  // Vote minimum: 30 min now → a 20-minute vote game pays nothing
  await runtime.setRewardRules({ minVoteMinutes: 30 }, A);
  const vote = computeRewards({ ...summary, endedBy: 'vote' }, runtime.getRewardRules());
  assert.equal(vote.eligible, false);
  assert.match(vote.reason, /30 minutos/);
  assert.equal(runtime.getRewardRules().finish, 50, 'partial changes keep the others');
  assert.match(cleanRewardRules({ win: 5000 }).error, /win/);
  assert.match(cleanRewardRules({ perVp: -1 }).error, /perVp/);
  await runtime.setRewardRules(null, A);
  assert.deepEqual(runtime.getRewardRules(), REWARD_RULES);
});

// ─── Ranking ───
await test('leaderboard query skips excluded results and starts the week at the reset', async () => {
  assert.match(leaderboardFilter('all'), /NOT excluded/);
  assert.match(leaderboardFilter('week'), /NOT excluded/);
  assert.match(leaderboardFilter('week'), /date_trunc/);
  assert.match(leaderboardFilter('all'), /COALESCE\(\$1::timestamptz/, 'all-time references $1 too (typed)');
  const calls = [];
  const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
  await getLeaderboard(pool, 'week', { limit: 5, userId: B, weekResetAt: '2026-10-28T10:00:00.000Z' });
  assert.equal(calls.length, 2);
  for (const c of calls) {
    assert.match(c.sql, /NOT excluded/);
    assert.equal(c.params[0], '2026-10-28T10:00:00.000Z');
  }
  calls.length = 0;
  await getLeaderboard(pool, 'all', { weekResetAt: '2026-10-28T10:00:00.000Z' });
  assert.equal(calls[0].params[0], null, 'the reset never touches the all-time ranking');
});

await test('admin API phase B: 404 for players; exclusions, week reset, prices and words are audited and refresh caches', async () => {
  const access = { [A]: { role: 'admin', status: 'active' }, [B]: { role: 'player', status: 'active' } };
  let session = B;
  let invalidations = 0;
  const runtime = createRuntime();
  const excludedRows = new Map([['33333333-3333-4333-8333-333333333333', false]]);
  const log = [];
  const accounts = {
    enabled: true,
    adminEmails: new Set(),
    runtime,
    sessionUser: async () => ({ id: session, email: '' }),
    getAccess: async (id) => (access[id] ? { id, email: '', displayName: 'N', ...access[id] } : null),
    invalidateAccess() {},
    invalidateLeaderboard: () => { invalidations += 1; },
    leaderboard: async () => ({ rows: [], me: null }),
  };
  const economy = {
    excludedList: async () => [],
    userResults: async () => [],
    economyStats: async () => ({ totals: {}, top: [], perItem: {}, owners: {}, recent: [] }),
    async setExcluded({ id, excluded }, audit) {
      if (!excludedRows.has(id)) return { status: 'none', changed: 0 };
      excludedRows.set(id, excluded);
      log.push(audit);
      return { status: 'ok', changed: 1 };
    },
  };
  const store = { logAction: async (a) => log.push(a), getUser: async () => null };
  const fakeLive = { liveRooms: () => [], roomChat: () => null, roomPerson: () => null };
  const admin = createAdmin({ accounts, live: fakeLive, settings: createSettings(), errorLog: {}, store, runtime, economy, reports: null });
  const app = express();
  app.use('/api/admin', admin.router);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const h = { [ADMIN_HEADER]: '1', 'content-type': 'application/json' };
  const post = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
  const game = '33333333-3333-4333-8333-333333333333';
  try {
    for (const path of ['/moderation', '/economy', '/ranking', '/reports']) {
      const r = await fetch(`${base}${path}`, { headers: h });
      assert.equal(r.status, 404, path);
    }
    assert.equal((await post('/ranking/exclude', { scope: 'game', id: game, reason: 'trampa' })).status, 404);
    session = A;
    let r = await post('/ranking/exclude', { scope: 'game', id: game, reason: 'x' });
    assert.equal(r.status, 400, 'a reason is required');
    r = await post('/ranking/exclude', { scope: 'game', id: game, reason: 'partida arreglada' });
    assert.equal(r.status, 200);
    assert.equal(excludedRows.get(game), true);
    assert.equal(invalidations, 1);
    r = await post('/ranking/exclude', { scope: 'user', id: "1' OR 1=1 --", reason: 'probando' });
    assert.equal(r.status, 404);
    r = await post('/ranking/restore', { scope: 'game', id: game });
    assert.equal(excludedRows.get(game), false);
    r = await post('/ranking/week/reset', { reason: 'reinicio de temporada' });
    assert.equal(r.status, 200);
    assert.ok(runtime.getWeekResetAt());
    r = await post('/ranking/week/undo', {});
    assert.equal(runtime.getWeekResetAt(), null);
    assert.equal(invalidations, 4);
    r = await post('/economy/items/pieces:temple', { price: 180, enabled: true });
    assert.equal((await r.json()).effective.price, 180);
    r = await post('/economy/rewards', { finish: 25 });
    assert.equal((await r.json()).rewards.finish, 25);
    r = await post('/economy/rewards', { reset: true });
    r = await post('/moderation/words', { words: ['Tonto', 't0nt0', 'feo'] });
    assert.deepEqual((await r.json()).words.words, ['tonto', 'feo']);
    r = await fetch(`${base}/reports`, { headers: h });
    assert.equal(r.status, 503);
    assert.deepEqual(
      log.map((l) => l.action),
      ['ranking.exclude.game', 'ranking.restore.game', 'ranking.week.reset', 'ranking.week.undo', 'shop.item', 'economy.rewards', 'economy.rewards', 'chat.words'],
    );
    assert.ok(log.every((l) => l.adminId === A));
  } finally {
    server.close();
  }
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
console.log(`\n${results.length - failed}/${results.length} admin phase B tests passed`);
if (failed > 0) process.exitCode = 1;
