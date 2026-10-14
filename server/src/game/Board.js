import {
  BOARD_CONFIGS, TERRAIN, TERRAIN_TO_RESOURCE, SQRT3,
  HEX_SIZE, HEX_CORNER_OFFSETS, HEX_DIRECTIONS,
} from './constants.js';

// ─── Utility: Fisher-Yates Shuffle ───
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Axial to pixel (pointy-top) ───
function axialToPixel(q, r, size = HEX_SIZE) {
  return {
    x: size * (SQRT3 * q + (SQRT3 / 2) * r),
    y: size * (1.5 * r),
  };
}

// ─── Round pixel position to create vertex key ───
function vertexKey(x, y) {
  return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
}

// ─── Edge key from two vertex keys (sorted for dedup) ───
function edgeKey(vk1, vk2) {
  return vk1 < vk2 ? `${vk1}|${vk2}` : `${vk2}|${vk1}`;
}

// ─── Generate hex positions for given radius ───
function generateHexPositions(radius) {
  const hexes = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      if (Math.abs(s) <= radius) {
        hexes.push({ q, r, s });
      }
    }
  }
  return hexes;
}

// ─── Check if hex is within board ───
function isHexInBoard(q, r, radius) {
  const s = -q - r;
  return Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(s) <= radius;
}

// ─── Board Class ───
export class Board {
  constructor(configName = 'standard') {
    const config = BOARD_CONFIGS[configName];
    if (!config) throw new Error(`Unknown board config: ${configName}`);

    this.config = config;
    this.radius = config.radius;
    this.hexes = {};       // key "q,r" → hex data
    this.vertices = {};    // key "x,y" → vertex data
    this.edges = {};       // key "vk1|vk2" → edge data
    this.ports = [];       // port objects
    this.robberHex = null; // "q,r" of desert

    this._generate();
  }

  _generate() {
    this._placeHexes();
    this._computeVerticesAndEdges();
    this._computeAdjacency();
    this._placePorts();
  }

  // ─── Place hex tiles with terrains and number tokens ───
  _placeHexes() {
    const positions = generateHexPositions(this.radius);
    const terrains = shuffle(this.config.terrains);
    const numbers = shuffle([...this.config.numberTokens]);

    // Extended (5-6 player) board: rows of 3-4-5-6-5-4-3 hexes, obtained by dropping
    // the last hex of every row of a radius-3 hexagon (37 → 30 hexes).
    let usedPositions = positions;
    if (terrains.length < positions.length) {
      usedPositions = positions.filter((pos) => pos.q !== Math.min(this.radius, this.radius - pos.r));
    }
    usedPositions = usedPositions.slice(0, terrains.length);

    usedPositions.forEach((pos, i) => {
      const key = `${pos.q},${pos.r}`;
      const terrain = terrains[i];
      const pixel = axialToPixel(pos.q, pos.r);

      this.hexes[key] = {
        id: key,
        q: pos.q,
        r: pos.r,
        s: pos.s,
        terrain,
        resource: TERRAIN_TO_RESOURCE[terrain],
        number: null,
        hasRobber: false,
        x: pixel.x,
        y: pixel.y,
      };

      // Robber starts on the (first) desert only
      if (terrain === TERRAIN.DESERT && !this.robberHex) {
        this.robberHex = key;
        this.hexes[key].hasRobber = true;
      }
    });

    // Assign number tokens to non-desert hexes
    const nonDesertKeys = Object.keys(this.hexes).filter(
      (k) => this.hexes[k].terrain !== TERRAIN.DESERT
    );

    // Shuffle and assign, trying to avoid adjacent 6 and 8
    let assigned = false;
    for (let attempt = 0; attempt < 100 && !assigned; attempt++) {
      const shuffledNums = shuffle(numbers);
      let valid = true;

      nonDesertKeys.forEach((k, i) => {
        this.hexes[k].number = shuffledNums[i];
      });

      // Check no adjacent 6-8
      for (const key of nonDesertKeys) {
        const hex = this.hexes[key];
        if (hex.number === 6 || hex.number === 8) {
          for (const dir of HEX_DIRECTIONS) {
            const nk = `${hex.q + dir.q},${hex.r + dir.r}`;
            if (this.hexes[nk] && (this.hexes[nk].number === 6 || this.hexes[nk].number === 8)) {
              valid = false;
              break;
            }
          }
        }
        if (!valid) break;
      }

      if (valid) assigned = true;
    }

    // If we couldn't find a valid placement in 100 tries, just use the last one
  }

