import { memo, useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useFxHidden } from '../Effects/fxSignal';
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

  // A city being upgraded stays hidden while the upgrade animation builds up,
  // then rises in place (shown identically to everyone)
  const hidden = useFxHidden(`vertex:${vertex.id}`);
  const wasHidden = useRef(hidden);
  const [rising, setRising] = useState(false);
  useEffect(() => {
    const was = wasHidden.current;
    wasHidden.current = hidden;
    if (!was || hidden) return undefined;
    setRising(true);
    const t = setTimeout(() => setRising(false), 700);
    return () => clearTimeout(t);
  }, [hidden]);

  return (
    <g
      className={`vertex-spot ${isValidSpot ? 'valid' : ''}`}
      transform={`translate(${vertex.x}, ${vertex.y})`}
      onClick={handleClick}
      pointerEvents={isValidSpot || building ? 'all' : 'none'}
      data-tip={building ? `vertex:${vertex.id}` : undefined}
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

      {!hidden && building?.type === 'settlement' && <SettlementPiece color={playerColor} />}
      {!hidden && building?.type === 'city' && <CityPiece color={playerColor} rising={rising} />}

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
const CITY_SIL =
  'M -9 10 V 0 H -15.5 Q -11 -0.8 -8 -5 H -6.5 V -11 H -12.5 Q -8.5 -11.8 -5.2 -15.5 H -4.6 V -20 H -10 Q -4 -21 0 -27 Q 4 -21 10 -20 H 4.6 V -15.5 H 5.2 Q 8.5 -11.8 12.5 -11 H 6.5 V -5 H 8 Q 11 -0.8 15.5 0 H 9 V 10 Z';

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

// Three-tier pagoda on a ringed plinth: taller, wider and with a different
// outline than the settlement's single house
function CityPiece({ color, rising }) {
  const roof = shade(color, -0.32);
  const side = shade(color, -0.18);
  const light = shade(color, 0.45);
  return (
    <g className={`piece${rising ? ' piece-rise' : ''}`}>
      <g transform="scale(1.12)">
        {/* Shadow */}
        <ellipse cx="2.4" cy="12" rx="20" ry="5.6" fill="#05070c" opacity="0.5" />
        <path d={CITY_SIL} transform="translate(2.6 3.2)" fill="#05070c" opacity="0.45" />
        {/* Stone plinth with a light ring: the city's footprint */}
        <ellipse cx="0" cy="9.8" rx="19.6" ry="6.4" fill={PIECE_INK} />
        <ellipse cx="0" cy="9.2" rx="18" ry="5.2" fill={color} />
        <ellipse cx="0" cy="9.2" rx="15.6" ry="4.1" fill="none" stroke={PIECE_RIM} strokeWidth="1.3" />
        <ellipse cx="0" cy="8.6" rx="11.5" ry="2.6" fill={shade(color, 0.3)} opacity="0.55" />
        <Outline d={CITY_SIL} />
        {/* Ground floor */}
        <path d="M -9 0 H 9 V 10 H -9 Z" fill={color} />
        <path d="M 4.5 0 H 9 V 10 H 4.5 Z" fill={side} />
        <rect x="-2.3" y="3.6" width="4.6" height="6.4" rx="0.6" fill={PIECE_INK} />
        <path d="M -15.5 0 Q -11 -0.8 -8 -5 H 8 Q 11 -0.8 15.5 0 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M -12.4 -0.9 Q -9.6 -2 -7.6 -4.2" stroke={light} strokeWidth="1.3" strokeLinecap="round" fill="none" />
        {/* Middle floor */}
        <path d="M -6.5 -5 H 6.5 V -11 H -6.5 Z" fill={color} />
        <path d="M 3 -5 H 6.5 V -11 H 3 Z" fill={side} />
        <rect x="-2" y="-9.6" width="4" height="3" fill={PIECE_INK} />
        <path d="M -12.5 -11 Q -8.5 -11.8 -5.2 -15.5 H 5.2 Q 8.5 -11.8 12.5 -11 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M -9.8 -11.8 Q -7.4 -12.8 -5.6 -14.6" stroke={light} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        {/* Top floor + roof */}
        <path d="M -4.6 -15.5 H 4.6 V -20 H -4.6 Z" fill={color} />
        <path d="M 2 -15.5 H 4.6 V -20 H 2 Z" fill={side} />
        <path d="M -10 -20 Q -4 -21 0 -27 Q 4 -21 10 -20 Z" fill={roof} stroke={PIECE_INK} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M -6.6 -20.8 Q -3 -22.2 -0.8 -25.4" stroke={light} strokeWidth="1.2" strokeLinecap="round" fill="none" />
        {/* Ringed spire */}
        <path d="M 0 -27 V -32.5" stroke={PIECE_INK} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M -1.8 -29 H 1.8 M -1.5 -30.8 H 1.5" stroke={PIECE_INK} strokeWidth="1" strokeLinecap="round" />
        <circle cx="0" cy="-33" r="1.4" fill={light} stroke={PIECE_INK} strokeWidth="0.8" />
      </g>
    </g>
  );
}
