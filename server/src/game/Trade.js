import { RESOURCE } from './constants.js';

export class Trade {
  constructor() {
    this.activeTrade = null; // current trade proposal
    this.tradeCounter = 0;
  }

  // ─── Bank Trade (4:1, 3:1, 2:1) ───
  canBankTrade(player, give, receive, board) {
    // Determine best ratio for the given resource
    const ratio = this.getBestRatio(player, give, board);
    return (player.resources[give] || 0) >= ratio;
  }

  getBestRatio(player, resource, board) {
    // Check if player has a specific 2:1 port for this resource
    for (const vertex of Object.values(board.vertices)) {
      if (vertex.building && vertex.building.playerId === player.id && vertex.port) {
        if (vertex.port.type === resource && vertex.port.ratio === 2) return 2;
      }
    }

    // Check if player has a generic 3:1 port
    for (const vertex of Object.values(board.vertices)) {
      if (vertex.building && vertex.building.playerId === player.id && vertex.port) {
        if (vertex.port.type === 'generic' && vertex.port.ratio === 3) return 3;
      }
    }

    // Default 4:1
    return 4;
  }

  executeBankTrade(player, give, receive, board) {
    const ratio = this.getBestRatio(player, give, board);
    if ((player.resources[give] || 0) < ratio) return false;

    player.resources[give] -= ratio;
    player.resources[receive] = (player.resources[receive] || 0) + 1;
    return true;
  }

  // ─── Player-to-Player Trade ───
  proposeTrade(proposer, offering, requesting) {
    this.tradeCounter++;
    this.activeTrade = {
      id: this.tradeCounter,
      proposerId: proposer.id,
      proposerName: proposer.name,
      offering: { ...offering },     // { resource: amount, ... }
      requesting: { ...requesting }, // { resource: amount, ... }
      responses: {},                 // playerId → 'accept' | 'reject' | 'counter'
      counterOffers: {},             // playerId → { offering, requesting }
      status: 'pending',
    };
    return this.activeTrade;
  }

  respondToTrade(playerId, response, counterOffer = null) {
    if (!this.activeTrade || this.activeTrade.status !== 'pending') return null;

    this.activeTrade.responses[playerId] = response;

    if (response === 'counter' && counterOffer) {
      this.activeTrade.counterOffers[playerId] = counterOffer;
    }

    return this.activeTrade;
  }

  // Execute trade between proposer and accepter
  // `terms` (proposer's point of view) overrides the original offer, for counter-offers
  executeTrade(proposer, accepter, terms = null) {
    if (!this.activeTrade) return false;

    const { offering, requesting } = terms || this.activeTrade;

    // Verify both players have the resources
    if (!proposer.hasResources(offering)) return false;
    if (!accepter.hasResources(requesting)) return false;

    // Transfer: proposer gives offering, gets requesting
    proposer.deductResources(offering);
    accepter.addResources(offering);

    accepter.deductResources(requesting);
    proposer.addResources(requesting);

    this.activeTrade.status = 'completed';
    this.activeTrade = null; // trade is finished; clear it so it isn't shown as pending
    return true;
  }

  cancelTrade() {
    if (this.activeTrade) {
      this.activeTrade.status = 'cancelled';
    }
    this.activeTrade = null;
  }

  getActiveTrade() {
    return this.activeTrade;
  }
}
