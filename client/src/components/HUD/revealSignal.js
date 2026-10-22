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

/** My resources as they should look right now (a pending payout hidden) */
export function hidePayout(resources, pending) {
  if (!pending || !resources) return resources;
  const shown = { ...resources };
  for (const [res, n] of Object.entries(pending)) shown[res] = Math.max(0, (shown[res] || 0) - n);
  return shown;
}

export const payoutCount = (pending) => (pending ? Object.values(pending).reduce((a, n) => a + n, 0) : 0);
