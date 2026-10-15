// Hover / long-press info cards for the board, shared by the 2D and 3D boards.
//
// A tiny external store (read with useSyncExternalStore) holds *which* element
// the card describes; the pointer position lives outside React and is pushed
// straight to the card's DOM node, so moving the mouse never re-renders the
// board (nor the card, unless the target changes).
//
// Targets: { kind: 'hex' | 'port' | 'vertex', id }
//
// Desktop: the card appears after a short rest on an element, follows the
// cursor and hides on leave / press / wheel / drag.
// Touch: a long press shows it (and the click that ends it is swallowed so
// nothing gets placed); the next tap anywhere hides it.

const HOVER_DELAY_MS = 300;
const PLACING_DELAY_MS = 700; // while placing pieces the card waits longer
const LONG_PRESS_MS = 450;
const PRESS_SLOP_PX = 10;
const LEAVE_GRACE_MS = 70; // lets the card hop between neighbours without flicker

let shown = null; // { target, key, mode: 'mouse' | 'touch' }
const listeners = new Set();
const posListeners = new Set();
const pos = { x: 0, y: 0 };

let hoverKey = null; // element under the mouse right now
let suppressedKey = null; // pressed on: don't re-show until the pointer leaves it
let showTimer = 0;
let leaveTimer = 0;
let placing = false;

let press = null; // { pointerId, x, y, timer }
let swallowClick = false;
let swallowTimer = 0;
const activePointers = new Set();
let installed = false;

export const tipKey = (t) => (t ? `${t.kind}:${t.id}` : null);

function emit() {
  for (const l of listeners) l();
}

function setPos(x, y) {
  pos.x = x;
  pos.y = y;
  for (const l of posListeners) l(pos);
}

function show(target, mode) {
  clearTimeout(showTimer);
  clearTimeout(leaveTimer);
  const key = tipKey(target);
  if (shown && shown.key === key && shown.mode === mode) return;
  shown = { target, key, mode };
  emit();
}

export function hideTip() {
  clearTimeout(showTimer);
  clearTimeout(leaveTimer);
  showTimer = 0;
  if (!shown) return;
  shown = null;
  emit();
}

/* ─── Store access for the renderer ─── */

export function subscribeTip(cb) {
  installGlobalListeners();
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export const getTip = () => shown;

export function subscribeTipPos(cb) {
  posListeners.add(cb);
  return () => posListeners.delete(cb);
}
export const getTipPos = () => pos;

/** Placing pieces / moving the robber: be less eager */
export function setTipPlacing(v) {
  placing = !!v;
}

/* ─── Mouse / pen hover ─── */

/**
 * The pointer is over `target` (or over nothing tip-worthy when null).
 * Call it on every pointer move; it is cheap when nothing changes.
 */
export function hoverTip(target, e) {
  if (e.pointerType === 'touch') return;
  if (e.buttons) {
    // Dragging (pan / orbit): stay out of the way
    hoverKey = null;
    hideTip();
    return;
  }
  setPos(e.clientX, e.clientY);
  const key = tipKey(target);
  if (key === hoverKey) return;
  hoverKey = key;
  if (key !== suppressedKey) suppressedKey = null;
  clearTimeout(showTimer);

  if (!target) {
    // Small grace period: the next element may claim the card right away
    clearTimeout(leaveTimer);
    if (shown?.mode === 'mouse') leaveTimer = setTimeout(hideTip, LEAVE_GRACE_MS);
    return;
  }
  if (key === suppressedKey) return;
  if (shown?.mode === 'mouse') {
    // Already reading cards: switch immediately
    show(target, 'mouse');
    return;
  }
  if (shown) hideTip();
  showTimer = setTimeout(() => show(target, 'mouse'), placing ? PLACING_DELAY_MS : HOVER_DELAY_MS);
}

/** The pointer left `target` (only acts if it is still the hovered one) */
export function leaveTip(target, e) {
  if (e && e.pointerType === 'touch') return;
  if (tipKey(target) !== hoverKey) return;
  hoverTip(null, { pointerType: 'mouse', buttons: 0, clientX: pos.x, clientY: pos.y });
}

/* ─── Touch long press ─── */

function cancelPress() {
  if (!press) return;
  clearTimeout(press.timer);
  press = null;
}

/** Touch / pen pointer went down on `target`: start the long-press timer */
export function pressTip(target, e) {
  if (e.pointerType === 'mouse' || !target) return;
  if (press && press.pointerId === e.pointerId) return; // nearest element already took it
  if (activePointers.size > 1) return; // pinch
  cancelPress();
  const p = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, timer: 0 };
  p.timer = setTimeout(() => {
    if (press !== p) return;
    press = null;
    swallowClick = true; // the release must not place anything
    clearTimeout(swallowTimer);
    setPos(p.x, p.y);
    show(target, 'touch');
    try {
      navigator.vibrate?.(8);
    } catch {
      /* not allowed: fine */
    }
  }, LONG_PRESS_MS);
  press = p;
}

