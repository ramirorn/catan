// 2D player pieces of every shop piece set (settlement, city, road). Each set
// has its own silhouette and materials, but the main surfaces are always in
// the player's colour so players stay distinguishable. Pieces are drawn as:
//   offset shadow → player-colour base plate → soft halo in a light tint of
//   the player colour + thin ink outline of the silhouette → fills.
// No white rim: the ink line and the shadow separate the piece from the
// terrain, the faint tinted halo only lifts it off dark tiles, so the set's
// own design stays the first thing you see.
// Plain shapes only (no SVG filters, which re-rasterise on zoom).
import { memo } from 'react';
import { shade } from '../../utils/theme';
import { pieceSetOf } from '../../utils/cosmetics';

export const PIECE_INK = '#120e0b';
export const PIECE_RIM = '#fff4dc';

/** Soft halo around a piece: a light tint of the owner's colour, low opacity */
const HALO_OPACITY = 0.38;
const halo = (color) => shade(color, 0.55);

const circ = (cx, cy, r) => `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
const ell = (cx, cy, rx, ry) => `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
const rect = (x, y, w, h) => `M ${x} ${y} h ${w} v ${h} h ${-w} Z`;
const CLOUD = 'M-3.4 1.4 a1.5 1.5 0 0 1 0.4 -2.6 a2.1 2.1 0 0 1 3.4 -1 a1.7 1.7 0 0 1 2.9 0.8 a1.4 1.4 0 0 1 0.3 2.8 Z';

const WOOD = '#6b4528';
const WOOD_DARK = '#3f2817';
const PAPER = '#efe4c8';
const SAND = '#d8b77e';
const SAND_DARK = '#ad8a55';
const STEEL = '#b9c1c9';
const STEEL_LIGHT = '#e6ebef';
const STONE = '#8f8a80';
const STONE_DARK = '#6a665e';
const BLACK = '#18181d';
const CLOUD_RED = '#c0271b';
const CREAM = '#f1e6c6';
const STRAW = '#cfae6c';

/** Colour tokens: p = player, pd = roof shade, ps = side shade, pl = highlight */
function tone(token, color) {
  switch (token) {
    case 'p':
      return color;
    case 'pd':
      return shade(color, -0.32);
    case 'ps':
      return shade(color, -0.18);
    case 'pl':
      return shade(color, 0.45);
    case 'ink':
      return PIECE_INK;
    case 'rim':
      return PIECE_RIM;
    case 'none':
      return 'none';
    default:
      return token;
  }
}

/*
 * Set definitions: { scale, sil, plate, shadowRx, layers: [[d, fill, opts]] }
 * opts: { stroke, sw, opacity, transform, cap }
 */
