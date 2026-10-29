// «Cara del ladrón»: the host's browser finds a face in a photo (MediaPipe
// Face Landmarker) and sends a small square JPEG of it plus 468 landmarks.
// The server only checks the shape of that data and keeps it in the room's
// memory: it is never written to the database and goes away with the room.

export const FACE_LANDMARKS = 468;
export const FACE_POINT_VALUES = FACE_LANDMARKS * 3;
// x, y: 0…1000 across the square photo; z (depth): −1000…1000 in the same units
export const FACE_XY_MAX = 1000;
export const FACE_Z_MAX = 1000;
export const FACE_IMAGE_MAX_BYTES = 90 * 1024;
const JPEG_PREFIX = 'data:image/jpeg;base64,';
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** { face: { image, points } } when valid, otherwise { error } */
export function parseRobberFace({ image, points } = {}) {
  if (typeof image !== 'string' || !image.startsWith(JPEG_PREFIX)) return { error: 'Imagen no válida' };
  const b64 = image.slice(JPEG_PREFIX.length);
  // Base64 grows the data by 4/3: reject oversized strings before decoding
  if (b64.length > Math.ceil(FACE_IMAGE_MAX_BYTES / 3) * 4 || !BASE64_RE.test(b64)) {
    return { error: 'La imagen es demasiado grande' };
  }
  const bytes = Buffer.from(b64, 'base64');
  // A JPEG starts with FF D8 FF and ends with FF D9
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff ||
      bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    return { error: 'Imagen no válida' };
  }

  if (!Array.isArray(points) || points.length !== FACE_POINT_VALUES) return { error: 'Cara no válida' };
  for (let i = 0; i < points.length; i += 3) {
    const [x, y, z] = [points[i], points[i + 1], points[i + 2]];
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z) ||
        x < 0 || x > FACE_XY_MAX || y < 0 || y > FACE_XY_MAX || Math.abs(z) > FACE_Z_MAX) {
      return { error: 'Cara no válida' };
    }
  }
  return { face: { image, points: points.slice() } };
}
