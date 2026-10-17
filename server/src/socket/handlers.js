import { createTurnTimers } from './turnTimer.js';
import { sanitizeAvatarId } from '../game/constants.js';

const CHAT_HISTORY_LIMIT = 200;
const CHAT_MAX_LENGTH = 150;
const CHAT_RATE_COUNT = 3;       // at most 3 messages…
const CHAT_RATE_WINDOW = 5000;   // …every 5 seconds per player
const CHAT_MUTE_MS = 10000;      // flooding past the limit mutes for 10 s
const CHAT_REPEAT_MS = 15000;    // the same message again within 15 s is spam
const CHAT_MAX_RUN = 5;          // "aaaaaaaa" → "aaaaa"
const CHAT_RUN_RE = /(.)\1{5,}/gu; // a character repeated more than CHAT_MAX_RUN times

export const MAX_SPECTATORS = 20;
// setAvatar re-sends the room state: one change per socket every 300 ms at most
const AVATAR_MIN_INTERVAL_MS = 300;
// A spectator who closes the page keeps their place this long (page reloads)
const SPECTATOR_GRACE_MS = 2 * 60 * 1000;
// A game in progress with nobody connected is closed after this long
const ABANDON_MS = 10 * 60 * 1000;
const SPECTATOR_CHAT_COLOR = '#7d7468';

const KICK_MESSAGE = 'El anfitrión te expulsó de la sala';
const BANNED_MESSAGE = 'El anfitrión te expulsó de esta sala; no puedes volver a entrar';

// Socket.io room that only the spectators of a game join
const specRoom = (roomId) => `spec:${roomId}`;