const SETS = {
  'pieces:temple': {
    settlement: {
      scale: 1.2,
      sil: 'M -7.5 9 V 1 H -12.5 Q -6.5 -0.5 -3 -10 H 3 Q 6.5 -0.5 12.5 1 H 7.5 V 9 Z',
      layers: [
        [rect(-7.5, 1, 15, 8), WOOD],
        [rect(3.5, 1, 4, 8), WOOD_DARK],
        [rect(-2, 3.6, 4, 5.4), PIECE_INK],
        ['M -6.5 1.5 V 9 M 6.5 1.5 V 9', 'none', { stroke: WOOD_DARK, sw: 1.2 }],
        ['M -12.5 1 Q -6.5 -0.5 -3 -10 H 3 Q 6.5 -0.5 12.5 1 Z', 'p', { stroke: 'ink', sw: 1.1 }],
        ['M -9.5 -0.2 Q -5.5 -2 -2.6 -8.4', 'none', { stroke: 'pl', sw: 1.4, cap: true }],
        [rect(-3.4, -11.6, 6.8, 1.8), 'pd', { stroke: 'ink', sw: 0.8 }],
      ],
    },
    city: {
      scale: 1.1,
      sil: 'M -11 10 V 0 H -17.5 Q -10 -1.5 -7 -9 H -5.5 V -14 H -13 Q -6.5 -15 -3.4 -25 H 3.4 Q 6.5 -15 13 -14 H 5.5 V -9 H 7 Q 10 -1.5 17.5 0 H 11 V 10 Z',
      layers: [
        [rect(-11, 0, 22, 10), WOOD],
        [rect(5.5, 0, 5.5, 10), WOOD_DARK],
        [rect(-2.6, 3.4, 5.2, 6.6), PIECE_INK],
        ['M -8.5 1 V 10 M 8.5 1 V 10', 'none', { stroke: WOOD_DARK, sw: 1.3 }],
        ['M -17.5 0 Q -10 -1.5 -7 -9 H 7 Q 10 -1.5 17.5 0 Z', 'p', { stroke: 'ink', sw: 1.1 }],
        ['M -14 -0.9 Q -9.4 -2.6 -6.8 -7.6', 'none', { stroke: 'pl', sw: 1.3, cap: true }],
        [rect(-5.5, -14, 11, 5), WOOD],
        [rect(2.5, -14, 3, 5), WOOD_DARK],
        ['M -13 -14 Q -6.5 -15 -3.4 -25 H 3.4 Q 6.5 -15 13 -14 Z', 'p', { stroke: 'ink', sw: 1.1 }],
        ['M -9.6 -14.8 Q -5.2 -16.6 -3 -23', 'none', { stroke: 'pl', sw: 1.2, cap: true }],
        [rect(-4, -26.6, 8, 1.8), 'pd', { stroke: 'ink', sw: 0.8 }],
      ],
    },
  },

  'pieces:scrolls': {
    settlement: {
      scale: 1.18,
      sil: 'M -9 10 H 9 V 6 H 7.2 V -6 H 9 V -10.5 H -9 V -6 H -7.2 V 6 H -9 Z',
      layers: [
        [rect(-7.2, -6, 14.4, 12), PAPER],
        ['M -4.5 -3.6 H 4.5 M -4.5 3.6 H 4.5', 'none', { stroke: '#8b7d62', sw: 0.8 }],
        [rect(-9, -10.5, 18, 4.5), 'p', { stroke: 'ink', sw: 1 }],
        [rect(-9, 6, 18, 4), 'p', { stroke: 'ink', sw: 1 }],
        [rect(-7.2, -1.6, 14.4, 3.2), 'ps'],
        [circ(0, 0, 2.7), 'pd', { stroke: 'ink', sw: 0.9 }],
        ['M -7 -9.2 H 7', 'none', { stroke: 'pl', sw: 1.2, cap: true }],
      ],
    },
    city: {
      scale: 1.08,
      sil: 'M -17 10.5 V 1.5 H -9.5 V -22 H -12 V -28 H 12 V -22 H 9.5 V 1.5 H 17 V 10.5 Z',
      layers: [
        [rect(-9.5, -22, 19, 24), PAPER],
        ['M -6 -17 H 6 M -6 -4 H 6 M -6 -1 H 3', 'none', { stroke: '#8b7d62', sw: 0.8 }],
        [rect(-12, -28, 24, 6), 'p', { stroke: 'ink', sw: 1 }],
        [rect(-9.5, -12.6, 19, 3.6), 'ps'],
        [circ(0, -10.8, 3), 'pd', { stroke: 'ink', sw: 0.9 }],
        [rect(-14, 1.5, 28, 9), PAPER, { stroke: 'ink', sw: 1 }],
        ['M -10 6 H 10', 'none', { stroke: '#8b7d62', sw: 0.8 }],
        [rect(-17, 1, 4, 10), 'p', { stroke: 'ink', sw: 1 }],
        [rect(13, 1, 4, 10), 'p', { stroke: 'ink', sw: 1 }],
        ['M -10.5 -26.4 H 10.5', 'none', { stroke: 'pl', sw: 1.2, cap: true }],
      ],
    },
  },

  'pieces:sand': {
    settlement: {
      scale: 1.2,
      sil: 'M -8.5 9 V -1 Q -8.5 -11.5 0 -12.5 Q 8.5 -11.5 8.5 -1 V 9 Z',
      layers: [
        [rect(-8.5, -1, 17, 10), SAND],
        [rect(3.8, -1, 4.7, 10), SAND_DARK],
        ['M -2.2 9 V 5 a 2.2 2.2 0 0 1 4.4 0 V 9 Z', PIECE_INK],
        ['M -8.5 -1 Q -8.5 -11.5 0 -12.5 Q 8.5 -11.5 8.5 -1 Z', 'p', { stroke: 'ink', sw: 1.1 }],
        ['M -6 -3 Q -5.6 -9 -1.4 -10.4', 'none', { stroke: 'pl', sw: 1.5, cap: true }],
        ['M -8.5 -1 H 8.5', 'none', { stroke: 'ink', sw: 1 }],
        ['M 0 -12.5 V -15.5', 'none', { stroke: 'ink', sw: 1.4, cap: true }],
      ],
    },
    city: {
      scale: 1.1,
      sil: 'M -16.5 10 V -14 Q -16.5 -20 -13 -21 Q -9.5 -20 -9.5 -14 V -6 Q -9 -19 0 -20 Q 9 -19 9.5 -6 V -14 Q 9.5 -20 13 -21 Q 16.5 -20 16.5 -14 V 10 Z',
      layers: [
        [rect(-10, -6, 20, 16), SAND],
        [rect(4.5, -6, 5.5, 16), SAND_DARK],
        ['M -2.6 10 V 4.4 a 2.6 2.6 0 0 1 5.2 0 V 10 Z', PIECE_INK],
        [rect(-16.5, -14, 7, 24), SAND, { stroke: 'ink', sw: 1 }],
        [rect(9.5, -14, 7, 24), SAND_DARK, { stroke: 'ink', sw: 1 }],
        [rect(-14, -6, 2, 3), PIECE_INK],
        [rect(12, -6, 2, 3), PIECE_INK],
        ['M -16.5 -14 Q -16.5 -20 -13 -21 Q -9.5 -20 -9.5 -14 Z', 'p', { stroke: 'ink', sw: 1 }],
        ['M 9.5 -14 Q 9.5 -20 13 -21 Q 16.5 -20 16.5 -14 Z', 'p', { stroke: 'ink', sw: 1 }],
        ['M -9.5 -6 Q -9 -19 0 -20 Q 9 -19 9.5 -6 Z', 'p', { stroke: 'ink', sw: 1.1 }],
        ['M -6.5 -8 Q -6 -15.6 -1.4 -17.6', 'none', { stroke: 'pl', sw: 1.5, cap: true }],
        ['M -9.5 -6 H 9.5', 'none', { stroke: 'ink', sw: 1 }],
        ['M 0 -20 V -24', 'none', { stroke: 'ink', sw: 1.4, cap: true }],
      ],
    },
  },

  'pieces:kunai': {
    settlement: {
      scale: 1.15,
      sil: `M 0 7.5 L 5.4 -3 L 2.2 -6.5 V -12.5 H 3.6 V -19 H -3.6 V -12.5 H -2.2 V -6.5 L -5.4 -3 Z`,
      layers: [
        ['M 0 7.5 L 5.4 -3 L 2.2 -6.5 H -2.2 L -5.4 -3 Z', STEEL],
        ['M 0 7.5 L 0 -6.5 H -2.2 L -5.4 -3 Z', STEEL_LIGHT],
        ['M 0 6 V -5', 'none', { stroke: '#7d8791', sw: 0.7 }],
        [rect(-2.2, -12.5, 4.4, 6), 'p'],
        ['M -2.2 -11 L 2.2 -9.5 M -2.2 -8.5 L 2.2 -7', 'none', { stroke: 'pd', sw: 1.1 }],
        [circ(0, -15.8, 3.6), STEEL, { stroke: 'ink', sw: 0.9 }],
        [circ(0, -15.8, 1.6), PIECE_INK],
      ],
    },
    city: {
      scale: 1.08,
      sil: 'M -7 10.5 V 1 H -3.2 L -3.6 -8.6 L -15.5 -12 L -3.6 -15.4 L 0 -27.5 L 3.6 -15.4 L 15.5 -12 L 3.6 -8.6 L 3.2 1 H 7 V 10.5 Z',
      layers: [
        [rect(-7, 1, 14, 9.5), 'p'],
        [rect(3, 1, 4, 9.5), 'ps'],
        ['M -7 1 H 7', 'none', { stroke: 'ink', sw: 1 }],
        ['M 0 -27.5 L 3.6 -15.4 L 15.5 -12 L 3.6 -8.6 L 0 3 L -3.6 -8.6 L -15.5 -12 L -3.6 -15.4 Z', STEEL, { stroke: 'ink', sw: 1 }],
        ['M 0 -27.5 L 3.6 -15.4 L 0 -12 Z M 15.5 -12 L 3.6 -8.6 L 0 -12 Z M 0 3 L -3.6 -8.6 L 0 -12 Z M -15.5 -12 L -3.6 -15.4 L 0 -12 Z', STEEL_LIGHT],
        [circ(0, -12, 4.2), 'p', { stroke: 'ink', sw: 1 }],
        [circ(0, -12, 1.6), PIECE_INK],
        ['M -2.6 -14 a 3.2 3.2 0 0 1 2.4 -1.5', 'none', { stroke: 'pl', sw: 1.1, cap: true }],
      ],
    },
  },

  'pieces:lantern': {
    glow: true,
    settlement: {
      scale: 1.18,
      sil: 'M -4 9.5 H 4 V 7 Q 9.5 4 9.5 -2 Q 9.5 -8 4 -10.5 V -13 H -4 V -10.5 Q -9.5 -8 -9.5 -2 Q -9.5 4 -4 7 Z',
      layers: [
        ['M -4 7 Q -9.5 4 -9.5 -2 Q -9.5 -8 -4 -10.5 H 4 Q 9.5 -8 9.5 -2 Q 9.5 4 4 7 Z', 'p'],
        [ell(-1, -2.5, 5, 6.5), 'pl', { opacity: 0.55 }],
        ['M -8.8 -5.5 Q 0 -4 8.8 -5.5 M -9.4 -1 Q 0 0.6 9.4 -1 M -8.4 3.4 Q 0 5 8.4 3.4', 'none', { stroke: 'pd', sw: 0.9 }],
        [rect(-4.5, -13, 9, 2.8), WOOD_DARK, { stroke: 'ink', sw: 0.8 }],
        [rect(-4.5, 6.8, 9, 2.8), WOOD_DARK, { stroke: 'ink', sw: 0.8 }],
      ],
    },
    city: {
      scale: 1.1,
      sil: 'M -8 10.5 V 6 H -3 V -4 H -9 V -7.5 H -6.5 V -15 H -13.5 Q -6 -16.6 -2 -23 V -26 H 2 V -23 Q 6 -16.6 13.5 -15 H 6.5 V -7.5 H 9 V -4 H 3 V 6 H 8 V 10.5 Z',
      layers: [
        [rect(-8, 6, 16, 4.5), STONE],
        [rect(-3, -4, 6, 10), STONE],
        [rect(0.8, -4, 2.2, 10), STONE_DARK],
        [rect(-9, -7.5, 18, 3.5), STONE, { stroke: 'ink', sw: 0.9 }],
        [rect(-6.5, -15, 13, 7.5), 'p'],
        [rect(-4, -13.4, 8, 4.4), 'pl', { opacity: 0.75 }],
        ['M 0 -13.4 V -9', 'none', { stroke: 'pd', sw: 1 }],
        ['M -13.5 -15 Q -6 -16.6 -2 -23 H 2 Q 6 -16.6 13.5 -15 Z', STONE_DARK, { stroke: 'ink', sw: 1 }],
        [circ(0, -24.5, 2.2), STONE, { stroke: 'ink', sw: 0.8 }],
      ],
    },
  },

  'pieces:crimson': {
    settlement: {
      scale: 1.2,
      sil: 'M -8 9 V -1 H -10.5 L 0 -13.5 L 10.5 -1 H 8 V 9 Z',
      layers: [
        [rect(-8, -1, 16, 10), BLACK],
        [rect(3.6, -1, 4.4, 10), '#0b0b0e'],
        [CLOUD, CLOUD_RED, { stroke: '#f3ede1', sw: 0.5, transform: 'translate(-2.4 4.2) scale(0.95)' }],
        ['M -10.5 -1 L 0 -13.5 L 10.5 -1 Z', 'p', { stroke: 'ink', sw: 1.1 }],
        ['M -7.6 -2.4 L -0.4 -11', 'none', { stroke: 'pl', sw: 1.4, cap: true }],
        ['M -8 -1 H 8', 'none', { stroke: 'ink', sw: 1 }],
      ],
    },
    city: {
      scale: 1.1,
      sil: 'M -11 10 V -11 H -13 V -15 H -9.5 V -13 H -6 L 0 -29 L 6 -13 H 9.5 V -15 H 13 V -11 H 11 V 10 Z',
      layers: [
        [rect(-11, -11, 22, 21), BLACK],
        [rect(5, -11, 6, 21), '#0b0b0e'],
        [rect(-13, -15, 26, 4), BLACK, { stroke: 'ink', sw: 0.8 }],
        [rect(-2.6, 3.6, 5.2, 6.4), CLOUD_RED],
        [CLOUD, CLOUD_RED, { stroke: '#f3ede1', sw: 0.45, transform: 'translate(-5 -4) scale(1)' }],
        [CLOUD, CLOUD_RED, { stroke: '#f3ede1', sw: 0.55, transform: 'translate(5.6 -1) scale(0.8)' }],
        ['M -6 -13 L 0 -29 L 6 -13 Z', 'p', { stroke: 'ink', sw: 1.1 }],
        ['M -3.6 -14.2 L -0.4 -26', 'none', { stroke: 'pl', sw: 1.3, cap: true }],
        ['M -13 -15 H 13', 'none', { stroke: 'p', sw: 1.6 }],
      ],
    },
  },

  'pieces:toad': {
    settlement: {
      scale: 1.15,
      sil: 'M -11.5 8.5 Q -12.5 -2 -6.5 -5 Q -7.5 -11 -3.6 -11 Q -0.8 -11 -0.8 -7 H 0.8 Q 0.8 -11 3.6 -11 Q 7.5 -11 6.5 -5 Q 12.5 -2 11.5 8.5 Z',
      layers: [
        ['M -11.5 8.5 Q -12.5 -2 -6.5 -5 Q -7.5 -11 -3.6 -11 Q -0.8 -11 -0.8 -7 H 0.8 Q 0.8 -11 3.6 -11 Q 7.5 -11 6.5 -5 Q 12.5 -2 11.5 8.5 Z', 'p'],
        ['M 5 -4 Q 11 -1 10.5 8.5 H 6 Q 7 1 4 -3 Z', 'ps'],
        [ell(0, 4.6, 5.4, 3.6), CREAM],
        [circ(-3.6, -7.8, 2.6), CREAM, { stroke: 'ink', sw: 0.8 }],
        [circ(3.6, -7.8, 2.6), CREAM, { stroke: 'ink', sw: 0.8 }],
        [circ(-3.3, -7.6, 1.2), PIECE_INK],
        [circ(3.9, -7.6, 1.2), PIECE_INK],
        ['M -5 -1.6 Q 0 0.6 5 -1.6', 'none', { stroke: 'pd', sw: 1.1, cap: true }],
        [circ(-7.5, 1.5, 1), 'pd'],
        [circ(8, 3.5, 0.9), 'pd'],
      ],
    },
    city: {
      scale: 1.06,
      sil: 'M -17 10.5 Q -18 -4 -9.5 -9 Q -10.5 -15 -6.5 -16.5 L -14 -18.5 L 0 -28 L 14 -18.5 L 6.5 -16.5 Q 10.5 -15 9.5 -9 Q 18 -4 17 10.5 Z',
      layers: [
        ['M -17 10.5 Q -18 -4 -9.5 -9 Q -10.5 -16 -5 -16 Q -1.2 -16 -1.2 -11 H 1.2 Q 1.2 -16 5 -16 Q 10.5 -16 9.5 -9 Q 18 -4 17 10.5 Z', 'p'],
        ['M 8 -8 Q 16 -3 15.5 10.5 H 10 Q 11 0 7 -6 Z', 'ps'],
        [ell(0, 4.6, 8.4, 5.4), CREAM],
        [circ(-5, -11.4, 3.3), CREAM, { stroke: 'ink', sw: 0.8 }],
        [circ(5, -11.4, 3.3), CREAM, { stroke: 'ink', sw: 0.8 }],
        [circ(-4.6, -11.2, 1.5), PIECE_INK],
        [circ(5.4, -11.2, 1.5), PIECE_INK],
        ['M -7 -4.4 Q 0 -1.6 7 -4.4', 'none', { stroke: 'pd', sw: 1.2, cap: true }],
        ['M -14 -18.5 L 0 -28 L 14 -18.5 Z', STRAW, { stroke: 'ink', sw: 1 }],
        ['M -14 -18.5 H 14', 'none', { stroke: '#8d6f35', sw: 1.2 }],
        [circ(-11, 1, 1.3), 'pd'],
        [circ(12, 4, 1.2), 'pd'],
      ],
    },
  },
};

