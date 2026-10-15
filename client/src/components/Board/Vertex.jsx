import { memo } from 'react';
import { useGame } from '../../context/GameContext';
import { vertexActionFor, runVertexAction } from './boardActions';
import { pieceColor, shade } from '../../utils/theme';

export const Vertex = memo(function Vertex({ vertex }) {
  const game = useGame();
  const { gameState } = game;

  const action = vertexActionFor(game, vertex.id);
  const isValidSpot = action !== null;

  const handleClick = (e) => {
    e.stopPropagation();
    runVertexAction(game, action, vertex.id);
  };

  const building = vertex.building;
  const player = building ? gameState?.players?.[building.playerId] : null;
  const playerColor = pieceColor(player ? player.color : '#e74c3c');

  return (
    <g
      className={`vertex-spot ${isValidSpot ? 'valid' : ''}`}
      transform={`translate(${vertex.x}, ${vertex.y})`}
      onClick={handleClick}
      pointerEvents={isValidSpot || building ? 'all' : 'none'}
    >
      {/* Invisible larger hover hit-target */}
      {isValidSpot && (
        <circle r="20" fill="transparent" style={{ cursor: 'pointer' }} />
      )}

      {/* Valid spot hint: a small chakra seal */}
      {isValidSpot && !building && (
        <g className="spot-marker" style={{ cursor: 'pointer' }}>
          <circle r="8" className="spot-dot" fill="#f6efdf" stroke="#1f1b17" strokeWidth="1.4" />
          <circle r="5.4" fill="none" stroke="#e2711d" strokeWidth="1.4" />
          <circle r="2" fill="#b6331f" />
        </g>
      )}

      {building?.type === 'settlement' && <SettlementPiece color={playerColor} />}
      {building?.type === 'city' && <CityPiece color={playerColor} />}

      {/* Upgrade hint drawn above the settlement */}
      {isValidSpot && building && (
        <g className="spot-marker" style={{ cursor: 'pointer' }}>
          <circle r="21" fill="none" stroke="#1f1b17" strokeOpacity="0.55" strokeWidth="4" />
          <circle r="21" fill="none" stroke="#f6a04b" strokeWidth="2" strokeDasharray="4 3" className="spot-ring" />
        </g>
      )}
    </g>
  );
});

/*
 * Player pieces. Every building is drawn as:
 *   offset shadow silhouette → player-colour base plate →
 *   light rim + thick ink outline of the silhouette → saturated colour fill.
 * The rim/outline pair makes the piece pop on any terrain art, and all
 * shadows are plain shapes (no SVG filter, which re-rasterises on zoom).
 */
const PIECE_INK = '#120e0b';
const PIECE_RIM = '#fff4dc';

// Silhouettes in piece-local units (centred on the vertex)
const SETTLEMENT_SIL = 'M -8 9 V 0 H -10.5 L 0 -11 L 10.5 0 H 8 V 9 Z';
const CITY_SIL = 'M -12.5 10 V -11 H -14.5 L -7 -20 L 0.5 -11 H -1.5 V -2 L 6 -10.5 L 15 -2 H 13 V 10 Z';

function BasePlate({ rx, color }) {
  return (
    <>
      <ellipse cx="0" cy="9.5" rx={rx + 1.6} ry="5.4" fill={PIECE_INK} />
      <ellipse cx="0" cy="9" rx={rx} ry="4.2" fill={color} />
      <ellipse cx="0" cy="8.2" rx={rx - 2.5} ry="2.4" fill={shade(color, 0.3)} opacity="0.55" />
    </>
  );
}

function Outline({ d }) {
  return (
    <>
      <path d={d} fill="none" stroke={PIECE_RIM} strokeWidth="6.4" strokeLinejoin="round" />
      <path d={d} fill={PIECE_INK} stroke={PIECE_INK} strokeWidth="3.6" strokeLinejoin="round" />
    </>
  );
}

function SettlementPiece({ color }) {
  const roof = shade(color, -0.32);
  const light = shade(color, 0.45);
  return (
    <g className="piece">
      <g transform="scale(1.22)">
        {/* Shadow */}
        <ellipse cx="2.2" cy="11" rx="14" ry="4.6" fill="#05070c" opacity="0.5" />
        <path d={SETTLEMENT_SIL} transform="translate(2.4 3)" fill="#05070c" opacity="0.45" />
        <BasePlate rx={12} color={color} />
        <Outline d={SETTLEMENT_SIL} />
        {/* Walls */}
        <path d="M -8 0 H 8 V 9 H -8 Z" fill={color} />
        <path d="M 3.5 0 H 8 V 9 H 3.5 Z" fill={shade(color, -0.18)} />
        <rect x="-2" y="3.4" width="4" height="5.6" rx="0.6" fill={PIECE_INK} />
        {/* Roof */}
        <path d="M -10.5 0 L 0 -11 L 10.5 0 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M -8 -1.4 L 0 -9.4" stroke={light} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M -8 0 H 8" stroke={PIECE_INK} strokeWidth="1" />
      </g>
    </g>
  );
}

function CityPiece({ color }) {
  const roof = shade(color, -0.32);
  const side = shade(color, -0.18);
  const light = shade(color, 0.45);
  return (
    <g className="piece">
      <g transform="scale(1.12) translate(-0.5 0)">
        {/* Shadow */}
        <ellipse cx="2.4" cy="12" rx="18" ry="5" fill="#05070c" opacity="0.5" />
        <path d={CITY_SIL} transform="translate(2.6 3.2)" fill="#05070c" opacity="0.45" />
        <BasePlate rx={16.5} color={color} />
        <Outline d={CITY_SIL} />
        {/* Hall */}
        <path d="M -1.5 -2 H 13 V 10 H -1.5 Z" fill={color} />
        <path d="M 9 -2 H 13 V 10 H 9 Z" fill={side} />
        <rect x="3.2" y="3.4" width="4.4" height="6.6" rx="0.6" fill={PIECE_INK} />
        <path d="M -1.5 -2 L 6 -10.5 L 15 -2 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M 1.5 -3.2 L 6 -8.4" stroke={light} strokeWidth="1.4" strokeLinecap="round" />
        {/* Tower */}
        <path d="M -12.5 -11 H -1.5 V 10 H -12.5 Z" fill={color} stroke={PIECE_INK} strokeWidth="1" />
        <path d="M -5 -11 H -1.5 V 10 H -5 Z" fill={side} />
        <rect x="-9.6" y="-6.5" width="3.4" height="3.4" fill={PIECE_INK} />
        <rect x="-9.6" y="1" width="3.4" height="3.4" fill={PIECE_INK} />
        <path d="M -14.5 -11 L -7 -20 L 0.5 -11 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M -11.6 -12.2 L -7 -17.8" stroke={light} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M -7 -20 V -23.5" stroke={PIECE_INK} strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </g>
  );
}
