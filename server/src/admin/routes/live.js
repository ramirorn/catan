// "Partidas" and "Avisos y mantenimiento": the in-memory rooms of this
// server, global broadcasts and maintenance mode.
import { AdminError, requireReason } from '../service.js';
import { cleanMessage } from '../settings.js';

const ROOM_RE = /^[A-Z0-9]{4,8}$/;
const SEVERITIES = ['info', 'warning', 'danger'];
const BROADCAST_MIN = 3;
const BROADCAST_MAX = 300;

function roomCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!ROOM_RE.test(code)) throw new AdminError(404, 'No existe esa sala');
  return code;
}

export function summarizeRooms(rooms) {
  const counts = { total: rooms.length, lobby: 0, running: 0, over: 0, playersSeated: 0 };
  for (const r of rooms) {
    if (r.phase === 'lobby') counts.lobby += 1;
    else if (r.phase === 'gameOver') counts.over += 1;
    else counts.running += 1;
    counts.playersSeated += r.players.filter((p) => !p.left).length;
  }
  return counts;
}

export function registerLiveRoutes(router, { live, settings, audit, handle }) {
  router.get('/live', (req, res) => {
    const rooms = live.liveRooms();
    res.json({
      now: Date.now(),
      rooms,
      counts: summarizeRooms(rooms),
      connections: live.connections(),
      maintenance: settings.getMaintenance(),
      announcement: live.announcement(),
    });
  });

  router.post('/live/rooms/:code/close', handle(async (req, res) => {
    const code = roomCode(req.params.code);
    const reason = requireReason(req.body && req.body.reason);
    const room = live.liveRooms().find((r) => r.roomId === code);
    if (!room || !live.adminCloseRoom(code, reason)) throw new AdminError(404, 'No existe esa sala');
    await audit(req, 'room.close', 'room', code, {
      reason,
      phase: room.phase,
      round: room.round,
      players: room.players.map((p) => p.name),
    });
    res.json({ success: true });
  }));

  router.post('/live/rooms/:code/kick', handle(async (req, res) => {
    const code = roomCode(req.params.code);
    const { targetId } = req.body || {};
    if (typeof targetId !== 'string' || !targetId || targetId.length > 64) throw new AdminError(400, 'Jugador no válido');
    const reason = requireReason(req.body && req.body.reason, { required: false });
    const result = live.adminKick(code, targetId, reason);
    if (!result.success) throw new AdminError(404, result.error);
    await audit(req, 'room.kick', 'room', code, { targetId, name: result.name, kind: result.kind, reason: reason || null });
    res.json({ success: true, name: result.name });
  }));

  router.post('/live/cleanup', handle(async (req, res) => {
    const closed = live.cleanupEmptyRooms();
    await audit(req, 'room.cleanup', 'room', null, { closed });
    res.json({ success: true, closed });
  }));

  // ─── Avisos ───
  router.post('/live/broadcast', handle(async (req, res) => {
    const body = req.body || {};
    const message = cleanMessage(body.message || '', BROADCAST_MAX);
    if (message.length < BROADCAST_MIN) throw new AdminError(400, 'Escribe el aviso (mínimo 3 caracteres)');
    const severity = SEVERITIES.includes(body.severity) ? body.severity : 'info';
    const minutes = Number.isInteger(body.minutes) && body.minutes >= 0 && body.minutes <= 240 ? body.minutes : 15;
    const sent = live.broadcast({ message, severity, ttlMs: minutes * 60_000 });
    const reached = live.connections();
    await audit(req, 'broadcast.send', 'server', null, { message, severity, minutes, sockets: reached.sockets });
    res.json({ success: true, announcement: sent, reached });
  }));

  router.post('/live/broadcast/clear', handle(async (req, res) => {
    live.clearAnnouncement();
    await audit(req, 'broadcast.clear', 'server', null, {});
    res.json({ success: true });
  }));

  router.post('/live/maintenance', handle(async (req, res) => {
    const body = req.body || {};
    if (typeof body.on !== 'boolean') throw new AdminError(400, 'Indica si se activa o desactiva');
    const message = cleanMessage(body.message || '');
    const state = await settings.setMaintenance({ on: body.on, message }, req.admin.id);
    live.emitServerStatus();
    const rooms = summarizeRooms(live.liveRooms());
    await audit(req, body.on ? 'maintenance.on' : 'maintenance.off', 'server', null, {
      message: message || null,
      runningGames: rooms.running,
    });
    res.json({ success: true, maintenance: state, counts: rooms });
  }));
}
