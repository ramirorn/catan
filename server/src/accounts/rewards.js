// Ryō (in-game coins) earned at the end of a game. Pure functions: the socket
// layer builds the summary, the store writes the result once per game.

export const COIN_NAME = 'Ryō';

export const REWARD_RULES = {
  finish: 20,       // finishing the game (still seated at the end)
  win: 30,          // extra for the winner
  perVp: 2,         // per victory point at the end…
  maxVpCounted: 20, // …counting at most this many
  minPlayers: 2,    // seats still taken by people at the end
  // A game ended by unanimous vote only pays after this many minutes
  minVoteMinutes: Number.isFinite(Number(process.env.REWARD_MIN_VOTE_MINUTES))
    && process.env.REWARD_MIN_VOTE_MINUTES !== ''
    ? Number(process.env.REWARD_MIN_VOTE_MINUTES)
    : 15,
};

/**
 * Summary of a finished game, taken from the engine. `accounts` maps a
 * seat's playerId to the account id bound to it (logged-in players only).
 */
export function summarizeGame(engine, accounts = {}) {
  const startedAt = engine.startedAt || Date.now();
  const endedAt = engine.endedAt || Date.now();
  const winnerId = engine.winner ? engine.winner.id : null;
  return {
    gameId: engine.gameId,
    roomId: engine.roomId,
    boardType: engine.boardType,
    endedBy: engine.endedByAgreement || !winnerId ? 'vote' : 'victory',
    durationS: Math.max(0, Math.round((endedAt - startedAt) / 1000)),
    players: engine.playerOrder.map((pid) => {
      const p = engine.players[pid];
      return {
        playerId: pid,
        accountId: accounts[pid] || null,
        vp: p ? p.calculateVP() : 0,
        won: pid === winnerId,
        left: !p || !!p.left,
      };
    }),
  };
}

/**
 * Decides who gets what. Returns { eligible, reason, awards } where awards
 * lists one entry per account (never twice the same account).
 */
export function computeRewards(summary, rules = REWARD_RULES) {
  const present = summary.players.filter((p) => !p.left);
  if (summary.players.length < rules.minPlayers || present.length < rules.minPlayers) {
    return { eligible: false, reason: `Las partidas con menos de ${rules.minPlayers} ninjas hasta el final no dan ${COIN_NAME}`, awards: [] };
  }
  if (summary.endedBy === 'vote' && summary.durationS < rules.minVoteMinutes * 60) {
    return {
      eligible: false,
      reason: `Las partidas terminadas por votación antes de ${rules.minVoteMinutes} minutos no dan ${COIN_NAME}`,
      awards: [],
    };
  }
  const seen = new Set();
  const awards = [];
  for (const p of present) {
    if (!p.accountId || seen.has(p.accountId)) continue;
    seen.add(p.accountId);
    const vp = Math.max(0, Math.floor(p.vp || 0));
    const coins = rules.finish + (p.won ? rules.win : 0) + rules.perVp * Math.min(vp, rules.maxVpCounted);
    awards.push({ playerId: p.playerId, userId: p.accountId, won: p.won, vp, coins });
  }
  return { eligible: true, reason: null, awards };
}
