// Engine-level tests: setup order, first roller, turn flow (no special build),
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
// Give every player one development card's worth of cards (enough to buy one)
function stockUp(e) {
  for (const pid of e.playerOrder) {
    const p = e.players[pid];
    p.resources.sheep = (p.resources.sheep || 0) + 1;
    p.resources.wheat = (p.resources.wheat || 0) + 1;
    p.resources.ore = (p.resources.ore || 0) + 1;
  }
}

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


for (const [n, board] of [[4, 'standard'], [4, 'extended'], [6, 'extended']]) {
  test(`${board} ${n}: no construction phase — after a turn the next player rolls, and only the turn player builds`, () => {
    const e = newGame(n, board);
    e.turnTimeLimit = 60;
    playSetup(e);
    stockUp(e);
    const order = e.playerOrder;
    for (let t = 0; t < n * 2; t++) {
      const pid = e.getCurrentPlayerId();
      assert.equal(e.phase, PHASE.ROLL_DICE);
      assert.equal(pid, order[t % n]);
      // Nobody else may build or buy, before or after the roll
      const other = order[(t + 1) % n];
      assert.equal(e.buyDevCard(other).success, false);
      rollThree(e);
      assert.equal(e.buyDevCard(other).success, false);
      assert.equal(e.endTurn(other, PHASE.MAIN).success, false);
      // The turn player can build/buy after rolling, then ends the turn
      if (e.players[pid].hasResources({ sheep: 1, wheat: 1, ore: 1 })) assert.ok(e.buyDevCard(pid).success);
      assert.ok(e.endTurn(pid, PHASE.MAIN).success);
      assert.equal(e.getTimerKey(), `turn:${e.turnNumber}:${order[(t + 1) % n]}`);
    }
  });
}

test('avatars: validated index, public in every view', () => {
  const e = new GameEngine('AVAT', 'standard');
  e.addPlayer('a', 'A', 5);
  e.addPlayer('b', 'B', 99);      // out of range → default
  e.addPlayer('c', 'C', '3');     // not an integer → default
  e.addPlayer('d', 'D', 2.5);
  assert.equal(e.players.a.avatarId, 5);
  assert.equal(e.players.b.avatarId, 0);
  assert.equal(e.players.c.avatarId, 0);
  assert.equal(e.players.d.avatarId, 0);
  assert.ok(e.setAvatar('b', 11));
  assert.equal(e.players.b.avatarId, 11);
  e.setAvatar('b', -1);
  assert.equal(e.players.b.avatarId, 0);
  assert.equal(e.setAvatar('nobody', 1), false);
  const pub = e.serialize(null);
  assert.equal(pub.players.a.avatarId, 5);
  assert.equal(e.serialize('c').players.a.avatarId, 5);
});

// ─── «Pacto de paz» (robber bribe) and the desert rule ───
const EMPTY = () => ({ wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 });

// Setup done, empty hands, then the current player rolls a 7 (nobody discards)
function toRobberMove(n, boardType) {
  const e = newGame(n, boardType);
  playSetup(e);
  for (const p of Object.values(e.players)) p.resources = EMPTY();
  const pid = e.getCurrentPlayerId();
  const res = withDice([3, 4], () => e.rollDice(pid));
  assert.ok(res.success, res.error);
  assert.equal(e.phase, PHASE.ROBBER_MOVE);
  return e;
}

const hexesOf = (e, pid) => Object.keys(e.board.hexes).filter((h) => e.board.getPlayersAdjacentToHex(h).includes(pid));
const producingHexes = (e) => Object.keys(e.board.hexes).filter((h) => !e.isDesertHex(h) && h !== e.board.robberHex);