function BasePlate({ rx, color, city = false }) {
  if (city) {
    return (
      <>
        <ellipse cx="0" cy="9.8" rx="19.6" ry="6.4" fill={PIECE_INK} />
        <ellipse cx="0" cy="9.2" rx="18" ry="5.2" fill={color} />
        <ellipse cx="0" cy="9.2" rx="15.6" ry="4.1" fill="none" stroke={shade(color, 0.4)} strokeOpacity="0.7" strokeWidth="1" />
        <ellipse cx="0" cy="8.6" rx="11.5" ry="2.6" fill={shade(color, 0.3)} opacity="0.55" />
      </>
    );
  }
  return (
    <>
      <ellipse cx="0" cy="9.5" rx={rx + 1.6} ry="5.4" fill={PIECE_INK} />
      <ellipse cx="0" cy="9" rx={rx} ry="4.2" fill={color} />
      <ellipse cx="0" cy="8.2" rx={rx - 2.5} ry="2.4" fill={shade(color, 0.3)} opacity="0.55" />
    </>
  );
}

function Outline({ d, color }) {
  return (
    <>
      <path d={d} fill="none" stroke={halo(color)} strokeOpacity={HALO_OPACITY} strokeWidth="4.8" strokeLinejoin="round" />
      <path d={d} fill={PIECE_INK} stroke={PIECE_INK} strokeWidth="2.6" strokeLinejoin="round" />
    </>
  );
}

