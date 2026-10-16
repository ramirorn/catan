// The 3D dice throw (lazy chunk, shares three.js / R3F with the 3D board).
//
// No physics engine: each die follows a scripted throw (flight + three
// shrinking bounces + rest) and its rotation is "final orientation × a spin
// that decays to zero", so the tumble always ends exactly on the face the
// server rolled. The throw is seeded with the roll id, so every player sees
// the same throw. Mounted only while the dice are on screen.

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useShadersReady } from '../Effects/useShadersReady';

/* ─── Shape ─── */

const SIZE = 1;
const HALF = SIZE / 2;
const ROUND = 0.12; // edge radius
const INNER = HALF - ROUND;
const SEGMENTS = 10; // per side: 4 for each rounded band, 2 for the flat middle
const BAND = ROUND / SIZE; // rounded band, as a fraction of a face

// BoxGeometry material groups: +X, -X, +Y, -Y, +Z, -Z (opposite faces add up to 7)
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];
const UP = new THREE.Vector3(0, 1, 0);

/** Grid fraction (0..1, uniform) → fraction packed toward the edges, so the rounding is smooth */
function packEdges(t) {
  const i = t * SEGMENTS;
  if (i <= 4) return BAND * (i / 4);
  if (i >= 6) return 1 - BAND * ((SEGMENTS - i) / 4);
  return BAND + (1 - 2 * BAND) * ((i - 4) / 2);
}

/** Cube with soft rounded edges that keeps one UV square + material per face */
function createDieGeometry() {
  const geo = new THREE.BoxGeometry(SIZE, SIZE, SIZE, SEGMENTS, SEGMENTS, SEGMENTS);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const nrm = geo.attributes.normal;
  const p = new THREE.Vector3();
  const inner = new THREE.Vector3();
  const n = new THREE.Vector3();
  const remap = (c) => -HALF + SIZE * packEdges((c + HALF) / SIZE);
  for (let i = 0; i < pos.count; i++) {
    p.set(remap(pos.getX(i)), remap(pos.getY(i)), remap(pos.getZ(i)));
    uv.setXY(i, packEdges(uv.getX(i)), packEdges(uv.getY(i)));
    inner.set(
      THREE.MathUtils.clamp(p.x, -INNER, INNER),
      THREE.MathUtils.clamp(p.y, -INNER, INNER),
      THREE.MathUtils.clamp(p.z, -INNER, INNER)
    );
    n.subVectors(p, inner);
    if (n.lengthSq() > 1e-10) {
      n.normalize();
      p.copy(inner).addScaledVector(n, ROUND);
      nrm.setXYZ(i, n.x, n.y, n.z);
    }
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  nrm.needsUpdate = true;
  geo.computeBoundingSphere();
  return geo;
}

/* ─── Face art (canvas) ─── */

const PIP_SPOTS = {
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.29, 0.24], [0.71, 0.24], [0.29, 0.5], [0.71, 0.5], [0.29, 0.76], [0.71, 0.76]],
};

const STYLES = {
  // Carved pale wood, ink pips
  wood: {
    base: '#e7d5b0',
    vignette: 'rgba(96, 58, 24, 0.42)',
    grain: 'rgba(118, 74, 34, ALPHA)',
    groove: 'rgba(92, 56, 22, 0.32)',
    pip: '#1f1b17',
    pipLight: 'rgba(255, 249, 232, 0.75)',
    sealRing: '#861f11',
  },
  // Black lacquer, chakra-orange pips
  lacquer: {
    base: '#1a1619',
    vignette: 'rgba(0, 0, 0, 0.6)',
    grain: null,
    groove: 'rgba(226, 113, 29, 0.6)',
    pip: '#f08a2c',
    pipLight: 'rgba(0, 0, 0, 0.75)',
    sealRing: '#f6a04b',
  },
};

