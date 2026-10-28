// Live settings changed from the admin panel that the game reads all the
// time: banned words (chat + names), Ryō reward rules, shop overrides and
// the weekly ranking reset. Reads are synchronous (memory); the values come
// from Postgres (app_settings + shop_item_overrides), are written through on
// every change and reloaded in the background after `ttlMs`, so a change
// never needs a deploy. Without a database everything lives in memory.
import { DEFAULT_BANNED_WORDS, cleanWordList, createWordFilter } from './wordFilter.js';
import { REWARD_RULES, cleanRewardRules, mergeRewardRules } from '../accounts/rewards.js';
import { priceInfo } from '../shop/pricing.js';

const DEFAULT_TTL_MS = 30_000;

function toOverride(r) {
  return {
    itemId: r.item_id,
    price: r.price,
    enabled: r.enabled,
    salePercent: r.sale_percent,
    saleStarts: r.sale_starts ? new Date(r.sale_starts).toISOString() : null,
    saleEnds: r.sale_ends ? new Date(r.sale_ends).toISOString() : null,
    updatedAt: r.updated_at,
  };
}

export function createRuntime({ pool = null, ttlMs = DEFAULT_TTL_MS } = {}) {
  let words = null; // null = the default list
  let filter = createWordFilter(DEFAULT_BANNED_WORDS);
  let rewards = {}; // only the keys changed by an admin
  let overrides = new Map(); // itemId → override
  let weekResetAt = null; // ISO string
  let loadedAt = 0;
  let loading = null;
  // Bumped by every local change: a background load that started before it
  // must not overwrite the newer value with what it read
  let version = 0;

  function applyWords(list) {
    words = list;
    filter = createWordFilter(list || DEFAULT_BANNED_WORDS);
  }

  async function load() {
    if (!pool) return;
    if (loading) return loading;
    loading = (async () => {
      const startedAt = version;
      try {
        const [settings, ov] = await Promise.all([
          pool.query(`SELECT key, value FROM app_settings WHERE key IN ('banned_words', 'rewards', 'ranking')`),
          pool.query('SELECT * FROM shop_item_overrides'),
        ]);
        if (version !== startedAt) return;
        const byKey = new Map(settings.rows.map((r) => [r.key, r.value]));
        const w = byKey.get('banned_words');
        applyWords(w && Array.isArray(w.words) ? cleanWordList(w.words) : null);
        rewards = cleanRewardRules(byKey.get('rewards')).rules;
        const rk = byKey.get('ranking');
        weekResetAt = rk && typeof rk.weekResetAt === 'string' ? rk.weekResetAt : null;
        overrides = new Map(ov.rows.map((r) => [r.item_id, toOverride(r)]));
        loadedAt = Date.now();
      } catch (err) {
        console.warn('Could not load the admin settings:', err.message);
        loadedAt = Date.now(); // retry after the TTL, not on every read
      } finally {
        loading = null;
      }
    })();
    return loading;
  }

  // Background refresh (other server instances / manual SQL changes)
  function touch() {
    if (pool && !loading && Date.now() - loadedAt > ttlMs) load();
  }

  async function writeSetting(key, value, adminId) {
    version += 1;
    if (!pool) return;
    if (value === null) {
      await pool.query('DELETE FROM app_settings WHERE key = $1', [key]);
      return;
    }
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, now(), $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [key, JSON.stringify(value), adminId || null],
    );
  }

  // ─── Banned words ───
  function getBannedWords() {
    touch();
    return { words: words || cleanWordList(DEFAULT_BANNED_WORDS), isDefault: words === null, defaults: cleanWordList(DEFAULT_BANNED_WORDS) };
  }

  /** filterText('...') → { text, changed } */
  function filterText(text) {
    touch();
    return filter(text);
  }

  /** list = array of words, or null to go back to the default list */
  async function setBannedWords(list, adminId) {
    const clean = list === null ? null : cleanWordList(list);
    await writeSetting('banned_words', clean === null ? null : { words: clean }, adminId);
    applyWords(clean);
    return getBannedWords();
  }

  // ─── Ryō rewards ───
  function getRewardRules() {
    touch();
    return mergeRewardRules(rewards);
  }

  /** rules = { finish, win, perVp, minVoteMinutes } (validated by the caller) or null = defaults */
  async function setRewardRules(rules, adminId) {
    const next = rules === null ? {} : cleanRewardRules({ ...rewards, ...rules }).rules;
    // Only what differs from the defaults is stored
    for (const k of Object.keys(next)) if (next[k] === REWARD_RULES[k]) delete next[k];
    await writeSetting('rewards', Object.keys(next).length ? next : null, adminId);
    rewards = next;
    return getRewardRules();
  }

  // ─── Shop ───
  function getOverride(itemId) {
    touch();
    return overrides.get(itemId) || null;
  }

  function listOverrides() {
    touch();
    return [...overrides.values()];
  }

  /** Effective price of a catalogue item right now (see shop/pricing.js) */
  function priceOf(item, now = Date.now()) {
    return priceInfo(item, getOverride(item.id), now);
  }

  /** override = { price|null, enabled, salePercent|null, saleStarts, saleEnds } or null = remove */
  async function setShopOverride(itemId, override, adminId) {
    version += 1;
    if (pool) {
      if (override === null) {
        await pool.query('DELETE FROM shop_item_overrides WHERE item_id = $1', [itemId]);
      } else {
        const { rows } = await pool.query(
          `INSERT INTO shop_item_overrides (item_id, price, enabled, sale_percent, sale_starts, sale_ends, updated_at, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
           ON CONFLICT (item_id) DO UPDATE SET price = EXCLUDED.price, enabled = EXCLUDED.enabled,
             sale_percent = EXCLUDED.sale_percent, sale_starts = EXCLUDED.sale_starts, sale_ends = EXCLUDED.sale_ends,
             updated_at = now(), updated_by = EXCLUDED.updated_by
           RETURNING *`,
          [itemId, override.price, override.enabled, override.salePercent, override.saleStarts, override.saleEnds, adminId || null],
        );
        overrides.set(itemId, toOverride(rows[0]));
        return overrides.get(itemId);
      }
    }
    if (override === null) overrides.delete(itemId);
    else overrides.set(itemId, { itemId, ...override, updatedAt: new Date().toISOString() });
    return overrides.get(itemId) || null;
  }

  // ─── Ranking ───
  function getWeekResetAt() {
    touch();
    return weekResetAt;
  }

  async function setWeekResetAt(iso, adminId) {
    await writeSetting('ranking', iso ? { weekResetAt: iso } : null, adminId);
    weekResetAt = iso || null;
    return weekResetAt;
  }

  return {
    load,
    getBannedWords,
    filterText,
    setBannedWords,
    getRewardRules,
    setRewardRules,
    getOverride,
    listOverrides,
    priceOf,
    setShopOverride,
    getWeekResetAt,
    setWeekResetAt,
  };
}
