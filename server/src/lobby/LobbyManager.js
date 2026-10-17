import { GameEngine } from '../game/GameEngine.js';
import { v4 as uuidv4 } from 'uuid';

export class LobbyManager {
  constructor() {
    this.rooms = {};  // roomId → { engine, host, created }
  }

  createRoom(hostId, hostName, boardType = 'standard', avatarId = 0) {
    const roomId = uuidv4().slice(0, 6).toUpperCase();
    const engine = new GameEngine(roomId, boardType);

    this.rooms[roomId] = {
      engine,
      host: hostId,
      created: Date.now(),
      turnTimer: null,  // { key, handle } managed by socket/turnTimer.js
      chat: [],         // last chat messages (survive page reloads)
      chatCounter: 0,
      chatRate: {},     // playerId → recent message timestamps (anti-flood)
      spectators: {},   // playerId → { id, name, avatarId, connected, removeTimer }
      banned: new Set(),  // ids kicked by the host: cannot come back to this room
      abandonTimer: null, // closes a game nobody is connected to
      accounts: {},       // playerId → account id of a logged-in seat (Ryō at the end)
    };

    // Auto-join host
    engine.addPlayer(hostId, hostName, avatarId);

    return { roomId, engine };
  }

  joinRoom(roomId, playerId, playerName, avatarId = 0) {
    const room = this.rooms[roomId];
    if (!room) {
      return { success: false, error: 'No existe esa sala' };
    }

    const result = room.engine.addPlayer(playerId, playerName, avatarId);
    return result;
  }

  getRoom(roomId) {
    return this.rooms[roomId] || null;
  }

  removeRoom(roomId) {
    const room = this.rooms[roomId];
    if (room && room.turnTimer) {
      clearTimeout(room.turnTimer.handle);
      room.turnTimer = null;
    }
    if (room) {
      if (room.abandonTimer) clearTimeout(room.abandonTimer);
      room.abandonTimer = null;
      for (const s of Object.values(room.spectators || {})) {
        if (s.removeTimer) clearTimeout(s.removeTimer);
      }
    }
    delete this.rooms[roomId];
  }

  listRooms() {
    return Object.entries(this.rooms).map(([id, room]) => ({
      roomId: id,
      playerCount: room.engine.playerOrder.length,
      spectatorCount: Object.values(room.spectators || {}).filter((s) => s.connected).length,
      maxPlayers: room.engine.boardType === 'extended' ? 6 : 4,
      phase: room.engine.phase,
      boardType: room.engine.boardType,
      vpToWin: room.engine.vpToWin,
      turnTimeLimit: room.engine.turnTimeLimit,
      peacePacts: room.engine.peacePacts,
      host: room.host,
    }));
  }
}
