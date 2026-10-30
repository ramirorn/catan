// Textures for the 3D board. The terrain scenes, ground patterns, sea and
// harbour icons are the very same SVG components the 2D board uses: they are
// rendered once to SVG markup, rasterised through an <img> onto a canvas and
// uploaded as CanvasTextures. Text (number seals, harbour ratios) is drawn
// with the 2D canvas API so it can use the page's web fonts.

import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { TerrainDefs } from '../Board/TerrainDefs';
import { TerrainArt } from '../Board/TerrainArt';
import { PremiumTileFrame } from '../Board/PremiumTile';
import { ResourceIcon, AnchorIcon } from '../Shared/Icons';
import { getHexPoints, getDiceDots, hexUnionPath, HEX_SIZE } from '../../utils/hexMath';
import { TERRAIN_BASE } from '../../utils/theme';
import { boardTheme } from '../../utils/cosmetics';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SERIF = "'Shippori Mincho B1', Georgia, serif";
export const LAND_TERRAINS = ['forest', 'hills', 'pasture', 'fields', 'mountains', 'desert'];

export const PORT_TINT = {
  wood: '#2f5a35',
  brick: '#a4482a',
  sheep: '#6f9140',
  wheat: '#c08a22',
  ore: '#56606b',
  generic: '#1f1b17',
};

/** Render a React SVG tree to a markup string (no react-dom/server needed) */
function renderMarkup(element) {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(element));
  const html = host.innerHTML;
  root.unmount();
  return html;
}

