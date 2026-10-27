// "Spoiler guard" for the cards of a dice roll. The server sends the new hand
// together with the roll, but the 3D dice still need a few seconds to land.
// Until ProductionModal opens the "Recursos recibidos" card (and calls
// revealPayout), every view of my hand subtracts that payout.
//
// It is computed during render from gameState.lastProduction, so not even one
// frame shows the new cards early. A payout that already existed when the
// page loaded (reconnect) counts as revealed.

import { useSyncExternalStore } from 'react';

let revealedId; // payout key last revealed; undefined until the first render
const listeners = new Set();

export function revealPayout(id) {
  if (id == null || revealedId === id) return;
  revealedId = id;
  for (const fn of [...listeners]) fn();
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const getRevealed = () => revealedId;

/** Room + payout id: payout ids restart at 1 in every new game */
export const payoutKey = (gameState) =>
  gameState?.lastProduction ? `${gameState.roomId}:${gameState.lastProduction.id}` : null;

/** The part of my latest payout that is still hidden (or null) */
export function usePendingPayout(gameState) {
  useSyncExternalStore(subscribe, getRevealed, getRevealed);
  const production = gameState?.lastProduction;
  const key = payoutKey(gameState);
  // First look at the game: whatever is there already is old news
  if (revealedId === undefined) revealedId = key;
  if (!production || key === revealedId || !production.mine) return null;
  return Object.values(production.mine).some((n) => n > 0) ? production.mine : null;
}

// ─── Robber steals (7 or Knight) ───
// The thief's new card and the victim's lost card change the hand as soon as
// the state arrives; they stay hidden until the "te robó / le robaste" notice
// shows (after the robber and steal animations).
let revealedSteal;

export function revealSteal(key) {
  if (key == null || revealedSteal === key) return;
  revealedSteal = key;
  for (const fn of [...listeners]) fn();
}

export const stealKey = (gameState) =>
  gameState?.lastSteal ? `${gameState.roomId}:${gameState.lastSteal.id}` : null;

const getRevealedSteal = () => revealedSteal;

/**
 * What to take off my hand right now: the unrevealed dice payout (cards to
 * hide) and an unrevealed steal (+1 to hide for the thief, −1 for the victim,
 * i.e. the lost card is still shown). `payout` alone is what the bank misses.
 */
export function useHandDelta(gameState, myPlayerId) {
  const payout = usePendingPayout(gameState);
  useSyncExternalStore(subscribe, getRevealedSteal, getRevealedSteal);
  const steal = gameState?.lastSteal;
  const key = stealKey(gameState);
  if (revealedSteal === undefined) revealedSteal = key;
  let delta = payout ? { ...payout } : null;
  if (steal && steal.resource && key !== revealedSteal && myPlayerId) {
    const sign = steal.thiefId === myPlayerId ? 1 : steal.victimId === myPlayerId ? -1 : 0;
    if (sign) {
      delta = delta || {};
      delta[steal.resource] = (delta[steal.resource] || 0) + sign;
    }
  }
  return { delta, payout };
}

/** My resources as they should look right now (a pending payout hidden) */
export function hidePayout(resources, pending) {
  if (!pending || !resources) return resources;
  const shown = { ...resources };
  // n > 0 hides cards just received; n < 0 still shows a card just lost
  for (const [res, n] of Object.entries(pending)) shown[res] = Math.max(0, (shown[res] || 0) - n);
  return shown;
}

export const payoutCount = (pending) => (pending ? Object.values(pending).reduce((a, n) => a + n, 0) : 0);
