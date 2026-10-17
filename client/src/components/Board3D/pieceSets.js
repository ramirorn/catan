// 3D player pieces of every shop piece set. Each building / road is one
// merged BufferGeometry with up to three groups:
//   0 = player colour (lacquer, shaded by vertex tones),
//   1, 2 = the set's own materials (wood, paper, steel, stone…).
// Geometries are built lazily (first time a set is seen on a board), cached
// by BoardResources and disposed with it. Used by the 3D board and by the
// shop preview, so both draw exactly the same pieces.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { pieceSetOf } from '../../utils/cosmetics';

/** Flat-shaded part with a constant vertex tone, tagged with its material slot */
export function part(geom, tone, at, mat = 0) {
  if (at) geom.translate(at[0], at[1], at[2]);
  const g = geom.index ? geom.toNonIndexed() : geom;
  if (g !== geom) geom.dispose();
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  // Tones are perceptual (sRGB-ish); vertex colours are linear
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(Math.pow(tone, 2.2)), 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  g.userData.mat = mat;
  return g;
}

const A = (geom, tone, at) => part(geom, tone, at, 1);
const B = (geom, tone, at) => part(geom, tone, at, 2);

export function merge(parts) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

/** Merge parts by material slot into one geometry with groups */
function mergeSlots(parts) {
  const slots = [0, 1, 2].map((m) => parts.filter((p) => (p.userData.mat || 0) === m));
  const used = [];
  const merged = [];
  slots.forEach((list, m) => {
    if (!list.length) return;
    used.push(m);
    merged.push(merge(list));
  });
  const g = mergeGeometries(merged, true);
  merged.forEach((p) => p.dispose());
  g.groups.forEach((grp, i) => {
    grp.materialIndex = used[i];
  });
  g.computeBoundingSphere();
  return g;
}

/**
 * Square hip roof with curved (concave, flared) slopes, as a 4-sided lathe.
 * `profile` = [[halfSide, y], …] from the eave up to the ridge.
 */
export function curvedRoof(profile) {
  const pts = profile.map(([a, y]) => new THREE.Vector2(a * Math.SQRT2, y));
  return new THREE.LatheGeometry(pts, 4, Math.PI / 4);
}