async function markupToImage(markup) {
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await img.decode();
  return img;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function toTexture(canvas, { srgb = true, repeat = false, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/** Wait (briefly) for the board fonts, so canvas text uses them */
async function fontsReady() {
  if (!document.fonts?.load) return;
  const load = Promise.all([
    document.fonts.load(`800 64px 'Shippori Mincho B1'`),
    document.fonts.load(`700 64px 'Shippori Mincho B1'`),
  ]).catch(() => {});
  await Promise.race([load, new Promise((r) => setTimeout(r, 2000))]);
}

/* ─── Terrain tops ─── */

function terrainMarkup(terrain, px, premium = false) {
  const pts = getHexPoints(0, 0, HEX_SIZE);
  const inner = getHexPoints(0, 0, HEX_SIZE - 4);
  return renderMarkup(
    <svg xmlns={SVG_NS} width={px} height={px} viewBox={`${-HEX_SIZE} ${-HEX_SIZE} ${HEX_SIZE * 2} ${HEX_SIZE * 2}`}>
      <TerrainDefs />
      <clipPath id="tile">
        <polygon points={pts} />
      </clipPath>
      {/* Ink outside the hex so mipmaps never bleed transparent pixels */}
      <rect x={-HEX_SIZE} y={-HEX_SIZE} width={HEX_SIZE * 2} height={HEX_SIZE * 2} fill="#1f1b17" />
      <g clipPath="url(#tile)">
        <polygon points={pts} fill={`url(#pat-${terrain})`} />
        <TerrainArt terrain={terrain} x={0} y={0} />
        <polygon points={pts} fill={TERRAIN_BASE[terrain]} fillOpacity="0.32" />
        <polygon points={pts} fill="url(#hex-shade)" />
        <polygon points={pts} fill="url(#pat-grain)" fillOpacity="0.4" />
      </g>
      <polygon points={inner} fill="none" stroke="#fff6dc" strokeOpacity="0.22" strokeWidth="1.4" />
      {premium && <PremiumTileFrame terrain={terrain} />}
      <polygon points={pts} fill="none" stroke="#1f1b17" strokeOpacity="0.85" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}

async function createTerrainTextures(px, anisotropy, premium = false) {
  const out = {};
  await Promise.all(
    LAND_TERRAINS.map(async (terrain) => {
      const img = await markupToImage(terrainMarkup(terrain, px, premium));
      const canvas = makeCanvas(px, px);
      canvas.getContext('2d').drawImage(img, 0, 0, px, px);
      out[terrain] = toTexture(canvas, { anisotropy });
    })
  );
  return out;
}

/* ─── Sea (seigaiha), repeating ─── */

async function createSeaTexture(anisotropy, seaPalette) {
  // The 2D sea pattern tile is 20×10 scaled by 1.3
  const w = 26;
  const h = 13;
  const px = 256;
  const img = await markupToImage(
    renderMarkup(
      <svg xmlns={SVG_NS} width={px} height={px / 2} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <TerrainDefs sea={seaPalette} />
        <rect width={w} height={h} fill="url(#pat-sea)" />
      </svg>
    )
  );
  const canvas = makeCanvas(px, px / 2);
  canvas.getContext('2d').drawImage(img, 0, 0, px, px / 2);
  const tex = toTexture(canvas, { repeat: true, anisotropy });
  tex.userData.tile = { w, h };
  return tex;
}

/* ─── Scroll frame around the island ─── */

/**
 * The paper / vermilion / ink rings, foam and sand shore, with the sea area
 * left transparent (the sea is its own repeating-texture mesh below), plus an
 * alpha mask of the sea for that mesh.
 */
async function createFrameTextures(hexGeom, bounds, maxPx, anisotropy, f) {
  const scale = maxPx / Math.max(bounds.width, bounds.height);
  const w = Math.round(bounds.width * scale);
  const h = Math.round(bounds.height * scale);
  const r = (k) => hexUnionPath(hexGeom, HEX_SIZE * k);
  const vb = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;

  const frameImg = await markupToImage(
    renderMarkup(
      <svg xmlns={SVG_NS} width={w} height={h} viewBox={vb}>
        <defs>
          <mask id="no-sea" maskUnits="userSpaceOnUse" x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height}>
            <rect x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="#fff" />
            <path d={r(1.75)} fill="#000" />
          </mask>
        </defs>
        <g mask="url(#no-sea)">
          <path d={hexUnionPath(hexGeom, HEX_SIZE * 1.9 + 5)} transform="translate(1.5 4)" fill="#03050a" fillOpacity="0.5" />
          <path d={r(1.9)} fill={f.margin} stroke={f.margin} strokeWidth="8" strokeLinejoin="round" />
          <path d={r(1.83)} fill={f.rule} />
          <path d={r(1.81)} fill={f.inner} />
          <path d={r(1.78)} fill={f.line} />
        </g>
        <path d={hexUnionPath(hexGeom, HEX_SIZE * 1.16 + 3)} fill={f.foam} fillOpacity={f.foamOpacity} />
        <path d={r(1.1)} fill={f.shore} stroke={f.shore} strokeWidth="6" strokeLinejoin="round" />
      </svg>
    )
  );
  const maskPx = Math.min(1024, maxPx);
  const ms = maskPx / Math.max(bounds.width, bounds.height);
  const mw = Math.round(bounds.width * ms);
  const mh = Math.round(bounds.height * ms);
  const maskImg = await markupToImage(
    renderMarkup(
      <svg xmlns={SVG_NS} width={mw} height={mh} viewBox={vb}>
        <rect x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="#000" />
        {/* Slightly larger than the sea so its edge hides under the ink line */}
        <path d={r(1.765)} fill="#fff" />
      </svg>
    )
  );

  const frameCanvas = makeCanvas(w, h);
  frameCanvas.getContext('2d').drawImage(frameImg, 0, 0, w, h);
  const maskCanvas = makeCanvas(mw, mh);
  maskCanvas.getContext('2d').drawImage(maskImg, 0, 0, mw, mh);

  return {
    frame: toTexture(frameCanvas, { anisotropy }),
    seaMask: toTexture(maskCanvas, { srgb: false, anisotropy: 1 }),
  };
}

/* ─── Number seals ─── */

function createNumberTexture(number) {
  const px = 256;
  const k = px / 42; // seal radius 19.5 units + margin
  const canvas = makeCanvas(px, px);
  const ctx = canvas.getContext('2d');
  ctx.translate(px / 2, px / 2);
  ctx.scale(k, k);
  const isHot = number === 6 || number === 8;
  const ink = isHot ? '#b6331f' : '#1f1b17';

  ctx.beginPath();
  ctx.arc(0, 0, 20.5, 0, Math.PI * 2);
  ctx.fillStyle = '#d9cdb0';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 19.5, 0, Math.PI * 2);
  ctx.fillStyle = '#f4ecda';
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = '#1f1b17';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 16.4, 0, Math.PI * 2);
  ctx.lineWidth = isHot ? 1.6 : 1.1;
  ctx.strokeStyle = '#b6331f';
  ctx.globalAlpha = isHot ? 0.9 : 0.75;
  if (!isHot) ctx.setLineDash([1.4, 2.4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${isHot ? 19 : 17}px ${SERIF}`;
  ctx.fillText(String(number), 0, -1.6);

  const pips = getDiceDots(number).length;
  const gap = 3.6;
  const start = -((pips - 1) * gap) / 2;
  for (let i = 0; i < pips; i++) {
    ctx.beginPath();
    ctx.arc(start + i * gap, 10.4, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(canvas, { anisotropy: 4 });
}

/* ─── Harbour talismans ─── */

async function createPortTexture(type, ratio) {
  const isGeneric = type === 'generic';
  const tint = PORT_TINT[type] || PORT_TINT.generic;
  const k = 9;
  const W = 21;
  const H = 31;
  const px = { w: W * k, h: H * k };
  const img = await markupToImage(
    renderMarkup(
      <svg xmlns={SVG_NS} width={px.w} height={px.h} viewBox={`-10.5 -15.5 ${W} ${H}`}>
        <rect x="-10.5" y="-15.5" width="21" height="31" fill="#f6efdf" />
        <rect x="-10.5" y="-15.5" width="21" height="5" fill={tint} />
        <rect x="-8" y="-8.5" width="16" height="21.5" fill="none" stroke="#b6331f" strokeWidth="0.7" opacity="0.8" />
        <rect x="-10" y="-15" width="20" height="30" fill="none" stroke="#1f1b17" strokeWidth="1.1" />
        <g style={{ color: tint }}>
          {isGeneric ? (
            <AnchorIcon className="" x={-5.5} y={-7.6} width={11} height={11} strokeWidth={2.2} />
          ) : (
            <ResourceIcon type={type} className="" x={-6} y={-8} width={12} height={12} />
          )}
        </g>
      </svg>
    )
  );
  const canvas = makeCanvas(px.w, px.h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, px.w, px.h);
  ctx.setTransform(k, 0, 0, k, 10.5 * k, 15.5 * k);
  ctx.fillStyle = '#1f1b17';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 9px ${SERIF}`;
  ctx.fillText(`${ratio}:1`, 0, 8.6);
  return toTexture(canvas, { anisotropy: 4 });
}

/* ─── Small decals ─── */

const CLOUD_PATH =
  'M-3.4 1.4 a1.5 1.5 0 0 1 0.4 -2.6 a2.1 2.1 0 0 1 3.4 -1 a1.7 1.7 0 0 1 2.9 0.8 a1.4 1.4 0 0 1 0.3 2.8 Z';

/** Black rogue cloak with red, white-rimmed clouds (wraps around a lathe) */
function createCloakTexture() {
  const canvas = makeCanvas(512, 256);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#16161b';
  ctx.fillRect(0, 0, 512, 256);
  // Fold shading
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.25)' : 'rgba(60,60,72,0.12)';
    ctx.fillRect(i * 64, 0, 32, 256);
  }
  const cloud = new Path2D(CLOUD_PATH);
  const spots = [
    [40, 150, 9], [120, 70, 8], [200, 170, 9.5], [290, 90, 8], [370, 175, 9], [450, 80, 8.5],
    [80, 225, 6], [250, 230, 6.5], [420, 232, 6],
  ];
  for (const [x, y, s] of spots) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = '#f3ede1';
    ctx.fillStyle = '#c0271b';
    ctx.fill(cloud);
    ctx.stroke(cloud);
    ctx.restore();
  }
  return toTexture(canvas, { repeat: true });
}