  // ─── Compute unique vertices and edges from hex corners ───
  _computeVerticesAndEdges() {
    for (const hex of Object.values(this.hexes)) {
      const corners = HEX_CORNER_OFFSETS.map((off) => ({
        x: hex.x + off.x * HEX_SIZE,
        y: hex.y + off.y * HEX_SIZE,
      }));

      const cornerKeys = corners.map((c) => vertexKey(c.x, c.y));

      // Create vertices
      cornerKeys.forEach((vk, i) => {
        if (!this.vertices[vk]) {
          this.vertices[vk] = {
            id: vk,
            x: corners[i].x,
            y: corners[i].y,
            adjacentHexes: [],
            adjacentVertices: [],
            adjacentEdges: [],
            building: null,   // { type: 'settlement'|'city', playerId }
            port: null,       // { type, ratio }
          };
        }
        // Link hex to vertex
        if (!this.vertices[vk].adjacentHexes.includes(hex.id)) {
          this.vertices[vk].adjacentHexes.push(hex.id);
        }
      });

      // Create edges between consecutive corners
      for (let i = 0; i < 6; i++) {
        const ek = edgeKey(cornerKeys[i], cornerKeys[(i + 1) % 6]);
        if (!this.edges[ek]) {
          const v1 = this.vertices[cornerKeys[i]];
          const v2 = this.vertices[cornerKeys[(i + 1) % 6]];
          this.edges[ek] = {
            id: ek,
            vertices: [cornerKeys[i], cornerKeys[(i + 1) % 6]],
            x1: v1.x, y1: v1.y,
            x2: v2.x, y2: v2.y,
            road: null,  // { playerId }
            adjacentHexes: [],
          };
        }
        if (!this.edges[ek].adjacentHexes.includes(hex.id)) {
          this.edges[ek].adjacentHexes.push(hex.id);
        }
      }
    }
  }

  // ─── Compute vertex-to-vertex and vertex-to-edge adjacency ───
  _computeAdjacency() {
    for (const edge of Object.values(this.edges)) {
      const [vk1, vk2] = edge.vertices;

      // Vertices are adjacent to each other via this edge
      if (!this.vertices[vk1].adjacentVertices.includes(vk2)) {
        this.vertices[vk1].adjacentVertices.push(vk2);
      }
      if (!this.vertices[vk2].adjacentVertices.includes(vk1)) {
        this.vertices[vk2].adjacentVertices.push(vk1);
      }

      // Vertices are adjacent to this edge
      if (!this.vertices[vk1].adjacentEdges.includes(edge.id)) {
        this.vertices[vk1].adjacentEdges.push(edge.id);
      }
      if (!this.vertices[vk2].adjacentEdges.includes(edge.id)) {
        this.vertices[vk2].adjacentEdges.push(edge.id);
      }
    }
  }

  // ─── Place ports on boundary edges ───
  _placePorts() {
    // Find boundary edges (edges adjacent to only 1 hex)
    const boundaryEdges = Object.values(this.edges).filter(
      (e) => e.adjacentHexes.length === 1
    );

    // Sort boundary edges by angle from center for even distribution
    boundaryEdges.forEach((e) => {
      const mx = (e.x1 + e.x2) / 2;
      const my = (e.y1 + e.y2) / 2;
      e._angle = Math.atan2(my, mx);
    });
    boundaryEdges.sort((a, b) => a._angle - b._angle);

    // Pick evenly spaced edges for ports
    const portDefs = shuffle([...this.config.ports]);
    const numPorts = portDefs.length;
    const step = boundaryEdges.length / numPorts;

    for (let i = 0; i < numPorts; i++) {
      const edgeIndex = Math.floor(i * step);
      const edge = boundaryEdges[edgeIndex % boundaryEdges.length];
      const port = {
        type: portDefs[i].type,
        ratio: portDefs[i].ratio,
        edgeId: edge.id,
        vertices: edge.vertices,
        x: (edge.x1 + edge.x2) / 2,
        y: (edge.y1 + edge.y2) / 2,
      };

      this.ports.push(port);

      // Mark vertices as having this port
      for (const vk of edge.vertices) {
        this.vertices[vk].port = { type: port.type, ratio: port.ratio };
      }
    }
  }

  // ─── Get hexes that produce for a given dice roll ───
  getHexesForRoll(roll) {
    return Object.values(this.hexes).filter(
      (h) => h.number === roll && !h.hasRobber
    );
  }

  // ─── Get players adjacent to a hex ───
  getPlayersAdjacentToHex(hexId) {
    const playerIds = new Set();
    for (const vertex of Object.values(this.vertices)) {
      if (vertex.adjacentHexes.includes(hexId) && vertex.building) {
        playerIds.add(vertex.building.playerId);
      }
    }
    return [...playerIds];
  }

