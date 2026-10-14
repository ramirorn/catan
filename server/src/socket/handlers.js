import { createTurnTimers } from './turnTimer.js';

const CHAT_HISTORY_LIMIT = 200;
const CHAT_MAX_LENGTH = 500;
const CHAT_RATE_COUNT = 5;       // at most 5 messages…
const CHAT_RATE_WINDOW = 5000;   // …every 5 seconds per player

export function registerSocketHandlers(io, lobbyManager, timerOptions = {}) {
  // Players are identified by a persistent playerId sent by the client in the
  // handshake (survives page reloads / reconnects), not by the volatile socket.id.
  const playerToRoom = {};  // playerId → roomId

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

  function emitGameState(roomId) {
    const room = lobbyManager.getRoom(roomId);
    if (!room) return;

    // (Re)start / clear the turn timer so the deadline sent is current
    turnTimers.sync(roomId, room);

    // Send personalized state to each player (each player's sockets join a room named by playerId)
    for (const playerId of room.engine.playerOrder) {
      io.to(playerId).emit('gameState', room.engine.serialize(playerId));
    }
  }

  function emitToRoom(roomId, event, data) {
    const room = lobbyManager.getRoom(roomId);
    if (!room) return;
    for (const playerId of room.engine.playerOrder) {
      io.to(playerId).emit(event, data);
    }
  }

  // Lobby host is always the first player in the order (matches the client UI)
  function isHost(room, playerId) {
    return room.engine.playerOrder[0] === playerId;
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
      if (room && room.engine.players[playerId]) {
        room.engine.reconnectPlayer(playerId);
        socket.join(previousRoomId);
        socket.emit('chatHistory', { roomId: previousRoomId, messages: room.chat });
        emitGameState(previousRoomId);
      } else {
        delete playerToRoom[playerId];
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

    // Common wrapper for in-game actions
    function onGameAction(event, action, alwaysEmit = false) {
      on(event, (payload, cb) => {
        const roomId = playerToRoom[playerId];
        const room = lobbyManager.getRoom(roomId);
        if (!room || !room.engine.players[playerId]) {
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
    on('createRoom', ({ playerName, boardType, vpToWin, turnTimeLimit }, cb) => {
      const name = String(playerName || '').trim().slice(0, 24);
      if (!name) return cb({ success: false, error: 'Escribe tu nombre' });
      if (playerToRoom[playerId] && lobbyManager.getRoom(playerToRoom[playerId])) {
        return cb({ success: false, error: 'Ya estás en una sala' });
      }
      const type = boardType === 'extended' ? 'extended' : 'standard';
      const { roomId, engine } = lobbyManager.createRoom(playerId, name, type);
      // Optional settings; invalid values keep the defaults
      engine.updateSettings({ vpToWin, turnTimeLimit });
      socket.join(roomId);
      playerToRoom[playerId] = roomId;

      console.log(`Room ${roomId} created by ${name}`);
      cb({ success: true, roomId, playerId, state: engine.serialize(playerId) });
    });

    // ─── Lobby: Join Room ───
    on('joinRoom', ({ roomId, playerName }, cb) => {
      const name = String(playerName || '').trim().slice(0, 24);
      if (!name) return cb({ success: false, error: 'Escribe tu nombre' });
      const room = lobbyManager.getRoom(String(roomId || '').trim().toUpperCase());
      if (!room) {
        return cb({ success: false, error: 'No existe esa sala' });
      }
      if (playerToRoom[playerId] && playerToRoom[playerId] !== room.engine.roomId &&
          lobbyManager.getRoom(playerToRoom[playerId])) {
        return cb({ success: false, error: 'Ya estás en otra sala' });
      }

      const result = room.engine.addPlayer(playerId, name);
      if (!result.success) {
        return cb(result);
      }

      socket.join(room.engine.roomId);
      playerToRoom[playerId] = room.engine.roomId;

      console.log(`${name} joined room ${room.engine.roomId}`);
      cb({ success: true, roomId: room.engine.roomId, playerId });
      socket.emit('chatHistory', { roomId: room.engine.roomId, messages: room.chat });
      emitGameState(room.engine.roomId);
    });

    // ─── Lobby: Room settings (host only, before starting) ───
    on('updateRoomSettings', ({ vpToWin, turnTimeLimit }, cb) => {
      const roomId = playerToRoom[playerId];
      const room = lobbyManager.getRoom(roomId);
      if (!room) return cb({ success: false, error: 'No estás en una sala' });
      if (!isHost(room, playerId)) return cb({ success: false, error: 'Solo el anfitrión puede cambiar las reglas' });

      const result = room.engine.updateSettings({ vpToWin, turnTimeLimit });
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
    onGameAction('bankTrade', (engine, { give, receive }) => engine.bankTrade(playerId, give, receive));
    onGameAction('proposeTrade', (engine, { offering, requesting }) => engine.proposeTrade(playerId, offering, requesting));
    onGameAction('respondToTrade', (engine, { response, counterOffer }) => engine.respondToTrade(playerId, response, counterOffer));
    onGameAction('acceptTrade', (engine, { accepterId }) => engine.acceptTrade(playerId, accepterId));
    onGameAction('cancelTrade', (engine) => engine.cancelTrade(playerId), true);
    onGameAction('endTurn', (engine) => engine.endTurn(playerId));
    onGameAction('voteEndGame', (engine, { vote }) => engine.voteEndGame(playerId, vote !== false));

    // ─── Chat Message ───
    on('chatMessage', ({ message }, cb) => {
      const roomId = playerToRoom[playerId];
      const room = lobbyManager.getRoom(roomId);
      if (!room) return cb({ success: false, error: 'No estás en una sala' });

      const player = room.engine.players[playerId];
      const text = String(message || '').trim();
      if (!player || !text) return cb({ success: false, error: 'Mensaje vacío' });
      if (text.length > CHAT_MAX_LENGTH) {
        return cb({ success: false, error: `El mensaje es demasiado largo (máximo ${CHAT_MAX_LENGTH} caracteres)` });
      }

      // Anti-flood: max CHAT_RATE_COUNT messages per CHAT_RATE_WINDOW ms
      const now = Date.now();
      const recent = (room.chatRate[playerId] || []).filter((t) => now - t < CHAT_RATE_WINDOW);
      if (recent.length >= CHAT_RATE_COUNT) {
        room.chatRate[playerId] = recent;
        return cb({ success: false, error: 'Estás enviando mensajes muy rápido. Espera unos segundos.' });
      }
      recent.push(now);
      room.chatRate[playerId] = recent;

      room.chatCounter += 1;
      const msg = {
        id: room.chatCounter,
        playerId,
        playerName: player.name,
        playerColor: player.color,
        message: text,
        timestamp: now,
      };
      room.chat.push(msg);
      if (room.chat.length > CHAT_HISTORY_LIMIT) room.chat.splice(0, room.chat.length - CHAT_HISTORY_LIMIT);

      cb({ success: true });
      emitToRoom(roomId, 'chatMessage', msg);
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

      const roomId = playerToRoom[playerId];
      if (roomId) {
        const room = lobbyManager.getRoom(roomId);
        if (room) {
          const removed = room.engine.removePlayer(playerId);
          if (removed) {
            // Player removed from lobby (game hasn't started)
            delete playerToRoom[playerId];
            if (room.engine.playerOrder.length === 0) {
              lobbyManager.removeRoom(roomId);
              console.log(`Room ${roomId} deleted (empty)`);
            } else {
              room.host = room.engine.playerOrder[0];
            }
          }
          // During a game the player is only marked disconnected and can reconnect
          emitGameState(roomId);
        } else {
          delete playerToRoom[playerId];
        }
      }
      console.log(`Player disconnected: ${playerId}`);
    });
  });
}

