// The robber's face of the current room («Cara del ladrón»), shared by the
// board, the leap animation and the menus. RobberFaceSync fills it from the
// server; each player can hide it on their own screen (remembered locally).

import { useSyncExternalStore } from 'react';

const HIDE_KEY = 'catan_hide_robber_face';

let face = null; // { key, id, by, image, points }
let hidden = false;
try {
  hidden = localStorage.getItem(HIDE_KEY) === '1';
} catch {
  hidden = false;
}

const listeners = new Set();
const notify = () => {
  for (const fn of [...listeners]) fn();
};
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Room + face id: ids restart at 1 in every room */
export const faceKey = (roomId, id) => (roomId && id ? `${roomId}:${id}` : null);

export function setRobberFace(next) {
  if (face === next) return;
  face = next;
  notify();
}

export const getRobberFace = () => face;

export function setRobberFaceHidden(value) {
  hidden = !!value;
  try {
    localStorage.setItem(HIDE_KEY, hidden ? '1' : '0');
  } catch {
    // private mode: only for this page
  }
  notify();
}

const getFace = () => face;
const getHidden = () => hidden;

/** The face as loaded, even when hidden on this screen (menus, preview) */
export const useRobberFaceData = () => useSyncExternalStore(subscribe, getFace, getFace);
export const useRobberFaceHidden = () => useSyncExternalStore(subscribe, getHidden, getHidden);

/** The face to draw on the robber, or null (none, or hidden by this player) */
export function useShownRobberFace() {
  const f = useRobberFaceData();
  const h = useRobberFaceHidden();
  return h ? null : f;
}
