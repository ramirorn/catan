// What the 3D stage of each tutorial step shows: a small 7-hex island, two
// players (red = you, blue = a rival), and a timeline of things that appear
// (pieces, flying resource cards, badges, dice, the robber…). Times are in
// seconds from the start of the step. `at` missing = already there.

const S = Math.sqrt(3) / 2;
const W = Math.sqrt(3);

export const HEXES = [
  { id: 'h0', x: 0, z: 0, terrain: 'fields', number: 6 },
  { id: 'h1', x: W, z: 0, terrain: 'forest', number: 8 },
  { id: 'h2', x: -W, z: 0, terrain: 'hills', number: 5 },
  { id: 'h3', x: W / 2, z: 1.5, terrain: 'pasture', number: 9 },
  { id: 'h4', x: -W / 2, z: 1.5, terrain: 'mountains', number: 10 },
  { id: 'h5', x: W / 2, z: -1.5, terrain: 'desert', number: null },
  { id: 'h6', x: -W / 2, z: -1.5, terrain: 'forest', number: 3 },
];
export const HEX = Object.fromEntries(HEXES.map((h) => [h.id, h]));

// Hex corners used by the lessons (world x, z)
export const V = {
  A: [S, 0.5], // red, 1st settlement (fields 6, forest 8, pasture 9)
  A2: [-S, -0.5], // red, 2nd settlement (fields, hills, forest)
  B1: [0, 2], // blue (pasture, mountains)
  B2: [W, -1], // blue (forest, desert)
  a1: [W, 1],
  a2: [W + S, 0.5],
  b1: [-W / 2, 2.5],
  b2: [W + S, -0.5],
  c1: [-W, -1],
  c2: [-W - S, -0.5],
  c3: [-W - S, 0.5],
  c4: [-W, 1],
  c5: [-S, 0.5],
  ps1: [W / 2, 2.5],
  ps2: [W / 2 + S, 2],
};

export const RED = '#d23a26';
export const BLUE = '#2a6fd0';

export const PORTS = [
  { v1: 'c2', v2: 'c3', type: 'generic', ratio: 3 },
  { v1: 'ps1', v2: 'ps2', type: 'sheep', ratio: 2 },
];

const settlement = (id, v, color, extra = {}) => ({ id, kind: 'settlement', v, color, ...extra });
const city = (id, v, color, extra = {}) => ({ id, kind: 'city', v, color, ...extra });
const road = (id, a, b, color, extra = {}) => ({ id, kind: 'road', e: [a, b], color, ...extra });

// The four settlements + roads after the opening placement
const SETUP = [
  settlement('A', 'A', RED),
  road('rA', 'A', 'a1', RED),
  settlement('B1', 'B1', BLUE),
  road('rB1', 'B1', 'b1', BLUE),
  settlement('B2', 'B2', BLUE),
  road('rB2', 'B2', 'b2', BLUE),
  settlement('A2', 'A2', RED),
  road('rA2', 'A2', 'c1', RED),
];
const base = (...skip) => SETUP.filter((p) => !skip.includes(p.id));

// Dice values: module constants so their identity never changes
const ROLL_8 = [5, 3];
const ROLL_7 = [3, 4];
const DICE_SPOT = [0.15, 0.012, 3.2];
const BANK = [0, 1.75, -0.9];

const up = (v, y = 0.95) => [V[v][0], y, V[v][1]];
const mid = (a, b, y = 0.55) => [(V[a][0] + V[b][0]) / 2, y, (V[a][1] + V[b][1]) / 2];

