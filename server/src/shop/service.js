// Shop rules, independent of the database (tests use an in-memory store).
import { ADMIN_ITEM_IDS, DEFAULT_ITEMS, SLOTS, getItem, publicCatalog, sanitizeSlotItem } from './catalog.js';
import { priceInfo } from './pricing.js';

export class ShopError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const ITEM_ID_RE = /^[a-z]+:[a-z0-9-]{2,40}$/;

const ADMIN_ONLY_MESSAGE = 'Exclusivo del Consejo de la aldea';

/**
 * `pricing` (optional): { priceOf(item) → priceInfo } with the admin
 * overrides applied (admin/runtime.js); without it the catalogue prices.
 * `isAdmin` (optional): async (userId) → boolean. Admins see, own and may
 * equip the admin-only items; nobody can buy them.
 */
export function createShopService(store, { pricing = null, isAdmin = null } = {}) {
  const priceOf = (item) => (pricing ? pricing.priceOf(item) : priceInfo(item));
  const adminOf = async (userId) => {
    if (!userId || !isAdmin) return false;
    try {
      return !!(await isAdmin(userId));
    } catch {
      return false;
    }
  };

  /** Catalogue with the prices of right now; unavailable items only for their owners */
  function catalogFor(ownedIds, admin = false) {
    const out = [];
    for (const entry of publicCatalog({ admins: admin })) {
      const info = priceOf(getItem(entry.id));
      if (!info.available && !(ownedIds && ownedIds.includes(entry.id))) continue;
      out.push({ ...entry, ...info });
    }
    return out;
  }

  /** Owned ids (defaults included) and the equipped item of every slot */
  function shape(inv, admin = false) {
    const ownedSet = new Set(Object.values(DEFAULT_ITEMS));
    for (const id of inv ? inv.owned : []) {
      const item = getItem(id);
      // An admin-only item stays in the table after losing the role, unused
      if (item && (!item.adminOnly || admin)) ownedSet.add(id);
    }
    if (admin) ADMIN_ITEM_IDS.forEach((id) => ownedSet.add(id));
    const equipped = {};
    for (const slot of SLOTS) {
      const id = inv && inv.equipped ? inv.equipped[slot] : null;
      equipped[slot] = id && ownedSet.has(id) ? sanitizeSlotItem(slot, id) : DEFAULT_ITEMS[slot];
    }
    return { coins: inv ? inv.coins : 0, owned: [...ownedSet], equipped };
  }

  /** Catalogue + (when signed in) what the account owns and wears */
  async function view(userId) {
    if (!userId) {
      return { catalog: catalogFor(null), signedIn: false, coins: null, owned: Object.values(DEFAULT_ITEMS), equipped: { ...DEFAULT_ITEMS } };
    }
    const admin = await adminOf(userId);
    const inv = shape(await store.inventory(userId), admin);
    return { catalog: catalogFor(inv.owned, admin), signedIn: true, ...inv };
  }

  /** expectedPrice (optional): the price the player saw; a different one now → 409, nothing charged */
  async function buy(userId, itemId, expectedPrice = undefined) {
    if (typeof itemId !== 'string' || !ITEM_ID_RE.test(itemId)) throw new ShopError(400, 'Objeto no válido');
    const item = getItem(itemId);
    if (!item) throw new ShopError(404, 'Ese objeto no existe en la tienda');
    if (item.adminOnly) throw new ShopError(403, ADMIN_ONLY_MESSAGE);
    if (item.isDefault || item.price === 0) throw new ShopError(400, 'Ese objeto ya es tuyo');
    const info = priceOf(item);
    if (!info.available) throw new ShopError(410, 'Ese objeto ya no está a la venta');
    if (Number.isInteger(expectedPrice) && expectedPrice !== info.price) {
      throw new ShopError(409, `El precio cambió: ahora cuesta ${info.price} Ryō. Revísalo y vuelve a comprar.`, { priceChanged: true, price: info.price });
    }
    const r = await store.buy(userId, item.id, info.price, { listPrice: info.listPrice, salePercent: info.salePercent });
    if (r.status === 'nouser') throw new ShopError(401, 'Inicia sesión primero');
    if (r.status === 'insufficient') {
      throw new ShopError(402, `Te faltan ${Math.max(0, info.price - r.coins)} Ryō para comprarlo`, { coins: r.coins });
    }
    // 'owned' is idempotent: a repeated purchase never charges again
    return { itemId: item.id, coins: r.coins, alreadyOwned: r.status === 'owned', price: info.price };
  }

  async function equip(userId, slot, itemId) {
    if (!SLOTS.includes(slot)) throw new ShopError(400, 'Ranura no válida');
    if (typeof itemId !== 'string' || !ITEM_ID_RE.test(itemId)) throw new ShopError(400, 'Objeto no válido');
    const item = getItem(itemId);
    if (!item) throw new ShopError(404, 'Ese objeto no existe en la tienda');
    if (item.slot !== slot) throw new ShopError(400, 'Ese objeto no va en esa ranura');
    if (item.adminOnly) {
      if (!(await adminOf(userId))) throw new ShopError(403, ADMIN_ONLY_MESSAGE);
      // Admins own it without buying it: the row is written the first time
      await store.grant(userId, item.id);
    }
    const ok = await store.equip(userId, slot, item.isDefault ? null : item.id);
    if (!ok) throw new ShopError(403, 'Primero tienes que comprarlo');
    return { slot, itemId: item.id };
  }

  /** What a seat shows in game: { pieces, board } (defaults when unknown) */
  async function loadout(userId) {
    if (!userId) return { ...DEFAULT_ITEMS };
    return shape(await store.inventory(userId), await adminOf(userId)).equipped;
  }

  async function owns(userId, itemId) {
    const item = getItem(itemId);
    if (!item) return false;
    if (item.isDefault) return true;
    if (!userId) return false;
    return shape(await store.inventory(userId), await adminOf(userId)).owned.includes(item.id);
  }

  return { view, buy, equip, loadout, owns };
}
