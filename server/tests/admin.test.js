// Admin panel rules without a database: who is an admin, the hidden 404,
// maintenance mode, coin adjustments that never go negative, role rules and
// suspended / banned accounts on the socket. Fakes / in-memory store only.
import assert from 'node:assert/strict';
import express from 'express';
import { blockedMessage, effectiveStatus, isAdminAccess, parseAdminEmails } from '../src/admin/access.js';
import { ADMIN_HEADER, createAdmin, createAdminGuard } from '../src/admin/index.js';
import { AdminError, createAdminService } from '../src/admin/service.js';
import { createSettings, MAINTENANCE_DEFAULT_MESSAGE } from '../src/admin/settings.js';
import { recordError, recentErrors, clearErrors } from '../src/admin/errorLog.js';
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
const C = '33333333-3333-4333-8333-333333333333'; // second admin
const FUTURE = () => new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();

/** Same contract as createPgAdminStore (service part), kept in memory */
function memoryStore(seed) {
  const users = new Map(seed.map((u) => [u.id, { coins: 0, role: 'player', status: 'active', suspendedUntil: null, banReason: null, displayName: 'Ninja', ...u }]));
  const items = new Map();
  const log = [];
  return {
    users,
    log,
    async getUser(id) {
      const u = users.get(id);
      return u ? { ...u } : null;
    },
    async adjustCoins(id, delta, audit) {
      await null; // yield like a real query
      const u = users.get(id);
      if (!u) return { status: 'nouser', coins: 0 };
      if (u.coins + delta < 0) return { status: 'negative', coins: u.coins };
      u.coins += delta;
      log.push(audit);
      return { status: 'ok', coins: u.coins };
    },
    async giftItem(id, itemId, audit) {
      if (!users.has(id)) return { status: 'nouser' };
      const set = items.get(id) || new Set();
      items.set(id, set);
      if (set.has(itemId)) return { status: 'owned' };
      set.add(itemId);
      log.push(audit);
      return { status: 'ok' };
    },
    async setStatus(id, { status, until, reason }, audit) {
      const u = users.get(id);
      if (!u) return { status: 'nouser' };
      Object.assign(u, { status, suspendedUntil: until, banReason: reason });
      log.push(audit);
      return { status: 'ok' };
    },
    async rename(id, name, audit) {
      const u = users.get(id);
      if (!u) return { status: 'nouser' };
      u.displayName = name;
      log.push(audit);
      return { status: 'ok' };
    },
    async setRole(id, role, audit) {
      const u = users.get(id);
      if (!u) return { status: 'nouser' };
      const admins = [...users.values()].filter((x) => x.role === 'admin');
      if (role !== 'admin' && u.role === 'admin' && admins.length <= 1) return { status: 'lastAdmin' };
      u.role = role;
      log.push(audit);
      return { status: 'ok' };
    },
    async logAction(audit) {
      log.push(audit);
    },
  };
}

// ─── Access rules ───
await test('ADMIN_EMAILS is parsed lower-case and ignores junk', () => {
  const set = parseAdminEmails(' Ramiro@Example.com, ,nope, b@x.io ');
  assert.deepEqual([...set], ['ramiro@example.com', 'b@x.io']);
  assert.equal(parseAdminEmails(undefined).size, 0);
});

await test('suspensions expire by themselves; bans do not', () => {
  const now = Date.now();
  assert.equal(effectiveStatus({ status: 'suspended', suspendedUntil: new Date(now + 60_000) }, now), 'suspended');
  assert.equal(effectiveStatus({ status: 'suspended', suspendedUntil: new Date(now - 60_000) }, now), 'active');
  assert.equal(effectiveStatus({ status: 'banned' }, now), 'banned');
  assert.equal(blockedMessage({ status: 'active' }), null);
  assert.match(blockedMessage({ status: 'banned', banReason: 'trampas' }), /bloqueada.*trampas.*invitado/);
  assert.match(blockedMessage({ status: 'suspended', suspendedUntil: FUTURE() }), /suspendida hasta/);
  assert.equal(isAdminAccess({ role: 'admin', status: 'active' }), true);
  assert.equal(isAdminAccess({ role: 'admin', status: 'banned' }), false);
  assert.equal(isAdminAccess({ role: 'player', status: 'active' }), false);
  assert.equal(isAdminAccess(null), false);
});

