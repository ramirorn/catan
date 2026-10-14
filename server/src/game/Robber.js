import { ROBBER_HAND_LIMIT } from './constants.js';

const RESOURCE_ES = { wood: 'madera', brick: 'arcilla', sheep: 'oveja', wheat: 'trigo', ore: 'mineral' };

export class Robber {
  constructor() {
    this.playersWhoMustDiscard = []; // player IDs that need to discard
    this.discardedPlayers = new Set(); // players who have already discarded
  }

  // ─── Check who must discard (when 7 is rolled) ───
  checkDiscards(players) {
    this.playersWhoMustDiscard = [];
    this.discardedPlayers = new Set();

    for (const player of Object.values(players)) {
      if (player.totalResources() > ROBBER_HAND_LIMIT) {
        this.playersWhoMustDiscard.push(player.id);
      }
    }

    return this.playersWhoMustDiscard;
  }

  // ─── Process a player's discard ───
  processDiscard(player, cardsToDiscard) {
    if (!player || !this.playersWhoMustDiscard.includes(player.id)) {
      return { success: false, error: 'No tienes que descartar' };
    }
    if (this.discardedPlayers.has(player.id)) {
      return { success: false, error: 'Ya descartaste' };
    }
    if (!cardsToDiscard || typeof cardsToDiscard !== 'object') {
      return { success: false, error: 'Descarte no válido' };
    }
    for (const [res, amount] of Object.entries(cardsToDiscard)) {
      if (!(res in player.resources) || !Number.isInteger(amount) || amount < 0) {
        return { success: false, error: 'Descarte no válido' };
      }
    }

    const mustDiscard = Math.floor(player.totalResources() / 2);
    const totalDiscarding = Object.values(cardsToDiscard).reduce((a, b) => a + b, 0);

    if (totalDiscarding !== mustDiscard) {
      return { success: false, error: `Debes descartar exactamente ${mustDiscard} cartas (elegiste ${totalDiscarding})` };
    }

    // Verify player has the cards
    for (const [res, amount] of Object.entries(cardsToDiscard)) {
      if ((player.resources[res] || 0) < amount) {
        return { success: false, error: `No tienes suficiente ${RESOURCE_ES[res] || res} para descartar` };
      }
    }

    // Perform discard
    for (const [res, amount] of Object.entries(cardsToDiscard)) {
      player.resources[res] -= amount;
    }

    this.discardedPlayers.add(player.id);

    return {
      success: true,
      allDiscarded: this.allDiscardsComplete(),
    };
  }

  allDiscardsComplete() {
    return this.playersWhoMustDiscard.every((id) => this.discardedPlayers.has(id));
  }

  // ─── Steal a random card from a player ───
  stealCard(thief, victim) {
    if (victim.totalResources() === 0) {
      return { success: true, resource: null, message: 'Victim has no cards' };
    }

    // Build a pool of all victim's cards
    const pool = [];
    for (const [res, amount] of Object.entries(victim.resources)) {
      for (let i = 0; i < amount; i++) {
        pool.push(res);
      }
    }

    // Pick random card
    const randomIndex = Math.floor(Math.random() * pool.length);
    const stolenResource = pool[randomIndex];

    victim.resources[stolenResource]--;
    thief.addResource(stolenResource);

    return { success: true, resource: stolenResource };
  }

  // ─── Get valid hexes for robber placement ───
  getValidRobberHexes(board) {
    return Object.keys(board.hexes).filter((key) => key !== board.robberHex);
  }

  reset() {
    this.playersWhoMustDiscard = [];
    this.discardedPlayers = new Set();
  }
}
