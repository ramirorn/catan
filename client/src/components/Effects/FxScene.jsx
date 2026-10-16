// Board animations in 3D (lazy chunk, shares three.js / R3F with the dice and
// the 3D board). One transparent canvas over the board, never clickable,
// mounted only while an animation plays.
//
// The camera is a perspective camera whose z = 0 plane maps 1:1 to CSS
// pixels of the overlay, so effects tied to the board are placed each frame
// at the projection of their board point (2D or 3D board alike, through the
// board bridge) and scaled with the board zoom: they stay put when the board
// pans, zooms or flies.
//
// Every effect runs on its own wall clock and reports reveal / done to the
// overlay, which owns the queue and the safety timers.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getBoardBridge } from './fxSignal';
import { useShadersReady } from './useShadersReady';

const FOV = 30;
const HEX = 60; // board units per hex radius

/* ─── math ─── */

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeIn = (x) => x * x * x;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const backOut = (x) => 1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
const bell = (x) => Math.sin(Math.PI * clamp01(x));

function seeded(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Wall clock shared by an effect and its parts (starts at the first frame once shaders are ready) */
function tick(clock) {
  if (clock.paused) return 0;
  const now = performance.now();
  if (clock.t0 === null) clock.t0 = now;
  return (now - clock.t0) / 1000;
}

/* ─── canvas textures ─── */

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function radial(stops) {
  return canvasTex(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    for (const [o, col] of stops) g.addColorStop(o, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

function smokeTex() {
  return canvasTex(128, 128, (ctx) => {
    const rnd = seeded(7);
    for (let i = 0; i < 9; i++) {
      const x = 40 + rnd() * 48;
      const y = 40 + rnd() * 48;
      const r = 22 + rnd() * 20;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
  });
}

/** Puffy red cloud with a pale outline (the renegade's mark) */
function cloudTex() {
  return canvasTex(128, 80, (ctx) => {
    const bumps = [
      [34, 48, 18],
      [56, 34, 22],
      [80, 38, 19],
      [98, 50, 15],
      [62, 54, 20],
    ];
    const path = () => {
      ctx.beginPath();
      for (const [x, y, r] of bumps) {
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    };
    ctx.fillStyle = '#f3ede1';
    ctx.save();
    ctx.translate(0, 0);
    for (const [x, y, r] of bumps) {
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    path();
    ctx.fillStyle = '#c0271b';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(50, 28, 9, 0, Math.PI * 2);
    ctx.fill();
  });
}

function spiral(ctx, cx, cy, r, turns, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const end = turns * Math.PI * 2;
  for (let a = 0; a <= end; a += 0.08) {
    const rr = (r * a) / end;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (a === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Back of a resource card: indigo lacquer, chakra border, spiral seal (says nothing about the card) */
function cardBackTex() {
  return canvasTex(160, 224, (ctx, w, h) => {
    ctx.fillStyle = '#1b2340';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e2711d';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = 'rgba(246,160,75,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    spiral(ctx, w / 2, h / 2, 46, 2.4, 6, '#f6a04b');
    ctx.fillStyle = '#b6331f';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 9, 0, Math.PI * 2);
    ctx.fill();
  });
}

const CARD_TITLES = {
  knight: 'CABALLERO',
  roadBuilding: 'CAMINOS',
  yearOfPlenty: 'ABUNDANCIA',
  monopoly: 'MONOPOLIO',
};

/** Front of a development card: washi, ink frame, emblem and title */
function devFrontTex(cardType, accent) {
  return canvasTex(256, 360, (ctx, w, h) => {
    ctx.fillStyle = '#f1e9d6';
    ctx.fillRect(0, 0, w, h);
    // fibres
    const rnd = seeded(cardType.length * 13);
    ctx.strokeStyle = 'rgba(133,122,107,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.3, y + 6, w * 0.6, y - 6, w, y + 3);
      ctx.stroke();
    }
    ctx.strokeStyle = '#1f1b17';
    ctx.lineWidth = 10;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.strokeStyle = '#b6331f';
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    // emblem disc
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(w / 2, 150, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1f1b17';
    ctx.stroke();
    ctx.save();
    ctx.translate(w / 2, 150);
    ctx.fillStyle = '#f9f4e8';
    ctx.strokeStyle = '#f9f4e8';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (cardType === 'knight') {
      // crossed kunai
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.rotate(s * 0.75);
        ctx.beginPath();
        ctx.moveTo(0, -58);
        ctx.lineTo(11, -14);
        ctx.lineTo(0, -6);
        ctx.lineTo(-11, -14);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(-4, -6, 8, 46);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 48, 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    } else if (cardType === 'roadBuilding') {
      // arched plank bridge
      for (let i = 0; i < 6; i++) {
        const x = -55 + i * 22;
        const y = 10 - Math.sin(((i + 0.5) / 6) * Math.PI) * 18;
        ctx.fillRect(x, y, 17, 26);
      }
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-60, -10);
      ctx.quadraticCurveTo(0, -50, 60, -10);
      ctx.stroke();
    } else if (cardType === 'yearOfPlenty') {
      // rice bale with ropes
      ctx.beginPath();
      ctx.ellipse(0, 0, 50, 36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 7;
      for (const x of [-22, 22]) {
        ctx.beginPath();
        ctx.moveTo(x, -34);
        ctx.quadraticCurveTo(x + 6, 0, x, 34);
        ctx.stroke();
      }
    } else {
      // summoning seal: ring + spokes
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
        ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
        ctx.stroke();
      }
      spiral(ctx, 0, 0, 16, 1.6, 4, '#f9f4e8');
    }
    ctx.restore();
    // title
    ctx.fillStyle = '#1f1b17';
    ctx.font = '900 30px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CARD_TITLES[cardType] || '', w / 2, 278, w - 50);
    ctx.fillStyle = '#b6331f';
    ctx.fillRect(w / 2 - 40, 304, 80, 4);
  });
}

/** Summoning circle on the floor (Monopolio) */
function sealCircleTex() {
  return canvasTex(512, 512, (ctx, w) => {
    const c = w / 2;
    ctx.translate(c, c);
    ctx.strokeStyle = '#ffd08a';
    ctx.fillStyle = '#ffd08a';
    ctx.lineCap = 'round';
    for (const [r, lw] of [
      [240, 10],
      [214, 4],
      [150, 6],
      [70, 5],
    ]) {
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // glyph-like strokes between the outer rings
    ctx.lineWidth = 5;
    for (let i = 0; i < 16; i++) {
      ctx.save();
      ctx.rotate((i / 16) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(-10, -200);
      ctx.lineTo(10, -200);
      ctx.moveTo(0, -206);
      ctx.lineTo(0, -168);
      ctx.moveTo(-8, -180);
      ctx.lineTo(8, -186);
      ctx.stroke();
      ctx.restore();
    }
    // five spokes (one per resource) and a spiral heart
    ctx.lineWidth = 6;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 70, Math.sin(a) * 70);
      ctx.lineTo(Math.cos(a) * 150, Math.sin(a) * 150);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 112, Math.sin(a) * 112, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    spiral(ctx, 0, 0, 56, 2.2, 6, '#ffd08a');
  });
}

/** Seal impression of the near-win hanko: player colour, a big number */
function hankoTex(color, vpLeft) {
  return canvasTex(512, 512, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c, c, 236, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f9f4e8';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(c, c, 200, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c, c, 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f9f4e8';
    ctx.font = '900 250px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(vpLeft), c, c + 14);
    // worn ink specks
    const rnd = seeded(vpLeft * 31 + 5);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 220; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * 236;
      ctx.fillStyle = `rgba(0,0,0,${0.12 + rnd() * 0.3})`;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.5 + rnd() * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Thin horizontal streak, bright in the middle */
function streakTex() {
  return canvasTex(256, 32, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.3, w, h * 0.4);
    const g2 = ctx.createLinearGradient(0, 0, 0, h);
    g2.addColorStop(0, 'rgba(0,0,0,1)');
    g2.addColorStop(0.5, 'rgba(0,0,0,0)');
    g2.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Vertical glow for the light pillar (alpha only) */
function pillarTex() {
  return canvasTex(8, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/* ─── shared resources (one set per canvas) ─── */

function useAssets() {
  const assets = useMemo(() => {
    const disposables = [];
    const keep = (o) => {
      disposables.push(o);
      return o;
    };
    const tex = {
      glow: keep(
        radial([
          [0, 'rgba(255,255,255,1)'],
          [0.3, 'rgba(255,255,255,0.55)'],
          [1, 'rgba(255,255,255,0)'],
        ])
      ),
      smoke: keep(smokeTex()),
      cloud: keep(cloudTex()),
      cardBack: keep(cardBackTex()),
      streak: keep(streakTex()),
      pillar: keep(pillarTex()),
    };
    const geo = {
      box: keep(new THREE.BoxGeometry(1, 1, 1)),
      ring: keep(new THREE.RingGeometry(0.86, 1, 64)),
      thinRing: keep(new THREE.RingGeometry(0.95, 1, 64)),
      plane: keep(new THREE.PlaneGeometry(1, 1)),
      disc: keep(new THREE.CircleGeometry(1, 48)),
      pillar: keep(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0)),
      cone: keep(new THREE.ConeGeometry(1, 1, 20)),
      cyl: keep(new THREE.CylinderGeometry(1, 1, 1, 20)),
      sphere: keep(new THREE.SphereGeometry(1, 16, 12)),
      torus: keep(new THREE.TorusGeometry(1, 0.22, 8, 24)),
      cloak: keep(
        new THREE.LatheGeometry(
          [
            [0.0, 0.0],
            [0.2, 0.0],
            [0.19, 0.06],
            [0.165, 0.16],
            [0.13, 0.27],
            [0.095, 0.35],
            [0.07, 0.37],
            [0.0, 0.37],
          ].map(([x, y]) => new THREE.Vector2(x, y)),
          24
        )
      ),
    };
    return {
      tex,
      geo,
      keep,
      dispose() {
        for (const o of disposables) o.dispose();
      },
    };
  }, []);
  useEffect(() => () => assets.dispose(), [assets]);
  return assets;
}

/** Per-effect materials, disposed with the effect */
function useMaterials(factory, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const mats = useMemo(factory, deps);
  useEffect(
    () => () => {
      for (const m of Object.values(mats)) {
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose?.();
      }
    },
    [mats]
  );
  return mats;
}

const additive = (p) =>
  new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...p });

/* ─── camera + board anchors ─── */

function PixelCamera() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    const d = size.height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.fov = FOV;
    camera.position.set(0, 0, d);
    camera.near = Math.max(1, d - 2000);
    camera.far = d + 2000;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/**
 * Board point → overlay world position (px, y up) and hex radius in px.
 * Returns false when the board is not measurable (then the last value stays).
 */
function useAnchor() {
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const cache = { at: -1, rect: null };
    return (bx, by, out) => {
      const b = getBoardBridge();
      const p = b?.project(bx, by);
      if (!p) return false;
      const now = performance.now();
      if (now - cache.at > 8 || !cache.rect) {
        cache.rect = gl.domElement.getBoundingClientRect();
        cache.at = now;
      }
      const r = cache.rect;
      out.x = p.x - r.left - r.width / 2;
      out.y = r.height / 2 - (p.y - r.top);
      out.R = Math.max(14, Math.min(260, p.s * HEX));
      return true;
    };
  }, [gl]);
}

const is3D = () => getBoardBridge()?.mode === '3d';

/* ─── generic parts ─── */

/** Soft smoke puffs (normal blending), optionally with red clouds */
function Smoke({ clock, assets, seed, start, dur = 0.7, count = 10, spread = 0.55, color = '#2a2730', clouds = 0 }) {
  const parts = useMemo(() => {
    const rnd = seeded(seed);
    const list = [];
    for (let i = 0; i < count + clouds; i++) {
      const cloud = i >= count;
      const m = new THREE.SpriteMaterial({
        map: cloud ? assets.tex.cloud : assets.tex.smoke,
        color: cloud ? '#ffffff' : i % 3 === 0 ? '#4a2a30' : color,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const sp = new THREE.Sprite(m);
      const a = (i / Math.max(1, count)) * Math.PI * 2 + rnd() * 0.6;
      list.push({
        sp,
        cloud,
        dir: new THREE.Vector2(Math.cos(a), Math.sin(a) * 0.7 + 0.25),
        speed: spread * (0.6 + rnd() * 0.8),
        size: cloud ? 0.34 + rnd() * 0.12 : 0.42 + rnd() * 0.35,
        delay: rnd() * 0.12,
        spin: (rnd() - 0.5) * 2,
      });
    }
    return list;
  }, [assets, seed, count, clouds, color, spread]);
  useEffect(() => () => parts.forEach((p) => p.sp.material.dispose()), [parts]);

  const group = useRef(null);
  // layout effect: in the scene before <Precompile/> runs
  useLayoutEffect(() => {
    const g = group.current;
    parts.forEach((p) => g.add(p.sp));
    return () => parts.forEach((p) => g.remove(p.sp));
  }, [parts]);

  useFrame(() => {
    const t = tick(clock);
    for (const p of parts) {
      const k = seg(t, start + p.delay, start + p.delay + dur);
      const on = t >= start + p.delay && k < 1;
      p.sp.visible = on;
      if (!on) continue;
      const e = easeOut(k);
      p.sp.position.set(p.dir.x * p.speed * e, p.dir.y * p.speed * e + (p.cloud ? 0.35 * e : 0.12 * e), p.cloud ? 0.2 : 0);
      const s = p.size * (0.45 + 0.9 * e);
      p.sp.scale.set(p.cloud ? s * 1.6 : s, s, 1);
      p.sp.material.rotation = p.spin * k;
      p.sp.material.opacity = (p.cloud ? 0.95 : 0.8) * Math.min(1, k * 6) * (1 - easeIn(k));
    }
  });
  return <group ref={group} />;
}

/** Additive sparks (one draw call), fading by colour */
function Sparks({ clock, assets, seed, start, dur = 1, count = 28, color = '#f6a04b', up = 1.6, spread = 0.7, size = 9 }) {
  const data = useMemo(() => {
    const rnd = seeded(seed);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      vel.push({
        x: Math.cos(a) * spread * (0.3 + rnd()),
        y: up * (0.5 + rnd() * 0.8),
        z: Math.sin(a) * spread * 0.5,
        delay: rnd() * 0.25,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      map: assets.tex.glow,
      size,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geo, mat, vel, base: new THREE.Color(color) };
  }, [assets, seed, count, color, up, spread, size]);
  useEffect(
    () => () => {
      data.geo.dispose();
      data.mat.dispose();
    },
    [data]
  );
  useFrame(() => {
    const t = tick(clock);
    const pos = data.geo.attributes.position.array;
    const col = data.geo.attributes.color.array;
    for (let i = 0; i < data.vel.length; i++) {
      const v = data.vel[i];
      const k = seg(t, start + v.delay, start + v.delay + dur);
      const live = t >= start + v.delay && k < 1;
      const e = easeOut(k);
      pos[i * 3] = v.x * e;
      pos[i * 3 + 1] = v.y * e - 0.5 * k * k;
      pos[i * 3 + 2] = v.z * e;
      const f = live ? (1 - k) * (1 - k) : 0;
      col[i * 3] = data.base.r * f;
      col[i * 3 + 1] = data.base.g * f;
      col[i * 3 + 2] = data.base.b * f;
    }
    data.geo.attributes.position.needsUpdate = true;
    data.geo.attributes.color.needsUpdate = true;
  });
  return <points geometry={data.geo} material={data.mat} frustumCulled={false} />;
}

/** Ring that grows and fades (flat on the 2D map, tilted on the 3D board) */
function Shockwave({ clock, assets, start, dur = 0.7, from = 0.15, to = 1.4, color = '#f6a04b', opacity = 1, thin = false }) {
  const mat = useMaterials(() => ({ m: additive({ color, opacity: 0, side: THREE.DoubleSide }) }), [color]);
  const ref = useRef(null);
  const [tilt] = useState(() => (is3D() ? -1.05 : 0));
  useFrame(() => {
    const t = tick(clock);
    const k = seg(t, start, start + dur);
    const on = t >= start && k < 1;
    ref.current.visible = on;
    if (!on) return;
    ref.current.scale.setScalar(from + (to - from) * easeOut(k));
    mat.m.opacity = opacity * (1 - easeIn(k));
  });
  return (
    <mesh ref={ref} rotation-x={tilt} geometry={thin ? assets.geo.thinRing : assets.geo.ring} material={mat.m} visible={false} />
  );
}

/* ─── 1. City upgrade ─── */

function CityFx({ item, assets, clock, onReveal, onDone }) {
  const anchor = useAnchor();
  const group = useRef(null);
  const pillar = useRef(null);
  const shards = useRef([]);
  const a = useRef({ x: 0, y: 0, R: 40 });
  const color = item.color;
  const mats = useMaterials(
    () => ({
      pillar: additive({ color: '#ffb35c', alphaMap: assets.tex.pillar, opacity: 0, side: THREE.DoubleSide }),
      core: additive({ color: '#fff1d6', alphaMap: assets.tex.pillar, opacity: 0, side: THREE.DoubleSide }),
      shard: new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: new THREE.Color(color).multiplyScalar(0.25) }),
    }),
    [color]
  );
  const shardPlan = useMemo(() => {
    const rnd = seeded(item.id * 17 + 3);
    return Array.from({ length: 8 }, (_, i) => ({
      a: (i / 8) * Math.PI * 2 + rnd() * 0.4,
      r: 0.55 + rnd() * 0.4,
      up: 0.5 + rnd() * 0.6,
      spin: (rnd() - 0.5) * 12,
      s: 0.07 + rnd() * 0.05,
    }));
  }, [item.id]);
  const flags = useRef({ reveal: false, done: false });

  useFrame(() => {
    const t = tick(clock);
    if (anchor(item.x, item.y, a.current) && group.current) {
      group.current.position.set(a.current.x, a.current.y, 0);
      group.current.scale.setScalar(a.current.R);
    }
    // pillar of chakra light
    const pk = seg(t, 0.3, 1.35);
    const p = pillar.current;
    p.visible = pk > 0 && pk < 1;
    if (p.visible) {
      const grow = easeOut(seg(t, 0.3, 0.6));
      p.scale.set(0.32 * (1 - 0.4 * pk), 2.4 * grow, 0.32 * (1 - 0.4 * pk));
      mats.pillar.opacity = 0.55 * bell(pk);
      mats.core.opacity = 0.45 * bell(pk);
    }
    // roof shards burst outward when the city appears
    shardPlan.forEach((s, i) => {
      const m = shards.current[i];
      if (!m) return;
      const k = seg(t, 0.55, 1.25);
      m.visible = k > 0 && k < 1;
      if (!m.visible) return;
      const e = easeOut(k);
      m.position.set(Math.cos(s.a) * s.r * e, s.up * bell(k * 0.9) + 0.1, Math.sin(s.a) * 0.3 * e);
      m.rotation.set(s.spin * k, s.spin * 0.7 * k, 0);
      m.scale.setScalar(s.s * (1 - easeIn(k)));
    });
    if (!flags.current.reveal && t >= item.revealAt) {
      flags.current.reveal = true;
      onReveal();
    }
    if (!flags.current.done && t >= item.dur) {
      flags.current.done = true;
      onDone();
    }
  });

  return (
    <group ref={group}>
      <Shockwave clock={clock} assets={assets} start={0.35} dur={0.75} from={0.1} to={1.5} color="#f6a04b" />
      <Shockwave clock={clock} assets={assets} start={0.5} dur={0.7} from={0.1} to={1.1} color="#ffe2b0" thin />
      <Shockwave clock={clock} assets={assets} start={0.62} dur={0.6} from={0.2} to={0.85} color={color} opacity={0.8} />
      <group ref={pillar} visible={false}>
        <mesh geometry={assets.geo.pillar} material={mats.pillar} />
        <mesh geometry={assets.geo.pillar} material={mats.core} scale={[0.45, 1.05, 0.45]} />
      </group>
      {shardPlan.map((s, i) => (
        <mesh
          key={i}
          ref={(m) => {
            shards.current[i] = m;
          }}
          geometry={assets.geo.box}
          material={mats.shard}
          visible={false}
        />
      ))}
      <Sparks clock={clock} assets={assets} seed={item.id} start={0.45} dur={0.95} count={30} up={1.9} spread={0.8} />
    </group>
  );
}

/* ─── 2. Robber leap ─── */

function RogueFigure({ assets, mats }) {
  return (
    <group>
      <mesh geometry={assets.geo.cloak} material={mats.cloak} />
      <mesh geometry={assets.geo.cyl} material={mats.dark} position-y={0.395} scale={[0.08, 0.07, 0.08]} />
      <mesh geometry={assets.geo.sphere} material={mats.dark} position-y={0.45} scale={0.062} />
      <mesh geometry={assets.geo.box} material={mats.paper} position={[0.022, 0.452, 0.06]} scale={[0.03, 0.007, 0.006]} />
      <mesh geometry={assets.geo.cone} material={mats.straw} position-y={0.52} scale={[0.19, 0.11, 0.19]} />
      {[
        [-0.09, 0.2, 0.12, 0.08],
        [0.08, 0.1, 0.15, 0.07],
        [0.02, 0.28, 0.09, 0.06],
      ].map(([x, y, z, s], i) => (
        <sprite key={i} material={mats.cloud} position={[x, y, z]} scale={[s * 1.6, s, 1]} />
      ))}
    </group>
  );
}

function RobberFx({ item, assets, clock, onReveal, onDone }) {
  const anchor = useAnchor();
  const from = useRef({ x: 0, y: 0, R: 40 });
  const to = useRef({ x: 0, y: 0, R: 40 });
  const startPuff = useRef(null);
  const endPuff = useRef(null);
  const rogue = useRef(null);
  const trail = useRef([]);
  const flags = useRef({ reveal: false, done: false });
  const mats = useMaterials(
    () => ({
      cloak: new THREE.MeshStandardMaterial({ color: '#16161c', roughness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: '#1c1c22', roughness: 0.9 }),
      paper: new THREE.MeshBasicMaterial({ color: '#efe7d6' }),
      straw: new THREE.MeshStandardMaterial({ color: '#cfae6c', roughness: 0.8 }),
      cloud: new THREE.SpriteMaterial({ map: assets.tex.cloud, transparent: true, depthWrite: false }),
      trail: Array.from(
        { length: 6 },
        () => new THREE.SpriteMaterial({ map: assets.tex.smoke, color: '#3a2a33', transparent: true, depthWrite: false, opacity: 0 })
      ),
    }),
    [assets]
  );

  useFrame(() => {
    const t = tick(clock);
    anchor(item.fromX, item.fromY, from.current);
    anchor(item.toX, item.toY, to.current);
    const A = from.current;
    const B = to.current;
    startPuff.current.position.set(A.x, A.y, 0);
    startPuff.current.scale.setScalar(A.R);
    endPuff.current.position.set(B.x, B.y, 0);
    endPuff.current.scale.setScalar(B.R);

    // the leap: up out of the smoke, arc over the board, land in the smoke
    const k = seg(t, 0.12, 0.95);
    const r = rogue.current;
    r.visible = t >= 0.08 && t < 1.08;
    if (r.visible) {
      const e = easeInOut(k);
      const dist = Math.hypot(B.x - A.x, B.y - A.y);
      // a modest arc: stays over the board, never flies off the top
      const h = Math.min(Math.max(A.R * 0.9, dist * 0.28), A.R * 2.6);
      const x = A.x + (B.x - A.x) * e;
      const y = A.y + (B.y - A.y) * e + h * bell(k) - A.R * 0.25;
      const R = A.R + (B.R - A.R) * e;
      const pop = t < 0.2 ? backOut(seg(t, 0.08, 0.2)) : t > 0.95 ? 1 - easeIn(seg(t, 0.95, 1.08)) : 1;
      r.position.set(x, y, 40 * bell(k));
      r.scale.setScalar(Math.max(0.001, R * 2.1 * pop * (1 + 0.15 * bell(k))));
      const dir = B.x >= A.x ? -1 : 1;
      r.rotation.set(0.25, 0.6 * Math.sin(t * 9), dir * Math.PI * 2 * easeInOut(seg(t, 0.25, 0.85)));
      // smoky trail behind
      trail.current.forEach((sp, i) => {
        if (!sp) return;
        const lag = seg(t - (i + 1) * 0.035, 0.12, 0.95);
        const le = easeInOut(lag);
        sp.position.set(
          A.x + (B.x - A.x) * le,
          A.y + (B.y - A.y) * le + h * bell(lag) - A.R * 0.05,
          -5
        );
        const s = R * (0.75 - i * 0.08);
        sp.scale.set(s, s, 1);
        sp.material.opacity = k > 0 && k < 1 ? 0.5 * (1 - i / 6) : 0;
      });
    } else {
      trail.current.forEach((sp) => sp && (sp.material.opacity = 0));
    }

    if (!flags.current.reveal && t >= item.revealAt) {
      flags.current.reveal = true;
      onReveal();
    }
    if (!flags.current.done && t >= item.dur) {
      flags.current.done = true;
      onDone();
    }
  });

  return (
    <>
      <group ref={startPuff}>
        <Smoke clock={clock} assets={assets} seed={item.id * 3} start={0} dur={0.7} count={11} clouds={3} />
      </group>
      <group ref={endPuff}>
        <Smoke clock={clock} assets={assets} seed={item.id * 3 + 1} start={0.9} dur={0.6} count={12} clouds={3} />
        <Shockwave clock={clock} assets={assets} start={0.92} dur={0.45} from={0.2} to={1.2} color="#c0271b" opacity={0.75} />
      </group>
      {mats.trail.map((m, i) => (
        <sprite
          key={i}
          ref={(s) => {
            trail.current[i] = s;
          }}
          material={m}
        />
      ))}
      <group ref={rogue} visible={false}>
        <group position-y={-0.2}>
          <RogueFigure assets={assets} mats={mats} />
        </group>
      </group>
    </>
  );
}

/* ─── 3. Steal: a card snatched from the victim to the thief ─── */

function Kunai({ assets, mats }) {
  return (
    <group>
      {/* blade along +x */}
      <mesh geometry={assets.geo.cone} material={mats.steel} rotation-z={-Math.PI / 2} position-x={0.22} scale={[0.07, 0.26, 0.025]} />
      <mesh geometry={assets.geo.cyl} material={mats.wrap} rotation-z={Math.PI / 2} position-x={-0.02} scale={[0.022, 0.24, 0.022]} />
      <mesh geometry={assets.geo.torus} material={mats.steel} position-x={-0.17} scale={0.045} />
    </group>
  );
}

function StealFx({ item, assets, clock, onDone }) {
  const anchor = useAnchor();
  const V = useRef({ x: 0, y: 0, R: 40 });
  const T = useRef({ x: 0, y: 0, R: 40 });
  const card = useRef(null);
  const kunai = useRef(null);
  const puff = useRef(null);
  const flash = useRef(null);
  const flags = useRef({ done: false });
  const mats = useMaterials(
    () => ({
      face: new THREE.MeshStandardMaterial({ map: assets.tex.cardBack, roughness: 0.55 }),
      edge: new THREE.MeshStandardMaterial({ color: '#e2711d', roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c9d1d8', metalness: 0.7, roughness: 0.3 }),
      wrap: new THREE.MeshStandardMaterial({ color: '#2b2b33', roughness: 0.9 }),
      flash: additive({ map: assets.tex.glow, color: item.thiefColor, opacity: 0 }),
    }),
    [assets, item.thiefColor]
  );
  const cardMats = useMemo(() => [mats.edge, mats.edge, mats.edge, mats.edge, mats.face, mats.face], [mats]);

  useFrame(() => {
    const t = tick(clock);
    anchor(item.fromX, item.fromY, V.current);
    anchor(item.toX, item.toY, T.current);
    const v = V.current;
    const th = T.current;
    puff.current.position.set(v.x, v.y, 0);
    puff.current.scale.setScalar(v.R);
    const R = (v.R + th.R) / 2;
    const cs = Math.max(30, Math.min(80, R * 1.05));

    // card pops out of the victim's house, then gets hooked and pulled away
    const c = card.current;
    const lift = backOut(seg(t, 0.05, 0.35));
    const fly = seg(t, 0.55, 1.2);
    const fe = easeInOut(fly);
    const dist = Math.hypot(th.x - v.x, th.y - v.y);
    const arc = Math.min(Math.max(R * 0.6, dist * 0.25), R * 1.5) * bell(fly);
    const startY = v.y + R * 0.75 * lift;
    c.visible = t > 0.05 && t < 1.32;
    c.position.set(v.x + (th.x - v.x) * fe, startY + (th.y + R * 0.4 - startY) * fe + arc, 30 + 30 * bell(fly));
    const shrink = 1 - easeIn(seg(t, 1.15, 1.32));
    c.scale.set(cs * 0.7 * lift * shrink, cs * lift * shrink, cs * 0.04);
    c.rotation.set(0.2, (t < 0.55 ? 0.3 * Math.sin(t * 14) : 0) + Math.PI * 4 * fe, (th.x > v.x ? -1 : 1) * 0.25 * bell(fly));

    // the kunai comes from the thief's side and hooks the card
    const k = kunai.current;
    const kin = seg(t, 0.25, 0.55);
    k.visible = t > 0.25 && t < 1.25;
    if (t < 0.55) {
      const ke = easeIn(kin);
      k.position.set(th.x + (c.position.x - th.x) * ke, th.y + R * 0.6 + (c.position.y - th.y - R * 0.6) * ke, 50);
      k.rotation.set(0, 0, Math.atan2(c.position.y - th.y - R * 0.6, c.position.x - th.x));
    } else {
      k.position.set(c.position.x, c.position.y, c.position.z + 6);
      k.rotation.set(0, 0, Math.atan2(th.y - v.y, th.x - v.x) + Math.PI);
    }
    k.scale.setScalar(cs * 2.2 * shrink);

    // flash on arrival
    const fk = seg(t, 1.12, 1.45);
    flash.current.visible = fk > 0 && fk < 1;
    flash.current.position.set(th.x, th.y + R * 0.4, 60);
    flash.current.scale.setScalar(R * 2.4 * easeOut(fk));
    mats.flash.opacity = 0.9 * (1 - fk);

    if (!flags.current.done && t >= item.dur) {
      flags.current.done = true;
      onDone();
    }
  });

  return (
    <>
      <group ref={puff}>
        <Smoke clock={clock} assets={assets} seed={item.id * 5} start={0.02} dur={0.5} count={7} spread={0.35} color="#3a3540" />
      </group>
      <mesh ref={card} geometry={assets.geo.box} material={cardMats} visible={false} />
      <group ref={kunai} visible={false}>
        <Kunai assets={assets} mats={mats} />
      </group>
      <mesh ref={flash} geometry={assets.geo.plane} material={mats.flash} visible={false} />
    </>
  );
}

/* ─── 4. Development cards (screen centre) ─── */

const RES_COLORS = {
  wood: '#3c6a3e',
  brick: '#b2532d',
  sheep: '#8cae58',
  wheat: '#d6a238',
  ore: '#67717d',
};

const CARD_ACCENT = {
  knight: '#b6331f',
  roadBuilding: '#7a5634',
  yearOfPlenty: '#d6a238',
  monopoly: '#24314b',
};

/** Screen-centre stage: unit K in px, centred a bit above the middle */
function useStage() {
  const size = useThree((s) => s.size);
  const K = Math.max(42, Math.min(120, Math.min(size.width, size.height) * 0.12));
  // camera distance to the z = 0 plane (see PixelCamera)
  const d = size.height / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return { K, cy: size.height * 0.06, w: size.width, h: size.height, d };
}


function KnightParts({ clock, assets, mats, K }) {
  const kunais = useRef([]);
  const slashes = useRef([]);
  const plan = useMemo(
    () => [
      { from: [-4.2, 2.2], to: [3.8, -1.6], t0: 0.32 },
      { from: [4.2, 2.0], to: [-3.8, -1.4], t0: 0.46 },
      { from: [-4.4, -0.4], to: [4.2, 0.6], t0: 0.6 },
    ],
    []
  );
  useFrame(() => {
    const t = tick(clock);
    plan.forEach((p, i) => {
      const k = seg(t, p.t0, p.t0 + 0.22);
      const m = kunais.current[i];
      if (m) {
        m.visible = k > 0 && k < 1;
        const e = easeIn(k);
        m.position.set((p.from[0] + (p.to[0] - p.from[0]) * e) * K, (p.from[1] + (p.to[1] - p.from[1]) * e) * K, 120);
        m.rotation.set(0, 0, Math.atan2(p.to[1] - p.from[1], p.to[0] - p.from[0]));
        m.scale.setScalar(K * 2.2);
      }
      const s = slashes.current[i];
      if (s) {
        const sk = seg(t, p.t0 + 0.08, p.t0 + 0.5);
        s.visible = sk > 0 && sk < 1;
        const ang = Math.atan2(p.to[1] - p.from[1], p.to[0] - p.from[0]);
        s.rotation.set(0, 0, ang);
        s.position.set(0, (p.from[1] + p.to[1]) * 0.25 * K, 100);
        s.scale.set(K * 7 * easeOut(Math.min(1, sk * 3)), K * 0.5 * (1 - sk * 0.7), 1);
        s.material.opacity = 1 - easeIn(sk);
      }
    });
  });
  return (
    <>
      {plan.map((_, i) => (
        <group
          key={`k${i}`}
          ref={(g) => {
            kunais.current[i] = g;
          }}
          visible={false}
        >
          <Kunai assets={assets} mats={mats} />
        </group>
      ))}
      {plan.map((_, i) => (
        <mesh
          key={`s${i}`}
          ref={(m) => {
            slashes.current[i] = m;
          }}
          geometry={assets.geo.plane}
          material={mats.slash[i]}
          visible={false}
        />
      ))}
    </>
  );
}

function RoadParts({ clock, assets, mats, K, seed }) {
  const planks = useRef([]);
  const rails = useRef([]);
  const plan = useMemo(() => {
    const rnd = seeded(seed);
    return Array.from({ length: 8 }, (_, i) => {
      const u = (i + 0.5) / 8;
      return {
        tx: (u - 0.5) * 4.4,
        ty: -1.9 + Math.sin(u * Math.PI) * 0.45,
        tr: (0.5 - u) * 0.5,
        fx: (rnd() - 0.5) * 10,
        fy: (rnd() < 0.5 ? -1 : 1) * (3 + rnd() * 2),
        spin: (rnd() - 0.5) * 10,
        t0: 0.3 + i * 0.07,
      };
    });
  }, [seed]);
  useFrame(() => {
    const t = tick(clock);
    plan.forEach((p, i) => {
      const m = planks.current[i];
      if (!m) return;
      const k = seg(t, p.t0, p.t0 + 0.35);
      m.visible = t > p.t0;
      const e = backOut(k);
      m.position.set((p.fx + (p.tx - p.fx) * e) * K, (p.fy + (p.ty - p.fy) * e) * K, 40 + 80 * (1 - k));
      m.rotation.set(p.spin * (1 - k), p.spin * 0.5 * (1 - k), p.tr);
      m.scale.set(K * 0.46, K * 0.16, K * 0.7);
    });
    rails.current.forEach((r, i) => {
      if (!r) return;
      const k = seg(t, 0.95, 1.2);
      r.visible = k > 0;
      r.position.set(0, (-1.55 + 0.25 * i) * K + 0.4 * K, 60 + (i ? -20 : 20));
      r.scale.set(K * 4.8 * easeOut(k), K * 0.08, K * 0.08);
    });
  });
  return (
    <>
      {plan.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            planks.current[i] = m;
          }}
          geometry={assets.geo.box}
          material={i % 2 ? mats.woodDark : mats.wood}
          visible={false}
        />
      ))}
      {[0, 1].map((i) => (
        <mesh
          key={`r${i}`}
          ref={(m) => {
            rails.current[i] = m;
          }}
          geometry={assets.geo.box}
          material={mats.woodDark}
          visible={false}
        />
      ))}
    </>
  );
}

function PlentyParts({ clock, assets, mats, K, seed, resources }) {
  const items = useRef([]);
  const plan = useMemo(() => {
    const rnd = seeded(seed);
    return Array.from({ length: 14 }, (_, i) => ({
      bale: i % 2 === 0,
      res: resources[i % resources.length],
      x: (rnd() - 0.5) * 7,
      floor: -1.7 - rnd() * 0.6,
      t0: 0.25 + rnd() * 0.55,
      spin: (rnd() - 0.5) * 8,
      s: 0.42 + rnd() * 0.2,
    }));
  }, [seed, resources]);
  useFrame(() => {
    const t = tick(clock);
    const top = 4.5;
    plan.forEach((p, i) => {
      const g = items.current[i];
      if (!g) return;
      const k = seg(t, p.t0, p.t0 + 0.5);
      g.visible = t > p.t0 && t < 1.75;
      if (!g.visible) return;
      // fall, then a small bounce on the floor
      let y;
      if (k < 1) y = top + (p.floor - top) * k * k;
      else {
        const b = seg(t, p.t0 + 0.5, p.t0 + 0.8);
        y = p.floor + 0.35 * bell(b);
      }
      const fade = 1 - easeIn(seg(t, 1.45, 1.75));
      g.position.set(p.x * K, y * K, 20 + i * 4);
      g.rotation.set(p.spin * Math.min(1, k) * 0.4 + 0.3, p.spin * Math.min(1, k), k < 1 ? p.spin * k * 0.3 : 0);
      g.scale.setScalar(K * p.s * fade);
    });
  });
  return (
    <>
      {plan.map((p, i) => (
        <group
          key={i}
          ref={(g) => {
            items.current[i] = g;
          }}
          visible={false}
        >
          {p.bale ? (
            <group rotation-z={Math.PI / 2}>
              <mesh geometry={assets.geo.cyl} material={mats.straw} scale={[0.5, 1, 0.5]} />
              <mesh geometry={assets.geo.torus} material={mats.rope} position-y={0.25} rotation-x={Math.PI / 2} scale={0.52} />
              <mesh geometry={assets.geo.torus} material={mats.rope} position-y={-0.25} rotation-x={Math.PI / 2} scale={0.52} />
            </group>
          ) : (
            <mesh geometry={assets.geo.box} material={mats.res[p.res] || mats.straw} scale={0.62} />
          )}
        </group>
      ))}
    </>
  );
}

function MonopolyParts({ clock, assets, mats, K, seed, resource }) {
  const seal = useRef(null);
  const cards = useRef([]);
  const plan = useMemo(() => {
    const rnd = seeded(seed);
    return Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 + rnd() * 0.3;
      return { a, r: 5 + rnd() * 1.5, t0: 0.42 + (i % 5) * 0.08, spin: 2 + rnd() * 3 };
    });
  }, [seed]);
  useFrame(() => {
    const t = tick(clock);
    const s = seal.current;
    const sk = seg(t, 0.2, 1.7);
    s.visible = sk > 0 && sk < 1;
    s.rotation.set(-1.05, 0, t * 1.6);
    s.position.set(0, -1.55 * K, -40);
    s.scale.setScalar(K * 3.4 * easeOut(seg(t, 0.2, 0.5)) * (1 + 0.05 * Math.sin(t * 10)));
    mats.seal.opacity = 0.95 * Math.min(1, sk * 6) * (1 - easeIn(seg(t, 1.45, 1.7)));
    plan.forEach((p, i) => {
      const c = cards.current[i];
      if (!c) return;
      const k = seg(t, p.t0, p.t0 + 0.7);
      c.visible = k > 0 && k < 1;
      if (!c.visible) return;
      const e = easeIn(k);
      const ang = p.a + e * p.spin;
      const r = p.r * (1 - e);
      c.position.set(Math.cos(ang) * r * K, -1.55 * K + Math.sin(ang) * r * K * 0.55 + 0.3 * K * (1 - e), 30);
      c.rotation.set(0.4, ang * 2, ang);
      const sc = K * (1 - e * 0.85);
      c.scale.set(sc * 0.42, sc * 0.6, sc * 0.03);
    });
  });
  const cardMats = useMemo(() => {
    const edge = mats.res[resource] || mats.edge;
    return [edge, edge, edge, edge, mats.back, mats.back];
  }, [mats, resource]);
  return (
    <>
      <mesh ref={seal} geometry={assets.geo.disc} material={mats.seal} visible={false} />
      {plan.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            cards.current[i] = m;
          }}
          geometry={assets.geo.box}
          material={cardMats}
          visible={false}
        />
      ))}
    </>
  );
}

function DevCardFx({ item, assets, clock, onDone }) {
  const { K, cy } = useStage();
  const card = useRef(null);
  const glow = useRef(null);
  const flags = useRef({ done: false });
  const accent = CARD_ACCENT[item.cardType] || '#b6331f';
  const mats = useMaterials(() => {
    const front = devFrontTex(item.cardType, accent);
    const sealTex = item.cardType === 'monopoly' ? sealCircleTex() : null;
    const frontMat = new THREE.MeshStandardMaterial({ map: front, roughness: 0.6 });
    frontMat.userData.tex = front;
    const res = Object.fromEntries(
      Object.entries(RES_COLORS).map(([k, c]) => [k, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })])
    );
    const edge = new THREE.MeshStandardMaterial({ color: '#1f1b17', roughness: 0.6 });
    const back = new THREE.MeshStandardMaterial({ map: assets.tex.cardBack, roughness: 0.6 });
    return {
      front,
      sealTex,
      frontMat,
      edge,
      back,
      cardMats: [edge, edge, edge, edge, frontMat, back],
      glow: additive({ map: assets.tex.glow, color: accent === '#24314b' ? '#7fb2ff' : '#ffb35c', opacity: 0 }),
      steel: new THREE.MeshStandardMaterial({ color: '#d5dce2', metalness: 0.75, roughness: 0.28 }),
      wrap: new THREE.MeshStandardMaterial({ color: '#2b2b33', roughness: 0.9 }),
      slash: [0, 1, 2].map(() => additive({ map: assets.tex.streak, color: '#ffffff', opacity: 0 })),
      wood: new THREE.MeshStandardMaterial({ color: '#8a6038', roughness: 0.8 }),
      woodDark: new THREE.MeshStandardMaterial({ color: '#5b3c22', roughness: 0.85 }),
      straw: new THREE.MeshStandardMaterial({ color: '#d9bd78', roughness: 0.9 }),
      rope: new THREE.MeshStandardMaterial({ color: '#7a5a2a', roughness: 0.9 }),
      res,
      seal: sealTex ? additive({ map: sealTex, color: '#ffc46b', opacity: 0, side: THREE.DoubleSide }) : null,
    };
  }, [item.cardType, accent, assets]);

  const cardShake = useRef(0);
  useFrame(() => {
    const t = tick(clock);
    const c = card.current;
    // enter: rises and flips from edge-on; exit: shrinks away
    const enter = seg(t, 0, 0.4);
    const exit = seg(t, item.dur - 0.32, item.dur);
    const s = backOut(enter) * (1 - easeIn(exit));
    if (item.cardType === 'knight') {
      const hit = [0.42, 0.56, 0.7].some((h) => t > h && t < h + 0.08);
      cardShake.current = hit ? (Math.random() - 0.5) * 0.12 * K : cardShake.current * 0.8;
    }
    c.position.set(cardShake.current, cy + (1 - easeOut(enter)) * -2 * K + 0.06 * K * Math.sin(t * 3), 0);
    c.rotation.set(0.12 * Math.sin(t * 2), (1 - easeOut(enter)) * Math.PI * 0.5 + 0.18 * Math.sin(t * 1.7), 0.04 * Math.sin(t * 2.3));
    c.scale.set(Math.max(0.001, K * 1.4 * s), Math.max(0.001, K * 2 * s), K * 0.05);
    const g = glow.current;
    g.position.set(0, cy, -30);
    g.scale.setScalar(K * 5.2 * (0.8 + 0.2 * Math.sin(t * 6)) * s);
    mats.glow.opacity = 0.55 * s;
    if (!flags.current.done && t >= item.dur) {
      flags.current.done = true;
      onDone();
    }
  });

  return (
    <>
      <mesh ref={glow} geometry={assets.geo.plane} material={mats.glow} />
      <mesh ref={card} geometry={assets.geo.box} material={mats.cardMats} />
      {item.cardType === 'knight' && <KnightParts clock={clock} assets={assets} mats={mats} K={K} />}
      {item.cardType === 'roadBuilding' && <RoadParts clock={clock} assets={assets} mats={mats} K={K} seed={item.id} />}
      {item.cardType === 'yearOfPlenty' && (
        <PlentyParts clock={clock} assets={assets} mats={mats} K={K} seed={item.id} resources={item.resources} />
      )}
      {item.cardType === 'monopoly' && (
        <MonopolyParts clock={clock} assets={assets} mats={mats} K={K} seed={item.id} resource={item.resource} />
      )}
    </>
  );
}

/* ─── 5. Near win: a glowing hanko in the player's colour ─── */

function NearWinFx({ item, assets, clock, onDone }) {
  const { K, cy, d } = useStage();
  const stamp = useRef(null);
  const print = useRef(null);
  const rays = useRef(null);
  const flags = useRef({ done: false });
  const mats = useMaterials(() => {
    const tex = hankoTex(item.color, item.vpLeft);
    return {
      tex,
      print: new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }),
      body: new THREE.MeshStandardMaterial({
        color: item.color,
        roughness: 0.35,
        metalness: 0.1,
        emissive: new THREE.Color(item.color).multiplyScalar(0.25),
      }),
      handle: new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 0.55 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.8, roughness: 0.3 }),
      ray: additive({ map: assets.tex.streak, color: '#ffd08a', opacity: 0, side: THREE.DoubleSide }),
      halo: additive({ map: assets.tex.glow, color: item.color, opacity: 0 }),
    };
  }, [item.color, item.vpLeft, assets]);
  const halo = useRef(null);
  const ringGroup = useRef(null);

  useFrame(() => {
    const t = tick(clock);
    const exit = seg(t, item.dur - 0.35, item.dur);
    const out = 1 - easeIn(exit);
    // stamp: falls from the viewer onto the paper, presses, lifts away
    const fall = seg(t, 0, 0.42);
    const lift = seg(t, 0.72, 1.08);
    const st = stamp.current;
    st.visible = t < 1.12;
    const z = d * 0.42 * (1 - easeIn(fall)) + d * 0.4 * easeIn(lift);
    const squash = t > 0.42 && t < 0.6 ? 1 - 0.12 * bell(seg(t, 0.42, 0.6)) : 1;
    st.position.set(0, cy, z + K * 0.5);
    // tilted toward the viewer so the handle and the lacquered side read
    st.rotation.set(Math.PI / 2 - 0.62 - 0.3 * (1 - fall) + 0.3 * lift, 0.35 * (1 - fall), -0.25);
    st.scale.set(K * 1.3, K * 1.3 * squash, K * 1.3);
    // print appears on impact
    const p = print.current;
    p.position.set(0, cy, 0);
    p.scale.setScalar(K * 1.3 * (1 + 0.06 * bell(seg(t, 0.42, 0.7))) * (0.9 + 0.1 * out));
    mats.print.opacity = (t > 0.42 ? 1 : 0) * out;
    // rays + halo
    const r = rays.current;
    r.position.set(0, cy, -20);
    r.rotation.z = t * 0.5;
    r.scale.setScalar(K * (2.2 + 0.4 * easeOut(seg(t, 0.42, 1))) * out);
    mats.ray.opacity = 0.75 * seg(t, 0.4, 0.6) * out;
    halo.current.position.set(0, cy, -40);
    halo.current.scale.setScalar(K * 5 * (0.9 + 0.1 * Math.sin(t * 5)) * out);
    mats.halo.opacity = 0.7 * seg(t, 0.4, 0.55) * out;
    ringGroup.current.position.set(0, cy, 5);
    if (!flags.current.done && t >= item.dur) {
      flags.current.done = true;
      onDone();
    }
  });

  const rayAngles = useMemo(() => Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI), []);

  return (
    <>
      <mesh ref={halo} geometry={assets.geo.plane} material={mats.halo} />
      <group ref={rays}>
        {rayAngles.map((a) => (
          <mesh key={a} geometry={assets.geo.plane} material={mats.ray} rotation-z={a} scale={[2.3, 0.09, 1]} />
        ))}
      </group>
      <mesh ref={print} geometry={assets.geo.disc} material={mats.print} />
      <group ref={ringGroup} scale={K * 1.3}>
        <Shockwave clock={clock} assets={assets} start={0.42} dur={0.6} from={0.9} to={2.6} color="#ffd08a" />
        <Shockwave clock={clock} assets={assets} start={0.5} dur={0.7} from={0.9} to={2.0} color={item.color} thin />
        <Sparks clock={clock} assets={assets} seed={item.id * 7} start={0.42} dur={0.9} count={34} up={1.2} spread={2.2} size={10} color="#ffd08a" />
      </group>
      <group ref={stamp}>
        {/* seal body (axis along y, face toward -y = toward the paper once rotated) */}
        <mesh geometry={assets.geo.cyl} material={mats.body} scale={[1, 0.5, 1]} />
        <mesh geometry={assets.geo.torus} material={mats.gold} position-y={0.22} rotation-x={Math.PI / 2} scale={0.98} />
        <mesh geometry={assets.geo.cyl} material={mats.handle} position-y={0.75} scale={[0.36, 1, 0.36]} />
        <mesh geometry={assets.geo.sphere} material={mats.handle} position-y={1.3} scale={0.5} />
      </group>
    </>
  );
}

