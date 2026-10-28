// Server-wide switches set from the admin panel. Maintenance mode is kept in
// memory (read on every room creation) and persisted in app_settings so a
// restart does not silently turn it off. Without a database (tests, local
// guest-only servers) it simply lives in memory.

export const MAINTENANCE_DEFAULT_MESSAGE =
  'Estamos preparando una actualización de la aldea. Las partidas en curso siguen, pero por ahora no se pueden crear ni unir salas nuevas.';
export const MESSAGE_MAX = 300;

export function cleanMessage(value, max = MESSAGE_MAX) {
  if (typeof value !== 'string') return '';
  return Array.from(value.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('').trim();
}

export function createSettings({ pool = null } = {}) {
  let maintenance = { on: false, message: '', since: null };

  async function load() {
    if (!pool) return;
    try {
      const { rows } = await pool.query(`SELECT value FROM app_settings WHERE key = 'maintenance'`);
      const v = rows[0] && rows[0].value;
      if (v && typeof v === 'object') {
        maintenance = { on: v.on === true, message: cleanMessage(v.message || ''), since: v.since || null };
        if (maintenance.on) console.log('Maintenance mode is ON (from the database)');
      }
    } catch (err) {
      console.warn('Could not read the maintenance setting:', err.message);
    }
  }

  /** { on, message, since } — message is the text players see */
  function getMaintenance() {
    return {
      on: maintenance.on,
      message: maintenance.on ? maintenance.message || MAINTENANCE_DEFAULT_MESSAGE : '',
      customMessage: maintenance.message,
      since: maintenance.since,
    };
  }

  async function setMaintenance({ on, message }, adminId = null) {
    const next = {
      on: on === true,
      message: cleanMessage(message || ''),
      since: on === true ? (maintenance.on ? maintenance.since : new Date().toISOString()) : null,
    };
    if (pool) {
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('maintenance', $1::jsonb, now(), $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
        [JSON.stringify(next), adminId],
      );
    }
    maintenance = next;
    return getMaintenance();
  }

  return { load, getMaintenance, setMaintenance };
}
