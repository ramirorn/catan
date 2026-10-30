// Live 3D preview of a shop item (lazy chunk, shares three.js / R3F with the
// 3D board). Pieces: settlement, city and road of the set on a small hex, in
// the chosen player colour. Boards: a mini island of 7 hexes in the theme.
// Built from the same code as the 3D board (pieceSets.js, TextureStore,
// BoardResources), rendered on demand except while auto-rotating, with a
// capped pixel ratio, and every resource disposed on unmount.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { buildPieceGeometry, createAccentMaterials, createPieceShadow, createPlayerMaterial } from '../Board3D/pieceSets';
import { PieceLook } from '../Board3D/PieceLook';
import { BoardResources, PX, TILE_H, TILE_SCALE, hexSideGeometry, hexTopGeometry } from '../Board3D/resources';
import { TextureStore } from '../Board3D/textures';
import { ThemeAccents3D } from '../Board3D/ThemeAccents3D';
import { Lights } from '../Board3D/Scene3D';
import { computeBoardBounds, HEX_SIZE, SQRT3 } from '../../utils/hexMath';
import { TERRAIN_BASE, shade } from '../../utils/theme';
import { isLowPowerDevice } from '../Board/boardViewMode';

/* ─── Pieces on a hex ─── */

function PreviewPiece({ setId, kind, color, position, rotation = 0, shadow }) {
  const geometry = useMemo(() => buildPieceGeometry(setId, kind), [setId, kind]);
  const accents = useMemo(() => createAccentMaterials(setId), [setId]);
  const player = useMemo(() => createPlayerMaterial(setId, color), [setId, color]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => accents.forEach((m) => m.dispose()), [accents]);
  useEffect(() => () => player.dispose(), [player]);
  const materials = useMemo(() => [player, ...accents], [player, accents]);
  return (
    <mesh geometry={geometry} material={materials} position={position} rotation-y={rotation}>
      <PieceLook kind={kind} color={color} shadow={shadow} />
    </mesh>
  );
}

function PiecesScene({ setId, color }) {
  const geo = useMemo(() => ({ top: hexTopGeometry(), side: hexSideGeometry() }), []);
  const mats = useMemo(
    () => ({
      top: new THREE.MeshLambertMaterial({ color: TERRAIN_BASE.pasture }),
      side: new THREE.MeshLambertMaterial({ color: shade(TERRAIN_BASE.pasture, -0.55) }),
    }),
    []
  );
  const shadow = useMemo(() => createPieceShadow(), []);
  useEffect(
    () => () => {
      geo.top.dispose();
      geo.side.dispose();
      mats.top.dispose();
      mats.side.dispose();
      shadow.geometry.dispose();
      shadow.material.dispose();
    },
    [geo, mats, shadow]
  );
  return (
    <group position-y={-0.2}>
      <hemisphereLight args={['#fff2dc', '#6b5d63', 1.1]} />
      <directionalLight position={[-2, 4, 3]} intensity={1.3} color="#ffdcb0" />
      <mesh geometry={geo.side} material={mats.side} />
      <mesh geometry={geo.top} material={mats.top} position-y={TILE_H} />
      <group position-y={TILE_H} scale={1.45}>
        <PreviewPiece setId={setId} kind="settlement" color={color} shadow={shadow} position={[-0.36, 0, -0.18]} rotation={0.5} />
        <PreviewPiece setId={setId} kind="city" color={color} shadow={shadow} position={[0.3, 0, -0.2]} rotation={-0.35} />
        <PreviewPiece setId={setId} kind="road" color={color} shadow={shadow} position={[0, 0, 0.4]} rotation={0.08} />
      </group>
    </group>
  );
}

/* ─── Mini island ─── */

const ISLAND = (() => {
  const w = SQRT3 * HEX_SIZE;
  const cells = [
    [0, 0, 'desert', null],
    [w, 0, 'forest', 6],
    [-w, 0, 'fields', 9],
    [w / 2, 90, 'pasture', 4],
    [-w / 2, 90, 'mountains', 8],
    [w / 2, -90, 'hills', 5],
    [-w / 2, -90, 'pasture', 10],
  ];
  return cells.map(([x, y, terrain, number], i) => ({ id: `p${i}`, x, y, terrain, number }));
})();

/** Premium board: a few pieces on the island show the gold-edged finish */
const PREMIUM_SAMPLE = [
  { kind: 'city', color: '#d23a26', x: 0, y: 60, rot: 0.3 },
  { kind: 'settlement', color: '#2a6fd0', x: 52, y: -30, rot: -0.4 },
  { kind: 'road', color: '#2a6fd0', x: 52, y: 0, rot: Math.PI / 2 },
];

function PremiumSample({ res }) {
  return PREMIUM_SAMPLE.map((p) => (
    <mesh
      key={p.kind}
      geometry={res.pieceGeometry('pieces:classic', p.kind)}
      material={res.pieceMaterials('pieces:classic', p.color)}
      position={[p.x * PX, TILE_H, p.y * PX]}
      rotation-y={p.rot}
    >
      <PieceLook kind={p.kind} color={p.color} shadow={res.pieceShadow} premium />
    </mesh>
  ));
}

