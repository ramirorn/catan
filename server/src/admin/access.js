// Who may do what: admin role, ADMIN_EMAILS and the moderation status of an
// account (suspended / banned). Pure functions, no database: the tests use
// them directly.

const TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** ADMIN_EMAILS="a@x.com, b@y.com" → Set of lower-cased addresses */
export function parseAdminEmails(value) {
  return new Set(
    String(value || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@')),
  );
}

/**
 * 'active' | 'suspended' | 'banned'. A suspension whose date has passed is
 * simply 'active' again (no job needed to lift it).
 */
export function effectiveStatus(access, now = Date.now()) {
  if (!access) return 'active';
  if (access.status === 'banned') return 'banned';
  if (access.status === 'suspended') {
    const until = access.suspendedUntil ? new Date(access.suspendedUntil).getTime() : NaN;
    return Number.isFinite(until) && until > now ? 'suspended' : 'active';
  }
  return 'active';
}

export function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: TIME_ZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

/**
 * Spanish message for an account that cannot play with its profile, or null
 * when it can. Guests are never affected.
 */
export function blockedMessage(access, now = Date.now()) {
  const status = effectiveStatus(access, now);
  const why = access && access.banReason ? String(access.banReason).trim().replace(/[.\s]+$/, '') : '';
  const reason = why ? ` Motivo: ${why}.` : '';
  if (status === 'banned') {
    return `Tu cuenta ninja fue bloqueada.${reason} Puedes seguir jugando como invitado.`;
  }
  if (status === 'suspended') {
    return `Tu cuenta ninja está suspendida hasta el ${formatDate(access.suspendedUntil)} (hora de Argentina).${reason} Mientras tanto puedes jugar como invitado.`;
  }
  return null;
}

/** An admin is an account with role 'admin' that is not suspended / banned */
export function isAdminAccess(access, now = Date.now()) {
  return !!access && access.role === 'admin' && effectiveStatus(access, now) === 'active';
}
