import { useGame } from '../../context/GameContext';
import { PHASE } from '../../utils/constants';
import { pieceColor, shade } from '../../utils/theme';

export function Edge({ edge }) {
  const {
    gameState,
    isMyTurn,
    canActOnBoard,
    buildMode,
    setupPlaceRoad,
    buildRoad,
  } = useGame();

  const isSetup =
    gameState?.phase === PHASE.SETUP_FORWARD ||
    gameState?.phase === PHASE.SETUP_REVERSE;

  const validRoads = gameState?.validPlacements?.validRoads || [];

  const isValidSetupRoad = isSetup && isMyTurn && validRoads.includes(edge.id);
  const isValidMainRoad =
    !isSetup && canActOnBoard && buildMode === 'road' && validRoads.includes(edge.id);

  const isValidSpot = isValidSetupRoad || isValidMainRoad;

  const handleClick = (e) => {
    e.stopPropagation();
    if (isValidSetupRoad) {
      setupPlaceRoad(edge.id);
    } else if (isValidMainRoad) {
      buildRoad(edge.id);
    }
  };

  const road = edge.road;
  const player = road ? gameState?.players?.[road.playerId] : null;
  const playerColor = pieceColor(player ? player.color : '#e74c3c');

  // Road pieces sit between the corners, leaving room for buildings
  const inset = 0.2;
  const rx1 = edge.x1 + (edge.x2 - edge.x1) * inset;
  const ry1 = edge.y1 + (edge.y2 - edge.y1) * inset;
  const rx2 = edge.x2 - (edge.x2 - edge.x1) * inset;
  const ry2 = edge.y2 - (edge.y2 - edge.y1) * inset;

  return (
    <g
      className={`edge-spot ${isValidSpot ? 'valid' : ''}`}
      onClick={handleClick}
      pointerEvents={isValidSpot || road ? 'all' : 'none'}
    >
      {/* Invisible thicker hit-box line */}
      {isValidSpot && (
        <line
          x1={edge.x1}
          y1={edge.y1}
          x2={edge.x2}
          y2={edge.y2}
          stroke="transparent"
          strokeWidth="18"
          strokeLinecap="round"
          style={{ cursor: 'pointer' }}
        />
      )}

      {/* Valid road hint: a dashed path waiting to be laid */}
      {isValidSpot && (
        <g className="road-marker" style={{ cursor: 'pointer' }}>
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke="#1f1b17" strokeOpacity="0.6" strokeWidth="8" strokeLinecap="round" />
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke="#f6a04b" strokeWidth="4.2" strokeLinecap="round" strokeDasharray="5 4" />
        </g>
      )}

      {/* Built road: a plank bridge painted in the player's colour */}
      {road && (
        // No SVG filter here: a filter on a perfectly vertical/horizontal line
        // has a zero-size bounding box, so the browser drops the whole road.
        <g className="road-built">
          <line x1={rx1 + 0.6} y1={ry1 + 1.8} x2={rx2 + 0.6} y2={ry2 + 1.8} stroke="#07090f" strokeOpacity="0.5" strokeWidth="12" strokeLinecap="round" />
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke={shade(playerColor, -0.55)} strokeWidth="11" strokeLinecap="round" />
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke={playerColor} strokeWidth="8" strokeLinecap="round" />
          {/* Gaps between the planks */}
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke={shade(playerColor, -0.5)} strokeOpacity="0.7" strokeWidth="8" strokeDasharray="1 3.6" />
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke={shade(playerColor, 0.4)} strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}
