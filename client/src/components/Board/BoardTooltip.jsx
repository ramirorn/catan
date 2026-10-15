// The one info card for the board (2D and 3D): a washi slip next to the
// cursor / finger. Never clickable (pointer-events: none), never blocking.

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '../../context/GameContext';
import { pieceColor, TERRAIN_BASE } from '../../utils/theme';
import { ResourceChip } from '../Shared/ResourceCard';
import { AnchorIcon, CheckIcon, CityIcon, RobberIcon, SettlementIcon } from '../Shared/Icons';
import { tipInfo } from './boardInfo';
import { getTip, getTipPos, resetTip, setTipPlacing, subscribeTip, subscribeTipPos } from './boardTip';
import { isSetupPhase } from './boardActions';
import { PHASE } from '../../utils/constants';

const MARGIN = 8;
const MOUSE_OFFSET = { x: 16, y: 20 };
const FINGER_GAP = 34;

/** Place the card next to the pointer, flipped / clamped to stay on screen */
function placeCard(el, mode) {
  if (!el) return;
  const { x, y } = getTipPos();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left;
  let top;
  if (mode === 'touch') {
    // Above the finger (which hides what is below it), centred
    left = x - w / 2;
    top = y - h - FINGER_GAP;
    if (top < MARGIN) top = y + FINGER_GAP;
  } else {
    left = x + MOUSE_OFFSET.x;
    top = y + MOUSE_OFFSET.y;
    if (left + w > vw - MARGIN) left = x - MOUSE_OFFSET.x - w;
    if (top + h > vh - MARGIN) top = y - MOUSE_OFFSET.y / 2 - h;
  }
  left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
  top = Math.max(MARGIN, Math.min(top, vh - h - MARGIN));
  el.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
}

function Dot({ color, className = 'w-3 h-3' }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full border border-ink/70 ${className}`}
      style={{ backgroundColor: pieceColor(color) }}
      aria-hidden="true"
    />
  );
}

function NumberSeal({ number, className = '' }) {
  if (!number) return null;
  const hot = number === 6 || number === 8;
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 w-6 h-6 rounded-full bg-paper-light border border-ink font-serif font-extrabold text-[13px] leading-none ${
        hot ? 'text-shu ring-1 ring-shu/70 ring-offset-1 ring-offset-paper-light' : 'text-ink'
      } ${className}`}
    >
      {number}
    </span>
  );
}

function Pips({ ways }) {
  if (!ways) return null;
  return (
    <span className="inline-flex gap-[2px] ml-0.5" aria-hidden="true">
      {Array.from({ length: ways }, (_, i) => (
        <span key={i} className={`w-1 h-1 rounded-full ${ways === 5 ? 'bg-shu' : 'bg-ink/70'}`} />
      ))}
    </span>
  );
}

function TerrainChip({ resource, terrain }) {
  if (resource) return <ResourceChip type={resource} className="w-6 h-6" iconClassName="w-4 h-4" />;
  return (
    <span
      className="inline-block w-6 h-6 rounded-[3px] shrink-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.25)]"
      style={{ backgroundColor: TERRAIN_BASE[terrain] || TERRAIN_BASE.desert }}
      aria-hidden="true"
    />
  );
}

function Header({ icon, kicker, title }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="min-w-0">
        <div className="label-caps !text-[9.5px] leading-none mb-0.5">{kicker}</div>
        <div className="font-serif font-extrabold text-[15px] leading-tight text-ink">{title}</div>
      </div>
    </div>
  );
}

const Rule = () => <div className="my-1.5 h-px bg-ink/20" aria-hidden="true" />;