for (const [boardType, n] of [['standard', 4], ['extended', 6]]) {
  test(`pacto (${boardType}): accepted → cards move, protected hexes and steal blocked`, () => {
    const e = toRobberMove(n, boardType);
    const [a, b, c] = e.playerOrder;
    e.players[b].resources.wheat = 2;
    e.players[c].resources.ore = 1;
    assert.ok(e.offerPeacePact(a, b, { wheat: 1, ore: 0 }).success);
    // Robber can't move while the offer waits
    assert.equal(e.moveRobber(a, producingHexes(e)[0]).success, false);
    // The cards asked for are private to the two players until signed
    assert.deepEqual(e.serialize(a).peacePact.request, { wheat: 1 });
    assert.deepEqual(e.serialize(b).peacePact.request, { wheat: 1 });
    assert.equal(e.serialize(c).peacePact.request, null);
    assert.equal(e.serialize(null).peacePact.request, null);
    assert.equal(e.respondPeacePact(c, true).success, false, 'only the target answers');
    const r = e.respondPeacePact(b, true);
    assert.ok(r.success, r.error);
    assert.equal(e.players[a].resources.wheat, 1);
    assert.equal(e.players[b].resources.wheat, 1);
    assert.equal(e.serialize(c).peacePact.status, 'accepted');
    assert.deepEqual(e.serialize(c).peacePact.request, { wheat: 1 });
    const ev = e.recentEvents.at(-1);
    assert.equal(ev.type, 'peacePact');
    assert.deepEqual({ fromId: ev.fromId, toId: ev.toId }, { fromId: a, toId: b });
    assert.equal(ev.request, undefined);
    assert.ok(e.gameLog.at(-1).message.includes('firmaron un pacto de paz (1 trigo)'));
    // Every hex with a building of b is off limits, in the state too
    const legal = e.serialize(c).robberHexes;
    for (const h of hexesOf(e, b)) {
      assert.ok(!legal.includes(h), `hex ${h} should be protected`);
      if (h !== e.board.robberHex) assert.equal(e.moveRobber(a, h).success, false);
    }
    // Moving onto a legal hex never robs b
    const target = legal.find((h) => !e.isDesertHex(h)) || legal[0];
    const before = e.players[b].totalResources();
    assert.ok(e.moveRobber(a, target).success);
    assert.equal(e.players[b].totalResources(), before);
    assert.equal(e.pact, null, 'pact cleared once the robber is placed');
    assert.ok(!(e.stealTargets || []).includes(b));
  });

  test(`pacto (${boardType}): rejected / unanswered → robber moves normally, one pact per move`, () => {
    const e = toRobberMove(n, boardType);
    const [a, b, c] = e.playerOrder;
    e.players[b].resources.brick = 1;
    e.players[c].resources.brick = 1;
    assert.ok(e.offerPeacePact(a, b, { brick: 1 }).success);
    assert.equal(e.offerPeacePact(a, c, { brick: 1 }).success, false, 'only one pending offer');
    assert.ok(e.respondPeacePact(b, false).success);
    assert.equal(e.players[b].resources.brick, 1);
    assert.equal(e.offerPeacePact(a, c, { brick: 1 }).success, false, 'no second pact this robber move');
    assert.equal(e.serialize(a).robberHexes.length, Object.keys(e.board.hexes).length - 1);
    assert.ok(e.moveRobber(a, hexesOf(e, b).find((h) => h !== e.board.robberHex)).success);

    // Unanswered: the pact timer key, then expiry = rejected and the turn key back
    const e2 = toRobberMove(n, boardType);
    const [a2, b2] = e2.playerOrder;
    e2.players[b2].resources.sheep = 1;
    const turnKey = e2.getTimerKey();
    assert.ok(e2.offerPeacePact(a2, b2, { sheep: 1 }).success);
    assert.ok(e2.getTimerKey().startsWith('pact:'));
    assert.equal(e2.getPausedTimerKey(), turnKey);
    assert.ok(e2.getTimerLimitMs() > 0 && e2.getTimerLimitMs() <= 20000);
    assert.ok(e2.handleTimeout().success);
    assert.equal(e2.pact.status, 'expired');
    assert.equal(e2.phase, PHASE.ROBBER_MOVE, 'the mover still moves the robber');
    assert.equal(e2.getTimerKey(), turnKey);
    assert.equal(e2.players[b2].resources.sheep, 1);
  });
}

