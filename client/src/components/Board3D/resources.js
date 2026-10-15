// Shared geometries and materials of the 3D board. Built once per board
// mount (after the textures), shared by every tile / piece, and disposed
// together on unmount. Units: 1 world unit = one hex radius (60 SVG px).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TERRAIN_BASE, shade } from '../../utils/theme';
import { LAND_TERRAINS } from './textures';

export const PX = 1 / 60; // SVG board px → world units
export const TILE_H = 0.14; // tile thickness
export const TILE_SCALE = 0.965; // small gaps between tiles show their sides
export const INK = '#120e0b';

const SQRT3 = Math.sqrt(3);
const CORNERS = [
  [0, -1],
  [SQRT3 / 2, -0.5],
  [SQRT3 / 2, 0.5],
  [0, 1],
  [-SQRT3 / 2, 0.5],
  [-SQRT3 / 2, -0.5],
];

/** Flat hexagon facing up, uv mapped like the 2D tile (x right, svg-y = world z) */
function hexTopGeometry() {
  const pos = [0, 0, 0];
  const uv = [0.5, 0.5];
  for (const [x, z] of CORNERS) {
    pos.push(x, 0, z);
    uv.push(x / 2 + 0.5, 0.5 - z / 2);
  }
  const index = [];
  for (let i = 0; i < 6; i++) index.push(0, 1 + ((i + 1) % 6), 1 + i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(7).fill([0, 1, 0]).flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  return g;
}

/** Flat-shaded part with a constant vertex colour (multiplies the player colour) */
function part(geom, tone, at) {
  if (at) geom.translate(at[0], at[1], at[2]);
  const g = geom.index ? geom.toNonIndexed() : geom;
  if (g !== geom) geom.dispose();
  g.computeVertexNormals();
  const n = g.attributes.position.count;
  // Tones are perceptual (sRGB-ish); vertex colours are linear
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(Math.pow(tone, 2.2)), 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}

function merge(parts) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  g.computeBoundingSphere();
  return g;
}

/**
 * Square hip roof with curved (concave, flared) slopes, as a 4-sided lathe.
 * `profile` = [[halfSide, y], …] from the eave up to the ridge.
 */
function curvedRoof(profile) {
  const pts = profile.map(([a, y]) => new THREE.Vector2(a * Math.SQRT2, y));
  return new THREE.LatheGeometry(pts, 4, Math.PI / 4);
}

/** Settlement: a little house with a curved, flared roof */
function settlementGeometry() {
  return merge([
    part(new THREE.CylinderGeometry(0.19, 0.205, 0.035, 8), 0.6, [0, 0.0175, 0]),
    part(new THREE.BoxGeometry(0.22, 0.17, 0.22), 1, [0, 0.12, 0]),
    part(new THREE.BoxGeometry(0.065, 0.1, 0.012), 0.1, [0, 0.085, 0.112]),
    part(new THREE.BoxGeometry(0.05, 0.045, 0.012), 0.16, [0.065, 0.13, 0.112]),
    part(new THREE.BoxGeometry(0.31, 0.012, 0.31), 0.35, [0, 0.206, 0]),
    part(
      curvedRoof([
        [0.17, 0.2],
        [0.135, 0.222],
        [0.09, 0.262],
        [0.045, 0.315],
        [0.012, 0.35],
        [0, 0.356],
      ]),
      0.68
    ),
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), 0.25, [0, 0.37, 0]),
  ]);
}

