// Build-cost reference card on the left of the board (2D and 3D): what each
// piece / development card costs, what it is worth, and which ones the local
// player can pay for right now. Desktop: a collapsible card (state kept in
// localStorage). Phones: a small button that opens the same content as a
// popover, so it never eats board space.

import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { BUILD_COSTS } from '../../utils/constants';
import { ResourceChip } from '../Shared/ResourceCard';
import {
  RoadIcon,
  SettlementIcon,
  CityIcon,
  CardsIcon,
  DevCardIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
} from '../Shared/Icons';

const STORAGE_KEY = 'catan.costPanel.collapsed';

const BUILDS = [
  { key: 'road', name: 'Camino', Icon: RoadIcon, vp: null },
  { key: 'settlement', name: 'Poblado', Icon: SettlementIcon, vp: 1 },
  { key: 'city', name: 'Ciudad', Icon: CityIcon, vp: 2, note: 'mejora uno de tus poblados' },
  { key: 'devCard', name: 'Carta de desarrollo', Icon: CardsIcon, vp: null },
];

// Deck composition: base game / 5–6 player extension
const DEV_CARDS = [
  { type: 'knight', name: 'Caballero', what: 'Mueve al ladrón y roba 1 carta. 3+ dan el Gran Ejército.', std: 14, ext: 20 },
  { type: 'roadBuilding', name: 'Construcción de caminos', what: 'Construye 2 caminos gratis.', std: 2, ext: 3 },
  { type: 'yearOfPlenty', name: 'Año de la abundancia', what: 'Toma 2 recursos cualesquiera del banco.', std: 2, ext: 3 },
  { type: 'monopoly', name: 'Monopolio', what: 'Elige un recurso: todos te dan los suyos.', std: 2, ext: 3 },
  { type: 'victoryPoint', name: 'Punto de victoria', what: '+1 PV secreto.', std: 5, ext: 5 },
];

function readCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
function writeCollapsed(v) {
  try {
    window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
  } catch {
    /* private mode / blocked storage: just don't remember */
  }
}

/** Cost as chips, one per card; the ones I'm missing are faded */
function CostChips({ cost, have }) {
  const chips = [];
  for (const [type, n] of Object.entries(cost)) {
    const owned = have ? have[type] || 0 : n;
    for (let i = 0; i < n; i++) chips.push({ key: `${type}-${i}`, type, ok: i < owned });
  }
  return (
    <span className="inline-flex items-center gap-[2px] shrink-0">
      {chips.map((c) => (
        <span key={c.key} className={c.ok ? '' : 'opacity-40 saturate-50'}>
          <ResourceChip type={c.type} className="w-4 h-4" iconClassName="w-3 h-3" />
        </span>
      ))}
    </span>
  );
}