function HexCard({ info }) {
  return (
    <>
      <Header
        icon={<TerrainChip resource={info.resource} terrain={info.terrain} />}
        kicker={info.desert ? 'Terreno' : `Produce ${info.resourceName}`}
        title={info.terrainName}
      />
      <Rule />
      {info.desert ? (
        <p className="text-ink-soft">No produce recursos</p>
      ) : (
        <div className="flex items-center gap-2">
          <NumberSeal number={info.number} />
          <span>
            sale en <b>{info.ways}</b> de 36 tiradas <span className="text-ink-soft">(≈{info.pct} %)</span>
          </span>
        </div>
      )}
      {info.robber && (
        <p className="mt-1.5 flex items-center gap-1.5 font-bold text-shu">
          <RobberIcon className="w-4 h-4 shrink-0" />
          {info.desert ? 'Aquí está el ladrón' : 'Bloqueada por el ladrón: no produce'}
        </p>
      )}
      {!info.desert && (
        <>
          <Rule />
          <div className="label-caps !text-[9.5px] mb-1">{info.robber ? 'Cobrarían' : 'Cobran'}</div>
          {info.collectors.length === 0 ? (
            <p className="text-ink-soft italic">Nadie tiene construcciones aquí</p>
          ) : (
            <ul className="space-y-0.5">
              {info.collectors.map((c) => (
                <li key={c.id} className="flex items-center gap-1.5">
                  <Dot color={c.color} />
                  <span className="font-bold truncate max-w-[7.5rem]">{c.name}</span>
                  <span className="text-ink-soft text-[11.5px] whitespace-nowrap">
                    {[
                      c.settlements && `${c.settlements} poblado${c.settlements > 1 ? 's' : ''}`,
                      c.cities && `${c.cities} ciudad${c.cities > 1 ? 'es' : ''}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className={`ml-auto pl-2 font-extrabold ${info.robber ? 'text-ink-faint line-through' : 'text-ink'}`}>
                    +{c.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function PortCard({ info }) {
  return (
    <>
      <Header
        icon={
          info.generic ? (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-[3px] bg-ink text-paper-light shrink-0">
              <AnchorIcon className="w-4 h-4" />
            </span>
          ) : (
            <ResourceChip type={info.type} className="w-6 h-6" iconClassName="w-4 h-4" />
          )
        }
        kicker="Puerto"
        title={info.title}
      />
      <Rule />
      <p>{info.explain}</p>
      <p className={`mt-1.5 flex items-start gap-1.5 ${info.mine ? 'font-bold text-leaf' : 'text-ink-soft'}`}>
        {info.mine ? (
          <>
            <CheckIcon className="w-4 h-4 shrink-0" />
            Tienes acceso
          </>
        ) : (
          'Construye en uno de sus dos muelles para usarlo'
        )}
      </p>
      {info.others.length > 0 && (
        <p className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px] text-ink-soft">
          También lo usa{info.others.length > 1 ? 'n' : ''}:
          {info.others.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 font-bold text-ink">
              <Dot color={p.color} className="w-2.5 h-2.5" />
              {p.name}
            </span>
          ))}
        </p>
      )}
    </>
  );
}

function VertexCard({ info }) {
  const Icon = info.city ? CityIcon : SettlementIcon;
  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-[3px] border border-ink/70 text-paper-light shrink-0"
          style={{ backgroundColor: pieceColor(info.owner.color) }}
        >
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="label-caps !text-[9.5px] leading-none mb-0.5">{info.typeName}</div>
          <div className="font-serif font-extrabold text-[15px] leading-tight text-ink truncate max-w-[12rem]">
            {info.owner.name}
            {info.mine && <span className="font-sans font-bold text-[11px] text-ink-soft"> (tú)</span>}
          </div>
        </div>
      </div>
      <Rule />
      <p>
        Produce <b>{info.amount}</b> por tirada
        <span className="text-ink-soft"> de cada casilla vecina</span>
      </p>
      {info.hexes.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {info.hexes.map((h) => (
            <li key={h.id} className={`flex items-center gap-1.5 ${h.robber ? 'opacity-60' : ''}`}>
              <TerrainChip resource={h.resource} terrain={h.desert ? 'desert' : undefined} />
              <span className="font-bold">{h.resourceName || h.terrainName}</span>
              {h.robber && <RobberIcon className="w-3.5 h-3.5 text-shu shrink-0" aria-label="Bloqueada por el ladrón" />}
              <span className="ml-auto pl-2 flex items-center gap-1">
                {h.number ? (
                  <>
                    <NumberSeal number={h.number} className="!w-5 !h-5 !text-[11px]" />
                    <Pips ways={h.ways} />
                  </>
                ) : (
                  <span className="text-ink-faint text-[11px]">—</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {info.port && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-soft">
          <AnchorIcon className="w-3.5 h-3.5 shrink-0" />
          Puerto {info.port.label}
        </p>
      )}
    </>
  );
}

function CardBody({ info }) {
  if (info.kind === 'hex') return <HexCard info={info} />;
  if (info.kind === 'port') return <PortCard info={info} />;
  return <VertexCard info={info} />;
}

/** Is the local player placing something (pieces or the robber) right now? */
function isPlacing({ gameState, isMyTurn, canActOnBoard, buildMode }) {
  if (!gameState) return false;
  if (isSetupPhase(gameState.phase) && isMyTurn) return true;
  if (gameState.phase === PHASE.ROBBER_MOVE && isMyTurn) return true;
  return !!(canActOnBoard && buildMode);
}

export function BoardTooltip() {
  const game = useGame();
  const tip = useSyncExternalStore(subscribeTip, getTip, getTip);
  const ref = useRef(null);
  const placing = isPlacing(game);

  useEffect(() => {
    setTipPlacing(placing);
  }, [placing]);

  // Leaving the board (2D ↔ 3D, end of game): drop any card
  useEffect(() => resetTip, []);

  // Follow the pointer outside React, once per frame at most
  useEffect(() => {
    if (!tip) return undefined;
    let frame = 0;
    const unsub = subscribeTipPos(() => {
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          placeCard(ref.current, tip.mode);
        });
    });
    return () => {
      unsub();
      cancelAnimationFrame(frame);
    };
  }, [tip]);

  const info = tip ? tipInfo(game.gameState, game.myPlayerId, tip.target) : null;

  // New content: re-measure and place before paint
  useLayoutEffect(() => {
    if (info) placeCard(ref.current, tip.mode);
  });

  if (!info) return null;

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      className="paper animate-fade-in fixed left-0 top-0 z-[70] pointer-events-none select-none w-max max-w-[min(17rem,calc(100vw-16px))] rounded-[2px] border border-ink/75 px-3 py-2 text-[12.5px] leading-snug text-ink shadow-[0_10px_22px_-6px_rgba(0,0,0,0.75),0_2px_5px_rgba(0,0,0,0.35)]"
      style={{ transform: 'translate3d(-9999px, -9999px, 0)' }}
    >
      {/* vermilion head band, like the harbour talismans */}
      <span className="absolute inset-x-0 top-0 h-[3px] bg-shu/85" aria-hidden="true" />
      <CardBody info={info} />
    </div>,
    document.body
  );
}
