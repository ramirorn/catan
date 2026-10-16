// Tiny shared flag: "the dice throw is on screen". The overlay raises it while
// the dice fly and the result stamp shows; the HUD dice, the "Recursos
// recibidos" modal and the turn banner wait for it to drop.

import { useSyncExternalStore } from 'react';

let busy = false;
const listeners = new Set();

export function setDiceBusy(value) {
  if (busy === value) return;
  busy = value;
  for (const fn of [...listeners]) fn();
}

export function isDiceBusy() {
  return busy;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const subscribeDice = subscribe;

export function useDiceBusy() {
  return useSyncExternalStore(subscribe, isDiceBusy, () => false);
}

/** Calls cb once the dice are idle (right away if they already are). Returns a cancel fn. */
export function whenDiceIdle(cb) {
  if (!busy) {
    cb();
    return () => {};
  }
  const fn = () => {
    if (busy) return;
    listeners.delete(fn);
    cb();
  };
  listeners.add(fn);
  return () => listeners.delete(fn);
}