function PanelBody({ className = '' }) {
  const { gameState, myPlayer } = useGame();
  const have = myPlayer?.resources || null;
  const extended = gameState?.boardType === 'extended';
  const deckTotal = DEV_CARDS.reduce((a, c) => a + (extended ? c.ext : c.std), 0);

  return (
    <div className={`text-ink ${className}`}>
      <ul className="self-start">
        {BUILDS.map(({ key, name, Icon, vp, note }) => {
          const cost = BUILD_COSTS[key] || {};
          const affordable = !!have && Object.entries(cost).every(([r, n]) => (have[r] || 0) >= n);
          return (
            <li
              key={key}
              className={`flex items-center gap-2 px-2 py-1.5 border-b border-dashed border-ink/15 last:border-b-0 ${
                affordable ? 'bg-chakra/20' : ''
              }`}
              title={`${name}${note ? ` (${note})` : ''}${affordable ? ': puedes pagarlo' : ''}`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${affordable ? 'text-shu' : 'text-ink-soft'}`} />
              <span className="flex-1 min-w-0 leading-tight">
                <span className={`block text-[12.5px] ${affordable ? 'font-extrabold' : 'font-semibold'}`}>
                  {name}
                  {affordable && <CheckIcon className="inline-block w-3 h-3 ml-1 -mt-0.5 text-shu" aria-label="puedes pagarlo" />}
                </span>
                <span className="flex items-center gap-1.5 mt-0.5">
                  <CostChips cost={cost} have={have} />
                </span>
              </span>
              {vp ? (
                <span className="shrink-0 text-right leading-none">
                  <span className="font-serif font-extrabold text-[15px]">{vp}</span>
                  <span className="block text-[8.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">PV</span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="border-t border-ink/30 phland:border-t-0 phland:border-l">
        <div className="flex items-baseline justify-between gap-2 px-2 pt-2 pb-1">
          <span className="label-caps !text-[9.5px] !tracking-[0.12em]">Cartas de desarrollo</span>
          <span className="text-[10px] text-ink-faint shrink-0">{deckTotal} en el mazo</span>
        </div>
        <ul>
          {DEV_CARDS.map((c) => (
            <li key={c.type} className="flex items-start gap-2 px-2 py-1">
              <DevCardIcon type={c.type} className="w-4 h-4 shrink-0 mt-px text-ink-soft" />
              <span className="flex-1 min-w-0 leading-tight">
                <span className="block text-[12px] font-semibold">{c.name}</span>
                <span className="block text-[10.5px] text-ink-faint">{c.what}</span>
              </span>
              <span className="shrink-0 font-serif font-extrabold text-[12.5px] tabular-nums" title="Cartas en el mazo">
                ×{extended ? c.ext : c.std}
              </span>
            </li>
          ))}
        </ul>
        <p className="px-2 pt-1 pb-2 text-[10.5px] text-ink-faint leading-snug border-t border-dashed border-ink/15">
          Camino más largo (5+) y Gran ejército (3+ caballeros): <b className="text-ink-soft">+2 PV</b> cada uno.
        </p>
      </div>
    </div>
  );
}

/** Desktop / tablet: collapsible card in the bottom-left corner that opens upward */
function DeskCard() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => {
    setCollapsed((c) => {
      writeCollapsed(!c);
      return !c;
    });
  };
  return (
    <div className="cost-panel-desk absolute left-3 bottom-3 z-10 w-[14.5rem] max-h-[calc(100%-5.5rem)] flex flex-col-reverse paper border border-ink/70 rounded-[2px] shadow-[0_6px_14px_-4px_rgba(0,0,0,0.7)] overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 px-2 py-1.5 shrink-0 text-left hover:bg-chakra/15 cursor-pointer"
        aria-expanded={!collapsed}
        title={collapsed ? 'Mostrar costes de construcción' : 'Ocultar costes de construcción'}
      >
        <SettlementIcon className="w-3.5 h-3.5 text-shu shrink-0" />
        <span className="label-caps !text-[10px] !text-ink flex-1">Costes</span>
        {/* Points up while folded (it unfolds upward), down once open */}
        <ChevronDownIcon className={`w-3.5 h-3.5 text-ink-soft transition-transform ${collapsed ? 'rotate-180' : ''}`} />
      </button>
      {!collapsed && (
        <div className="min-h-0 overflow-y-auto overscroll-contain border-b border-ink/30">
          <PanelBody />
        </div>
      )}
    </div>
  );
}

/** Phones: small button bottom-left that opens the card as a popover */
function PhoneToggle() {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrap}
      className="cost-panel-phone absolute z-20 top-[5rem] phland:top-[6.25rem] bottom-3 left-[max(0.5rem,env(safe-area-inset-left))] phland:bottom-[max(0.5rem,env(safe-area-inset-bottom))] phland:left-2 flex flex-col justify-end items-start gap-1.5 pointer-events-none"
    >
      {open && (
        <div
          id="cost-popover"
          className="pointer-events-auto min-h-0 w-[min(17rem,calc(100vw-1.5rem))] phland:w-[min(30rem,calc(100vw-17rem))] overflow-y-auto overscroll-contain paper border border-ink/70 rounded-[2px] shadow-[0_10px_22px_-6px_rgba(0,0,0,0.75)] animate-fade-in"
          role="dialog"
          aria-label="Costes de construcción"
        >
          <div className="sticky top-0 z-[1] flex items-center gap-1.5 pl-2 pr-1 py-1 bg-paper border-b border-ink/30">
            <SettlementIcon className="w-3.5 h-3.5 text-shu shrink-0" />
            <span className="label-caps !text-[10px] !text-ink flex-1">Costes</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-ink-faint hover:text-ink cursor-pointer"
              aria-label="Cerrar"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
          <PanelBody className="phland:grid phland:grid-cols-2" />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto shrink-0 btn paper min-h-[40px] px-2.5 py-1.5 text-xs border border-ink/70 shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
        aria-expanded={open}
        aria-controls="cost-popover"
        title="Costes de construcción"
      >
        <SettlementIcon className="w-4 h-4 text-shu" />
        <span>Costes</span>
      </button>
    </div>
  );
}

export function CostPanel() {
  const { gameState } = useGame();
  if (!gameState?.players) return null;
  return (
    <>
      <div className="contents compact:hidden">
        <DeskCard />
      </div>
      <div className="hidden compact:contents">
        <PhoneToggle />
      </div>
    </>
  );
}