function Layers({ layers, color }) {
  return layers.map(([d, fill, o = {}], i) => (
    <path
      key={i}
      d={d}
      fill={tone(fill, color)}
      stroke={o.stroke ? tone(o.stroke, color) : undefined}
      strokeWidth={o.sw}
      strokeLinejoin="round"
      strokeLinecap={o.cap ? 'round' : undefined}
      opacity={o.opacity}
      transform={o.transform}
    />
  ));
}

/* ─── Classic set (the original pieces) ─── */

const SETTLEMENT_SIL = 'M -8 9 V 0 H -10.5 L 0 -11 L 10.5 0 H 8 V 9 Z';
const CITY_SIL =
  'M -9 10 V 0 H -15.5 Q -11 -0.8 -8 -5 H -6.5 V -11 H -12.5 Q -8.5 -11.8 -5.2 -15.5 H -4.6 V -20 H -10 Q -4 -21 0 -27 Q 4 -21 10 -20 H 4.6 V -15.5 H 5.2 Q 8.5 -11.8 12.5 -11 H 6.5 V -5 H 8 Q 11 -0.8 15.5 0 H 9 V 10 Z';

function ClassicSettlement({ color }) {
  const roof = shade(color, -0.32);
  const light = shade(color, 0.45);
  return (
    <g transform="scale(1.22)">
      <ellipse cx="2.2" cy="11" rx="14" ry="4.6" fill="#05070c" opacity="0.5" />
      <path d={SETTLEMENT_SIL} transform="translate(2.4 3)" fill="#05070c" opacity="0.45" />
      <BasePlate rx={12} color={color} />
      <Outline d={SETTLEMENT_SIL} color={color} />
      <path d="M -8 0 H 8 V 9 H -8 Z" fill={color} />
      <path d="M 3.5 0 H 8 V 9 H 3.5 Z" fill={shade(color, -0.18)} />
      <rect x="-2" y="3.4" width="4" height="5.6" rx="0.6" fill={PIECE_INK} />
      <path d="M -10.5 0 L 0 -11 L 10.5 0 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M -8 -1.4 L 0 -9.4" stroke={light} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M -8 0 H 8" stroke={PIECE_INK} strokeWidth="1" />
    </g>
  );
}

