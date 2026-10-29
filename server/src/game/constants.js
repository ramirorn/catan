// ─── Resource & Terrain Types ───
export const RESOURCE = {
  WOOD: 'wood',
  BRICK: 'brick',
  SHEEP: 'sheep',
  WHEAT: 'wheat',
  ORE: 'ore',
};

export const TERRAIN = {
  FOREST: 'forest',
  HILLS: 'hills',
  PASTURE: 'pasture',
  FIELDS: 'fields',
  MOUNTAINS: 'mountains',
  DESERT: 'desert',
};

export const TERRAIN_TO_RESOURCE = {
  [TERRAIN.FOREST]: RESOURCE.WOOD,
  [TERRAIN.HILLS]: RESOURCE.BRICK,
  [TERRAIN.PASTURE]: RESOURCE.SHEEP,
  [TERRAIN.FIELDS]: RESOURCE.WHEAT,
  [TERRAIN.MOUNTAINS]: RESOURCE.ORE,
  [TERRAIN.DESERT]: null,
};

// ─── Board Configurations ───
export const BOARD_CONFIGS = {
  standard: {
    radius: 2,
    terrains: [
      TERRAIN.FOREST, TERRAIN.FOREST, TERRAIN.FOREST, TERRAIN.FOREST,
      TERRAIN.PASTURE, TERRAIN.PASTURE, TERRAIN.PASTURE, TERRAIN.PASTURE,
      TERRAIN.FIELDS, TERRAIN.FIELDS, TERRAIN.FIELDS, TERRAIN.FIELDS,
      TERRAIN.HILLS, TERRAIN.HILLS, TERRAIN.HILLS,
      TERRAIN.MOUNTAINS, TERRAIN.MOUNTAINS, TERRAIN.MOUNTAINS,
      TERRAIN.DESERT,
    ],
    numberTokens: [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12],
    ports: [
      { type: 'generic', ratio: 3 },
      { type: 'generic', ratio: 3 },
      { type: 'generic', ratio: 3 },
      { type: 'generic', ratio: 3 },
      { type: RESOURCE.BRICK, ratio: 2 },
      { type: RESOURCE.WOOD, ratio: 2 },
      { type: RESOURCE.ORE, ratio: 2 },
      { type: RESOURCE.SHEEP, ratio: 2 },
      { type: RESOURCE.WHEAT, ratio: 2 },
    ],
    minPlayers: 2,
    maxPlayers: 4,
  },
  extended: {
    radius: 3,
    terrains: [
      TERRAIN.FOREST, TERRAIN.FOREST, TERRAIN.FOREST, TERRAIN.FOREST, TERRAIN.FOREST, TERRAIN.FOREST,
      TERRAIN.PASTURE, TERRAIN.PASTURE, TERRAIN.PASTURE, TERRAIN.PASTURE, TERRAIN.PASTURE, TERRAIN.PASTURE,
      TERRAIN.FIELDS, TERRAIN.FIELDS, TERRAIN.FIELDS, TERRAIN.FIELDS, TERRAIN.FIELDS, TERRAIN.FIELDS,
      TERRAIN.HILLS, TERRAIN.HILLS, TERRAIN.HILLS, TERRAIN.HILLS, TERRAIN.HILLS,
      TERRAIN.MOUNTAINS, TERRAIN.MOUNTAINS, TERRAIN.MOUNTAINS, TERRAIN.MOUNTAINS, TERRAIN.MOUNTAINS,
      TERRAIN.DESERT, TERRAIN.DESERT,
    ],
    numberTokens: [
      2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6,
      8, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12,
    ],
    ports: [
      { type: 'generic', ratio: 3 },
      { type: 'generic', ratio: 3 },
      { type: 'generic', ratio: 3 },
      { type: 'generic', ratio: 3 },
      { type: 'generic', ratio: 3 },
      { type: RESOURCE.BRICK, ratio: 2 },
      { type: RESOURCE.WOOD, ratio: 2 },
      { type: RESOURCE.ORE, ratio: 2 },
      { type: RESOURCE.SHEEP, ratio: 2 },
      { type: RESOURCE.WHEAT, ratio: 2 },
      { type: RESOURCE.WHEAT, ratio: 2 },
    ],
    minPlayers: 2,
    maxPlayers: 6,
  },
};

// ─── Build Costs ───
export const BUILD_COSTS = {
  road: { [RESOURCE.WOOD]: 1, [RESOURCE.BRICK]: 1 },
  settlement: { [RESOURCE.WOOD]: 1, [RESOURCE.BRICK]: 1, [RESOURCE.SHEEP]: 1, [RESOURCE.WHEAT]: 1 },
  city: { [RESOURCE.WHEAT]: 2, [RESOURCE.ORE]: 3 },
  devCard: { [RESOURCE.SHEEP]: 1, [RESOURCE.WHEAT]: 1, [RESOURCE.ORE]: 1 },
};

