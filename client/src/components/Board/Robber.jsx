import { useId } from 'react';
import { useFxHidden } from '../Effects/fxSignal';
import { useShownRobberFace } from '../RobberFace/robberFaceStore';

/** A small red cloud, outlined in white, printed on the rogue's cloak */
function Cloud({ x, y, s = 1 }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M-3.4 1.4 a1.5 1.5 0 0 1 0.4 -2.6 a2.1 2.1 0 0 1 3.4 -1 a1.7 1.7 0 0 1 2.9 0.8 a1.4 1.4 0 0 1 0.3 2.8 Z"
      fill="#c0271b"
      stroke="#f3ede1"
      strokeWidth="0.6"
      strokeLinejoin="round"
    />
  );
}

// The robber: a rogue ninja in a dark high-collared cloak and a straw hat.
// With «Cara del ladrón» the photo shows in a round frame under a raised hat.
export function Robber({ x, y }) {
  // Hidden while the leap animation carries the rogue to this hex
  const hidden = useFxHidden('robber');
  const face = useShownRobberFace();
  const clipId = `robber-face-${useId().replace(/:/g, '')}`;
  if (hidden) return null;
  const lift = face ? -5 : 0;
  return (
    <g transform={`translate(${x}, ${y - 4}) scale(1.3)`} pointerEvents="none">
      <ellipse cx="0" cy="16" rx="12" ry="3.6" fill="#07090f" opacity="0.45" />

      {/* Cloak */}
      <path d="M-11 16 C-10.4 7 -8.4 -1 -5.6 -5 L5.6 -5 C8.4 -1 10.4 7 11 16 Z" fill="#141419" />
      <path d="M1.5 -5 L5.6 -5 C8.4 -1 10.4 7 11 16 L4.5 16 C5.2 8 4 1 1.5 -5 Z" fill="#0a0a0d" />
      <path d="M0 -4 V16" stroke="#2c2c34" strokeWidth="0.6" />
      <Cloud x={-4.6} y={4} />
      <Cloud x={5.4} y={10.5} s={0.9} />
      <Cloud x={-6.4} y={12.6} s={0.75} />

      {/* High collar and the shadowed face */}
      <path d="M-6 -5 L-5.4 -9.4 H5.4 L6 -5 Z" fill="#1c1c22" />
      {face ? (
        <>
          <clipPath id={clipId}>
            <circle cx="0" cy="-11.6" r="5.6" />
          </clipPath>
          <circle cx="0" cy="-11.6" r="6.1" fill="#0b0b0e" />
          <image href={face.image} x="-7" y="-18.6" width="14" height="14" clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
        </>
      ) : (
        <>
          <rect x="-4.2" y="-10.8" width="8.4" height="1.8" fill="#0b0b0e" />
          <path d="M0.6 -9.9 h2.2" stroke="#efe7d6" strokeWidth="0.7" strokeLinecap="round" />
        </>
      )}

      {/* Conical straw hat with hanging paper strips */}
      <g transform={`translate(0 ${lift})`}>
      <path d="M-13 -10.4 L0 -18.6 L13 -10.4 Q0 -8.2 -13 -10.4 Z" fill="#cfae6c" stroke="#5b4520" strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M0 -18.6 L-6.5 -9.3 M0 -18.6 L6.5 -9.3 M0 -18.6 V-8.8" stroke="#8d6f35" strokeWidth="0.45" />
      <path d="M-9.5 -9.4 v4 M-7 -9 v3 M7 -9 v3 M9.5 -9.4 v4" stroke="#efe7d6" strokeWidth="0.9" strokeLinecap="round" />
      </g>
    </g>
  );
}
