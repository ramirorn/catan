// Generates the PWA / home-screen icons in client/public from an SVG drawn
// here (original art: shuriken disc + vermilion hanko seal on night indigo,
// same look as favicon.svg). Run with:  npm run icons   (from client/)
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '../public');

// Palette (src/index.css tokens)
const NIGHT = '#141c2c';
const NIGHT_DARK = '#0b101b';
const NIGHT_LIGHT = '#24314b';
const INK = '#1f1b17';
const CHAKRA = '#e2711d';
const CHAKRA_LIGHT = '#f6a04b';
const SHU = '#b6331f';
const PAPER = '#f1e9d6';

/**
 * @param {number} k  size of the artwork relative to the 512 canvas
 *                    (1 = regular icon, smaller keeps it inside the
 *                    maskable safe zone)
 */
function iconSvg(k) {
  const c = 256;
  const r = 168 * k; // disc radius
  const star = (R, inner) => {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 2;
      const rad = i % 2 === 0 ? R : inner;
      pts.push(`${(c + rad * Math.cos(a)).toFixed(2)},${(c + rad * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
  };
  // hanko seal, lower right of the disc
  const s = 92 * k;
  const hx = c + r * 0.62;
  const hy = c + r * 0.62;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="sky" cx="50%" cy="44%" r="70%">
      <stop offset="0" stop-color="${NIGHT_LIGHT}"/>
      <stop offset="0.55" stop-color="${NIGHT}"/>
      <stop offset="1" stop-color="${NIGHT_DARK}"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="${CHAKRA}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${CHAKRA}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="disc" cx="40%" cy="35%" r="75%">
      <stop offset="0" stop-color="${CHAKRA_LIGHT}"/>
      <stop offset="0.6" stop-color="${CHAKRA}"/>
      <stop offset="1" stop-color="#a94f0c"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <circle cx="${c}" cy="${c}" r="${r * 1.45}" fill="url(#glow)"/>
  <circle cx="${c}" cy="${c}" r="${r + 10 * k}" fill="none" stroke="${PAPER}" stroke-opacity="0.18" stroke-width="${3 * k}"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="url(#disc)" stroke="${INK}" stroke-width="${9 * k}"/>
  <g transform="rotate(20 ${c} ${c})">
    <polygon points="${star(r * 0.86, r * 0.2)}" fill="${INK}"/>
  </g>
  <circle cx="${c}" cy="${c}" r="${r * 0.17}" fill="${CHAKRA}" stroke="${INK}" stroke-width="${4 * k}"/>
  <circle cx="${c}" cy="${c}" r="${r * 0.07}" fill="${INK}"/>
  <g transform="rotate(-8 ${hx} ${hy})">
    <rect x="${hx - s / 2}" y="${hy - s / 2}" width="${s}" height="${s}" rx="${10 * k}" fill="${SHU}" stroke="${INK}" stroke-width="${5 * k}"/>
    <rect x="${hx - s / 2 + 9 * k}" y="${hy - s / 2 + 9 * k}" width="${s - 18 * k}" height="${s - 18 * k}" rx="${4 * k}" fill="none" stroke="${PAPER}" stroke-width="${4 * k}"/>
    <path d="M${hx - s * 0.22} ${hy - s * 0.12} H${hx + s * 0.22} M${hx} ${hy - s * 0.24} V${hy + s * 0.24} M${hx - s * 0.2} ${hy + s * 0.12} L${hx + s * 0.2} ${hy + s * 0.12}" stroke="${PAPER}" stroke-width="${7 * k}" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}

function render(svg, size, file) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, background: NIGHT }).render().asPng();
  writeFileSync(join(publicDir, file), png);
  console.log(`  ${file} (${size}×${size}, ${png.length} bytes)`);
}

const regular = iconSvg(1);
const maskable = iconSvg(0.74); // keeps everything inside the 80 % safe circle

console.log('Generating icons in client/public:');
render(regular, 192, 'pwa-192x192.png');
render(regular, 512, 'pwa-512x512.png');
render(maskable, 512, 'maskable-512x512.png');
render(regular, 180, 'apple-touch-icon.png');
writeFileSync(join(publicDir, 'app-icon.svg'), regular);
console.log('  app-icon.svg');
