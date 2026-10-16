import { Board } from './Board.js';
import { Player } from './Player.js';
import { Trade } from './Trade.js';
import { DevCards } from './DevCards.js';
import { Robber } from './Robber.js';
import { Scoring } from './Scoring.js';
import {
  PHASE, BUILD_COSTS, PLAYER_COLORS, RESOURCE,
  DEV_CARD, BANK_RESOURCE_COUNT, BANK_RESOURCE_COUNT_EXTENDED, MAX_ROADS,
  VP_TO_WIN, VP_TO_WIN_OPTIONS, TURN_TIME_OPTIONS,
} from './constants.js';

const VALID_RESOURCES = Object.values(RESOURCE);
// How many animation events the state carries (clients replay the new ones)
const RECENT_EVENTS_MAX = 6;


// Resource names for the game log (chronicle is shown in Spanish)
const RESOURCE_ES = {
  wood: 'madera',
  brick: 'arcilla',
  sheep: 'oveja',
  wheat: 'trigo',
  ore: 'piedra',
};

export class GameEngine {
  constructor(roomId, boardType = 'standard') {
    this.roomId = roomId;
    this.boardType = boardType;
    this.board = null;
    this.trade = new Trade();
    this.devCards = null;
    this.robber = new Robber();
    this.scoring = new Scoring();

    this.players = {};      // playerId → Player
    this.playerOrder = [];  // array of playerIds in turn order
    this.currentPlayerIndex = 0;
    this.phase = PHASE.LOBBY;
    this.turnNumber = 0;
    this.lastDiceRoll = null;
    // Last resource payout (dice roll or 2nd setup settlement), so every
    // client can show what it just received. id changes on each payout.
    this.lastProduction = null;
    this.lastCompletedTrade = null;
    this.productionCounter = 0;
    // Grows on every roll so clients can tell two equal rolls apart
    this.diceRollCounter = 0;
    this.gameLog = [];

    // Road building dev card state
    this.freeRoadsRemaining = 0;

    // Setup phase tracking
    this.setupRound = 0; // 0 = first round, 1 = second round

    // Robber flow: phase to return to after moving robber / stealing
    // (ROLL_DICE when a Knight is played before rolling, MAIN otherwise)
    this.phaseAfterRobber = PHASE.MAIN;
    this.stealTargets = []; // playerIds that can be robbed in ROBBER_STEAL

    this.winner = null;

    // Ending the game by unanimous vote
    this.endVotes = new Set();
    this.endedByAgreement = false;

    // 5–6 player extension: special building phase after each turn
    this.specialBuilderId = null; // player who may build right now
    this.specialBuildQueue = [];  // players still waiting for their special build

    // Room settings (chosen by the host before starting)
    this.vpToWin = VP_TO_WIN;
    this.turnTimeLimit = 90;  // seconds per turn, 0 = no limit (default 90 s)
    // Absolute epoch ms when whoever must act runs out of time. Managed by the
    // socket layer's turn timer (null when no timer is running).
    this.turnDeadline = null;
    this.timedOutKey = null;  // timer key of the last turn that timed out

    // Game clock: epoch ms when the setup began / when the game ended
    this.startedAt = null;
    this.endedAt = null;

    // Last robbery (dice 7 or Knight). The resource is only serialized for the
    // thief and the victim; everyone else just sees that a card was taken.
    this.lastSteal = null;
    this.stealCounter = 0;
    this.robberSource = 'dice'; // 'dice' | 'knight'

    // Public event feed for the client animations (city upgrade, robber,
    // steal, dev card, near win): a short ring buffer with increasing ids,
    // sent inside the state that is broadcast anyway. Nothing private here
    // (a steal never says which resource was taken).
    this.recentEvents = [];
    this.eventCounter = 0;
    this.nearWinAnnounced = new Set(); // players already announced at vpToWin - 2
  }

  // ─── Event feed (animations) ───
  _pushEvent(type, data) {
    this.eventCounter++;
    this.recentEvents.push({ id: this.eventCounter, type, ...data });
    if (this.recentEvents.length > RECENT_EVENTS_MAX) this.recentEvents.shift();
  }

  // A player whose PUBLIC points reach vpToWin - 2 (hidden VP cards are never
  // used, so the feed can't leak them) is announced once per game
  _checkNearWin() {
    if (this.winner || this.phase === PHASE.GAME_OVER) return;
    const threshold = this.vpToWin - 2;
    for (const pid of this.playerOrder) {
      const p = this.players[pid];
      if (!p || this.nearWinAnnounced.has(pid)) continue;
      p.calculateVP();
      if (p.publicVP >= threshold && p.publicVP < this.vpToWin) {
        this.nearWinAnnounced.add(pid);
        this._pushEvent('nearWin', { playerId: pid, vpLeft: this.vpToWin - p.publicVP });
      }
    }
  }

  // ─── Room settings (host, before starting) ───
  updateSettings({ vpToWin, turnTimeLimit } = {}) {
    if (this.phase !== PHASE.LOBBY) {
      return { success: false, error: 'La partida ya comenzó' };
    }
    const vp = vpToWin === undefined ? this.vpToWin : Number(vpToWin);
    const time = turnTimeLimit === undefined ? this.turnTimeLimit : Number(turnTimeLimit);
    if (!VP_TO_WIN_OPTIONS.includes(vp)) return { success: false, error: 'Puntos para ganar no válidos' };
    if (!TURN_TIME_OPTIONS.includes(time)) return { success: false, error: 'Tiempo por turno no válido' };
    this.vpToWin = vp;
    this.turnTimeLimit = time;
    return { success: true, vpToWin: this.vpToWin, turnTimeLimit: this.turnTimeLimit };
  }

  isExtended() {
    return this.boardType === 'extended';
  }

  // ─── Bank helpers ───
  // The bank holds 19 cards of each resource (24 in the 5–6 player extension);
  // whatever players don't hold is in the bank.
  bankSize() {
    return this.isExtended() ? BANK_RESOURCE_COUNT_EXTENDED : BANK_RESOURCE_COUNT;
  }

  bankCount(resource) {
    let held = 0;
    for (const p of Object.values(this.players)) held += p.resources[resource] || 0;
    return this.bankSize() - held;
  }

  // Returns a clean { resource: positiveInt } object or null if invalid
  _sanitizeResources(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const clean = {};
    for (const [res, amount] of Object.entries(obj)) {
      if (!VALID_RESOURCES.includes(res)) return null;
      if (!Number.isInteger(amount) || amount < 0) return null;
      if (amount > 0) clean[res] = amount;
    }
    return clean;
  }

