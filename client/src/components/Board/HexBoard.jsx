import { memo, useEffect, useMemo, useState } from 'react';
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

const EMPTY = {};
const BoardDefs = memo(TerrainDefs);

/** Union of hexagons of the given radius as one <path> (one shape, one paint) */
function hexUnionPath(hexList, size) {
  return hexList.map((h) => `M${getHexPoints(h.x, h.y, size).replace(/ /g, 'L')}Z`).join('');
}

/**
 * Scroll frame around the island: washi margin, vermilion rule, ink line,
 * seigaiha sea, foam and sand. Each ring is a single path (no group opacity,
 * no filters), so zooming never re-composites translucent layers.
 */
const BoardFrame = memo(function BoardFrame({ hexList }) {
  const paths = useMemo(() => {
    const r = (k) => hexUnionPath(hexList, HEX_SIZE * k);
    return {
      shadow: hexUnionPath(hexList, HEX_SIZE * 1.9 + 5),
      margin: r(1.9),
      red: r(1.83),
      white: r(1.81),
      line: r(1.78),
      sea: r(1.75),
      foam: hexUnionPath(hexList, HEX_SIZE * 1.16 + 3),
      shore: r(1.1),
    };
  }, [hexList]);

  return (
    <g pointerEvents="none">
      {/* Short, soft drop shadow under the scroll */}
      <path d={paths.shadow} transform="translate(1.5 4)" fill="#03050a" fillOpacity="0.5" />
      <path d={paths.margin} fill="#efe6d0" stroke="#efe6d0" strokeWidth="8" strokeLinejoin="round" />
      <path d={paths.red} fill="#b6331f" />
      <path d={paths.white} fill="#efe6d0" />
      <path d={paths.line} fill="#1f1b17" />
      <path d={paths.sea} fill="url(#pat-sea)" />
      {/* Sandy shoreline with a foam line */}
      <path d={paths.foam} fill="#e9eef0" fillOpacity="0.45" />
      <path d={paths.shore} fill="#d6bf8a" stroke="#d6bf8a" strokeWidth="6" strokeLinejoin="round" />
    </g>
  );
});

/**
 * "¡Tu turno!" cues: a one-shot banner when the turn (or my special build)
 * passes to me, plus a persistent glow around the board while I may act.
 */
function TurnCues({ mine, turnKey, special }) {
  // Remember the last key so the banner fires only on a change, not on load
  const [prevKey, setPrevKey] = useState(turnKey);
  const [flash, setFlash] = useState(null);
  if (turnKey !== prevKey) {
    setPrevKey(turnKey);
    if (turnKey) setFlash({ key: turnKey, special });
  }

  // Tab title hint for players looking at another tab
  useEffect(() => {
    if (!mine) return undefined;
    const base = document.title.replace(/^● Tu turno · /, '');
    document.title = `● Tu turno · ${base}`;
    return () => {
      document.title = base;
    };
  }, [mine]);

  return (
    <>
      {mine && <div className="turn-glow" aria-hidden="true" />}
      {flash && flash.key === turnKey && (
        <div key={flash.key} className="turn-banner" role="status" aria-live="polite">
          <div className="turn-banner-strip">
            <span className="turn-banner-title">¡Tu turno!</span>
            <span className="turn-banner-sub">{flash.special ? 'Construcción especial' : 'Es tu momento, ninja'}</span>
          </div>
        </div>
      )}
    </>
  );
}

export function HexBoard() {
  const { gameState, isMyTurn, isSpecialBuild, isMySpecialBuild, buildMode } = useGame();
  const board = gameState?.board;
  const hexes = board?.hexes || EMPTY;

  // Geometry only changes with the map, not with every state update
  const hexGeomKey = Object.values(hexes).map((h) => `${h.id}@${h.x},${h.y}`).join(';');
  const hexGeom = useMemo(
    () => Object.values(hexes).map(({ id, x, y }) => ({ id, x, y })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hexGeomKey]
  );
  const rawBounds = computeBoardBounds(hexes, 72);
  const bounds = useMemo(
    () => rawBounds,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawBounds.minX, rawBounds.minY, rawBounds.width, rawBounds.height]
  );
  const islandPath = useMemo(() => hexUnionPath(hexGeom, HEX_SIZE), [hexGeom]);

  // Island centre, used to orient harbour badges out to sea
  const center = useMemo(
    () =>
      hexGeom.length
        ? {
            x: hexGeom.reduce((a, h) => a + h.x, 0) / hexGeom.length,
            y: hexGeom.reduce((a, h) => a + h.y, 0) / hexGeom.length,
          }
        : { x: 0, y: 0 },
    [hexGeom]
  );

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

  const turnColor = pieceColor((specialBuilder || currentTurnPlayer)?.color);

  // Identifies "my chance to act": changes when the turn / special build passes to me
  const turnKey = bannerMine
    ? `${gameState.turnNumber}:${gameState.currentPlayerId}:${isSpecialBuild ? `sb-${gameState.specialBuilderId}` : 'turn'}`
    : null;

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

      <TurnCues mine={bannerMine} turnKey={turnKey} special={isSpecialBuild} />

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
        preserveAspectRatio="xMidYMid meet"
        className={`board-svg w-full h-full max-w-full max-h-full touch-none ${zoom.canZoomOut ? 'cursor-grab active:cursor-grabbing' : ''}`}
        {...zoom.handlers}
      >
        <BoardDefs />

        <BoardFrame hexList={hexGeom} />

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

        {/* Printed grain over the island (static pattern, no filter / blend mode) */}
        <path d={islandPath} fill="url(#pat-grain)" fillOpacity="0.4" pointerEvents="none" />

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