/** Magatama-like pip: round head with a short curling tail */
function magatamaPath(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.moveTo(x + r, y);
  ctx.quadraticCurveTo(x + 1.05 * r, y + 1.5 * r, x - 0.55 * r, y + 1.72 * r);
  ctx.quadraticCurveTo(x + 0.18 * r, y + 1.38 * r, x, y + r * 0.98);
  ctx.closePath();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function seededRandom(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintFace(value, styleName, px) {
  const s = STYLES[styleName];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  const rnd = seededRandom(value * 31 + (styleName === 'wood' ? 7 : 13));

  ctx.fillStyle = s.base;
  ctx.fillRect(0, 0, px, px);

  if (styleName === 'lacquer') {
    const g = ctx.createRadialGradient(px * 0.38, px * 0.32, px * 0.05, px * 0.5, px * 0.5, px * 0.75);
    g.addColorStop(0, 'rgba(92, 40, 36, 0.35)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, px, px);
  }

  // Wood grain: long wavy strokes
  if (s.grain) {
    for (let i = 0; i < 30; i++) {
      const y0 = rnd() * px;
      ctx.strokeStyle = s.grain.replace('ALPHA', (0.06 + rnd() * 0.14).toFixed(3));
      ctx.lineWidth = px * (0.002 + rnd() * 0.006);
      ctx.beginPath();
      ctx.moveTo(-10, y0);
      const amp = px * (0.01 + rnd() * 0.03);
      ctx.bezierCurveTo(px * 0.3, y0 + amp, px * 0.6, y0 - amp, px + 10, y0 + amp * 0.5);
      ctx.stroke();
    }
  }

  // Darker toward the rounded rim
  const v = ctx.createRadialGradient(px / 2, px / 2, px * 0.36, px / 2, px / 2, px * 0.74);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, s.vignette);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, px, px);

  // Carved / gilded groove just inside the rounded band
  const inset = px * (BAND + 0.035);
  roundRectPath(ctx, inset, inset, px - inset * 2, px - inset * 2, px * 0.07);
  ctx.strokeStyle = s.groove;
  ctx.lineWidth = px * 0.012;
  ctx.stroke();

  if (value === 1) {
    // Red seal (hanko) with a paper-white spiral
    const cx = px / 2;
    const R = px * 0.235;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = px * 0.02;
    ctx.shadowOffsetY = px * 0.006;
    ctx.fillStyle = '#b6331f';
    ctx.beginPath();
    ctx.arc(cx, cx, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = s.sealRing;
    ctx.lineWidth = px * 0.012;
    ctx.beginPath();
    ctx.arc(cx, cx, R + px * 0.03, 0, Math.PI * 2);
    ctx.stroke();
    // Spiral
    ctx.strokeStyle = '#f6eedb';
    ctx.lineWidth = px * 0.03;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const turns = 2.35 * Math.PI * 2;
    for (let a = 0; a <= turns; a += 0.08) {
      const rr = px * 0.012 + (R * 0.78 * a) / turns;
      const x = cx + Math.cos(a - Math.PI / 2) * rr;
      const y = cx + Math.sin(a - Math.PI / 2) * rr;
      if (a === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Worn stamp texture
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 140; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * R;
      ctx.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.35})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cx + Math.sin(a) * d, px * (0.002 + rnd() * 0.005), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Re-lay the base under the specks so they read as faded ink, not holes
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = s.base;
    ctx.fillRect(0, 0, px, px);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    const r = px * 0.068;
    for (const [fx, fy] of PIP_SPOTS[value]) {
      const x = fx * px;
      const y = fy * px - r * 0.35;
      // Engraved edge: light lip on one side, then the pip
      magatamaPath(ctx, x + px * 0.006, y + px * 0.007, r);
      ctx.fillStyle = s.pipLight;
      ctx.fill();
      magatamaPath(ctx, x, y, r);
      if (styleName === 'lacquer') {
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 1.6);
        g.addColorStop(0, '#ffc27a');
        g.addColorStop(0.5, s.pip);
        g.addColorStop(1, '#a94f0c');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = s.pip;
      }
      ctx.fill();
    }
  }
  return canvas;
}

// Painted faces are kept for the whole session (12 small canvases), so a
// throw never repaints them; warmDice() paints them ahead, one per idle slot.
const faceCanvases = new Map();
function faceCanvas(value, styleName, px) {
  const key = `${styleName}:${value}:${px}`;
  let c = faceCanvases.get(key);
  if (!c) {
    c = paintFace(value, styleName, px);
    faceCanvases.set(key, c);
  }
  return c;
}

/** Paints the dice faces in idle time, so the first throw starts without a stall */
export function warmDice(lowPower) {
  const px = lowPower ? 256 : 512;
  const jobs = [];
  for (const style of ['wood', 'lacquer']) for (const v of FACE_VALUES) jobs.push(() => faceCanvas(v, style, px));
  const idle = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 50));
  const step = (deadline) => {
    while (jobs.length && deadline.timeRemaining() > 4) jobs.shift()();
    if (jobs.length) idle(step, { timeout: 2000 });
  };
  idle(step, { timeout: 2000 });
}