// ─── Authorization: the hidden 404 ───
function fakeAccounts(accessById, { sessionId = null, email = '', enabled = true, adminEmails = new Set() } = {}) {
  return {
    enabled,
    adminEmails,
    async sessionUser() {
      return sessionId ? { id: sessionId, email } : null;
    },
    async getAccess(id) {
      return accessById[id] ? { id, email: `${id}@x.io`, displayName: 'N', ...accessById[id] } : null;
    },
    async ensureUser(authUser) {
      if (adminEmails.has(authUser.email)) accessById[authUser.id] = { ...(accessById[authUser.id] || {}), role: 'admin', status: 'active' };
    },
    invalidateAccess() {},
  };
}

async function runGuard(accounts, headers = { [ADMIN_HEADER]: '1' }) {
  const guard = createAdminGuard(accounts);
  const req = { get: (h) => headers[h.toLowerCase()] };
  let status = 200;
  let body = null;
  let passed = false;
  const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
  await guard(req, res, () => { passed = true; });
  return { status, body, passed, admin: req.admin };
}

await test('admin guard: only active admins pass, everyone else gets a plain 404', async () => {
  const access = { [A]: { role: 'admin', status: 'active' }, [B]: { role: 'player', status: 'active' }, [C]: { role: 'admin', status: 'banned' } };
  const ok = await runGuard(fakeAccounts(access, { sessionId: A }));
  assert.equal(ok.passed, true);
  assert.equal(ok.admin.id, A);
  for (const id of [B, C, null]) {
    const r = await runGuard(fakeAccounts(access, { sessionId: id }));
    assert.equal(r.passed, false);
    assert.equal(r.status, 404);
    assert.deepEqual(r.body, { error: 'No encontrado' });
  }
  // Without the admin header (e.g. a cross-site form) even an admin gets 404
  const noHeader = await runGuard(fakeAccounts(access, { sessionId: A }), {});
  assert.equal(noHeader.status, 404);
  // Accounts disabled (no database): 404
  assert.equal((await runGuard(fakeAccounts(access, { sessionId: A, enabled: false }))).status, 404);
});

await test('ADMIN_EMAILS promotes the account on its first admin request', async () => {
  const access = { [B]: { role: 'player', status: 'active' } };
  const accounts = fakeAccounts(access, { sessionId: B, email: 'boss@x.io', adminEmails: new Set(['boss@x.io']) });
  const r = await runGuard(accounts);
  assert.equal(r.passed, true);
  assert.equal(access[B].role, 'admin');
});