function ClassicCity({ color }) {
  const roof = shade(color, -0.32);
  const side = shade(color, -0.18);
  const light = shade(color, 0.45);
  return (
    <g transform="scale(1.12)">
      <ellipse cx="2.4" cy="12" rx="20" ry="5.6" fill="#05070c" opacity="0.5" />
      <path d={CITY_SIL} transform="translate(2.6 3.2)" fill="#05070c" opacity="0.45" />
      <BasePlate city color={color} />
      <Outline d={CITY_SIL} color={color} />
      <path d="M -9 0 H 9 V 10 H -9 Z" fill={color} />
      <path d="M 4.5 0 H 9 V 10 H 4.5 Z" fill={side} />
      <rect x="-2.3" y="3.6" width="4.6" height="6.4" rx="0.6" fill={PIECE_INK} />
      <path d="M -15.5 0 Q -11 -0.8 -8 -5 H 8 Q 11 -0.8 15.5 0 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M -12.4 -0.9 Q -9.6 -2 -7.6 -4.2" stroke={light} strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d="M -6.5 -5 H 6.5 V -11 H -6.5 Z" fill={color} />
      <path d="M 3 -5 H 6.5 V -11 H 3 Z" fill={side} />
      <rect x="-2" y="-9.6" width="4" height="3" fill={PIECE_INK} />
      <path d="M -12.5 -11 Q -8.5 -11.8 -5.2 -15.5 H 5.2 Q 8.5 -11.8 12.5 -11 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M -9.8 -11.8 Q -7.4 -12.8 -5.6 -14.6" stroke={light} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M -4.6 -15.5 H 4.6 V -20 H -4.6 Z" fill={color} />
      <path d="M 2 -15.5 H 4.6 V -20 H 2 Z" fill={side} />
      <path d="M -10 -20 Q -4 -21 0 -27 Q 4 -21 10 -20 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M -6.6 -20.8 Q -3 -22.2 -0.8 -25.4" stroke={light} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M 0 -27 V -32.5" stroke={PIECE_INK} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M -1.8 -29 H 1.8 M -1.5 -30.8 H 1.5" stroke={PIECE_INK} strokeWidth="1" strokeLinecap="round" />
      <circle cx="0" cy="-33" r="1.4" fill={light} stroke={PIECE_INK} strokeWidth="0.8" />
    </g>
  );
}

