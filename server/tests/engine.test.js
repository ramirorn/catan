// Engine-level tests: setup order, first roller, special building phase,
// private steal info, spectator view, leaving players, game clock.
// Run with `npm test` (node test-server.js).

import assert from 'node:assert/strict';
import { GameEngine } from '../src/game/GameEngine.js';
import { PHASE } from '../src/game/constants.js';
import { createTurnTimers } from '../src/socket/turnTimer.js';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err });
  }
}

// Deterministic dice: each pair of values is one roll
function withDice(values, fn) {
  const original = Math.random;
  const queue = [...values];
  Math.random = () => (queue.length ? (queue.shift() - 1) / 6 + 0.01 : original());
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

function newGame(n, boardType) {
  const e = new GameEngine('TEST', boardType);
  for (let i = 0; i < n; i++) {
    const r = e.addPlayer(`p${i}`, `P${i}`);
    assert.ok(r.success, `add player ${i}`);
  }
  assert.ok(e.startGame().success);
  return e;
}

// Places every setup piece on the first valid spot; returns seat indices in placement order
function playSetup(e, { viaTimeout = false } = {}) {
  const seq = [];
  let guard = 0;
  while ((e.phase === PHASE.SETUP_FORWARD || e.phase === PHASE.SETUP_REVERSE) && guard++ < 100) {
    const pid = e.getCurrentPlayerId();
    seq.push(e.playerOrder.indexOf(pid));
    if (viaTimeout) {
      assert.ok(e.handleTimeout().success);
      continue;
    }
    const v = e.getValidPlacements(pid).validSettlements[0];
    assert.ok(e.setupPlaceSettlement(pid, v).success);
    const r = e.getValidPlacements(pid).validRoads[0];
    assert.ok(e.setupPlaceRoad(pid, r).success);
  }
  return seq;
}

function snake(n) {
  const fwd = Array.from({ length: n }, (_, i) => i);
  return [...fwd, ...fwd.slice().reverse()];
}

// Roll a non-7 for the current player (dice 1 + 2 = 3)
function rollThree(e) {
  const pid = e.getCurrentPlayerId();
  const res = withDice([1, 2], () => e.rollDice(pid));
  assert.ok(res.success, res.error);
  assert.equal(e.phase, PHASE.MAIN);
  return pid;
}

// ─── Bug 17: setup order and first roller ───
for (const boardType of ['standard', 'extended']) {
  const counts = boardType === 'standard' ? [2, 3, 4] : [2, 3, 4, 5, 6];
  for (const n of counts) {
    for (const viaTimeout of [false, true]) {
      test(`setup snake + first roller (${boardType}, ${n} jugadores${viaTimeout ? ', por tiempo' : ''})`, () => {
        const e = newGame(n, boardType);
        const seq = playSetup(e, { viaTimeout });
        assert.deepEqual(seq, snake(n));
        assert.equal(e.phase, PHASE.ROLL_DICE);
        assert.equal(e.turnNumber, 1);
        // The first player (who placed last) rolls first
        assert.equal(e.getCurrentPlayerId(), e.playerOrder[0]);
        assert.equal(e.serialize(e.playerOrder[0]).currentPlayerId, e.playerOrder[0]);
        // The second player cannot roll
        assert.equal(e.rollDice(e.playerOrder[1]).success, false);
        const res = withDice([2, 2], () => e.rollDice(e.playerOrder[0]));
        assert.ok(res.success);
        assert.equal(e.lastDiceRoll.playerId, e.playerOrder[0]);
        assert.equal(e.getTimerKey(), `turn:1:${e.playerOrder[0]}`);
      });
    }
  }
}

// ─── Bug 16: special building phase ───
test('extended 6: special build only for the other players, next player rolls', () => {
  const e = newGame(6, 'extended');
  playSetup(e);
  const order = e.playerOrder;
  rollThree(e);
  assert.ok(e.endTurn(order[0]).success);
  assert.equal(e.phase, PHASE.SPECIAL_BUILD);
  // Never the current player nor the next one (order[1])
  assert.equal(e.specialBuilderId, order[2]);
  assert.deepEqual(e.specialBuildQueue, [order[3], order[4], order[5]]);
  // The next player has nothing to end now (no «Terminar construcción» for them)
  assert.equal(e.endTurn(order[1]).success, false);
  assert.equal(e.rollDice(order[1]).success, false);
  assert.equal(e.endTurn(order[0]).success, false);
  // A stale «Pasar turno» click is rejected
  assert.equal(e.endTurn(order[2], PHASE.MAIN).success, false);
  assert.equal(e.specialBuilderId, order[2]);
  // Builders pass in order
  for (const pid of [order[2], order[3], order[4]]) {
    assert.ok(e.endTurn(pid, PHASE.SPECIAL_BUILD).success);
  }
  assert.equal(e.specialBuilderId, order[5]);
  const last = e.endTurn(order[5], PHASE.SPECIAL_BUILD);
  assert.ok(last.success);
  assert.equal(e.phase, PHASE.ROLL_DICE);
  assert.equal(e.getCurrentPlayerId(), order[1]);
  assert.equal(e.specialBuilderId, null);
  assert.equal(e.turnNumber, 2);
  // A second (stale) tap of the last builder can't end the new turn
  assert.equal(e.endTurn(order[5], PHASE.SPECIAL_BUILD).success, false);
  assert.equal(e.endTurn(order[1], PHASE.SPECIAL_BUILD).success, false);
  assert.equal(e.phase, PHASE.ROLL_DICE);
  // …and the next player gets to roll
  rollThree(e);
  assert.equal(e.getCurrentPlayerId(), order[1]);
});

test('extended: special build timeouts never skip the next roll', () => {
  const e = newGame(5, 'extended');
  playSetup(e);
  const order = e.playerOrder;
  rollThree(e);
  e.endTurn(order[0]);
  const keys = [];
  while (e.phase === PHASE.SPECIAL_BUILD) {
    keys.push(e.getTimerKey());
    assert.ok(e.handleTimeout().success);
  }
  assert.deepEqual(keys, [2, 3, 4].map((i) => `special:1:${order[i]}`));
  assert.equal(e.phase, PHASE.ROLL_DICE);
  assert.equal(e.getCurrentPlayerId(), order[1]);
  assert.equal(e.getTimerKey(), `turn:2:${order[1]}`);
});

test('extended: the turn player timing out goes through the special build to the next roll', () => {
  const e = newGame(4, 'extended');
  playSetup(e);
  const order = e.playerOrder;
  withDice([1, 2], () => e.handleTimeout()); // roll + end turn for P0
  assert.equal(e.phase, PHASE.SPECIAL_BUILD);
  assert.equal(e.specialBuilderId, order[2]);
  e.handleTimeout();
  e.handleTimeout();
  assert.equal(e.phase, PHASE.ROLL_DICE);
  assert.equal(e.getCurrentPlayerId(), order[1]);
});

test('extended 3 players: one special builder; 2 players: none', () => {
  const e3 = newGame(3, 'extended');
  playSetup(e3);
  rollThree(e3);
  e3.endTurn(e3.playerOrder[0]);
  assert.equal(e3.phase, PHASE.SPECIAL_BUILD);
  assert.equal(e3.specialBuilderId, e3.playerOrder[2]);
  assert.deepEqual(e3.specialBuildQueue, []);
  e3.endTurn(e3.playerOrder[2]);
  assert.equal(e3.phase, PHASE.ROLL_DICE);
  assert.equal(e3.getCurrentPlayerId(), e3.playerOrder[1]);

  const e2 = newGame(2, 'extended');
  playSetup(e2);
  rollThree(e2);
  e2.endTurn(e2.playerOrder[0]);
  assert.equal(e2.phase, PHASE.ROLL_DICE);
  assert.equal(e2.getCurrentPlayerId(), e2.playerOrder[1]);
});

test('extended: offline players are skipped in the special build', () => {
  const e = newGame(5, 'extended');
  playSetup(e);
  const order = e.playerOrder;
  e.players[order[3]].connected = false;
  rollThree(e);
  e.endTurn(order[0]);
  assert.equal(e.specialBuilderId, order[2]);
  assert.deepEqual(e.specialBuildQueue, [order[4]]);
});

test('extended: a special builder can build and buy, not trade or play cards', () => {
  const e = newGame(4, 'extended');
  playSetup(e);
  const order = e.playerOrder;
  rollThree(e);
  e.endTurn(order[0]);
  const b = e.players[order[2]];
  b.addResources({ sheep: 1, wheat: 1, ore: 1, wood: 1, brick: 1 });
  assert.ok(e.buyDevCard(order[2]).success);
  assert.equal(e.bankTrade(order[2], 'wood', 'brick').success, false);
  assert.equal(e.buyDevCard(order[1]).success, false);
});

test('standard: ending the turn goes straight to the next roll', () => {
  const e = newGame(4, 'standard');
  playSetup(e);
  const order = e.playerOrder;
  rollThree(e);
  const res = e.endTurn(order[0], PHASE.MAIN);
  assert.ok(res.success);
  assert.equal(e.phase, PHASE.ROLL_DICE);
  assert.equal(e.getCurrentPlayerId(), order[1]);
  assert.equal(e.specialBuilderId, null);
});

test('turn timer restarts for the next player after a special build', () => {
  const e = newGame(5, 'extended');
  e.turnTimeLimit = 60;
  playSetup(e);
  rollThree(e);
  const timers = [];
  const room = { engine: e, turnTimer: null };
  const tt = createTurnTimers({
    onExpire: () => {},
    now: () => 0,
    setTimer: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimer: () => {},
  });
  tt.sync('TEST', room);
  const firstKey = room.turnTimer.key;
  e.endTurn(e.playerOrder[0]);
  tt.sync('TEST', room);
  assert.notEqual(room.turnTimer.key, firstKey);
  while (e.phase === PHASE.SPECIAL_BUILD) {
    e.endTurn(e.specialBuilderId);
    tt.sync('TEST', room);
  }
  assert.equal(room.turnTimer.key, `turn:2:${e.playerOrder[1]}`);
  assert.equal(timers.at(-1).ms, 60000);
});

// ─── Steal notice (private) ───
test('steal: only thief and victim see the resource', () => {
  const e = newGame(4, 'standard');
  playSetup(e);
  const [a, b, c] = e.playerOrder;
  e.players[b].resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 3 };
  e.phase = PHASE.ROBBER_STEAL;
  e.stealTargets = [b];
  const res = e.stealCard(a, b);
  assert.ok(res.success);
  assert.equal(e.serialize(a).lastSteal.resource, 'ore');
  assert.equal(e.serialize(b).lastSteal.resource, 'ore');
  assert.equal(e.serialize(c).lastSteal.resource, null);
  assert.equal(e.serialize(null).lastSteal.resource, null);
  assert.equal(e.serialize(c).lastSteal.thiefId, a);
  assert.equal(e.serialize(c).lastSteal.victimId, b);
  assert.equal(e.serialize(a).lastSteal.source, 'dice');
});

