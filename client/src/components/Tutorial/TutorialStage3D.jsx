// 3D stage of the tutorial (lazy chunk, shares three.js / R3F with the 3D
// board). One Canvas stays mounted while the player goes through the steps;
// each step re-mounts only the small "world" on top of the shared island
// (tiles, pieces and robber are the 3D board's own geometry / materials).
// Rendered on demand: frames are drawn only while something moves. With
// prefers-reduced-motion every step is shown directly in its final pose.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Outlines } from '@react-three/drei';
import * as THREE from 'three';
import { BoardResources, INK, PX, TILE_H, TILE_SCALE } from '../Board3D/resources';
import { TextureStore } from '../Board3D/textures';
import { Lights, Robber3D } from '../Board3D/Scene3D';
import { SceneContext } from '../Board3D/sceneContext';
import { Dice, GatedDice, warmDice } from '../Dice3D/DiceScene';
import { computeBoardBounds } from '../../utils/hexMath';
import { isLowPowerDevice } from '../Board/boardViewMode';
import { TutorialAssets } from './tutorialAssets';
import { BLUE, HEX, HEXES, PORTS, RED, SCENES, V } from './tutorialScenes';

const OUTLINE_PX = 2.4;
const RIM_PX = 4.2;
const FOV = 32;

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

/* ─── Step clock ─── */

const ClockContext = createContext(null);

/** Seconds since the step started (a huge number with reduced motion: final pose) */
function useStepTime() {
  const clock = useContext(ClockContext);
  if (clock.reduced) return () => 1e6;
  // waiting for the shaders: the step has not started yet
  return () => (clock.t0.current === null ? 0 : (performance.now() - clock.t0.current) / 1000);
}

const useRes = () => useContext(SceneContext).res;
const useAssets = () => useContext(SceneContext).assets;

/** Keeps frames coming while the step's timeline is running */
function Driver({ until }) {
  const time = useStepTime();
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [invalidate]);
  useFrame(() => {
    if (time() < until) invalidate();
  });
  return null;
}

/** Switches a value at a given time of the step (React state, a few times per step) */
function useAt(at, reduced, paused = false) {
  const [on, setOn] = useState(() => at === undefined || at === null || reduced);
  useEffect(() => {
    if (on || paused) return undefined;
    const id = setTimeout(() => setOn(true), at * 1000);
    return () => clearTimeout(id);
  }, [at, on, paused]);
  return on;
}

const vpos = (key, y = TILE_H) => [V[key][0], y, V[key][1]];

/** World point of a card end: a hex (above it), a corner (above the piece) or [x, y, z] */
function point(ref, i = 0) {
  if (Array.isArray(ref)) return ref;
  if (HEX[ref]) return [HEX[ref].x, 0.55, HEX[ref].z];
  return [V[ref][0] + i * 0.07, 0.8 + i * 0.1, V[ref][1]];
}

/* ─── Island ─── */

const HEX_PX = Object.fromEntries(HEXES.map((h) => [h.id, { id: h.id, x: h.x / PX, y: h.z / PX }]));

function SeaAndFrame({ bounds }) {
  const res = useRes();
  const w = bounds.width * PX;
  const h = bounds.height * PX;
  const cx = (bounds.minX + bounds.width / 2) * PX;
  const cz = (bounds.minY + bounds.height / 2) * PX;
  return (
    <group position={[cx, 0, cz]}>
      <mesh material={res.mat.sea} rotation-x={-Math.PI / 2} renderOrder={-2}>
        <planeGeometry args={[w, h]} />
      </mesh>
      <mesh material={res.mat.frame} rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={-1}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </group>
  );
}