const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sphere = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);
const dome = (r, w = 14) => new THREE.SphereGeometry(r, w, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const torus = (r, t, rs = 6, ts = 24) => new THREE.TorusGeometry(r, t, rs, ts);
const flatRing = (r, t) => torus(r, t).rotateX(Math.PI / 2);

export const ROAD_LEN = 0.5;

/* ─── Clásico ─── */

function classicSettlement() {
  return [
    part(cyl(0.19, 0.205, 0.035, 8), 0.6, [0, 0.0175, 0]),
    part(box(0.22, 0.17, 0.22), 1, [0, 0.12, 0]),
    part(box(0.065, 0.1, 0.012), 0.1, [0, 0.085, 0.112]),
    part(box(0.05, 0.045, 0.012), 0.16, [0.065, 0.13, 0.112]),
    part(box(0.31, 0.012, 0.31), 0.35, [0, 0.206, 0]),
    part(curvedRoof([[0.17, 0.2], [0.135, 0.222], [0.09, 0.262], [0.045, 0.315], [0.012, 0.35], [0, 0.356]]), 0.68),
    part(cyl(0.012, 0.012, 0.05, 6), 0.25, [0, 0.37, 0]),
  ];
}

function classicCity() {
  const tier = (half, y0, h, roofHalf, roofTop, tone = 1) => [
    part(box(half * 2, h, half * 2), tone, [0, y0 + h / 2, 0]),
    part(box(half * 0.9, h * 0.38, 0.012), 0.12, [0, y0 + h * 0.55, half + 0.004]),
    part(box(roofHalf * 2 + 0.04, 0.012, roofHalf * 2 + 0.04), 0.35, [0, y0 + h + 0.004, 0]),
    part(curvedRoof([[roofHalf, y0 + h], [roofHalf * 0.8, y0 + h + 0.022], [roofHalf * 0.6, y0 + h + 0.05], [half * 0.7, roofTop]]), 0.68),
  ];
  return [
    part(cyl(0.31, 0.33, 0.035, 10), 0.55, [0, 0.0175, 0]),
    part(flatRing(0.3, 0.018), 1.15, [0, 0.038, 0]),
    part(cyl(0.24, 0.26, 0.03, 10), 0.7, [0, 0.05, 0]),
    ...tier(0.15, 0.065, 0.17, 0.235, 0.29),
    part(box(0.08, 0.11, 0.012), 0.08, [0, 0.12, 0.155]),
    ...tier(0.11, 0.285, 0.12, 0.185, 0.45, 0.94),
    ...tier(0.075, 0.445, 0.1, 0.14, 0.6, 0.9),
    part(curvedRoof([[0.1, 0.6], [0.06, 0.64], [0.025, 0.68], [0, 0.69]]), 0.68),
    part(cyl(0.01, 0.012, 0.16, 6), 0.3, [0, 0.76, 0]),
    part(torus(0.028, 0.007, 4, 12).rotateX(Math.PI / 2), 1.2, [0, 0.73, 0]),
    part(torus(0.022, 0.007, 4, 12).rotateX(Math.PI / 2), 1.2, [0, 0.765, 0]),
    part(sphere(0.024, 8, 6), 1.2, [0, 0.85, 0]),
  ];
}

function classicRoad() {
  const parts = [];
  const n = 6;
  const pitch = ROAD_LEN / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const plank = box(pitch * 0.8, 0.032, 0.17);
    plank.rotateZ(-Math.cos(Math.PI * t) * 0.18);
    parts.push(part(plank, i % 2 ? 0.84 : 1, [-ROAD_LEN / 2 + pitch * (i + 0.5), 0.026 + 0.034 * Math.sin(Math.PI * t), 0]));
  }
  for (const z of [-0.088, 0.088]) {
    parts.push(part(box(ROAD_LEN + 0.02, 0.022, 0.022), 0.5, [0, 0.105, z]));
    for (const x of [-ROAD_LEN / 2, 0, ROAD_LEN / 2]) {
      parts.push(part(box(0.024, 0.075, 0.024), 0.42, [x, 0.065 + (x === 0 ? 0.01 : 0), z]));
    }
  }
  return parts;
}

/* ─── Templo de la Hoja: wooden halls on stilts, roofs in the player colour ─── */

function templeSettlement() {
  const posts = [-0.1, 0.1].flatMap((x) => [-0.1, 0.1].map((z) => A(box(0.03, 0.07, 0.03), 0.8, [x, 0.06, z])));
  return [
    B(cyl(0.2, 0.215, 0.03, 8), 1, [0, 0.015, 0]),
    ...posts,
    A(box(0.27, 0.025, 0.27), 0.9, [0, 0.1, 0]),
    A(box(0.19, 0.12, 0.19), 1, [0, 0.172, 0]),
    part(box(0.06, 0.085, 0.012), 0.12, [0, 0.155, 0.097]),
    part(curvedRoof([[0.2, 0.232], [0.16, 0.245], [0.11, 0.275], [0.06, 0.315], [0.02, 0.345], [0, 0.35]]), 1),
    part(box(0.09, 0.022, 0.022), 0.55, [0, 0.355, 0]),
  ];
}

function templeCity() {
  return [
    B(box(0.52, 0.04, 0.42), 1, [0, 0.02, 0]),
    B(box(0.44, 0.035, 0.34), 0.85, [0, 0.0575, 0]),
    A(box(0.34, 0.16, 0.24), 1, [0, 0.155, 0]),
    part(box(0.1, 0.11, 0.012), 0.12, [0, 0.13, 0.125]),
    part(curvedRoof([[0.25, 0.235], [0.2, 0.255], [0.14, 0.3], [0.08, 0.34]]), 1),
    A(box(0.2, 0.1, 0.16), 0.95, [0, 0.39, 0]),
    part(curvedRoof([[0.17, 0.44], [0.13, 0.46], [0.08, 0.51], [0.02, 0.56], [0, 0.565]]), 0.95),
    // torii gate in front
    part(cyl(0.016, 0.018, 0.22, 6), 0.9, [-0.14, 0.11, 0.3]),
    part(cyl(0.016, 0.018, 0.22, 6), 0.9, [0.14, 0.11, 0.3]),
    part(box(0.38, 0.026, 0.03), 0.8, [0, 0.235, 0.3]),
    part(box(0.3, 0.018, 0.022), 0.7, [0, 0.19, 0.3]),
  ];
}