test('steal: Knight auto-steal is recorded as knight', () => {
  const e = newGame(3, 'standard');
  playSetup(e);
  const [a, b] = e.playerOrder;
  const victimHex = e.board.vertices[Object.keys(e.board.vertices).find((v) => e.board.vertices[v].building?.playerId === b)].adjacentHexes
    .find((h) => h !== e.board.robberHex && !e.board.getPlayersAdjacentToHex(h).includes(a) && e.board.getPlayersAdjacentToHex(h).length === 1);
  if (!victimHex) { console.log('    (knight test: no single-victim hex on this board)'); return; }
  for (const p of Object.values(e.players)) p.resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  e.players[b].resources.wheat = 2;
  e.players[a].devCards = ['knight'];
  assert.ok(e.playDevCard(a, 'knight').success);
  const res = e.moveRobber(a, victimHex);
  assert.ok(res.success, res.error);
  assert.equal(e.lastSteal.source, 'knight');
  assert.equal(e.serialize(b).lastSteal.resource, 'wheat');
});

// ─── Spectator view ───
test('spectator view hides every hand', () => {
  const e = newGame(4, 'standard');
  playSetup(e);
  const view = e.serialize(null);
  assert.equal(view.validPlacements, undefined);
  assert.equal(view.portRatios, undefined);
  for (const p of Object.values(view.players)) {
    assert.equal(p.resources, undefined);
    assert.equal(p.devCards, undefined);
    assert.equal(p.hiddenVP, undefined);
    assert.equal(typeof p.totalResources, 'number');
  }
  // An unknown id gets the same public view
  assert.equal(e.serialize('someone-else').validPlacements, undefined);
});

