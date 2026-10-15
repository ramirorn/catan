import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDownIcon } from './Icons';

// Themed replacements for native form selectors.
//  - SegmentedControl: a row of chips (radiogroup) for a handful of options.
//  - Dropdown: a button + listbox popup (rendered in a portal with fixed
//    positioning, so it never stretches or scrolls the page behind it).
// Both follow the WAI-ARIA keyboard patterns (arrows, Home/End, Enter/Space,
// Escape) and take options as [{ value, label, title?, icon? }].

const indexOfValue = (options, value) => {
  const i = options.findIndex((o) => o.value === value);
  return i === -1 ? 0 : i;
};

/* ─── Segmented chips ─── */

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  ariaLabelledby,
  className = '',
  chipClassName = '',
  disabled = false,
}) {
  const refs = useRef([]);
  const selected = indexOfValue(options, value);

  const move = (to) => {
    const n = options.length;
    const i = (to + n) % n;
    onChange?.(options[i].value);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e, i) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(i + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(i - 1);
        break;
      case 'Home':
        e.preventDefault();
        move(0);
        break;
      case 'End':
        e.preventDefault();
        move(options.length - 1);
        break;
      default:
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      aria-disabled={disabled || undefined}
      className={`seg ${className}`}
    >
      {options.map((o, i) => {
        const isOn = i === selected;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isOn}
            tabIndex={isOn ? 0 : -1}
            title={o.title}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onChange?.(o.value);
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`seg-chip ${isOn ? 'is-on' : ''} ${chipClassName}`}
          >
            {o.icon}
            {o.label != null && <span className="seg-label">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ─── Dropdown (listbox) ─── */

export function Dropdown({
  options,
  value,
  onChange,
  id,
  ariaLabel,
  ariaLabelledby,
  className = '',
  disabled = false,
}) {
  const autoId = useId();
  const baseId = id || `dd-${autoId.replace(/:/g, '')}`;
  const listId = `${baseId}-list`;
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => indexOfValue(options, value));
  const [pos, setPos] = useState(null);
  const selected = indexOfValue(options, value);
  const current = options[selected];

  const place = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const itemH = 34;
    const want = Math.min(options.length * itemH + 10, 280);
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < want && above > below;
    const maxH = Math.max(80, Math.min(want, up ? above : below));
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 120) - 8)),
      width: Math.max(r.width, 120),
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: maxH,
    });
  }, [options.length]);

  const openList = (at = selected) => {
    if (disabled) return;
    setActive(at);
    place();
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const choose = (i) => {
    const o = options[i];
    if (o) onChange?.(o.value);
    close();
  };

  // Keep the popup glued to its button; close when clicking elsewhere
  useLayoutEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (buttonRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place]);

  // Move focus into the list and keep the active option in view
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    if (document.activeElement !== list) list.focus({ preventScroll: true });
    list.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onButtonKey = (e) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      openList(e.key === 'ArrowUp' ? Math.max(0, selected - 1) : selected);
    }
  };

  const onListKey = (e) => {
    const n = options.length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(n - 1, a + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(n - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation(); // don't close the surrounding modal
        close();
        break;
      case 'Tab':
        close(false);
        break;
      default: {
        // Type-ahead on the first letter
        if (e.key.length === 1) {
          const k = e.key.toLowerCase();
          const i = options.findIndex((o, idx) => idx > active && String(o.label).toLowerCase().startsWith(k));
          const j = i === -1 ? options.findIndex((o) => String(o.label).toLowerCase().startsWith(k)) : i;
          if (j !== -1) setActive(j);
        }
      }
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        id={baseId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby ? `${ariaLabelledby} ${baseId}` : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else openList();
        }}
        onKeyDown={onButtonKey}
        className={`dd-button ${open ? 'is-open' : ''} ${className}`}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {current?.icon}
          <span className="truncate">{current?.label}</span>
        </span>
        <ChevronDownIcon className="dd-caret" />
      </button>

      {open && pos && createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={ariaLabelledby || baseId}
          aria-activedescendant={`${baseId}-opt-${active}`}
          onKeyDown={onListKey}
          onClick={(e) => e.stopPropagation()}
          className="dd-list paper animate-fade-in"
          style={{
            position: 'fixed',
            left: pos.left,
            minWidth: pos.width,
            top: pos.top,
            bottom: pos.bottom,
            maxHeight: pos.maxHeight,
          }}
        >
          {options.map((o, i) => {
            const isSel = i === selected;
            return (
              <li
                key={String(o.value)}
                id={`${baseId}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSel}
                title={o.title}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`dd-option ${i === active ? 'is-active' : ''} ${isSel ? 'is-selected' : ''}`}
              >
                <span className="dd-mark" aria-hidden="true" />
                {o.icon}
                <span className="truncate">{o.label}</span>
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </>
  );
}
