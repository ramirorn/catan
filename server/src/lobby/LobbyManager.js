import { GameEngine } from '../game/GameEngine.js';
import { v4 as uuidv4 } from 'uuid';

export class LobbyManager {
  constructor() {
    this.rooms = {};  // roomId → { engine, host, created }
  }

  createRoom(hostId, hostName, boardType = 'standard') {
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
    };

    // Auto-join host
    engine.addPlayer(hostId, hostName);

    return { roomId, engine };
  }

  joinRoom(roomId, playerId, playerName) {
    const room = this.rooms[roomId];
    if (!room) {
      return { success: false, error: 'No existe esa sala' };
    }

    const result = room.engine.addPlayer(playerId, playerName);
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
    delete this.rooms[roomId];
  }

  listRooms() {
    return Object.entries(this.rooms).map(([id, room]) => ({
      roomId: id,
      playerCount: room.engine.playerOrder.length,
      maxPlayers: room.engine.boardType === 'extended' ? 6 : 4,
      phase: room.engine.phase,
      boardType: room.engine.boardType,
      vpToWin: room.engine.vpToWin,
      turnTimeLimit: room.engine.turnTimeLimit,
      host: room.host,
    }));
  }
}