function templeRoad() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    parts.push(A(box(0.06, 0.03, 0.16), i % 2 ? 0.8 : 1, [-0.21 + i * 0.07, 0.035, 0]));
  }
  for (const z of [-0.085, 0.085]) {
    parts.push(part(box(ROAD_LEN + 0.03, 0.026, 0.026), 1, [0, 0.105, z]));
    for (const x of [-0.24, 0, 0.24]) parts.push(part(box(0.026, 0.09, 0.026), 0.75, [x, 0.06, z]));
  }
  return parts;
}

/* ─── Pergaminos sellados: paper scrolls with player-colour rods and seals ─── */

function scrollUpright(r, h, y0, x = 0, z = 0) {
  return [
    A(cyl(r, r, h, 16), 1, [x, y0 + h / 2, z]),
    part(cyl(r * 1.18, r * 1.18, 0.035, 16), 0.85, [x, y0 + 0.0175, z]),
    part(cyl(r * 1.18, r * 1.18, 0.035, 16), 0.85, [x, y0 + h - 0.0175, z]),
    part(cyl(r * 1.03, r * 1.03, h * 0.18, 16), 1, [x, y0 + h * 0.52, z]),
    part(cyl(r * 0.42, r * 0.42, 0.014, 12).rotateX(Math.PI / 2), 0.62, [x, y0 + h * 0.52, z + r * 1.04]),
  ];
}

function scrollsSettlement() {
  return [B(cyl(0.17, 0.18, 0.025, 10), 1, [0, 0.0125, 0]), ...scrollUpright(0.1, 0.3, 0.025)];
}

function scrollsCity() {
  const lying = (z) => [
    A(cyl(0.075, 0.075, 0.44, 14).rotateZ(Math.PI / 2), 1, [0, 0.105, z]),
    part(cyl(0.088, 0.088, 0.03, 14).rotateZ(Math.PI / 2), 0.85, [-0.235, 0.105, z]),
    part(cyl(0.088, 0.088, 0.03, 14).rotateZ(Math.PI / 2), 0.85, [0.235, 0.105, z]),
  ];
  return [
    B(cyl(0.3, 0.32, 0.03, 12), 1, [0, 0.015, 0]),
    ...lying(0.16),
    ...lying(-0.16),
    ...scrollUpright(0.12, 0.5, 0.03),
    part(sphere(0.035, 10, 8), 1, [0, 0.56, 0]),
  ];
}

function scrollsRoad() {
  return [
    A(box(0.44, 0.014, 0.15), 1, [0, 0.022, 0]),
    part(box(0.3, 0.004, 0.026), 0.5, [0, 0.031, 0]),
    part(cyl(0.032, 0.032, 0.2, 10).rotateX(Math.PI / 2), 1, [-0.235, 0.04, 0]),
    part(cyl(0.032, 0.032, 0.2, 10).rotateX(Math.PI / 2), 1, [0.235, 0.04, 0]),
  ];
}

/* ─── Torres de la Arena: sandstone towers with player-colour domes ─── */

function sandSettlement() {
  return [
    B(cyl(0.18, 0.19, 0.03, 12), 1, [0, 0.015, 0]),
    A(cyl(0.12, 0.13, 0.18, 14), 1, [0, 0.12, 0]),
    part(box(0.05, 0.09, 0.012), 0.1, [0, 0.075, 0.125]),
    part(cyl(0.135, 0.135, 0.02, 14), 0.7, [0, 0.215, 0]),
    part(dome(0.125), 1, [0, 0.222, 0]),
    part(cyl(0.008, 0.012, 0.07, 6), 0.4, [0, 0.37, 0]),
  ];
}

