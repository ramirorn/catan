// Postgres side of "Tienda y economía" (read-only numbers) and "Ranking"
// (exclusions). Parameterized queries only; every exclusion / restore
// records its audit row in the same transaction.
import { getItem } from '../shop/catalog.js';
import { insertAudit, withTx } from './store.js';

export function createPgEconomyStore(pool) {
  async function economyStats() {
    const [totals, top, sold, owners, recent] = await Promise.all([
      pool.query(
        `SELECT (SELECT COALESCE(sum(coins), 0) FROM users)::bigint AS circulation,
                (SELECT count(*) FROM users WHERE coins > 0)::int AS holders,
                (SELECT COALESCE(sum(coins_awarded), 0) FROM game_results)::bigint AS earned,
                (SELECT COALESCE(sum(price_paid), 0) FROM shop_purchases)::bigint AS spent,
                (SELECT count(*) FROM shop_purchases)::int AS purchases`,
      ),
      pool.query('SELECT id, display_name, avatar_id, coins FROM users ORDER BY coins DESC, display_name LIMIT 10'),
      pool.query(
        `SELECT item_id, count(*)::int AS sold, COALESCE(sum(price_paid), 0)::bigint AS spent,
                count(*) FILTER (WHERE sale_percent IS NOT NULL)::int AS on_sale
           FROM shop_purchases GROUP BY item_id`,
      ),
      pool.query('SELECT item_id, count(*)::int AS owners FROM user_items GROUP BY item_id'),
      pool.query(
        `SELECT p.id, p.user_id, u.display_name, p.item_id, p.price_paid, p.list_price, p.sale_percent, p.created_at
           FROM shop_purchases p LEFT JOIN users u ON u.id = p.user_id
          ORDER BY p.id DESC LIMIT 20`,
      ),
    ]);
    const t = totals.rows[0];
    return {
      totals: {
        circulation: Number(t.circulation),
        holders: t.holders,
        earned: Number(t.earned),
        spent: Number(t.spent),
        purchases: t.purchases,
      },
      top: top.rows.map((r) => ({ userId: r.id, displayName: r.display_name, avatarId: r.avatar_id, coins: r.coins })),
      perItem: Object.fromEntries(sold.rows.map((r) => [r.item_id, { sold: r.sold, spent: Number(r.spent), onSale: r.on_sale }])),
      owners: Object.fromEntries(owners.rows.map((r) => [r.item_id, r.owners])),
      recent: recent.rows.map((r) => ({
        id: Number(r.id),
        userId: r.user_id,
        displayName: r.display_name,
        itemId: r.item_id,
        itemName: getItem(r.item_id)?.name || r.item_id,
        pricePaid: r.price_paid,
        listPrice: r.list_price,
        salePercent: r.sale_percent,
        at: r.created_at,
      })),
    };
  }

  // ─── Ranking ───
  /** Recent results of one account, with the exclusion flags */
  async function userResults(userId, limit = 30) {
    const { rows } = await pool.query(
      `SELECT r.game_id, r.room_id, r.won, r.vp, r.players, r.ended_by, r.played_at, r.excluded, r.excluded_reason, r.excluded_at
         FROM game_results r WHERE r.user_id = $1 ORDER BY r.played_at DESC LIMIT $2`,
      [userId, limit],
    );
    return rows.map((r) => ({
      gameId: r.game_id,
      roomId: r.room_id,
      won: r.won,
      vp: r.vp,
      players: r.players,
      endedBy: r.ended_by,
      playedAt: r.played_at,
      excluded: r.excluded,
      excludedReason: r.excluded_reason,
      excludedAt: r.excluded_at,
    }));
  }

  /** Excluded results, grouped by game */
  async function excludedList(limit = 50) {
    const { rows } = await pool.query(
      `SELECT r.game_id, r.room_id, min(r.played_at) AS played_at, max(r.excluded_at) AS excluded_at,
              max(r.excluded_reason) AS reason,
              json_agg(json_build_object('userId', r.user_id, 'name', u.display_name, 'won', r.won) ORDER BY r.won DESC) AS players
         FROM game_results r LEFT JOIN users u ON u.id = r.user_id
        WHERE r.excluded
        GROUP BY r.game_id, r.room_id
        ORDER BY max(r.excluded_at) DESC NULLS LAST
        LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      gameId: r.game_id,
      roomId: r.room_id,
      playedAt: r.played_at,
      excludedAt: r.excluded_at,
      reason: r.reason,
      players: r.players,
    }));
  }

  /**
   * scope 'game' (every row of that game_id) or 'user' (every result of the
   * account). excluded = true / false (restore). Returns the rows changed.
   */
  async function setExcluded({ scope, id, excluded, reason }, audit) {
    return withTx(pool, async (db) => {
      const column = scope === 'game' ? 'game_id' : 'user_id';
      const upd = await db.query(
        `UPDATE game_results
            SET excluded = $2,
                excluded_reason = CASE WHEN $2 THEN $3 ELSE NULL END,
                excluded_at = CASE WHEN $2 THEN now() ELSE NULL END
          WHERE ${column} = $1 AND excluded <> $2`,
        [id, excluded, reason || null],
      );
      const exists = upd.rowCount
        ? true
        : (await db.query(`SELECT 1 FROM game_results WHERE ${column} = $1 LIMIT 1`, [id])).rowCount > 0;
      if (!exists) return { status: 'none', changed: 0 };
      await insertAudit(db, { ...audit, details: { ...audit.details, rows: upd.rowCount } });
      return { status: 'ok', changed: upd.rowCount };
    });
  }

  return { economyStats, userResults, excludedList, setExcluded };
}
