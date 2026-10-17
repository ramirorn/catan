// Small helpers for the «Pacto de paz» UI (kept apart from the components)

import { PHASE, RESOURCE_NAMES } from '../../utils/constants';

export const PEACE_PACT_MAX_CARDS = 2;

export const cardsOf = (p) =>
  p?.totalResources ?? (p?.resources ? Object.values(p.resources).reduce((a, b) => a + b, 0) : 0);

/** «1 Trigo», «1 Madera y 1 Piedra», «2 Oveja» */
export function requestText(request) {
  const parts = Object.entries(request || {})
    .filter(([, n]) => n > 0)
    .map(([r, n]) => `${n} ${RESOURCE_NAMES[r] || r}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : parts[0] || '';
}

/** Players the mover may offer a pact to (seated, online, with cards) */
export function pactTargets(gameState, myPlayerId) {
  return (gameState?.playerOrder || [])
    .filter((pid) => pid !== myPlayerId)
    .map((pid) => gameState.players?.[pid])
    .filter((p) => p && !p.left && p.connected !== false && cardsOf(p) > 0);
}

/** May I offer a pact right now? (the server checks it again) */
export function canOfferPact(gameState, isMyTurn, myPlayerId) {
  return (
    !!gameState?.peacePacts &&
    gameState.phase === PHASE.ROBBER_MOVE &&
    isMyTurn &&
    !gameState.peacePact &&
    pactTargets(gameState, myPlayerId).length > 0
  );
}