  // ─── Player Management ───
  addPlayer(id, name) {
    if (this.phase !== PHASE.LOBBY) return { success: false, error: 'La partida ya comenzó' };
    const maxPlayers = this.boardType === 'extended' ? 6 : 4;
    if (this.players[id]) return { success: false, error: 'Ya estás en esta partida' };
    if (Object.keys(this.players).length >= maxPlayers) {
      return { success: false, error: 'La sala está llena' };
    }

    const index = Object.keys(this.players).length;
    const color = PLAYER_COLORS[index];
    const player = new Player(id, name, color, index);
    this.players[id] = player;
    this.playerOrder.push(id);

    this.log(`${name} se unió a la partida`);
    return { success: true, player: player.serialize(true) };
  }

  removePlayer(id) {
    if (this.phase === PHASE.LOBBY) {
      delete this.players[id];
      this.playerOrder = this.playerOrder.filter((pid) => pid !== id);
      // Reindex remaining players
      this.playerOrder.forEach((pid, i) => {
        this.players[pid].index = i;
        this.players[pid].color = PLAYER_COLORS[i];
      });
      return true;
    }
    // During game, mark as disconnected
    if (this.players[id]) {
      this.players[id].connected = false;
    }
    return false;
  }

  reconnectPlayer(id) {
    if (this.players[id]) {
      this.players[id].connected = true;
      return true;
    }
    return false;
  }

  // ─── Leaving a game in progress ───
  // The player keeps their seat and pieces (the board stays coherent) but is
  // marked as gone: the server plays their turns at once (autoPlayLeft) and
  // they no longer count for the unanimous end vote.
  markLeft(id, { kicked = false } = {}) {
    const player = this.players[id];
    if (!player) return false;
    player.left = true;
    player.kicked = player.kicked || kicked;
    player.connected = false;
    this.endVotes.delete(id);
    this.log(`${player.name} ${kicked ? 'fue expulsado de la partida' : 'abandonó la partida'}`);
    // Their pending trade offer (if any) dies with them
    const active = this.trade.getActiveTrade();
    if (active && active.proposerId === id) this.trade.cancelTrade();
    this._checkEndVotes();
    return true;
  }

  // A player who left (not kicked) comes back to their seat
  rejoinPlayer(id) {
    const player = this.players[id];
    if (!player || player.kicked) return false;
    if (player.left) this.log(`${player.name} volvió a la partida`);
    player.left = false;
    player.connected = true;
    return true;
  }

  activePlayerIds() {
    return this.playerOrder.filter((pid) => !this.players[pid]?.left);
  }

  _isAbsent(pid) {
    const p = this.players[pid];
    return !p || p.left;
  }

  // Plays at once for players who left, wherever the game waits on them, so a
  // game without a turn limit never stalls on an empty seat. Cheap when nobody
  // left (one pass over playerOrder).
  autoPlayLeft() {
    if (!this.playerOrder.some((pid) => this.players[pid]?.left)) return false;
    let acted = false;
    for (let step = 0; step < 40; step++) {
      if (this.phase === PHASE.LOBBY || this.phase === PHASE.GAME_OVER) break;
      if (this.activePlayerIds().length === 0) break;
      if (this.phase === PHASE.ROBBER_DISCARD) {
        const pending = this.robber.playersWhoMustDiscard
          .filter((pid) => !this.robber.discardedPlayers.has(pid) && this._isAbsent(pid));
        if (pending.length === 0) break;
        for (const pid of pending) {
          if (this.phase !== PHASE.ROBBER_DISCARD) break;
          const player = this.players[pid];
          this.discardCards(pid, this._randomCards(player, Math.floor(player.totalResources() / 2)));
        }
        acted = true;
        continue;
      }
      const actor = this.getActingPlayerId();
      if (!actor || !this._isAbsent(actor)) break;
      const before = `${this.phase}:${actor}:${this.turnNumber}`;
      this.handleTimeout({ silent: true });
      acted = true;
      if (`${this.phase}:${this.getActingPlayerId()}:${this.turnNumber}` === before) break; // no progress
    }
    return acted;
  }

  getCurrentPlayer() {
    return this.players[this.playerOrder[this.currentPlayerIndex]];
  }

  getCurrentPlayerId() {
    return this.playerOrder[this.currentPlayerIndex];
  }

  // Who may act right now: the special builder during the special building
  // phase, otherwise the player whose turn it is.
  getActingPlayerId() {
    return this.phase === PHASE.SPECIAL_BUILD ? this.specialBuilderId : this.getCurrentPlayerId();
  }

  // Building (and buying dev cards) is allowed in the main phase of your own
  // turn, or during your special build.
  _isBuildPhase() {
    return this.phase === PHASE.MAIN || this.phase === PHASE.SPECIAL_BUILD;
  }

  // ─── Game Start ───
  startGame() {
    if (this.phase !== PHASE.LOBBY) return { success: false, error: 'La partida ya comenzó' };
    if (this.playerOrder.length < 2) return { success: false, error: 'Hacen falta al menos 2 jugadores' };

    this.board = new Board(this.boardType);
    this.devCards = new DevCards(this.boardType);

    // Randomize turn order
    for (let i = this.playerOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.playerOrder[i], this.playerOrder[j]] = [this.playerOrder[j], this.playerOrder[i]];
    }

    this.currentPlayerIndex = 0;
    this.phase = PHASE.SETUP_FORWARD;
    this.setupRound = 0;
    this.startedAt = Date.now();
    this.endedAt = null;

    this.log('¡Comienza la partida! Fase de colocación inicial.');
    this.log(`Turno de ${this.getCurrentPlayer().name} para colocar un poblado.`);

