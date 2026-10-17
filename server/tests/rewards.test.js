// Ryō rules and the once-per-game hook (no database needed).
import assert from 'node:assert/strict';
import { GameEngine } from '../src/game/GameEngine.js';
import { PHASE } from '../src/game/constants.js';
import { computeRewards, summarizeGame, REWARD_RULES } from '../src/accounts/rewards.js';
import { cleanDisplayName } from '../src/accounts/store.js';
import { rewriteSetCookie } from '../src/accounts/neonAuth.js';
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

const rules = { ...REWARD_RULES, minVoteMinutes: 15 };

function summary(over = {}) {
  return {
    gameId: '00000000-0000-4000-8000-000000000001',
    roomId: 'ABC123',
    endedBy: 'victory',
    durationS: 40 * 60,
    players: [
      { playerId: 'a', accountId: 'u1', vp: 10, won: true, left: false },
      { playerId: 'b', accountId: 'u2', vp: 6, won: false, left: false },
      { playerId: 'c', accountId: null, vp: 4, won: false, left: false },
    ],
    ...over,
  };
}

await test('rewards: winner and finisher with accounts are paid, guests are not', () => {
  const r = computeRewards(summary(), rules);
  assert.equal(r.eligible, true);
  assert.deepEqual(r.awards.map((a) => [a.userId, a.coins]), [
    ['u1', rules.finish + rules.win + rules.perVp * 10],
    ['u2', rules.finish + rules.perVp * 6],
  ]);
});

await test('rewards: players who left get nothing', () => {
  const s = summary();
  s.players[1].left = true;
  const r = computeRewards(s, rules);
  assert.deepEqual(r.awards.map((a) => a.userId), ['u1']);
});

await test('rewards: fewer than 2 players at the end pays nobody', () => {
  const s = summary();
  s.players[1].left = true;
  s.players[2].left = true;
  const r = computeRewards(s, rules);
  assert.equal(r.eligible, false);
  assert.equal(r.awards.length, 0);
});

await test('rewards: a quick unanimous vote pays nobody, a long one pays (no win bonus)', () => {
  const quick = computeRewards(summary({ endedBy: 'vote', durationS: 5 * 60, players: summary().players.map((p) => ({ ...p, won: false })) }), rules);
  assert.equal(quick.eligible, false);
  const long = computeRewards(summary({ endedBy: 'vote', durationS: 20 * 60, players: summary().players.map((p) => ({ ...p, won: false })) }), rules);
  assert.equal(long.eligible, true);
  assert.equal(long.awards[0].coins, rules.finish + rules.perVp * 10);
});

await test('rewards: one account in two seats is paid once', () => {
  const s = summary();
  s.players[1].accountId = 'u1';
  const r = computeRewards(s, rules);
  assert.equal(r.awards.filter((a) => a.userId === 'u1').length, 1);
});

await test('engine: onGameOver fires once, after the winner / vote is recorded', async () => {
  const e = new GameEngine('T1', 'standard');
  e.addPlayer('p0', 'A');
  e.addPlayer('p1', 'B');
  assert.ok(e.startGame().success);
  assert.ok(typeof e.gameId === 'string' && e.gameId.length === 36);
  const calls = [];
  e.onGameOver = (engine) => calls.push(summarizeGame(engine, { p0: 'u1' }));
  e.voteEndGame('p0', true);
  e.voteEndGame('p1', true);
  assert.equal(e.phase, PHASE.GAME_OVER);
  e._setGameOver(); // a second end never notifies again
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endedBy, 'vote');
  assert.equal(calls[0].players.find((p) => p.playerId === 'p0').accountId, 'u1');
});

await test('profile: display names are trimmed, single-spaced and at most 20 characters', () => {
  assert.equal(cleanDisplayName('  Kai   to  '), 'Kai to');
  assert.equal(cleanDisplayName('a'.repeat(40)).length, 20);
  assert.equal(cleanDisplayName('\u0000​'), '');
  assert.equal(cleanDisplayName(42), '');
});

await test('auth cookies are rewritten for our own domain (Lax, no Partitioned)', () => {
  const c = rewriteSetCookie('__Secure-neon-auth.session_token=abc; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=None; Partitioned');
  assert.equal(c, '__Secure-neon-auth.session_token=abc; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Lax');
});

await test('without DATABASE_URL accounts are disabled and never pay', async () => {
  const a = createAccounts({});
  assert.equal(a.enabled, false);
  assert.equal(await a.verifySocketToken('x'.repeat(40)), null);
  const r = await a.awardGame(summary());
  assert.deepEqual(r.paid, []);
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
console.log(`\n${results.length - failed}/${results.length} account tests passed`);
if (failed > 0) process.exitCode = 1;
