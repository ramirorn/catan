// "Moderación": live chat viewer, delete a message, mutes, banned words and
// player reports.
import { AdminError, isUuid, requireReason } from '../service.js';
import { MUTE_MAX_MINUTES, REPORT_REASONS, muteMessage } from '../moderation.js';
import { cleanMessage } from '../settings.js';
import { BANNED_WORDS_MAX, cleanWordList } from '../wordFilter.js';
import { pageOf } from './users.js';

const ROOM_RE = /^[A-Z0-9]{4,8}$/;
const REPORT_STATUSES = ['open', 'resolved', 'dismissed'];

function roomCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!ROOM_RE.test(code)) throw new AdminError(404, 'No existe esa sala');
  return code;
}

/**
 * Validated mute duration: { minutes } (1 min … 7 days) or { untilGameEnd }.
 * Exported for the tests.
 */
export function parseMuteDuration(body) {
  if (body && body.untilGameEnd === true) return { untilGameEnd: true, minutes: 0 };
  const minutes = typeof body?.minutes === 'string' && /^\d+$/.test(body.minutes) ? Number(body.minutes) : body?.minutes;
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MUTE_MAX_MINUTES) {
    throw new AdminError(400, 'Elige una duración entre 1 minuto y 7 días, o «hasta que termine la partida»');
  }
  return { untilGameEnd: false, minutes };
}