/** City: a two-storey pagoda tower */
function cityGeometry() {
  return merge([
    part(new THREE.CylinderGeometry(0.24, 0.255, 0.035, 8), 0.6, [0, 0.0175, 0]),
    // ground floor
    part(new THREE.BoxGeometry(0.27, 0.17, 0.27), 1, [0, 0.12, 0]),
    part(new THREE.BoxGeometry(0.075, 0.105, 0.012), 0.1, [0, 0.087, 0.136]),
    part(new THREE.BoxGeometry(0.045, 0.045, 0.012), 0.16, [-0.085, 0.13, 0.136]),
    part(new THREE.BoxGeometry(0.045, 0.045, 0.012), 0.16, [0.085, 0.13, 0.136]),
    part(new THREE.BoxGeometry(0.38, 0.012, 0.38), 0.35, [0, 0.206, 0]),
    part(
      curvedRoof([
        [0.205, 0.2],
        [0.165, 0.222],
        [0.12, 0.257],
        [0.095, 0.278],
      ]),
      0.68
    ),
    // upper floor
    part(new THREE.BoxGeometry(0.17, 0.13, 0.17), 0.92, [0, 0.335, 0]),
    part(new THREE.BoxGeometry(0.06, 0.05, 0.012), 0.12, [0, 0.34, 0.086]),
    part(new THREE.BoxGeometry(0.29, 0.012, 0.29), 0.35, [0, 0.401, 0]),
    part(
      curvedRoof([
        [0.155, 0.396],
        [0.12, 0.418],
        [0.075, 0.462],
        [0.035, 0.515],
        [0.01, 0.55],
        [0, 0.556],
      ]),
      0.68
    ),
    part(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 6), 0.25, [0, 0.585, 0]),
    part(new THREE.SphereGeometry(0.022, 8, 6), 0.9, [0, 0.635, 0]),
  ]);
}

/** Road: a small arched plank bridge laid along +x, centred on the origin */
const ROAD_LEN = 0.5;
function roadGeometry() {
  const parts = [];
  const n = 6;
  const pitch = ROAD_LEN / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const plank = new THREE.BoxGeometry(pitch * 0.8, 0.032, 0.17);
    plank.rotateZ(-Math.cos(Math.PI * t) * 0.18);
    parts.push(part(plank, i % 2 ? 0.84 : 1, [-ROAD_LEN / 2 + pitch * (i + 0.5), 0.026 + 0.034 * Math.sin(Math.PI * t), 0]));
  }
  for (const z of [-0.088, 0.088]) {
    parts.push(part(new THREE.BoxGeometry(ROAD_LEN + 0.02, 0.022, 0.022), 0.5, [0, 0.105, z]));
    for (const x of [-ROAD_LEN / 2, 0, ROAD_LEN / 2]) {
      parts.push(part(new THREE.BoxGeometry(0.024, 0.075, 0.024), 0.42, [x, 0.065 + (x === 0 ? 0.01 : 0), z]));
    }
  }
  return merge(parts);
}

