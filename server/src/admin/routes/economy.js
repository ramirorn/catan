// "Tienda y economía": shop overrides (price, on/off, sales), Ryō reward
// rules and economy numbers. Item definitions stay in shop/catalog.js.
import { getItem, publicCatalog } from '../../shop/catalog.js';
import { PRICE_MAX, SALE_MAX_PERCENT, SALE_MIN_PERCENT } from '../../shop/pricing.js';
import { REWARD_LIMITS, REWARD_RULES, cleanRewardRules } from '../../accounts/rewards.js';
import { AdminError } from '../service.js';

const SALE_MAX_DAYS = 60;
const STATS_TTL_MS = 30_000;

function intOf(v) {
  return typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
}

/**
 * Validates an override sent by the panel. Returns the row to store, or
 * null when it equals the catalogue item (nothing to override). Exported
 * for the tests.
 */
export function parseItemOverride(item, body, now = Date.now()) {
  if (!item || item.isDefault) throw new AdminError(400, 'Ese objeto no se puede cambiar');
  const b = body || {};
  let price = null;
  if (b.price !== null && b.price !== undefined && b.price !== '') {
    price = intOf(b.price);
    if (!Number.isInteger(price) || price < 1 || price > PRICE_MAX) throw new AdminError(400, `El precio debe ser un entero entre 1 y ${PRICE_MAX}`);
    if (price === item.price) price = null;
  }
  if (b.enabled !== undefined && typeof b.enabled !== 'boolean') throw new AdminError(400, 'Indica si está a la venta');
  const enabled = b.enabled !== false;
  let sale = { salePercent: null, saleStarts: null, saleEnds: null };
  if (b.sale) {
    const percent = intOf(b.sale.percent);
    if (!Number.isInteger(percent) || percent < SALE_MIN_PERCENT || percent > SALE_MAX_PERCENT) {
      throw new AdminError(400, `El descuento debe ser entre ${SALE_MIN_PERCENT} y ${SALE_MAX_PERCENT} %`);
    }
    const start = b.sale.startsAt ? new Date(b.sale.startsAt).getTime() : now;
    const end = new Date(b.sale.endsAt).getTime();
    if (!Number.isFinite(start)) throw new AdminError(400, 'Fecha de inicio no válida');
    if (!Number.isFinite(end) || end <= Math.max(start, now)) throw new AdminError(400, 'La oferta debe terminar en el futuro y después de empezar');
    if (end - start > SALE_MAX_DAYS * 86_400_000) throw new AdminError(400, `Una oferta dura como máximo ${SALE_MAX_DAYS} días`);
    sale = { salePercent: percent, saleStarts: new Date(start).toISOString(), saleEnds: new Date(end).toISOString() };
  }
  if (price === null && enabled && sale.salePercent === null) return null;
  return { price, enabled, ...sale };
}

export function registerEconomyRoutes(router, { accounts, runtime, economy, audit, handle }) {
  let statsCache = null;

  router.get('/economy', handle(async (req, res) => {
    const now = Date.now();
    const items = publicCatalog().filter((i) => !i.isDefault).map((i) => {
      const item = getItem(i.id);
      return { ...i, override: runtime.getOverride(i.id), effective: runtime.priceOf(item, now) };
    });
    let stats = null;
    if (economy) {
      if (!statsCache || req.query.fresh === '1' || now - statsCache.at > STATS_TTL_MS) {
        statsCache = { at: now, data: await economy.economyStats() };
      }
      stats = statsCache.data;
    }
    res.json({
      now,
      items,
      rewards: { current: runtime.getRewardRules(), defaults: REWARD_RULES, limits: REWARD_LIMITS },
      stats,
      statsAt: statsCache ? statsCache.at : null,
      accounts: !!(accounts && accounts.enabled),
    });
  }));

  router.post('/economy/items/:id', handle(async (req, res) => {
    const item = getItem(req.params.id);
    if (!item) throw new AdminError(404, 'Ese objeto no existe en el catálogo');
    const before = runtime.getOverride(item.id);
    const reset = req.body && req.body.reset === true;
    const next = reset ? null : parseItemOverride(item, req.body);
    const saved = await runtime.setShopOverride(item.id, next, req.admin.id);
    statsCache = null;
    await audit(req, 'shop.item', 'item', item.id, {
      name: item.name,
      basePrice: item.price,
      before: before ? { price: before.price, enabled: before.enabled, salePercent: before.salePercent, saleEnds: before.saleEnds } : null,
      after: saved ? { price: saved.price, enabled: saved.enabled, salePercent: saved.salePercent, saleStarts: saved.saleStarts, saleEnds: saved.saleEnds } : null,
    });
    res.json({ success: true, override: saved, effective: runtime.priceOf(item) });
  }));

  router.post('/economy/rewards', handle(async (req, res) => {
    const body = req.body || {};
    const before = runtime.getRewardRules();
    let after;
    if (body.reset === true) {
      after = await runtime.setRewardRules(null, req.admin.id);
    } else {
      const { rules, error } = cleanRewardRules(body);
      if (error) throw new AdminError(400, error);
      if (!Object.keys(rules).length) throw new AdminError(400, 'No hay cambios');
      after = await runtime.setRewardRules(rules, req.admin.id);
    }
    const pick = (r) => ({ finish: r.finish, win: r.win, perVp: r.perVp, minVoteMinutes: r.minVoteMinutes });
    await audit(req, 'economy.rewards', 'server', null, { reset: body.reset === true, before: pick(before), after: pick(after) });
    res.json({ success: true, rewards: after });
  }));
}
