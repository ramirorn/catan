import { memo, useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useFxHidden } from '../Effects/fxSignal';
import { vertexActionFor, runVertexAction } from './boardActions';
import { pieceColor } from '../../utils/theme';
import { CityArt, SettlementArt } from './pieceArt2D';

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

      {/* Pieces in the owner's shop set, drawn the same for everyone */}
      {!hidden && building?.type === 'settlement' && (
        <g className="piece">
          <SettlementArt set={player?.pieceSet} color={playerColor} />
        </g>
      )}
      {!hidden && building?.type === 'city' && (
        <g className={`piece${rising ? ' piece-rise' : ''}`}>
          <CityArt set={player?.pieceSet} color={playerColor} />
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
});
