export const SQRT3 = Math.sqrt(3);
export const HEX_SIZE = 60;

export const HEX_CORNER_OFFSETS = [
  { x: 0, y: -1 },
  { x: SQRT3 / 2, y: -0.5 },
  { x: SQRT3 / 2, y: 0.5 },
  { x: 0, y: 1 },
  { x: -SQRT3 / 2, y: 0.5 },
  { x: -SQRT3 / 2, y: -0.5 },
];

/**
 * Generates polygon points string for SVG <polygon>
 */
export function getHexPoints(centerX, centerY, size = HEX_SIZE) {
  return HEX_CORNER_OFFSETS.map(
    (offset) => `${(centerX + offset.x * size).toFixed(1)},${(centerY + offset.y * size).toFixed(1)}`
  ).join(' ');
}

/** Union of hexagons of the given radius as one SVG path (one shape, one paint) */
export function hexUnionPath(hexList, size) {
  return hexList.map((h) => `M${getHexPoints(h.x, h.y, size).replace(/ /g, 'L')}Z`).join('');
}

/**
 * Compute the bounding box of the board to set an optimal viewBox
 */
export function computeBoardBounds(hexes, padding = 120) {
  const hexList = Object.values(hexes || {});
  if (hexList.length === 0) {
    return { minX: -300, minY: -300, width: 600, height: 600 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const hex of hexList) {
    for (const offset of HEX_CORNER_OFFSETS) {
      const px = hex.x + offset.x * HEX_SIZE;
      const py = hex.y + offset.y * HEX_SIZE;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }

  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Returns dice probability dots (number of dots corresponds to how likely the roll is)
 */
export function getDiceDots(num) {
  const dotsCount = {
    2: 1,
    3: 2,
    4: 3,
    5: 4,
    6: 5,
    8: 5,
    9: 4,
    10: 3,
    11: 2,
    12: 1,
  };
  const count = dotsCount[num] || 0;
  return '•'.repeat(count);
}
