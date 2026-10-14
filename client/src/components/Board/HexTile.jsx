import { getHexPoints, HEX_SIZE } from '../../utils/hexMath';
import { PHASE } from '../../utils/constants';
import { NumberToken } from './NumberToken';
import { Robber } from './Robber';
import { TerrainArt } from './TerrainArt';
import { useGame } from '../../context/GameContext';

export function HexTile({ hex }) {
  const { gameState, isMyTurn, moveRobber } = useGame();

  const isRobberMovePhase = gameState?.phase === PHASE.ROBBER_MOVE && isMyTurn;
  const canPlaceRobberHere = isRobberMovePhase && !hex.hasRobber;

  const points = getHexPoints(hex.x, hex.y);
  const innerPoints = getHexPoints(hex.x, hex.y, HEX_SIZE - 4);
  const targetPoints = getHexPoints(hex.x, hex.y, HEX_SIZE - 9);

  // Safe id for the per-tile clip path (hex ids may contain commas)
  const clipId = `hexclip-${String(hex.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const handleClick = () => {
    if (canPlaceRobberHere) {
      moveRobber(hex.id);
    }
  };

  return (
    <g
      className={`hex-tile ${canPlaceRobberHere ? 'clickable' : ''}`}
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

      {/* Number token if not desert and not occupied by robber */}
      {hex.number && !hex.hasRobber && (
        <NumberToken number={hex.number} x={hex.x} y={hex.y} />
      )}

      {/* Robber if on this hex */}
      {hex.hasRobber && <Robber x={hex.x} y={hex.y} />}
    </g>
  );
}