/** Valid-spot chakra seal (same drawing as the 2D marker) */
function createSealTexture() {
  const px = 128;
  const canvas = makeCanvas(px, px);
  const ctx = canvas.getContext('2d');
  ctx.translate(px / 2, px / 2);
  ctx.scale(px / 20, px / 20);
  ctx.beginPath();
  ctx.arc(0, 0, 9.2, 0, Math.PI * 2);
  ctx.fillStyle = '#1f1b17';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#f6efdf';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 5.4, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#e2711d';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 2.1, 0, Math.PI * 2);
  ctx.fillStyle = '#b6331f';
  ctx.fill();
  return toTexture(canvas);
}

/** Dashed orange path for a road that can be laid (u runs along the edge) */
function createDashTexture() {
  const canvas = makeCanvas(256, 32);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(31,27,23,0.75)';
  ctx.beginPath();
  ctx.roundRect(2, 2, 252, 28, 14);
  ctx.fill();
  ctx.fillStyle = '#f6a04b';
  for (let x = 18; x < 240; x += 36) {
    ctx.beginPath();
    ctx.roundRect(x, 9, 22, 14, 5);
    ctx.fill();
  }
  return toTexture(canvas);
}

/* ─── Store ─── */

/**
 * Every texture of one 3D board, created once and disposed together when the
 * board unmounts.
 */
export class TextureStore {
  constructor({ lowPower }) {
    this.lowPower = lowPower;
    this.anisotropy = lowPower ? 2 : 8;
    this.all = new Set();
    this.numbers = {};
    this.ports = {};
  }

  track(tex) {
    this.all.add(tex);
    return tex;
  }

  /**
   * `theme` = board theme id (sea pattern + frame colours are baked into
   * their textures once per board); `tilePx` / `framePx` let small previews
   * use smaller textures.
   */
  async load({ hexGeom, bounds, ports, theme = null, tilePx: tileOverride, framePx }) {
    await fontsReady();
    const palette = boardTheme(theme);
    const tilePx = tileOverride || (this.lowPower ? 256 : 512);
    const [terrain, sea, frame] = await Promise.all([
      createTerrainTextures(tilePx, this.anisotropy, !!palette.premium),
      createSeaTexture(this.anisotropy, palette.sea),
      createFrameTextures(hexGeom, bounds, framePx || (this.lowPower ? 1536 : 2560), this.anisotropy, palette.frame),
    ]);
    Object.values(terrain).forEach((t) => this.track(t));
    this.track(sea);
    this.track(frame.frame);
    this.track(frame.seaMask);

    for (const n of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12]) this.numbers[n] = this.track(createNumberTexture(n));
    await Promise.all(
      (ports || []).map(async (p) => {
        const key = `${p.type}:${p.ratio}`;
        if (!this.ports[key]) this.ports[key] = this.track(await createPortTexture(p.type, p.ratio));
      })
    );
    this.cloak = this.track(createCloakTexture());
    this.seal = this.track(createSealTexture());
    this.dash = this.track(createDashTexture());
    this.terrain = terrain;
    this.sea = sea;
    this.frame = frame.frame;
    this.seaMask = frame.seaMask;
    return this;
  }

  dispose() {
    this.all.forEach((t) => t.dispose());
  }
}