/* ─── scene ─── */

const EFFECTS = {
  city: CityFx,
  robber: RobberFx,
  steal: StealFx,
  devCard: DevCardFx,
  nearWin: NearWinFx,
};

function FirstFrame({ onStart }) {
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    onStart?.();
  });
  return null;
}

function Effect({ item, onStart, onReveal, onDone }) {
  const assets = useAssets();
  const clock = useMemo(() => ({ t0: null, paused: true }), []);
  const ready = useShadersReady();
  clock.paused = !ready;
  const Comp = EFFECTS[item.kind];
  if (!Comp) return null;
  return (
    <group visible={ready}>
      {ready && <FirstFrame onStart={onStart} />}
      <Comp item={item} assets={assets} clock={clock} onReveal={onReveal} onDone={onDone} />
    </group>
  );
}

/** item = null: idle (kept for a moment so back-to-back animations share one context, no frames drawn) */
export default function FxScene({ item, lowPower, onStart, onReveal, onDone }) {
  return (
    <Canvas
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      dpr={[1, lowPower ? 1.25 : 1.75]}
      gl={{ alpha: true, antialias: !lowPower, powerPreference: 'default' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.setClearColor(0x000000, 0);
      }}
      camera={{ fov: FOV, near: 1, far: 5000, position: [0, 0, 1000] }}
      frameloop={item ? 'always' : 'demand'}
    >
      <PixelCamera />
      <hemisphereLight args={['#fff1dc', '#3a2414', 1.3]} />
      <directionalLight position={[-300, 500, 900]} intensity={2.2} color="#fff6e8" />
      <pointLight position={[260, -120, 500]} intensity={2.5} distance={0} decay={0} color="#e2711d" />
      {item && <Effect key={item.id} item={item} onStart={onStart} onReveal={onReveal} onDone={onDone} />}
    </Canvas>
  );
}
