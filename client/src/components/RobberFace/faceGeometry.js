// Turns the 468 face landmarks of «Cara del ladrón» into a 3D mask: the
// points become the vertices of MediaPipe's own face mesh (faceTopology.js)
// and the photo is laid on top as the texture. Every client builds the same
// mesh from the same points, so only the points travel.

import * as THREE from 'three';
import { FACE_OUTLINE, FACE_TRIANGLES } from './faceTopology';

export const FACE_LANDMARKS = 468;
// Brightness of the face's outline (it blends into the dark hood)
const EDGE_SHADE = 0.12;
// How much a vertex faced the camera in the photo (normal z): from SIDE_FROM
// (sideways or hidden: stretched pixels, dark) to SIDE_TO (full photo)
const SIDE_FROM = 0.2;
const SIDE_TO = 0.6;
// Landmarks that set the head's pose: outer eye corners, forehead and chin
const EYE_R = 33;
const EYE_L = 263;
const FOREHEAD = 10;
const CHIN = 152;

const smooth = (t) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

/** Per-vertex normals of `pos` (Float32Array xyz) over `index` */
function vertexNormals(pos, index) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  const normals = geo.attributes.normal.array;
  geo.dispose();
  return normals;
}

/**
 * points: [x, y, z, …] in 0…1000 across the square photo (y down, z: depth,
 * smaller = closer to the camera). The mask is 1 unit wide, centred on x/y,
 * looking at +z, with its back (the ears) at z = 0. A head turned in the
 * photo is turned back to face forward; what the photo could not see is dark.
 */
export function buildFaceGeometry(points) {
  const n = FACE_LANDMARKS;
  // The photo's own 3D space: x right, y up, z towards the camera
  const photo = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    photo[i * 3] = points[i * 3];
    photo[i * 3 + 1] = -points[i * 3 + 1];
    photo[i * 3 + 2] = -points[i * 3 + 2];
    // Textures are flipped on upload: v = 1 is the top row of the photo
    uv[i * 2] = points[i * 3] / 1000;
    uv[i * 2 + 1] = 1 - points[i * 3 + 1] / 1000;
  }

  // Wind every triangle so the face looks at the camera of the photo
  let facing = 0;
  const t = FACE_TRIANGLES;
  for (let k = 0; k < t.length; k += 3) {
    const [a, b, c] = [t[k] * 3, t[k + 1] * 3, t[k + 2] * 3];
    facing += (photo[b] - photo[a]) * (photo[c + 1] - photo[a + 1]) - (photo[b + 1] - photo[a + 1]) * (photo[c] - photo[a]);
  }
  const index = new Uint16Array(t.length);
  for (let k = 0; k < t.length; k += 3) {
    index[k] = t[k];
    index[k + 1] = facing >= 0 ? t[k + 1] : t[k + 2];
    index[k + 2] = facing >= 0 ? t[k + 2] : t[k + 1];
  }

  // What the photo saw well keeps its pixels; sideways / hidden parts (their
  // pixels are stretched or belong to something else) fade to dark
  const seen = vertexNormals(photo, index);
  const color = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const shade = EDGE_SHADE + (1 - EDGE_SHADE) * smooth((seen[i * 3 + 2] - SIDE_FROM) / (SIDE_TO - SIDE_FROM));
    color.fill(shade, i * 3, i * 3 + 3);
  }
  for (const i of FACE_OUTLINE) color.fill(EDGE_SHADE, i * 3, i * 3 + 3);

  // Head pose from the eyes, forehead and chin: turn the face to look forward
  const v = (i) => new THREE.Vector3(photo[i * 3], photo[i * 3 + 1], photo[i * 3 + 2]);
  const xAxis = v(EYE_L).sub(v(EYE_R)).normalize();
  const up = v(FOREHEAD).sub(v(CHIN));
  const yAxis = up.sub(xAxis.clone().multiplyScalar(up.dot(xAxis))).normalize();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  const front = new Float32Array(n * 3);
  const p = new THREE.Vector3();
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < n; i++) {
    p.set(photo[i * 3], photo[i * 3 + 1], photo[i * 3 + 2]);
    p.set(p.dot(xAxis), p.dot(yAxis), p.dot(zAxis));
    front.set([p.x, p.y, p.z], i * 3);
    min.min(p);
    max.max(p);
  }
  const width = Math.max(1e-6, max.x - min.x);
  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  for (let i = 0; i < n; i++) {
    front[i * 3] = (front[i * 3] - cx) / width;
    front[i * 3 + 1] = (front[i * 3 + 1] - cy) / width;
    front[i * 3 + 2] = (front[i * 3 + 2] - min.z) / width;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(front, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  // Height / width of this face (to fit the hood behind it)
  geo.userData.aspect = (max.y - min.y) / width;
  return geo;
}