// ─── Leaving a game ───
test('a player who leaves is played by the server and leaves the vote', () => {
  const e = newGame(3, 'standard');
  playSetup(e);
  const [a, b, c] = e.playerOrder;
  e.markLeft(a);
  withDice([1, 2], () => e.autoPlayLeft());
  assert.equal(e.phase, PHASE.ROLL_DICE);
  assert.equal(e.getCurrentPlayerId(), b);
  e.voteEndGame(b, true);
  assert.notEqual(e.phase, PHASE.GAME_OVER);
  e.voteEndGame(c, true);
  assert.equal(e.phase, PHASE.GAME_OVER);
  assert.ok(e.endedAt >= e.startedAt);
});

test('a player who leaves during setup gets random placements', () => {
  const e = newGame(3, 'extended');
  const [a] = e.playerOrder;
  e.markLeft(a);
  e.autoPlayLeft();
  assert.equal(e.getCurrentPlayerId(), e.playerOrder[1]);
  assert.equal(e.players[a].settlementsBuilt, 1);
});

test('left player can rejoin; kicked cannot', () => {
  const e = newGame(3, 'standard');
  const [a, b] = e.playerOrder;
  e.markLeft(b);
  assert.ok(e.rejoinPlayer(b));
  assert.equal(e.players[b].left, false);
  e.markLeft(a, { kicked: true });
  assert.equal(e.rejoinPlayer(a), false);
});

