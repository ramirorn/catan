import { memo, useMemo } from 'react';
import { useGame } from '../../context/GameContext';
import { computeBoardBounds, hexUnionPath, HEX_SIZE } from '../../utils/hexMath';
import { TerrainDefs } from './TerrainDefs';
import { HexTile } from './HexTile';
import { Edge } from './Edge';
import { Vertex } from './Vertex';
import { Port } from './Port';
import { useBoardZoom } from './useBoardZoom';
import { BoardBanner, ZoomControls } from './BoardChrome';
import { tipDomHandlers } from './boardTip';

const EMPTY = {};
const BoardDefs = memo(TerrainDefs);

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

export function HexBoard() {
  const { gameState } = useGame();
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

  return (
    <div
      className="board-tip-area relative flex-1 w-full h-full flex items-center justify-center overflow-hidden select-none pt-12 sm:pt-14 pb-2 px-2"
      {...tipDomHandlers}
    >
      {/* Turn / Action Phase Banner + "your turn" cues */}
      <BoardBanner />

      {/* Zoom controls (+ 2D / 3D switch) */}
      <ZoomControls
        zoomIn={zoom.zoomIn}
        zoomOut={zoom.zoomOut}
        reset={zoom.reset}
        canZoomIn={zoom.canZoomIn}
        canZoomOut={zoom.canZoomOut}
      />

      <svg
        data-board-surface
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
            <Port key={`port-${idx}`} port={port} index={idx} vertices={board.vertices} center={center} />
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