function makeFaceMaterials(styleName, px, lowPower, anisotropy) {
  return FACE_VALUES.map((value) => {
    const tex = new THREE.CanvasTexture(faceCanvas(value, styleName, px));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    if (styleName === 'lacquer' && !lowPower) {
      return new THREE.MeshPhysicalMaterial({
        map: tex,
        roughness: 0.38,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
      });
    }
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: styleName === 'wood' ? 0.62 : 0.3,
      metalness: 0,
    });
  });
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ─── Throw script ─── */

// Bounce timeline, as fractions of a die's flight time
const IMPACTS = [0.4, 0.66, 0.83, 0.93];
const HOPS = [0.95, 0.34, 0.09];

function makePlan(k, value, rnd) {
  const end = new THREE.Vector3(k === 0 ? -0.82 : 0.82, 0, (k === 0 ? 0.18 : -0.18) + (rnd() - 0.5) * 0.3);
  end.x += (rnd() - 0.5) * 0.2;
  // Thrown in from the lower right, like from the player's hand
  const start = new THREE.Vector3(4.6 + k * 0.9 + rnd() * 0.6, 3.1 + rnd() * 0.5, 4.4 - k * 0.7 + rnd() * 0.5);

  const yaw = new THREE.Quaternion().setFromAxisAngle(UP, (rnd() - 0.5) * 1.2);
  const qEnd = new THREE.Quaternion().setFromUnitVectors(FACE_NORMALS[FACE_VALUES.indexOf(value)], UP).premultiply(yaw);

  const travel = new THREE.Vector3().subVectors(end, start).setY(0).normalize();
  const rollAxis = new THREE.Vector3().crossVectors(UP, travel).normalize();
  return {
    start,
    end,
    delay: k * 0.07,
    dur: 1.0 + rnd() * 0.12,
    qEnd,
    rollAxis,
    twistAxis: travel,
    // Whole turns plus a bit, so it does not look scripted
    roll: (3 + Math.floor(rnd() * 2)) * Math.PI * 2 + rnd() * Math.PI,
    twist: (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 1.4) * Math.PI,
  };
}

/** Height of the die's lowest point above the table at flight fraction s */
function bounceHeight(s, h0) {
  if (s <= IMPACTS[0]) {
    const u = s / IMPACTS[0];
    return h0 * (1 - u * u);
  }
  for (let i = 0; i < 3; i++) {
    if (s <= IMPACTS[i + 1]) {
      const u = (s - IMPACTS[i]) / (IMPACTS[i + 1] - IMPACTS[i]);
      return 4 * HOPS[i] * u * (1 - u);
    }
  }
  return 0;
}

const easeTravel = (s) => 1 - Math.pow(1 - s, 2.6);
const spinLeft = (s) => Math.pow(1 - s, 3);

/* ─── Scene pieces ─── */

