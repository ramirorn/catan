import { memo } from 'react';
import { useGame } from '../../context/GameContext';
import { edgeActionFor, runEdgeAction } from './boardActions';
import { pieceColor, shade } from '../../utils/theme';

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

      {/* Built road: a plank bridge painted in the player's colour, with a
          light rim + ink edges so it reads on any terrain */}
      {road && (
        // No SVG filter here: a filter on a perfectly vertical/horizontal line
        // has a zero-size bounding box, so the browser drops the whole road.
        // The shadow is a plain offset line instead.
        <g className="road-built">
          <line x1={rx1 + 1.6} y1={ry1 + 3.2} x2={rx2 + 1.6} y2={ry2 + 3.2} stroke="#05070c" strokeOpacity="0.5" strokeWidth="14" strokeLinecap="round" />
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke="#fff4dc" strokeWidth="15.5" strokeLinecap="round" />
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke="#120e0b" strokeWidth="12.5" strokeLinecap="round" />
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke={playerColor} strokeWidth="8.6" strokeLinecap="round" />
          {/* Gaps between the planks */}
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke={shade(playerColor, -0.45)} strokeWidth="8.6" strokeDasharray="1.2 4.2" strokeDashoffset="-2" />
          <line x1={rx1} y1={ry1} x2={rx2} y2={ry2} stroke={shade(playerColor, 0.5)} strokeOpacity="0.7" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
});
