// Banned-words filter for the chat and display names. Pure functions: the
// list itself lives in app_settings ('banned_words') and is edited from the
// "Moderación" tab.
//
// Matching is per word: accents and case are ignored, simple leetspeak is
// undone (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s) and stretched letters
// still match ("puuuta" = "puta", but "foro" is not "forro"). A word also
// matches its plural (-s / -es).
// Whole words only, so "computadora" never trips on a banned word inside it.

export const DEFAULT_BANNED_WORDS = [
  'puta', 'puto', 'mierda', 'pendejo', 'pelotudo', 'forro', 'culiao', 'hijueputa', 'hdp',
  'maricon', 'marica', 'imbecil', 'gilipollas', 'cabron', 'zorra', 'verga', 'pija', 'mogolico',
  'retrasado', 'nazi',
];
export const BANNED_WORDS_MAX = 300;
export const BANNED_WORD_MAX_LENGTH = 30;
export const MASK = '***';

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
// Letters plus the leetspeak characters; any other digit splits words
// ("Pendejo99" → "Pendejo" + "99")
const TOKEN_RE = /[\p{L}\p{M}013457@$]+/gu;

/** "Púta" → "puta", "m1erd4" → "mierda" (ñ → n). Not a word → '' */
export function normalizeWord(value) {
  const base = String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[0-9@$]/g, (c) => LEET[c] || c);
  return /^[a-z]+$/.test(base) ? base : '';
}

// "forrro" → [['f',1],['o',1],['r',3],['o',1]]
function runs(word) {
  const out = [];
  for (const c of word) {
    const last = out[out.length - 1];
    if (last && last[0] === c) last[1] += 1;
    else out.push([c, 1]);
  }
  return out;
}

// Same letters in the same order, each run at least as long as the word's
function stretches(tokenRuns, wordRuns) {
  if (tokenRuns.length !== wordRuns.length) return false;
  return wordRuns.every(([c, n], i) => tokenRuns[i][0] === c && tokenRuns[i][1] >= n);
}

/** Clean, normalized, unique list (invalid entries dropped) */
export function cleanWordList(words) {
  const out = [];
  const seen = new Set();
  for (const w of Array.isArray(words) ? words : []) {
    if (typeof w !== 'string' || w.trim().length > BANNED_WORD_MAX_LENGTH) continue;
    const n = normalizeWord(w.trim());
    if (n.length < 2 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= BANNED_WORDS_MAX) break;
  }
  return out;
}

/** filter(text) → { text, changed } with every banned word replaced by *** */
export function createWordFilter(words) {
  // collapsed form ("foro") → run lists of the banned words with that shape
  const byShape = new Map();
  for (const w of cleanWordList(words)) {
    const r = runs(w);
    const key = r.map(([c]) => c).join('');
    if (!byShape.has(key)) byShape.set(key, []);
    byShape.get(key).push(r);
  }
  const matches = (n) => {
    const r = runs(n);
    const list = byShape.get(r.map(([c]) => c).join(''));
    return !!list && list.some((wr) => stretches(r, wr));
  };
  const banned = (token) => {
    const n = normalizeWord(token);
    if (!n) return false;
    if (matches(n)) return true;
    if (n.length > 3 && n.endsWith('es') && matches(n.slice(0, -2))) return true;
    return n.length > 2 && n.endsWith('s') && matches(n.slice(0, -1));
  };
  return function filter(text) {
    if (typeof text !== 'string' || !text || !byShape.size) return { text: text || '', changed: false };
    let changed = false;
    const out = text.replace(TOKEN_RE, (token) => {
      if (!banned(token)) return token;
      changed = true;
      return MASK;
    });
    return { text: out, changed };
  };
}
