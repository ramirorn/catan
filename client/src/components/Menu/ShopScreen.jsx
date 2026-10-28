import { Component, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGame } from '../../context/GameContext';
import { SegmentedControl } from '../Shared/Choice';
import { ConfirmDialog } from '../Shared/ConfirmDialog';
import { CoinsIcon } from '../Shared/Icons';
import { CityArt, RoadArt, SettlementArt } from '../Board/pieceArt2D';
import { hasWebGL } from '../Board/boardViewMode';
import { boardTheme } from '../../utils/cosmetics';
import { pieceColor } from '../../utils/theme';
import { CoinBadge, MenuShell, PanelHeading } from './MenuParts';

// three.js only downloads when the shop opens (shared with the 3D board)
const ShopPreview3D = lazy(() => import('./ShopPreview3D'));

const TABS = [
  { value: 'pieces', label: 'Fichas' },
  { value: 'board', label: 'Tableros' },
];

// The six seat colours, to try the pieces in each
const SEAT_COLORS = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c'].map(pieceColor);

/* ─── Thumbnails (plain SVG, same art as the 2D board) ─── */

function PiecesThumb({ setId, color, className = '' }) {
  return (
    <svg viewBox="-34 -40 68 58" className={className} aria-hidden="true">
      <RoadArt set={setId} x1={-28} y1={13} x2={28} y2={13} color={color} />
      <g transform="translate(-14 4) scale(0.95)">
        <SettlementArt set={setId} color={color} />
      </g>
      <g transform="translate(14 5) scale(0.8)">
        <CityArt set={setId} color={color} />
      </g>
    </svg>
  );
}

function BoardThumb({ themeId, className = '' }) {
  const t = boardTheme(themeId);
  const hex = (cx, cy, r) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  const land = ['#3b6a3c', '#d7a63c', '#93b45b', '#ad512c', '#75808d', '#93b45b', '#d9c08a'];
  const cells = [[32, 23], [42.4, 23], [21.6, 23], [37.2, 14], [26.8, 14], [37.2, 32], [26.8, 32]];
  return (
    <svg viewBox="0 0 64 46" className={className} aria-hidden="true">
      <rect x="0" y="0" width="64" height="46" rx="3" fill={t.frame.margin} />
      <rect x="2.5" y="2.5" width="59" height="41" rx="2" fill={t.frame.rule} />
      <rect x="3.5" y="3.5" width="57" height="39" rx="1.5" fill={t.frame.line} />
      <rect x="4.5" y="4.5" width="55" height="37" rx="1" fill={t.sea.base} />
      {[[10, 10], [54, 12], [9, 36], [55, 37], [32, 41]].map(([x, y]) => (
        <g key={`${x}-${y}`} fill="none" stroke={t.sea.ring} strokeWidth="0.7" opacity="0.7">
          <circle cx={x} cy={y} r="4" />
          <circle cx={x} cy={y} r="2.2" />
        </g>
      ))}
      {cells.map(([x, y], i) => (
        <g key={i}>
          <polygon points={hex(x, y, 6.2)} fill={land[i]} stroke={t.frame.line} strokeWidth="0.6" />
          {t.wash && <polygon points={hex(x, y, 6.2)} fill={t.wash.color} fillOpacity={Math.min(0.5, t.wash.opacity * 1.4)} />}
        </g>
      ))}
      <circle cx="32" cy="23" r="2.4" fill="#f4ecda" stroke="#1f1b17" strokeWidth="0.5" />
    </svg>
  );
}

/* ─── 3D preview with a safe fallback ─── */

class PreviewBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Preview({ item, color }) {
  const [webgl] = useState(hasWebGL);
  const fallback = item.slot === 'pieces'
    ? <PiecesThumb setId={item.id} color={color} className="w-full h-full p-4" />
    : <BoardThumb themeId={item.id} className="w-full h-full p-4" />;
  if (!webgl) return <div className="absolute inset-0">{fallback}</div>;
  return (
    <PreviewBoundary fallback={<div className="absolute inset-0">{fallback}</div>}>
      <Suspense
        fallback={
          <div className="absolute inset-0 flex items-center justify-center font-serif italic text-ink-faint text-[14px]">
            Tallando la vista 3D…
          </div>
        }
      >
        <ShopPreview3D kind={item.slot} itemId={item.id} color={color} className="absolute inset-0" />
      </Suspense>
    </PreviewBoundary>
  );
}

/* ─── Screen ─── */

function StatusBadge({ equipped, owned }) {
  if (equipped) {
    return <span className="shop-badge shop-badge-on">Equipado</span>;
  }
  if (owned) return <span className="shop-badge">Tuyo</span>;
  return null;
}

const saleEndFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "hasta el 3 nov, 23:59" for a sale end */
function saleUntil(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `hasta el ${saleEndFmt.format(d)}`;
}