function Tile({ hex, drop, glowAt, veilAt }) {
  const res = useRes();
  const assets = useAssets();
  const time = useStepTime();
  const ref = useRef(null);
  const ring = useRef(null);
  const veil = useRef(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = time();
    let y = 0;
    let visible = true;
    if (drop !== undefined) {
      const k = (t - drop) / 0.55;
      visible = k > 0;
      y += (1 - easeOutBack(clamp01(k))) * 1.4;
    }
    if (glowAt !== undefined) {
      const k = t - glowAt;
      const on = k > 0;
      y += on ? easeOutCubic(clamp01(k / 0.3)) * 0.09 : 0;
      if (ring.current) {
        ring.current.visible = on;
        // pulses three times, then stays lit
        ring.current.material.opacity = k > 2.4 ? 0.9 : 0.55 + 0.45 * Math.cos(k * Math.PI * 2.5);
      }
    }
    if (veil.current) veil.current.visible = veilAt !== undefined && t > veilAt;
    g.visible = visible;
    g.position.y = y;
  });
  return (
    <group ref={ref} position={[hex.x, 0, hex.z]}>
      <group scale={[TILE_SCALE, 1, TILE_SCALE]}>
        <mesh geometry={res.geo.hexSide} material={res.mat.tileSide[hex.terrain]} />
        <mesh geometry={res.geo.hexTop} material={res.mat.tileTop[hex.terrain]} position-y={TILE_H} />
        {glowAt !== undefined && (
          <mesh ref={ring} geometry={res.geo.robberRing} material={assets.glow} position-y={TILE_H + 0.006} renderOrder={3} visible={false} />
        )}
        {veilAt !== undefined && (
          <mesh ref={veil} geometry={res.geo.hexTop} material={res.mat.pactShield} position-y={TILE_H + 0.005} renderOrder={2} visible={false} />
        )}
      </group>
    </group>
  );
}

function Token({ hex, drop, hotAt }) {
  const res = useRes();
  const time = useStepTime();
  const ref = useRef(null);
  const inner = useRef(null);
  const hot = hex.number === 6 || hex.number === 8;
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    g.rotation.y = Math.atan2(camera.position.x - hex.x, camera.position.z - hex.z);
    const t = time();
    let y = TILE_H;
    let s = 1;
    if (drop !== undefined) {
      const k = (t - drop) / 0.45;
      g.visible = k > 0;
      y += (1 - easeOutBack(clamp01(k))) * 1.1;
    }
    if (hotAt !== undefined && hot && t > hotAt) {
      const k = t - hotAt;
      s = 1 + 0.35 * easeOutCubic(clamp01(k / 0.35)) + (k < 1.6 ? 0.08 * Math.sin(k * 9) * (1 - k / 1.6) : 0);
      y += 0.12 * easeOutCubic(clamp01(k / 0.35));
    }
    g.position.y = y;
    if (inner.current) inner.current.scale.setScalar(s);
  });
  const mat = res.mat.tokenTop[hex.number];
  if (!mat) return null;
  return (
    <group ref={ref} position={[hex.x, TILE_H, hex.z]}>
      <group ref={inner}>
        <group position-y={0.075} rotation-x={0.22}>
          <mesh geometry={res.geo.tokenSide} material={res.mat.tokenSide} position-y={0.02} />
          <mesh geometry={res.geo.tokenTop} material={mat} position-y={0.041} />
        </group>
      </group>
    </group>
  );
}

/* ─── Harbours ─── */

