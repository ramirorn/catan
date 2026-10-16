// Sidebar layout shared by the standings and the log / chat: when the log is
// "expanded" the standings shrink to a one-line strip so the chronicle and
// the chat get the height. Remembered per browser (best effort).

import { useSyncExternalStore } from 'react';

const KEY = 'catan.logExpanded';

function read() {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

let expanded = read();
const subs = new Set();

function subscribe(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}
const get = () => expanded;

export function useLogExpanded() {
  return useSyncExternalStore(subscribe, get, get);
}

export function setLogExpanded(v) {
  expanded = !!v;
  try {
    window.localStorage.setItem(KEY, expanded ? '1' : '0');
  } catch {
    /* storage blocked: keep it for this session only */
  }
  subs.forEach((cb) => cb());
}
