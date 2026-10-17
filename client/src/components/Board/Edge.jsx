import { memo } from 'react';
import { useGame } from '../../context/GameContext';
import { edgeActionFor, runEdgeAction } from './boardActions';
import { pieceColor } from '../../utils/theme';
import { RoadArt } from './pieceArt2D';

export const Edge = memo(function Edge({ edge }) {
  const game = useGame();
  const { gameState } = game;

  const action = edgeActionFor(game, edge.id);
  const isValidSpot = action !== null;

  const handleClick = (e) => {
    e.stopPropagation();
    runEdgeAction(game, action, edge.id);
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

      {/* Built road in the owner's shop set (light rim + ink edges so it reads
          on any terrain). No SVG filter: a filter on a perfectly vertical /
          horizontal line has a zero-size bounding box and gets dropped. */}
      {road && (
        <g className="road-built">
          <RoadArt set={player?.pieceSet} x1={rx1} y1={ry1} x2={rx2} y2={ry2} color={playerColor} />
        </g>
      )}
    </g>
  );
});
