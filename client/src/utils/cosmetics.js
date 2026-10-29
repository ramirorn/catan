// Shop cosmetics on the client: how each catalogue id looks. Names, prices and
// ownership come from the server (GET /api/shop); this file only holds the
// visual tables (pure data, shared by the 2D board, the 3D board and the shop
// previews). Unknown ids always fall back to the classic look.

export const DEFAULT_PIECES = 'pieces:classic';
export const DEFAULT_BOARD = 'board:classic';

export const PIECE_SET_IDS = [
  'pieces:classic',
  'pieces:temple',
  'pieces:scrolls',
  'pieces:sand',
  'pieces:kunai',
  'pieces:lantern',
  'pieces:crimson',
  'pieces:toad',
  'pieces:council', // admins only
];

export function pieceSetOf(id) {
  return PIECE_SET_IDS.includes(id) ? id : DEFAULT_PIECES;
}

/**
 * Board themes. Every theme is a palette: the sea pattern, the scroll frame
 * rings, a light wash over each tile (2D, under the number seals so they stay
 * legible), the material tint / haze of the 3D tiles and the 3D lights, plus
 * one static accent drawn on the sea.
 */
const CLASSIC = {
  sea: { base: '#1d4660', scale: '#1f4b66', stroke: '#12344a', ring: '#4f86a3' },
  frame: { margin: '#efe6d0', rule: '#b6331f', inner: '#efe6d0', line: '#1f1b17', foam: '#e9eef0', foamOpacity: 0.45, shore: '#d6bf8a' },
  wash: null, // { color, opacity } over each tile (2D)
  tileTint: '#ffffff', // 3D: multiplies the terrain texture
  tileHaze: '#000000', // 3D: emissive lift (mist)
  hemi: ['#fff2dc', '#6b5d63', 1.05],
  sun: ['#ffdcb0', 1.25],
  accent: null,
  swatch: ['#1f4b66', '#efe6d0', '#b6331f', '#93b45b'],
};

export const BOARD_THEMES = {
  'board:classic': CLASSIC,
  'board:night': {
    sea: { base: '#0c1729', scale: '#0f1d35', stroke: '#060c18', ring: '#3d5f8f' },
    frame: { margin: '#c8cbd9', rule: '#7a2b20', inner: '#c8cbd9', line: '#0b0d14', foam: '#b9c9e8', foamOpacity: 0.32, shore: '#8e8a7a' },
    wash: { color: '#1a2552', opacity: 0.3 },
    tileTint: '#b6c0e2',
    tileHaze: '#04060e',
    hemi: ['#a3b6ea', '#1e2136', 0.9],
    sun: ['#d4e0ff', 1.05],
    accent: 'stars',
    swatch: ['#0f1d35', '#c8cbd9', '#3d5f8f', '#f4e9b8'],
  },
  'board:desert': {
    sea: { base: '#c79f63', scale: '#d2ac72', stroke: '#a37d47', ring: '#ead19c' },
    frame: { margin: '#f3e2c0', rule: '#c0661f', inner: '#f3e2c0', line: '#3a2414', foam: '#f6e7c4', foamOpacity: 0.5, shore: '#e4c88f' },
    wash: { color: '#f0a040', opacity: 0.13 },
    tileTint: '#ffe5c2',
    tileHaze: '#120700',
    hemi: ['#ffe2b0', '#7a5a3a', 1.1],
    sun: ['#ffc98a', 1.35],
    accent: 'dunes',
    swatch: ['#d2ac72', '#f3e2c0', '#c0661f', '#ad512c'],
  },
  'board:mist': {
    sea: { base: '#4b616d', scale: '#546b78', stroke: '#384c57', ring: '#a9c0cb' },
    frame: { margin: '#e3e7ea', rule: '#5c7c89', inner: '#e3e7ea', line: '#283034', foam: '#f2f6f8', foamOpacity: 0.6, shore: '#c3c1b2' },
    wash: { color: '#e4ecf1', opacity: 0.2 },
    tileTint: '#d6e0e6',
    tileHaze: '#1b2227',
    hemi: ['#e8f0f4', '#5a6670', 1.1],
    sun: ['#e6eef2', 0.95],
    accent: 'mist',
    swatch: ['#546b78', '#e3e7ea', '#5c7c89', '#a9c0cb'],
  },
  'board:valley': {
    sea: { base: '#1e4b46', scale: '#24554f', stroke: '#133833', ring: '#70b1a3' },
    frame: { margin: '#d8d3c5', rule: '#59694a', inner: '#d8d3c5', line: '#24221e', foam: '#eef6f2', foamOpacity: 0.55, shore: '#a9a28e' },
    wash: { color: '#3b5a4f', opacity: 0.1 },
    tileTint: '#e4ebe2',
    tileHaze: '#000000',
    hemi: ['#eef4e6', '#4f5a52', 1.05],
    sun: ['#fff0d0', 1.2],
    accent: 'falls',
    swatch: ['#24554f', '#d8d3c5', '#59694a', '#8c8778'],
  },
  'board:spring': {
    sea: { base: '#2a5a78', scale: '#2e6282', stroke: '#1b4560', ring: '#9cc6dc' },
    frame: { margin: '#f7e9ea', rule: '#cf5679', inner: '#f7e9ea', line: '#3a1f26', foam: '#fdeef2', foamOpacity: 0.5, shore: '#e8d1a8' },
    wash: { color: '#ffb7c9', opacity: 0.1 },
    tileTint: '#fff1f3',
    tileHaze: '#0b0204',
    hemi: ['#fff0f4', '#7a5a66', 1.1],
    sun: ['#ffe0e6', 1.25],
    accent: 'petals',
    swatch: ['#2e6282', '#f7e9ea', '#cf5679', '#f6b6c8'],
  },
};

export function boardThemeOf(id) {
  return BOARD_THEMES[id] ? id : DEFAULT_BOARD;
}

export function boardTheme(id) {
  return BOARD_THEMES[id] || CLASSIC;
}

/** Tiny deterministic PRNG (same accents on every screen, no Math.random) */
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Spots out at sea (board px) for the theme accents: around the island,
 * clear of the shore and inside the sea ring of the frame.
 */
export function seaSpots(hexes, hexSize = 60) {
  const out = [];
  const near = hexSize * 1.3;
  const far = hexSize * 1.62;
  for (const h of hexes) {
    for (let k = 0; k < 12; k++) {
      const a = (Math.PI / 6) * k + Math.PI / 12;
      const d = hexSize * 1.5;
      const x = h.x + Math.cos(a) * d;
      const y = h.y + Math.sin(a) * d;
      let min = Infinity;
      for (const o of hexes) min = Math.min(min, Math.hypot(o.x - x, o.y - y));
      if (min < near || min > far) continue;
      if (out.some((p) => Math.hypot(p.x - x, p.y - y) < hexSize * 0.55)) continue;
      out.push({ x, y });
    }
  }
  const rand = seeded(out.length * 7919 + 17);
  return out.map((p) => ({ ...p, r: rand(), s: 0.75 + rand() * 0.5, a: rand() * Math.PI * 2 }));
}