function Port({ port, pulseAt }) {
  const res = useRes();
  const time = useStepTime();
  const ref = useRef(null);
  const [x1, z1] = V[port.v1];
  const [x2, z2] = V[port.v2];
  // badge pushed out to sea, away from the island centre
  const mx = (x1 + x2) / 2;
  const mz = (z1 + z2) / 2;
  const len = Math.hypot(mx, mz) || 1;
  const b = [mx + (mx / len) * 0.62, mz + (mz / len) * 0.62];
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    g.rotation.y = Math.atan2(camera.position.x - b[0], camera.position.z - b[1]);
    const k = pulseAt === undefined ? -1 : time() - pulseAt;
    const s = k > 0 && k < 1.4 ? 1 + 0.3 * Math.sin((k / 1.4) * Math.PI) : 1;
    g.scale.setScalar(s);
  });
  const mat = res.mat.talisman[`${port.type}:${port.ratio}`];
  const pier = (vx, vz) => {
    const l = Math.hypot(b[0] - vx, b[1] - vz);
    return (
      <mesh
        geometry={res.geo.pierPlank}
        material={res.mat.wood}
        position={[(vx + b[0]) / 2, 0.06, (vz + b[1]) / 2]}
        rotation-y={-Math.atan2(b[1] - vz, b[0] - vx)}
        scale-x={l}
      />
    );
  };
  return (
    <group>
      {pier(x1, z1)}
      {pier(x2, z2)}
      <mesh geometry={res.geo.post} material={res.mat.woodDark} position={[b[0], 0.18, b[1]]} scale-y={0.36} />
      <group ref={ref} position={[b[0], 0.66, b[1]]}>
        {mat && <mesh geometry={res.geo.talisman} material={mat} />}
      </group>
    </group>
  );
}

/* ─── Pieces ─── */

function Piece({ spec }) {
  const res = useRes();
  const time = useStepTime();
  const dpr = useThree((s) => s.viewport.dpr);
  const ref = useRef(null);
  const { kind, color, at, until, rise } = spec;
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = time();
    if (until !== undefined && t >= until) {
      m.visible = false;
      return;
    }
    if (at === undefined) {
      m.visible = true;
      return;
    }
    const k = (t - at) / (rise ? 0.65 : 0.38);
    m.visible = k > 0;
    if (k <= 0) return;
    const c = clamp01(k);
    const s = Math.max(0.001, easeOutBack(c));
    if (rise) {
      const wide = 0.7 + 0.3 * Math.min(1, c * 1.6);
      m.scale.set(wide, s, wide);
      m.rotation.y = (1 - c) * (1 - c) * Math.PI * 1.2;
    } else {
      m.scale.setScalar(s);
    }
  });

  let position;
  let rotation = 0;
  if (spec.e) {
    const [x1, z1] = V[spec.e[0]];
    const [x2, z2] = V[spec.e[1]];
    position = [(x1 + x2) / 2, TILE_H, (z1 + z2) / 2];
    rotation = -Math.atan2(z2 - z1, x2 - x1);
  } else {
    position = vpos(spec.v);
  }
  return (
    <group position={position} rotation-y={rotation}>
      <mesh
        ref={ref}
        geometry={res.pieceGeometry(null, kind)}
        material={res.pieceMaterials(null, color)}
        visible={at === undefined}
      >
        <Outlines thickness={OUTLINE_PX * dpr} color={INK} />
        <Outlines thickness={RIM_PX * dpr} color="#fff4dc" />
      </mesh>
    </group>
  );
}

/* ─── Sprites: flying cards, badges ─── */

function useSpriteMaterial(map) {
  const mat = useMemo(
    () => new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false }),
    [map]
  );
  useEffect(() => () => mat.dispose(), [mat]);
  return mat;
}

/** A resource card that flies from a hex / corner to another (or pops in place) */
function FlyCard({ terrain, from, to, at, i = 0, fade = false }) {
  const assets = useAssets();
  const time = useStepTime();
  const mat = useSpriteMaterial(assets.card(terrain));
  const ref = useRef(null);
  const a = useMemo(() => point(from), [from]);
  const b = useMemo(() => (from === to ? [a[0], 1.05, a[2]] : point(to, i)), [a, from, to, i]);
  const W = 0.4;
  const H = 0.55;
  useFrame(() => {
    const sp = ref.current;
    if (!sp) return;
    const k = (time() - at) / 0.95;
    sp.visible = k > 0 && !(fade && k >= 1);
    if (!sp.visible) return;
    const c = clamp01(k);
    const e = easeInOut(c);
    const arc = from === to ? 0 : Math.sin(Math.PI * e) * 0.7;
    sp.position.set(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e + arc, a[2] + (b[2] - a[2]) * e);
    let s = 0.35 + 0.65 * easeOutBack(clamp01(c * 2.2));
    if (fade) s *= 1 - easeInOut(clamp01((c - 0.6) / 0.4));
    else if (from !== to) s *= 1 - 0.25 * e;
    sp.scale.set(W * s, H * s, 1);
  });
  return <sprite ref={ref} material={mat} visible={false} renderOrder={30} />;
}

