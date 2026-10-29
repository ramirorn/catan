// Turns the 468 face landmarks of «Cara del ladrón» into a 3D mask: the
// points become the vertices, a Delaunay triangulation of their front view
// joins them, and the photo is laid on top as the texture. Every client
// builds the same mesh from the same points, so only the points travel.

import Delaunator from 'delaunator';
import * as THREE from 'three';

export const FACE_LANDMARKS = 468;
// Brightness of the face's outline (it blends into the dark hood)
const EDGE_SHADE = 0.12;
// How much a vertex faces the camera of the photo (normal z): from SIDE_FROM
// (sideways, dark) to SIDE_TO (front, full photo)
const SIDE_FROM = 0.25;
const SIDE_TO = 0.7;

/**
 * points: [x, y, z, …] in 0…1000 across the square photo (y down, z: depth,
 * smaller = closer to the camera). The mask is 1 unit wide, centred on x/y,
 * looking at +z, with its back (the ears) at z = 0.
 */
export function buildFaceGeometry(points) {
  const n = FACE_LANDMARKS;
  const flat = new Float64Array(n * 2);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = points[i * 3];
    const y = points[i * 3 + 1];
    flat[i * 2] = x;
    flat[i * 2 + 1] = y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, points[i * 3 + 2]);
  }
  const width = Math.max(1, maxX - minX);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const position = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    position[i * 3] = (points[i * 3] - cx) / width;
    position[i * 3 + 1] = -(points[i * 3 + 1] - cy) / width;
    position[i * 3 + 2] = (maxZ - points[i * 3 + 2]) / width;
    // Textures are flipped on upload: v = 1 is the top row of the photo
    uv[i * 2] = points[i * 3] / 1000;
    uv[i * 2 + 1] = 1 - points[i * 3 + 1] / 1000;
  }

  // Triangles over the front view; the outline of the face is its convex hull
  const delaunay = new Delaunator(flat);
  const tris = delaunay.triangles;
  const index = new Uint16Array(tris.length);
  // Delaunator winds them in y-down space; flipping y reverses them, so check
  // the summed normal and keep the front faces looking at +z
  let facing = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
    const abx = position[b * 3] - position[a * 3];
    const aby = position[b * 3 + 1] - position[a * 3 + 1];
    const acx = position[c * 3] - position[a * 3];
    const acy = position[c * 3 + 1] - position[a * 3 + 1];
    facing += abx * acy - aby * acx;
  }
  for (let t = 0; t < tris.length; t += 3) {
    index[t] = tris[t];
    index[t + 1] = facing >= 0 ? tris[t + 1] : tris[t + 2];
    index[t + 2] = facing >= 0 ? tris[t + 2] : tris[t + 1];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();

  // One photo only shows the front: wherever the surface turns sideways (the
  // sides of the cheeks and jaw) its pixels are stretched, so those parts
  // fade into the hood's dark colour, and the outline is fully dark
  const normal = geo.attributes.normal.array;
  const color = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, (normal[i * 3 + 2] - SIDE_FROM) / (SIDE_TO - SIDE_FROM)));
    color.fill(EDGE_SHADE + (1 - EDGE_SHADE) * t * t * (3 - 2 * t), i * 3, i * 3 + 3);
  }
  for (const i of delaunay.hull) color.fill(EDGE_SHADE, i * 3, i * 3 + 3);
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.computeBoundingSphere();
  // Height / width of this face (to fit it under the hat)
  geo.userData.aspect = (maxY - minY) / width;
  return geo;
}
