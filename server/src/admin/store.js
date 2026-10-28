// Postgres side of the admin panel. Parameterized queries only. Every write
// records its audit row (admin_actions) in the same transaction.
import { DEFAULT_ITEMS, getItem } from '../shop/catalog.js';

const TZ = 'America/Argentina/Buenos_Aires';

export async function withTx(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function insertAudit(db, audit) {
  return db.query(
    `INSERT INTO admin_actions (admin_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      audit.adminId || null,
      String(audit.action).slice(0, 64),
      audit.targetType ? String(audit.targetType).slice(0, 32) : null,
      audit.targetId != null ? String(audit.targetId).slice(0, 128) : null,
      JSON.stringify(audit.details || {}),
    ],
  );
}

// "100%_off" → "100\%\_off" for LIKE
export function likeEscape(text) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function toUserRow(r) {
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    avatarId: r.avatar_id,
    coins: r.coins,
    gamesPlayed: r.games_played,
    gamesWon: r.games_won,
    role: r.role,
    status: r.status,
    suspendedUntil: r.suspended_until,
    banReason: r.ban_reason,
    authProvider: r.auth_provider,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const USER_COLS = `id, email, display_name, avatar_id, coins, games_played, games_won, role, status,
  suspended_until, ban_reason, auth_provider, created_at, updated_at`;

export function createPgAdminStore(pool) {
  // ─── Service store interface (see ./service.js) ───
  async function getUser(userId) {
    const { rows } = await pool.query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [userId]);
    return rows[0] ? toUserRow(rows[0]) : null;
  }

  async function adjustCoins(userId, delta, audit) {
    return withTx(pool, async (db) => {
      // Atomic and never below 0 (the CHECK (coins >= 0) is the last guard)
      const upd = await db.query(
        `UPDATE users SET coins = coins + $2, updated_at = now()
          WHERE id = $1 AND coins + $2 >= 0
          RETURNING coins`,
        [userId, delta],
      );
      if (!upd.rowCount) {
        const { rows } = await db.query('SELECT coins FROM users WHERE id = $1', [userId]);
        return rows[0] ? { status: 'negative', coins: rows[0].coins } : { status: 'nouser', coins: 0 };
      }
      const coins = upd.rows[0].coins;
      await insertAudit(db, { ...audit, details: { ...audit.details, before: coins - delta, after: coins } });
      return { status: 'ok', coins };
    });
  }

  async function giftItem(userId, itemId, audit) {
    return withTx(pool, async (db) => {
      const ins = await db.query(
        `INSERT INTO user_items (user_id, item_id)
         SELECT id, $2 FROM users WHERE id = $1
         ON CONFLICT (user_id, item_id) DO NOTHING
         RETURNING item_id`,
        [userId, itemId],
      );
      if (!ins.rowCount) {
        const { rows } = await db.query('SELECT 1 FROM users WHERE id = $1', [userId]);
        return { status: rows[0] ? 'owned' : 'nouser' };
      }
      await insertAudit(db, audit);
      return { status: 'ok' };
    });
  }

  async function setStatus(userId, { status, until, reason }, audit) {
    return withTx(pool, async (db) => {
      const upd = await db.query(
        `UPDATE users SET status = $2, suspended_until = $3, ban_reason = $4, updated_at = now()
          WHERE id = $1 RETURNING id`,
        [userId, status, until, reason],
      );
      if (!upd.rowCount) return { status: 'nouser' };
      await insertAudit(db, audit);
      return { status: 'ok' };
    });
  }

  async function rename(userId, displayName, audit) {
    return withTx(pool, async (db) => {
      const upd = await db.query('UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1 RETURNING id', [userId, displayName]);
      if (!upd.rowCount) return { status: 'nouser' };
      await insertAudit(db, audit);
      return { status: 'ok' };
    });
  }

  async function setRole(userId, role, audit) {
    return withTx(pool, async (db) => {
      // Lock every admin row: two concurrent revokes can't both pass the check
      const admins = await db.query(`SELECT id FROM users WHERE role = 'admin' FOR UPDATE`);
      if (role !== 'admin' && admins.rows.some((r) => r.id === userId) && admins.rows.length <= 1) {
        return { status: 'lastAdmin' };
      }
      const upd = await db.query('UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING id', [userId, role]);
      if (!upd.rowCount) return { status: 'nouser' };
      await insertAudit(db, audit);
      return { status: 'ok' };
    });
  }

  /** Audit row for actions that change nothing in the database (live ones) */
  async function logAction(audit) {
    await insertAudit(pool, audit);
  }

  // ─── Reads ───
  async function searchUsers({ q = '', role = '', status = '', page = 1, pageSize = 25 }) {
    const text = String(q || '').trim().slice(0, 100);
    const exactId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : null;
    const like = `%${likeEscape(text.toLowerCase())}%`;
    const offset = (page - 1) * pageSize;
    const { rows } = await pool.query(
      `SELECT ${USER_COLS}, count(*) OVER () AS total
         FROM users
        WHERE ($1 = '' OR id = $2::uuid OR lower(display_name) LIKE $3 OR lower(email) LIKE $3)
          AND ($4 = '' OR role = $4)
          AND ($5 = '' OR status = $5)
        ORDER BY created_at DESC, id
        LIMIT $6 OFFSET $7`,
      [text, exactId, like, role, status, pageSize, offset],
    );
    return { total: rows[0] ? Number(rows[0].total) : 0, page, pageSize, users: rows.map(toUserRow) };
  }

  async function userDetail(userId) {
    const user = await getUser(userId);
    if (!user) return null;
    const [items, equipped, results, actions] = await Promise.all([
      pool.query('SELECT item_id, acquired_at FROM user_items WHERE user_id = $1 ORDER BY acquired_at', [userId]),
      pool.query('SELECT slot, item_id FROM user_equipped WHERE user_id = $1', [userId]),
      pool.query(
        `SELECT game_id, room_id, won, vp, coins_awarded, ended_by, players, duration_s, board_type, played_at
           FROM game_results WHERE user_id = $1 ORDER BY played_at DESC LIMIT 20`,
        [userId],
      ),
      pool.query(
        `SELECT a.id, a.action, a.details, a.created_at, u.display_name AS admin_name
           FROM admin_actions a LEFT JOIN users u ON u.id = a.admin_id
          WHERE a.target_type = 'user' AND a.target_id = $1
          ORDER BY a.id DESC LIMIT 15`,
        [userId],
      ),
    ]);
    const eq = { ...DEFAULT_ITEMS };
    for (const r of equipped.rows) eq[r.slot] = r.item_id;
    return {
      ...user,
      items: items.rows.map((r) => ({ itemId: r.item_id, name: getItem(r.item_id)?.name || r.item_id, acquiredAt: r.acquired_at })),
      equipped: eq,
      results: results.rows.map((r) => ({
        gameId: r.game_id,
        roomId: r.room_id,
        won: r.won,
        vp: r.vp,
        coins: r.coins_awarded,
        endedBy: r.ended_by,
        players: r.players,
        durationS: r.duration_s,
        boardType: r.board_type,
        playedAt: r.played_at,
      })),
      history: actions.rows.map((r) => ({ id: r.id, action: r.action, details: r.details, at: r.created_at, adminName: r.admin_name })),
    };
  }

  async function listActions({ action = '', adminId = null, page = 1, pageSize = 50 }) {
    const offset = (page - 1) * pageSize;
    const { rows } = await pool.query(
      `SELECT a.id, a.admin_id, u.display_name AS admin_name, a.action, a.target_type, a.target_id,
              a.details, a.created_at, count(*) OVER () AS total
         FROM admin_actions a LEFT JOIN users u ON u.id = a.admin_id
        WHERE ($1 = '' OR a.action = $1 OR a.action LIKE $2)
          AND ($3::uuid IS NULL OR a.admin_id = $3::uuid)
        ORDER BY a.id DESC
        LIMIT $4 OFFSET $5`,
      [action, action ? `${likeEscape(action)}.%` : '', adminId, pageSize, offset],
    );
    return {
      total: rows[0] ? Number(rows[0].total) : 0,
      page,
      pageSize,
      actions: rows.map((r) => ({
        id: Number(r.id),
        adminId: r.admin_id,
        adminName: r.admin_name,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        details: r.details,
        createdAt: r.created_at,
      })),
    };
  }

  async function actionsMeta() {
    const [actions, admins] = await Promise.all([
      pool.query('SELECT DISTINCT action FROM admin_actions ORDER BY action'),
      pool.query(
        `SELECT id, display_name FROM users
          WHERE role = 'admin' OR id IN (SELECT DISTINCT admin_id FROM admin_actions WHERE admin_id IS NOT NULL)
          ORDER BY display_name`,
      ),
    ]);
    return {
      actions: actions.rows.map((r) => r.action),
      admins: admins.rows.map((r) => ({ id: r.id, displayName: r.display_name })),
    };
  }

  /** Heavy numbers for the "Estadísticas" tab (cached by the router) */
  async function stats() {
    const [perDay, newPerDay, totals, boards, sizes] = await Promise.all([
      pool.query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(g.games, 0)::int AS games
           FROM generate_series((now() AT TIME ZONE '${TZ}')::date - 13, (now() AT TIME ZONE '${TZ}')::date, interval '1 day') d
           LEFT JOIN (
             SELECT (played_at AT TIME ZONE '${TZ}')::date AS day, count(DISTINCT game_id) AS games
               FROM game_results WHERE played_at >= now() - interval '15 days' GROUP BY 1
           ) g ON g.day = d::date
          ORDER BY d`,
      ),
      pool.query(
        `SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(n.accounts, 0)::int AS accounts
           FROM generate_series((now() AT TIME ZONE '${TZ}')::date - 13, (now() AT TIME ZONE '${TZ}')::date, interval '1 day') d
           LEFT JOIN (
             SELECT (created_at AT TIME ZONE '${TZ}')::date AS day, count(*) AS accounts
               FROM users WHERE created_at >= now() - interval '15 days' GROUP BY 1
           ) n ON n.day = d::date
          ORDER BY d`,
      ),
      pool.query(
        `WITH g AS (
           SELECT DISTINCT ON (game_id) game_id, duration_s, ended_by FROM game_results ORDER BY game_id
         )
         SELECT (SELECT count(*) FROM users)::int AS accounts,
                (SELECT COALESCE(sum(coins), 0) FROM users)::bigint AS coins,
                (SELECT count(*) FROM users WHERE role = 'admin')::int AS admins,
                (SELECT count(*) FROM users WHERE status <> 'active')::int AS restricted,
                count(*)::int AS games,
                COALESCE(round(avg(duration_s)), 0)::int AS avg_duration_s,
                count(*) FILTER (WHERE ended_by = 'vote')::int AS by_vote,
                count(*) FILTER (WHERE ended_by = 'victory')::int AS by_victory
           FROM g`,
      ),
      pool.query(
        `SELECT COALESCE(board_type, 'desconocido') AS board, count(*)::int AS games
           FROM (SELECT DISTINCT ON (game_id) game_id, board_type FROM game_results ORDER BY game_id) g
          GROUP BY 1 ORDER BY 2 DESC`,
      ),
      pool.query(
        `SELECT players, count(*)::int AS games
           FROM (SELECT DISTINCT ON (game_id) game_id, players FROM game_results ORDER BY game_id) g
          GROUP BY 1 ORDER BY 1`,
      ),
    ]);
    const t = totals.rows[0];
    return {
      gamesPerDay: perDay.rows,
      accountsPerDay: newPerDay.rows,
      totals: {
        accounts: t.accounts,
        coins: Number(t.coins),
        admins: t.admins,
        restricted: t.restricted,
        games: t.games,
        avgDurationS: t.avg_duration_s,
        byVote: t.by_vote,
        byVictory: t.by_victory,
      },
      boards: boards.rows,
      playerCounts: sizes.rows,
    };
  }

  async function ping() {
    const t = process.hrtime.bigint();
    await pool.query('SELECT 1');
    return Number(process.hrtime.bigint() - t) / 1e6;
  }

  return {
    getUser,
    adjustCoins,
    giftItem,
    setStatus,
    rename,
    setRole,
    logAction,
    searchUsers,
    userDetail,
    listActions,
    actionsMeta,
    stats,
    ping,
  };
}