export const SCENES = {
  goal: {
    cam: { az: 18, el: 50, r: 3.3, target: [0, 0.2] },
    dur: 4.4,
    tokens: true,
    robber: { hex: 'h5' },
    pieces: [
      settlement('A', 'A', RED, { at: 0.4, until: 2.5 }),
      road('rA', 'A', 'a1', RED, { at: 0.8 }),
      settlement('A2', 'A2', RED, { at: 1.3 }),
      road('rA2', 'A2', 'c1', RED, { at: 1.7 }),
      city('Ac', 'A', RED, { at: 2.5, rise: true }),
    ],
    badges: [
      { kind: 'seal', text: '+1', pos: up('A'), at: 0.6, until: 2.5 },
      { kind: 'seal', text: '+1', pos: up('A2'), at: 1.5 },
      { kind: 'seal', text: '+2', pos: up('A', 1.2), at: 2.9 },
      { kind: 'tag', text: 'Meta: 10 PV', pos: [0, 1.75, -1.1], at: 3.4, h: 0.36 },
    ],
  },

  board: {
    cam: { az: 0, el: 60, r: 3.5, target: [0, 0.15] },
    dur: 4.4,
    dropTiles: 0.1,
    tokens: false,
    robber: { hex: 'h5', showAt: 1.6 },
    cards: ['h0', 'h1', 'h2', 'h3', 'h4', 'h6'].map((h, i) => ({ terrain: HEX[h].terrain, from: h, to: h, at: 1.7 + i * 0.2 })),
  },

  numbers: {
    cam: { az: 0, el: 62, r: 3.2, target: [0, 0.1] },
    dur: 3.6,
    tokens: { drop: 0.2, hot: 1.7 },
    robber: { hex: 'h5' },
    glow: { h0: 1.7, h1: 1.7 },
  },

  setup: {
    cam: { az: -8, el: 54, r: 3.5, target: [0, 0.4] },
    dur: 5.4,
    tokens: true,
    robber: { hex: 'h5' },
    pieces: [
      settlement('A', 'A', RED, { at: 0.3 }),
      road('rA', 'A', 'a1', RED, { at: 0.6 }),
      settlement('B1', 'B1', BLUE, { at: 1.2 }),
      road('rB1', 'B1', 'b1', BLUE, { at: 1.5 }),
      settlement('B2', 'B2', BLUE, { at: 2.1 }),
      road('rB2', 'B2', 'b2', BLUE, { at: 2.4 }),
      settlement('A2', 'A2', RED, { at: 3.0 }),
      road('rA2', 'A2', 'c1', RED, { at: 3.3 }),
    ],
    badges: [
      { kind: 'seal', text: '1', color: RED, pos: up('A'), at: 0.3 },
      { kind: 'seal', text: '2', color: BLUE, pos: up('B1'), at: 1.2 },
      { kind: 'seal', text: '3', color: BLUE, pos: up('B2'), at: 2.1 },
      { kind: 'seal', text: '4', color: RED, pos: up('A2'), at: 3.0 },
    ],
    cards: [
      { terrain: 'fields', from: 'h0', to: 'A2', at: 3.9, i: 0 },
      { terrain: 'hills', from: 'h2', to: 'A2', at: 4.05, i: 1 },
      { terrain: 'forest', from: 'h6', to: 'A2', at: 4.2, i: 2 },
    ],
  },

  roll: {
    cam: { az: 0, el: 48, r: 3.9, target: [0, 0.95] },
    dur: 4.4,
    tokens: true,
    robber: { hex: 'h5' },
    pieces: base(),
    dice: { values: ROLL_8, at: 0.3, pos: DICE_SPOT },
    badges: [{ kind: 'tag', text: '5 + 3 = 8', pos: [DICE_SPOT[0], 0.75, DICE_SPOT[2] - 0.2], at: 1.75, h: 0.3 }],
    glow: { h1: 1.9 },
    cards: [
      { terrain: 'forest', from: 'h1', to: 'A', at: 2.4 },
      { terrain: 'forest', from: 'h1', to: 'B2', at: 2.55 },
    ],
  },

  build: {
    cam: { az: -22, el: 54, r: 2.5, target: [1.55, 0.25] },
    dur: 4.2,
    tokens: true,
    robber: { hex: 'h5' },
    pieces: [...base(), road('rN', 'a1', 'a2', RED, { at: 0.5 }), settlement('N', 'a2', RED, { at: 2.9 })],
    badges: [
      { kind: 'no', pos: up('a1', 0.62), at: 1.4 },
      { kind: 'ok', pos: up('a2', 0.62), at: 2.0, until: 2.9 },
    ],
  },

  city: {
    cam: { az: 18, el: 50, r: 2.6, target: [1.15, 0.25] },
    dur: 4.2,
    tokens: true,
    robber: { hex: 'h5' },
    pieces: [...base('A'), settlement('A', 'A', RED, { until: 0.6 }), city('Ac', 'A', RED, { at: 0.6, rise: true })],
    glow: { h1: 1.7 },
    cards: [
      { terrain: 'forest', from: 'h1', to: 'A', at: 2.1, i: 0 },
      { terrain: 'forest', from: 'h1', to: 'A', at: 2.25, i: 1 },
      { terrain: 'forest', from: 'h1', to: 'B2', at: 2.2 },
    ],
    badges: [{ kind: 'seal', text: '×2', pos: up('A', 1.45), at: 3.1 }],
  },

  trade: {
    cam: { az: 0, el: 54, r: 3.75, target: [0, 0.55] },
    dur: 5.2,
    tokens: true,
    robber: { hex: 'h5' },
    ports: { pulse: 3.9 },
    pieces: base(),
    cards: [
      { terrain: 'forest', from: 'A', to: 'B1', at: 0.4 },
      { terrain: 'pasture', from: 'B1', to: 'A', at: 0.55 },
      ...[0, 1, 2, 3].map((i) => ({ terrain: 'fields', from: 'A', to: BANK, at: 2.0 + i * 0.14, fade: true })),
      { terrain: 'mountains', from: BANK, to: 'A', at: 3.0 },
    ],
    badges: [
      { kind: 'ok', pos: mid('A', 'B1', 1.15), at: 1.45 },
      { kind: 'tag', text: 'Banco 4 : 1', pos: [BANK[0], BANK[1] + 0.32, BANK[2]], at: 1.75, h: 0.28 },
    ],
  },

  robber: {
    cam: { az: -12, el: 50, r: 3.9, target: [0, 0.95] },
    dur: 6.0,
    tokens: true,
    robber: { hex: 'h5', to: 'h4', at: 3.5 },
    pieces: base(),
    dice: { values: ROLL_7, at: 0.2, pos: DICE_SPOT },
    badges: [
      { kind: 'tag', text: '3 + 4 = 7', pos: [DICE_SPOT[0], 0.75, DICE_SPOT[2] - 0.2], at: 1.65, h: 0.3 },
      { kind: 'tag', text: '8 cartas → 4', pos: [V.B1[0] + 0.5, 1.7, V.B1[1]], at: 2.1, until: 3.4, h: 0.26 },
    ],
    hand: { at: 2.1, v: 'B1', terrains: ['pasture', 'fields', 'mountains', 'forest', 'pasture', 'hills', 'fields', 'pasture'], discardAt: 2.75 },
    cards: [{ terrain: 'pasture', from: 'B1', to: 'A', at: 4.4 }],
  },

  pact: {
    cam: { az: 0, el: 54, r: 3.6, target: [0, 0.4] },
    dur: 5.0,
    tokens: true,
    robber: { hex: 'h4', to: 'h5', at: 3.4 },
    pieces: base(),
    badges: [{ kind: 'tag', text: 'Pacto de paz', pos: mid('A', 'B1', 1.45), at: 0.3, h: 0.3 }],
    cards: [
      { terrain: 'fields', from: 'B1', to: 'A', at: 1.1, i: 0 },
      { terrain: 'mountains', from: 'B1', to: 'A', at: 1.25, i: 1 },
    ],
    veil: { hexes: ['h1', 'h3', 'h4'], at: 2.2 },
  },

  dev: {
    cam: { az: 0, el: 46, r: 3.6, target: [0, 0.75] },
    dur: 5.2,
    tokens: true,
    robber: { hex: 'h5', to: 'h4', at: 2.9 },
    pieces: base(),
    devCards: { at: 0.2, pick: 2.1 },
    cards: [{ terrain: 'pasture', from: 'B1', to: 'A', at: 3.8 }],
  },

  awards: {
    cam: { az: -18, el: 56, r: 3.4, target: [-0.7, 0.3] },
    dur: 5.4,
    tokens: true,
    robber: { hex: 'h5' },
    pieces: [
      ...base(),
      road('l2', 'c1', 'c2', RED, { at: 0.4 }),
      road('l3', 'c2', 'c3', RED, { at: 0.75 }),
      road('l4', 'c3', 'c4', RED, { at: 1.1 }),
      road('l5', 'c4', 'c5', RED, { at: 1.45 }),
    ],
    badges: [
      { kind: 'tag', text: 'Camino más largo +2', pos: [-W - 0.2, 1.3, 0], at: 2.0, h: 0.28 },
      { kind: 'tag', text: 'Gran ejército +2', pos: [S + 0.2, 1.55, 0.7], at: 4.0, h: 0.28 },
    ],
    knights: { at: 2.8, pos: [S + 0.2, 0.95, 0.7] },
  },

  win: {
    cam: { az: -30, el: 44, r: 3.3, target: [0, 0.4], spin: { deg: 50, at: 0.9, dur: 4.2 } },
    dur: 5.4,
    tokens: true,
    robber: { hex: 'h5' },
    pieces: [
      ...base('A', 'A2'),
      city('Ac', 'A', RED),
      city('A2c', 'A2', RED),
      road('rN', 'a1', 'a2', RED),
      settlement('N', 'a2', RED),
      road('l2', 'c1', 'c2', RED),
      road('l3', 'c2', 'c3', RED),
    ],
    badges: [{ kind: 'tag', text: '¡Victoria!', pos: [0, 1.7, 0], at: 0.5, h: 0.42 }],
    confetti: 0.5,
  },
};
