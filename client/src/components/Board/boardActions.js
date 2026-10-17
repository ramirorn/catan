// Placement rules shared by the 2D (SVG) and 3D boards, so both decide
// "is this spot clickable / what happens on click" in exactly the same way.
// `game` is the value returned by useGame().

import { PHASE } from '../../utils/constants';

export function isSetupPhase(phase) {
  return phase === PHASE.SETUP_FORWARD || phase === PHASE.SETUP_REVERSE;
}

/** What clicking this vertex would do: 'setupSettlement' | 'settlement' | 'city' | null */
export function vertexActionFor(game, vertexId) {
  const { gameState, isMyTurn, canActOnBoard, buildMode } = game;
  const isSetup = isSetupPhase(gameState?.phase);
  const validSettlements = gameState?.validPlacements?.validSettlements || [];
  const validCities = gameState?.validPlacements?.validCities || [];

  if (isSetup && isMyTurn && validSettlements.includes(vertexId)) return 'setupSettlement';
  if (!isSetup && canActOnBoard && buildMode === 'settlement' && validSettlements.includes(vertexId)) return 'settlement';
  if (!isSetup && canActOnBoard && buildMode === 'city' && validCities.includes(vertexId)) return 'city';
  return null;
}

export function runVertexAction(game, action, vertexId) {
  if (action === 'setupSettlement') game.setupPlaceSettlement(vertexId);
  else if (action === 'settlement') game.buildSettlement(vertexId);
  else if (action === 'city') game.buildCity(vertexId);
}

/** What clicking this edge would do: 'setupRoad' | 'road' | null */
export function edgeActionFor(game, edgeId) {
  const { gameState, isMyTurn, canActOnBoard, buildMode } = game;
  const isSetup = isSetupPhase(gameState?.phase);
  const validRoads = gameState?.validPlacements?.validRoads || [];

  if (isSetup && isMyTurn && validRoads.includes(edgeId)) return 'setupRoad';
  if (!isSetup && canActOnBoard && buildMode === 'road' && validRoads.includes(edgeId)) return 'road';
  return null;
}

export function runEdgeAction(game, action, edgeId) {
  if (action === 'setupRoad') game.setupPlaceRoad(edgeId);
  else if (action === 'road') game.buildRoad(edgeId);
}

/** The robber may be moved onto this hex by me right now */
export function canMoveRobberTo(game, hex) {
  const gs = game.gameState;
  if (gs?.phase !== PHASE.ROBBER_MOVE || !game.isMyTurn || hex.hasRobber) return false;
  // Waiting for the answer to a peace pact: the robber stays put meanwhile
  if (gs.peacePact?.status === 'pending') return false;
  // The server lists the legal hexes (a signed pact protects its player)
  return !Array.isArray(gs.robberHexes) || gs.robberHexes.includes(hex.id);
}

/** Player protected by a peace pact signed in this robber move (or null) */
export function pactProtectedId(gameState) {
  const p = gameState?.peacePact;
  return p?.status === 'accepted' && gameState?.phase === PHASE.ROBBER_MOVE ? p.toId : null;
}
