// 3D board (three.js via React Three Fiber). Lazy-loaded by BoardView, so
// three.js is only downloaded when a player switches to 3D. Shares the phase
// banner, turn cues and zoom column with the 2D board.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGame } from '../../context/GameContext';
import { computeBoardBounds, HEX_CORNER_OFFSETS } from '../../utils/hexMath';
import { BoardBanner, ZoomControls } from '../Board/BoardChrome';
import { isLowPowerDevice } from '../Board/boardViewMode';
import { TextureStore } from './textures';
import { BoardResources, PX } from './resources';
import { Board3D } from './Scene3D';
import { SceneContext } from './sceneContext';
import { CameraRig } from './CameraRig';
import * as THREE from 'three';

const EMPTY = {};
const TAP_SLOP_PX = 6;

export default function HexBoard3D() {
  const { gameState } = useGame();
  const board = gameState?.board;
  const hexes = board?.hexes || EMPTY;

  // Geometry only changes with the map, not with every state update
  const hexGeomKey = Object.values(hexes).map((h) => `${h.id}@${h.x},${h.y}`).join(';');
  const portsKey = (board?.ports || []).map((p) => `${p.type}:${p.ratio}`).join(',');
  const layout = useMemo(() => {
    const hexGeom = Object.values(hexes).map(({ id, x, y }) => ({ id, x, y }));
    const bounds = computeBoardBounds(hexes, 84);
    const n = hexGeom.length || 1;
    const cx = hexGeom.reduce((a, h) => a + h.x, 0) / n;
    const cy = hexGeom.reduce((a, h) => a + h.y, 0) / n;
    const center = new THREE.Vector3(cx * PX, 0, cy * PX);
    // Outline of the paper frame, used to fit the camera
    const outline = [];
    let radius = 1;
    for (const h of hexGeom) {
      for (const o of HEX_CORNER_OFFSETS) {
        const x = h.x * PX + o.x * 1.95;
        const z = h.y * PX + o.y * 1.95;
        outline.push(new THREE.Vector3(x, 0, z));
        radius = Math.max(radius, Math.hypot(x - center.x, z - center.z));
      }
    }
    const xs = hexGeom.map((h) => h.x * PX);
    const zs = hexGeom.map((h) => h.y * PX);
    const extent = {
      x: Math.max(1, (Math.max(...xs) - Math.min(...xs)) / 2),
      z: Math.max(1, (Math.max(...zs) - Math.min(...zs)) / 2),
    };
    return { hexGeom, bounds, center, outline, radius, extent };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hexGeomKey]);

  const [lowPower] = useState(isLowPowerDevice);
  const [touch] = useState(() => {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  });

  // Textures + shared geometries/materials: built once per map, freed on unmount
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!hexGeomKey) return undefined;
    let alive = true;
    let built = null;
    const store = new TextureStore({ lowPower });
    store
      .load({ hexGeom: layout.hexGeom, bounds: layout.bounds, ports: board?.ports || [] })
      .then(() => {
        if (!alive) return;
        built = new BoardResources(store, { lowPower });
        setRes(built);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      alive = false;
      setRes(null);
      built?.dispose();
      store.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hexGeomKey, portsKey, lowPower]);

  // Taps vs drags: R3F reports the pointer travel of a click; a second finger
  // (pinch) also disqualifies the gesture
  const gesture = useRef({ pointers: new Set(), multi: false });
  const lastAction = useRef(0);
  const canvasEl = useRef(null);
  const hoverCount = useRef(0);
  const [bornAt] = useState(() => performance.now());

  const sceneCtx = useMemo(
    () =>
      res && {
        res,
        lowPower,
        bornAt,
        isTap: (e) => (e.delta ?? 0) <= TAP_SLOP_PX && !gesture.current.multi,
        noteAction: () => {
          lastAction.current = performance.now();
        },
        hoverDelta: (d) => {
          hoverCount.current = Math.max(0, hoverCount.current + d);
          if (canvasEl.current) canvasEl.current.style.cursor = hoverCount.current > 0 ? 'pointer' : '';
        },
      },
    [res, lowPower, bornAt]
  );

  const onPointerDownCapture = (e) => {
    const g = gesture.current;
    g.pointers.add(e.pointerId);
    if (g.pointers.size > 1) g.multi = true;
  };
  const onPointerUpCapture = (e) => {
    const g = gesture.current;
    g.pointers.delete(e.pointerId);
    // The click (if any) follows pointerup: clear the pinch flag right after it
    if (g.pointers.size === 0 && g.multi) setTimeout(() => (g.multi = false), 0);
  };

  const rig = useRef(null);
  const [flags, setFlags] = useState({ canZoomIn: true, canZoomOut: true, canReset: false });
  const onFlags = useCallback((f) => setFlags(f), []);

  const onDoubleClick = () => {
    // A double click on empty board frames the island again
    if (performance.now() - lastAction.current > 600) rig.current?.reset();
  };

  if (error) throw error; // caught by BoardView → back to 2D

  if (!board) {
    return (
      <div className="flex-1 flex items-center justify-center font-serif italic text-paper-deep/70 text-base">
        Desplegando el pergamino del mapa…
      </div>
    );
  }

  const shadows = !lowPower;

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden select-none">
      <BoardBanner />

      <ZoomControls
        zoomIn={() => rig.current?.zoomIn()}
        zoomOut={() => rig.current?.zoomOut()}
        reset={() => rig.current?.reset()}
        canZoomIn={!!res && flags.canZoomIn}
        canZoomOut={!!res && flags.canZoomOut}
        canReset={!!res && flags.canReset}
      />

      <div
        className="absolute inset-x-0 bottom-0 top-11 sm:top-12 touch-none"
        onPointerDownCapture={onPointerDownCapture}
        onPointerUpCapture={onPointerUpCapture}
        onPointerCancelCapture={onPointerUpCapture}
        onDoubleClick={onDoubleClick}
      >
        {sceneCtx ? (
          <Canvas
            frameloop="demand"
            dpr={lowPower ? [1, 1.5] : [1, 1.75]}
            shadows={shadows ? 'percentage' : false}
            flat
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            camera={{ fov: 36, near: 0.1, far: 200, position: [0, 12, 10] }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
              canvasEl.current = gl.domElement;
            }}
            aria-label="Tablero 3D"
          >
            <SceneContext.Provider value={sceneCtx}>
              <CameraRig
                rigRef={rig}
                center={layout.center}
                outline={layout.outline}
                extent={layout.extent}
                onFlags={onFlags}
                touch={touch}
              />
              <Board3D
                board={board}
                bounds={layout.bounds}
                center={layout.center}
                radius={layout.radius}
                shadows={shadows}
                lowPower={lowPower}
              />
            </SceneContext.Provider>
          </Canvas>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center font-serif italic text-paper-deep/70 text-base">
            Tallando el tablero 3D…
          </div>
        )}
      </div>
    </div>
  );
}
