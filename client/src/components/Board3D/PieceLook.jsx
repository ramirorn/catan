// Separation of a 3D player piece from the board, shared by the 3D board, the
// tutorial and the shop preview: a thin ink line in a deep shade of the
// owner's colour, a faint light rim tinted with that colour (only lifts the
// piece off dark or same-coloured tiles) and a soft contact shadow on the
// tile. Rendered as children of the piece mesh, so they follow its drop-in /
// rise animations and its visibility.

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import {
  NO_RAYCAST, PIECE_OUTLINE_PX, PIECE_RIM_OPACITY, PIECE_RIM_PX, PIECE_SHADOW_SIZE, PREMIUM_RIM, PREMIUM_RIM_OPACITY,
  pieceOutlineColor, pieceRimColor,
} from './pieceSets';

// `premium` (admin board): the light rim becomes a gold edge
export function PieceLook({ kind, color, shadow, premium = false }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const ink = useMemo(() => pieceOutlineColor(color), [color]);
  const rim = useMemo(() => (premium ? PREMIUM_RIM : pieceRimColor(color)), [color, premium]);
  const [sx, sz] = PIECE_SHADOW_SIZE[kind];
  return (
    <>
      <Outlines thickness={PIECE_OUTLINE_PX * dpr} color={ink} />
      <Outlines
        thickness={PIECE_RIM_PX * dpr}
        color={rim}
        transparent
        opacity={premium ? PREMIUM_RIM_OPACITY : PIECE_RIM_OPACITY}
      />
      {shadow && (
        <mesh
          geometry={shadow.geometry}
          material={shadow.material}
          scale={[sx, 1, sz]}
          position-y={0.004}
          raycast={NO_RAYCAST}
          renderOrder={-1}
        />
      )}
    </>
  );
}