test('pacto: request limits, targets and the room setting', () => {
  const e = toRobberMove(4, 'standard');
  const [a, b, c, d] = e.playerOrder;
  e.players[b].resources = { ...EMPTY(), wood: 3 };
  e.players[c].resources = { ...EMPTY(), ore: 1 };
  assert.equal(e.offerPeacePact(a, b, { wood: 3 }).success, false, 'max 2 cards');
  assert.equal(e.offerPeacePact(a, b, { wood: 2, ore: 1 }).success, false, 'max 2 cards in total');
  assert.equal(e.offerPeacePact(a, b, {}).success, false, 'at least 1 card');
  assert.equal(e.offerPeacePact(a, b, { gold: 1 }).success, false, 'valid resources');
  assert.equal(e.offerPeacePact(a, d, { wood: 1 }).success, false, 'target without cards');
  assert.equal(e.offerPeacePact(a, c, { ore: 2 }).success, false, 'more cards than the target holds');
  assert.equal(e.offerPeacePact(a, a, { ore: 1 }).success, false, 'not yourself');
  assert.equal(e.offerPeacePact(b, c, { ore: 1 }).success, false, 'only the robber mover');
  e.players[c].connected = false;
  assert.equal(e.offerPeacePact(a, c, { ore: 1 }).success, false, 'disconnected target');
  e.players[c].connected = true;
  // Target can't pay what is asked (the type is unknown to the mover): can't accept, can reject
  assert.ok(e.offerPeacePact(a, c, { wood: 1 }).success);
  const acc = e.respondPeacePact(c, true);
  assert.equal(acc.success, false);
  assert.match(acc.error, /No tienes las cartas/);
  assert.equal(e.pact.status, 'pending');
  assert.ok(e.respondPeacePact(c, false).success);

  // Setting off: no pacts at all
  const off = new GameEngine('OFF', 'standard');
  off.addPlayer('x', 'X');
  off.addPlayer('y', 'Y');
  assert.equal(off.peacePacts, true, 'on by default');
  assert.equal(off.updateSettings({ peacePacts: 'yes' }).success, false);
  assert.ok(off.updateSettings({ peacePacts: false }).success);
  assert.ok(off.updateSettings({ vpToWin: 12 }).success);
  assert.equal(off.peacePacts, false, 'other settings keep it');
  off.startGame();
  playSetup(off);
  for (const p of Object.values(off.players)) p.resources = EMPTY();
  const mover = off.getCurrentPlayerId();
  const other = off.playerOrder.find((p) => p !== mover);
  off.players[other].resources.wood = 1;
  withDice([3, 4], () => off.rollDice(mover));
  assert.equal(off.phase, PHASE.ROBBER_MOVE);
  assert.equal(off.offerPeacePact(mover, other, { wood: 1 }).success, false);
  assert.equal(off.serialize(mover).peacePacts, false);
  // Outside the robber move nobody can offer
  const e3 = newGame(3, 'standard');
  playSetup(e3);
  rollThree(e3);
  assert.equal(e3.offerPeacePact(e3.getCurrentPlayerId(), e3.playerOrder[1], { wood: 1 }).success, false);
});