/** Seal / tag / ✓ / ✗ floating over the board */
function Badge({ spec }) {
  const assets = useAssets();
  const time = useStepTime();
  const tex = useMemo(() => assets.badge(spec), [assets, spec]);
  const mat = useSpriteMaterial(tex);
  const ref = useRef(null);
  const h = spec.h || (spec.kind === 'tag' ? 0.3 : spec.kind === 'seal' ? 0.44 : 0.36);
  const w = h * tex.userData.aspect;
  useFrame(() => {
    const sp = ref.current;
    if (!sp) return;
    const t = time();
    const k = (t - (spec.at || 0)) / 0.4;
    sp.visible = k > 0 && !(spec.until !== undefined && t >= spec.until);
    if (!sp.visible) return;
    const s = Math.max(0.001, easeOutBack(clamp01(k)));
    sp.scale.set(w * s, h * s, 1);
    sp.position.set(spec.pos[0], spec.pos[1] + (1 - clamp01(k)) * -0.15, spec.pos[2]);
  });
  return <sprite ref={ref} material={mat} visible={false} renderOrder={40} />;
}

/** Hand of cards over a player; half of them are thrown away */
function Hand({ spec }) {
  const [x, z] = V[spec.v];
  const n = spec.terrains.length;
  return spec.terrains.map((terrain, i) => {
    const off = (i - (n - 1) / 2) * 0.24;
    // a little to the right, so the hand never hides the robber's next hex
    const p = [x + 0.5 + off, 1.25 - Math.abs(off) * 0.1, z];
    const gone = i % 2 === 1;
    return (
      <HandCard key={i} terrain={terrain} pos={p} at={spec.at + i * 0.04} discardAt={gone ? spec.discardAt + i * 0.05 : null} />
    );
  });
}

function HandCard({ terrain, pos, at, discardAt }) {
  const assets = useAssets();
  const time = useStepTime();
  const mat = useSpriteMaterial(assets.card(terrain));
  const ref = useRef(null);
  useFrame(() => {
    const sp = ref.current;
    if (!sp) return;
    const t = time();
    const k = (t - at) / 0.3;
    sp.visible = k > 0;
    if (!sp.visible) return;
    let s = Math.max(0.001, easeOutBack(clamp01(k)));
    let y = pos[1];
    if (discardAt !== null) {
      const d = clamp01((t - discardAt) / 0.6);
      y += easeOutCubic(d) * 0.7;
      s *= 1 - d;
      sp.material.opacity = 1 - d;
      if (d >= 1) sp.visible = false;
    }
    sp.position.set(pos[0], y, pos[2]);
    sp.scale.set(0.34 * s, 0.47 * s, 1);
  });
  return <sprite ref={ref} material={mat} visible={false} renderOrder={31} />;
}

/* ─── Development cards (3D, flipping) ─── */

const DEV_ORDER = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint'];

