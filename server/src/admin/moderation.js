// Chat moderation shared by the socket layer and the "Moderación" tab:
// mutes (accounts persisted in chat_mutes, guests in memory by playerId),
// the report rate limit and the Spanish messages players see.
import { formatDate } from './access.js';

export const MUTE_MAX_MINUTES = 7 * 24 * 60;
// "Until the game ends" also has a safety end (a room that never ends)
export const MUTE_GAME_CAP_MS = 12 * 60 * 60 * 1000;

export const REPORT_REASONS = ['insultos', 'trampa', 'spam', 'nombre', 'otro'];
export const REPORT_REASON_LABELS = {
  insultos: 'Insultos',
  trampa: 'Trampa',
  spam: 'Spam',
  nombre: 'Nombre ofensivo',
  otro: 'Otro',
};
export const REPORT_TEXT_MAX = 300;
export const REPORT_EXCERPT = 15; // last chat messages kept with a report

const keyOf = ({ userId, playerId }) => (userId ? `u:${userId}` : `p:${playerId}`);

/** Spanish text for a muted player trying to write */
export function muteMessage(entry) {
  const why = entry.reason ? ` Motivo: ${String(entry.reason).replace(/[.\s]+$/, '')}.` : '';
  if (entry.roomId) return `Un moderador te silenció: no puedes escribir en el chat hasta que termine la partida.${why}`;
  return `Un moderador te silenció: no puedes escribir en el chat hasta el ${formatDate(entry.until)} (hora de Argentina).${why}`;
}

/**
 * Mutes. `find` is synchronous (every chat message checks it); account mutes
 * are written through to Postgres and loaded at start-up.
 */
export function createMutes({ pool = null } = {}) {
  const map = new Map(); // key → entry

  function alive(entry, now) {
    return entry && entry.until > now;
  }

  async function load() {
    if (!pool) return;
    try {
      // Rooms do not survive a restart: "until the game ends" mutes go too
      await pool.query('DELETE FROM chat_mutes WHERE muted_until <= now() OR room_id IS NOT NULL');
      const { rows } = await pool.query(
        `SELECT m.user_id, m.muted_until, m.reason, m.muted_by, m.created_at, u.display_name
           FROM chat_mutes m JOIN users u ON u.id = m.user_id`,
      );
      for (const r of rows) {
        map.set(`u:${r.user_id}`, {
          key: `u:${r.user_id}`,
          userId: r.user_id,
          playerId: null,
          name: r.display_name,
          until: new Date(r.muted_until).getTime(),
          roomId: null,
          reason: r.reason,
          by: r.muted_by,
          at: new Date(r.created_at).getTime(),
        });
      }
    } catch (err) {
      console.warn('Could not load the chat mutes:', err.message);
    }
  }

  /** The mute that applies to this writer now (account first), or null */
  function find({ userId = null, playerId = null }, now = Date.now()) {
    for (const key of [userId ? `u:${userId}` : null, playerId ? `p:${playerId}` : null]) {
      if (!key) continue;
      const entry = map.get(key);
      if (!entry) continue;
      if (alive(entry, now)) return entry;
      map.delete(key);
    }
    return null;
  }

  /**
   * { userId|null, playerId, name, minutes | untilGameEnd + roomId, reason, adminId }.
   * Accounts are persisted; guests only live in this server's memory.
   */
  async function mute({ userId = null, playerId = null, name = '', minutes = 0, untilGameEnd = false, roomId = null, reason = '', adminId = null }, now = Date.now()) {
    const until = untilGameEnd ? now + MUTE_GAME_CAP_MS : now + minutes * 60_000;
    const entry = {
      key: keyOf({ userId, playerId }),
      userId,
      playerId: userId ? null : playerId,
      name,
      until,
      roomId: untilGameEnd ? roomId : null,
      reason: reason || null,
      by: adminId,
      at: now,
    };
    if (pool && userId) {
      await pool.query(
        `INSERT INTO chat_mutes (user_id, muted_until, room_id, reason, muted_by, created_at)
         VALUES ($1, $2, $3, $4, $5, now())
         ON CONFLICT (user_id) DO UPDATE SET muted_until = EXCLUDED.muted_until, room_id = EXCLUDED.room_id,
           reason = EXCLUDED.reason, muted_by = EXCLUDED.muted_by, created_at = now()`,
        [userId, new Date(until).toISOString(), entry.roomId, entry.reason, adminId],
      );
    }
    map.set(entry.key, entry);
    return entry;
  }

  async function unmute(key) {
    const entry = map.get(key);
    if (!entry) return null;
    if (pool && entry.userId) await pool.query('DELETE FROM chat_mutes WHERE user_id = $1', [entry.userId]);
    map.delete(key);
    return entry;
  }

  /** A game ended / its room closed: lift the "until the game ends" mutes */
  function endRoom(roomId) {
    const lifted = [];
    for (const entry of map.values()) {
      if (entry.roomId && entry.roomId === roomId) lifted.push(entry);
    }
    for (const entry of lifted) {
      map.delete(entry.key);
      if (pool && entry.userId) {
        pool.query('DELETE FROM chat_mutes WHERE user_id = $1 AND room_id = $2', [entry.userId, roomId])
          .catch((err) => console.warn('Could not lift a chat mute:', err.message));
      }
    }
    return lifted.length;
  }

  function list(now = Date.now()) {
    const out = [];
    for (const [key, entry] of map) {
      if (alive(entry, now)) out.push({ ...entry });
      else map.delete(key);
    }
    return out.sort((a, b) => b.at - a.at);
  }

  return { load, find, mute, unmute, endRoom, list };
}

/**
 * Report rate limit (one server instance): at most `max` reports per
 * reporter in `windowMs`, and the same target only once per `sameTargetMs`.
 * check() returns a Spanish error or null (and records the report).
 */
export function createReportLimiter({ max = 3, windowMs = 10 * 60_000, sameTargetMs = 10 * 60_000 } = {}) {
  const byReporter = new Map(); // reporterKey → [{ at, target }]
  return function check(reporterKey, targetKey, now = Date.now()) {
    const keep = Math.max(windowMs, sameTargetMs);
    const list = (byReporter.get(reporterKey) || []).filter((r) => now - r.at < keep);
    if (list.some((r) => r.target === targetKey && now - r.at < sameTargetMs)) {
      byReporter.set(reporterKey, list);
      return 'Ya reportaste a este ninja hace poco. Los moderadores lo revisarán.';
    }
    if (list.filter((r) => now - r.at < windowMs).length >= max) {
      byReporter.set(reporterKey, list);
      return 'Enviaste demasiados reportes. Espera unos minutos.';
    }
    list.push({ at: now, target: targetKey });
    byReporter.set(reporterKey, list);
    if (byReporter.size > 5000) byReporter.delete(byReporter.keys().next().value);
    return null;
  };
}
