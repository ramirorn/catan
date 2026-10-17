// Game data of the accounts (profile, Ryō, stats, results). Parameterized
// queries only; every function takes the pg pool.

export const DISPLAY_NAME_MAX = 20;
const AVATAR_COUNT = 12;

// Trimmed, single spaces, no control characters, at most 20 characters
export function cleanDisplayName(value) {
  if (typeof value !== 'string') return '';
  return Array.from(
    value
      .replace(/[\p{Cc}\p{Cf}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim(),
  )
    .slice(0, DISPLAY_NAME_MAX)
    .join('')
    .trim();
}

function defaultName(authUser) {
  return cleanDisplayName(authUser.name) || cleanDisplayName(String(authUser.email || '').split('@')[0]) || 'Ninja';
}

function toProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarId: row.avatar_id,
    coins: row.coins,
    gamesPlayed: row.games_played,
    gamesWon: row.games_won,
    authProvider: row.auth_provider,
    createdAt: row.created_at,
  };
}

const PROFILE_COLUMNS = 'id, email, display_name, avatar_id, coins, games_played, games_won, auth_provider, created_at';

/**
 * Returns the game profile of a Neon Auth user, creating it the first time
 * (name from the account, avatar chosen on the device when given).
 */
export async function ensureUser(pool, authUser, { avatarId } = {}) {
  const avatar = Number.isInteger(avatarId) && avatarId >= 0 && avatarId < AVATAR_COUNT ? avatarId : 0;
  const { rows } = await pool.query(
    `WITH ins AS (
       INSERT INTO users (id, email, display_name, avatar_id, auth_provider)
       VALUES ($1, $2, $3, $4,
         COALESCE((SELECT CASE WHEN "providerId" = 'google' THEN 'google' ELSE 'credential' END
                   FROM neon_auth.account WHERE "userId" = $1 ORDER BY "createdAt" LIMIT 1), 'credential'))
       ON CONFLICT (id) DO NOTHING
       RETURNING ${PROFILE_COLUMNS}
     )
     SELECT * FROM ins
     UNION ALL
     SELECT ${PROFILE_COLUMNS} FROM users WHERE id = $1
     LIMIT 1`,
    [authUser.id, String(authUser.email || '').toLowerCase(), defaultName(authUser), avatar],
  );
  return toProfile(rows[0]);
}

export async function getUser(pool, userId) {
  const { rows } = await pool.query(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = $1`, [userId]);
  return toProfile(rows[0]);
}

export async function updateProfile(pool, userId, { displayName, avatarId }) {
  const { rows } = await pool.query(
    `UPDATE users
        SET display_name = COALESCE($2, display_name),
            avatar_id = COALESCE($3, avatar_id),
            updated_at = now()
      WHERE id = $1
      RETURNING ${PROFILE_COLUMNS}`,
    [userId, displayName ?? null, avatarId ?? null],
  );
  return toProfile(rows[0]);
}

export async function getStats(pool, userId) {
  const user = await getUser(pool, userId);
  if (!user) return null;
  const { rows } = await pool.query(
    `SELECT room_id, won, vp, coins_awarded, ended_by, players, duration_s, played_at
       FROM game_results WHERE user_id = $1
      ORDER BY played_at DESC LIMIT 10`,
    [userId],
  );
  return {
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    coins: user.coins,
    recent: rows.map((r) => ({
      roomId: r.room_id,
      won: r.won,
      vp: r.vp,
      coins: r.coins_awarded,
      endedBy: r.ended_by,
      players: r.players,
      durationS: r.duration_s,
      playedAt: r.played_at,
    })),
  };
}

// The weekly ranking restarts every Monday at 00:00, Argentina time
const WEEK_START_SQL = `(date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires')`;

/**
 * Players with the most wins ('all' time or this 'week'), ties broken by
 * fewer games played. `rank` repeats on ties (1, 2, 2, 4…). With a userId,
 * also returns that player's own row (null if they have no wins yet).
 */
export async function getLeaderboard(pool, period, { limit = 20, userId = null } = {}) {
  const since = period === 'week' ? WEEK_START_SQL : `'-infinity'::timestamptz`;
  const ranked = `
    WITH ranked AS (
      SELECT user_id,
             count(*) FILTER (WHERE won)::int AS wins,
             count(*)::int AS games,
             rank() OVER (ORDER BY count(*) FILTER (WHERE won) DESC, count(*) ASC)::int AS pos
        FROM game_results
       WHERE played_at >= ${since}
       GROUP BY user_id
      HAVING count(*) FILTER (WHERE won) > 0
    )`;
  const cols = 'r.pos, r.wins, r.games, u.id, u.display_name, u.avatar_id';
  const top = await pool.query(
    `${ranked} SELECT ${cols} FROM ranked r JOIN users u ON u.id = r.user_id ORDER BY r.pos, u.display_name LIMIT $1`,
    [limit],
  );
  let me = null;
  if (userId) {
    const mine = await pool.query(`${ranked} SELECT ${cols} FROM ranked r JOIN users u ON u.id = r.user_id WHERE r.user_id = $1`, [userId]);
    me = mine.rows[0] ? toRankRow(mine.rows[0]) : null;
  }
  return { rows: top.rows.map(toRankRow), me };
}

function toRankRow(r) {
  return { rank: r.pos, wins: r.wins, games: r.games, userId: r.id, displayName: r.display_name, avatarId: r.avatar_id };
}

/**
 * Writes the results of one game and pays the Ryō, in one statement: the
 * UNIQUE (game_id, user_id) key makes it idempotent (a second call for the
 * same game inserts and pays nothing). Returns [{ userId, coins, total }]
 * for the accounts actually paid now.
 */
export async function recordGame(pool, summary, awards) {
  if (!awards.length) return [];
  const { rows } = await pool.query(
    `WITH t AS (
       SELECT * FROM unnest($1::uuid[], $2::boolean[], $3::int[], $4::int[]) AS t(user_id, won, vp, coins)
     ),
     ins AS (
       INSERT INTO game_results (game_id, user_id, room_id, won, vp, coins_awarded, ended_by, players, duration_s)
       SELECT $5, t.user_id, $6, t.won, t.vp, t.coins, $7, $8, $9
         FROM t JOIN users u ON u.id = t.user_id
       ON CONFLICT (game_id, user_id) DO NOTHING
       RETURNING user_id, won, coins_awarded
     )
     UPDATE users u
        SET coins = u.coins + ins.coins_awarded,
            games_played = u.games_played + 1,
            games_won = u.games_won + (CASE WHEN ins.won THEN 1 ELSE 0 END),
            updated_at = now()
       FROM ins
      WHERE u.id = ins.user_id
      RETURNING u.id, u.coins, ins.coins_awarded`,
    [
      awards.map((a) => a.userId),
      awards.map((a) => a.won),
      awards.map((a) => a.vp),
      awards.map((a) => a.coins),
      summary.gameId,
      summary.roomId,
      summary.endedBy,
      summary.players.length,
      summary.durationS,
    ],
  );
  return rows.map((r) => ({ userId: r.id, coins: r.coins_awarded, total: r.coins }));
}