function DevFan({ at, pick }) {
  const assets = useAssets();
  const time = useStepTime();
  const camera = useThree((s) => s.camera);
  const group = useRef(null);
  const cards = useRef([]);
  const geo = useMemo(() => new THREE.PlaneGeometry(0.56, 0.78), []);
  const mats = useMemo(
    () => ({
      back: new THREE.MeshBasicMaterial({ map: assets.devBack(), side: THREE.FrontSide }),
      front: DEV_ORDER.map((t) => new THREE.MeshBasicMaterial({ map: assets.dev(t), side: THREE.FrontSide })),
    }),
    [assets]
  );
  useEffect(
    () => () => {
      geo.dispose();
      mats.back.dispose();
      mats.front.forEach((m) => m.dispose());
    },
    [geo, mats]
  );
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    g.quaternion.copy(camera.quaternion);
    const t = time();
    cards.current.forEach((c, i) => {
      if (!c) return;
      const k = (t - at - i * 0.12) / 0.4;
      c.visible = k > 0;
      const off = i - 2;
      const flip = clamp01((t - at - 0.5 - i * 0.22) / 0.45);
      c.rotation.set(0, Math.PI * (1 - easeInOut(flip)), -off * 0.12);
      let x = off * 0.5;
      let y = -Math.abs(off) * 0.05;
      let s = Math.max(0.001, easeOutBack(clamp01(k)));
      if (i === 0) {
        const p = easeOutCubic(clamp01((t - pick) / 0.45));
        y += p * 0.36;
        x += p * 0.14;
        s *= 1 + p * 0.25;
        c.rotation.z *= 1 - p;
        c.renderOrder = 60;
      }
      c.position.set(x, y, i === 0 ? 0.02 : 0);
      c.scale.setScalar(s);
    });
  });
  return (
    <group position={[0, 1.55, 0.2]}>
      <group ref={group}>
        {DEV_ORDER.map((t, i) => (
          <group
            key={t}
            ref={(el) => {
              cards.current[i] = el;
            }}
            visible={false}
          >
            <mesh geometry={geo} material={mats.front[i]} renderOrder={50 + i} />
            <mesh geometry={geo} material={mats.back} rotation-y={Math.PI} renderOrder={50 + i} />
          </group>
        ))}
      </group>
    </group>
  );
}

function Knights({ at, pos }) {
  const assets = useAssets();
  const tex = assets.dev('knight');
  return [0, 1, 2].map((i) => (
    <KnightCard key={i} tex={tex} at={at + i * 0.3} pos={[pos[0] + (i - 1) * 0.28, pos[1] - Math.abs(i - 1) * 0.05, pos[2]]} />
  ));
}

function KnightCard({ tex, at, pos }) {
  const time = useStepTime();
  const mat = useSpriteMaterial(tex);
  const ref = useRef(null);
  useFrame(() => {
    const sp = ref.current;
    if (!sp) return;
    const k = (time() - at) / 0.4;
    sp.visible = k > 0;
    const s = Math.max(0.001, easeOutBack(clamp01(k)));
    sp.position.set(pos[0], pos[1], pos[2]);
    sp.scale.set(0.36 * s, 0.5 * s, 1);
  });
  return <sprite ref={ref} material={mat} visible={false} renderOrder={35} />;
}

/* ─── Confetti ─── */