function SetBuilding({ def, color, city, glow }) {
  return (
    <g transform={`scale(${def.scale})`}>
      {glow && <circle cx="0" cy={city ? -11 : -2} r={city ? 13 : 12.5} fill={shade(color, 0.35)} opacity="0.32" />}
      <ellipse cx="2.4" cy={city ? 12 : 11} rx={city ? 20 : 14} ry={city ? 5.6 : 4.6} fill="#05070c" opacity="0.5" />
      <path d={def.sil} transform="translate(2.4 3)" fill="#05070c" opacity="0.45" />
      <BasePlate rx={12} city={city} color={color} />
      <Outline d={def.sil} color={color} />
      <Layers layers={def.layers} color={color} />
    </g>
  );
}

/** Settlement of a piece set, centred on the vertex */
export const SettlementArt = memo(function SettlementArt({ set, color }) {
  const s = SETS[pieceSetOf(set)];
  if (!s) return <ClassicSettlement color={color} />;
  return <SetBuilding def={s.settlement} color={color} glow={s.glow} />;
});

export const CityArt = memo(function CityArt({ set, color }) {
  const s = SETS[pieceSetOf(set)];
  if (!s) return <ClassicCity color={color} />;
  return <SetBuilding def={s.city} color={color} city glow={s.glow} />;
});