function sandCity() {
  const tower = (x) => [
    A(cyl(0.065, 0.075, 0.36, 10), 0.95, [x, 0.21, -0.02]),
    part(dome(0.07, 10), 1, [x, 0.39, -0.02]),
    part(cyl(0.006, 0.008, 0.06, 6), 0.4, [x, 0.48, -0.02]),
  ];
  return [
    B(cyl(0.32, 0.33, 0.035, 14), 1, [0, 0.0175, 0]),
    A(cyl(0.2, 0.21, 0.22, 16), 1, [0, 0.145, 0]),
    part(box(0.07, 0.12, 0.012), 0.1, [0, 0.095, 0.205]),
    part(cyl(0.215, 0.215, 0.025, 16), 0.7, [0, 0.265, 0]),
    part(dome(0.2, 18), 1, [0, 0.275, 0]),
    part(cyl(0.01, 0.014, 0.1, 6), 0.4, [0, 0.52, 0]),
    ...tower(-0.24),
    ...tower(0.24),
  ];
}

function sandRoad() {
  const parts = [A(box(0.48, 0.075, 0.1), 1, [0, 0.0375, 0]), B(box(0.5, 0.02, 0.12), 1, [0, 0.01, 0])];
  for (let i = 0; i < 5; i++) parts.push(part(box(0.06, 0.04, 0.1), 1, [-0.2 + i * 0.1, 0.095, 0]));
  return parts;
}

/* ─── Kunai y Shuriken: polished steel, player-colour grips and stands ─── */

function blade(len, width) {
  // Flattened four-sided cone pointing up
  return new THREE.ConeGeometry(width, len, 4).scale(1, 1, 0.32);
}

function kunaiSettlement() {
  return [
    part(cyl(0.16, 0.2, 0.06, 10), 0.85, [0, 0.03, 0]),
    A(blade(0.2, 0.06).rotateX(Math.PI), 1, [0, 0.13, 0]),
    part(cyl(0.024, 0.024, 0.12, 8), 1, [0, 0.29, 0]),
    part(torus(0.026, 0.006, 4, 10).rotateX(Math.PI / 2), 0.6, [0, 0.27, 0]),
    part(torus(0.026, 0.006, 4, 10).rotateX(Math.PI / 2), 0.6, [0, 0.31, 0]),
    A(torus(0.035, 0.009, 6, 16), 1, [0, 0.39, 0]),
  ];
}

function kunaiCity() {
  const parts = [
    part(cyl(0.3, 0.32, 0.05, 12), 0.7, [0, 0.025, 0]),
    part(box(0.2, 0.12, 0.14), 1, [0, 0.11, 0]),
    part(box(0.03, 0.03, 0.15), 0.5, [0, 0.17, 0]),
  ];
  const c = [0, 0.43, 0];
  for (let k = 0; k < 4; k++) {
    const a = (Math.PI / 2) * k;
    const b = blade(0.22, 0.075);
    b.translate(0, 0.11 + 0.05, 0).rotateZ(a + Math.PI / 4);
    parts.push(A(b, k % 2 ? 0.85 : 1, c));
  }
  parts.push(B(cyl(0.07, 0.07, 0.035, 16).rotateX(Math.PI / 2), 1, c));
  parts.push(part(torus(0.045, 0.012, 6, 18), 1, [0, 0.43, 0.02]));
  return parts;
}

function kunaiRoad() {
  return [
    part(box(0.46, 0.02, 0.09), 0.85, [0, 0.01, 0]),
    A(blade(0.3, 0.05).rotateZ(-Math.PI / 2), 1, [0.06, 0.04, 0]),
    part(cyl(0.024, 0.024, 0.12, 8).rotateZ(Math.PI / 2), 1, [-0.15, 0.04, 0]),
    A(torus(0.03, 0.008, 6, 14).rotateY(Math.PI / 2), 1, [-0.235, 0.04, 0]),
  ];
}

/* ─── Linterna de Papel: glowing paper lanterns, stone tōrō ─── */

const BULB = [[0.05, 0], [0.105, 0.03], [0.13, 0.09], [0.128, 0.14], [0.1, 0.19], [0.05, 0.215]].map(([x, y]) => new THREE.Vector2(x, y));

