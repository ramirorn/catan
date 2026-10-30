// Admin board (premium): every resource tile becomes a lacquer panel with a
// gold double fillet, gold corner ornaments, scattered gold leaf and a gold
// seal with the resource's kanji near the top edge (clear of the number
// seal in the middle). Plain SVG, shared by the 2D tile and the 3D tile
// texture, so both boards show the same design.
import { getHexPoints, HEX_SIZE } from '../../utils/hexMath';
import { RESOURCE_KANJI } from '../../utils/theme';
import { seeded } from '../../utils/cosmetics';

const GOLD = '#e2b94e';
const GOLD_LIGHT = '#f7dc8c';
const GOLD_DARK = '#8a6520';
const LACQUER = '#15110c';

const TERRAIN_RESOURCE = { forest: 'wood', hills: 'brick', pasture: 'sheep', fields: 'wheat', mountains: 'ore' };

/** Gold flecks: fixed per terrain, so every tile of a kind looks the same */
const FLECKS = Object.fromEntries(
  Object.keys(TERRAIN_RESOURCE).concat('desert').map((terrain, t) => {
    const rand = seeded(t * 97 + 13);
    const list = [];
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2;
      const r = HEX_SIZE * (0.42 + rand() * 0.34);
      list.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, w: 1.6 + rand() * 2.2, rot: rand() * 180 });
    }
    return [terrain, list];
  })
);

export function PremiumTileFrame({ terrain, x = 0, y = 0 }) {
  const outer = getHexPoints(x, y, HEX_SIZE - 3.2);
  const fillet = getHexPoints(x, y, HEX_SIZE - 8);
  const fine = getHexPoints(x, y, HEX_SIZE - 10.4);
  const kanji = RESOURCE_KANJI[TERRAIN_RESOURCE[terrain]];
  const corners = getHexPoints(x, y, HEX_SIZE - 8)
    .split(' ')
    .map((p) => p.split(',').map(Number));
  const sealY = y - HEX_SIZE * 0.6;
  return (
    <g pointerEvents="none">
      {/* deep lacquer edge and a gold double fillet */}
      <polygon points={outer} fill="none" stroke={LACQUER} strokeOpacity="0.88" strokeWidth="6.4" strokeLinejoin="round" />
      <polygon points={fillet} fill="none" stroke={GOLD} strokeWidth="1.7" strokeLinejoin="round" />
      <polygon points={fine} fill="none" stroke={GOLD_LIGHT} strokeOpacity="0.7" strokeWidth="0.6" strokeLinejoin="round" />
      {/* gold diamonds on the corners */}
      {corners.map(([cx, cy], i) => (
        <path
          key={i}
          d={`M ${cx} ${cy - 3.2} L ${cx + 2.4} ${cy} L ${cx} ${cy + 3.2} L ${cx - 2.4} ${cy} Z`}
          fill={GOLD}
          stroke={GOLD_DARK}
          strokeWidth="0.6"
        />
      ))}
      {/* scattered gold leaf */}
      {FLECKS[terrain]?.map((f, i) => (
        <rect
          key={i}
          x={x + f.x - f.w / 2}
          y={y + f.y - f.w / 3}
          width={f.w}
          height={f.w * 0.66}
          fill={GOLD_LIGHT}
          opacity="0.7"
          transform={`rotate(${f.rot.toFixed(0)} ${(x + f.x).toFixed(1)} ${(y + f.y).toFixed(1)})`}
        />
      ))}
      {/* gold seal with the resource's kanji */}
      {kanji && (
        <g>
          <circle cx={x} cy={sealY} r="7.6" fill={LACQUER} stroke={GOLD} strokeWidth="1.4" />
          <circle cx={x} cy={sealY} r="5.9" fill="none" stroke={GOLD_DARK} strokeWidth="0.5" />
          <text
            x={x}
            y={sealY + 3.3}
            textAnchor="middle"
            fontFamily="'Shippori Mincho B1', Georgia, serif"
            fontWeight="800"
            fontSize="9"
            fill={GOLD_LIGHT}
          >
            {kanji}
          </text>
        </g>
      )}
    </g>
  );
}
