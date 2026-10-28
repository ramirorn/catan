// Effective price of a catalogue item once the admin overrides are applied
// (shop_item_overrides): a new list price, enabled / disabled, and a
// temporary sale (% off between two dates). Pure: tests use it directly.

export const SALE_MIN_PERCENT = 5;
export const SALE_MAX_PERCENT = 90;
export const PRICE_MAX = 100000;

function ts(value) {
  if (value == null) return NaN;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : NaN;
}

/** Is the sale of an override running at `now`? */
export function saleActive(override, now = Date.now()) {
  if (!override || !Number.isInteger(override.salePercent)) return false;
  const start = ts(override.saleStarts);
  const end = ts(override.saleEnds);
  return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
}

/** Sale price: never below 1 Ryō for a paid item */
export function salePrice(listPrice, percent) {
  return Math.max(1, Math.round((listPrice * (100 - percent)) / 100));
}

/**
 * { price, basePrice, listPrice, salePercent, saleEndsAt, available } for an
 * item of catalog.js. Free default items ignore any override.
 */
export function priceInfo(item, override = null, now = Date.now()) {
  const basePrice = item.price;
  if (item.isDefault || basePrice === 0) {
    return { price: 0, basePrice, listPrice: 0, salePercent: null, saleEndsAt: null, available: true };
  }
  const listPrice = override && Number.isInteger(override.price) ? override.price : basePrice;
  const onSale = saleActive(override, now);
  return {
    price: onSale ? salePrice(listPrice, override.salePercent) : listPrice,
    basePrice,
    listPrice,
    salePercent: onSale ? override.salePercent : null,
    saleEndsAt: onSale ? new Date(ts(override.saleEnds)).toISOString() : null,
    available: !override || override.enabled !== false,
  };
}
