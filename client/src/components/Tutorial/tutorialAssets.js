// Small canvas textures of the tutorial stage (resource cards made from the
// board's own terrain art, ink seals, paper tags, development cards) plus a
// few shared materials. Built lazily, cached, disposed together.

import * as THREE from 'three';
import { RESOURCE_NAMES } from '../../utils/constants';
import { RESOURCE_KANJI } from '../../utils/theme';

const PAPER = '#f6efdf';
const INK = '#1f1b17';
const SHU = '#b6331f';
const DISPLAY = "'Shippori Mincho B1', Georgia, serif";
const SANS = "'Zen Kaku Gothic New', 'Segoe UI', system-ui, sans-serif";

export const TERRAIN_RESOURCE = {
  forest: 'wood',
  hills: 'brick',
  pasture: 'sheep',
  fields: 'wheat',
  mountains: 'ore',
};

const DEV_CARDS = {
  knight: { kanji: '騎', name: ['Caballero'] },
  roadBuilding: { kanji: '道', name: ['Construcción', 'de caminos'] },
  yearOfPlenty: { kanji: '豊', name: ['Año de la', 'abundancia'] },
  monopoly: { kanji: '独', name: ['Monopolio'] },
  victoryPoint: { kanji: '勝', name: ['Punto de', 'victoria'] },
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function toTexture(c, aspect) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  tex.userData.aspect = aspect ?? c.width / c.height;
  return tex;
}

export class TutorialAssets {
  constructor(res) {
    this.res = res;
    this.cache = new Map();
    this.glow = new THREE.MeshBasicMaterial({ color: '#f6a04b', transparent: true, depthWrite: false });
    this.confettiGeo = new THREE.PlaneGeometry(0.07, 0.1);
    this.confettiMats = ['#b6331f', '#f6a04b', '#f9f4e8', '#2a6fd0', '#4c7a3a'].map(
      (color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
    );
  }

  cached(key, make) {
    let tex = this.cache.get(key);
    if (!tex) {
      tex = make();
      this.cache.set(key, tex);
    }
    return tex;
  }

  /** Resource card: the terrain's own art in a paper card with its name */
  card(terrain) {
    return this.cached(`card:${terrain}`, () => {
      const c = canvas(160, 224);
      const ctx = c.getContext('2d');
      roundRect(ctx, 3, 3, 154, 218, 14);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      const art = this.res.textures.terrain[terrain]?.image;
      ctx.save();
      roundRect(ctx, 14, 14, 132, 158, 6);
      ctx.clip();
      if (art) {
        const sw = art.width * 0.56;
        const sh = sw * (158 / 132);
        ctx.drawImage(art, (art.width - sw) / 2, (art.height - sh) / 2, sw, sh, 14, 14, 132, 158);
      }
      ctx.restore();
      const res = TERRAIN_RESOURCE[terrain];
      // vermilion seal with the resource kanji
      ctx.beginPath();
      ctx.arc(124, 40, 19, 0, Math.PI * 2);
      ctx.fillStyle = SHU;
      ctx.fill();
      ctx.fillStyle = '#fbf1e0';
      ctx.font = `800 24px ${DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(RESOURCE_KANJI[res] || '', 124, 41);
      ctx.fillStyle = INK;
      ctx.font = `700 22px ${SANS}`;
      ctx.fillText((RESOURCE_NAMES[res] || '').toUpperCase(), 80, 197);
      return toTexture(c);
    });
  }

  /** { kind: 'seal' | 'tag' | 'ok' | 'no', text, color } */
  badge({ kind, text = '', color = SHU }) {
    return this.cached(`badge:${kind}:${text}:${color}`, () => {
      if (kind === 'tag') {
        const probe = canvas(4, 4).getContext('2d');
        probe.font = `800 52px ${DISPLAY}`;
        const tw = Math.ceil(probe.measureText(text).width);
        const w = tw + 72;
        const h = 92;
        const c = canvas(w, h);
        const ctx = c.getContext('2d');
        roundRect(ctx, 4, 4, w - 8, h - 8, 10);
        ctx.fillStyle = PAPER;
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = SHU;
        ctx.stroke();
        roundRect(ctx, 12, 12, w - 24, h - 24, 6);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(31,27,23,0.35)';
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = `800 52px ${DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2 + 3);
        return toTexture(c);
      }
      const c = canvas(128, 128);
      const ctx = c.getContext('2d');
      const fill = kind === 'ok' ? '#4c7a3a' : kind === 'no' ? SHU : color;
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(64, 64, 47, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(251,241,224,0.7)';
      ctx.stroke();
      ctx.strokeStyle = '#fbf1e0';
      ctx.fillStyle = '#fbf1e0';
      ctx.lineCap = 'round';
      if (kind === 'ok') {
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(40, 66);
        ctx.lineTo(57, 83);
        ctx.lineTo(89, 45);
        ctx.stroke();
      } else if (kind === 'no') {
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.moveTo(44, 44);
        ctx.lineTo(84, 84);
        ctx.moveTo(84, 44);
        ctx.lineTo(44, 84);
        ctx.stroke();
      } else {
        ctx.font = `800 ${text.length > 1 ? 54 : 66}px ${DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 68);
      }
      return toTexture(c);
    });
  }

  /** Front of a development card */
  dev(type) {
    return this.cached(`dev:${type}`, () => {
      const info = DEV_CARDS[type];
      const c = canvas(200, 280);
      const ctx = c.getContext('2d');
      roundRect(ctx, 3, 3, 194, 274, 14);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      roundRect(ctx, 14, 14, 172, 252, 8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = SHU;
      ctx.stroke();
      ctx.fillStyle = type === 'knight' ? SHU : INK;
      ctx.font = `800 104px ${DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(info.kanji, 100, 112);
      ctx.fillStyle = INK;
      ctx.font = `700 22px ${SANS}`;
      info.name.forEach((line, i) => ctx.fillText(line, 100, 205 + i * 27 - (info.name.length - 1) * 8));
      return toTexture(c);
    });
  }

  /** Back of a development card (lacquer with a chakra seal) */
  devBack() {
    return this.cached('dev:back', () => {
      const c = canvas(200, 280);
      const ctx = c.getContext('2d');
      roundRect(ctx, 3, 3, 194, 274, 14);
      ctx.fillStyle = '#141c2c';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      roundRect(ctx, 14, 14, 172, 252, 8);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#e2711d';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(100, 140, 46, 0, Math.PI * 2);
      ctx.fillStyle = SHU;
      ctx.fill();
      ctx.fillStyle = '#fbf1e0';
      ctx.font = `800 58px ${DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('忍', 100, 144);
      return toTexture(c);
    });
  }

  dispose() {
    this.cache.forEach((t) => t.dispose());
    this.cache.clear();
    this.glow.dispose();
    this.confettiGeo.dispose();
    this.confettiMats.forEach((m) => m.dispose());
  }
}