function lanternSettlement() {
  return [
    B(cyl(0.15, 0.16, 0.03, 10), 1, [0, 0.015, 0]),
    A(cyl(0.065, 0.07, 0.03, 12), 1, [0, 0.045, 0]),
    part(new THREE.LatheGeometry(BULB, 16), 1, [0, 0.06, 0]),
    A(flatRing(0.128, 0.006), 0.8, [0, 0.16, 0]),
    A(flatRing(0.118, 0.006), 0.8, [0, 0.21, 0]),
    A(flatRing(0.112, 0.006), 0.8, [0, 0.105, 0]),
    A(cyl(0.06, 0.065, 0.03, 12), 1, [0, 0.285, 0]),
    A(torus(0.03, 0.007, 4, 12), 1, [0, 0.325, 0]),
  ];
}

function lanternCity() {
  const small = (x) => [
    A(cyl(0.012, 0.014, 0.22, 6), 1, [x, 0.12, 0.1]),
    part(sphere(0.05, 12, 8).scale(1, 1.25, 1), 1, [x, 0.26, 0.1]),
    A(cyl(0.025, 0.025, 0.015, 8), 1, [x, 0.33, 0.1]),
  ];
  return [
    B(cyl(0.2, 0.22, 0.05, 10), 1, [0, 0.025, 0]),
    B(cyl(0.06, 0.08, 0.2, 10), 0.9, [0, 0.15, 0]),
    B(box(0.28, 0.04, 0.28), 1, [0, 0.27, 0]),
    part(box(0.18, 0.15, 0.18), 1, [0, 0.365, 0]),
    B(box(0.1, 0.08, 0.012), 0.35, [0, 0.37, 0.093]),
    B(curvedRoof([[0.21, 0.44], [0.16, 0.46], [0.1, 0.5], [0.03, 0.56], [0, 0.565]]), 0.9),
    B(sphere(0.035, 10, 8), 1, [0, 0.59, 0]),
    ...small(-0.25),
    ...small(0.25),
  ];
}

function lanternRoad() {
  const parts = [
    A(box(0.026, 0.17, 0.026), 1, [-0.235, 0.085, 0]),
    A(box(0.026, 0.17, 0.026), 1, [0.235, 0.085, 0]),
    A(box(0.48, 0.012, 0.012), 0.7, [0, 0.165, 0]),
  ];
  for (const x of [-0.13, 0, 0.13]) {
    parts.push(A(box(0.006, 0.03, 0.006), 0.6, [x, 0.145, 0]));
    parts.push(part(sphere(0.042, 10, 8).scale(1, 1.2, 1), 1, [x, 0.1, 0]));
  }
  parts.push(part(box(0.46, 0.012, 0.06), 0.55, [0, 0.006, 0]));
  return parts;
}

/* ─── Nubes Carmesí: black keeps marked with red clouds ─── */

function cloud(scale) {
  const parts = [
    sphere(0.02, 8, 6).translate(-0.022, 0, 0),
    sphere(0.026, 8, 6).translate(0.002, 0.008, 0),
    sphere(0.02, 8, 6).translate(0.026, 0, 0),
  ];
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()), false);
  parts.forEach((p) => p.dispose());
  return g.scale(scale, scale, 0.25);
}

function crimsonSettlement() {
  return [
    A(cyl(0.19, 0.2, 0.035, 8), 0.8, [0, 0.0175, 0]),
    A(box(0.22, 0.18, 0.22), 1, [0, 0.125, 0]),
    B(cloud(1.1), 1, [-0.03, 0.14, 0.112]),
    B(cloud(0.9).rotateY(Math.PI / 2), 1, [0.112, 0.1, 0.03]),
    part(new THREE.ConeGeometry(0.2, 0.17, 4).rotateY(Math.PI / 4), 1, [0, 0.3, 0]),
    part(box(0.25, 0.015, 0.25), 0.55, [0, 0.215, 0]),
  ];
}