const TRAIL = 9;
const DUST = 9;

function CameraFit() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Keep ~3.4 units of table above/below centre and ~2.9 left/right
    const dist = Math.max(3.5 / tanHalf, 2.9 / (tanHalf * aspect));
    const dir = new THREE.Vector3(0, 9, 3.9).normalize();
    const target = new THREE.Vector3(0, 0, -0.85);
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function RoomLight({ enabled }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (!enabled) return undefined;
    const { gl, scene } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.45;
    room.traverse((o) => {
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    });
    pmrem.dispose();
    return () => {
      scene.environment = null;
      env.dispose();
    };
  }, [enabled, get]);
  return null;
}

/**
 * The two dice and their effects, on a table plane at y = 0. Used by the
 * overlay canvas below and, on the 3D board, inside the board scene itself
 * (onTop: drawn over the board pieces instead of clipping into them).
 */
export function Dice({ values, seed, lowPower, onStart, onSettled, onTop = false, paused = false }) {
  const gl = useThree((s) => s.gl);

  const assets = useMemo(() => {
    const px = lowPower ? 256 : 512;
    const aniso = Math.min(4, gl.capabilities.getMaxAnisotropy());
    const materials = [makeFaceMaterials('wood', px, lowPower, aniso), makeFaceMaterials('lacquer', px, lowPower, aniso)];
    if (onTop) {
      // A convex die with back faces culled needs no depth test against itself
      for (const set of materials) for (const m of set) m.depthTest = false;
    }
    return {
      geometry: createDieGeometry(),
      materials,
      shadowTex: radialTexture([
        [0, 'rgba(0,0,0,0.85)'],
        [0.55, 'rgba(0,0,0,0.35)'],
        [1, 'rgba(0,0,0,0)'],
      ]),
      glowTex: radialTexture([
        [0, 'rgba(255,255,255,1)'],
        [0.35, 'rgba(255,255,255,0.5)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
      dustTex: radialTexture([
        [0, 'rgba(255,255,255,0.9)'],
        [0.6, 'rgba(255,255,255,0.35)'],
        [1, 'rgba(255,255,255,0)'],
      ]),
    };
  }, [gl, lowPower, onTop]);

  const plans = useMemo(() => {
    const rnd = seededRandom(seed);
    return values.map((v, k) => makePlan(k, v, rnd));
  }, [values, seed]);

  // Trail sprites, dust puffs and contact shadows, built imperatively
  const fx = useMemo(() => {
    const group = new THREE.Group();
    const perDie = plans.map(() => {
      const shadowMat = new THREE.MeshBasicMaterial({
        map: assets.shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.renderOrder = -1;
      group.add(shadow);

      const trail = [];
      for (let i = 0; i < TRAIL; i++) {
        const m = new THREE.SpriteMaterial({
          map: assets.glowTex,
          color: i < 3 ? '#ffb15c' : '#e2711d',
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        });
        const sp = new THREE.Sprite(m);
        sp.visible = false;
        group.add(sp);
        trail.push(sp);
      }

      const dust = [];
      for (let i = 0; i < DUST * 2; i++) {
        const m = new THREE.SpriteMaterial({
          map: assets.dustTex,
          color: i % 3 === 0 ? '#f6a04b' : '#d8c7a4',
          transparent: true,
          depthWrite: false,
          opacity: 0,
        });
        const sp = new THREE.Sprite(m);
        sp.visible = false;
        group.add(sp);
        dust.push({ sprite: sp, born: -1, vel: new THREE.Vector3() });
      }
      return { shadow, trail, dust, history: [], impactsDone: 0 };
    });
    return { group, perDie };
  }, [plans, assets]);

  useEffect(
    () => () => {
      assets.geometry.dispose();
      for (const set of assets.materials) {
        for (const m of set) {
          m.map?.dispose();
          m.dispose();
        }
      }
      assets.shadowTex.dispose();
      assets.glowTex.dispose();
      assets.dustTex.dispose();
    },
    [assets]
  );
  useEffect(
    () => () => {
      fx.group.traverse((o) => {
        if (o.isMesh) o.geometry.dispose();
        o.material?.dispose?.();
      });
    },
    [fx]
  );

  const meshes = useRef([]);
  const clock = useRef({ t: 0, started: false, settled: false });
  const tmp = useMemo(
    () => ({
      q: new THREE.Quaternion(),
      q2: new THREE.Quaternion(),
      down: new THREE.Vector3(),
      prev: new THREE.Vector3(),
    }),
    []
  );

  useFrame((_, delta) => {
    // waits (invisible) until its shaders are linked
    if (paused) return;
    const c = clock.current;
    if (!c.started) {
      c.started = true;
      onStart?.();
    }
    // Real time, but a long hitch (first frame / shader compile) must not skip the throw
    c.t += Math.min(delta, 0.1);
    const t = c.t;
    let allDone = true;

    plans.forEach((plan, k) => {
      const mesh = meshes.current[k];
      if (!mesh) return;
      const f = fx.perDie[k];
      const s = THREE.MathUtils.clamp((t - plan.delay) / plan.dur, 0, 1);
      if (s < 1) allDone = false;

      // Orientation: final pose with a spin that decays to exactly zero
      const left = spinLeft(s);
      tmp.q.setFromAxisAngle(plan.rollAxis, plan.roll * left);
      tmp.q2.setFromAxisAngle(plan.twistAxis, plan.twist * left);
      mesh.quaternion.copy(tmp.q).multiply(tmp.q2).multiply(plan.qEnd);

      // Position: travel + bounces; lift so the lowest edge touches the table
      tmp.prev.copy(mesh.position);
      const e = easeTravel(s);
      const h = bounceHeight(s, plan.start.y);
      tmp.down.set(0, -1, 0).applyQuaternion(tmp.q.copy(mesh.quaternion).invert());
      const support = INNER * (Math.abs(tmp.down.x) + Math.abs(tmp.down.y) + Math.abs(tmp.down.z)) + ROUND;
      mesh.position.set(
        THREE.MathUtils.lerp(plan.start.x, plan.end.x, e),
        h + support,
        THREE.MathUtils.lerp(plan.start.z, plan.end.z, e)
      );
      mesh.visible = t >= plan.delay;

      // Soft contact shadow
      f.shadow.position.set(mesh.position.x, 0.002, mesh.position.z);
      const sh = THREE.MathUtils.clamp(1 - h / 3.2, 0, 1);
      f.shadow.material.opacity = mesh.visible ? 0.55 * sh : 0;
      f.shadow.scale.setScalar(0.9 + (1 - sh) * 0.9);

      // Chakra trail, strongest while the die flies fast
      const speed = delta > 0 ? tmp.prev.distanceTo(mesh.position) / Math.max(delta, 1 / 120) : 0;
      f.history.unshift(mesh.position.clone());
      if (f.history.length > TRAIL) f.history.pop();
      const glow = mesh.visible ? THREE.MathUtils.clamp((speed - 1.2) / 6, 0, 1) : 0;
      f.trail.forEach((sp, i) => {
        const p = f.history[i + 1];
        sp.visible = !!p && glow > 0.01;
        if (!sp.visible) return;
        sp.position.copy(p);
        const fade = 1 - i / TRAIL;
        sp.material.opacity = 0.55 * glow * fade;
        sp.scale.setScalar(0.95 * fade + 0.15);
      });

      // Dust puff on the first two impacts
      while (f.impactsDone < 2 && s >= IMPACTS[f.impactsDone]) {
        const strength = f.impactsDone === 0 ? 1 : 0.55;
        for (let i = 0; i < DUST; i++) {
          const d = f.dust[f.impactsDone * DUST + i];
          const a = (i / DUST) * Math.PI * 2 + Math.random() * 0.5;
          d.born = t;
          d.strength = strength;
          d.sprite.position.set(mesh.position.x + Math.cos(a) * 0.35, 0.12, mesh.position.z + Math.sin(a) * 0.35);
          d.vel.set(Math.cos(a) * (1.3 + Math.random()) * strength, 0.35 + Math.random() * 0.4, Math.sin(a) * (1.3 + Math.random()) * strength);
          d.sprite.visible = true;
        }
        f.impactsDone++;
      }
      for (const d of f.dust) {
        if (d.born < 0) continue;
        const age = (t - d.born) / 0.6;
        if (age >= 1) {
          d.sprite.visible = false;
          d.born = -1;
          continue;
        }
        const dt = Math.min(delta, 1 / 30);
        d.sprite.position.addScaledVector(d.vel, dt);
        d.vel.multiplyScalar(1 - 3.5 * dt);
        d.sprite.scale.setScalar((0.35 + age * 0.9) * (0.6 + 0.4 * d.strength));
        d.sprite.material.opacity = 0.42 * d.strength * (1 - age) * (1 - age);
      }
    });

    if (allDone && !c.settled && t > plans.reduce((m, p) => Math.max(m, p.delay + p.dur), 0) + 0.06) {
      c.settled = true;
      onSettled?.();
    }
  });

  return (
    <>
      <primitive object={fx.group} />
      {plans.map((plan, k) => (
        <mesh
          key={k}
          ref={(m) => {
            meshes.current[k] = m;
          }}
          geometry={assets.geometry}
          material={assets.materials[k]}
          position={plan.start}
          renderOrder={onTop ? 20 : 0}
          visible={false}
        />
      ))}
    </>
  );
}

/**
 * 2D board: keep the dice on the board. anchor() returns how far (px) the
 * board point under the overlay centre moved since the throw and how much
 * the board zoom changed; the view is shifted / scaled to match, so the
 * dice ride along with the map instead of sticking to the screen.
 */
function AnchorView({ anchor }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const last = useRef({ dx: 0, dy: 0, k: 1, on: false });
  useFrame(() => {
    const a = anchor?.();
    const l = last.current;
    if (!a) {
      if (l.on) {
        camera.clearViewOffset();
        camera.zoom = 1;
        camera.updateProjectionMatrix();
        l.on = false;
      }
      return;
    }
    if (l.on && Math.abs(a.dx - l.dx) < 0.05 && Math.abs(a.dy - l.dy) < 0.05 && Math.abs(a.k - l.k) < 1e-4) return;
    camera.zoom = a.k;
    camera.setViewOffset(size.width, size.height, -a.dx, -a.dy, size.width, size.height);
    Object.assign(l, { dx: a.dx, dy: a.dy, k: a.k, on: true });
  });
  return null;
}

/** The dice start only once their shaders are linked (no stall mid-throw) */
export function GatedDice(props) {
  const ready = useShadersReady();
  return <Dice {...props} paused={!ready} />;
}

export default function DiceScene({ die1, die2, seed, lowPower, onStart, onSettled, anchor }) {
  const values = useMemo(() => [die1, die2], [die1, die2]);
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      dpr={[1, lowPower ? 1.5 : 2]}
      gl={{ alpha: true, antialias: !lowPower, powerPreference: 'default' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
      camera={{ fov: 30, near: 0.5, far: 80, position: [0, 9, 6.2] }}
      frameloop="always"
    >
      <CameraFit />
      {anchor && <AnchorView anchor={anchor} />}
      <RoomLight enabled={!lowPower} />
      <hemisphereLight args={['#fff1dc', '#3a2414', 1.1]} />
      <directionalLight position={[-3.5, 10, 4]} intensity={2.3} color="#fff6e8" />
      <pointLight position={[3.2, 2.2, 2.6]} intensity={9} distance={11} decay={2} color="#e2711d" />
      <GatedDice values={values} seed={seed} lowPower={lowPower} onStart={onStart} onSettled={onSettled} />
    </Canvas>
  );
}
