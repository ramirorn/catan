// Shared, three.js-free glue for the board animations (city upgrade, robber,
// steal, dev cards, near win):
//
//  · fx flags: "an animation is playing" (the dice wait for it, so nothing
//    stacks) and "animations are pending" (queued or playing; modals wait
//    for it together with the dice, see whenStageIdle / useStageReady).
//  · hidden pieces: a piece the animation is about to reveal (the new city,
//    the robber at its new hex) stays hidden on both boards until then.
//  · board bridge: the board on screen (2D SVG or 3D canvas) registers how
//    to project a board point (SVG units) to the screen and how to fly the
//    camera to one, so the overlay can anchor its effects to the board.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { isDiceBusy, subscribeDice } from '../Dice3D/diceSignal';

/* ─── tiny store helper ─── */

function createStore(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const fn of [...listeners]) fn();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

/* ─── fx flags ─── */

const playing = createStore(false);
const pending = createStore(false);

export const setFxPlaying = (v) => playing.set(!!v);
export const setFxPending = (v) => pending.set(!!v);
export const isFxPlaying = () => playing.get();
export const isFxPending = () => pending.get();
export const subscribeFxPlaying = playing.subscribe;

/** Calls cb once no fx animation is on screen (right away if none). Returns a cancel fn. */
export function whenFxIdle(cb) {
  if (!playing.get()) {
    cb();
    return () => {};
  }
  let off = () => {};
  off = playing.subscribe(() => {
    if (playing.get()) return;
    off();
    cb();
  });
  return () => off();
}

const stageBusy = () => isDiceBusy() || pending.get();

function subscribeStage(fn) {
  const a = subscribeDice(fn);
  const b = pending.subscribe(fn);
  return () => {
    a();
    b();
  };
}

/** True while the dice or any board animation is on screen / queued */
export function useStageBusy() {
  return useSyncExternalStore(subscribeStage, stageBusy, () => false);
}

/** Calls cb once dice and animations are all idle. Returns a cancel fn. */
export function whenStageIdle(cb) {
  if (!stageBusy()) {
    cb();
    return () => {};
  }
  let off = () => {};
  off = subscribeStage(() => {
    if (stageBusy()) return;
    off();
    cb();
  });
  return () => off();
}

/**
 * Gate for a modal that must not pop up over the dice / an animation:
 * false while `open` is true but the stage is still busy, true once it is
 * idle (after `settleMs`), or after `capMs` whatever happens. A short
 * `startMs` lets a throw that comes with the same state begin first.
 */
export function useStageReady(open, { startMs = 120, settleMs = 120, capMs = 6500 } = {}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!open) {
      setReady(false);
      return undefined;
    }
    let done = false;
    let after = 0;
    let cancelWait = () => {};
    const show = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    const start = setTimeout(() => {
      cancelWait = whenStageIdle(() => {
        after = setTimeout(show, settleMs);
      });
    }, startMs);
    const cap = setTimeout(show, capMs);
    return () => {
      clearTimeout(start);
      clearTimeout(after);
      clearTimeout(cap);
      cancelWait();
    };
  }, [open, startMs, settleMs, capMs]);
  return open && ready;
}

/* ─── hidden pieces (ref-counted keys: 'vertex:<id>', 'robber') ─── */

const hiddenCounts = new Map();
const hiddenListeners = new Set();
let hiddenVersion = 0;

function emitHidden() {
  hiddenVersion++;
  for (const fn of [...hiddenListeners]) fn();
}

export function hideFx(key) {
  hiddenCounts.set(key, (hiddenCounts.get(key) || 0) + 1);
  emitHidden();
}

export function unhideFx(key) {
  const n = hiddenCounts.get(key) || 0;
  if (n <= 0) return;
  if (n === 1) hiddenCounts.delete(key);
  else hiddenCounts.set(key, n - 1);
  emitHidden();
}

export function clearFxHidden() {
  if (hiddenCounts.size === 0) return;
  hiddenCounts.clear();
  emitHidden();
}

function subscribeHidden(fn) {
  hiddenListeners.add(fn);
  return () => hiddenListeners.delete(fn);
}

export const isFxHidden = (key) => hiddenCounts.has(key);
export const fxHiddenVersion = () => hiddenVersion;

/** true while an animation keeps this piece hidden */
export function useFxHidden(key) {
  return useSyncExternalStore(
    subscribeHidden,
    () => hiddenCounts.has(key),
    () => false
  );
}

/* ─── board bridge ─── */

// { mode: '2d' | '3d', project(x, y) → { x, y, s } | null (client px, s = px per
//   board unit), toBoard(clientX, clientY) → { x, y } | null,
//   focus(x, y, { inMs, holdMs, outMs, zoom }) → cancel fn }
let bridge = null;

export function setBoardBridge(next) {
  bridge = next;
  return () => {
    if (bridge === next) bridge = null;
  };
}

export const getBoardBridge = () => bridge;

/* ─── in-scene dice (3D board) ─── */

// The 3D board registers itself as a host for the dice throw, so the dice
// land on its table and move with its camera; the overlay then only shows
// the result stamp. { throwId, die1, die2, seed, onStart, onSettled } | null
const diceThrow = createStore(null);
let diceHosts = 0;

export function registerDiceHost() {
  diceHosts++;
  return () => {
    diceHosts = Math.max(0, diceHosts - 1);
  };
}

export const hasDiceHost = () => diceHosts > 0;
export const setSceneDiceThrow = (t) => diceThrow.set(t);
export const getSceneDiceThrow = () => diceThrow.get();

export function useSceneDiceThrow() {
  return useSyncExternalStore(diceThrow.subscribe, diceThrow.get, () => null);
}