/* ─── Global listeners (installed once) ─── */

function installGlobalListeners() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const opts = { capture: true, passive: true };

  window.addEventListener(
    'pointerdown',
    (e) => {
      activePointers.add(e.pointerId);
      if (activePointers.size > 1) cancelPress();
      if (e.pointerType === 'mouse') {
        // A press on the hovered element hides its card until the pointer leaves it
        if (hoverKey) suppressedKey = hoverKey;
        hideTip();
      } else {
        // Any new touch dismisses a long-press card ("tap elsewhere")
        cancelPress();
        if (!swallowClick) {
          // A tap on the board that only closes the card must not also place a
          // piece; taps on HUD buttons still go through
          if (shown?.mode === 'touch' && e.target?.closest?.('[data-board-surface]')) {
            swallowClick = true;
          }
          hideTip();
        }
      }
    },
    opts
  );

  window.addEventListener(
    'pointermove',
    (e) => {
      if (press && e.pointerId === press.pointerId && Math.hypot(e.clientX - press.x, e.clientY - press.y) > PRESS_SLOP_PX) {
        cancelPress();
      }
    },
    opts
  );

  const up = (e) => {
    activePointers.delete(e.pointerId);
    if (press && press.pointerId === e.pointerId) cancelPress();
    if (swallowClick) {
      // The click (if the browser sends one) follows the pointerup
      clearTimeout(swallowTimer);
      swallowTimer = setTimeout(() => {
        swallowClick = false;
      }, 350);
    }
  };
  window.addEventListener('pointerup', up, opts);
  window.addEventListener('pointercancel', up, opts);

  window.addEventListener(
    'click',
    (e) => {
      if (!swallowClick) return;
      swallowClick = false;
      clearTimeout(swallowTimer);
      e.stopPropagation();
      e.preventDefault();
    },
    true
  );

  // Long press on phones opens the context menu / callout: not on the board
  window.addEventListener(
    'contextmenu',
    (e) => {
      if (press || swallowClick || shown?.mode === 'touch') e.preventDefault();
    },
    true
  );

  // Zooming moves the board under a resting pointer: start over on the next move
  const reset = () => {
    hoverKey = null;
    hideTip();
  };
  window.addEventListener('wheel', reset, opts);
  window.addEventListener('blur', reset);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideTip();
  });
}

/** Board unmounted (2D ↔ 3D switch, leaving the game) */
export function resetTip() {
  cancelPress();
  hoverKey = null;
  suppressedKey = null;
  hideTip();
}

/* ─── 2D board: event delegation via data-tip="kind:id" ─── */

function targetFromDom(node) {
  const el = node?.closest?.('[data-tip]');
  if (!el) return null;
  const raw = el.getAttribute('data-tip');
  const i = raw.indexOf(':');
  return { kind: raw.slice(0, i), id: raw.slice(i + 1) };
}

/** Spread on the element wrapping the SVG board */
export const tipDomHandlers = {
  onPointerMove: (e) => hoverTip(targetFromDom(e.target), e),
  onPointerLeave: (e) => {
    if (e.pointerType !== 'touch') hoverTip(null, e);
  },
  onPointerDown: (e) => pressTip(targetFromDom(e.target), e),
};

/* ─── 3D board: R3F handlers, one stable set per target ─── */

const r3fCache = new Map();

/**
 * R3F pointer handlers for a mesh. Only the nearest interactive object under
 * the pointer claims the card (e.intersections[0]), so a piece wins over the
 * tile beneath it and a placement marker hides the tile's card.
 */
export function tipHandlers3D(kind, id) {
  const key = `${kind}:${id}`;
  let h = r3fCache.get(key);
  if (h) return h;
  const target = { kind, id: String(id) };
  const isTop = (e) => e.intersections?.[0]?.eventObject === e.eventObject;
  const move = (e) => {
    if (e.pointerType === 'touch') return;
    if (isTop(e)) hoverTip(target, e);
    else if (hoverKey === key) hoverTip(null, e);
  };
  h = {
    onPointerOver: move,
    onPointerMove: move,
    onPointerOut: (e) => leaveTip(target, e),
    onPointerDown: (e) => {
      if (isTop(e)) pressTip(target, e);
    },
  };
  if (r3fCache.size > 400) r3fCache.clear();
  r3fCache.set(key, h);
  return h;
}
