// Postgres side of reports (phase B). Parameterized queries only; changes
// made by an admin record their audit row in the same transaction.
import { insertAudit, withTx } from './store.js';

function toReport(r) {
  return {
    id: Number(r.id),
    reporterUserId: r.reporter_user_id,
    reporterPlayerId: r.reporter_player_id,
    reporterName: r.reporter_name,
    targetUserId: r.target_user_id,
    targetPlayerId: r.target_player_id,
    targetName: r.target_name,
    targetDisplayName: r.target_display_name || null,
    targetStatus: r.target_status || null,
    roomId: r.room_id,
    reason: r.reason,
    details: r.details,
    chatExcerpt: r.chat_excerpt || [],
    status: r.status,
    resolvedBy: r.resolved_by,
    resolvedByName: r.resolved_by_name || null,
    resolvedAt: r.resolved_at,
    notes: r.notes,
    createdAt: r.created_at,
    targetReports: r.target_reports != null ? Number(r.target_reports) : null,
  };
}

export function createPgReportStore(pool) {
  /** From the socket layer («Reportar») */
  async function create(rep) {
    const { rows } = await pool.query(
      `INSERT INTO reports (reporter_user_id, reporter_player_id, reporter_name, target_user_id, target_player_id,
                            target_name, room_id, reason, details, chat_excerpt)
       VALUES ((SELECT id FROM users WHERE id = $1), $2, $3, (SELECT id FROM users WHERE id = $4), $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING id`,
      [
        rep.reporterUserId,
        rep.reporterPlayerId,
        String(rep.reporterName).slice(0, 40),
        rep.targetUserId,
        rep.targetPlayerId,
        String(rep.targetName).slice(0, 40),
        String(rep.roomId).slice(0, 16),
        rep.reason,
        rep.details,
        JSON.stringify(rep.chatExcerpt || []),
      ],
    );
    return { id: Number(rows[0].id) };
  }

  async function list({ status = '', reason = '', userId = null, page = 1, pageSize = 25 }) {
    const offset = (page - 1) * pageSize;
    const { rows } = await pool.query(
      `SELECT r.*, t.display_name AS target_display_name, t.status AS target_status, a.display_name AS resolved_by_name,
              (SELECT count(*) FROM reports x
                WHERE (r.target_user_id IS NOT NULL AND x.target_user_id = r.target_user_id)
                   OR (r.target_user_id IS NULL AND x.target_player_id = r.target_player_id)) AS target_reports,
              count(*) OVER () AS total
         FROM reports r
         LEFT JOIN users t ON t.id = r.target_user_id
         LEFT JOIN users a ON a.id = r.resolved_by
        WHERE ($1 = '' OR r.status = $1)
          AND ($2 = '' OR r.reason = $2)
          AND ($3::uuid IS NULL OR r.target_user_id = $3::uuid)
        ORDER BY r.id DESC
        LIMIT $4 OFFSET $5`,
      [status, reason, userId, pageSize, offset],
    );
    const counts = await pool.query(`SELECT status, count(*)::int AS n FROM reports GROUP BY status`);
    return {
      total: rows[0] ? Number(rows[0].total) : 0,
      page,
      pageSize,
      counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
      reports: rows.map(toReport),
    };
  }

  async function get(id) {
    const { rows } = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    return rows[0] ? toReport(rows[0]) : null;
  }

  /** status 'resolved' | 'dismissed' | 'open' (reopen) */
  async function setStatus(id, { status, notes, adminId }, audit) {
    return withTx(pool, async (db) => {
      const upd = await db.query(
        `UPDATE reports SET status = $2, notes = $3,
                resolved_by = CASE WHEN $2 = 'open' THEN NULL ELSE $4::uuid END,
                resolved_at = CASE WHEN $2 = 'open' THEN NULL ELSE now() END
          WHERE id = $1 RETURNING *`,
        [id, status, notes, adminId],
      );
      if (!upd.rowCount) return null;
      await insertAudit(db, audit);
      return toReport(upd.rows[0]);
    });
  }

  return { create, list, get, setStatus };
}