function IslandScene({ themeId, lowPower }) {
  const [res, setRes] = useState(null);
  const invalidate = useThree((s) => s.invalidate);
  const bounds = useMemo(() => computeBoardBounds(Object.fromEntries(ISLAND.map((h) => [h.id, h])), 84), []);
  useEffect(() => {
    let alive = true;
    let built = null;
    const store = new TextureStore({ lowPower: true });
    store
      .load({ hexGeom: ISLAND, bounds, ports: [], theme: themeId, tilePx: 256, framePx: lowPower ? 512 : 768 })
      .then(() => {
        if (!alive) return;
        built = new BoardResources(store, { lowPower: true, theme: themeId });
        setRes(built);
      })
      .catch(() => {});
    return () => {
      alive = false;
      built?.dispose();
      store.dispose();
    };
  }, [themeId, bounds, lowPower]);

  useLayoutEffect(() => {
    if (!res) return;
    const tile = res.textures.sea.userData.tile;
    res.textures.sea.repeat.set(bounds.width / tile.w, bounds.height / tile.h);
    invalidate();
  }, [res, bounds, invalidate]);

  if (!res) return null;
  const w = bounds.width * PX;
  const h = bounds.height * PX;
  const cx = (bounds.minX + bounds.width / 2) * PX;
  const cz = (bounds.minY + bounds.height / 2) * PX;
  return (
    <>
      <Lights radius={2.4} shadows={false} themeId={themeId} />
      <group position={[cx, 0, cz]}>
        <mesh material={res.mat.sea} rotation-x={-Math.PI / 2} renderOrder={-2}>
          <planeGeometry args={[w, h]} />
        </mesh>
        <mesh material={res.mat.frame} rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={-1}>
          <planeGeometry args={[w, h]} />
        </mesh>
      </group>
      <ThemeAccents3D themeId={themeId} hexes={ISLAND} />
      {res.premium && <PremiumSample res={res} />}
      {ISLAND.map((hex) => (
        <group key={hex.id} position={[hex.x * PX, 0, hex.y * PX]}>
          <group scale={[TILE_SCALE, 1, TILE_SCALE]}>
            <mesh geometry={res.geo.hexSide} material={res.mat.tileSide[hex.terrain]} />
            <mesh geometry={res.geo.hexTop} material={res.mat.tileTop[hex.terrain]} position-y={TILE_H} />
          </group>
          {hex.number && (
            <group position-y={TILE_H + 0.03}>
              <mesh geometry={res.geo.tokenSide} material={res.mat.tokenSide} position-y={0.02} />
              <mesh geometry={res.geo.tokenTop} material={res.mat.tokenTop[hex.number]} position-y={0.041} />
            </group>
          )}
        </group>
      ))}
    </>
  );
}

/* ─── Canvas ─── */

function usePrefersReducedMotion() {
  const [reduced] = useState(() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });
  return reduced;
}

/** Pauses the render loop while the preview is off screen or the tab hidden */
function useOnScreen(ref) {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let inView = true;
    const update = () => setOnScreen(inView && document.visibilityState !== 'hidden');
    const io = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          update();
        })
      : null;
    io?.observe(el);
    document.addEventListener('visibilitychange', update);
    return () => {
      io?.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, [ref]);
  return onScreen;
}

export default function ShopPreview3D({ kind, itemId, color = '#d23a26', className = '' }) {
  const [lowPower] = useState(isLowPowerDevice);
  const reduced = usePrefersReducedMotion();
  const [auto, setAuto] = useState(!reduced);
  const wrap = useRef(null);
  const onScreen = useOnScreen(wrap);
  const resume = useRef(0);
  const spinning = auto && onScreen;
  useEffect(() => () => clearTimeout(resume.current), []);

  const pieces = kind === 'pieces';
  const camera = pieces ? { fov: 34, position: [0, 1.95, 2.55] } : { fov: 34, position: [0, 5.3, 6.1] };

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <Canvas
        frameloop={spinning ? 'always' : 'demand'}
        dpr={lowPower ? [1, 1.25] : [1, 1.5]}
        flat
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        camera={{ ...camera, near: 0.1, far: 50 }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        style={{ touchAction: 'none' }}
        aria-label={pieces ? 'Vista 3D de las fichas' : 'Vista 3D del tablero'}
      >
        {pieces ? <PiecesScene setId={itemId} color={color} /> : <IslandScene themeId={itemId} lowPower={lowPower} />}
        <OrbitControls
          makeDefault
          target={pieces ? [0, 0.3, 0] : [0, 0, 0]}
          enablePan={false}
          enableDamping={false}
          autoRotate={spinning}
          autoRotateSpeed={pieces ? 2.2 : 1.2}
          minDistance={pieces ? 1.4 : 2.6}
          maxDistance={pieces ? 4.2 : 9}
          minPolarAngle={0.25}
          maxPolarAngle={1.35}
          onStart={() => {
            clearTimeout(resume.current);
            setAuto(false);
          }}
          onEnd={() => {
            clearTimeout(resume.current);
            if (!reduced) resume.current = setTimeout(() => setAuto(true), 4000);
          }}
        />
      </Canvas>
    </div>
  );
}