// ─── Game clock & Spanish names ───
test('game clock and «piedra» in the chronicle', () => {
  const e = newGame(2, 'standard');
  assert.equal(typeof e.serialize(null).startedAt, 'number');
  assert.equal(e.serialize(null).endedAt, null);
  playSetup(e);
  rollThree(e);
  const pid = e.getCurrentPlayerId();
  e.players[pid].resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 1 };
  const r = e.bankTrade(pid, 'ore', 'wood');
  assert.equal(r.success, false);
  assert.match(r.error, /piedra/);
});

// ─── Animation event feed (recentEvents) ───
const evTypes = (e, fromId = 0) => e.recentEvents.filter((ev) => ev.id > fromId).map((ev) => ev.type);
const lastEvId = (e) => (e.recentEvents.length ? e.recentEvents[e.recentEvents.length - 1].id : 0);

test('events: ids increase, buffer stays short, state carries it', () => {
  const e = newGame(2, 'standard');
  playSetup(e);
  assert.deepEqual(e.serialize(null).recentEvents, []);
  for (let i = 0; i < 10; i++) e._pushEvent('robberMoved', { playerId: 'p0', fromHex: 'a', toHex: 'b' });
  const ids = e.recentEvents.map((ev) => ev.id);
  assert.ok(ids.length <= 6 && ids.length >= 5, `buffer size ${ids.length}`);
  for (let i = 1; i < ids.length; i++) assert.equal(ids[i], ids[i - 1] + 1);
  assert.equal(ids[ids.length - 1], 10);
  assert.equal(e.serialize('p0').recentEvents.length, ids.length);
  assert.equal(e.serialize(null).recentEvents[0].id, ids[0]);
});

test('events: city upgrade, robber move and steal (steal without resource)', () => {
  const e = newGame(4, 'standard');
  playSetup(e);
  const pid = rollThree(e);
  const before = lastEvId(e);
  e.players[pid].resources = { wood: 0, brick: 0, sheep: 0, wheat: 2, ore: 3 };
  const vertexId = Object.keys(e.board.vertices).find((v) => e.board.vertices[v].building?.playerId === pid);
  assert.ok(e.buildCity(pid, vertexId).success);
  const city = e.recentEvents.find((ev) => ev.id > before && ev.type === 'cityUpgrade');
  assert.deepEqual({ playerId: city.playerId, vertexId: city.vertexId }, { playerId: pid, vertexId });

  // Robber + steal
  const [a, b, c] = e.playerOrder;
  const fromHex = e.board.robberHex;
  const target = Object.keys(e.board.hexes).find((h) => h !== fromHex);
  e.phase = PHASE.ROBBER_MOVE;
  e.phaseAfterRobber = PHASE.MAIN;
  e.currentPlayerIndex = 0;
  const mark = lastEvId(e);
  assert.ok(e.moveRobber(a, target).success);
  const moved = e.recentEvents.find((ev) => ev.id > mark && ev.type === 'robberMoved');
  assert.equal(moved.fromHex, fromHex);
  assert.equal(moved.toHex, target);
  assert.equal(moved.playerId, a);

  e.players[b].resources = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 3 };
  e.phase = PHASE.ROBBER_STEAL;
  e.stealTargets = [b];
  const mark2 = lastEvId(e);
  assert.ok(e.stealCard(a, b).success);
  const steal = e.serialize(c).recentEvents.find((ev) => ev.id > mark2 && ev.type === 'steal');
  assert.equal(steal.thiefId, a);
  assert.equal(steal.victimId, b);
  assert.equal(steal.resource, undefined);
  assert.ok(!JSON.stringify(e.recentEvents).includes('"ore"'), 'no resource anywhere in the feed');
});