function crimsonCity() {
  const parts = [
    A(cyl(0.3, 0.32, 0.04, 10), 0.8, [0, 0.02, 0]),
    A(box(0.3, 0.36, 0.3), 1, [0, 0.22, 0]),
    A(box(0.36, 0.05, 0.36), 0.9, [0, 0.425, 0]),
    part(box(0.37, 0.02, 0.37), 1, [0, 0.455, 0]),
    part(new THREE.ConeGeometry(0.17, 0.3, 4).rotateY(Math.PI / 4), 1, [0, 0.6, 0]),
    B(cloud(1.6), 1, [-0.04, 0.27, 0.152]),
    B(cloud(1.2), 1, [0.06, 0.14, 0.152]),
    B(cloud(1.4).rotateY(Math.PI / 2), 1, [0.152, 0.22, -0.02]),
    B(box(0.07, 0.1, 0.012), 1, [0, 0.09, 0.152]),
  ];
  for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
    parts.push(part(box(0.06, 0.05, 0.06), 1, [x, 0.49, z]));
  }
  return parts;
}

function crimsonRoad() {
  const parts = [];
  for (let i = 0; i < 4; i++) parts.push(A(box(0.11, 0.035, 0.15), i % 2 ? 0.8 : 1, [-0.18 + i * 0.12, 0.0175, 0]));
  parts.push(part(box(0.5, 0.03, 0.026), 1, [0, 0.03, -0.085]));
  parts.push(part(box(0.5, 0.03, 0.026), 1, [0, 0.03, 0.085]));
  parts.push(B(cloud(1.1).rotateX(-Math.PI / 2), 1, [0, 0.038, 0]));
  return parts;
}

/* ─── Sapo Ermitaño: toads in the player colour ─── */

function toad(s, y0) {
  const k = (v) => v * s;
  return [
    part(sphere(k(0.15), 16, 10).scale(1, 0.72, 1.08), 1, [0, y0 + k(0.1), 0]),
    part(sphere(k(0.05), 10, 8).scale(1.4, 0.6, 1.2), 0.85, [k(-0.13), y0 + k(0.035), k(0.06)]),
    part(sphere(k(0.05), 10, 8).scale(1.4, 0.6, 1.2), 0.85, [k(0.13), y0 + k(0.035), k(0.06)]),
    A(sphere(k(0.1), 12, 8).scale(1, 0.6, 0.5), 1, [0, y0 + k(0.07), k(0.11)]),
    A(sphere(k(0.045), 10, 8), 1, [k(-0.065), y0 + k(0.19), k(0.07)]),
    A(sphere(k(0.045), 10, 8), 1, [k(0.065), y0 + k(0.19), k(0.07)]),
    B(sphere(k(0.022), 8, 6), 1, [k(-0.065), y0 + k(0.195), k(0.11)]),
    B(sphere(k(0.022), 8, 6), 1, [k(0.065), y0 + k(0.195), k(0.11)]),
  ];
}

function toadSettlement() {
  return [part(cyl(0.18, 0.19, 0.025, 12), 0.55, [0, 0.0125, 0]), ...toad(1, 0.025)];
}

function toadCity() {
  return [
    part(cyl(0.3, 0.32, 0.035, 14), 0.55, [0, 0.0175, 0]),
    ...toad(1.75, 0.035),
    A(new THREE.ConeGeometry(0.17, 0.09, 16), 0.85, [0, 0.47, -0.02]),
    A(cyl(0.05, 0.05, 0.36, 12).rotateZ(Math.PI / 2), 1, [0, 0.3, -0.16]),
    part(cyl(0.06, 0.06, 0.025, 12).rotateZ(Math.PI / 2), 0.9, [-0.19, 0.3, -0.16]),
    part(cyl(0.06, 0.06, 0.025, 12).rotateZ(Math.PI / 2), 0.9, [0.19, 0.3, -0.16]),
  ];
}

function toadRoad() {
  const parts = [];
  [-0.17, 0, 0.17].forEach((x, i) => {
    parts.push(part(cyl(0.075, 0.085, 0.045, 10), i === 1 ? 1 : 0.88, [x, 0.0225, i === 1 ? 0.02 : -0.015]));
    parts.push(A(sphere(0.018, 6, 4), 1, [x + 0.03, 0.05, 0]));
  });
  return parts;
}

