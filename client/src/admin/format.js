// Small formatting helpers for the admin panel (Spanish, Argentina time).

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' });
const numFmt = new Intl.NumberFormat('es-AR');

export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function fmtTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : timeFmt.format(d);
}

export function fmtNum(n) {
  return Number.isFinite(Number(n)) ? numFmt.format(Number(n)) : '—';
}

/** 3725 s → "1 h 2 min" */
export function fmtDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const s = Math.round(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export function fmtAgo(ts, now = Date.now()) {
  if (!ts) return '—';
  return `hace ${fmtDuration((now - new Date(ts).getTime()) / 1000)}`;
}

export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export function pct(part, total) {
  return total > 0 ? `${Math.round((part / total) * 100)} %` : '—';
}

export const PHASE_LABELS = {
  lobby: 'Esperando',
  setupForward: 'Colocación inicial',
  setupReverse: 'Colocación inicial',
  rollDice: 'Tirar dados',
  robberDiscard: 'Descartes',
  robberMove: 'Mover renegado',
  robberSteal: 'Robo',
  main: 'Turno',
  gameOver: 'Terminada',
};

export const BOARD_LABELS = {
  standard: 'Estándar (3-4)',
  extended: 'Ampliado (5-6)',
  desconocido: 'Sin dato',
};

export const ROLE_LABELS = { player: 'Jugador', admin: 'Admin' };
export const STATUS_LABELS = { active: 'Activa', suspended: 'Suspendida', banned: 'Bloqueada' };

export const ACTION_LABELS = {
  'room.observe': 'Observó una sala',
  'room.close': 'Cerró una sala',
  'room.kick': 'Expulsó de una sala',
  'room.cleanup': 'Limpió salas vacías',
  'broadcast.send': 'Aviso global',
  'broadcast.clear': 'Retiró el aviso',
  'maintenance.on': 'Activó mantenimiento',
  'maintenance.off': 'Desactivó mantenimiento',
  'user.coins': 'Ajustó Ryō',
  'user.gift': 'Regaló un objeto',
  'user.suspend': 'Suspendió una cuenta',
  'user.ban': 'Bloqueó una cuenta',
  'user.lift': 'Levantó una sanción',
  'user.rename': 'Cambió un nombre',
  'user.role.grant': 'Dio rol de admin',
  'user.role.revoke': 'Quitó rol de admin',
  'system.errors.clear': 'Vació la lista de errores',
};

/** Account status as seen now (an expired suspension is active again) */
export function liveStatus(user, now = Date.now()) {
  if (!user) return 'active';
  if (user.status === 'banned') return 'banned';
  if (user.status === 'suspended' && user.suspendedUntil && new Date(user.suspendedUntil).getTime() > now) return 'suspended';
  return 'active';
}
