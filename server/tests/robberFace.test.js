// «Cara del ladrón»: payload checks, host-only changes, the state carries only
// the id and the photo is fetched by the people of that room. Memory only.
import assert from 'node:assert/strict';
import { FACE_POINT_VALUES, parseRobberFace } from '../src/socket/robberFace.js';
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

// A tiny "JPEG": starts with FF D8 FF, ends with FF D9
const jpeg = (bytes = 64) => {
  const b = Buffer.alloc(bytes, 7);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[bytes - 2] = 0xff; b[bytes - 1] = 0xd9;
  return `data:image/jpeg;base64,${b.toString('base64')}`;
};
const points = () => Array.from({ length: FACE_POINT_VALUES }, (_, i) => (i % 3 === 2 ? -40 : 500));
const lastState = (broadcasts, to) => [...broadcasts].reverse().find((b) => b.room === to && b.ev === 'gameState')?.data;

await test('parseRobberFace: JPEG data URL of limited size and 468 integer points in range', () => {
  assert.ok(parseRobberFace({ image: jpeg(), points: points() }).face);
  assert.ok(parseRobberFace({ image: jpeg().replace('jpeg', 'png'), points: points() }).error, 'only JPEG');
  assert.ok(parseRobberFace({ image: 'data:image/jpeg;base64,AAAA', points: points() }).error, 'magic bytes');
  assert.ok(parseRobberFace({ image: jpeg(100 * 1024), points: points() }).error, 'too big');
  assert.ok(parseRobberFace({ image: `${jpeg()}<script>`, points: points() }).error, 'not base64');
  assert.ok(parseRobberFace({ image: jpeg(), points: points().slice(3) }).error, 'count');
  const bad = points(); bad[0] = 1001;
  assert.ok(parseRobberFace({ image: jpeg(), points: bad }).error, 'x range');
  const frac = points(); frac[2] = 0.5;
  assert.ok(parseRobberFace({ image: jpeg(), points: frac }).error, 'integers');
  assert.ok(parseRobberFace({}).error);
});

await test('setRobberFace: host only; the state carries the id, the room fetches the photo', async () => {
  const { io, connect, broadcasts } = fakeIo();
  const lobby = new LobbyManager();
  registerSocketHandlers(io, lobby, noTimers);
  const host = await connect({ playerId: 'h' });
  const room = await host.call('createRoom', { playerName: 'Hana', turnTimeLimit: 0 });
  const guest = await connect({ playerId: 'g' });
  await guest.call('joinRoom', { roomId: room.roomId, playerName: 'Goro' });
  const outsider = await connect({ playerId: 'x' });

  const denied = await guest.call('setRobberFace', { image: jpeg(), points: points() });
  assert.equal(denied.success, false);
  assert.match(denied.error, /anfitrión/);
  assert.equal((await host.call('setRobberFace', { image: jpeg(), points: [] })).success, false);

  const ok = await host.call('setRobberFace', { image: jpeg(), points: points() });
  assert.equal(ok.success, true, ok.error);
  const state = lastState(broadcasts, 'g');
  assert.deepEqual(state.robberFace, { id: ok.id, by: 'h' });
  assert.equal(JSON.stringify(state).includes('base64'), false, 'no photo in the state');

  const got = await guest.call('getRobberFace', { id: ok.id });
  assert.equal(got.success, true);
  assert.equal(got.face.image, jpeg());
  assert.equal(got.face.points.length, FACE_POINT_VALUES);
  assert.equal((await outsider.call('getRobberFace', { id: ok.id })).success, false, 'other rooms cannot fetch it');
  assert.equal((await guest.call('getRobberFace', { id: ok.id + 1 })).success, false, 'stale id');

  // At most one upload every few seconds
  assert.match((await host.call('setRobberFace', { image: jpeg(), points: points() })).error, /Espera/);

  assert.equal((await guest.call('clearRobberFace')).success, false);
  assert.equal((await host.call('clearRobberFace')).success, true);
  assert.equal(lastState(broadcasts, 'g').robberFace, null);
  assert.equal(lobby.getRoom(room.roomId).robberFace, null);
});

await test('a spectator can fetch the face; «imagen» is a valid report reason', async () => {
  const { io, connect } = fakeIo();
  const saved = [];
  const reports = { create: async (r) => { saved.push(r); return { id: saved.length }; } };
  registerSocketHandlers(io, new LobbyManager(), noTimers, null, { reports });
  const host = await connect({ playerId: 'h' });
  const room = await host.call('createRoom', { playerName: 'Hana', turnTimeLimit: 0 });
  const ok = await host.call('setRobberFace', { image: jpeg(), points: points() });
  const spec = await connect({ playerId: 's' });
  await spec.call('spectateRoom', { roomId: room.roomId, playerName: 'Sora' });
  assert.equal((await spec.call('getRobberFace', { id: ok.id })).success, true);
  const rep = await spec.call('reportPlayer', { targetId: 'h', reason: 'imagen' });
  assert.equal(rep.success, true, rep.error);
  assert.equal(saved[0].reason, 'imagen');
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
console.log(`\n${results.length - failed}/${results.length} robber face tests passed`);
if (failed > 0) process.exitCode = 1;
