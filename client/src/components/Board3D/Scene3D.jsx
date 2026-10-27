// Everything drawn inside the 3D canvas: sea + scroll frame, tiles, number
// seals, harbours, the robber, pieces and the clickable placement markers.
// Clicks go through boardActions.js, exactly like the 2D board.

import { memo, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../../context/GameContext';
import { pieceColor } from '../../utils/theme';
import {
  vertexActionFor,
  runVertexAction,
  edgeActionFor,
  runEdgeAction,
  canMoveRobberTo,
  pactProtectedId,
} from '../Board/boardActions';
import { PX, TILE_H, TILE_SCALE, INK } from './resources';
import { PieceLook } from './PieceLook';
import { boardTheme } from '../../utils/cosmetics';
import { ThemeAccents3D } from './ThemeAccents3D';

import { SceneContext } from './sceneContext';
import { tipHandlers3D } from '../Board/boardTip';
import { useFxHidden } from '../Effects/fxSignal';
const useScene = () => useContext(SceneContext);

// drei <Outlines> thickness is in device pixels (constant on screen)
const OUTLINE_PX = 2.4;
const useOutlinePx = () => useThree((s) => s.viewport.dpr);

/** Hover state + pointer cursor for an interactive mesh */
function useHover(active = true) {
  const { hoverDelta } = useScene();
  const [hover, setHover] = useState(false);
  const on = hover && active;
  useEffect(() => {
    if (!on) return undefined;
    hoverDelta(1);
    return () => hoverDelta(-1);
  }, [on, hoverDelta]);
  const handlers = useMemo(
    () => ({
      onPointerOver: (e) => {
        e.stopPropagation();
        setHover(true);
      },
      onPointerOut: () => setHover(false),
    }),
    []
  );
  return [on, handlers];
}

/** Keep a group's yaw turned toward the camera (upright text from any side) */
function useFaceCamera(ref, x, z) {
  useFrame(({ camera }) => {
    if (ref.current) ref.current.rotation.y = Math.atan2(camera.position.x - x, camera.position.z - z);
  });
}

/* ─── Sea + paper frame ─── */

const SeaAndFrame = memo(function SeaAndFrame({ bounds }) {
  const { res } = useScene();
  const w = bounds.width * PX;
  const h = bounds.height * PX;
  const cx = (bounds.minX + bounds.width / 2) * PX;
  const cz = (bounds.minY + bounds.height / 2) * PX;
  useLayoutEffect(() => {
    const tile = res.textures.sea.userData.tile;
    res.textures.sea.repeat.set(bounds.width / tile.w, bounds.height / tile.h);
  }, [res, bounds]);
  return (
    <group position={[cx, 0, cz]}>
      <mesh material={res.mat.sea} rotation-x={-Math.PI / 2} receiveShadow renderOrder={-2}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh material={res.mat.frame} rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow renderOrder={-1}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
});

/* ─── Tiles ─── */

const Tile = memo(function Tile({ hex, robberTarget, shielded = false, onRobber }) {
  const { res, isTap, noteAction } = useScene();
  const [hover, hoverHandlers] = useHover(robberTarget);
  const tip = tipHandlers3D('hex', hex.id);
  const handlers = useMemo(
    () => ({
      ...tip,
      onPointerOver: (e) => {
        tip.onPointerOver(e);
        hoverHandlers.onPointerOver(e);
      },
      onPointerOut: (e) => {
        tip.onPointerOut(e);
        hoverHandlers.onPointerOut(e);
      },
    }),
    [tip, hoverHandlers]
  );
  const top = res.mat.tileTop[hex.terrain];
  if (!top) return null;
  const onClick = (e) => {
    e.stopPropagation();
    if (!robberTarget || !isTap(e)) return;
    noteAction();
    onRobber(hex.id);
  };
  return (
    <group position={[hex.x * PX, 0, hex.y * PX]} scale={[TILE_SCALE, 1, TILE_SCALE]}>
      <mesh geometry={res.geo.hexSide} material={res.mat.tileSide[hex.terrain]} receiveShadow />
      <mesh
        geometry={res.geo.hexTop}
        material={top}
        position-y={TILE_H}
        receiveShadow
        onClick={robberTarget ? onClick : undefined}
        {...handlers}
      />
      {robberTarget && (
        <mesh geometry={res.geo.robberRing} material={res.mat.robberRing} position-y={TILE_H + 0.006} renderOrder={3} />
      )}
      {shielded && (
        <mesh geometry={res.geo.hexTop} material={res.mat.pactShield} position-y={TILE_H + 0.005} renderOrder={2} />
      )}
      {robberTarget && hover && (
        <mesh geometry={res.geo.hexTop} material={res.mat.hover} position-y={TILE_H + 0.004} renderOrder={2} />
      )}
    </group>
  );
});

/* ─── Number seals ─── */

const Token = memo(function Token({ x, z, number }) {
  const { res } = useScene();
  const ref = useRef(null);
  useFaceCamera(ref, x, z);
  const mat = res.mat.tokenTop[number];
  if (!mat) return null;
  return (
    <group ref={ref} position={[x, TILE_H, z]}>
      {/* propped up a little toward the viewer so it reads at a glance */}
      <group position-y={0.075} rotation-x={0.22}>
        <mesh geometry={res.geo.tokenSide} material={res.mat.tokenSide} position-y={0.02} castShadow />
        <mesh geometry={res.geo.tokenTop} material={mat} position-y={0.041} />
      </group>
    </group>
  );
});

/* ─── Harbours: wooden jetty + paper talisman on a post ─── */

const Port3D = memo(function Port3D({ port, index, v1, v2, center }) {
  const { res } = useScene();
  const tip = tipHandlers3D('port', index);
  const ref = useRef(null);
  // Push the badge out to sea, perpendicular to the coastline edge (as in 2D)
  let bx = port.x;
  let by = port.y;
  if (v1 && v2) {
    const dx = v2.x - v1.x;
    const dy = v2.y - v1.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if ((port.x - center.x) * nx + (port.y - center.y) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    bx = port.x + nx * 40;
    by = port.y + ny * 40;
  }
  const b = [bx * PX, by * PX];
  useFaceCamera(ref, b[0], b[1]);
  const mat = res.mat.talisman[`${port.type}:${port.ratio}`];

  const pier = (v) => {
    const vx = v.x * PX;
    const vz = v.y * PX;
    const len = Math.hypot(b[0] - vx, b[1] - vz);
    return (
      <mesh
        geometry={res.geo.pierPlank}
        material={res.mat.wood}
        position={[(vx + b[0]) / 2, 0.06, (vz + b[1]) / 2]}
        rotation-y={-Math.atan2(b[1] - vz, b[0] - vx)}
        scale-x={len}
        castShadow
        receiveShadow
      />
    );
  };

  return (
    <group>
      {v1 && pier(v1)}
      {v2 && pier(v2)}
      {/* The post stops at the talisman's lower edge (0.66 − 0.31): the paper
          turns to face the camera, so a taller post would cut through it */}
      <mesh geometry={res.geo.post} material={res.mat.woodDark} position={[b[0], 0.18, b[1]]} scale-y={0.36} castShadow {...tip} />
      <group ref={ref} position={[b[0], 0.66, b[1]]}>
        {mat && <mesh geometry={res.geo.talisman} material={mat} castShadow {...tip} />}
      </group>
    </group>
  );
});

/* ─── Robber: a rogue in a straw hat and a black cloak with red clouds ─── */

const CLOAK_PROFILE = [
  [0.0, 0.0],
  [0.2, 0.0],
  [0.19, 0.06],
  [0.165, 0.16],
  [0.13, 0.27],
  [0.095, 0.35],
  [0.07, 0.37],
  [0.0, 0.37],
].map(([x, y]) => new THREE.Vector2(x, y));

export function Robber3D({ x, z }) {
  const { res } = useScene();
  const dpr = useOutlinePx();
  const invalidate = useThree((s) => s.invalidate);
  const ref = useRef(null);
  const anim = useRef(null);
  const last = useRef(null);
  // While the leap animation (overlay) carries the rogue, the piece waits hidden
  const hidden = useFxHidden('robber');
  const hiddenRef = useRef(hidden);
  useLayoutEffect(() => {
    hiddenRef.current = hidden;
  }, [hidden]);

  // Hop to the new hex when the robber moves
  useLayoutEffect(() => {
    const g = ref.current;
    if (!g) return;
    const prev = last.current;
    last.current = [x, z];
    if (!prev || hiddenRef.current) {
      anim.current = null;
      g.position.set(x, TILE_H, z);
      invalidate();
      return;
    }
    anim.current = { from: prev, to: [x, z], t0: performance.now() };
    invalidate();
  }, [x, z, invalidate]);

  useLayoutEffect(() => {
    invalidate();
  }, [hidden, invalidate]);

  useFrame(() => {
    const a = anim.current;
    if (!a || !ref.current) return;
    const t = Math.min(1, (performance.now() - a.t0) / 600);
    const k = t * t * (3 - 2 * t);
    ref.current.position.set(
      a.from[0] + (a.to[0] - a.from[0]) * k,
      TILE_H + Math.sin(Math.PI * t) * 0.9,
      a.from[1] + (a.to[1] - a.from[1]) * k
    );
    if (t >= 1) anim.current = null;
    invalidate();
  });

  return (
    <group ref={ref} visible={!hidden}>
      <group scale={1.2}>
        <mesh material={res.mat.cloak} castShadow>
          <latheGeometry args={[CLOAK_PROFILE, 28]} />
          <Outlines thickness={OUTLINE_PX * dpr} color={INK} />
        </mesh>
        {/* collar */}
        <mesh material={res.mat.robberDark} position-y={0.395} castShadow>
          <cylinderGeometry args={[0.072, 0.085, 0.07, 14]} />
        </mesh>
        {/* shadowed face with a pale eye glint */}
        <mesh material={res.mat.robberDark} position-y={0.45}>
          <sphereGeometry args={[0.062, 16, 12]} />
        </mesh>
        <mesh material={res.mat.paper} position={[0.022, 0.452, 0.058]}>
          <boxGeometry args={[0.03, 0.007, 0.006]} />
        </mesh>
        {/* conical straw hat */}
        <mesh material={res.mat.straw} position-y={0.52} castShadow>
          <coneGeometry args={[0.19, 0.11, 24, 1]} />
          <Outlines thickness={OUTLINE_PX * dpr} color={INK} />
        </mesh>
        {/* hat underside: the circle faces +z by default, so turn it a quarter
            turn to lie flat facing down (a half turn left it standing upright) */}
        <mesh material={res.mat.strawDark} position-y={0.4655} rotation-x={Math.PI / 2}>
          <circleGeometry args={[0.19, 24]} />
        </mesh>
        {/* hanging paper strips */}
        {[0.6, 1.4, 3.6, 4.6].map((a) => (
          <mesh key={a} material={res.mat.paper} position={[Math.sin(a) * 0.17, 0.43, Math.cos(a) * 0.17]} rotation-y={a}>
            <boxGeometry args={[0.018, 0.07, 0.004]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ─── Player pieces ─── */

const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

/**
 * A building / road in a player's colour, with a thin ink outline and a soft
 * contact shadow; drops in when
 * placed. A city being upgraded waits hidden while the upgrade animation
 * starts (fxKey), then rises out of the ground with a turn.
 */
const Piece = memo(function Piece({ set, kind, color, tipId, fxKey = null, rise = false }) {
  const { res, bornAt } = useScene();
  const tip = tipId ? tipHandlers3D('vertex', tipId) : null;
  const invalidate = useThree((s) => s.invalidate);
  const ref = useRef(null);
  const anim = useRef(null);
  const hidden = useFxHidden(fxKey);
  const wasHidden = useRef(hidden);

  useLayoutEffect(() => {
    // Pieces present when the board opens appear instantly
    if (performance.now() - bornAt < 1200) return;
    anim.current = { t0: performance.now(), dur: 380, rise: false };
    ref.current?.scale.setScalar(0.001);
    invalidate();
  }, [bornAt, invalidate]);

  useLayoutEffect(() => {
    const was = wasHidden.current;
    wasHidden.current = hidden;
    invalidate();
    if (!was || hidden) return;
    anim.current = { t0: performance.now(), dur: rise ? 650 : 380, rise };
    ref.current?.scale.setScalar(0.001);
  }, [hidden, rise, invalidate]);

  useFrame(() => {
    const a = anim.current;
    const m = ref.current;
    if (a === null || !m) return;
    const t = Math.min(1, (performance.now() - a.t0) / a.dur);
    const k = Math.max(0.001, easeOutBack(t));
    if (a.rise) {
      // grows up from the plinth while turning into place
      const wide = 0.7 + 0.3 * Math.min(1, t * 1.6);
      m.scale.set(wide, k, wide);
      m.rotation.y = (1 - t) * (1 - t) * Math.PI * 1.2;
    } else {
      m.scale.setScalar(k);
    }
    if (t >= 1) {
      m.scale.setScalar(1);
      m.rotation.y = 0;
      anim.current = null;
    }
    invalidate();
  });

  return (
    <mesh
      ref={ref}
      geometry={res.pieceGeometry(set, kind)}
      material={res.pieceMaterials(set, color)}
      visible={!hidden}
      castShadow
      receiveShadow
      {...tip}
    >
      <PieceLook kind={kind} color={color} shadow={res.pieceShadow} />
    </mesh>
  );
});

/* ─── Placement markers ─── */

function VertexMarker({ upgrade, onAct, tipId }) {
  const { res, isTap } = useScene();
  const [hover, hoverHandlers] = useHover();
  const tip = tipId ? tipHandlers3D('vertex', tipId) : null;
  const handlers = useMemo(
    () =>
      tip
        ? {
            ...tip,
            onPointerOver: (e) => {
              tip.onPointerOver(e);
              hoverHandlers.onPointerOver(e);
            },
            onPointerOut: (e) => {
              tip.onPointerOut(e);
              hoverHandlers.onPointerOut(e);
            },
          }
        : hoverHandlers,
    [tip, hoverHandlers]
  );
  const onClick = (e) => {
    e.stopPropagation();
    if (isTap(e)) onAct();
  };
  return (
    <group>
      <mesh
        geometry={res.geo.vertexHit}
        material={res.mat.hit}
        position-y={upgrade ? 0.22 : 0.1}
        scale={upgrade ? [1.25, 1.6, 1.25] : 1}
        onClick={onClick}
        {...handlers}
      />
      {upgrade ? (
        <mesh geometry={res.geo.upgradeRing} material={res.mat.ring} position-y={0.04} scale={hover ? 1.15 : 1} renderOrder={4} />
      ) : (
        <group position-y={hover ? 0.06 : 0.02} scale={hover ? 1.4 : 1}>
          <mesh geometry={res.geo.seal} material={res.mat.seal} renderOrder={4} />
        </group>
      )}
    </group>
  );
}

function EdgeMarker({ onAct }) {
  const { res, isTap } = useScene();
  const [hover, handlers] = useHover();
  const onClick = (e) => {
    e.stopPropagation();
    if (isTap(e)) onAct();
  };
  return (
    <group>
      <mesh geometry={res.geo.edgeHit} material={res.mat.hit} position-y={0.08} onClick={onClick} {...handlers} />
      <mesh
        geometry={res.geo.roadDash}
        material={res.mat.dash}
        position-y={hover ? 0.03 : 0.012}
        scale={hover ? [1.08, 1, 1.5] : 1}
        renderOrder={4}
      />
    </group>
  );
}

/* ─── Pulsing markers: animate (and keep rendering) only while some exist ─── */

function PulseDriver({ lowPower }) {
  const { res } = useScene();
  const invalidate = useThree((s) => s.invalidate);
  const pending = useRef(0);
  useEffect(() => {
    invalidate();
    return () => {
      clearTimeout(pending.current);
      pending.current = 0;
      // Leave the markers fully visible for the next time
      res.setPulse(null);
    };
  }, [invalidate, res]);
  useFrame(() => {
    const t = performance.now() / 1000;
    res.setPulse(0.5 + 0.5 * Math.sin(t * 3.9));
    if (lowPower) {
      // ~30 fps is plenty for a breathing marker on phones
      if (!pending.current) {
        pending.current = setTimeout(() => {
          pending.current = 0;
          invalidate();
        }, 33);
      }
    } else {
      invalidate();
    }
  });
  return null;
}

/**
 * Outline widths are in screen pixels; scale them with the zoom so far-away
 * (small) pieces don't drown in their own outline, and close-ups stay crisp.
 */
function OutlineScaler() {
  useFrame(({ scene, camera, size, controls }) => {
    const target = controls?.target;
    if (!target) return;
    const dist = camera.position.distanceTo(target);
    const pxPerUnit = size.height / (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const k = THREE.MathUtils.clamp(pxPerUnit / 120, 0.4, 1.15);
    scene.traverse((o) => {
      const u = o.material?.uniforms?.thickness;
      if (!u || o.material.uniforms.screenspace === undefined) return;
      o.material.userData.basePx ??= u.value;
      u.value = o.material.userData.basePx * k;
    });
  });
  return null;
}

/* ─── Lights ─── */

export function Lights({ radius, shadows, themeId = null }) {
  const r = radius + 1.5;
  const theme = boardTheme(themeId);
  return (
    <>
      <hemisphereLight args={theme.hemi} />
      <directionalLight
        position={[-radius * 0.55, radius * 1.25, radius * 0.75]}
        intensity={theme.sun[1]}
        color={theme.sun[0]}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-radius={4}
        shadow-camera-left={-r}
        shadow-camera-right={r}
        shadow-camera-top={r}
        shadow-camera-bottom={-r}
        shadow-camera-near={0.5}
        shadow-camera-far={radius * 5}
      />
    </>
  );
}

/* ─── Board ─── */

export function Board3D({ board, hexGeom, bounds, center, radius, shadows, lowPower }) {
  const game = useGame();
  const { gameState } = game;
  const players = gameState?.players;

  // Stable callbacks that always use the latest game value
  const gameRef = useRef(game);
  useLayoutEffect(() => {
    gameRef.current = game;
  });
  const { noteAction } = useScene();
  const act = useMemo(
    () => ({
      vertex: (action, id) => {
        noteAction();
        runVertexAction(gameRef.current, action, id);
      },
      edge: (action, id) => {
        noteAction();
        runEdgeAction(gameRef.current, action, id);
      },
      robber: (id) => gameRef.current.moveRobber(id),
    }),
    [noteAction]
  );

  const colorOf = (playerId) => pieceColor(players?.[playerId]?.color || '#e74c3c');
  // Shop piece set of each owner (everyone sees the same)
  const setOf = (playerId) => players?.[playerId]?.pieceSet;
  const themeId = gameState?.boardTheme;

  const hexList = Object.values(board.hexes || {});
  const vertexList = Object.values(board.vertices || {});
  const edgeList = Object.values(board.edges || {});
  const ports = board.ports || [];
  const centerPx = { x: center.x / PX, y: center.z / PX };

  let anyMarker = false;

  const tiles = hexList.map((hex) => {
    const target = canMoveRobberTo(game, hex);
    if (target) anyMarker = true;
    // A signed peace pact: the mover sees the protected hexes veiled in white
    const shielded = !target && game.isMyTurn && !!pactProtectedId(game.gameState) && !hex.hasRobber &&
      Array.isArray(game.gameState.robberHexes) && !game.gameState.robberHexes.includes(hex.id);
    return <Tile key={hex.id} hex={hex} robberTarget={target} shielded={shielded} onRobber={act.robber} />;
  });

  const robberHex = hexList.find((h) => h.hasRobber);

  const vertices = [];
  for (const v of vertexList) {
    const action = vertexActionFor(game, v.id);
    if (!v.building && !action) continue;
    if (action) anyMarker = true;
    vertices.push(
      <group key={v.id} position={[v.x * PX, TILE_H, v.y * PX]}>
        {v.building && (
          <Piece
            key={v.building.type}
            set={setOf(v.building.playerId)}
            kind={v.building.type === 'city' ? 'city' : 'settlement'}
            color={colorOf(v.building.playerId)}
            tipId={v.id}
            fxKey={`vertex:${v.id}`}
            rise={v.building.type === 'city'}
          />
        )}
        {action && (
          <VertexMarker
            upgrade={!!v.building}
            tipId={v.building ? v.id : undefined}
            onAct={() => act.vertex(action, v.id)}
          />
        )}
      </group>
    );
  }

  const edges = [];
  for (const e of edgeList) {
    const action = edgeActionFor(game, e.id);
    if (!e.road && !action) continue;
    if (action) anyMarker = true;
    const x1 = e.x1 * PX;
    const z1 = e.y1 * PX;
    const x2 = e.x2 * PX;
    const z2 = e.y2 * PX;
    edges.push(
      <group key={e.id} position={[(x1 + x2) / 2, TILE_H, (z1 + z2) / 2]} rotation-y={-Math.atan2(z2 - z1, x2 - x1)}>
        {e.road && <Piece set={setOf(e.road.playerId)} kind="road" color={colorOf(e.road.playerId)} />}
        {action && <EdgeMarker onAct={() => act.edge(action, e.id)} />}
      </group>
    );
  }

  return (
    <>
      <Lights radius={radius} shadows={shadows} themeId={themeId} />
      <OutlineScaler />
      <SeaAndFrame bounds={bounds} />
      <ThemeAccents3D themeId={themeId} hexes={hexGeom} />
      <group>{tiles}</group>
      {hexList.map(
        (hex) => hex.number && !hex.hasRobber && <Token key={hex.id} x={hex.x * PX} z={hex.y * PX} number={hex.number} />
      )}
      {ports.map((p, i) => (
        <Port3D
          key={`${p.edgeId || i}`}
          port={p}
          index={i}
          v1={board.vertices?.[p.vertices?.[0]]}
          v2={board.vertices?.[p.vertices?.[1]]}
          center={centerPx}
        />
      ))}
      {robberHex && <Robber3D x={robberHex.x * PX} z={robberHex.y * PX} />}
      {edges}
      {vertices}
      {anyMarker && <PulseDriver lowPower={lowPower} />}
    </>
  );
}
