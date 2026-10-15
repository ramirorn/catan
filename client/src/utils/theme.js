// Presentation helpers: maps the server's flat player colours to
// saturated lacquer tones that read on washi, ink and the terrain art, plus small colour math.

const PIECE_TONES = {
  '#e74c3c': '#d23a26', // rojo  -> lacquered vermilion
  '#3498db': '#2a6fd0', // azul  -> bright indigo
  '#f39c12': '#f08a16', // naranja -> chakra orange
  '#2ecc71': '#2fa84a', // verde -> leaf
  '#9b59b6': '#8e4bbd', // morado -> plum
  '#1abc9c': '#14a796', // turquesa -> verdigris
};

export function pieceColor(color) {
  if (!color) return '#8a7860';
  return PIECE_TONES[color.toLowerCase()] || color;
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function shade(hex, amount) {
  const c = (hex || '#888888').replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const num = parseInt(full, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  if (amount < 0) {
    r *= 1 + amount;
    g *= 1 + amount;
    b *= 1 + amount;
  } else {
    r += (255 - r) * amount;
    g += (255 - g) * amount;
    b += (255 - b) * amount;
  }
  return `#${((1 << 24) + (clamp(r) << 16) + (clamp(g) << 8) + clamp(b)).toString(16).slice(1)}`;
}

export const RESOURCE_ORDER = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

// One kanji per resource, printed as a tiny vermilion seal on the cards
export const RESOURCE_KANJI = {
  wood: '木',
  brick: '土',
  sheep: '羊',
  wheat: '麦',
  ore: '石',
};

// Ground colour of each land terrain (board patterns + the wash over tile art)
export const TERRAIN_BASE = {
  forest: '#3b6a3c',
  hills: '#ad512c',
  pasture: '#93b45b',
  fields: '#d7a63c',
  mountains: '#75808d',
  desert: '#d9c08a',
};
