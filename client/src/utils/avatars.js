// Profile avatars: the server only stores an index (0 … AVATAR_COUNT-1);
// the art is drawn by the client (components/Shared/Avatar.jsx).

export const AVATAR_COUNT = 12;

// Generic archetype names (original characters, not canon ones)
export const AVATAR_NAMES = [
  'Ninja de la bandana',
  'Jōnin enmascarado',
  'Sombra del ojo rojo',
  'Kunoichi médica',
  'Ermitaño del sapo',
  'Kunoichi del viento',
  'Ninja de la arena',
  'Estratega perezoso',
  'Ninja de los insectos',
  'Kunoichi de mirada pálida',
  'Maestro del taijutsu',
  'ANBU enmascarado',
];

export const SPECTATOR_RING = '#7d7468';

const STORAGE_KEY = 'catan_avatar_id';

export function isAvatarId(v) {
  return Number.isInteger(v) && v >= 0 && v < AVATAR_COUNT;
}

export function avatarName(id) {
  return AVATAR_NAMES[isAvatarId(id) ? id : 0];
}

// The saved choice; the first time a random one is picked (and remembered)
export function loadAvatarId() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw == null ? NaN : Number(raw);
    if (isAvatarId(n)) return n;
  } catch {
    /* storage blocked: fall through to a random pick */
  }
  const pick = Math.floor(Math.random() * AVATAR_COUNT);
  saveAvatarId(pick);
  return pick;
}

export function saveAvatarId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* private mode / blocked storage: the choice lasts for this visit only */
  }
}
