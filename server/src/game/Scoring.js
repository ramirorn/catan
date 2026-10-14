import { MIN_LONGEST_ROAD, MIN_LARGEST_ARMY, VP_TO_WIN } from './constants.js';

export class Scoring {
  constructor() {
    this.longestRoadHolder = null;   // playerId
    this.longestRoadLength = 0;
    this.largestArmyHolder = null;   // playerId
    this.largestArmySize = 0;
  }

  // ─── Update longest road ───
  // Official rules: needs >= 5 segments; the holder keeps the card on a tie.
  // If the holder's road is broken and is no longer the longest, the card goes
  // to the single longest road (>= 5); if several players tie, nobody gets it.
  updateLongestRoad(players, board) {
    const lengths = {};
    for (const player of Object.values(players)) {
      lengths[player.id] = board.longestRoad(player.id);
    }

    let best = 0;
    for (const len of Object.values(lengths)) best = Math.max(best, len);
    const leaders = Object.keys(lengths).filter((pid) => lengths[pid] === best);

    let newHolder = null;
    const holder = this.longestRoadHolder;
    if (holder && players[holder] && lengths[holder] >= MIN_LONGEST_ROAD && lengths[holder] === best) {
      newHolder = holder; // holder still (co-)longest → keeps it
    } else if (best >= MIN_LONGEST_ROAD && leaders.length === 1) {
      newHolder = leaders[0];
    }

    for (const player of Object.values(players)) {
      player.hasLongestRoad = player.id === newHolder;
    }
    this.longestRoadHolder = newHolder;
    this.longestRoadLength = newHolder ? lengths[newHolder] : 0;

    return { holder: this.longestRoadHolder, length: this.longestRoadLength };
  }

  // ─── Update largest army ───
  updateLargestArmy(players) {
    let maxArmy = this.largestArmySize;
    let maxPlayer = this.largestArmyHolder;
    let changed = false;

    for (const player of Object.values(players)) {
      if (player.knightsPlayed >= MIN_LARGEST_ARMY && player.knightsPlayed > maxArmy) {
        maxArmy = player.knightsPlayed;
        maxPlayer = player.id;
        changed = true;
      }
    }

    if (changed) {
      // Remove from previous holder
      if (this.largestArmyHolder && players[this.largestArmyHolder]) {
        players[this.largestArmyHolder].hasLargestArmy = false;
      }

      this.largestArmyHolder = maxPlayer;
      this.largestArmySize = maxArmy;

      if (maxPlayer && players[maxPlayer]) {
        players[maxPlayer].hasLargestArmy = true;
      }
    }

    return { holder: this.largestArmyHolder, size: this.largestArmySize };
  }

  // ─── Check win condition (only the given player can win, on their own turn) ───
  checkWinner(players, currentPlayerId, vpToWin = VP_TO_WIN) {
    const player = players[currentPlayerId];
    if (player && player.calculateVP() >= vpToWin) return player;
    return null;
  }

  // ─── Get scoreboard ───
  getScoreboard(players) {
    return Object.values(players).map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      publicVP: p.publicVP,
      settlements: p.settlementsBuilt,
      cities: p.citiesBuilt,
      longestRoad: p.hasLongestRoad,
      largestArmy: p.hasLargestArmy,
      knightsPlayed: p.knightsPlayed,
    }));
  }

  serialize() {
    return {
      longestRoadHolder: this.longestRoadHolder,
      longestRoadLength: this.longestRoadLength,
      largestArmyHolder: this.largestArmyHolder,
      largestArmySize: this.largestArmySize,
    };
  }
}