test('events: each played dev card is announced (never VP cards)', () => {
  const e = newGame(2, 'standard');
  playSetup(e);
  const a = e.getCurrentPlayerId();
  const play = (card, params) => {
    e.players[a].devCards = [card];
    e.players[a].devCardBoughtThisTurn = [];
    e.players[a].hasPlayedDevCardThisTurn = false;
    e.phase = PHASE.MAIN;
    const mark = lastEvId(e);
    const r = e.playDevCard(a, card, params);
    assert.ok(r.success, `${card}: ${r.error}`);
    return e.recentEvents.filter((ev) => ev.id > mark);
  };
  const k = play('knight');
  assert.equal(k[0].type, 'devCard');
  assert.equal(k[0].cardType, 'knight');
  assert.equal(k[0].playerId, a);
  assert.equal(play('roadBuilding')[0].cardType, 'roadBuilding');
  const y = play('yearOfPlenty', { resource1: 'wood', resource2: 'ore' })[0];
  assert.equal(y.cardType, 'yearOfPlenty');
  assert.deepEqual(y.resources, ['wood', 'ore']);
  const m = play('monopoly', { resource: 'sheep' })[0];
  assert.equal(m.cardType, 'monopoly');
  assert.equal(m.resource, 'sheep');
  e.players[a].devCards = ['victoryPoint'];
  const mark = lastEvId(e);
  assert.equal(e.playDevCard(a, 'victoryPoint').success, false);
  assert.deepEqual(evTypes(e, mark), []);
});

test('events: nearWin once per player, public points only', () => {
  const e = newGame(3, 'standard');
  playSetup(e);
  const [a, b] = e.playerOrder;
  // Hidden VP cards never trigger it (no leak)
  e.players[b].hiddenVP = 6;
  e._checkNearWin();
  assert.ok(!e.recentEvents.some((ev) => ev.type === 'nearWin'));
  // a: 2 settlements (2 VP) → 8 public VP with 3 cities upgrades
  const pid = rollThree(e);
  assert.equal(pid, a);
  const mine = Object.keys(e.board.vertices).filter((v) => e.board.vertices[v].building?.playerId === a);
  e.players[a].settlementsBuilt += 4; // pretend 4 more settlements elsewhere → 6 VP
  e.players[a].resources = { wood: 0, brick: 0, sheep: 0, wheat: 4, ore: 6 };
  assert.ok(e.buildCity(a, mine[0]).success); // 7 VP
  assert.ok(!e.recentEvents.some((ev) => ev.type === 'nearWin'));
  assert.ok(e.buildCity(a, mine[1]).success); // 8 VP = vpToWin - 2
  const near = e.recentEvents.filter((ev) => ev.type === 'nearWin');
  assert.equal(near.length, 1);
  assert.equal(near[0].playerId, a);
  assert.equal(near[0].vpLeft, 2);
  const types = e.recentEvents.map((ev) => ev.type);
  assert.ok(types.lastIndexOf('cityUpgrade') < types.lastIndexOf('nearWin'), 'city first, then near win');
  // Once only
  e._checkNearWin();
  e.players[a].settlementsBuilt += 1; // 9 VP
  e._checkNearWin();
  assert.equal(e.recentEvents.filter((ev) => ev.type === 'nearWin').length, 1);
  assert.equal(e.nearWinAnnounced.size, 1);
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
console.log(`\n${results.length - failed}/${results.length} engine tests passed`);
if (failed > 0) process.exitCode = 1;
