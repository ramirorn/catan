import { getHexPoints, HEX_SIZE } from '../../utils/hexMath';
import { canMoveRobberTo, pactProtectedId } from './boardActions';
import { NumberToken } from './NumberToken';
import { Robber } from './Robber';
import { TerrainArt } from './TerrainArt';
import { useGame } from '../../context/GameContext';
import { memo } from 'react';
import { TERRAIN_BASE } from '../../utils/theme';

export const HexTile = memo(function HexTile({ hex, wash = null }) {
  const game = useGame();
  const canPlaceRobberHere = canMoveRobberTo(game, hex);
  // A signed peace pact keeps the robber off this hex (shown to the mover)
  const gs = game.gameState;
  const shielded = game.isMyTurn && !!pactProtectedId(gs) && !hex.hasRobber &&
    Array.isArray(gs.robberHexes) && !gs.robberHexes.includes(hex.id);

  const points = getHexPoints(hex.x, hex.y);
  const innerPoints = getHexPoints(hex.x, hex.y, HEX_SIZE - 4);
  const targetPoints = getHexPoints(hex.x, hex.y, HEX_SIZE - 9);

  // Safe id for the per-tile clip path (hex ids may contain commas)
  const clipId = `hexclip-${String(hex.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const handleClick = () => {
    if (canPlaceRobberHere) {
      game.moveRobber(hex.id);
    }
  };

  return (
    <g
      className={`hex-tile ${canPlaceRobberHere ? 'clickable' : ''}`}
      data-tip={`hex:${hex.id}`}
      onClick={handleClick}
      style={{ cursor: canPlaceRobberHere ? 'pointer' : 'default' }}
    >
      {/* Ground texture */}
      <polygon points={points} className={`hex-polygon ${hex.terrain}`} fill={`url(#pat-${hex.terrain})`} />

      {/* Hand-drawn scene for this terrain, clipped to the tile */}
      <clipPath id={clipId}>
        <polygon points={points} />
      </clipPath>
      <g className="hex-art" clipPath={`url(#${clipId})`}>
        <TerrainArt terrain={hex.terrain} x={hex.x} y={hex.y} />
      </g>
      {/* Ground-coloured wash: knocks back the scenery (little houses, torii,
          posts) so the players' pieces win the visual hierarchy */}
      {TERRAIN_BASE[hex.terrain] && (
        <polygon points={points} fill={TERRAIN_BASE[hex.terrain]} fillOpacity="0.32" pointerEvents="none" />
      )}
      {/* Board theme light wash (under the number seal, which stays crisp) */}
      {wash && <polygon points={points} fill={wash.color} fillOpacity={wash.opacity} pointerEvents="none" />}
      <polygon points={points} className="hex-polygon" fill="none" pointerEvents="none" />

      {/* Printed-tile depth: vignette + inner bevel */}
      <polygon points={points} fill="url(#hex-shade)" pointerEvents="none" />
      <polygon
        points={innerPoints}
        fill="none"
        stroke="#fff6dc"
        strokeOpacity="0.22"
        strokeWidth="1.4"
        pointerEvents="none"
      />

      {/* Robber destination hint */}
      <polygon points={targetPoints} className="robber-target" />
      {shielded && <polygon points={targetPoints} className="pact-shield" />}

      {/* Number token if not desert and not occupied by robber */}
      {hex.number && !hex.hasRobber && (
        <NumberToken number={hex.number} x={hex.x} y={hex.y} />
      )}

      {/* Robber if on this hex */}
      {hex.hasRobber && <Robber x={hex.x} y={hex.y} />}
    </g>
  );
});