export function registerModerationRoutes(router, { live, runtime, mutes, reports, store, audit, handle }) {
  const requireReports = () => {
    if (!reports) throw new AdminError(503, 'Los reportes necesitan la base de datos');
  };

  router.get('/moderation', (req, res) => {
    const rooms = live.liveRooms().map((r) => {
      const chat = live.roomChat(r.roomId);
      const last = chat && chat.messages.length ? chat.messages[chat.messages.length - 1] : null;
      return {
        roomId: r.roomId,
        phase: r.phase,
        players: r.players.map((p) => p.name),
        spectators: r.spectators.length,
        messages: chat ? chat.messages.length : 0,
        lastAt: last ? last.timestamp : null,
      };
    });
    res.json({ now: Date.now(), rooms, mutes: mutes.list(), words: runtime.getBannedWords(), wordsMax: BANNED_WORDS_MAX });
  });

  router.get('/moderation/rooms/:code/chat', handle(async (req, res) => {
    const chat = live.roomChat(roomCode(req.params.code));
    if (!chat) throw new AdminError(404, 'No existe esa sala');
    const people = chat.people.map((p) => {
      const m = mutes.find({ userId: p.accountId, playerId: p.id });
      return { ...p, muted: m ? { key: m.key, until: m.until, roomId: m.roomId } : null };
    });
    res.json({ ...chat, people, now: Date.now() });
  }));

  router.post('/moderation/rooms/:code/chat/:id/delete', handle(async (req, res) => {
    const code = roomCode(req.params.code);
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) throw new AdminError(404, 'Ese mensaje ya no está');
    const msg = live.adminDeleteChat(code, id);
    if (!msg) throw new AdminError(404, 'Ese mensaje ya no está');
    await audit(req, 'chat.delete', 'room', code, { messageId: id, playerId: msg.playerId, name: msg.playerName, message: msg.message });
    res.json({ success: true });
  }));

  // Mute someone in a room (account or guest) or an account by id
  router.post('/moderation/mute', handle(async (req, res) => {
    const body = req.body || {};
    const duration = parseMuteDuration(body);
    const reason = requireReason(body.reason, { required: false });
    let target;
    let roomId = null;
    if (body.roomId) {
      roomId = roomCode(body.roomId);
      if (typeof body.targetId !== 'string' || !body.targetId || body.targetId.length > 64) throw new AdminError(400, 'Jugador no válido');
      target = live.roomPerson(roomId, body.targetId);
      if (!target) throw new AdminError(404, 'Ese ninja ya no está en la sala');
    } else if (isUuid(body.userId)) {
      if (duration.untilGameEnd) throw new AdminError(400, '«Hasta que termine la partida» solo sirve desde una sala');
      const user = store ? await store.getUser(body.userId.toLowerCase()) : null;
      if (!user) throw new AdminError(404, 'No existe esa cuenta');
      target = { userId: user.id, playerId: null, name: user.displayName };
    } else {
      throw new AdminError(400, 'Indica a quién silenciar');
    }
    if (target.userId && target.userId === req.admin.id) throw new AdminError(400, 'No puedes silenciarte a ti mismo');
    const entry = await mutes.mute({
      userId: target.userId,
      playerId: target.playerId,
      name: target.name,
      minutes: duration.minutes,
      untilGameEnd: duration.untilGameEnd,
      roomId,
      reason,
      adminId: req.admin.id,
    });
    const notice = muteMessage(entry);
    if (target.playerId) live.notifyPlayer(target.playerId, notice);
    if (target.userId) live.notifyAccount(target.userId, notice);
    await audit(req, 'chat.mute', target.userId ? 'user' : 'player', target.userId || target.playerId, {
      name: target.name,
      roomId,
      minutes: duration.untilGameEnd ? null : duration.minutes,
      untilGameEnd: duration.untilGameEnd,
      until: new Date(entry.until).toISOString(),
      reason: reason || null,
    });
    res.json({ success: true, mute: entry });
  }));

  router.post('/moderation/unmute', handle(async (req, res) => {
    const key = typeof req.body?.key === 'string' ? req.body.key : '';
    if (!/^[up]:[\w-]{1,64}$/.test(key)) throw new AdminError(400, 'Silencio no válido');
    const entry = await mutes.unmute(key);
    if (!entry) throw new AdminError(404, 'Ese silencio ya terminó');
    if (entry.playerId) live.notifyPlayer(entry.playerId, 'Un moderador te devolvió el chat.', 'info');
    if (entry.userId) live.notifyAccount(entry.userId, 'Un moderador te devolvió el chat.', 'info');
    await audit(req, 'chat.unmute', entry.userId ? 'user' : 'player', entry.userId || entry.playerId, { name: entry.name });
    res.json({ success: true });
  }));

  // Banned words: the full list (add / remove in the panel), or reset
  router.post('/moderation/words', handle(async (req, res) => {
    const body = req.body || {};
    const before = runtime.getBannedWords();
    let after;
    if (body.reset === true) {
      after = await runtime.setBannedWords(null, req.admin.id);
    } else {
      if (!Array.isArray(body.words) || body.words.length > BANNED_WORDS_MAX) {
        throw new AdminError(400, `Envía una lista de hasta ${BANNED_WORDS_MAX} palabras`);
      }
      after = await runtime.setBannedWords(cleanWordList(body.words), req.admin.id);
    }
    const prev = new Set(before.words);
    const next = new Set(after.words);
    await audit(req, 'chat.words', 'server', null, {
      reset: body.reset === true,
      added: after.words.filter((w) => !prev.has(w)),
      removed: before.words.filter((w) => !next.has(w)),
      count: after.words.length,
    });
    res.json({ success: true, words: after });
  }));

  // ─── Reports ───
  router.get('/reports', handle(async (req, res) => {
    requireReports();
    const status = REPORT_STATUSES.includes(req.query.status) ? req.query.status : '';
    const reason = REPORT_REASONS.includes(req.query.reason) ? req.query.reason : '';
    const userId = isUuid(req.query.userId) ? req.query.userId.toLowerCase() : null;
    const out = await reports.list({ status, reason, userId, page: pageOf(req.query.page), pageSize: 20 });
    // Is the reported player still in that room? (quick mute / kick)
    for (const r of out.reports) r.inRoom = !!live.roomPerson(r.roomId, r.targetPlayerId);
    res.json(out);
  }));

  router.post('/reports/:id/status', handle(async (req, res) => {
    requireReports();
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) throw new AdminError(404, 'No existe ese reporte');
    const status = req.body?.status;
    if (!REPORT_STATUSES.includes(status)) throw new AdminError(400, 'Estado no válido');
    const notes = cleanMessage(typeof req.body?.notes === 'string' ? req.body.notes : '', 300);
    if (status === 'dismissed' && notes.length < 3) throw new AdminError(400, 'Escribe por qué lo descartas (mínimo 3 caracteres)');
    const action = status === 'open' ? 'report.reopen' : status === 'resolved' ? 'report.resolve' : 'report.dismiss';
    const r = await reports.setStatus(id, { status, notes: notes || null, adminId: req.admin.id }, {
      adminId: req.admin.id,
      action,
      targetType: 'report',
      targetId: String(id),
      details: { notes: notes || null },
    });
    if (!r) throw new AdminError(404, 'No existe ese reporte');
    res.json({ success: true, report: r });
  }));
}
