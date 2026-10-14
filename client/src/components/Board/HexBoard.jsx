import { useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { computeBoardBounds, getHexPoints, HEX_SIZE } from '../../utils/hexMath';
import { pieceColor } from '../../utils/theme';
import { TerrainDefs } from './TerrainDefs';
import { PHASE_DESCRIPTIONS, PHASE } from '../../utils/constants';
import { HexTile } from './HexTile';
import { Edge } from './Edge';
import { Vertex } from './Vertex';
import { Port } from './Port';
import { useBoardZoom } from './useBoardZoom';
import { ZoomInIcon, ZoomOutIcon, FitIcon, KunaiIcon } from '../Shared/Icons';

export function HexBoard() {
  const { gameState, isMyTurn, isSpecialBuild, isMySpecialBuild, buildMode } = useGame();
  const board = gameState?.board;

  const bounds = useMemo(() => {
    return computeBoardBounds(board?.hexes, 72);
  }, [board?.hexes]);

  const zoom = useBoardZoom(bounds);

  if (!board) {
    return (
      <div className="flex-1 flex items-center justify-center font-serif italic text-paper-deep/70 text-base">
        Desplegando el pergamino del mapa…
      </div>
    );
  }

  const hexList = Object.values(board.hexes || {});
  const edgeList = Object.values(board.edges || {});
  const vertexList = Object.values(board.vertices || {});
  const portList = board.ports || [];

  const currentTurnPlayer = gameState.players?.[gameState.currentPlayerId];
  const specialBuilder = isSpecialBuild ? gameState.players?.[gameState.specialBuilderId] : null;
  // The banner speaks to whoever may act right now
  const bannerMine = isSpecialBuild ? isMySpecialBuild : isMyTurn;

  const buildNames = {
    road: 'CAMINO',
    settlement: 'POBLADO',
    city: 'CIUDAD',
  };

  // Helper description for banner
  let bannerText = PHASE_DESCRIPTIONS[gameState.phase] || '';
  if (isSpecialBuild) {
    if (isMySpecialBuild) {
      bannerText = buildMode
        ? `Construcción especial: selecciona un marcador resaltado para tu ${buildNames[buildMode] || buildMode.toUpperCase()}`
        : 'Tu construcción especial: construye o compra cartas, luego pulsa «Terminar construcción»';
    } else {
      bannerText = `Fase especial de construcción: turno de ${specialBuilder?.name || 'otro ninja'}…`;
    }
  } else if (isMyTurn) {
    if (gameState.phase === PHASE.MAIN) {
      if (buildMode) {
        bannerText = `Selecciona un marcador resaltado para construir tu ${buildNames[buildMode] || buildMode.toUpperCase()}`;
      } else {
        bannerText = 'Tu Turno: Lanza los dados, comercia, construye o pasa turno';
      }
    } else if (gameState.phase === PHASE.ROBBER_MOVE) {
      bannerText = 'Haz clic en otro hexágono para mover al ladrón renegado';
    }
  } else {
    bannerText = `Esperando a ${currentTurnPlayer?.name || 'oponente'} (${
      PHASE_DESCRIPTIONS[gameState.phase] || 'jugando'
    }...)`;
  }

  // Island centre, used to orient harbour badges out to sea
  const center = hexList.length
    ? {
        x: hexList.reduce((a, h) => a + h.x, 0) / hexList.length,
        y: hexList.reduce((a, h) => a + h.y, 0) / hexList.length,
      }
    : { x: 0, y: 0 };

  const turnColor = pieceColor((specialBuilder || currentTurnPlayer)?.color);

  return (
    <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden select-none pt-12 sm:pt-14 pb-2 px-2">
      {/* Turn / Action Phase Banner: a paper slip pinned to the table */}
      <div className="absolute top-3 sm:top-4 left-3 md:left-1/2 md:-translate-x-1/2 z-10 pointer-events-none w-max max-w-[calc(100%-8.5rem)] md:max-w-[calc(100%-2rem)]">
        <div
          key={bannerText}
          className="paper animate-fade-in flex items-stretch rounded-[1px] border border-ink/70 shadow-[0_6px_14px_-4px_rgba(0,0,0,0.7)] text-ink text-[13px] sm:text-sm leading-snug overflow-hidden"
        >
          <span
            className="w-2 shrink-0 border-r border-ink/40"
            style={{ backgroundColor: turnColor }}
            aria-hidden="true"
          />
          <span className="flex items-center gap-2 pl-2.5 pr-3.5 py-1.5">
            <KunaiIcon className={`w-4 h-4 shrink-0 ${bannerMine ? 'text-shu' : 'text-ink-faint'}`} />
            <span className={bannerMine ? 'font-bold' : 'font-medium text-ink-soft'}>{bannerText}</span>
          </span>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col paper border border-ink/70 rounded-[2px] shadow-[0_4px_10px_rgba(0,0,0,0.55)] overflow-hidden">
        <button type="button" onClick={zoom.zoomIn} disabled={!zoom.canZoomIn} className="p-2 text-ink hover:bg-chakra/20 hover:text-shu disabled:opacity-35 cursor-pointer disabled:cursor-default" title="Acercar" aria-label="Acercar">
          <ZoomInIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={zoom.zoomOut} disabled={!zoom.canZoomOut} className="p-2 text-ink hover:bg-chakra/20 hover:text-shu disabled:opacity-35 border-t border-ink/25 cursor-pointer disabled:cursor-default" title="Alejar" aria-label="Alejar">
          <ZoomOutIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={zoom.reset} disabled={!zoom.canZoomOut} className="p-2 text-ink hover:bg-chakra/20 hover:text-shu disabled:opacity-35 border-t border-ink/25 cursor-pointer disabled:cursor-default" title="Ver todo el tablero" aria-label="Ver todo el tablero">
          <FitIcon className="w-4 h-4" />
        </button>
      </div>

      <svg
        ref={zoom.svgRef}
        viewBox={zoom.viewBox}
        preserveAspectRatio="xMidYMid meet"
        className={`w-full h-full max-w-full max-h-full touch-none ${zoom.canZoomOut ? 'cursor-grab active:cursor-grabbing' : ''}`}
        {...zoom.handlers}
      >
        <TerrainDefs />

        {/* Scroll frame: washi margin, vermilion rule, ink line, then the seigaiha sea */}
        <g pointerEvents="none">
          <g opacity="0.55" transform="translate(3 9)">
            {hexList.map((hex) => (
              <polygon key={`fo-${hex.id}`} points={getHexPoints(hex.x, hex.y, HEX_SIZE * 1.9)} fill="#03050a" stroke="#03050a" strokeWidth="12" strokeLinejoin="round" />
            ))}
          </g>
          {hexList.map((hex) => (
            <polygon key={`fr-${hex.id}`} points={getHexPoints(hex.x, hex.y, HEX_SIZE * 1.9)} fill="#efe6d0" stroke="#efe6d0" strokeWidth="8" strokeLinejoin="round" />
          ))}
          {hexList.map((hex) => (
            <polygon key={`fred-${hex.id}`} points={getHexPoints(hex.x, hex.y, HEX_SIZE * 1.83)} fill="#b6331f" />
          ))}
          {hexList.map((hex) => (
            <polygon key={`fw-${hex.id}`} points={getHexPoints(hex.x, hex.y, HEX_SIZE * 1.81)} fill="#efe6d0" />
          ))}
          {hexList.map((hex) => (
            <polygon key={`fl-${hex.id}`} points={getHexPoints(hex.x, hex.y, HEX_SIZE * 1.78)} fill="#1f1b17" />
          ))}
          {hexList.map((hex) => (
            <polygon key={`sea-${hex.id}`} points={getHexPoints(hex.x, hex.y, HEX_SIZE * 1.75)} fill="url(#pat-sea)" />
          ))}
          {/* Sandy shoreline with a foam line */}
          <g opacity="0.45">
            {hexList.map((hex) => (
              <polygon key={`fm-${hex.id}`} points={getHexPoints(hex.x, hex.y, HEX_SIZE * 1.16)} fill="#e9eef0" stroke="#e9eef0" strokeWidth="6" strokeLinejoin="round" />
            ))}
          </g>
          {hexList.map((hex) => (
            <polygon key={`sh-${hex.id}`} points={getHexPoints(hex.x, hex.y, HEX_SIZE * 1.1)} fill="#d6bf8a" stroke="#d6bf8a" strokeWidth="6" strokeLinejoin="round" />
          ))}
        </g>

        {/* Layer 1: Ports */}
        <g className="ports-layer">
          {portList.map((port, idx) => (
            <Port key={`port-${idx}`} port={port} vertices={board.vertices} center={center} />
          ))}
        </g>

        {/* Layer 2: Hex Tiles */}
        <g className="hexes-layer">
          {hexList.map((hex) => (
            <HexTile key={hex.id} hex={hex} />
          ))}
        </g>

        {/* Printed grain over the whole chart */}
        <rect
          x={bounds.minX}
          y={bounds.minY}
          width={bounds.width}
          height={bounds.height}
          filter="url(#board-grain)"
          opacity="0.35"
          pointerEvents="none"
          style={{ mixBlendMode: 'multiply' }}
        />

        {/* Layer 3: Edges (Roads) */}
        <g className="edges-layer">
          {edgeList.map((edge) => (
            <Edge key={edge.id} edge={edge} />
          ))}
        </g>

        {/* Layer 4: Vertices (Settlements / Cities) */}
        <g className="vertices-layer">
          {vertexList.map((vertex) => (
            <Vertex key={vertex.id} vertex={vertex} />
          ))}
        </g>
      </svg>
    </div>
  );
}
