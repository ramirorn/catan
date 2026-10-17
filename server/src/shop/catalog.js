// Shop catalogue (server-authoritative): every item that can be bought with
// Ryō, its slot and its price. Item ids are stored in user_items /
// user_equipped and travel in the game state, so they never change once
// published. The client only draws what an id looks like.
//
// Earning rates for reference: +20 per finished game, +30 for a win, +2 per
// victory point → a typical game pays 30–70 Ryō.

export const SLOTS = ['pieces', 'board'];
export const DEFAULT_ITEMS = { pieces: 'pieces:classic', board: 'board:classic' };

const ITEMS = [
  // ─── Piece sets (settlement + city + road), seen by everyone in the game ───
  { id: 'pieces:classic', slot: 'pieces', price: 0, name: 'Clásico', description: 'Casitas y pagodas lacadas con puentes de tablas. Las de siempre.' },
  { id: 'pieces:temple', slot: 'pieces', price: 150, name: 'Templo de la Hoja', description: 'Templos de madera sobre pilotes con tejados curvos de tu color.' },
  { id: 'pieces:scrolls', slot: 'pieces', price: 200, name: 'Pergaminos sellados', description: 'Rollos de papel atados con tu sello. Los caminos se despliegan como pergaminos.' },
  { id: 'pieces:sand', slot: 'pieces', price: 250, name: 'Torres de la Arena', description: 'Torres de arenisca con cúpulas y murallas del desierto.' },
  { id: 'pieces:kunai', slot: 'pieces', price: 300, name: 'Kunai y Shuriken', description: 'Acero pulido: kunai clavados, un gran shuriken y hojas por caminos.' },
  { id: 'pieces:lantern', slot: 'pieces', price: 350, name: 'Linterna de Papel', description: 'Faroles de papel que brillan en tu color y linternas de piedra.' },
  { id: 'pieces:crimson', slot: 'pieces', price: 450, name: 'Nubes Carmesí', description: 'Fortalezas negras marcadas con nubes rojas. Para ninjas renegados.' },
  { id: 'pieces:toad', slot: 'pieces', price: 600, name: 'Sapo Ermitaño', description: 'Sapos sabios de tu color, un sapo gigante y piedras para saltar.' },

  // ─── Board themes: the host's choice is used for the whole room ───
  { id: 'board:classic', slot: 'board', price: 0, name: 'Clásico', description: 'Mar de olas seigaiha y pergamino de washi.' },
  { id: 'board:night', slot: 'board', price: 250, name: 'Noche de la Aldea Oculta', description: 'La isla bajo la luna: tonos índigo y mar oscuro.' },
  { id: 'board:desert', slot: 'board', price: 300, name: 'País de la Arena', description: 'Paleta cálida de desierto y un mar de dunas.' },
  { id: 'board:mist', slot: 'board', price: 300, name: 'País de la Niebla', description: 'Niebla fría sobre la isla y un marco gris perla.' },
  { id: 'board:valley', slot: 'board', price: 400, name: 'Valle del Fin', description: 'Piedra antigua, cascadas y un mar verde de río.' },
  { id: 'board:spring', slot: 'board', price: 500, name: 'Festival de Primavera', description: 'Pétalos de cerezo sobre el pergamino y el mar.' },
];

for (const item of ITEMS) {
  if (!SLOTS.includes(item.slot) || !/^[a-z]+:[a-z0-9-]{2,40}$/.test(item.id)) throw new Error(`Bad catalogue item ${item.id}`);
  if (!Number.isInteger(item.price) || item.price < 0 || item.price > 100000) throw new Error(`Bad price for ${item.id}`);
  if (!item.id.startsWith(`${item.slot === 'pieces' ? 'pieces' : 'board'}:`)) throw new Error(`Item ${item.id} is in the wrong slot`);
  item.isDefault = DEFAULT_ITEMS[item.slot] === item.id;
  Object.freeze(item);
}
if (new Set(ITEMS.map((i) => i.id)).size !== ITEMS.length) throw new Error('Duplicate catalogue ids');

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id) {
  return typeof id === 'string' ? BY_ID.get(id) || null : null;
}

/** Catalogue as sent to the client */
export function publicCatalog() {
  return ITEMS.map(({ id, slot, price, name, description, isDefault }) => ({ id, slot, price, name, description, isDefault }));
}

/** A known item id of that slot, or the slot's default */
export function sanitizeSlotItem(slot, id) {
  const item = getItem(id);
  return item && item.slot === slot ? item.id : DEFAULT_ITEMS[slot];
}

export const sanitizePieceSet = (id) => sanitizeSlotItem('pieces', id);
export const sanitizeBoardTheme = (id) => sanitizeSlotItem('board', id);