test('pacto: works after a Knight (before rolling) and returns to the roll', () => {
  const e = newGame(3, 'standard');
  playSetup(e);
  const [a, b] = e.playerOrder;
  for (const p of Object.values(e.players)) p.resources = EMPTY();
  e.players[b].resources.ore = 2;
  e.players[a].devCards = ['knight'];
  assert.ok(e.playDevCard(a, 'knight').success);
  assert.equal(e.phase, PHASE.ROBBER_MOVE);
  assert.ok(e.offerPeacePact(a, b, { ore: 2 }).success);
  assert.ok(e.respondPeacePact(b, true).success);
  assert.equal(e.players[a].resources.ore, 2);
  const legal = e.getRobberHexes();
  assert.ok(hexesOf(e, b).every((h) => !legal.includes(h)));
  // Timeout auto-move picks a legal hex and never robs b
  e.players[b].resources.ore = 1;
  const stealBefore = e.lastSteal?.id ?? null;
  const evBefore = e.recentEvents.length ? e.recentEvents[e.recentEvents.length - 1].id : 0;
  e.handleTimeout();
  // The pact-bound move (the first one) avoided b. The timeout then goes on to
  // roll the dice, which may pay b or even bring a new 7, so check the event
  // of that first move instead of where the robber ends up or b's cards.
  const firstMove = e.recentEvents.find((ev) => ev.id > evBefore && ev.type === 'robberMoved');
  assert.ok(firstMove && !hexesOf(e, b).includes(firstMove.toHex));
  const steal = e.lastSteal && e.lastSteal.id !== stealBefore ? e.lastSteal : null;
  assert.ok(!steal || steal.victimId !== b || e.recentEvents.filter((ev) => ev.id > evBefore && ev.type === 'robberMoved').length > 1);
  assert.notEqual(e.phase, PHASE.ROBBER_MOVE);
});

test('pacto: protected player on every hex → desert or anywhere, never a deadlock', () => {
  for (const boardType of ['standard', 'extended']) {
    const e = toRobberMove(boardType === 'standard' ? 3 : 5, boardType);
    const [a, b] = e.playerOrder;
    e.players[b].resources.wheat = 1;
    assert.ok(e.offerPeacePact(a, b, { wheat: 1 }).success);
    assert.ok(e.respondPeacePact(b, true).success);
    // Pretend b has a building next to every hex
    const real = e.board.getPlayersAdjacentToHex.bind(e.board);
    e.board.getPlayersAdjacentToHex = (h) => [...new Set([...real(h), b])];
    const legal = e.getRobberHexes();
    assert.ok(legal.length > 0);
    const deserts = Object.keys(e.board.hexes).filter((h) => e.isDesertHex(h) && h !== e.board.robberHex);
    if (deserts.length > 0) assert.deepEqual(legal.sort(), deserts.sort());
    e.players[b].resources.wheat = 3;
    e.handleTimeout();
    assert.notEqual(e.phase, PHASE.ROBBER_MOVE, `${boardType}: the robber was placed`);
    assert.equal(e.players[b].resources.wheat, 3, 'protected player not robbed');
  }
});

test('pacto: cleared on turn end, by a target who leaves / disconnects, at game over', () => {
  const e = toRobberMove(4, 'standard');
  const [a, b, c] = e.playerOrder;
  e.players[b].resources.wood = 1;
  e.players[c].resources.wood = 1;
  assert.ok(e.offerPeacePact(a, b, { wood: 1 }).success);
  e.markLeft(b);
  assert.equal(e.pact.status, 'rejected', 'a target who leaves rejects at once');
  e.pact = null; // a fresh robber move
  assert.ok(e.offerPeacePact(a, c, { wood: 1 }).success);
  e.removePlayer(c); // disconnects
  assert.equal(e.pact.status, 'rejected');
  // A signed pact survives the mover's disconnection (reload)
  e.pact = { ...e.pact, status: 'accepted' };
  e.removePlayer(a);
  assert.equal(e.pact.status, 'accepted');
  e.reconnectPlayer(a);
  e.phase = PHASE.MAIN;
  assert.ok(e.endTurn(a).success);
  assert.equal(e.pact, null, 'cleared on turn end');
  assert.equal(e.serialize(a).peacePact, null);

  // The mover leaves: their offer is dropped and the server moves the robber
  const e2 = toRobberMove(3, 'standard');
  const [m, t] = e2.playerOrder;
  e2.players[t].resources.ore = 1;
  assert.ok(e2.offerPeacePact(m, t, { ore: 1 }).success);
  e2.removePlayer(m); // only disconnected: the offer stands
  assert.equal(e2.pact.status, 'pending');
  e2.markLeft(m);
  assert.equal(e2.pact.status, 'cancelled');
  e2.autoPlayLeft();
  assert.notEqual(e2.getCurrentPlayerId(), m);
  e2._setGameOver();
  assert.equal(e2.pact, null);
});