await test('admin API over HTTP: 404 for players, data for admins', async () => {
  const access = { [A]: { role: 'admin', status: 'active' }, [B]: { role: 'player', status: 'active' } };
  let session = B;
  const accounts = { ...fakeAccounts(access), sessionUser: async () => ({ id: session, email: '' }) };
  const fakeLive = {
    liveRooms: () => [],
    connections: () => ({ sockets: 0, players: 0, accounts: 0 }),
    announcement: () => null,
    emitServerStatus() {},
  };
  const store = memoryStore([{ id: A, role: 'admin' }, { id: B }]);
  const admin = createAdmin({ accounts, live: fakeLive, settings: createSettings(), errorLog: { recentErrors, clearErrors }, store });
  const app = express();
  app.use('/api/admin', admin.router);
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const h = { [ADMIN_HEADER]: '1', 'content-type': 'application/json' };
  try {
    let r = await fetch(`${base}/live`, { headers: h });
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), { error: 'No encontrado' });
    r = await fetch(`${base}/live/maintenance`, { method: 'POST', headers: h, body: JSON.stringify({ on: true }) });
    assert.equal(r.status, 404);
    session = A;
    r = await fetch(`${base}/live`, { headers: h });
    assert.equal(r.status, 200);
    assert.deepEqual((await r.json()).counts.total, 0);
    // A foreign Origin on a write is refused like an unknown URL
    r = await fetch(`${base}/live/maintenance`, { method: 'POST', headers: { ...h, origin: 'https://evil.example' }, body: JSON.stringify({ on: true }) });
    assert.equal(r.status, 404);
    r = await fetch(`${base}/live/maintenance`, { method: 'POST', headers: h, body: JSON.stringify({ on: true, message: 'Volvemos pronto' }) });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).maintenance.on, true);
    assert.ok(store.log.some((l) => l.action === 'maintenance.on' && l.adminId === A));
    r = await fetch(`${base}/users/${B}/coins`, { method: 'POST', headers: h, body: JSON.stringify({ delta: -5, reason: 'prueba' }) });
    assert.equal(r.status, 409);
    assert.equal(store.users.get(B).coins, 0);
  } finally {
    server.close();
  }
  assert.equal(await admin.isAdmin(B), false);
  assert.equal(await admin.isAdmin(A), true);
});

// ─── Service rules ───
await test('coin adjustments are atomic and never leave a negative balance', async () => {
  const store = memoryStore([{ id: A, role: 'admin' }, { id: B, coins: 100 }]);
  const svc = createAdminService(store);
  await assert.rejects(svc.adjustCoins(A, B, -101, 'multa'), (e) => e instanceof AdminError && e.status === 409);
  assert.equal(store.users.get(B).coins, 100);
  // Concurrent debits: only the ones the balance covers go through
  const outcomes = await Promise.allSettled([svc.adjustCoins(A, B, -60, 'uno'), svc.adjustCoins(A, B, -60, 'dos')]);
  assert.equal(outcomes.filter((o) => o.status === 'fulfilled').length, 1);
  assert.equal(store.users.get(B).coins, 40);
  assert.equal((await svc.adjustCoins(A, B, '+10', 'premio')).coins, 50);
  await assert.rejects(svc.adjustCoins(A, B, 0, 'nada'), /distinto de 0/);
  await assert.rejects(svc.adjustCoins(A, B, 1.5, 'decimal'), /entero/);
  await assert.rejects(svc.adjustCoins(A, B, 10, ''), /motivo/);
  await assert.rejects(svc.adjustCoins(A, 'not-a-uuid', 10, 'x y z'), (e) => e.status === 404);
  // Every change is logged with who did it and why
  assert.ok(store.log.every((l) => l.adminId === A && l.action === 'user.coins' && l.details.reason));
});

await test('gifts only catalogue items, once', async () => {
  const store = memoryStore([{ id: A, role: 'admin' }, { id: B }]);
  const svc = createAdminService(store);
  assert.equal((await svc.giftItem(A, B, 'board:night')).itemId, 'board:night');
  await assert.rejects(svc.giftItem(A, B, 'board:night'), (e) => e.status === 409);
  await assert.rejects(svc.giftItem(A, B, 'board:classic'), /gratuito/);
  await assert.rejects(svc.giftItem(A, B, 'board:fake'), /no existe/);
});

await test('roles: never remove yourself or the last admin', async () => {
  const store = memoryStore([{ id: A, role: 'admin' }, { id: B }, { id: C }]);
  const svc = createAdminService(store);
  await assert.rejects(svc.setRole(A, A, 'player'), /a ti mismo/);
  assert.equal((await svc.setRole(A, B, 'admin')).role, 'admin');
  assert.equal((await svc.setRole(A, B, 'player')).role, 'player');
  // With two admins one can step down; the last one can't be removed
  store.users.get(C).role = 'admin';
  await svc.setRole(C, A, 'player');
  await assert.rejects(svc.setRole(A, C, 'player'), (e) => e.status === 409 || /mismo/.test(e.message));
  await assert.rejects(svc.setRole(C, C, 'player'), /a ti mismo/);
  await assert.rejects(svc.setRole(A, B, 'owner'), /Rol no válido/);
});

