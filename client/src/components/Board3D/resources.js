// Shared geometries and materials of the 3D board. Built once per board
// mount (after the textures), shared by every tile / piece, and disposed
// together on unmount. Units: 1 world unit = one hex radius (60 SVG px).

import * as THREE from 'three';
import { TERRAIN_BASE, shade } from '../../utils/theme';
import { boardTheme, pieceSetOf } from '../../utils/cosmetics';
import { LAND_TERRAINS } from './textures';
import { ROAD_LEN, buildPieceGeometry, createAccentMaterials, createPieceShadow, createPlayerMaterial } from './pieceSets';

export const PX = 1 / 60; // SVG board px → world units
export const TILE_H = 0.14; // tile thickness
export const TILE_SCALE = 0.965; // small gaps between tiles show their sides
export const INK = '#120e0b';

const SQRT3 = Math.sqrt(3);

/** Open six-sided tile wall, flat shaded */
export function hexSideGeometry() {
  const g = new THREE.CylinderGeometry(1, 1, TILE_H, 6, 1, true).translate(0, TILE_H / 2, 0);
  const flat = g.toNonIndexed();
  g.dispose();
  flat.computeVertexNormals();
  return flat;
}

/**
 * Board theme on the tile materials: the terrain textures stay the same
 * (artwork readable), the theme only tints them / lifts them with a haze.
 */
export function applyTileTheme(mat, themeId) {
  const theme = boardTheme(themeId);
  const tint = new THREE.Color(theme.tileTint);
  const haze = new THREE.Color(theme.tileHaze);
  for (const t of LAND_TERRAINS) {
    mat.tileTop[t].color.copy(tint);
    mat.tileTop[t].emissive.copy(haze);
    mat.tileSide[t].color.set(shade(TERRAIN_BASE[t], -0.55)).multiply(tint);
  }
}
const CORNERS = [
  [0, -1],
  [SQRT3 / 2, -0.5],
  [SQRT3 / 2, 0.5],
  [0, 1],
  [-SQRT3 / 2, 0.5],
  [-SQRT3 / 2, -0.5],
];

/** Flat hexagon facing up, uv mapped like the 2D tile (x right, svg-y = world z) */
export function hexTopGeometry() {
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

/** Every reusable geometry / material of a board */
export class BoardResources {
  constructor(textures, { lowPower, theme = null }) {
    this.textures = textures;
    this.lowPower = lowPower;
    this.disposables = new Set();
    this.pieceMats = new Map();
    this.pieceGeos = new Map();
    this.accentMats = new Map();

    const keep = (o) => {
      this.disposables.add(o);
      return o;
    };

    this.geo = {
      hexTop: keep(hexTopGeometry()),
      hexSide: keep(hexSideGeometry()),
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
      // hex protected by a signed peace pact (robber can't go there)
      pactShield: basic({ color: '#ffffff', transparent: true, opacity: 0.32, depthWrite: false }),
      hit: basic({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
      // Robber
      cloak: keep(new THREE.MeshStandardMaterial({ map: textures.cloak, roughness: 0.85 })),
      robberDark: lambert({ color: '#1c1c22' }),
      straw: lambert({ color: '#cfae6c' }),
      strawDark: lambert({ color: '#8d6f35' }),
      paper: lambert({ color: '#efe7d6' }),
    };
    applyTileTheme(this.mat, theme);

    // Soft contact shadow under every piece (one plane + material for all)
    this.pieceShadow = createPieceShadow();
    keep(this.pieceShadow.geometry);
    keep(this.pieceShadow.material);
  }

  /** Geometry of a piece ('settlement' | 'city' | 'road') of a shop set, built once */
  pieceGeometry(rawSetId, kind) {
    const setId = pieceSetOf(rawSetId);
    const key = `${setId}|${kind}`;
    let g = this.pieceGeos.get(key);
    if (!g) {
      g = buildPieceGeometry(setId, kind);
      this.pieceGeos.set(key, g);
      this.disposables.add(g);
    }
    return g;
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

  /**
   * Materials of a piece: [player-colour lacquer of the set, …the set's own
   * materials]. Cached per set and colour (a handful per game).
   */
  pieceMaterials(rawSetId, color) {
    const setId = pieceSetOf(rawSetId);
    const key = `${setId}|${color}`;
    let list = this.pieceMats.get(key);
    if (!list) {
      let accents = this.accentMats.get(setId);
      if (!accents) {
        accents = createAccentMaterials(setId);
        accents.forEach((m) => this.disposables.add(m));
        this.accentMats.set(setId, accents);
      }
      const player = createPlayerMaterial(setId, color);
      this.disposables.add(player);
      list = [player, ...accents];
      this.pieceMats.set(key, list);
    }
    return list;
  }

  dispose() {
    this.disposables.forEach((o) => o.dispose());
    this.disposables.clear();
    this.pieceMats.clear();
    this.pieceGeos.clear();
    this.accentMats.clear();
  }
}