test('turn timer: a pending pact pauses the turn countdown and resumes it', () => {
  let clock = 1000;
  const timers = [];
  const t = createTurnTimers({
    onExpire: () => {},
    now: () => clock,
    setTimer: (fn, ms) => {
      const h = { fn, ms };
      timers.push(h);
      return h;
    },
    clearTimer: () => {},
  });
  const e = toRobberMove(3, 'standard');
  e.turnTimeLimit = 90;
  const room = { engine: e, turnTimer: null };
  t.sync('R', room);
  assert.equal(timers.at(-1).ms, 90000);
  clock += 50000; // 40 s left
  const [a, b] = e.playerOrder;
  e.players[b].resources.ore = 1;
  assert.ok(e.offerPeacePact(a, b, { ore: 1 }).success);
  t.sync('R', room);
  assert.ok(room.turnTimer.key.startsWith('pact:'));
  assert.ok(timers.at(-1).ms <= 20000);
  clock += 15000;
  assert.ok(e.respondPeacePact(b, false).success);
  t.sync('R', room);
  assert.equal(room.turnTimer.key, `turn:${e.turnNumber}:${a}`);
  assert.equal(timers.at(-1).ms, 40000, 'the 40 s left come back');
  // Without a turn limit the pact is still timed
  const e2 = toRobberMove(3, 'standard');
  e2.turnTimeLimit = 0;
  const room2 = { engine: e2, turnTimer: null };
  t.sync('R2', room2);
  assert.equal(room2.turnTimer, null);
  e2.players[e2.playerOrder[1]].resources.ore = 1;
  assert.ok(e2.offerPeacePact(e2.playerOrder[0], e2.playerOrder[1], { ore: 1 }).success);
  t.sync('R2', room2);
  assert.ok(room2.turnTimer && room2.turnTimer.key.startsWith('pact:'));
  e2.handleTimeout();
  t.sync('R2', room2);
  assert.equal(room2.turnTimer, null);
});

