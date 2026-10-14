import { DEV_CARD, DEV_CARD_DECK, DEV_CARD_DECK_EXTENDED, BUILD_COSTS, RESOURCE } from './constants.js';

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class DevCards {
  constructor(boardType = 'standard') {
    this.deck = shuffle([...(boardType === 'extended' ? DEV_CARD_DECK_EXTENDED : DEV_CARD_DECK)]);
  }

  cardsRemaining() {
    return this.deck.length;
  }

  // ─── Buy a development card ───
  buyCard(player) {
    if (!player.hasResources(BUILD_COSTS.devCard)) {
      return { success: false, error: 'No tienes recursos suficientes' };
    }
    if (this.deck.length === 0) {
      return { success: false, error: 'No quedan cartas de desarrollo' };
    }

    player.deductResources(BUILD_COSTS.devCard);
    const card = this.deck.pop();
    player.devCards.push(card);
    player.devCardBoughtThisTurn.push(card);

    // If it's a VP card, add hidden VP immediately
    if (card === DEV_CARD.VICTORY_POINT) {
      player.hiddenVP++;
    }

    return { success: true, card };
  }

  // ─── Play a development card ───
  canPlayCard(player, cardType) {
    // Can only play one dev card per turn (except VP cards, which don't need to be "played")
    if (player.hasPlayedDevCardThisTurn && cardType !== DEV_CARD.VICTORY_POINT) {
      return { canPlay: false, error: 'Ya jugaste una carta este turno' };
    }

    // Must have the card
    const idx = player.devCards.indexOf(cardType);
    if (idx === -1) {
      return { canPlay: false, error: 'No tienes esa carta' };
    }

    // Can't play a card bought this turn (older copies of the same type are fine)
    if (player.playableDevCardCount(cardType) <= 0) {
      return { canPlay: false, error: 'No puedes jugar una carta comprada en este turno' };
    }

    // VP cards are never "played" (they're revealed only at game end)
    if (cardType === DEV_CARD.VICTORY_POINT) {
      return { canPlay: false, error: 'Las cartas de Punto de Victoria se cuentan solas' };
    }

    return { canPlay: true };
  }

  // ─── Execute Knight ───
  playKnight(player) {
    const check = this.canPlayCard(player, DEV_CARD.KNIGHT);
    if (!check.canPlay) return { success: false, error: check.error };

    const idx = player.devCards.indexOf(DEV_CARD.KNIGHT);
    player.devCards.splice(idx, 1);
    player.playedDevCards.push(DEV_CARD.KNIGHT);
    player.knightsPlayed++;
    player.hasPlayedDevCardThisTurn = true;

    return { success: true, action: 'moveRobber' };
  }

  // ─── Execute Road Building (2 free roads) ───
  playRoadBuilding(player) {
    const check = this.canPlayCard(player, DEV_CARD.ROAD_BUILDING);
    if (!check.canPlay) return { success: false, error: check.error };

    const idx = player.devCards.indexOf(DEV_CARD.ROAD_BUILDING);
    player.devCards.splice(idx, 1);
    player.playedDevCards.push(DEV_CARD.ROAD_BUILDING);
    player.hasPlayedDevCardThisTurn = true;

    return { success: true, action: 'placeRoads', roadsToPlace: 2 };
  }

  // ─── Execute Year of Plenty (take 2 resources from bank) ───
  playYearOfPlenty(player, resource1, resource2) {
    const check = this.canPlayCard(player, DEV_CARD.YEAR_OF_PLENTY);
    if (!check.canPlay) return { success: false, error: check.error };

    const validResources = Object.values(RESOURCE);
    if (!validResources.includes(resource1) || !validResources.includes(resource2)) {
      return { success: false, error: 'Recurso no válido' };
    }

    const idx = player.devCards.indexOf(DEV_CARD.YEAR_OF_PLENTY);
    player.devCards.splice(idx, 1);
    player.playedDevCards.push(DEV_CARD.YEAR_OF_PLENTY);
    player.hasPlayedDevCardThisTurn = true;

    player.addResource(resource1);
    player.addResource(resource2);

    return { success: true, resources: [resource1, resource2] };
  }

  // ─── Execute Monopoly (take all of one resource from all players) ───
  playMonopoly(player, resource, allPlayers) {
    const check = this.canPlayCard(player, DEV_CARD.MONOPOLY);
    if (!check.canPlay) return { success: false, error: check.error };

    if (!Object.values(RESOURCE).includes(resource)) {
      return { success: false, error: 'Recurso no válido' };
    }

    const idx = player.devCards.indexOf(DEV_CARD.MONOPOLY);
    player.devCards.splice(idx, 1);
    player.playedDevCards.push(DEV_CARD.MONOPOLY);
    player.hasPlayedDevCardThisTurn = true;

    let totalStolen = 0;
    const stolenFrom = {};

    for (const other of allPlayers) {
      if (other.id === player.id) continue;
      const amount = other.resources[resource] || 0;
      if (amount > 0) {
        other.resources[resource] = 0;
        totalStolen += amount;
        stolenFrom[other.id] = amount;
      }
    }

    player.addResource(resource, totalStolen);

    return { success: true, resource, totalStolen, stolenFrom };
  }
}
