// ─── Resource & Terrain Definitions ───
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

export const RESOURCE_ICONS = {
  [RESOURCE.WOOD]: '🌲',
  [RESOURCE.BRICK]: '🧱',
  [RESOURCE.SHEEP]: '🐑',
  [RESOURCE.WHEAT]: '🌾',
  [RESOURCE.ORE]: '⛰️',
};

export const RESOURCE_NAMES = {
  [RESOURCE.WOOD]: 'Madera',
  [RESOURCE.BRICK]: 'Arcilla',
  [RESOURCE.SHEEP]: 'Oveja',
  [RESOURCE.WHEAT]: 'Trigo',
  [RESOURCE.ORE]: 'Mineral',
};

export const TERRAIN_ICONS = {
  [TERRAIN.FOREST]: '🌲',
  [TERRAIN.HILLS]: '🧱',
  [TERRAIN.PASTURE]: '🐑',
  [TERRAIN.FIELDS]: '🌾',
  [TERRAIN.MOUNTAINS]: '⛰️',
  [TERRAIN.DESERT]: '🏜️',
};

export const BUILD_COSTS = {
  road: { [RESOURCE.WOOD]: 1, [RESOURCE.BRICK]: 1 },
  settlement: { [RESOURCE.WOOD]: 1, [RESOURCE.BRICK]: 1, [RESOURCE.SHEEP]: 1, [RESOURCE.WHEAT]: 1 },
  city: { [RESOURCE.WHEAT]: 2, [RESOURCE.ORE]: 3 },
  devCard: { [RESOURCE.SHEEP]: 1, [RESOURCE.WHEAT]: 1, [RESOURCE.ORE]: 1 },
};

export const DEV_CARD = {
  KNIGHT: 'knight',
  ROAD_BUILDING: 'roadBuilding',
  YEAR_OF_PLENTY: 'yearOfPlenty',
  MONOPOLY: 'monopoly',
  VICTORY_POINT: 'victoryPoint',
};

export const DEV_CARD_INFO = {
  [DEV_CARD.KNIGHT]: {
    name: 'Caballero',
    icon: '⚔️',
    description: 'Mueve el ladrón y roba 1 recurso a un jugador adyacente.',
  },
  [DEV_CARD.ROAD_BUILDING]: {
    name: 'Construcción de Caminos',
    icon: '🛣️',
    description: 'Construye 2 caminos gratis inmediatamente.',
  },
  [DEV_CARD.YEAR_OF_PLENTY]: {
    name: 'Año de la Abundancia',
    icon: '🌾',
    description: 'Toma 2 cartas de recursos cualesquiera de la banca.',
  },
  [DEV_CARD.MONOPOLY]: {
    name: 'Monopolio',
    icon: '💰',
    description: 'Nombra 1 recurso; todos los ninjas rivales deben entregarte todas sus cartas de ese tipo.',
  },
  [DEV_CARD.VICTORY_POINT]: {
    name: 'Punto de Victoria',
    icon: '🏆',
    description: '+1 Punto de Victoria (se revela al final o al alcanzar los PV para ganar).',
  },
};

export const PHASE = {
  LOBBY: 'lobby',
  SETUP_FORWARD: 'setupForward',
  SETUP_REVERSE: 'setupReverse',
  ROLL_DICE: 'rollDice',
  ROBBER_DISCARD: 'robberDiscard',
  ROBBER_MOVE: 'robberMove',
  ROBBER_STEAL: 'robberSteal',
  MAIN: 'main',
  SPECIAL_BUILD: 'specialBuild',
  GAME_OVER: 'gameOver',
};

export const PHASE_DESCRIPTIONS = {
  [PHASE.SETUP_FORWARD]: 'Preparación: coloca tu primer poblado y camino',
  [PHASE.SETUP_REVERSE]: 'Preparación: coloca tu segundo poblado y camino (recibes recursos)',
  [PHASE.ROLL_DICE]: 'Lanza los dados para reunir recursos',
  [PHASE.ROBBER_DISCARD]: '¡Salió 7! Quien tenga más de 7 cartas debe descartar la mitad',
  [PHASE.ROBBER_MOVE]: 'Mueve al ladrón renegado para bloquear un hexágono',
  [PHASE.ROBBER_STEAL]: 'Roba una carta a un ninja junto al hexágono bloqueado',
  [PHASE.MAIN]: 'Turno principal: comercia, construye o juega cartas de desarrollo',
  [PHASE.SPECIAL_BUILD]: 'Fase especial de construcción: solo construir o comprar cartas',
  [PHASE.GAME_OVER]: '¡Fin de la misión!',
};

// ─── Room rules (host chooses them before starting) ───
export const DEFAULT_VP_TO_WIN = 10;
export const VP_TO_WIN_OPTIONS = [8, 10, 12, 14, 16];
// Seconds per turn; 0 = no limit
export const TURN_TIME_OPTIONS = [
  { value: 0, label: 'Sin límite' },
  { value: 60, label: '60 s' },
  { value: 90, label: '90 s' },
  { value: 120, label: '120 s' },
  { value: 180, label: '180 s' },
];

export function turnTimeLabel(seconds) {
  return TURN_TIME_OPTIONS.find((o) => o.value === seconds)?.label || 'Sin límite';
}