/* ─── Sets ─── */

/**
 * player: lacquer of the player colour; accents: the set's own materials
 * (slot 1 and 2). Colours are sRGB hex; emissive keeps lanterns glowing.
 */
export const PIECE_SETS_3D = {
  'pieces:classic': {
    build: { settlement: classicSettlement, city: classicCity, road: classicRoad },
    player: { roughness: 0.5, metalness: 0.05, glow: 0.18 },
    accents: [],
  },
  'pieces:temple': {
    build: { settlement: templeSettlement, city: templeCity, road: templeRoad },
    player: { roughness: 0.45, metalness: 0.05, glow: 0.2 },
    accents: [
      { color: '#7a4f2c', roughness: 0.8 },
      { color: '#9a948a', roughness: 0.95 },
    ],
  },
  'pieces:scrolls': {
    build: { settlement: scrollsSettlement, city: scrollsCity, road: scrollsRoad },
    player: { roughness: 0.55, metalness: 0.05, glow: 0.2 },
    accents: [
      { color: '#efe4c8', roughness: 0.9 },
      { color: '#4a3020', roughness: 0.8 },
    ],
  },
  'pieces:sand': {
    build: { settlement: sandSettlement, city: sandCity, road: sandRoad },
    player: { roughness: 0.4, metalness: 0.1, glow: 0.2 },
    accents: [
      { color: '#d9b97f', roughness: 0.95 },
      { color: '#a8844f', roughness: 0.95 },
    ],
  },
  'pieces:kunai': {
    build: { settlement: kunaiSettlement, city: kunaiCity, road: kunaiRoad },
    player: { roughness: 0.55, metalness: 0.05, glow: 0.2 },
    accents: [
      { color: '#c4ccd4', roughness: 0.28, metalness: 0.85 },
      { color: '#2a2a30', roughness: 0.4, metalness: 0.6 },
    ],
  },
  'pieces:lantern': {
    build: { settlement: lanternSettlement, city: lanternCity, road: lanternRoad },
    player: { roughness: 0.7, metalness: 0, glow: 0.55 },
    accents: [
      { color: '#2b2018', roughness: 0.8 },
      { color: '#8f8a80', roughness: 0.95 },
    ],
  },
  'pieces:crimson': {
    build: { settlement: crimsonSettlement, city: crimsonCity, road: crimsonRoad },
    player: { roughness: 0.4, metalness: 0.1, glow: 0.2 },
    accents: [
      { color: '#1a1a20', roughness: 0.6, metalness: 0.15 },
      { color: '#c0271b', roughness: 0.5, emissive: 0.15 },
    ],
  },
  'pieces:toad': {
    build: { settlement: toadSettlement, city: toadCity, road: toadRoad },
    player: { roughness: 0.42, metalness: 0.05, glow: 0.2 },
    accents: [
      { color: '#f1e6c6', roughness: 0.7 },
      { color: '#15110e', roughness: 0.3 },
    ],
  },
};

export function pieceSet3D(id) {
  return PIECE_SETS_3D[pieceSetOf(id)];
}

/** Builds one piece geometry ('settlement' | 'city' | 'road') of a set */
export function buildPieceGeometry(id, kind) {
  return mergeSlots(pieceSet3D(id).build[kind]());
}

/** Player-colour lacquer of a set */
export function createPlayerMaterial(id, color) {
  const p = pieceSet3D(id).player;
  return new THREE.MeshStandardMaterial({
    color,
    vertexColors: true,
    roughness: p.roughness,
    metalness: p.metalness,
    // keeps the lacquer colour saturated on the shaded sides (and lanterns lit)
    emissive: new THREE.Color(color).multiplyScalar(p.glow),
  });
}

/** The set's own materials (slots 1, 2) */
export function createAccentMaterials(id) {
  return pieceSet3D(id).accents.map(
    (a) =>
      new THREE.MeshStandardMaterial({
        color: a.color,
        vertexColors: true,
        roughness: a.roughness ?? 0.7,
        metalness: a.metalness ?? 0,
        emissive: new THREE.Color(a.color).multiplyScalar(a.emissive ?? 0.06),
      })
  );
}
