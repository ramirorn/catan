// Admin rules for accounts (coins, gifts, suspensions, names, roles),
// independent of the database: the tests run them on an in-memory store.
//
// Store interface (see ./store.js for Postgres, tests for memory). Every
// write receives `audit` = { adminId, action, targetType, targetId, details }
// and must record it in the same transaction as the change.
//   getUser(userId) → { id, role, status, coins, displayName } | null
//   adjustCoins(userId, delta, audit) → { status: 'ok' | 'negative' | 'nouser', coins }
//   giftItem(userId, itemId, audit) → { status: 'ok' | 'owned' | 'nouser' }
//   setStatus(userId, { status, until, reason }, audit) → { status: 'ok' | 'nouser' }
//   rename(userId, displayName, audit) → { status: 'ok' | 'nouser' }
//   setRole(userId, role, audit) → { status: 'ok' | 'lastAdmin' | 'nouser' }
import { getItem } from '../shop/catalog.js';
import { cleanDisplayName } from '../accounts/store.js';
import { cleanMessage } from './settings.js';
import { effectiveStatus } from './access.js';

export class AdminError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const COIN_ADJUST_MAX = 1_000_000;
const SUSPEND_MAX_MS = 5 * 365 * 24 * 60 * 60 * 1000;
const REASON_MIN = 3;
const REASON_MAX = 300;

export function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** Trimmed reason; throws when required and missing / too short */
export function requireReason(value, { required = true } = {}) {
  const text = cleanMessage(typeof value === 'string' ? value : '', REASON_MAX);
  if (required && text.length < REASON_MIN) throw new AdminError(400, `Escribe un motivo (mínimo ${REASON_MIN} caracteres)`);
  return text;
}

export function createAdminService(store) {
  function checkUserId(userId) {
    if (!isUuid(userId)) throw new AdminError(404, 'No existe esa cuenta');
  }

  async function adjustCoins(adminId, userId, delta, reason) {
    checkUserId(userId);
    const amount = typeof delta === 'string' && /^[+-]?\d+$/.test(delta.trim()) ? Number(delta) : delta;
    if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > COIN_ADJUST_MAX) {
      throw new AdminError(400, `La cantidad debe ser un número entero distinto de 0 (máximo ${COIN_ADJUST_MAX.toLocaleString('es-AR')})`);
    }
    const why = requireReason(reason);
    const r = await store.adjustCoins(userId, amount, {
      adminId,
      action: 'user.coins',
      targetType: 'user',
      targetId: userId,
      details: { delta: amount, reason: why },
    });
    if (r.status === 'nouser') throw new AdminError(404, 'No existe esa cuenta');
    if (r.status === 'negative') {
      throw new AdminError(409, `El saldo no puede quedar en negativo: la cuenta tiene ${r.coins} Ryō`);
    }
    return { coins: r.coins, delta: amount };
  }

  async function giftItem(adminId, userId, itemId, reason) {
    checkUserId(userId);
    const item = getItem(itemId);
    if (!item) throw new AdminError(400, 'Ese objeto no existe en el catálogo');
    if (item.isDefault) throw new AdminError(400, 'Ese objeto es gratuito: todos lo tienen');
    if (item.adminOnly) throw new AdminError(400, 'Ese objeto es exclusivo de los admins: no se puede regalar');
    const why = requireReason(reason, { required: false });
    const r = await store.giftItem(userId, item.id, {
      adminId,
      action: 'user.gift',
      targetType: 'user',
      targetId: userId,
      details: { itemId: item.id, itemName: item.name, reason: why || null },
    });
    if (r.status === 'nouser') throw new AdminError(404, 'No existe esa cuenta');
    if (r.status === 'owned') throw new AdminError(409, 'Esa cuenta ya tiene ese objeto');
    return { itemId: item.id, name: item.name };
  }

  /**
   * action: 'suspend' (needs `until`, a future date), 'ban' (permanent) or
   * 'lift'. Nobody can act on themselves, and admins must lose the role
   * before they can be suspended / banned.
   */
  async function setStatus(adminId, userId, { action, until, reason } = {}, now = Date.now()) {
    checkUserId(userId);
    if (!['suspend', 'ban', 'lift'].includes(action)) throw new AdminError(400, 'Acción no válida');
    if (userId === adminId) throw new AdminError(400, 'No puedes cambiar el estado de tu propia cuenta');
    const target = await store.getUser(userId);
    if (!target) throw new AdminError(404, 'No existe esa cuenta');
    let change;
    if (action === 'lift') {
      const why = requireReason(reason, { required: false });
      change = { status: 'active', until: null, reason: null, note: why || null };
    } else {
      if (target.role === 'admin') throw new AdminError(400, 'Primero quita el rol de admin a esa cuenta');
      const why = requireReason(reason);
      let untilDate = null;
      if (action === 'suspend') {
        const t = typeof until === 'string' || typeof until === 'number' ? new Date(until).getTime() : NaN;
        if (!Number.isFinite(t) || t <= now + 60_000) throw new AdminError(400, 'Elige una fecha de fin de la suspensión en el futuro');
        if (t > now + SUSPEND_MAX_MS) throw new AdminError(400, 'La suspensión no puede durar más de 5 años: usa el bloqueo');
        untilDate = new Date(t).toISOString();
      }
      change = { status: action === 'ban' ? 'banned' : 'suspended', until: untilDate, reason: why };
    }
    const r = await store.setStatus(userId, change, {
      adminId,
      action: `user.${action}`,
      targetType: 'user',
      targetId: userId,
      details: { until: change.until, reason: change.reason || change.note || null, previous: target.status },
    });
    if (r.status === 'nouser') throw new AdminError(404, 'No existe esa cuenta');
    return { status: change.status, until: change.until, reason: change.reason };
  }

  async function rename(adminId, userId, displayName, reason) {
    checkUserId(userId);
    const name = cleanDisplayName(displayName);
    if (!name) throw new AdminError(400, 'Escribe un nombre válido (1 a 20 caracteres)');
    const why = requireReason(reason, { required: false });
    const target = await store.getUser(userId);
    if (!target) throw new AdminError(404, 'No existe esa cuenta');
    const r = await store.rename(userId, name, {
      adminId,
      action: 'user.rename',
      targetType: 'user',
      targetId: userId,
      details: { from: target.displayName, to: name, reason: why || null },
    });
    if (r.status === 'nouser') throw new AdminError(404, 'No existe esa cuenta');
    return { displayName: name };
  }

  /** Grant / revoke admin. You can't revoke yourself or the last admin. */
  async function setRole(adminId, userId, role) {
    checkUserId(userId);
    if (role !== 'admin' && role !== 'player') throw new AdminError(400, 'Rol no válido');
    if (userId === adminId && role !== 'admin') throw new AdminError(400, 'No puedes quitarte el rol de admin a ti mismo');
    const target = await store.getUser(userId);
    if (!target) throw new AdminError(404, 'No existe esa cuenta');
    if (target.role === role) return { role, unchanged: true };
    if (role === 'admin' && effectiveStatus(target) !== 'active') throw new AdminError(400, 'Levanta primero la suspensión o el bloqueo');
    const r = await store.setRole(userId, role, {
      adminId,
      action: role === 'admin' ? 'user.role.grant' : 'user.role.revoke',
      targetType: 'user',
      targetId: userId,
      details: { from: target.role, to: role },
    });
    if (r.status === 'nouser') throw new AdminError(404, 'No existe esa cuenta');
    if (r.status === 'lastAdmin') throw new AdminError(409, 'No puedes quitar al último admin');
    return { role };
  }

  return { adjustCoins, giftItem, setStatus, rename, setRole };
}