/** Every reusable geometry / material of a board */
export class BoardResources {
  constructor(textures, { lowPower }) {
    this.textures = textures;
    this.lowPower = lowPower;
    this.disposables = new Set();
    this.pieceMats = new Map();

    const keep = (o) => {
      this.disposables.add(o);
      return o;
    };

    this.geo = {
      hexTop: keep(hexTopGeometry()),
      hexSide: keep(
        (() => {
          const g = new THREE.CylinderGeometry(1, 1, TILE_H, 6, 1, true).translate(0, TILE_H / 2, 0);
          const flat = g.toNonIndexed();
          g.dispose();
          flat.computeVertexNormals();
          return flat;
        })()
      ),
      settlement: keep(settlementGeometry()),
      city: keep(cityGeometry()),
      road: keep(roadGeometry()),
      tokenSide: keep(new THREE.CylinderGeometry(0.3, 0.31, 0.04, 32, 1, true)),
      tokenTop: keep(new THREE.CircleGeometry(0.3, 40).rotateX(-Math.PI / 2)),
      seal: keep(new THREE.CircleGeometry(0.15, 32).rotateX(-Math.PI / 2)),
      vertexHit: keep(new THREE.SphereGeometry(0.22, 10, 8)),
      upgradeRing: keep(new THREE.TorusGeometry(0.29, 0.02, 6, 40).rotateX(Math.PI / 2)),
      roadDash: keep(new THREE.PlaneGeometry(ROAD_LEN, 0.12).rotateX(-Math.PI / 2)),
      edgeHit: keep(new THREE.BoxGeometry(0.62, 0.22, 0.24)),
      robberRing: keep(new THREE.RingGeometry(0.75, 0.805, 6, 1, Math.PI / 2).rotateX(-Math.PI / 2)),
      pierPlank: keep(new THREE.BoxGeometry(1, 0.03, 0.07)),
      post: keep(new THREE.CylinderGeometry(0.022, 0.026, 1, 6)),
      talisman: keep(new THREE.PlaneGeometry(0.42, 0.62)),
    };

    const lambert = (p) => keep(new THREE.MeshLambertMaterial(p));
    const basic = (p) => keep(new THREE.MeshBasicMaterial(p));

    this.mat = {
      tileTop: Object.fromEntries(LAND_TERRAINS.map((t) => [t, lambert({ map: textures.terrain[t] })])),
      tileSide: Object.fromEntries(LAND_TERRAINS.map((t) => [t, lambert({ color: shade(TERRAIN_BASE[t], -0.55) })])),
      sea: lambert({
        map: textures.sea,
        alphaMap: textures.seaMask,
        transparent: true,
        depthWrite: false,
      }),
      frame: lambert({ map: textures.frame, transparent: true, depthWrite: false }),
      tokenSide: lambert({ color: '#cbbd9c' }),
      tokenTop: Object.fromEntries(
        Object.entries(textures.numbers).map(([n, map]) => [n, lambert({ map })])
      ),
      talisman: Object.fromEntries(
        Object.entries(textures.ports).map(([k, map]) => [k, lambert({ map, side: THREE.DoubleSide })])
      ),
      wood: lambert({ color: '#7a5634' }),
      woodDark: lambert({ color: '#3a2618' }),
      // Interaction markers (opacity pulsed by <PulseDriver/>)
      seal: basic({ map: textures.seal, transparent: true, depthWrite: false }),
      dash: basic({ map: textures.dash, transparent: true, depthWrite: false }),
      ring: basic({ color: '#f6a04b', transparent: true }),
      robberRing: basic({ color: '#f6a04b', transparent: true, depthWrite: false }),
      hover: basic({ color: '#fff4dc', transparent: true, opacity: 0.2, depthWrite: false }),
      hit: basic({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
      // Robber
      cloak: keep(new THREE.MeshStandardMaterial({ map: textures.cloak, roughness: 0.85 })),
      robberDark: lambert({ color: '#1c1c22' }),
      straw: lambert({ color: '#cfae6c' }),
      strawDark: lambert({ color: '#8d6f35' }),
      paper: lambert({ color: '#efe7d6' }),
    };
  }

  /** Breathing opacity of the placement markers (k in 0..1, null = steady) */
  setPulse(k) {
    const { seal, dash, ring, robberRing } = this.mat;
    if (k === null) {
      seal.opacity = dash.opacity = ring.opacity = robberRing.opacity = 1;
      return;
    }
    seal.opacity = 0.65 + 0.35 * k;
    dash.opacity = 0.55 + 0.45 * k;
    ring.opacity = 0.6 + 0.4 * k;
    robberRing.opacity = 0.45 + 0.5 * k;
  }

  /** Lacquered piece material in a player colour (vertex colours shade it) */
  pieceMaterial(color) {
    let m = this.pieceMats.get(color);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color,
        vertexColors: true,
        roughness: 0.5,
        metalness: 0.05,
        // keeps the lacquer colour saturated on the shaded sides
        emissive: new THREE.Color(color).multiplyScalar(0.18),
      });
      this.pieceMats.set(color, m);
      this.disposables.add(m);
    }
    return m;
  }

  dispose() {
    this.disposables.forEach((o) => o.dispose());
    this.disposables.clear();
    this.pieceMats.clear();
  }
}
