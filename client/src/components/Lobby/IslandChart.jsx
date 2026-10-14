import { getHexPoints, HEX_SIZE, SQRT3 } from '../../utils/hexMath';
import { TerrainDefs } from '../Board/TerrainDefs';
import { NumberToken } from '../Board/NumberToken';
import { TerrainArt } from '../Board/TerrainArt';

// Decorative, static chart of the island for the title screens.
const LAYOUT = [
  // [q, r, terrain, number]
  [0, -2, 'mountains', 10], [1, -2, 'pasture', 2], [2, -2, 'forest', 9],
  [-1, -1, 'fields', 12], [0, -1, 'hills', 6], [1, -1, 'pasture', 4], [2, -1, 'hills', 10],
  [-2, 0, 'fields', 9], [-1, 0, 'forest', 11], [0, 0, 'desert', null], [1, 0, 'forest', 3], [2, 0, 'mountains', 8],
  [-2, 1, 'forest', 8], [-1, 1, 'mountains', 3], [0, 1, 'fields', 4], [1, 1, 'pasture', 5],
  [-2, 2, 'hills', 5], [-1, 2, 'fields', 6], [0, 2, 'pasture', 11],
];

const HEXES = LAYOUT.map(([q, r, terrain, number]) => ({
  id: `${q},${r}`,
  x: HEX_SIZE * SQRT3 * (q + r / 2),
  y: HEX_SIZE * 1.5 * r,
  terrain,
  number,
}));

export function IslandChart({ className = '' }) {
  const extent = HEX_SIZE * 5.8;
  return (
    <svg
      viewBox={`${-extent} ${-extent} ${extent * 2} ${extent * 2}`}
      className={className}
      role="img"
      aria-label="Mapa ilustrado del país shinobi"
    >
      <TerrainDefs />

      <g opacity="0.5" transform="translate(4 10)">
        {HEXES.map((h) => (
          <polygon key={`s-${h.id}`} points={getHexPoints(h.x, h.y, HEX_SIZE * 2)} fill="#03050a" stroke="#03050a" strokeWidth="12" strokeLinejoin="round" />
        ))}
      </g>
      {HEXES.map((h) => (
        <polygon key={`f-${h.id}`} points={getHexPoints(h.x, h.y, HEX_SIZE * 2)} fill="#efe6d0" stroke="#efe6d0" strokeWidth="8" strokeLinejoin="round" />
      ))}
      {HEXES.map((h) => (
        <polygon key={`l-${h.id}`} points={getHexPoints(h.x, h.y, HEX_SIZE * 1.88)} fill="#1f1b17" />
      ))}
      {HEXES.map((h) => (
        <polygon key={`w-${h.id}`} points={getHexPoints(h.x, h.y, HEX_SIZE * 1.85)} fill="url(#pat-sea)" />
      ))}
      {HEXES.map((h) => (
        <polygon key={`b-${h.id}`} points={getHexPoints(h.x, h.y, HEX_SIZE * 1.1)} fill="#d6bf8a" stroke="#d6bf8a" strokeWidth="6" strokeLinejoin="round" />
      ))}

      {HEXES.map((h) => (
        <g key={h.id}>
          <polygon points={getHexPoints(h.x, h.y)} fill={`url(#pat-${h.terrain})`} />
          <clipPath id={`chartclip-${h.id.replace(',', '_')}`}>
            <polygon points={getHexPoints(h.x, h.y)} />
          </clipPath>
          <g clipPath={`url(#chartclip-${h.id.replace(',', '_')})`}>
            <TerrainArt terrain={h.terrain} x={h.x} y={h.y} />
          </g>
          <polygon points={getHexPoints(h.x, h.y)} fill="url(#hex-shade)" stroke="rgba(31,27,23,0.85)" strokeWidth="1.6" strokeLinejoin="round" />
          {h.number && <NumberToken number={h.number} x={h.x} y={h.y} />}
        </g>
      ))}

      {/* A thrown shuriken resting in the open sea */}
      <g transform={`translate(${HEX_SIZE * 4.7} ${-HEX_SIZE * 4.55}) rotate(18)`}>
        <path d="M0 -26 L5 -5 L26 0 L5 5 L0 26 L-5 5 L-26 0 L-5 -5 Z" fill="#1f1b17" stroke="#efe6d0" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M0 -26 L5 -5 L0 0 Z M26 0 L5 5 L0 0 Z M0 26 L-5 5 L0 0 Z M-26 0 L-5 -5 L0 0 Z" fill="#59626c" />
        <circle r="4.2" fill="#1d4660" stroke="#efe6d0" strokeWidth="1.4" />
      </g>
    </svg>
  );
}