for (const [boardType, n] of [['standard', 4], ['extended', 6]]) {
  test(`desierto (${boardType}): the robber in the desert robs nobody`, () => {
    const e = toRobberMove(n, boardType);
    const [a] = e.playerOrder;
    for (const pid of e.playerOrder) e.players[pid].resources = { ...EMPTY(), wood: 2 };
    let deserts = Object.keys(e.board.hexes).filter((h) => e.isDesertHex(h));
    assert.equal(deserts.length, boardType === 'standard' ? 1 : 2);
    // Somebody (not a) next to every desert, so a steal would be possible
    const other = e.playerOrder[1];
    const real = e.board.getPlayersAdjacentToHex.bind(e.board);
    e.board.getPlayersAdjacentToHex = (h) => (e.isDesertHex(h) ? [...new Set([...real(h), other])] : real(h));
    // Leave the desert first (the robber starts there), then come back
    const away = producingHexes(e).find((h) => real(h).filter((p) => p !== a).length === 0) || producingHexes(e)[0];
    e.moveRobber(a, away);
    if (e.phase === PHASE.ROBBER_STEAL) e.stealCard(a, e.stealTargets[0]);
    const desert = deserts[0];
    const totals = () => e.playerOrder.map((p) => e.players[p].totalResources());
    // Knight → desert
    e.phase = PHASE.MAIN;
    e.players[a].devCards = ['knight'];
    e.players[a].hasPlayedDevCardThisTurn = false;
    e.players[a].devCardBoughtThisTurn = [];
    assert.ok(e.playDevCard(a, 'knight').success);
    const before = totals();
    const steals = e.stealCounter;
    const r = e.moveRobber(a, desert);
    assert.ok(r.success, r.error);
    assert.equal(r.desert, true);
    assert.deepEqual(r.stealTargets, []);
    assert.equal(e.phase, PHASE.MAIN);
    assert.deepEqual(totals(), before);
    assert.equal(e.stealCounter, steals);
    assert.ok(!e.recentEvents.some((ev) => ev.type === 'steal' && ev.id > e.eventCounter - 1));
    assert.equal(e.recentEvents.at(-1).type, 'robberMoved');
    assert.ok(e.gameLog.at(-1).message.includes('desierto: no roba a nadie'));
    // Timeout auto-move that lands on a desert also robs nobody
    if (boardType === 'extended') deserts = deserts.filter((h) => h !== e.board.robberHex);
    e.phase = PHASE.ROBBER_MOVE;
    e.phaseAfterRobber = PHASE.MAIN;
    const origPick = Math.random;
    const legal = e.getRobberHexes();
    const want = boardType === 'extended' ? deserts[0] : legal.find((h) => e.isDesertHex(h));
    if (want) {
      const idx = legal.indexOf(want);
      Math.random = () => (idx + 0.5) / legal.length;
      try {
        e.handleTimeout();
      } finally {
        Math.random = origPick;
      }
      assert.equal(e.board.robberHex, want);
      assert.deepEqual(totals(), before);
    }
  });
}

test('players who left the game no longer collect resources from the dice', () => {
  const e = newGame(3, 'standard');
  playSetup(e);
  const [a, b] = e.playerOrder;
  // Find a number that pays player b, then make b leave
  const hexOfB = Object.values(e.board.hexes).find((h) => h.number && h.resource
    && e.board.getBuildingsAdjacentToHex(h.id).some((bd) => bd.playerId === b));
  assert.ok(hexOfB, 'b has a producing hex');
  e.players[b].left = true;
  const before = { ...e.players[b].resources };
  const bankBefore = e.bankCount(hexOfB.resource);
  const others = e.board.getBuildingsAdjacentToHex(hexOfB.id).filter((bd) => bd.playerId !== b);
  const d1 = Math.min(6, Math.max(1, hexOfB.number - 1));
  withDice([d1, hexOfB.number - d1], () => e.rollDice(e.getCurrentPlayerId() === b ? a : e.getCurrentPlayerId()));
  assert.deepEqual(e.players[b].resources, before);
  // The bank only paid the players still in the game
  const paidOthers = others.reduce((n, bd) => n + (bd.type === 'city' ? 2 : 1), 0);
  if (!e.board.hexes[hexOfB.id].hasRobber) assert.ok(e.bankCount(hexOfB.resource) >= bankBefore - paidOthers - 4);
});

test('before rolling only the Knight can be played; other cards after the roll', () => {
  const e = newGame(3, 'standard');
  playSetup(e);
  const pid = e.getCurrentPlayerId();
  const p = e.players[pid];
  p.devCards = ['monopoly', 'yearOfPlenty', 'roadBuilding', 'knight'];
  p.devCardBoughtThisTurn = [];
  assert.equal(e.phase, PHASE.ROLL_DICE);
  for (const [card, params] of [['monopoly', { resource: 'wood' }], ['yearOfPlenty', { resource1: 'wood', resource2: 'ore' }], ['roadBuilding', {}]]) {
    const r = e.playDevCard(pid, card, params);
    assert.equal(r.success, false, card);
  }
  assert.equal(e.freeRoadsRemaining, 0);
  assert.ok(e.playDevCard(pid, 'knight', {}).success);
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
