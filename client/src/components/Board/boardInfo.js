// Pure builders for the board info cards: (gameState, …) → plain data.
// Both the 2D and the 3D board show exactly what these return.

import { RESOURCE_NAMES } from '../../utils/constants';
import { pactProtectedId } from './boardActions';

export const TERRAIN_NAMES = {
  forest: 'Bosque',
  hills: 'Colinas',
  pasture: 'Pastos',
  fields: 'Campos de cultivo',
  mountains: 'Montañas',
  desert: 'Desierto',
};

/** Ways to roll n with two dice (out of 36) */
export function rollWays(n) {
  if (!n || n < 2 || n > 12 || n === 7) return 0;
  return 6 - Math.abs(7 - n);
}

export function rollOdds(n) {
  const ways = rollWays(n);
  return { ways, pct: Math.round((ways / 36) * 100) };
}

function playerRef(gameState, playerId) {
  const p = gameState?.players?.[playerId];
  return { id: playerId, name: p?.name || 'Ninja', color: p?.color || null };
}

export function hexInfo(gameState, hexId) {
  const board = gameState?.board;
  const hex = board?.hexes?.[hexId];
  if (!hex) return null;
  const desert = hex.terrain === 'desert' || !hex.resource;

  // Who collects: buildings on its corners (settlement 1, city 2)
  const byPlayer = new Map();
  for (const v of Object.values(board.vertices || {})) {
    const b = v.building;
    if (!b || !v.adjacentHexes?.includes(hex.id)) continue;
    let row = byPlayer.get(b.playerId);
    if (!row) {
      row = { ...playerRef(gameState, b.playerId), settlements: 0, cities: 0, amount: 0 };
      byPlayer.set(b.playerId, row);
    }
    if (b.type === 'city') {
      row.cities += 1;
      row.amount += 2;
    } else {
      row.settlements += 1;
      row.amount += 1;
    }
  }

  return {
    kind: 'hex',
    terrain: hex.terrain,
    terrainName: TERRAIN_NAMES[hex.terrain] || hex.terrain,
    resource: desert ? null : hex.resource,
    resourceName: desert ? null : RESOURCE_NAMES[hex.resource] || hex.resource,
    number: hex.number || null,
    ...rollOdds(hex.number),
    robber: !!hex.hasRobber,
    desert,
    collectors: [...byPlayer.values()].sort((a, b) => b.amount - a.amount),
    // A signed peace pact keeps the robber away from its player's hexes
    // (not the desert: the renegade robs nobody there, so it stays open)
    pactProtected: (() => {
      const pid = pactProtectedId(gameState);
      return pid && !desert && byPlayer.has(pid) ? playerRef(gameState, pid) : null;
    })(),
  };
}

export function portInfo(gameState, myPlayerId, portIndex) {
  const board = gameState?.board;
  const port = board?.ports?.[Number(portIndex)];
  if (!port) return null;
  const generic = port.type === 'generic' || !RESOURCE_NAMES[port.type];
  const resourceName = generic ? null : RESOURCE_NAMES[port.type];
  const owners = (port.vertices || [])
    .map((vk) => board.vertices?.[vk]?.building?.playerId)
    .filter(Boolean);
  const mine = myPlayerId != null && owners.includes(myPlayerId);
  const others = [...new Set(owners.filter((id) => id !== myPlayerId))].map((id) => playerRef(gameState, id));

  return {
    kind: 'port',
    type: port.type,
    generic,
    ratio: port.ratio,
    title: `${port.ratio}:1 · ${generic ? 'cualquier recurso' : resourceName}`,
    explain: generic
      ? `Cambia ${port.ratio} cartas iguales por 1 del banco`
      : `Cambia ${port.ratio} de ${resourceName} por 1 carta a elegir del banco`,
    mine,
    others,
  };
}

export function vertexInfo(gameState, myPlayerId, vertexId) {
  const board = gameState?.board;
  const v = board?.vertices?.[vertexId];
  if (!v?.building) return null;
  const city = v.building.type === 'city';
  const amount = city ? 2 : 1;
  const hexes = (v.adjacentHexes || [])
    .map((id) => board.hexes?.[id])
    .filter(Boolean)
    .map((h) => {
      const desert = h.terrain === 'desert' || !h.resource;
      return {
        id: h.id,
        terrainName: TERRAIN_NAMES[h.terrain] || h.terrain,
        resource: desert ? null : h.resource,
        resourceName: desert ? null : RESOURCE_NAMES[h.resource] || h.resource,
        number: h.number || null,
        ways: rollWays(h.number),
        robber: !!h.hasRobber,
        desert,
      };
    })
    // Producing tiles first, best odds first
    .sort((a, b) => (b.desert ? -1 : b.ways) - (a.desert ? -1 : a.ways));

  const port = v.port
    ? {
        ratio: v.port.ratio,
        label: `${v.port.ratio}:1 · ${RESOURCE_NAMES[v.port.type] || 'cualquier recurso'}`,
      }
    : null;

  return {
    kind: 'vertex',
    owner: playerRef(gameState, v.building.playerId),
    mine: myPlayerId != null && v.building.playerId === myPlayerId,
    city,
    typeName: city ? 'Ciudad' : 'Poblado',
    amount,
    hexes,
    port,
  };
}

export function tipInfo(gameState, myPlayerId, target) {
  if (!target) return null;
  if (target.kind === 'hex') return hexInfo(gameState, target.id);
  if (target.kind === 'port') return portInfo(gameState, myPlayerId, target.id);
  if (target.kind === 'vertex') return vertexInfo(gameState, myPlayerId, target.id);
  return null;
}