/* ─── Roads (drawn along local x, centred; L = length) ─── */

function StripBase({ L, h = 12.5, color }) {
  return (
    <>
      <line x1={-L / 2} y1={0} x2={L / 2} y2={0} stroke={halo(color)} strokeOpacity={HALO_OPACITY} strokeWidth={h + 1.2} strokeLinecap="round" />
      <line x1={-L / 2} y1={0} x2={L / 2} y2={0} stroke={PIECE_INK} strokeWidth={h - 1} strokeLinecap="round" />
    </>
  );
}

function Dotted({ points, r, fill, light }) {
  return points.map(([x, y], i) => (
    <g key={i}>
      <circle cx={x + 1.4} cy={y + 2.8} r={r + 1.4} fill="#05070c" opacity="0.45" />
      <circle cx={x} cy={y} r={r + 2.2} fill={halo(fill)} opacity={HALO_OPACITY} />
      <circle cx={x} cy={y} r={r + 1.1} fill={PIECE_INK} />
      <circle cx={x} cy={y} r={r} fill={fill} />
      {light && <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.45} fill={light} opacity="0.8" />}
    </g>
  ));
}

function RoadShape({ set, L, color }) {
  const half = L / 2;
  switch (set) {
    case 'pieces:temple':
      return (
        <>
          <StripBase L={L} h={13} color={color} />
          <line x1={-half} y1={0} x2={half} y2={0} stroke={WOOD} strokeWidth="7" strokeLinecap="round" />
          <line x1={-half} y1={0} x2={half} y2={0} stroke={WOOD_DARK} strokeWidth="7" strokeDasharray="1.2 4" />
          <line x1={-half} y1={-4.2} x2={half} y2={-4.2} stroke={color} strokeWidth="2.6" strokeLinecap="round" />
          <line x1={-half} y1={4.2} x2={half} y2={4.2} stroke={color} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    case 'pieces:scrolls':
      return (
        <>
          <StripBase L={L - 4} h={12} color={color} />
          <rect x={-half + 2} y={-4.6} width={L - 4} height={9.2} fill={PAPER} />
          <line x1={-half + 6} y1={0} x2={half - 6} y2={0} stroke={shade(color, -0.2)} strokeWidth="1.6" strokeDasharray="5 2.5" />
          {[-1, 1].map((k) => (
            <rect key={k} x={k * (half - 2) - 2.4} y={-7.2} width={4.8} height={14.4} rx="1.4" fill={color} stroke={PIECE_INK} strokeWidth="1.3" />
          ))}
        </>
      );
    case 'pieces:sand':
      return (
        <>
          <StripBase L={L} h={12.5} color={color} />
          <line x1={-half} y1={0} x2={half} y2={0} stroke={SAND} strokeWidth="8.6" strokeLinecap="round" />
          <line x1={-half + 1} y1={0} x2={half - 1} y2={0} stroke={color} strokeWidth="8.6" strokeDasharray="4.2 3.4" />
          <line x1={-half} y1={2.6} x2={half} y2={2.6} stroke={SAND_DARK} strokeWidth="1.4" />
        </>
      );
    case 'pieces:kunai':
      return (
        <>
          <StripBase L={L} h={12} color={color} />
          <line x1={-half} y1={0} x2={half} y2={0} stroke={color} strokeWidth="8" strokeLinecap="round" />
          <path d={`M ${-half + 6} 0 L ${-half + 15} -3.4 L ${half - 9} -1.4 L ${half - 3} 0 L ${half - 9} 1.4 L ${-half + 15} 3.4 Z`} fill={STEEL} stroke={PIECE_INK} strokeWidth="1" strokeLinejoin="round" />
          <path d={`M ${-half + 6} 0 L ${half - 3} 0 L ${half - 9} -1.4 L ${-half + 15} -3.4 Z`} fill={STEEL_LIGHT} />
          <circle cx={-half + 4} cy="0" r="2.6" fill="none" stroke={PIECE_INK} strokeWidth="1.4" />
        </>
      );
    case 'pieces:lantern': {
      const pts = [-0.32, 0, 0.32].map((t) => [t * L, 0]);
      return (
        <>
          <line x1={-half} y1={0} x2={half} y2={0} stroke={PIECE_INK} strokeWidth="4" strokeLinecap="round" />
          <line x1={-half} y1={0} x2={half} y2={0} stroke={WOOD} strokeWidth="2" strokeLinecap="round" />
          {pts.map(([x], i) => <circle key={i} cx={x} cy="0" r="7" fill={shade(color, 0.35)} opacity="0.3" />)}
          <Dotted points={pts} r={3.6} fill={color} light={shade(color, 0.6)} />
        </>
      );
    }
    case 'pieces:crimson':
      return (
        <>
          <StripBase L={L} h={13} color={color} />
          <line x1={-half} y1={0} x2={half} y2={0} stroke={BLACK} strokeWidth="9.4" strokeLinecap="round" />
          <line x1={-half} y1={-3.6} x2={half} y2={-3.6} stroke={color} strokeWidth="2.2" strokeLinecap="round" />
          <line x1={-half} y1={3.6} x2={half} y2={3.6} stroke={color} strokeWidth="2.2" strokeLinecap="round" />
          <path d={CLOUD} transform="translate(0 0.6) scale(0.9)" fill={CLOUD_RED} stroke="#f3ede1" strokeWidth="0.5" />
        </>
      );
    case 'pieces:toad': {
      const pts = [-0.34, 0, 0.34].map((t) => [t * L, 0]);
      return <Dotted points={pts} r={4.4} fill={color} light={shade(color, 0.45)} />;
    }
    default:
      return (
        <>
          <StripBase L={L} color={color} />
          <line x1={-half} y1={0} x2={half} y2={0} stroke={color} strokeWidth="8.6" strokeLinecap="round" />
          <line x1={-half} y1={0} x2={half} y2={0} stroke={shade(color, -0.45)} strokeWidth="8.6" strokeDasharray="1.2 4.2" strokeDashoffset="-2" />
          <line x1={-half} y1={0} x2={half} y2={0} stroke={shade(color, 0.5)} strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
  }
}

/** A built road between two points (board px) */
export const RoadArt = memo(function RoadArt({ set, x1, y1, x2, y2, color }) {
  const L = Math.hypot(x2 - x1, y2 - y1);
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  const id = pieceSetOf(set);
  const dotted = id === 'pieces:lantern' || id === 'pieces:toad';
  return (
    <>
      {/* Shadow in board space (always down-right, whatever the edge angle) */}
      {!dotted && (
        <line x1={x1 + 1.6} y1={y1 + 3.2} x2={x2 + 1.6} y2={y2 + 3.2} stroke="#05070c" strokeOpacity="0.5" strokeWidth="14" strokeLinecap="round" />
      )}
      <g transform={`translate(${(x1 + x2) / 2} ${(y1 + y2) / 2}) rotate(${angle})`}>
        <RoadShape set={id} L={L} color={color} />
      </g>
    </>
  );
});