await test('suspend / ban / lift rules', async () => {
  const store = memoryStore([{ id: A, role: 'admin' }, { id: B }, { id: C, role: 'admin' }]);
  const svc = createAdminService(store);
  await assert.rejects(svc.setStatus(A, A, { action: 'ban', reason: 'yo mismo' }), /propia cuenta/);
  await assert.rejects(svc.setStatus(A, C, { action: 'ban', reason: 'otro admin' }), /rol de admin/);
  await assert.rejects(svc.setStatus(A, B, { action: 'ban', reason: '' }), /motivo/);
  await assert.rejects(svc.setStatus(A, B, { action: 'suspend', until: new Date(Date.now() - 1000).toISOString(), reason: 'spam' }), /futuro/);
  const s = await svc.setStatus(A, B, { action: 'suspend', until: FUTURE(), reason: 'spam en el chat' });
  assert.equal(s.status, 'suspended');
  assert.equal(effectiveStatus(store.users.get(B)), 'suspended');
  await svc.setStatus(A, B, { action: 'ban', reason: 'trampas' });
  assert.equal(store.users.get(B).status, 'banned');
  await svc.setStatus(A, B, { action: 'lift' });
  assert.equal(effectiveStatus(store.users.get(B)), 'active');
  assert.deepEqual(store.log.map((l) => l.action), ['user.suspend', 'user.ban', 'user.lift']);
  // Offensive names can be replaced (and are cleaned like the profile ones)
  assert.equal((await svc.rename(A, B, '  Nuevo   nombre ')).displayName, 'Nuevo nombre');
  await assert.rejects(svc.rename(A, B, '   '), /nombre válido/);
});

// ─── Sockets: maintenance gate and blocked accounts (fake io) ───
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

await test('maintenance blocks new rooms and new seats, running games go on', async () => {
  const { io, connect } = fakeIo();
  const settings = createSettings();
  const live = registerSocketHandlers(io, new LobbyManager(), noTimers, null, { settings });
  const host = await connect({ playerId: 'host' });
  const created = await host.call('createRoom', { playerName: 'Naruto', turnTimeLimit: 0 });
  assert.equal(created.success, true);
  const p2 = await connect({ playerId: 'p2' });
  assert.equal((await p2.call('joinRoom', { roomId: created.roomId, playerName: 'Sasuke' })).success, true);

  await settings.setMaintenance({ on: true, message: '' });
  live.emitServerStatus();
  const other = await connect({ playerId: 'p3' });
  assert.deepEqual(other.sent.find((m) => m.ev === 'serverStatus').data.maintenance, { on: true, message: MAINTENANCE_DEFAULT_MESSAGE });
  const denied = await other.call('createRoom', { playerName: 'Sakura' });
  assert.equal(denied.success, false);
  assert.equal(denied.maintenance, true);
  const deniedJoin = await other.call('joinRoom', { roomId: created.roomId, playerName: 'Sakura' });
  assert.equal(deniedJoin.success, false);
  assert.equal(deniedJoin.error, MAINTENANCE_DEFAULT_MESSAGE);

  // The game that already exists starts and keeps going
  assert.equal((await host.call('startGame')).success, true);
  assert.equal((await p2.call('leaveRoom')).success, true);
  const back = await p2.call('joinRoom', { roomId: created.roomId, playerName: 'Sasuke' });
  assert.equal(back.success, true, back.error);
  assert.equal(live.liveRooms()[0].phase !== 'lobby', true);

  await settings.setMaintenance({ on: false });
  assert.equal((await other.call('createRoom', { playerName: 'Sakura', turnTimeLimit: 0 })).success, true);
});

