// Presentation helpers: maps the server's flat player colours to
// lacquered tones that sit well on washi and ink, plus small colour math.

const PIECE_TONES = {
  '#e74c3c': '#b23a2a', // rojo  -> lacquered red
  '#3498db': '#2f5f8f', // azul  -> indigo
  '#f39c12': '#e07a22', // naranja -> chakra orange
  '#2ecc71': '#4c7a3a', // verde -> leaf
  '#9b59b6': '#6d4a80', // morado -> plum
  '#1abc9c': '#2d7c72', // turquesa -> verdigris
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
