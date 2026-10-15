// 2D / 3D board preference: remembered per player (localStorage) and only
// offered in 3D when the browser can create a WebGL context.

import { createContext, useContext } from 'react';

const STORAGE_KEY = 'catan_board_view';

export const BoardViewContext = createContext(null);

/** { mode: '2d' | '3d', webgl: boolean, toggle(), setMode(mode) } or null */
export function useBoardViewMode() {
  return useContext(BoardViewContext);
}

let webglCache = null;
export function hasWebGL() {
  if (webglCache !== null) return webglCache;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    webglCache = !!gl;
    // Free the probe context right away
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/** Phones / tablets and weak machines: smaller textures, no shadows */
export function isLowPowerDevice() {
  try {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 8;
    return coarse || small || cores <= 4 || memory <= 4;
  } catch {
    return true;
  }
}

export function readStoredViewMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === '2d' || v === '3d' ? v : null;
  } catch {
    return null;
  }
}

export function storeViewMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // storage blocked (private mode…): the choice just isn't remembered
  }
}

/**
 * First visit: 3D on desktop-class devices with WebGL, 2D on phones / weak
 * hardware (saves battery and the three.js download). Afterwards the stored
 * choice wins, but never 3D without WebGL.
 */
export function initialViewMode() {
  if (!hasWebGL()) return '2d';
  const stored = readStoredViewMode();
  if (stored) return stored;
  return isLowPowerDevice() ? '2d' : '3d';
}