  // ─── Get buildings adjacent to a hex ───
  getBuildingsAdjacentToHex(hexId) {
    const buildings = [];
    for (const vertex of Object.values(this.vertices)) {
      if (vertex.adjacentHexes.includes(hexId) && vertex.building) {
        buildings.push({
          vertexId: vertex.id,
          ...vertex.building,
        });
      }
    }
    return buildings;
  }

  // ─── Check if vertex is valid for settlement placement ───
  canPlaceSettlement(vertexId, playerId, isSetup = false) {
    const vertex = this.vertices[vertexId];
    if (!vertex || vertex.building) return false;

    // Distance rule: no adjacent vertex has a building
    for (const adjVk of vertex.adjacentVertices) {
      if (this.vertices[adjVk].building) return false;
    }

    // During setup, no road required
    if (isSetup) return true;

    // Must have an adjacent road owned by this player
    for (const ek of vertex.adjacentEdges) {
      if (this.edges[ek].road && this.edges[ek].road.playerId === playerId) {
        return true;
      }
    }
    return false;
  }

  // ─── Check if edge is valid for road placement ───
  canPlaceRoad(edgeId, playerId, isSetup = false, setupVertexId = null) {
    const edge = this.edges[edgeId];
    if (!edge || edge.road) return false;

    // During setup, road must connect to the just-placed settlement
    if (isSetup && setupVertexId) {
      return edge.vertices.includes(setupVertexId);
    }

    // Must connect to player's existing road, settlement, or city
    for (const vk of edge.vertices) {
      const vertex = this.vertices[vk];

      // Player has a building here
      if (vertex.building && vertex.building.playerId === playerId) return true;

      // Player has an adjacent road (but only if no opponent building blocks)
      if (!vertex.building || vertex.building.playerId === playerId) {
        for (const adjEk of vertex.adjacentEdges) {
          if (adjEk !== edgeId && this.edges[adjEk].road &&
              this.edges[adjEk].road.playerId === playerId) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // ─── Check if vertex can be upgraded to city ───
  canUpgradeToCity(vertexId, playerId) {
    const vertex = this.vertices[vertexId];
    return vertex && vertex.building &&
      vertex.building.type === 'settlement' &&
      vertex.building.playerId === playerId;
  }

  // ─── Place building ───
  placeBuilding(vertexId, type, playerId) {
    this.vertices[vertexId].building = { type, playerId };
  }

  // ─── Place road ───
  placeRoad(edgeId, playerId) {
    this.edges[edgeId].road = { playerId };
  }

  // ─── Move robber ───
  moveRobber(hexId) {
    if (this.robberHex) {
      this.hexes[this.robberHex].hasRobber = false;
    }
    this.hexes[hexId].hasRobber = true;
    this.robberHex = hexId;
  }

  // ─── Calculate longest road for a player ───
  longestRoad(playerId) {
    const playerEdges = Object.values(this.edges).filter(
      (e) => e.road && e.road.playerId === playerId
    );

    if (playerEdges.length === 0) return 0;

    // Build adjacency graph of player's roads
    const graph = {}; // vertexKey → [edgeId]
    for (const edge of playerEdges) {
      for (const vk of edge.vertices) {
        if (!graph[vk]) graph[vk] = [];
        graph[vk].push(edge.id);
      }
    }

    // DFS from each vertex to find longest path
    let maxLen = 0;

    const dfs = (vertexKey, visited, length) => {
      maxLen = Math.max(maxLen, length);

      const edgesFromHere = graph[vertexKey] || [];
      for (const ek of edgesFromHere) {
        if (visited.has(ek)) continue;

        // Check if an opponent's building blocks the path
        const vertex = this.vertices[vertexKey];
        if (vertex.building && vertex.building.playerId !== playerId && length > 0) {
          continue;
        }

        const edge = this.edges[ek];
        const nextVertex = edge.vertices[0] === vertexKey ? edge.vertices[1] : edge.vertices[0];

        visited.add(ek);
        dfs(nextVertex, visited, length + 1);
        visited.delete(ek);
      }
    };

    for (const startVertex of Object.keys(graph)) {
      dfs(startVertex, new Set(), 0);
    }

    return maxLen;
  }

  // ─── Serialize board state for client ───
  serialize() {
    return {
      hexes: this.hexes,
      vertices: this.vertices,
      edges: this.edges,
      ports: this.ports,
      robberHex: this.robberHex,
      radius: this.radius,
    };
  }
}