    return { success: true };
  }

  // ─── Setup Phase Actions ───
  setupPlaceSettlement(playerId, vertexId) {
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (this.phase !== PHASE.SETUP_FORWARD && this.phase !== PHASE.SETUP_REVERSE) {
      return { success: false, error: 'No estamos en la colocación inicial' };
    }

    const player = this.players[playerId];
    if (player.lastSetupVertex !== null) {
      return { success: false, error: 'Ya colocaste el poblado; ahora coloca un camino' };
    }

    if (!this.board.canPlaceSettlement(vertexId, playerId, true)) {
      return { success: false, error: 'No puedes colocar un poblado ahí' };
    }

    this.board.placeBuilding(vertexId, 'settlement', playerId);
    player.settlementsBuilt++;
    player.setupSettlementsPlaced++;
    player.lastSetupVertex = vertexId;

    // In second round, give initial resources from adjacent hexes
    if (this.phase === PHASE.SETUP_REVERSE) {
      const vertex = this.board.vertices[vertexId];
      const gained = {};
      for (const hexId of vertex.adjacentHexes) {
        const hex = this.board.hexes[hexId];
        if (hex.resource) {
          player.addResource(hex.resource);
          gained[hex.resource] = (gained[hex.resource] || 0) + 1;
        }
      }
      this.log(`${player.name} recibió sus recursos iniciales: ${this._formatResources(gained)}`);
      this._recordProduction('setup', null, { [playerId]: gained });
    }

    this.log(`${player.name} colocó un poblado`);
    this._checkNearWin();
    return { success: true, phase: this.phase };
  }

  setupPlaceRoad(playerId, edgeId) {
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (this.phase !== PHASE.SETUP_FORWARD && this.phase !== PHASE.SETUP_REVERSE) {
      return { success: false, error: 'No estamos en la colocación inicial' };
    }

    const player = this.players[playerId];
    if (player.lastSetupVertex === null) {
      return { success: false, error: 'Primero coloca un poblado' };
    }

    if (!this.board.canPlaceRoad(edgeId, playerId, true, player.lastSetupVertex)) {
      return { success: false, error: 'El camino debe salir de tu poblado' };
    }

    this.board.placeRoad(edgeId, playerId);
    player.roadsBuilt++;
    player.lastSetupVertex = null;

    this.log(`${player.name} colocó un camino`);

    // Advance to next player/phase
    this._advanceSetup();

    return { success: true, phase: this.phase };
  }

  _advanceSetup() {
    if (this.phase === PHASE.SETUP_FORWARD) {
      if (this.currentPlayerIndex < this.playerOrder.length - 1) {
        this.currentPlayerIndex++;
      } else {
        // Switch to reverse setup
        this.phase = PHASE.SETUP_REVERSE;
        // Don't change currentPlayerIndex — same player goes again in reverse
      }
    } else if (this.phase === PHASE.SETUP_REVERSE) {
      if (this.currentPlayerIndex > 0) {
        this.currentPlayerIndex--;
      } else {
        // Setup complete! Start normal gameplay
        this.phase = PHASE.ROLL_DICE;
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.log('¡Colocación terminada! Empieza el juego.');
      }
    }

    if (this.phase === PHASE.SETUP_FORWARD || this.phase === PHASE.SETUP_REVERSE) {
      this.log(`Turno de ${this.getCurrentPlayer().name} para colocar un poblado.`);
    } else {
      this.log(`Ronda ${this.turnNumber}: turno de ${this.getCurrentPlayer().name}. ¡A tirar los dados!`);
    }
  }

  // ─── Dice Rolling ───
  rollDice(playerId) {
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (this.phase !== PHASE.ROLL_DICE) {
      return { success: false, error: 'Ahora no puedes tirar los dados' };
    }

    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const roll = die1 + die2;
    this.diceRollCounter++;
    // playerId: who rolled (the turn may already have passed when clients get it)
    this.lastDiceRoll = { id: this.diceRollCounter, die1, die2, total: roll, playerId };

    this.log(`${this.getCurrentPlayer().name} sacó ${die1} + ${die2} = ${roll}`);

    if (roll === 7) {
      return this._handleRollSeven();
    }

    // Distribute resources
    const distributions = this._distributeResources(roll);
    this._recordProduction('roll', roll, distributions);
    this.phase = PHASE.MAIN;

    return {
      success: true,
      dice: this.lastDiceRoll,
      distributions,
      phase: this.phase,
    };
  }

  _recordProduction(source, roll, byPlayer) {
    this.productionCounter++;
    this.lastProduction = { id: this.productionCounter, source, roll, byPlayer };
  }

  _distributeResources(roll) {
    const hexes = this.board.getHexesForRoll(roll);
    const owed = {}; // resource → { playerId: amount }

    for (const hex of hexes) {
      const buildings = this.board.getBuildingsAdjacentToHex(hex.id);
      for (const building of buildings) {
        const amount = building.type === 'city' ? 2 : 1;
        const res = hex.resource;
        if (!owed[res]) owed[res] = {};
        owed[res][building.playerId] = (owed[res][building.playerId] || 0) + amount;
      }
    }

    // Bank shortage rule: if the bank can't pay everyone a resource, nobody gets it,
    // unless only one player is owed it — then that player gets what is left.
    const distributions = {}; // playerId → { resource: amount }
    for (const [res, perPlayer] of Object.entries(owed)) {
      const totalOwed = Object.values(perPlayer).reduce((a, b) => a + b, 0);
      const available = this.bankCount(res);
      const recipients = Object.keys(perPlayer);
      let payout = perPlayer;
      if (totalOwed > available) {
        if (recipients.length === 1 && available > 0) {
          payout = { [recipients[0]]: available };
        } else {
          payout = {};
        }
        this.log(`El banco no tiene suficiente ${RESOURCE_ES[res] || res}`);
      }
      for (const [pid, amount] of Object.entries(payout)) {
        if (!distributions[pid]) distributions[pid] = {};
        distributions[pid][res] = (distributions[pid][res] || 0) + amount;
        this.players[pid].addResource(res, amount);
      }
    }

    for (const [pid, res] of Object.entries(distributions)) {
      this.log(`${this.players[pid].name} recibió ${this._formatResources(res)}`);
    }

    return distributions;
  }

  _handleRollSeven() {
    this.phaseAfterRobber = PHASE.MAIN;
    this.robberSource = 'dice';
    const mustDiscard = this.robber.checkDiscards(this.players);

    if (mustDiscard.length > 0) {
      this.phase = PHASE.ROBBER_DISCARD;
      for (const pid of mustDiscard) {
        const p = this.players[pid];
        this.log(`${p.name} debe descartar ${Math.floor(p.totalResources() / 2)} cartas`);
      }
      return {
        success: true,
        dice: this.lastDiceRoll,
        phase: PHASE.ROBBER_DISCARD,
        mustDiscard,
      };
    }

    this.phase = PHASE.ROBBER_MOVE;
    return {
      success: true,
      dice: this.lastDiceRoll,
      phase: PHASE.ROBBER_MOVE,
    };
  }

  // ─── Robber Actions ───
  discardCards(playerId, cards) {
    if (this.phase !== PHASE.ROBBER_DISCARD) {
      return { success: false, error: 'No es momento de descartar' };
    }

    const player = this.players[playerId];
    if (!player) return { success: false, error: 'No estás en esta partida' };
    const result = this.robber.processDiscard(player, cards);
    if (!result.success) return result;

    this.log(`${player.name} descartó ${Object.values(cards).reduce((a, b) => a + b, 0)} cartas`);

    if (result.allDiscarded) {
      this.phase = PHASE.ROBBER_MOVE;
      return { success: true, phase: PHASE.ROBBER_MOVE, allDiscarded: true };
    }

    return { success: true, phase: PHASE.ROBBER_DISCARD, allDiscarded: false };
  }

  moveRobber(playerId, hexId) {
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (this.phase !== PHASE.ROBBER_MOVE) {
      return { success: false, error: 'Ahora no puedes mover el ladrón' };
    }
    if (hexId === this.board.robberHex) {
      return { success: false, error: 'Mueve el ladrón a otra casilla' };
    }
    if (!this.board.hexes[hexId]) {
      return { success: false, error: 'Casilla no válida' };
    }

    const fromHex = this.board.robberHex;
    this.board.moveRobber(hexId);
    this._pushEvent('robberMoved', { playerId, fromHex, toHex: hexId });
    this.log(`${this.getCurrentPlayer().name} movió al ladrón`);

    // Check if there are players to steal from
    const adjacentPlayers = this.board.getPlayersAdjacentToHex(hexId)
      .filter((pid) => pid !== playerId && this.players[pid].totalResources() > 0);

    if (adjacentPlayers.length === 0) {
      this.phase = this.phaseAfterRobber;
      return { success: true, phase: this.phase, stealTargets: [] };
    }

    if (adjacentPlayers.length === 1) {
      // Auto-steal
      const result = this.robber.stealCard(this.players[playerId], this.players[adjacentPlayers[0]]);
      this._recordSteal(playerId, adjacentPlayers[0], result.resource);
      this.log(`${this.getCurrentPlayer().name} le robó una carta a ${this.players[adjacentPlayers[0]].name}`);
      this.phase = this.phaseAfterRobber;
      return { success: true, phase: this.phase, stolen: result, fromPlayer: adjacentPlayers[0], stealTargets: [] };
    }

    this.stealTargets = adjacentPlayers;
    this.phase = PHASE.ROBBER_STEAL;
    return {
      success: true,
      phase: PHASE.ROBBER_STEAL,
      stealTargets: adjacentPlayers.map((pid) => ({
        id: pid,
        name: this.players[pid].name,
      })),
    };
  }

  stealCard(playerId, victimId) {
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (this.phase !== PHASE.ROBBER_STEAL) {
      return { success: false, error: 'Ahora no puedes robar' };
    }

    if (!this.stealTargets.includes(victimId)) {
      return { success: false, error: 'No puedes robarle a ese jugador' };
    }

    const result = this.robber.stealCard(this.players[playerId], this.players[victimId]);
    this._recordSteal(playerId, victimId, result.resource);
    this.log(`${this.getCurrentPlayer().name} le robó una carta a ${this.players[victimId].name}`);
    this.stealTargets = [];
    this.phase = this.phaseAfterRobber;

    return { success: true, phase: this.phase, stolen: result };
  }

  _recordSteal(thiefId, victimId, resource) {
    if (!resource) return;
    this.stealCounter++;
    this.lastSteal = { id: this.stealCounter, thiefId, victimId, resource, source: this.robberSource };
    // Public: who robbed whom, never what
    this._pushEvent('steal', { thiefId, victimId });
  }

  // What a given viewer may know about the last robbery
  _serializeSteal(forPlayerId) {
    const s = this.lastSteal;
    if (!s) return null;
    const involved = forPlayerId && (forPlayerId === s.thiefId || forPlayerId === s.victimId);
    return {
      id: s.id,
      thiefId: s.thiefId,
      victimId: s.victimId,
      source: s.source,
      resource: involved ? s.resource : null,
    };
  }

  // ─── Building Actions (Main Phase) ───
  buildRoad(playerId, edgeId) {
    if (playerId !== this.getActingPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    // Free roads from Road Building can also be laid before rolling
    const freeRoadBeforeRoll = this.phase === PHASE.ROLL_DICE && this.freeRoadsRemaining > 0;
    if (!this._isBuildPhase() && !freeRoadBeforeRoll) {
      return { success: false, error: 'Ahora no puedes construir' };
    }

    const player = this.players[playerId];

    // Check if this is a free road from Road Building card
    if (this.freeRoadsRemaining > 0) {
      if (!this.board.canPlaceRoad(edgeId, playerId)) {
        return { success: false, error: 'No puedes colocar un camino ahí' };
      }
      if (!player.canBuildMoreRoads()) {
        return { success: false, error: 'No te quedan caminos' };
      }

      this.board.placeRoad(edgeId, playerId);
      player.roadsBuilt++;
      this.freeRoadsRemaining--;

      this.scoring.updateLongestRoad(this.players, this.board);
      this.log(`${player.name} colocó un camino gratis (Construcción de caminos)`);
      const freeWinner = this._checkWin();
      this._checkNearWin();

      return {
        success: true,
        freeRoadsRemaining: this.freeRoadsRemaining,
        scoring: this.scoring.serialize(),
        winner: freeWinner,
      };
    }

    if (!player.hasResources(BUILD_COSTS.road)) {
      return { success: false, error: 'No tienes recursos suficientes' };
    }
    if (!player.canBuildMoreRoads()) {
      return { success: false, error: 'No te quedan caminos' };
    }
    if (!this.board.canPlaceRoad(edgeId, playerId)) {
      return { success: false, error: 'No puedes colocar un camino ahí' };
    }

    player.deductResources(BUILD_COSTS.road);
    this.board.placeRoad(edgeId, playerId);
    player.roadsBuilt++;

    this.scoring.updateLongestRoad(this.players, this.board);
    this.log(`${player.name} construyó un camino`);
    const roadWinner = this._checkWin();
    this._checkNearWin();

    return { success: true, scoring: this.scoring.serialize(), winner: roadWinner };
  }

  buildSettlement(playerId, vertexId) {
    if (playerId !== this.getActingPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (!this._isBuildPhase()) {
      return { success: false, error: 'Ahora no puedes construir' };
    }

    const player = this.players[playerId];
    if (!player.hasResources(BUILD_COSTS.settlement)) {
      return { success: false, error: 'No tienes recursos suficientes' };
    }
    if (!player.canBuildMoreSettlements()) {
      return { success: false, error: 'No te quedan poblados' };
    }
    if (!this.board.canPlaceSettlement(vertexId, playerId)) {
      return { success: false, error: 'No puedes colocar un poblado ahí' };
    }

    player.deductResources(BUILD_COSTS.settlement);
    this.board.placeBuilding(vertexId, 'settlement', playerId);
    player.settlementsBuilt++;

    // Longest road might break (if settlement splits opponent's road)
    this.scoring.updateLongestRoad(this.players, this.board);
    this.log(`${player.name} construyó un poblado`);
    const settlementWinner = this._checkWin();
    this._checkNearWin();

    return {
      success: true,
      scoring: this.scoring.serialize(),
      winner: settlementWinner,
    };
  }

  buildCity(playerId, vertexId) {
    if (playerId !== this.getActingPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (!this._isBuildPhase()) {
      return { success: false, error: 'Ahora no puedes construir' };
    }

    const player = this.players[playerId];
    if (!player.hasResources(BUILD_COSTS.city)) {
      return { success: false, error: 'No tienes recursos suficientes' };
    }
    if (!player.canBuildMoreCities()) {
      return { success: false, error: 'No te quedan ciudades' };
    }
    if (!this.board.canUpgradeToCity(vertexId, playerId)) {
      return { success: false, error: 'La ciudad debe construirse sobre uno de tus poblados' };
    }

    player.deductResources(BUILD_COSTS.city);
    this.board.placeBuilding(vertexId, 'city', playerId);
    player.settlementsBuilt--; // settlement is returned
    player.citiesBuilt++;

    this.log(`${player.name} mejoró un poblado a ciudad`);
    this._pushEvent('cityUpgrade', { playerId, vertexId });
    const cityWinner = this._checkWin();
    this._checkNearWin();

    return {
      success: true,
      scoring: this.scoring.serialize(),
      winner: cityWinner,
    };
  }

  // ─── Development Cards ───
  buyDevCard(playerId) {
    if (playerId !== this.getActingPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (!this._isBuildPhase()) {
      return { success: false, error: 'Ahora no puedes comprar' };
    }

    const player = this.players[playerId];
    const result = this.devCards.buyCard(player);

    if (result.success) {
      this.log(`${player.name} compró una carta de desarrollo`);
      // A Victory Point card can bring the player to 10 VP
      result.winner = this._checkWin();
    }

    return result;
  }

  playDevCard(playerId, cardType, params = {}) {
    if (this.phase === PHASE.SPECIAL_BUILD) {
      return { success: false, error: 'No se pueden jugar cartas en la fase especial de construcción' };
    }
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    // Any development card may be played before rolling the dice
    if (this.phase !== PHASE.MAIN && this.phase !== PHASE.ROLL_DICE) {
      return { success: false, error: 'Ahora no puedes jugar cartas' };
    }

    const player = this.players[playerId];

    switch (cardType) {
      case DEV_CARD.KNIGHT: {
        const phaseBefore = this.phase;
        const result = this.devCards.playKnight(player);
        if (result.success) {
          this.scoring.updateLargestArmy(this.players);
          this.log(`${player.name} jugó un Caballero`);
          this._pushEvent('devCard', { playerId, cardType });
          const winner = this._checkWin();
          this._checkNearWin();
          if (winner) return { ...result, scoring: this.scoring.serialize(), phase: this.phase, winner };
          // After moving the robber, return to where we were (roll dice if played before rolling)
          this.phaseAfterRobber = phaseBefore;
          this.robberSource = 'knight';
          this.phase = PHASE.ROBBER_MOVE;
        }
        return { ...result, scoring: this.scoring.serialize(), phase: this.phase };
      }

      case DEV_CARD.ROAD_BUILDING: {
        const result = this.devCards.playRoadBuilding(player);
        if (result.success) {
          this.freeRoadsRemaining = Math.max(0, Math.min(2, MAX_ROADS - player.roadsBuilt));
          this.log(`${player.name} jugó Construcción de caminos`);
          this._pushEvent('devCard', { playerId, cardType });
        }
        return { ...result, freeRoadsRemaining: this.freeRoadsRemaining };
      }

      case DEV_CARD.YEAR_OF_PLENTY: {
        const { resource1, resource2 } = params;
        if (VALID_RESOURCES.includes(resource1) && VALID_RESOURCES.includes(resource2)) {
          const need = resource1 === resource2 ? { [resource1]: 2 } : { [resource1]: 1, [resource2]: 1 };
          for (const [res, n] of Object.entries(need)) {
            if (this.bankCount(res) < n) {
              return { success: false, error: `El banco no tiene suficiente ${RESOURCE_ES[res] || res}` };
            }
          }
        }
        const result = this.devCards.playYearOfPlenty(player, resource1, resource2);
        if (result.success) {
          this.log(`${player.name} jugó Año de la abundancia (${RESOURCE_ES[resource1] || resource1}, ${RESOURCE_ES[resource2] || resource2})`);
          // The chosen resources are public (chronicle), so they can be shown
          this._pushEvent('devCard', { playerId, cardType, resources: [resource1, resource2] });
        }
        return result;
      }

      case DEV_CARD.MONOPOLY: {
        const { resource } = params;
        const allPlayers = Object.values(this.players);
        const result = this.devCards.playMonopoly(player, resource, allPlayers);
        if (result.success) {
          this.log(`${player.name} jugó Monopolio de ${RESOURCE_ES[resource] || resource} (se llevó ${result.totalStolen})`);
          this._pushEvent('devCard', { playerId, cardType, resource, total: result.totalStolen });
        }
        return result;
      }

      default:
        return { success: false, error: 'Carta desconocida' };
    }
  }

  // ─── Trading ───
  bankTrade(playerId, give, receive) {
    if (this.phase === PHASE.SPECIAL_BUILD) {
      return { success: false, error: 'No se puede comerciar en la fase especial de construcción' };
    }
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (this.phase !== PHASE.MAIN) {
      return { success: false, error: 'Ahora no puedes comerciar' };
    }

    const player = this.players[playerId];
    if (!VALID_RESOURCES.includes(give) || !VALID_RESOURCES.includes(receive)) {
      return { success: false, error: 'Recurso no válido' };
    }
    if (give === receive) {
      return { success: false, error: 'Elige un recurso distinto para recibir' };
    }
    if (this.bankCount(receive) < 1) {
      return { success: false, error: `Al banco no le queda ${RESOURCE_ES[receive] || receive}` };
    }
    if (!this.trade.canBankTrade(player, give, receive, this.board)) {
      const ratio = this.trade.getBestRatio(player, give, this.board);
      return { success: false, error: `Necesitas ${ratio} de ${RESOURCE_ES[give] || give} para cambiar` };
    }

    const ratio = this.trade.getBestRatio(player, give, this.board);
    const result = this.trade.executeBankTrade(player, give, receive, this.board);
    if (result) {
      this.log(`${player.name} cambió ${ratio} ${RESOURCE_ES[give] || give} por 1 ${RESOURCE_ES[receive] || receive} con el banco`);
    }

    return { success: result };
  }

  proposeTrade(playerId, offering, requesting) {
    if (this.phase === PHASE.SPECIAL_BUILD) {
      return { success: false, error: 'No se puede comerciar en la fase especial de construcción' };
    }
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (this.phase !== PHASE.MAIN) {
      return { success: false, error: 'Ahora no puedes comerciar' };
    }

    const player = this.players[playerId];
    const cleanOffer = this._sanitizeResources(offering);
    const cleanRequest = this._sanitizeResources(requesting);
    if (!cleanOffer || !cleanRequest) {
      return { success: false, error: 'Oferta no válida' };
    }
    if (Object.keys(cleanOffer).length === 0 || Object.keys(cleanRequest).length === 0) {
      return { success: false, error: 'La oferta debe dar y pedir algo' };
    }
    if (!player.hasResources(cleanOffer)) {
      return { success: false, error: 'No tienes los recursos que ofreces' };
    }

    const trade = this.trade.proposeTrade(player, cleanOffer, cleanRequest);
    this.log(`${player.name} propuso un comercio`);

    return { success: true, trade };
  }

  respondToTrade(playerId, response, counterOffer = null) {
    const player = this.players[playerId];
    const active = this.trade.getActiveTrade();
    if (!player || this.phase !== PHASE.MAIN || !active || active.status !== 'pending') {
      return { success: false, error: 'No hay ninguna oferta activa' };
    }
    if (active.proposerId === playerId) {
      return { success: false, error: 'No puedes responder a tu propia oferta' };
    }
    if (!['accept', 'reject', 'counter'].includes(response)) {
      return { success: false, error: 'Respuesta no válida' };
    }
    if (response === 'accept' && !player.hasResources(active.requesting)) {
      return { success: false, error: 'No tienes los recursos que te piden' };
    }

    // Counter-offer: sent as what the responder gives / gets, stored from the
    // proposer's point of view so it can be executed like the original offer
    if (response === 'counter') {
      const give = this._sanitizeResources(counterOffer?.give);
      const get = this._sanitizeResources(counterOffer?.get);
      if (!give || !get || Object.keys(give).length === 0 || Object.keys(get).length === 0) {
        return { success: false, error: 'Una contraoferta debe dar y pedir algo' };
      }
      if (!player.hasResources(give)) {
        return { success: false, error: 'No tienes los recursos que ofreces' };
      }
      this.trade.respondToTrade(playerId, 'counter', { offering: get, requesting: give });
      this.log(`${player.name} hizo una contraoferta`);
      return { success: true, trade: this.trade.getActiveTrade() };
    }

    // Accepting closes the deal on the spot: first player to accept trades
    if (response === 'accept') {
      const proposer = this.players[active.proposerId];
      const { offering, requesting } = active;
      if (!proposer || !this.trade.executeTrade(proposer, player)) {
        return { success: false, error: 'Uno de los jugadores ya no tiene esos recursos' };
      }
      this.lastCompletedTrade = {
        id: active.id,
        proposerId: proposer.id,
        accepterId: playerId,
        offering,
        requesting,
      };
      this.log(`${proposer.name} comerció con ${player.name}`);
      return { success: true, executed: true };
    }

    const trade = this.trade.respondToTrade(playerId, response, counterOffer);
    const verb = response === 'accept' ? 'aceptó' : response === 'reject' ? 'rechazó' : 'contraofertó';
    this.log(`${player.name} ${verb} el comercio`);

    return { success: true, trade };
  }

  acceptTrade(proposerId, accepterId) {
    const active = this.trade.getActiveTrade();
    if (this.phase !== PHASE.MAIN || !active || active.status !== 'pending') {
      return { success: false, error: 'No hay ninguna oferta activa' };
    }
    if (active.proposerId !== proposerId || proposerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'Solo quien propuso la oferta puede cerrarla' };
    }
    const response = active.responses[accepterId];
    if (accepterId === proposerId || (response !== 'accept' && response !== 'counter')) {
      return { success: false, error: 'Ese jugador no aceptó la oferta' };
    }

    const proposer = this.players[proposerId];
    const accepter = this.players[accepterId];
    if (!proposer || !accepter) return { success: false, error: 'Jugador no válido' };
    const terms = response === 'counter' ? active.counterOffers[accepterId] : null;
    const tradeId = active.id;
    const result = this.trade.executeTrade(proposer, accepter, terms);

    if (result) {
      const done = terms || { offering: active.offering, requesting: active.requesting };
      this.lastCompletedTrade = { id: tradeId, proposerId, accepterId, ...done, viaCounter: !!terms };
      this.log(`${proposer.name} comerció con ${accepter.name}${terms ? ' (contraoferta)' : ''}`);
      return { success: true };
    }

    return { success: false, error: 'Uno de los jugadores ya no tiene esos recursos' };
  }

  cancelTrade(playerId) {
    const active = this.trade.getActiveTrade();
    if (!active) return { success: true };
    if (active.proposerId !== playerId) {
      return { success: false, error: 'Solo quien propuso la oferta puede cancelarla' };
    }
    this.trade.cancelTrade();
    return { success: true };
  }

  // ─── End Turn ───
  // expectPhase (optional): the phase the client saw when the button was
  // pressed. A stale click (e.g. a second tap on «Terminar construcción» that
  // lands once the next turn has begun) is rejected instead of ending a turn.
  endTurn(playerId, expectPhase = null) {
    if (expectPhase && expectPhase !== this.phase) {
      return { success: false, error: 'La fase ya cambió; revisa el tablero' };
    }
    // During the special building phase "ending the turn" means passing
    if (this.phase === PHASE.SPECIAL_BUILD) {
      return this.passSpecialBuild(playerId);
    }
    if (playerId !== this.getCurrentPlayerId()) {
      return { success: false, error: 'No es tu turno' };
    }
    if (this.phase !== PHASE.MAIN) {
      return { success: false, error: 'Ahora no puedes pasar el turno' };
    }

    // Cancel any active trade
    this.trade.cancelTrade();

    // Reset per-turn state
    const player = this.getCurrentPlayer();
    player.devCardBoughtThisTurn = [];
    player.hasPlayedDevCardThisTurn = false;
    this.freeRoadsRemaining = 0;

    // 5–6 player extension: special building phase. Only the OTHER players
    // build, in turn order, and never the one whose turn comes next: that
    // player builds in their own turn right after, which always begins by
    // rolling the dice. Players who left or are offline are skipped.
    if (this.isExtended()) {
      this.specialBuildQueue = this._specialBuildOrder();
      if (this.specialBuildQueue.length > 0) {
        this.phase = PHASE.SPECIAL_BUILD;
        this.log('Fase especial de construcción: los demás ninjas pueden construir por orden.');
        this._nextSpecialBuilder();
        return { success: true, phase: this.phase, specialBuilderId: this.specialBuilderId };
      }
    }

    return this._startNextTurn();
  }

  // ─── Special Building Phase (5–6 player extension) ───
  passSpecialBuild(playerId) {
    if (this.phase !== PHASE.SPECIAL_BUILD) {
      return { success: false, error: 'No hay fase especial de construcción' };
    }
    if (playerId !== this.specialBuilderId) {
      return { success: false, error: 'No es tu turno de construcción' };
    }
    const player = this.players[playerId];
    // Cards bought now can be played from this player's next turn on
    player.devCardBoughtThisTurn = [];
    this.log(`${player.name} terminó su construcción especial`);

    if (this.specialBuildQueue.length > 0) {
      this._nextSpecialBuilder();
      return { success: true, phase: this.phase, specialBuilderId: this.specialBuilderId };
    }
    return this._startNextTurn();
  }

  // Players after the next one, ending with the one before the current player
  _specialBuildOrder() {
    const n = this.playerOrder.length;
    const order = [];
    for (let i = 2; i < n; i++) {
      const pid = this.playerOrder[(this.currentPlayerIndex + i) % n];
      const p = this.players[pid];
      if (p && !p.left && p.connected !== false) order.push(pid);
    }
    return order;
  }

  _nextSpecialBuilder() {
    this.specialBuilderId = this.specialBuildQueue.shift();
    this.log(`Construcción especial: turno de ${this.players[this.specialBuilderId].name}`);
  }

  _startNextTurn() {
    this.specialBuilderId = null;
    this.specialBuildQueue = [];

    // Advance to next player
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
    this.turnNumber++;
    this.phase = PHASE.ROLL_DICE;

    this.log(`Ronda ${this.turnNumber}: turno de ${this.getCurrentPlayer().name}. ¡A tirar los dados!`);

    // A player who reached 10 VP outside their turn wins as soon as their turn starts
    const winner = this._checkWin();
    if (winner) {
      return { success: true, nextPlayer: this.getCurrentPlayerId(), phase: this.phase, winner };
    }

    return {
      success: true,
      nextPlayer: this.getCurrentPlayerId(),
      phase: PHASE.ROLL_DICE,
      turnNumber: this.turnNumber,
    };
  }

  _setGameOver() {
    this.phase = PHASE.GAME_OVER;
    if (!this.endedAt) this.endedAt = Date.now();
  }

  // ─── End Game by Unanimous Vote ───
  voteEndGame(playerId, vote) {
    const player = this.players[playerId];
    if (!player) return { success: false, error: 'No estás en esta partida' };
    if (this.phase === PHASE.LOBBY || this.phase === PHASE.GAME_OVER) {
      return { success: false, error: 'La partida no está en curso' };
    }

    const had = this.endVotes.has(playerId);
    if (vote && !had) {
      this.endVotes.add(playerId);
      this.log(`${player.name} votó terminar la partida (${this.endVotes.size}/${this.activePlayerIds().length})`);
    } else if (!vote && had) {
      this.endVotes.delete(playerId);
      this.log(`${player.name} retiró su voto para terminar la partida`);
    }

    this._checkEndVotes();

    return { success: true, ended: this.endedByAgreement };
  }

  // Everyone still in the game (players who left don't count) agreed to end
  _checkEndVotes() {
    if (this.phase === PHASE.LOBBY || this.phase === PHASE.GAME_OVER) return;
    const active = this.activePlayerIds();
    if (this.endVotes.size > 0 && active.length > 0 && active.every((pid) => this.endVotes.has(pid))) {
      this._setGameOver();
      this.endedByAgreement = true;
      this.freeRoadsRemaining = 0;
      this.specialBuilderId = null;
      this.specialBuildQueue = [];
      this.trade.cancelTrade();
      this.log('La partida terminó por acuerdo unánime.');
    }
  }

  // ─── Turn time limit ───
  // Identifies "who must act now". The socket layer restarts the countdown
  // whenever this changes and ignores expiries whose key is no longer current.
  // null = nothing to time (lobby, game over).
  getTimerKey() {
    switch (this.phase) {
      case PHASE.SETUP_FORWARD:
      case PHASE.SETUP_REVERSE:
        return `setup:${this.phase}:${this.currentPlayerIndex}`;
      case PHASE.ROBBER_DISCARD:
        return `discard:${this.turnNumber}`;
      case PHASE.SPECIAL_BUILD:
        return `special:${this.turnNumber}:${this.specialBuilderId}`;
      case PHASE.ROLL_DICE:
      case PHASE.MAIN:
      case PHASE.ROBBER_MOVE:
      case PHASE.ROBBER_STEAL:
        return `turn:${this.turnNumber}:${this.getCurrentPlayerId()}`;
      default:
        return null;
    }
  }

  // Time ran out: act minimally on behalf of whoever had to act, so the game
  // keeps moving (also covers disconnected players).
  // silent: acting for a player who left (no "time ran out" lines in the log)
  handleTimeout({ silent = false } = {}) {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const note = (msg) => { if (!silent) this.log(msg); };

    switch (this.phase) {
      case PHASE.SETUP_FORWARD:
      case PHASE.SETUP_REVERSE: {
        const pid = this.getCurrentPlayerId();
        const player = this.players[pid];
        note(`Se acabó el tiempo de ${player.name}: se coloca al azar.`);
        if (player.lastSetupVertex === null) {
          const spots = this.getValidPlacements(pid).validSettlements;
          if (spots.length === 0) return { success: false, error: 'No hay sitio válido para un poblado' };
          this.setupPlaceSettlement(pid, pick(spots));
        }
        const roads = this.getValidPlacements(pid).validRoads;
        if (roads.length === 0) return { success: false, error: 'No hay sitio válido para un camino' };
        this.setupPlaceRoad(pid, pick(roads));
        return { success: true };
      }

      case PHASE.ROBBER_DISCARD: {
        for (const pid of this.robber.playersWhoMustDiscard) {
          if (this.robber.discardedPlayers.has(pid) || this.phase !== PHASE.ROBBER_DISCARD) continue;
          const player = this.players[pid];
          note(`Se acabó el tiempo de ${player.name}: descarta al azar.`);
          this.discardCards(pid, this._randomCards(player, Math.floor(player.totalResources() / 2)));
        }
        return { success: true };
      }

      case PHASE.SPECIAL_BUILD: {
        const pid = this.specialBuilderId;
        note(`Se acabó el tiempo de ${this.players[pid]?.name || 'un ninja'} (construcción especial).`);
        return this.passSpecialBuild(pid);
      }

      case PHASE.ROLL_DICE:
      case PHASE.MAIN:
      case PHASE.ROBBER_MOVE:
      case PHASE.ROBBER_STEAL: {
        const pid = this.getCurrentPlayerId();
        note(`Se acabó el tiempo de ${this.players[pid].name}.`);
        // Remembered so that, if this turn needs the player again later (e.g. the
        // robber after others discard), they only get a short grace period
        this.timedOutKey = this.getTimerKey();
        // Free roads from Road Building are forfeited
        this.freeRoadsRemaining = 0;
        // A few steps at most: roll → (robber → steal) → end turn
        for (let step = 0; step < 6; step++) {
          if (this.getCurrentPlayerId() !== pid) break;
          if (this.phase === PHASE.ROLL_DICE) {
            this.rollDice(pid);
          } else if (this.phase === PHASE.ROBBER_MOVE) {
            const hexes = Object.keys(this.board.hexes).filter((h) => h !== this.board.robberHex);
            this.moveRobber(pid, pick(hexes));
          } else if (this.phase === PHASE.ROBBER_STEAL) {
            this.stealCard(pid, pick(this.stealTargets));
          } else if (this.phase === PHASE.MAIN) {
            this.trade.cancelTrade();
            this.endTurn(pid);
            break;
          } else {
            // Discard phase (others must discard first) or game over: stop here
            break;
          }
        }
        return { success: true };
      }

      default:
        return { success: false, error: 'No hay nada pendiente' };
    }
  }

  // `count` random cards from a player's hand, as { resource: amount }
  _randomCards(player, count) {
    const pool = [];
    for (const [res, amount] of Object.entries(player.resources)) {
      for (let i = 0; i < amount; i++) pool.push(res);
    }
    const cards = {};
    for (let i = 0; i < count && pool.length > 0; i++) {
      const [res] = pool.splice(Math.floor(Math.random() * pool.length), 1);
      cards[res] = (cards[res] || 0) + 1;
    }
    return cards;
  }

  // ─── Win Check ───
  _checkWin() {
    if (this.winner) return this.winner;
    // Nobody wins during a special build: a player who reaches 10 VP then
    // wins as soon as their own turn starts.
    if (this.phase === PHASE.SPECIAL_BUILD) return null;
    const winner = this.scoring.checkWinner(this.players, this.getCurrentPlayerId(), this.vpToWin);
    if (winner) {
      this._setGameOver();
      this.freeRoadsRemaining = 0;
      this.trade.cancelTrade();
      this.winner = {
        id: winner.id,
        name: winner.name,
        vp: winner.calculateVP(),
      };
      this.log(`🏆 ¡${winner.name} gana con ${winner.calculateVP()} puntos de victoria!`);
      return this.winner;
    }
    return null;
  }

  // ─── Get valid placements for current player ───
  getValidPlacements(playerId) {
    const isSetup = this.phase === PHASE.SETUP_FORWARD || this.phase === PHASE.SETUP_REVERSE;
    const player = this.players[playerId];
    // Main phase, or this player's own special build
    const canBuild = this.phase === PHASE.MAIN ||
      (this.phase === PHASE.SPECIAL_BUILD && playerId === this.specialBuilderId);

    const validSettlements = [];
    const validCities = [];
    const validRoads = [];

    // Settlements
    for (const vertexId of Object.keys(this.board.vertices)) {
      if (isSetup && player.lastSetupVertex === null) {
        if (this.board.canPlaceSettlement(vertexId, playerId, true)) {
          validSettlements.push(vertexId);
        }
      } else if (!isSetup && canBuild) {
        if (this.board.canPlaceSettlement(vertexId, playerId)) {
          validSettlements.push(vertexId);
        }
      }
    }

    // Cities
    if (canBuild) {
      for (const vertexId of Object.keys(this.board.vertices)) {
        if (this.board.canUpgradeToCity(vertexId, playerId)) {
          validCities.push(vertexId);
        }
      }
    }

    // Roads
    for (const edgeId of Object.keys(this.board.edges)) {
      if (isSetup && player.lastSetupVertex !== null) {
        if (this.board.canPlaceRoad(edgeId, playerId, true, player.lastSetupVertex)) {
          validRoads.push(edgeId);
        }
      } else if (!isSetup && (canBuild || (this.phase === PHASE.ROLL_DICE && this.freeRoadsRemaining > 0))) {
        if (this.board.canPlaceRoad(edgeId, playerId)) {
          validRoads.push(edgeId);
        }
      }
    }

    return { validSettlements, validCities, validRoads };
  }

  // ─── Get all port ratios for a player ───
  getPlayerPortRatios(playerId) {
    const ratios = {};
    for (const res of Object.values(RESOURCE)) {
      ratios[res] = this.trade.getBestRatio(this.players[playerId], res, this.board);
    }
    return ratios;
  }

  // ─── Logging ───
  log(message) {
    const entry = {
      timestamp: Date.now(),
      message,
      turn: this.turnNumber,
    };
    this.gameLog.push(entry);
    // Keep last 100 entries
    if (this.gameLog.length > 100) {
      this.gameLog.shift();
    }
  }

  _formatResources(res) {
    return Object.entries(res)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${RESOURCE_ES[k] || k}`)
      .join(', ') || 'nada';
  }

  // ─── Serialize Full State for Client ───
  serialize(forPlayerId = null) {
    const state = {
      roomId: this.roomId,
      phase: this.phase,
      turnNumber: this.turnNumber,
      currentPlayerId: this.getCurrentPlayerId(),
      lastDiceRoll: this.lastDiceRoll,
      lastProduction: this.lastProduction
        ? {
            id: this.lastProduction.id,
            source: this.lastProduction.source,
            roll: this.lastProduction.roll,
            mine: this.lastProduction.byPlayer[forPlayerId] || null,
          }
        : null,
      lastCompletedTrade: this.lastCompletedTrade,
      board: this.board ? this.board.serialize() : null,
      players: {},
      playerOrder: this.playerOrder,
      scoring: { ...this.scoring.serialize(), winnerId: this.winner ? this.winner.id : null },
      winner: this.winner,
      endVotes: [...this.endVotes],
      endedByAgreement: this.endedByAgreement,
      boardType: this.boardType,
      bank: this.board ? Object.fromEntries(VALID_RESOURCES.map((r) => [r, this.bankCount(r)])) : null,
      gameLog: this.gameLog.slice(-20),
      devCardsRemaining: this.devCards ? this.devCards.cardsRemaining() : 0,
      activeTrade: this.trade.getActiveTrade(),
      freeRoadsRemaining: this.freeRoadsRemaining,
      specialBuilderId: this.specialBuilderId,
      specialBuildQueue: this.specialBuildQueue,
      vpToWin: this.vpToWin,
      turnTimeLimit: this.turnTimeLimit,
      turnDeadline: this.turnDeadline,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      lastSteal: this._serializeSteal(forPlayerId),
      recentEvents: this.recentEvents,
      serverNow: Date.now(),
    };

    // Serialize each player (owner sees private data)
    for (const [pid, player] of Object.entries(this.players)) {
      state.players[pid] = player.serialize(pid === forPlayerId, this.phase === PHASE.GAME_OVER);
    }

    // Add valid placements for the requesting player
    if (forPlayerId && this.players[forPlayerId] && this.board) {
      state.validPlacements = this.getValidPlacements(forPlayerId);
      state.portRatios = this.getPlayerPortRatios(forPlayerId);
    }

    if (this.phase === PHASE.ROBBER_STEAL) {
      state.stealTargets = this.stealTargets;
    }

    // Add robber discard info
    if (this.phase === PHASE.ROBBER_DISCARD) {
      state.mustDiscard = this.robber.playersWhoMustDiscard;
      state.discardedPlayers = [...this.robber.discardedPlayers];
    }

    return state;
  }
}
