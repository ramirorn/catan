import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarIcon, ChevronDownIcon } from './Icons';
import { Dropdown } from './Choice';

// Themed date + time picker (replaces <input type="datetime-local">). The
// value is the same local "YYYY-MM-DDTHH:MM" string that input used, so it
// drops into existing forms. The popup is a paper calendar in a portal with
// fixed positioning, like Dropdown.

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const pad = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => ({ value: h, label: pad(h) }));
const MINUTES = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: pad(i * 5) }));

function parse(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || '');
  if (!m) return null;
  return { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +m[4], mi: +m[5] };
}
const format = ({ y, mo, d, h, mi }) => `${y}-${pad(mo + 1)}-${pad(d)}T${pad(h)}:${pad(mi)}`;
const fromDate = (dt) => ({ y: dt.getFullYear(), mo: dt.getMonth(), d: dt.getDate(), h: dt.getHours(), mi: dt.getMinutes() });
const daysIn = (y, mo) => new Date(y, mo + 1, 0).getDate();

/** "29 oct 2026 · 14:30" */
function label(v) {
  if (!v) return 'Elegir fecha';
  return `${v.d} ${MONTHS[v.mo].slice(0, 3)} ${v.y} · ${pad(v.h)}:${pad(v.mi)}`;
}

export function DateTimePicker({ value, onChange, ariaLabel, className = '', disabled = false }) {
  const autoId = useId();
  const popId = `dtp-${autoId.replace(/:/g, '')}`;
  const current = parse(value);
  const buttonRef = useRef(null);
  const popRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => current || fromDate(new Date()));
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = 272;
    const h = 330;
    const below = window.innerHeight - r.bottom - 8;
    const up = below < h && r.top - 8 > below;
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      width: w,
    });
  }, []);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const toggle = () => {
    if (disabled) return;
    if (open) return close();
    setView(current || fromDate(new Date()));
    place();
    setOpen(true);
  };

  // Stay glued to the button; close on a click outside (the hour / minute
  // lists live in their own portal and count as inside)
  useLayoutEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (buttonRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      if (e.target.closest?.('.dd-list')) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('.dd-list')) {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (open) popRef.current?.querySelector('[data-selected="true"], [data-today="true"]')?.focus({ preventScroll: true });
  }, [open]);

  const base = current || { ...view, h: 12, mi: 0 };
  const set = (patch) => {
    const next = { ...base, ...patch };
    next.d = Math.min(next.d, daysIn(next.y, next.mo));
    onChange?.(format(next));
  };
  const shiftMonth = (delta) => {
    const dt = new Date(view.y, view.mo + delta, 1);
    setView({ ...view, y: dt.getFullYear(), mo: dt.getMonth() });
  };

  // Calendar grid, weeks starting on Monday
  const first = (new Date(view.y, view.mo, 1).getDay() + 6) % 7;
  const total = daysIn(view.y, view.mo);
  const cells = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const today = fromDate(new Date());
  const isSel = (d) => current && current.y === view.y && current.mo === view.mo && current.d === d;
  const isToday = (d) => today.y === view.y && today.mo === view.mo && today.d === d;

  const onDayKey = (e, d) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    const dt = new Date(view.y, view.mo, d + step);
    setView({ ...view, y: dt.getFullYear(), mo: dt.getMonth() });
    set({ y: dt.getFullYear(), mo: dt.getMonth(), d: dt.getDate() });
    requestAnimationFrame(() => popRef.current?.querySelector('[data-selected="true"]')?.focus());
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        aria-label={ariaLabel ? `${ariaLabel}: ${label(current)}` : undefined}
        onClick={toggle}
        className={`dd-button ${open ? 'is-open' : ''} ${className}`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <CalendarIcon className="w-4 h-4 shrink-0 text-ink-soft" />
          <span className={`truncate tabular-nums ${current ? '' : 'text-ink-faint'}`}>{label(current)}</span>
        </span>
        <ChevronDownIcon className="dd-caret" />
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          id={popId}
          role="dialog"
          aria-label={ariaLabel || 'Elegir fecha y hora'}
          className="dtp-pop paper animate-fade-in"
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <button type="button" className="dtp-nav" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">‹</button>
            <span className="font-display text-[17px] text-ink capitalize">{MONTHS[view.mo]} {view.y}</span>
            <button type="button" className="dtp-nav" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1" aria-hidden="true">
            {WEEKDAYS.map((w) => (
              <span key={w} className="label-caps !text-[10px] text-center">{w}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5" role="grid" aria-label={`${MONTHS[view.mo]} ${view.y}`}>
            {cells.map((d, i) =>
              d === null ? (
                <span key={`e${i}`} />
              ) : (
                <button
                  key={d}
                  type="button"
                  data-selected={isSel(d) || undefined}
                  data-today={isToday(d) || undefined}
                  tabIndex={isSel(d) || (!current && isToday(d)) ? 0 : -1}
                  aria-pressed={!!isSel(d)}
                  onClick={() => set({ y: view.y, mo: view.mo, d })}
                  onKeyDown={(e) => onDayKey(e, d)}
                  className={`dtp-day ${isSel(d) ? 'is-on' : ''} ${isToday(d) ? 'is-today' : ''}`}
                >
                  {d}
                </button>
              )
            )}
          </div>
          <hr className="brush-rule my-2.5" />
          <div className="flex items-center gap-2">
            <span className="label-caps">Hora</span>
            <div className="w-[4.5rem]">
              <Dropdown options={HOURS} value={base.h} onChange={(h) => set({ h })} ariaLabel="Hora" />
            </div>
            <span className="font-bold text-ink">:</span>
            <div className="w-[4.5rem]">
              <Dropdown
                options={MINUTES.some((m) => m.value === base.mi) ? MINUTES : [...MINUTES, { value: base.mi, label: pad(base.mi) }].sort((a, b) => a.value - b.value)}
                value={base.mi}
                onChange={(mi) => set({ mi })}
                ariaLabel="Minutos"
              />
            </div>
          </div>
          <div className="flex justify-between gap-2 mt-3">
            <button
              type="button"
              className="btn btn-ghost min-h-[34px] px-2.5 py-1 text-[13px]"
              onClick={() => {
                const now = fromDate(new Date());
                setView(now);
                onChange?.(format(now));
              }}
            >
              Ahora
            </button>
            <button type="button" className="btn btn-primary min-h-[34px] px-3 py-1 text-[13px]" onClick={() => close()}>
              Listo
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
