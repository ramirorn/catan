// «Cara del ladrón»: finds the face in a photo, right in this browser, with
// MediaPipe Face Landmarker. The model (~4 MB) and its WebAssembly runtime
// (~13 MB) are only downloaded the first time someone uses this, never with
// the game. The photo itself never leaves the browser until the host sends
// the small cropped face to their room.

import { FACE_LANDMARKS } from './faceGeometry';

const TASKS_VERSION = '1.1.1';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Longest side of the photo given to the detector
const DETECT_MAX = 1024;
// The face is sent as a square JPEG of this size
export const FACE_TEXTURE_PX = 256;
const JPEG_QUALITY = 0.85;
// Room around the landmarks, so the jaw and forehead are not cut
const CROP_MARGIN = 0.1;
// The server refuses bigger images (server/src/socket/robberFace.js)
const MAX_DATA_URL = 118000;

let landmarkerPromise = null;

function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 1,
      });
    })().catch((err) => {
      // A failed download can be retried with the next photo
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/** Starts downloading the detector early (when the dialog opens) */
export function preloadFaceDetector() {
  return loadLandmarker().then(() => true, () => false);
}

async function readPhoto(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Elige una imagen (JPG, PNG o WebP)');
  if (file.size > 15 * 1024 * 1024) throw new Error('La imagen pesa demasiado (máximo 15 MB)');
  try {
    // from-image: phone photos come out the right way up
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No se pudo abrir esa imagen');
  }
}

function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Photo file → { image: JPEG data URL, points: [x, y, z, …] } with 468 face
 * landmarks in 0…1000 across the square image (z: depth, same units).
 * Throws an Error with a message for the player when there is no usable face.
 */
export async function captureFace(file) {
  const [photo, landmarker] = await Promise.all([
    readPhoto(file),
    loadLandmarker().catch(() => {
      throw new Error('No se pudo descargar el detector de caras. Revisa tu conexión e inténtalo de nuevo.');
    }),
  ]);

  const k = Math.min(1, DETECT_MAX / Math.max(photo.width, photo.height));
  const w = Math.round(photo.width * k);
  const h = Math.round(photo.height * k);
  const src = canvasOf(w, h);
  src.getContext('2d').drawImage(photo, 0, 0, w, h);
  photo.close?.();

  const result = landmarker.detect(src);
  const marks = result.faceLandmarks?.[0];
  if (!marks || marks.length < FACE_LANDMARKS) {
    throw new Error('No encontramos ninguna cara. Prueba con una foto de frente y con buena luz.');
  }

  // Square crop around the face
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < FACE_LANDMARKS; i++) {
    const x = marks[i].x * w;
    const y = marks[i].y * h;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX - minX < 40) throw new Error('La cara es muy pequeña en esa foto. Acércate más o recórtala.');
  const size = Math.max(maxX - minX, maxY - minY) * (1 + CROP_MARGIN * 2);
  const x0 = (minX + maxX) / 2 - size / 2;
  const y0 = (minY + maxY) / 2 - size / 2;

  const out = canvasOf(FACE_TEXTURE_PX, FACE_TEXTURE_PX);
  const ctx = out.getContext('2d');
  // Outside the photo (a face near the edge) stays a neutral skin-ish grey
  ctx.fillStyle = '#8a7f76';
  ctx.fillRect(0, 0, FACE_TEXTURE_PX, FACE_TEXTURE_PX);
  ctx.drawImage(src, x0, y0, size, size, 0, 0, FACE_TEXTURE_PX, FACE_TEXTURE_PX);

  let image = out.toDataURL('image/jpeg', JPEG_QUALITY);
  for (let q = JPEG_QUALITY - 0.1; image.length > MAX_DATA_URL && q > 0.3; q -= 0.1) {
    image = out.toDataURL('image/jpeg', q);
  }
  if (image.length > MAX_DATA_URL) throw new Error('No se pudo reducir la imagen lo suficiente');

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));
  const points = [];
  for (let i = 0; i < FACE_LANDMARKS; i++) {
    const m = marks[i];
    points.push(
      clamp(((m.x * w - x0) / size) * 1000, 0, 1000),
      clamp(((m.y * h - y0) / size) * 1000, 0, 1000),
      // z is given in (roughly) the photo's width units
      clamp(((m.z * w) / size) * 1000, -1000, 1000),
    );
  }
  return { image, points };
}