/** Price of a paid item: on sale → the old price struck through + the new one */
function PriceTag({ item, coinName, large = false }) {
  if (item.available === false) {
    return <span className="text-[11.5px] font-bold text-ink-faint">Ya no se vende</span>;
  }
  if (!item.salePercent) {
    return large ? (
      <span className="inline-flex items-center gap-1 font-bold text-chakra-dark tabular-nums">
        <CoinsIcon className="w-4 h-4" />
        {item.price}
      </span>
    ) : (
      <>{item.price} {coinName}</>
    );
  }
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1 ${large ? 'justify-end' : ''}`}>
      <s className="text-ink-faint font-semibold" aria-label={`Antes ${item.listPrice} ${coinName}`}>{item.listPrice}</s>
      <span className={`inline-flex items-center gap-1 font-bold text-shu tabular-nums ${large ? '' : 'text-[11.5px]'}`}>
        {large && <CoinsIcon className="w-4 h-4" />}
        {item.price}{large ? '' : ` ${coinName}`}
      </span>
      <span className="shop-badge !bg-shu !text-paper-light !border-shu">-{item.salePercent}%</span>
    </span>
  );
}

export function ShopScreen({ onBack, onLogin, onProfile }) {
  const { user, coinName, accountsEnabled, status, shop, loadShop, buyItem, equipItem } = useAuth();
  const { addToast } = useGame();
  const [tab, setTab] = useState('pieces');
  const [selectedId, setSelectedId] = useState(null);
  const [color, setColor] = useState(SEAT_COLORS[0]);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  // Fresh balance / inventory every time the shop opens
  useEffect(() => {
    loadShop();
  }, [loadShop]);

  const items = useMemo(() => (shop?.catalog || []).filter((i) => i.slot === tab), [shop, tab]);
  const owned = shop?.owned || [];
  const equipped = shop?.equipped || {};
  const selected = items.find((i) => i.id === selectedId) || items.find((i) => i.id === equipped[tab]) || items[0] || null;
  const coins = user ? user.coins : 0;

  const isOwned = (item) => item.isDefault || owned.includes(item.id);
  const isEquipped = (item) => equipped[item.slot] === item.id;

  const doBuy = async (item) => {
    setConfirm(null);
    setBusy(true);
    const res = await buyItem(item.id, item.price);
    setBusy(false);
    if (res.success) addToast(res.alreadyOwned ? `${item.name} ya era tuyo` : `¡Compraste ${item.name}!`, 'success');
    else {
      addToast(res.error, 'error', 4000);
      if (res.priceChanged) loadShop();
    }
  };

  const doEquip = async (item) => {
    setBusy(true);
    const res = await equipItem(item.slot, item.id);
    setBusy(false);
    if (res.success) {
      addToast(item.slot === 'pieces' ? `Equipaste ${item.name}: todos lo verán en tus partidas` : `${item.name} será el tablero de las salas que crees`, 'success', 3500);
    } else {
      addToast(res.error, 'error', 4000);
    }
  };

  let action = null;
  if (selected) {
    if (isEquipped(selected) && (user || selected.isDefault)) {
      action = <button type="button" disabled className="btn btn-ghost w-full min-h-[44px] py-2 text-[14px]">Equipado</button>;
    } else if (isOwned(selected) && user) {
      action = (
        <button type="button" disabled={busy} onClick={() => doEquip(selected)} className="btn btn-primary w-full min-h-[44px] py-2 text-[15px]">
          Equipar
        </button>
      );
    } else if (!user) {
      action = accountsEnabled && status !== 'loading' ? (
        <button type="button" onClick={onLogin} className="btn btn-primary w-full min-h-[44px] py-2 text-[14px]">
          Inicia sesión para comprar
        </button>
      ) : (
        <p className="text-[12.5px] text-ink-faint text-center py-2">Las cuentas no están disponibles ahora.</p>
      );
    } else if (coins < selected.price) {
      action = (
        <button type="button" disabled className="btn btn-ghost w-full min-h-[44px] py-2 text-[14px]">
          Te faltan {selected.price - coins} {coinName}
        </button>
      );
    } else {
      action = (
        <button type="button" disabled={busy} onClick={() => setConfirm(selected)} className="btn btn-primary w-full min-h-[44px] py-2 text-[15px]">
          Comprar por {selected.price} {coinName}
        </button>
      );
    }
  }

  return (
    <MenuShell onProfile={onProfile} onLogin={onLogin} compactTitle>
      <PanelHeading title="Tienda" onBack={onBack} />

      <div className="flex items-center justify-between gap-2 -mt-1 mb-3">
        <SegmentedControl ariaLabel="Categoría" options={TABS} value={tab} onChange={(v) => { setTab(v); setSelectedId(null); }} />
        {user ? (
          <CoinBadge coins={user.coins} tone="paper" className="text-[14px] py-1" />
        ) : (
          <span className="text-[12px] text-ink-faint text-right leading-tight">Invitado</span>
        )}
      </div>

      {!shop ? (
        <p className="font-serif italic text-ink-faint text-[14px] py-6 text-center">Abriendo la tienda…</p>
      ) : (
        <>
          {selected && (
            <section className="paper-inset p-2.5 mb-3" aria-live="polite">
              <div className="relative w-full h-[190px] min-[400px]:h-[210px] short:h-[160px] phland:h-[150px] rounded-[2px] overflow-hidden bg-[radial-gradient(ellipse_at_center,#fbf3e4_0%,#e8dcc2_70%)]">
                <Preview key={selected.slot} item={selected} color={color} />
                <span className="absolute left-2 bottom-1.5 text-[10.5px] text-ink-faint pointer-events-none select-none">
                  Arrastra para girar · pellizca para acercar
                </span>
              </div>
              <div className="flex items-start justify-between gap-2 mt-2">
                <div className="min-w-0">
                  <h3 className="font-display text-[19px] leading-tight text-ink">{selected.name}</h3>
                  <p className="text-[12.5px] leading-snug text-ink-soft mt-0.5">{selected.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  {selected.isDefault ? (
                    <span className="text-[12px] font-bold text-ink-faint">Gratis</span>
                  ) : (
                    <PriceTag item={selected} coinName={coinName} large />
                  )}
                  {!selected.isDefault && selected.salePercent && selected.saleEndsAt && (
                    <p className="text-[11px] text-shu font-semibold mt-0.5">Oferta {saleUntil(selected.saleEndsAt)}</p>
                  )}
                  <div className="mt-1">
                    <StatusBadge equipped={isEquipped(selected) && (!!user || selected.isDefault)} owned={isOwned(selected) && !!user} />
                  </div>
                </div>
              </div>
              {selected.slot === 'pieces' && (
                <div className="flex items-center gap-1.5 mt-2" role="radiogroup" aria-label="Color de prueba">
                  <span className="text-[11.5px] text-ink-faint mr-1">Color:</span>
                  {SEAT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={c === color}
                      aria-label={`Probar en ${c}`}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${c === color ? 'border-ink scale-110' : 'border-paper-light'}`}
                      style={{ background: c, boxShadow: '0 0 0 1px rgba(31,27,23,0.45)' }}
                    />
                  ))}
                </div>
              )}
              {selected.slot === 'board' && (
                <p className="text-[11.5px] leading-snug text-ink-faint mt-1.5">
                  El anfitrión elige el tablero de la sala entre los suyos; lo ven todos los ninjas.
                </p>
              )}
              <div className="mt-2.5">{action}</div>
            </section>
          )}

          <ul className="grid grid-cols-2 min-[440px]:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2" aria-label={tab === 'pieces' ? 'Fichas' : 'Tableros'}>
            {items.map((item) => {
              const on = selected && item.id === selected.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    aria-pressed={on}
                    className={`shop-card w-full text-left ${on ? 'is-on' : ''}`}
                  >
                    <span className="block relative aspect-[68/50] rounded-[2px] bg-paper-light/70 overflow-hidden">
                      {item.slot === 'pieces' ? (
                        <PiecesThumb setId={item.id} color={color} className="absolute inset-0 w-full h-full" />
                      ) : (
                        <BoardThumb themeId={item.id} className="absolute inset-0 w-full h-full p-1.5" />
                      )}
                      <span className="absolute top-1 right-1">
                        <StatusBadge equipped={isEquipped(item) && (!!user || item.isDefault)} owned={isOwned(item) && !!user && !item.isDefault} />
                      </span>
                    </span>
                    <span className="block font-bold text-[12.5px] leading-tight text-ink mt-1 truncate">{item.name}</span>
                    <span className="block text-[11.5px] tabular-nums text-chakra-dark font-bold">
                      {item.isDefault ? 'Gratis' : <PriceTag item={item} coinName={coinName} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="text-[12px] text-ink-faint mt-3 leading-snug">
            Gana {coinName} jugando: +{shop.rewards?.finish ?? 20} por partida, +{shop.rewards?.win ?? 30} si ganas y +{shop.rewards?.perVp ?? 2} por punto. Tus fichas las ven todos los ninjas de la partida.
          </p>
        </>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        title="¿Confirmar compra?"
        confirmLabel={confirm ? `Comprar (${confirm.price} ${coinName})` : 'Comprar'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && doBuy(confirm)}
      >
        {confirm && (
          <p>
            <strong className="text-ink">{confirm.name}</strong> cuesta {confirm.price} {coinName}. Te quedarán{' '}
            <strong className="text-ink">{Math.max(0, coins - confirm.price)} {coinName}</strong>.
          </p>
        )}
      </ConfirmDialog>
    </MenuShell>
  );
}