function seededRandom(start) {
  let seed = start;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function Confetti({ at }) {
  const assets = useAssets();
  const time = useStepTime();
  const parts = useMemo(() => {
    const rnd = seededRandom(11);
    return Array.from({ length: 44 }, (_, i) => ({
      mat: i % assets.confettiMats.length,
      v: [(rnd() - 0.5) * 3.2, 2.2 + rnd() * 1.8, (rnd() - 0.5) * 3.2],
      spin: [rnd() * 9, rnd() * 9, rnd() * 9],
      delay: rnd() * 0.25,
    }));
  }, [assets]);
  const refs = useRef([]);
  useFrame(() => {
    const t0 = time() - at;
    parts.forEach((p, i) => {
      const m = refs.current[i];
      if (!m) return;
      const t = t0 - p.delay;
      m.visible = t > 0 && t < 3.4;
      if (!m.visible) return;
      const drag = Math.min(t, 1.2);
      m.position.set(p.v[0] * drag * 0.8, 1.6 + p.v[1] * t - 2.4 * t * t * 0.5, p.v[2] * drag * 0.8);
      m.position.y = Math.max(TILE_H + 0.02, m.position.y);
      m.rotation.set(p.spin[0] * t, p.spin[1] * t, p.spin[2] * t);
    });
  });
  return parts.map((p, i) => (
    <mesh
      key={i}
      ref={(el) => {
        refs.current[i] = el;
      }}
      geometry={assets.confettiGeo}
      material={assets.confettiMats[p.mat]}
      visible={false}
    />
  ));
}

/* ─── Dice ─── */

function DiceThrow({ values, at, pos, reduced, paused }) {
  const on = useAt(at, false, paused);
  if (reduced || !on) return null;
  return (
    <group position={pos} scale={0.5}>
      <GatedDice values={values} seed={Math.round(at * 1000) + values[0]} lowPower />
    </group>
  );
}

/* ─── One step ─── */

function World({ scene, reduced, paused }) {
  // start of the step (null while the stage is still warming up)
  const t0 = useRef(null);
  useLayoutEffect(() => {
    if (!paused && t0.current === null) t0.current = performance.now();
  }, [paused]);
  const clock = useMemo(() => ({ t0, reduced }), [reduced]);
  const rob = scene.robber;
  const robberMoved = useAt(rob?.to ? rob.at : undefined, reduced, paused);
  const robberShown = useAt(rob?.showAt, reduced, paused);
  const robberHex = rob ? (rob.to && robberMoved ? rob.to : rob.hex) : null;
  const tokens = scene.tokens;
  const veil = scene.veil;

  return (
    <ClockContext.Provider value={clock}>
      <Driver until={reduced ? 0 : scene.dur + 0.2} />
      {HEXES.map((hex, i) => (
        <Tile
          key={hex.id}
          hex={hex}
          drop={scene.dropTiles !== undefined ? scene.dropTiles + i * 0.17 : undefined}
          glowAt={scene.glow?.[hex.id]}
          veilAt={veil?.hexes.includes(hex.id) ? veil.at : undefined}
        />
      ))}
      {tokens &&
        HEXES.map(
          (hex, i) =>
            hex.number &&
            hex.id !== robberHex && (
              <Token
                key={hex.id}
                hex={hex}
                drop={tokens.drop !== undefined ? tokens.drop + i * 0.14 : undefined}
                hotAt={tokens.hot}
              />
            )
        )}
      {scene.ports && PORTS.map((p) => <Port key={p.v1} port={p} pulseAt={scene.ports.pulse} />)}
      {robberHex && robberShown && <Robber3D x={HEX[robberHex].x} z={HEX[robberHex].z} />}
      {(scene.pieces || []).map((p) => (
        <Piece key={p.id} spec={p} />
      ))}
      {(scene.cards || []).map((c, i) => (
        <FlyCard key={i} {...c} />
      ))}
      {(scene.badges || []).map((b, i) => (
        <Badge key={i} spec={b} />
      ))}
      {scene.hand && <Hand spec={scene.hand} />}
      {scene.dice && <DiceThrow {...scene.dice} reduced={reduced} paused={paused} />}
      {scene.devCards && <DevFan {...scene.devCards} />}
      {scene.knights && <Knights {...scene.knights} />}
      {scene.confetti !== undefined && !reduced && <Confetti at={scene.confetti} />}
    </ClockContext.Provider>
  );
}

/**
 * One of every kind of thing the lessons draw, mounted only during the
 * warm-up (behind the loading veil) so their shaders are ready before any
 * step needs them.
 */
const KIT_PIECES = [
  { id: 'k1', kind: 'settlement', v: 'A', color: RED },
  { id: 'k2', kind: 'city', v: 'B1', color: BLUE },
  { id: 'k3', kind: 'road', e: ['A', 'a1'], color: RED },
  { id: 'k4', kind: 'road', e: ['B1', 'b1'], color: BLUE },
];
const KIT_VALUES = [1, 1];

const KIT_CLOCK = { t0: { current: null }, reduced: false };

function WarmKit() {
  return (
    <ClockContext.Provider value={KIT_CLOCK}>
      {KIT_PIECES.map((p) => (
        <Piece key={p.id} spec={p} />
      ))}
      <FlyCard terrain="forest" from="h0" to="h0" at={0} />
      <Badge spec={{ kind: 'seal', text: '1', pos: [0, 1, 0] }} />
      <DevFan at={0} pick={0} />
      <Confetti at={0} />
      <Dice values={KIT_VALUES} seed={1} lowPower paused />
    </ClockContext.Provider>
  );
}

/* ─── Camera ─── */

/**
 * Looks at the step's target from its angle, far enough for a sphere of
 * radius `r` to fit the canvas; glides between steps.
 */
function CameraRig({ view, reduced }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const cur = useRef(null);
  const tween = useRef(null);
  const spin = useRef(null);

  const apply = () => {
    const c = cur.current;
    if (!c) return;
    const vHalf = THREE.MathUtils.degToRad(FOV / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * (size.width / Math.max(1, size.height)));
    // 0.85: the island is flat, so the fit sphere can overlap the edges a little
    const dist = (0.85 * c.r) / Math.sin(Math.min(vHalf, hHalf));
    const az = THREE.MathUtils.degToRad(c.az + (spin.current?.extra || 0));
    const el = THREE.MathUtils.degToRad(c.el);
    camera.position.set(
      c.tx + dist * Math.cos(el) * Math.sin(az),
      dist * Math.sin(el),
      c.tz + dist * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(c.tx, 0, c.tz);
    camera.updateProjectionMatrix();
  };

  useLayoutEffect(() => {
    const to = { az: view.az, el: view.el, r: view.r, tx: view.target[0], tz: view.target[1] };
    spin.current = view.spin && !reduced ? { ...view.spin, t0: performance.now(), extra: 0 } : null;
    if (!cur.current || reduced) {
      cur.current = to;
      tween.current = null;
    } else {
      tween.current = { from: { ...cur.current }, to, t0: performance.now() };
    }
    apply();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, reduced]);

  useLayoutEffect(() => {
    apply();
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  useFrame(() => {
    let moving = false;
    const tw = tween.current;
    if (tw) {
      const k = easeInOut(clamp01((performance.now() - tw.t0) / 900));
      const c = {};
      for (const key of Object.keys(tw.to)) c[key] = tw.from[key] + (tw.to[key] - tw.from[key]) * k;
      cur.current = c;
      if (k >= 1) tween.current = null;
      moving = true;
    }
    const sp = spin.current;
    if (sp) {
      const k = clamp01(((performance.now() - sp.t0) / 1000 - sp.at) / sp.dur);
      sp.extra = sp.deg * easeInOut(k);
      if (k < 1) moving = true;
    }
    if (moving) {
      apply();
      invalidate();
    }
  });
  return null;
}

/* ─── Stage ─── */

const BOUNDS = computeBoardBounds(HEX_PX, 110);
const PORT_TEXTURES = PORTS.map((p) => ({ type: p.type, ratio: p.ratio }));

function Stage({ stepId, playKey, reduced, lowPower, warm, onWarm }) {
  const [state, setState] = useState(null);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const scene3 = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    let alive = true;
    let built = null;
    let assets = null;
    const store = new TextureStore({ lowPower: true });
    store
      .load({
        hexGeom: HEXES.map((h) => HEX_PX[h.id]),
        bounds: BOUNDS,
        ports: PORT_TEXTURES,
        tilePx: lowPower ? 256 : 512,
        framePx: lowPower ? 768 : 1280,
      })
      .then(() => {
        if (!alive) return;
        built = new BoardResources(store, { lowPower: true });
        const tile = built.textures.sea.userData.tile;
        if (tile) built.textures.sea.repeat.set(BOUNDS.width / tile.w, BOUNDS.height / tile.h);
        assets = new TutorialAssets(built);
        setState({ res: built, assets });
      })
      .catch(() => {});
    return () => {
      alive = false;
      assets?.dispose();
      built?.dispose();
      store.dispose();
    };
  }, [lowPower]);

  // Warm-up (no frame is drawn yet: frameloop "never"): link every shader in
  // the background and upload the textures in small slices, so the first
  // frames of the lesson never stall. Hidden parts are shown for the compile.
  useLayoutEffect(() => {
    if (!state || !warm) return undefined;
    let alive = true;
    const timers = [];
    const showAll = () => {
      const hidden = [];
      scene3.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      return () =>
        hidden.forEach((o) => {
          o.visible = false;
        });
    };
    const finish = () => {
      if (!alive) return;
      alive = false;
      // one hidden draw of everything (behind the loading veil): some drivers
      // finish preparing a shader only on its first real use
      const restore = showAll();
      try {
        gl.render(scene3, camera);
      } catch {
        // nothing to warm: the lesson simply starts
      }
      restore();
      onWarm();
    };
    const upload = () => {
      const list = [...state.res.textures.all, ...state.assets.cache.values()];
      const next = () => {
        if (!alive) return;
        const tex = list.shift();
        if (!tex) return finish();
        try {
          gl.initTexture(tex);
        } catch {
          // a texture that can't be uploaded now is uploaded by the first frame
        }
        timers.push(setTimeout(next, 0));
      };
      next();
    };
    const restore = showAll();
    let job;
    try {
      job = gl.compileAsync ? gl.compileAsync(scene3, camera) : Promise.resolve(gl.compile(scene3, camera));
    } catch {
      job = Promise.resolve();
    }
    restore();
    job.then(upload, upload);
    // a driver that never answers must not hold the lesson back
    timers.push(setTimeout(finish, 3000));
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [state, warm, gl, scene3, camera, onWarm]);

  useEffect(() => {
    if (state && !warm) invalidate();
  }, [state, warm, invalidate]);

  // Dice faces are painted once a step has finished playing (idle time), so
  // the first throw starts at once and no animation is slowed down by it
  const diceWarm = useRef(false);
  const scene = SCENES[stepId] || SCENES.goal;
  useEffect(() => {
    if (!state || warm || diceWarm.current) return undefined;
    const id = setTimeout(() => {
      diceWarm.current = true;
      warmDice(true);
    }, (reduced ? 0.5 : scene.dur + 0.4) * 1000);
    return () => clearTimeout(id);
  }, [state, warm, scene, reduced, playKey]);

  const ctx = useMemo(() => (state ? { res: state.res, assets: state.assets } : null), [state]);

  return (
    <>
      <CameraRig view={scene.cam} reduced={reduced} />
      {ctx && (
        <SceneContext.Provider value={ctx}>
          <Lights radius={3.2} shadows={false} />
          <SeaAndFrame bounds={BOUNDS} />
          <World key={`${stepId}:${playKey}`} scene={scene} reduced={reduced} paused={warm} />
          {warm && <WarmKit />}
        </SceneContext.Provider>
      )}
    </>
  );
}

export default function TutorialStage3D({ stepId, playKey, reduced, onReady, className = '' }) {
  const [lowPower] = useState(isLowPowerDevice);
  const [warm, setWarm] = useState(true);
  const onWarm = useCallback(() => {
    setWarm(false);
    onReady?.();
  }, [onReady]);
  return (
    <Canvas
      className={className}
      frameloop={warm ? 'never' : 'demand'}
      dpr={lowPower ? [1, 1.25] : [1, 1.5]}
      flat
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 6, 6] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ touchAction: 'pan-y' }}
      aria-hidden="true"
    >
      <Stage stepId={stepId} playKey={playKey} reduced={reduced} lowPower={lowPower} warm={warm} onWarm={onWarm} />
    </Canvas>
  );
}