// ─── Development Cards ───
export const DEV_CARD = {
  KNIGHT: 'knight',
  ROAD_BUILDING: 'roadBuilding',
  YEAR_OF_PLENTY: 'yearOfPlenty',
  MONOPOLY: 'monopoly',
  VICTORY_POINT: 'victoryPoint',
};

export const DEV_CARD_DECK = [
  ...Array(14).fill(DEV_CARD.KNIGHT),
  ...Array(2).fill(DEV_CARD.ROAD_BUILDING),
  ...Array(2).fill(DEV_CARD.YEAR_OF_PLENTY),
  ...Array(2).fill(DEV_CARD.MONOPOLY),
  ...Array(5).fill(DEV_CARD.VICTORY_POINT),
];

// 5–6 player extension: 34 cards
export const DEV_CARD_DECK_EXTENDED = [
  ...Array(20).fill(DEV_CARD.KNIGHT),
  ...Array(3).fill(DEV_CARD.ROAD_BUILDING),
  ...Array(3).fill(DEV_CARD.YEAR_OF_PLENTY),
  ...Array(3).fill(DEV_CARD.MONOPOLY),
  ...Array(5).fill(DEV_CARD.VICTORY_POINT),
];

// ─── Game Phases ───
export const PHASE = {
  LOBBY: 'lobby',
  SETUP_FORWARD: 'setupForward',
  SETUP_REVERSE: 'setupReverse',
  ROLL_DICE: 'rollDice',
  ROBBER_DISCARD: 'robberDiscard',
  ROBBER_MOVE: 'robberMove',
  ROBBER_STEAL: 'robberSteal',
  MAIN: 'main',
  // 5–6 player extension: after a turn ends, the other players may build in order
  GAME_OVER: 'gameOver',
};

// ─── Player Colors ───
export const PLAYER_COLORS = [
  '#e74c3c', // red
  '#3498db', // blue
  '#f39c12', // orange
  '#2ecc71', // green
  '#9b59b6', // purple
  '#1abc9c', // teal
];
// Seats of admin accounts are gold (never one of the colours above)
export const GOLD_COLOR = '#d4af37';

// ─── Profile avatars ───
// The client draws them (inline SVG); the server only stores the index.
export const AVATAR_COUNT = 12;
export function sanitizeAvatarId(value) {
  return Number.isInteger(value) && value >= 0 && value < AVATAR_COUNT ? value : 0;
}

// ─── Limits ───
export const MAX_ROADS = 15;
export const MAX_SETTLEMENTS = 5;
export const MAX_CITIES = 4;
export const VP_TO_WIN = 10; // default victory points target
// Room settings the host can choose before starting
export const VP_TO_WIN_OPTIONS = [8, 10, 12, 14, 16];
export const TURN_TIME_OPTIONS = [0, 60, 90, 120, 180]; // seconds per turn (0 = no limit)
export const ROBBER_HAND_LIMIT = 7;
// «Pacto de paz» house rule: the robber mover may offer one pact per robber move
export const PEACE_PACT_MS = 20000;      // time the target has to answer
export const PEACE_PACT_MAX_CARDS = 2;   // cards the mover may ask for
export const MIN_LONGEST_ROAD = 5;
export const MIN_LARGEST_ARMY = 3;
export const BANK_RESOURCE_COUNT = 19; // cards of each resource in the bank
export const BANK_RESOURCE_COUNT_EXTENDED = 24; // 5–6 player extension

// ─── Hex Math Constants ───
export const SQRT3 = Math.sqrt(3);
export const HEX_SIZE = 60;

// Pointy-top hex corner offsets (unit size), clockwise from top
export const HEX_CORNER_OFFSETS = [
  { x: 0, y: -1 },
  { x: SQRT3 / 2, y: -0.5 },
  { x: SQRT3 / 2, y: 0.5 },
  { x: 0, y: 1 },
  { x: -SQRT3 / 2, y: 0.5 },
  { x: -SQRT3 / 2, y: -0.5 },
];

// Axial neighbor directions for pointy-top hex
export const HEX_DIRECTIONS = [
  { q: 1, r: -1 }, // NE
  { q: 1, r: 0 },  // E
  { q: 0, r: 1 },  // SE
  { q: -1, r: 1 }, // SW
  { q: -1, r: 0 }, // W
  { q: 0, r: -1 }, // NW
];
