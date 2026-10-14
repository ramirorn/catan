import { useGame } from '../../context/GameContext';
import { PHASE } from '../../utils/constants';
import { pieceColor, shade } from '../../utils/theme';

export function Vertex({ vertex }) {
  const {
    gameState,
    myPlayerId,
    isMyTurn,
    canActOnBoard,
    buildMode,
    setupPlaceSettlement,
    buildSettlement,
    buildCity,
  } = useGame();

  const isSetup =
    gameState?.phase === PHASE.SETUP_FORWARD ||
    gameState?.phase === PHASE.SETUP_REVERSE;

  const validSettlements = gameState?.validPlacements?.validSettlements || [];
  const validCities = gameState?.validPlacements?.validCities || [];

  const isValidSetupSettlement = isSetup && isMyTurn && validSettlements.includes(vertex.id);
  const isValidMainSettlement =
    !isSetup && canActOnBoard && buildMode === 'settlement' && validSettlements.includes(vertex.id);
  const isValidMainCity =
    !isSetup && canActOnBoard && buildMode === 'city' && validCities.includes(vertex.id);

  const isValidSpot = isValidSetupSettlement || isValidMainSettlement || isValidMainCity;

  const handleClick = (e) => {
    e.stopPropagation();
    if (isValidSetupSettlement) {
      setupPlaceSettlement(vertex.id);
    } else if (isValidMainSettlement) {
      buildSettlement(vertex.id);
    } else if (isValidMainCity) {
      buildCity(vertex.id);
    }
  };

  const building = vertex.building;
  const player = building ? gameState?.players?.[building.playerId] : null;
  const playerColor = pieceColor(player ? player.color : '#e74c3c');
  const dark = shade(playerColor, -0.6);
  const side = shade(playerColor, -0.22);
  const light = shade(playerColor, 0.35);

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

      {/* Settlement: a village house with curved eaves */}
      {building?.type === 'settlement' && (
        <g className="piece" filter="url(#piece-shadow)">
          <g transform="scale(1.55)">
          <path d="M -6 0 V 7.5 H 6 V 0 Z" fill={side} stroke={dark} strokeWidth="1" strokeLinejoin="round" />
          <rect x="-1.6" y="3" width="3.2" height="4.5" fill={dark} />
          <path d="M -9.5 0.8 Q -4.5 -0.6 0 -8.5 Q 4.5 -0.6 9.5 0.8 Z" fill={playerColor} stroke={dark} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M -8 0.1 Q -3.8 -1.2 0 -7.4" stroke={light} strokeWidth="1.1" fill="none" strokeLinecap="round" />
          </g>
        </g>
      )}

      {/* City: a two-tiered tower with sweeping roofs */}
      {building?.type === 'city' && (
        <g className="piece" filter="url(#piece-shadow)">
          <g transform="scale(1.45)">
          <path d="M -8 2.5 V 10 H 8 V 2.5 Z" fill={side} stroke={dark} strokeWidth="1" strokeLinejoin="round" />
          <rect x="-1.8" y="5.2" width="3.6" height="4.8" fill={dark} />
          <rect x="-6" y="4.6" width="2" height="2" fill={dark} opacity="0.75" />
          <rect x="4" y="4.6" width="2" height="2" fill={dark} opacity="0.75" />
          <path d="M -12.5 3.2 Q -6.5 2 -5 -1.5 H 5 Q 6.5 2 12.5 3.2 Z" fill={playerColor} stroke={dark} strokeWidth="1" strokeLinejoin="round" />
          <path d="M -4.5 -1.5 V -6 H 4.5 V -1.5 Z" fill={side} stroke={dark} strokeWidth="1" strokeLinejoin="round" />
          <rect x="-1.4" y="-4.8" width="2.8" height="2.2" fill={dark} opacity="0.8" />
          <path d="M -8.5 -5.2 Q -3.5 -6.4 0 -12.5 Q 3.5 -6.4 8.5 -5.2 Z" fill={playerColor} stroke={dark} strokeWidth="1" strokeLinejoin="round" />
          <path d="M -7 -5.8 Q -3 -7 0 -11.4" stroke={light} strokeWidth="1" fill="none" strokeLinecap="round" />
          <path d="M 0 -12.5 V -15.5" stroke={dark} strokeWidth="1.1" strokeLinecap="round" />
          </g>
        </g>
      )}

      {/* Upgrade hint drawn above the settlement */}
      {isValidSpot && building && (
        <g className="spot-marker" style={{ cursor: 'pointer' }}>
          <circle r="21" fill="none" stroke="#1f1b17" strokeOpacity="0.55" strokeWidth="4" />
          <circle r="21" fill="none" stroke="#f6a04b" strokeWidth="2" strokeDasharray="4 3" className="spot-ring" />
        </g>
      )}
    </g>
  );
}