await test('suspended / banned accounts connect as guests and are told why', async () => {
  const { io, connect } = fakeIo();
  const blocked = { [B]: 'Tu cuenta ninja fue bloqueada. Puedes seguir jugando como invitado.' };
  const accounts = {
    enabled: true,
    verifySocketToken: async (token) => ({ id: token === 'tok-b' ? B : A, name: 'x', email: '' }),
    accountBlock: async (id) => blocked[id] || null,
  };
  registerSocketHandlers(io, new LobbyManager(), noTimers, accounts, {});
  const banned = await connect({ playerId: 'pb', token: 'tok-b' });
  assert.equal(banned.data.user, null);
  assert.equal(banned.sent.find((m) => m.ev === 'accountBlocked').data.message, blocked[B]);
  const fine = await connect({ playerId: 'pa', token: 'tok-a' });
  assert.equal(fine.data.user.id, A);
  assert.equal(fine.sent.some((m) => m.ev === 'accountBlocked'), false);
  // Signing in from the menu is refused the same way
  const r = await fine.call('authenticate', { token: 'tok-b' });
  assert.equal(r.signedIn, false);
  assert.equal(r.blocked, true);
  assert.equal(fine.data.user, null);
  // A guest (no token) is never affected
  const guest = await connect({ playerId: 'pg' });
  assert.equal(guest.data.user, null);
  assert.equal((await guest.call('createRoom', { playerName: 'Invitado', turnTimeLimit: 0 })).success, true);
});

await test('ban kicks the live seats of the account and the admin observer stays hidden', async () => {
  const { io, connect, broadcasts } = fakeIo();
  const accounts = {
    enabled: true,
    verifySocketToken: async (token) => ({ id: token, name: 'x', email: '' }),
    accountBlock: async () => null,
  };
  const live = registerSocketHandlers(io, new LobbyManager(), noTimers, accounts, {
    isAdmin: async (id) => id === A,
  });
  const p = await connect({ playerId: 'pb', token: B });
  const created = await p.call('createRoom', { playerName: 'Banned', turnTimeLimit: 0 });
  const q = await connect({ playerId: 'pq' });
  await q.call('joinRoom', { roomId: created.roomId, playerName: 'Other' });
  assert.deepEqual(live.roomsOfAccount(B).map((s) => s.playerId), ['pb']);

  // Observing needs an admin account (checked on every event)
  const notAdmin = await connect({ playerId: 'px', token: B });
  assert.equal((await notAdmin.call('admin:observe', { roomId: created.roomId })).success, false);
  const adm = await connect({ playerId: 'adm', token: A });
  const obs = await adm.call('admin:observe', { roomId: created.roomId });
  assert.equal(obs.success, true);
  assert.equal(adm.sent.find((m) => m.ev === 'gameState').data.spectator, true);
  assert.equal(live.liveRooms()[0].spectators.length, 0);

  const out = live.kickAccount(B, 'bloqueada');
  assert.equal(out.seats, 1);
  assert.equal(out.sockets, 2);
  assert.ok(broadcasts.some((b) => b.room === 'pb' && b.ev === 'kicked'));
  assert.deepEqual(live.roomsOfAccount(B), []);
  assert.equal(p.data.user, null);

  // Admin close: every seated player is sent back to the menu with the reason
  assert.equal(live.adminCloseRoom(created.roomId, 'pruebas'), true);
  assert.ok(broadcasts.some((b) => b.room === 'pq' && b.ev === 'roomClosed' && /pruebas/.test(b.data.message)));
  assert.equal(live.liveRooms().length, 0);
  assert.equal(live.counters().closedByAdmin, 1);
});

await test('error ring buffer keeps the newest 50', () => {
  clearErrors();
  for (let i = 0; i < 60; i++) recordError('test', `error ${i}`);
  const list = recentErrors();
  assert.equal(list.length, 50);
  assert.equal(list[0].text, 'error 59');
  clearErrors();
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
console.log(`\n${results.length - failed}/${results.length} admin tests passed`);
if (failed > 0) process.exitCode = 1;