export function registerSocketHandlers(io, lobbyManager, timerOptions = {}) {
  // Players are identified by a persistent playerId sent by the client in the
  // handshake (survives page reloads / reconnects), not by the volatile socket.id.
  const playerToRoom = {};     // playerId → roomId (seated players)
  const spectatorToRoom = {};  // playerId → roomId (observers)

  const abandonMs = timerOptions.abandonMs ?? ABANDON_MS;
  const spectatorGraceMs = timerOptions.spectatorGraceMs ?? SPECTATOR_GRACE_MS;

  // Turn time limit: when the acting player runs out of time the server acts
  // for them and broadcasts the new state
  const turnTimers = createTurnTimers({
    ...timerOptions,
    onExpire: (roomId, key) => {
      const room = lobbyManager.getRoom(roomId);
      // Stale: the room is gone or someone already acted
      if (!room || room.engine.getTimerKey() !== key) return;
      try {
        room.engine.handleTimeout();
      } catch (err) {
        console.error('Error handling turn timeout:', err);
      }
      emitGameState(roomId);
    },
  });

  // ─── Helpers ───
  function spectatorList(room) {
    return Object.values(room.spectators)
      .filter((s) => s.connected)
      .map((s) => ({ id: s.id, name: s.name, avatarId: s.avatarId }));
  }

  // Room-level data added to every state (not part of the game engine)
  function roomExtras(room) {
    return { hostId: room.host, spectators: spectatorList(room) };
  }

  function spectatorState(room) {
    return { ...room.engine.serialize(null), ...roomExtras(room), spectator: true };
  }

  function emitGameState(roomId) {
    const room = lobbyManager.getRoom(roomId);
    if (!room) return;
    const engine = room.engine;

    // Seats of players who left are played by the server right away
    try {
      engine.autoPlayLeft();
    } catch (err) {
      console.error('Error auto-playing for a player who left:', err);
    }

    // (Re)start / clear the turn timer so the deadline sent is current
    turnTimers.sync(roomId, room);

    const extras = roomExtras(room);
    // Personalized state for each seated player (their sockets join a room named by playerId)
    for (const playerId of engine.playerOrder) {
      if (engine.players[playerId]?.left) continue; // back in the menu: no game screen
      io.to(playerId).emit('gameState', { ...engine.serialize(playerId), ...extras });
    }
    // One public view (no hands, no dev cards, no placements) for all spectators
    if (extras.spectators.length > 0) {
      io.to(specRoom(roomId)).emit('gameState', { ...engine.serialize(null), ...extras, spectator: true });
    }
  }

  // Light update when only the spectator list changed (no full state)
  function emitSpectators(roomId) {
    const room = lobbyManager.getRoom(roomId);
    if (!room) return;
    io.to(roomId).emit('roomSpectators', { roomId, spectators: spectatorList(room) });
  }

  function isHost(room, playerId) {
    return room.host === playerId;
  }

  // When the host is gone (left the room / game), the first player still in
  // the room (preferably online) takes over. A host who only lost the
  // connection keeps the role.
  function reassignHost(room) {
    const engine = room.engine;
    const current = engine.players[room.host];
    if (current && !current.left) return;
    const active = engine.playerOrder.filter((pid) => !engine.players[pid]?.left);
    const online = active.find((pid) => engine.players[pid].connected !== false);
    const next = online || active[0] || null;
    if (next && next !== room.host) {
      room.host = next;
      if (engine.phase !== 'lobby') engine.log(`${engine.players[next].name} es ahora el anfitrión`);
    }
  }

  function removeSpectator(room, id) {
    const s = room.spectators[id];
    if (!s) return false;
    if (s.removeTimer) clearTimeout(s.removeTimer);
    delete room.spectators[id];
    if (spectatorToRoom[id] === room.engine.roomId) delete spectatorToRoom[id];
    return true;
  }

  // Detach every socket of a player / spectator from the room's broadcasts
  function detachSockets(id, roomId) {
    io.in(id).socketsLeave([roomId, specRoom(roomId)]);
  }

  function closeRoom(roomId, message = 'La sala se cerró') {
    const room = lobbyManager.getRoom(roomId);
    if (!room) return;
    io.to(specRoom(roomId)).emit('roomClosed', { roomId, message });
    for (const id of Object.keys(room.spectators)) {
      removeSpectator(room, id);
      detachSockets(id, roomId);
    }
    for (const pid of room.engine.playerOrder) {
      if (playerToRoom[pid] === roomId) delete playerToRoom[pid];
      detachSockets(pid, roomId);
    }
    turnTimers.clear(room);
    lobbyManager.removeRoom(roomId);
    console.log(`Room ${roomId} closed`);
  }

  // In a game nobody is connected to, stop after a while (no endless auto-play)
  function checkAbandoned(roomId) {
    const room = lobbyManager.getRoom(roomId);
    if (!room) return;
    const engine = room.engine;
    if (engine.phase === 'lobby') return;
    const anyoneOnline = engine.playerOrder.some((pid) => {
      const p = engine.players[pid];
      return p && !p.left && p.connected !== false;
    });
    if (anyoneOnline) {
      if (room.abandonTimer) clearTimeout(room.abandonTimer);
      room.abandonTimer = null;
      return;
    }
    if (room.abandonTimer) return;
    room.abandonTimer = setTimeout(() => {
      room.abandonTimer = null;
      const r = lobbyManager.getRoom(roomId);
      if (!r) return;
      const back = r.engine.playerOrder.some((pid) => r.engine.players[pid]?.connected && !r.engine.players[pid]?.left);
      if (!back) closeRoom(roomId, 'La partida se cerró: no quedan ninjas conectados');
    }, abandonMs);
    if (typeof room.abandonTimer.unref === 'function') room.abandonTimer.unref();
  }

  // A seated player leaves (by choice or kicked)
  function removeSeatedPlayer(room, id, { kicked = false } = {}) {
    const roomId = room.engine.roomId;
    const engine = room.engine;
    if (engine.phase === 'lobby') {
      engine.removePlayer(id);
    } else {
      engine.markLeft(id, { kicked });
    }
    if (playerToRoom[id] === roomId) delete playerToRoom[id];
    detachSockets(id, roomId);

    const remaining = engine.phase === 'lobby' ? engine.playerOrder : engine.activePlayerIds();
    if (remaining.length === 0) {
      closeRoom(roomId, 'La sala se cerró: no quedan ninjas');
      return;
    }
    reassignHost(room);
    emitGameState(roomId);
    checkAbandoned(roomId);
  }

  io.on('connection', (socket) => {
    const authId = socket.handshake.auth && socket.handshake.auth.playerId;
    const playerId = typeof authId === 'string' && authId.length > 0 && authId.length <= 64
      ? authId
      : socket.id;
    socket.join(playerId);
    console.log(`Player connected: ${playerId} (socket ${socket.id})`);

    // ─── Reconnection: put the player back into their game ───
    const previousRoomId = playerToRoom[playerId];
    if (previousRoomId) {
      const room = lobbyManager.getRoom(previousRoomId);
      const player = room && room.engine.players[playerId];
      if (player && !player.left) {
        room.engine.reconnectPlayer(playerId);
        socket.join(previousRoomId);
        socket.emit('chatHistory', { roomId: previousRoomId, messages: room.chat });
        reassignHost(room);
        emitGameState(previousRoomId);
        checkAbandoned(previousRoomId);
      } else {
        delete playerToRoom[playerId];
      }
    }

    // ─── Reconnection of a spectator ───
    const watchedRoomId = spectatorToRoom[playerId];
    if (watchedRoomId) {
      const room = lobbyManager.getRoom(watchedRoomId);
      const spec = room && room.spectators[playerId];
      if (spec) {
        if (spec.removeTimer) clearTimeout(spec.removeTimer);
        spec.removeTimer = null;
        const wasOffline = !spec.connected;
        spec.connected = true;
        socket.join(watchedRoomId);
        socket.join(specRoom(watchedRoomId));
        socket.emit('chatHistory', { roomId: watchedRoomId, messages: room.chat });
        socket.emit('gameState', spectatorState(room));
        if (wasOffline) emitSpectators(watchedRoomId);
      } else {
        delete spectatorToRoom[playerId];
      }
    }

    // Safe event registration: tolerate missing payloads / callbacks
    function on(event, handler) {
      socket.on(event, (payload, callback) => {
        const cb = typeof callback === 'function' ? callback : () => {};
        try {
          handler(payload || {}, cb);
        } catch (err) {
          console.error(`Error handling ${event}:`, err);
          cb({ success: false, error: 'Error del servidor' });
        }
      });
    }

    // Stop watching any room (before sitting down somewhere)
    function stopSpectating() {
      const roomId = spectatorToRoom[playerId];
      if (!roomId) return;
      const room = lobbyManager.getRoom(roomId);
      if (room && removeSpectator(room, playerId)) emitSpectators(roomId);
      delete spectatorToRoom[playerId];
      detachSockets(playerId, roomId);
    }

    // Common wrapper for in-game actions
    function onGameAction(event, action, alwaysEmit = false) {
      on(event, (payload, cb) => {
        const roomId = playerToRoom[playerId];
        const room = lobbyManager.getRoom(roomId);
        const player = room && room.engine.players[playerId];
        if (!player || player.left) {
          if (spectatorToRoom[playerId]) {
            return cb({ success: false, error: 'Estás observando: los espectadores no pueden jugar' });
          }
          return cb({ success: false, error: 'No estás en una partida' });
        }
        if (!room.engine.board) {
          return cb({ success: false, error: 'La partida no ha empezado' });
        }
        const result = action(room.engine, payload);
        cb(result);
        if (result.success || alwaysEmit) emitGameState(roomId);
      });
    }

    // ─── Lobby: Create Room ───
    on('createRoom', ({ playerName, boardType, vpToWin, turnTimeLimit, peacePacts, avatarId }, cb) => {
      const name = String(playerName || '').trim().slice(0, 24);
      if (!name) return cb({ success: false, error: 'Escribe tu nombre' });
      if (playerToRoom[playerId] && lobbyManager.getRoom(playerToRoom[playerId])) {
        return cb({ success: false, error: 'Ya estás en una sala' });
      }
      stopSpectating();
      const type = boardType === 'extended' ? 'extended' : 'standard';
      const { roomId, engine } = lobbyManager.createRoom(playerId, name, type, sanitizeAvatarId(avatarId));
      // Optional settings; invalid values keep the defaults
      engine.updateSettings({ vpToWin, turnTimeLimit });
      if (typeof peacePacts === 'boolean') engine.updateSettings({ peacePacts });
      socket.join(roomId);
      playerToRoom[playerId] = roomId;

      console.log(`Room ${roomId} created by ${name}`);
      cb({ success: true, roomId, playerId, state: { ...engine.serialize(playerId), ...roomExtras(lobbyManager.getRoom(roomId)) } });
    });

    // ─── Lobby: Join Room ───
    on('joinRoom', ({ roomId, playerName, avatarId }, cb) => {
      const name = String(playerName || '').trim().slice(0, 24);
      if (!name) return cb({ success: false, error: 'Escribe tu nombre' });
      const room = lobbyManager.getRoom(String(roomId || '').trim().toUpperCase());
      if (!room) {
        return cb({ success: false, error: 'No existe esa sala' });
      }
      const id = room.engine.roomId;
      if (room.banned.has(playerId)) return cb({ success: false, error: BANNED_MESSAGE });
      if (playerToRoom[playerId] && playerToRoom[playerId] !== id &&
          lobbyManager.getRoom(playerToRoom[playerId])) {
        return cb({ success: false, error: 'Ya estás en otra sala' });
      }

      // Back to a seat left during the game
      const seat = room.engine.players[playerId];
      if (seat && room.engine.phase !== 'lobby') {
        if (!room.engine.rejoinPlayer(playerId)) return cb({ success: false, error: BANNED_MESSAGE });
        if (avatarId !== undefined) room.engine.setAvatar(playerId, avatarId);
      } else {
        const result = room.engine.addPlayer(playerId, name, sanitizeAvatarId(avatarId));
        if (!result.success) {
          if (room.engine.phase !== 'lobby') {
            return cb({ success: false, error: 'La partida ya comenzó; puedes entrar como espectador' });
          }
          return cb(result);
        }
      }
      stopSpectating();

      socket.join(id);
      playerToRoom[playerId] = id;
      reassignHost(room);

      console.log(`${name} joined room ${id}`);
      cb({ success: true, roomId: id, playerId });
      socket.emit('chatHistory', { roomId: id, messages: room.chat });
      emitGameState(id);
      checkAbandoned(id);
    });

    // ─── Lobby: Watch a room (waiting or in progress) ───
    on('spectateRoom', ({ roomId, playerName, avatarId }, cb) => {
      const name = String(playerName || '').trim().slice(0, 24);
      if (!name) return cb({ success: false, error: 'Escribe tu nombre' });
      const room = lobbyManager.getRoom(String(roomId || '').trim().toUpperCase());
      if (!room) return cb({ success: false, error: 'No existe esa sala' });
      const id = room.engine.roomId;
      if (room.banned.has(playerId)) return cb({ success: false, error: BANNED_MESSAGE });

      const seatedRoom = playerToRoom[playerId] && lobbyManager.getRoom(playerToRoom[playerId]);
      if (seatedRoom) {
        return cb({ success: false, error: 'Ya estás jugando en una sala; sal de ella para observar otra' });
      }
      const already = room.spectators[playerId];
      if (!already) {
        const watching = Object.values(room.spectators).filter((s) => s.connected).length;
        if (watching >= MAX_SPECTATORS) {
          return cb({ success: false, error: `La sala ya tiene ${MAX_SPECTATORS} espectadores` });
        }
        if (spectatorToRoom[playerId] && spectatorToRoom[playerId] !== id) stopSpectating();
        room.spectators[playerId] = { id: playerId, name, avatarId: sanitizeAvatarId(avatarId), connected: true, removeTimer: null };
      } else {
        if (already.removeTimer) clearTimeout(already.removeTimer);
        already.removeTimer = null;
        already.connected = true;
        already.name = name;
        already.avatarId = sanitizeAvatarId(avatarId);
      }
      spectatorToRoom[playerId] = id;
      socket.join(id);
      socket.join(specRoom(id));

      cb({ success: true, roomId: id, playerId });
      socket.emit('chatHistory', { roomId: id, messages: room.chat });
      socket.emit('gameState', spectatorState(room));
      emitSpectators(id);
    });

    // ─── Profile avatar (players and spectators, any phase) ───
    // Only a small index travels; repeated identical values are ignored.
    let lastAvatarAt = 0;
    on('setAvatar', ({ avatarId }, cb) => {
      const now = Date.now();
      if (now - lastAvatarAt < AVATAR_MIN_INTERVAL_MS) return cb({ success: false, error: 'Espera un momento' });
      lastAvatarAt = now;
      const value = sanitizeAvatarId(avatarId);
      const seatedRoomId = playerToRoom[playerId];
      const seatedRoom = seatedRoomId && lobbyManager.getRoom(seatedRoomId);
      const player = seatedRoom && seatedRoom.engine.players[playerId];
      if (player && !player.left) {
        if (player.avatarId === value) return cb({ success: true, avatarId: value });
        seatedRoom.engine.setAvatar(playerId, value);
        cb({ success: true, avatarId: value });
        return emitGameState(seatedRoomId);
      }
      const watchedRoomId = spectatorToRoom[playerId];
      const watchedRoom = watchedRoomId && lobbyManager.getRoom(watchedRoomId);
      const spec = watchedRoom && watchedRoom.spectators[playerId];
      if (spec) {
        if (spec.avatarId === value) return cb({ success: true, avatarId: value });
        spec.avatarId = value;
        cb({ success: true, avatarId: value });
        return emitSpectators(watchedRoomId);
      }
      cb({ success: false, error: 'No estás en una sala' });
    });

    // ─── Leave the room / game and go back to the menu ───
    on('leaveRoom', (_, cb) => {
      const specRoomId = spectatorToRoom[playerId];
      if (specRoomId) {
        stopSpectating();
        return cb({ success: true });
      }
      const roomId = playerToRoom[playerId];
      const room = lobbyManager.getRoom(roomId);
      if (!room || !room.engine.players[playerId]) {
        delete playerToRoom[playerId];
        return cb({ success: true });
      }
      removeSeatedPlayer(room, playerId);
      cb({ success: true });
    });

    // ─── Host: kick a player or a spectator (waiting room or game) ───
    on('kickPlayer', ({ targetId }, cb) => {
      const roomId = playerToRoom[playerId];
      const room = lobbyManager.getRoom(roomId);
      if (!room || !room.engine.players[playerId] || room.engine.players[playerId].left) {
        return cb({ success: false, error: 'No estás en una sala' });
      }
      if (!isHost(room, playerId)) return cb({ success: false, error: 'Solo el anfitrión puede expulsar' });
      if (typeof targetId !== 'string' || !targetId) return cb({ success: false, error: 'Jugador no válido' });
      if (targetId === playerId) return cb({ success: false, error: 'No puedes expulsarte a ti mismo' });

      const spec = room.spectators[targetId];
      const seat = room.engine.players[targetId];
      if (!spec && !seat) return cb({ success: false, error: 'Ese ninja ya no está en la sala' });

      room.banned.add(targetId);
      io.to(targetId).emit('kicked', { roomId, message: KICK_MESSAGE });
      if (spec) {
        removeSpectator(room, targetId);
        detachSockets(targetId, roomId);
        emitSpectators(roomId);
      }
      if (seat) {
        if (seat.left) {
          seat.kicked = true; // already gone: just make sure they can't come back
        } else {
          removeSeatedPlayer(room, targetId, { kicked: true });
        }
      }
      cb({ success: true });
    });

    // ─── Lobby: Room settings (host only, before starting) ───
    on('updateRoomSettings', ({ vpToWin, turnTimeLimit, peacePacts }, cb) => {
      const roomId = playerToRoom[playerId];
      const room = lobbyManager.getRoom(roomId);
      if (!room) return cb({ success: false, error: 'No estás en una sala' });
      if (!isHost(room, playerId)) return cb({ success: false, error: 'Solo el anfitrión puede cambiar las reglas' });

      const result = room.engine.updateSettings({ vpToWin, turnTimeLimit, peacePacts });
      cb(result);
      if (result.success) emitGameState(roomId);
    });

    // ─── Lobby: Start Game ───
    on('startGame', (_, cb) => {
      const roomId = playerToRoom[playerId];
      const room = lobbyManager.getRoom(roomId);
      if (!room) return cb({ success: false, error: 'No estás en una sala' });
      if (!isHost(room, playerId)) return cb({ success: false, error: 'Solo el anfitrión puede empezar la partida' });

      const result = room.engine.startGame();
      if (!result.success) return cb(result);

      cb({ success: true });
      emitGameState(roomId);
    });

    // ─── Game actions ───
    onGameAction('rollDice', (engine) => engine.rollDice(playerId));
    onGameAction('setupPlaceSettlement', (engine, { vertexId }) => engine.setupPlaceSettlement(playerId, vertexId));
    onGameAction('setupPlaceRoad', (engine, { edgeId }) => engine.setupPlaceRoad(playerId, edgeId));
    onGameAction('buildRoad', (engine, { edgeId }) => engine.buildRoad(playerId, edgeId));
    onGameAction('buildSettlement', (engine, { vertexId }) => engine.buildSettlement(playerId, vertexId));
    onGameAction('buildCity', (engine, { vertexId }) => engine.buildCity(playerId, vertexId));
    onGameAction('buyDevCard', (engine) => engine.buyDevCard(playerId));
    onGameAction('playDevCard', (engine, { cardType, params }) => engine.playDevCard(playerId, cardType, params || {}));
    onGameAction('discardCards', (engine, { cards }) => engine.discardCards(playerId, cards));
    onGameAction('moveRobber', (engine, { hexId }) => engine.moveRobber(playerId, hexId));
    onGameAction('stealCard', (engine, { victimId }) => engine.stealCard(playerId, victimId));
    // «Pacto de paz» (robber bribe house rule)
    onGameAction('offerPeacePact', (engine, { targetId, request }) => engine.offerPeacePact(playerId, targetId, request));
    onGameAction('respondPeacePact', (engine, { accept }) => engine.respondPeacePact(playerId, accept === true));
    onGameAction('cancelPeacePact', (engine) => engine.cancelPeacePact(playerId));
    onGameAction('bankTrade', (engine, { give, receive }) => engine.bankTrade(playerId, give, receive));
    onGameAction('proposeTrade', (engine, { offering, requesting }) => engine.proposeTrade(playerId, offering, requesting));
    onGameAction('respondToTrade', (engine, { response, counterOffer }) => engine.respondToTrade(playerId, response, counterOffer));
    onGameAction('acceptTrade', (engine, { accepterId }) => engine.acceptTrade(playerId, accepterId));
    onGameAction('cancelTrade', (engine) => engine.cancelTrade(playerId), true);
    onGameAction('endTurn', (engine, { expectPhase }) =>
      engine.endTurn(playerId, typeof expectPhase === 'string' ? expectPhase : null));
    onGameAction('voteEndGame', (engine, { vote }) => engine.voteEndGame(playerId, vote !== false));

    // ─── Chat Message (players and spectators) ───
    on('chatMessage', ({ message }, cb) => {
      const seatedRoomId = playerToRoom[playerId];
      const roomId = seatedRoomId || spectatorToRoom[playerId];
      const room = lobbyManager.getRoom(roomId);
      if (!room) return cb({ success: false, error: 'No estás en una sala' });

      const player = seatedRoomId ? room.engine.players[playerId] : null;
      const spec = !seatedRoomId ? room.spectators[playerId] : null;
      // Collapse long runs of one character and of whitespace
      const text = String(message || '')
        .replace(/\s+/g, ' ')
        .replace(CHAT_RUN_RE, (m, c) => c.repeat(CHAT_MAX_RUN))
        .trim();
      if ((!player && !spec) || !text) return cb({ success: false, error: 'Mensaje vacío' });
      if (text.length > CHAT_MAX_LENGTH) {
        return cb({ success: false, error: `El mensaje es demasiado largo (máximo ${CHAT_MAX_LENGTH} caracteres)` });
      }

      // Anti-spam: rate limit (with a short mute when exceeded) and no repeats
      const now = Date.now();
      const rate = room.chatRate[playerId] || (room.chatRate[playerId] = { times: [], lastText: '', lastAt: 0, mutedUntil: 0 });
      if (now < rate.mutedUntil) {
        const secs = Math.ceil((rate.mutedUntil - now) / 1000);
        return cb({ success: false, error: `Demasiados mensajes. Podrás escribir en ${secs} s.` });
      }
      rate.times = rate.times.filter((t) => now - t < CHAT_RATE_WINDOW);
      if (rate.times.length >= CHAT_RATE_COUNT) {
        rate.mutedUntil = now + CHAT_MUTE_MS;
        return cb({ success: false, error: `Estás enviando mensajes muy rápido. Espera ${CHAT_MUTE_MS / 1000} s.` });
      }
      if (text.toLowerCase() === rate.lastText && now - rate.lastAt < CHAT_REPEAT_MS) {
        return cb({ success: false, error: 'No repitas el mismo mensaje.' });
      }
      rate.times.push(now);
      rate.lastText = text.toLowerCase();
      rate.lastAt = now;

      room.chatCounter += 1;
      const msg = {
        id: room.chatCounter,
        playerId,
        // Spectators are marked in the name (and a neutral colour) in every chat view
        playerName: player ? player.name : `${spec.name} (espectador)`,
        playerColor: player ? player.color : SPECTATOR_CHAT_COLOR,
        avatarId: player ? player.avatarId : spec.avatarId,
        spectator: !player,
        message: text,
        timestamp: now,
      };
      room.chat.push(msg);
      if (room.chat.length > CHAT_HISTORY_LIMIT) room.chat.splice(0, room.chat.length - CHAT_HISTORY_LIMIT);

      cb({ success: true });
      // Every socket of the room's players and spectators joined the roomId room
      io.to(roomId).emit('chatMessage', msg);
    });

    // ─── List Rooms ───
    on('listRooms', (_, cb) => {
      cb({ rooms: lobbyManager.listRooms() });
    });

    // ─── Disconnect ───
    socket.on('disconnect', async () => {
      // If the same player still has another live socket (e.g. fast reconnect), do nothing
      const stillConnected = (await io.in(playerId).fetchSockets()).length > 0;
      if (stillConnected) return;

      // Spectator: keep the place a little while (page reload), then drop it
      const watchedRoomId = spectatorToRoom[playerId];
      if (watchedRoomId) {
        const room = lobbyManager.getRoom(watchedRoomId);
        const spec = room && room.spectators[playerId];
        if (spec) {
          spec.connected = false;
          if (spec.removeTimer) clearTimeout(spec.removeTimer);
          spec.removeTimer = setTimeout(() => {
            const r = lobbyManager.getRoom(watchedRoomId);
            if (r && r.spectators[playerId] && !r.spectators[playerId].connected) removeSpectator(r, playerId);
          }, spectatorGraceMs);
          if (typeof spec.removeTimer.unref === 'function') spec.removeTimer.unref();
          emitSpectators(watchedRoomId);
        } else {
          delete spectatorToRoom[playerId];
        }
      }

      const roomId = playerToRoom[playerId];
      if (roomId) {
        const room = lobbyManager.getRoom(roomId);
        if (room) {
          const removed = room.engine.removePlayer(playerId);
          if (removed) {
            // Player removed from lobby (game hasn't started)
            delete playerToRoom[playerId];
            if (room.engine.playerOrder.length === 0) {
              closeRoom(roomId, 'La sala se cerró: no quedan ninjas');
              console.log(`Room ${roomId} deleted (empty)`);
              return;
            }
          }
          reassignHost(room);
          // During a game the player is only marked disconnected and can reconnect
          emitGameState(roomId);
          checkAbandoned(roomId);
        } else {
          delete playerToRoom[playerId];
        }
      }
      console.log(`Player disconnected: ${playerId}`);
    });
  });
}
