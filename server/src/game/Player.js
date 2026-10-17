import { RESOURCE, MAX_ROADS, MAX_SETTLEMENTS, MAX_CITIES, sanitizeAvatarId } from './constants.js';

export class Player {
  constructor(id, name, color, index, avatarId = 0) {
    this.id = id;
    this.name = name;
    this.avatarId = sanitizeAvatarId(avatarId); // profile picture (index, drawn by the client)
    this.color = color;
    this.index = index;
    this.connected = true;
    this.left = false;    // left the game in progress (seat kept, played by the server)
    this.kicked = false;  // removed by the host

    // Resources
    this.resources = {
      [RESOURCE.WOOD]: 0,
      [RESOURCE.BRICK]: 0,
      [RESOURCE.SHEEP]: 0,
      [RESOURCE.WHEAT]: 0,
      [RESOURCE.ORE]: 0,
    };

    // Development cards
    this.devCards = [];         // cards in hand
    this.playedDevCards = [];   // cards played (visible)
    this.devCardBoughtThisTurn = []; // can't play same turn bought
    this.hasPlayedDevCardThisTurn = false;

    // Build counts
    this.roadsBuilt = 0;
    this.settlementsBuilt = 0;
    this.citiesBuilt = 0;

    // Achievements
    this.knightsPlayed = 0;
    this.hasLongestRoad = false;
    this.hasLargestArmy = false;

    // VP
    this.publicVP = 0;   // visible VP (settlements, cities, achievements)
    this.hiddenVP = 0;   // VP cards (hidden until game end)

    // Setup tracking
    this.setupSettlementsPlaced = 0;
    this.lastSetupVertex = null; // track last placed settlement vertex for road placement
  }

  // ─── Resource Management ───
  totalResources() {
    return Object.values(this.resources).reduce((a, b) => a + b, 0);
  }

  hasResources(cost) {
    for (const [res, amount] of Object.entries(cost)) {
      if ((this.resources[res] || 0) < amount) return false;
    }
    return true;
  }

  deductResources(cost) {
    for (const [res, amount] of Object.entries(cost)) {
      this.resources[res] -= amount;
    }
  }

  addResources(resources) {
    for (const [res, amount] of Object.entries(resources)) {
      this.resources[res] = (this.resources[res] || 0) + amount;
    }
  }

  addResource(resource, amount = 1) {
    this.resources[resource] = (this.resources[resource] || 0) + amount;
  }

  removeResource(resource, amount = 1) {
    this.resources[resource] = Math.max(0, (this.resources[resource] || 0) - amount);
  }

  // Number of cards of a type that may be played this turn (not bought this turn)
  playableDevCardCount(cardType) {
    const inHand = this.devCards.filter((c) => c === cardType).length;
    const boughtNow = this.devCardBoughtThisTurn.filter((c) => c === cardType).length;
    return inHand - boughtNow;
  }

  // ─── Build Capacity Checks ───
  canBuildMoreRoads() {
    return this.roadsBuilt < MAX_ROADS;
  }

  canBuildMoreSettlements() {
    return this.settlementsBuilt < MAX_SETTLEMENTS;
  }

  canBuildMoreCities() {
    return this.citiesBuilt < MAX_CITIES;
  }

  // ─── VP Calculation ───
  calculateVP() {
    this.publicVP = this.settlementsBuilt + (this.citiesBuilt * 2)
      + (this.hasLongestRoad ? 2 : 0)
      + (this.hasLargestArmy ? 2 : 0);
    return this.publicVP + this.hiddenVP;
  }

  // ─── Serialize for client ───
  serialize(isOwner = false, revealAll = false) {
    // Always recompute so publicVP is never stale for other viewers
    this.calculateVP();
    const base = {
      id: this.id,
      name: this.name,
      avatarId: this.avatarId,
      color: this.color,
      index: this.index,
      connected: this.connected,
      left: this.left,
      roadsBuilt: this.roadsBuilt,
      settlementsBuilt: this.settlementsBuilt,
      citiesBuilt: this.citiesBuilt,
      knightsPlayed: this.knightsPlayed,
      hasLongestRoad: this.hasLongestRoad,
      hasLargestArmy: this.hasLargestArmy,
      publicVP: this.publicVP,
      totalResources: this.totalResources(),
      devCardCount: this.devCards.length,
      playedDevCards: this.playedDevCards,
    };

    // Only show resources and dev cards to the owner
    if (isOwner) {
      base.resources = { ...this.resources };
      base.devCards = [...this.devCards];
      base.totalVP = this.calculateVP();
      base.devCardBoughtThisTurn = [...this.devCardBoughtThisTurn];
      base.hasPlayedDevCardThisTurn = this.hasPlayedDevCardThisTurn;
    }

    // At game end, hidden VP cards are revealed to everyone
    if (isOwner || revealAll) {
      base.hiddenVP = this.hiddenVP;
    }
    if (revealAll) {
      base.totalVP = this.calculateVP();
    }

    return base;
  }
}
