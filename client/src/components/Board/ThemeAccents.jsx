// Static decorations a board theme scatters on the sea around the island
// (2D). Computed once per map, drawn under the harbours and the tiles,
// pointer-events off, no filters.
import { memo } from 'react';

const STAR = 'M0 -5 L1.2 -1.2 L5 0 L1.2 1.2 L0 5 L-1.2 1.2 L-5 0 L-1.2 -1.2 Z';
const MOON = 'M 0 -12 A 12 12 0 1 0 0 12 A 9 9 0 1 1 0 -12 Z';
const PETAL = 'M 0 0 C 2 -2.4 5.6 -2 6.2 0 C 5.6 2 2 2.4 0 0 Z';

function Glyph({ kind, p, i }) {
  const t = `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`;
  switch (kind) {
    case 'stars':
      if (i === 0) return <path d={MOON} transform={`${t} scale(1.4)`} fill="#f4e9b8" opacity="0.85" />;
      return (
        <g transform={`${t} scale(${p.s.toFixed(2)})`} fill="#f4e9b8">
          <path d={STAR} opacity="0.85" />
          <circle cx={9 + p.r * 6} cy={-7} r="1.1" opacity="0.6" />
          <circle cx={-10} cy={6 + p.r * 4} r="0.9" opacity="0.5" />
        </g>
      );
    case 'dunes':
      return (
        <g transform={`${t} rotate(${(p.r * 30 - 15).toFixed(0)}) scale(${p.s.toFixed(2)})`} fill="none" strokeLinecap="round">
          <path d="M -16 3 Q -6 -6 4 0 T 18 -1" stroke="#9c7742" strokeWidth="1.8" opacity="0.65" />
          <path d="M -10 8 Q -2 2 7 6" stroke="#ecd6a6" strokeWidth="1.4" opacity="0.7" />
        </g>
      );
    case 'mist':
      return (
        <g transform={`${t} rotate(${(p.r * 16 - 8).toFixed(0)})`} fill="#eef3f6">
          <ellipse rx={24 * p.s} ry="4.6" opacity="0.24" />
          <ellipse cx="10" cy="7" rx={16 * p.s} ry="3.4" opacity="0.18" />
        </g>
      );
    case 'falls':
      if (i % 2) {
        return (
          <g transform={`${t} scale(${p.s.toFixed(2)})`}>
            <ellipse cx="0" cy="2" rx="9" ry="5.5" fill="#8c8778" stroke="#24221e" strokeWidth="1.2" />
            <ellipse cx="-2" cy="0.4" rx="5" ry="2.4" fill="#aaa596" />
          </g>
        );
      }
      return (
        <g transform={`${t} scale(${p.s.toFixed(2)})`} stroke="#eef6f2" strokeLinecap="round">
          <path d="M -5 -12 V 6 M 0 -14 V 9 M 5 -12 V 5" strokeWidth="2" opacity="0.6" />
          <ellipse cx="0" cy="10" rx="10" ry="3" fill="#eef6f2" stroke="none" opacity="0.35" />
        </g>
      );
    case 'petals':
      return (
        <g transform={`${t} rotate(${(p.a * 57.3).toFixed(0)}) scale(${p.s.toFixed(2)})`} fill="#f6b6c8" stroke="#cf5679" strokeWidth="0.5">
          {i % 3 === 0 ? (
            [0, 72, 144, 216, 288].map((a) => <path key={a} d={PETAL} transform={`rotate(${a})`} />)
          ) : (
            <>
              <path d={PETAL} />
              <path d={PETAL} transform="translate(9 5) rotate(130)" />
              <path d={PETAL} transform="translate(-7 8) rotate(250)" />
            </>
          )}
          {i % 3 === 0 && <circle r="1.3" fill="#f4d36b" stroke="none" />}
        </g>
      );
    default:
      return null;
  }
}

export const SeaAccents = memo(function SeaAccents({ kind, spots }) {
  if (!kind || !spots?.length) return null;
  return (
    <g pointerEvents="none">
      {spots.map((p, i) => (
        <Glyph key={i} kind={kind} p={p} i={i} />
      ))}
    </g>
  );
});
