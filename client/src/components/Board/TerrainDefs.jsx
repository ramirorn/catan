// SVG <defs> for the shinobi-world board.
// Land patterns here are only the *ground* texture of each terrain (grass
// strokes, clay strata, sand ripples…); the illustrated scene of every tile
// (forest of the hidden village, clay rooftops, training grounds, paddies,
// sealed cliffs, sand domes) is drawn per tile by TerrainArt.jsx.
// Patterns use userSpaceOnUse so the ground flows seamlessly across tiles.

import { TERRAIN_BASE } from '../../utils/theme';

// Static noise tile (rasterised once by the browser, then reused)
const GRAIN_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9 0.6' numOctaves='2' seed='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.16  0 0 0 0 0.13  0 0 0 0 0.1  0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E";

// Enlarges the ground texture drawn inside each land tile
const TILE_ART_SCALE = 1.7;

const CLASSIC_SEA = { base: '#1d4660', scale: '#1f4b66', stroke: '#12344a', ring: '#4f86a3' };

/** `sea` = sea pattern palette of the board theme (utils/cosmetics.js) */
export function TerrainDefs({ sea = CLASSIC_SEA }) {
  return (
    <defs>
      {/* Forest floor: moss and fallen-leaf brush ticks */}
      <pattern id="pat-forest" width="22" height="18" patternUnits="userSpaceOnUse" patternTransform={`scale(${TILE_ART_SCALE})`}>
        <rect width="22" height="18" fill={TERRAIN_BASE.forest} />
        <g stroke="#30573a" strokeWidth="0.9" fill="none" strokeLinecap="round">
          <path d="M2 5 q2 -1.6 4 0 M13 13 q2 -1.6 4 0" />
          <path d="M16 3 l1.4 1.2 M6 14 l1.4 -1.2" />
        </g>
        <path d="M9 8 q1.4 -1 2.8 0" stroke="#4f8049" strokeWidth="0.7" fill="none" strokeLinecap="round" />
      </pattern>

      {/* Clay ground: strata lines */}
      <pattern id="pat-hills" width="30" height="12" patternUnits="userSpaceOnUse" patternTransform={`scale(${TILE_ART_SCALE})`}>
        <rect width="30" height="12" fill={TERRAIN_BASE.hills} />
        <path d="M0 4 q7.5 -2 15 0 t15 0" stroke="#963f1f" strokeWidth="0.8" fill="none" />
        <path d="M0 9.5 q7.5 -1.6 15 0 t15 0" stroke="#c4683c" strokeWidth="0.8" fill="none" />
      </pattern>

      {/* Training-ground grass: brushed tufts */}
      <pattern id="pat-pasture" width="26" height="22" patternUnits="userSpaceOnUse" patternTransform={`scale(${TILE_ART_SCALE})`}>
        <rect width="26" height="22" fill={TERRAIN_BASE.pasture} />
        <g stroke="#7a9b45" strokeWidth="0.8" fill="none" strokeLinecap="round">
          <path d="M4 8 l0.8 -2.4 M6 8 l-0.8 -2.4" />
          <path d="M17 19 l0.8 -2.4 M19 19 l-0.8 -2.4" />
          <path d="M20 6 l0.6 -2 M21.6 6 l-0.6 -2" />
        </g>
      </pattern>

      {/* Fields: golden grain rows with ears */}
      <pattern id="pat-fields" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform={`rotate(-28) scale(${TILE_ART_SCALE})`}>
        <rect width="12" height="12" fill={TERRAIN_BASE.fields} />
        <rect y="0" width="12" height="5" fill="#e6bd58" />
        <path d="M0 5.5 H12" stroke="#a7781f" strokeWidth="0.9" />
        <g fill="#b78520">
          <ellipse cx="2" cy="2.6" rx="0.55" ry="1.2" />
          <ellipse cx="5" cy="2.3" rx="0.55" ry="1.3" />
          <ellipse cx="8" cy="2.6" rx="0.55" ry="1.2" />
          <ellipse cx="11" cy="2.3" rx="0.55" ry="1.3" />
        </g>
        <path d="M2 4.6 v-1 M5 4.6 v-1 M8 4.6 v-1 M11 4.6 v-1" stroke="#8f6418" strokeWidth="0.5" />
        <path d="M0 11.4 H12" stroke="#bf8f30" strokeWidth="0.6" opacity="0.6" />
      </pattern>

      {/* Rock ground: ink hatching and a drifting mist line */}
      <pattern id="pat-mountains" width="24" height="20" patternUnits="userSpaceOnUse" patternTransform={`scale(${TILE_ART_SCALE})`}>
        <rect width="24" height="20" fill={TERRAIN_BASE.mountains} />
        <g stroke="#5d6773" strokeWidth="0.7" strokeLinecap="round">
          <path d="M3 6 l2 -3 M5 7 l2 -3 M15 16 l2 -3 M17 17 l2 -3" />
        </g>
        <path d="M0 12 q6 -1.4 12 0 t12 0" stroke="#dfe6eb" strokeWidth="0.9" fill="none" opacity="0.3" />
      </pattern>

      {/* Desert: wind-combed sand ripples */}
      <pattern id="pat-desert" width="36" height="20" patternUnits="userSpaceOnUse" patternTransform={`scale(${TILE_ART_SCALE})`}>
        <rect width="36" height="20" fill={TERRAIN_BASE.desert} />
        <path d="M0 7 q9 -5 18 0 t18 0" stroke="#c4a46a" strokeWidth="0.9" fill="none" />
        <path d="M-9 17 q9 -5 18 0 t18 0 t18 0" stroke="#cdb07a" strokeWidth="0.7" fill="none" />
      </pattern>

      {/* Sea: seigaiha wave scales */}
      <pattern id="pat-sea" width="20" height="10" patternUnits="userSpaceOnUse" patternTransform="scale(1.3)">
        <rect width="20" height="10" fill={sea.base} />
        {[[0, 0], [20, 0], [10, 5], [0, 10], [20, 10]].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r="10" fill={sea.scale} stroke={sea.stroke} strokeWidth="0.8" />
            <circle cx={cx} cy={cy} r="7.5" fill="none" stroke={sea.ring} strokeWidth="0.6" opacity="0.65" />
            <circle cx={cx} cy={cy} r="5" fill="none" stroke={sea.ring} strokeWidth="0.6" opacity="0.55" />
            <circle cx={cx} cy={cy} r="2.5" fill="none" stroke={sea.ring} strokeWidth="0.6" opacity="0.45" />
          </g>
        ))}
      </pattern>

      {/* Per-tile vignette for a printed-tile look */}
      <radialGradient id="hex-shade" cx="50%" cy="45%" r="60%">
        <stop offset="55%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#120d08" stopOpacity="0.3" />
      </radialGradient>

      {/* Washi grain: a pre-rendered noise tile used as a pattern. (A live
          feTurbulence filter + mix-blend-mode over the whole board was
          re-rasterised in tiles on every zoom step, which showed up as darker
          bands/seams and made zooming stutter.) */}
      <pattern id="pat-grain" width="160" height="160" patternUnits="userSpaceOnUse">
        <image href={GRAIN_URI} width="160" height="160" />
      </pattern>
    </defs>
  );
}
