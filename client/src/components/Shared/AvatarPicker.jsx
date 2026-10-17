import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from './Avatar';
import { AVATAR_COUNT, AVATAR_NAMES, avatarName } from '../../utils/avatars';

// Avatar picker: a round button with the current portrait; it opens a small
// grid of all portraits in a portal (fixed position, never stretches or
// scrolls the page). Keyboard: Enter / Space / ↓ opens, arrows move in the
// grid, Home / End, Enter / Space chooses, Escape / Tab closes.

const COLS = 4;

export function AvatarPicker({
  value,
  onChange,
  ring = null,
  size = 44,
  className = '',
  disabled = false,
  id,
}) {
  const autoId = useId();
  const baseId = id || `av-${autoId.replace(/:/g, '')}`;
  const gridId = `${baseId}-grid`;
  const buttonRef = useRef(null);
  const gridRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const [pos, setPos] = useState(null);

  const place = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const w = Math.min(COLS * 52 + 20, window.innerWidth - 16);
    const h = 3 * 52 + 56;
    const below = window.innerHeight - r.bottom - 8;
    const up = below < h && r.top - 8 > below;
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)),
      width: w,
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
    });
  }, []);

  const openGrid = () => {
    if (disabled) return;
    setActive(value);
    place();
    setOpen(true);
  };

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };

  const choose = (i) => {
    onChange?.(i);
    close();
  };

  // Glued to its button; a click elsewhere closes it
  useLayoutEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (buttonRef.current?.contains(e.target) || gridRef.current?.contains(e.target)) return;
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

  useEffect(() => {
    if (open && gridRef.current && document.activeElement !== gridRef.current) {
      gridRef.current.focus({ preventScroll: true });
    }
  }, [open]);

  const onButtonKey = (e) => {
    if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      openGrid();
    }
  };

  const onGridKey = (e) => {
    const last = AVATAR_COUNT - 1;
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key];
    if (step) {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(last, a + step)));
      return;
    }
    switch (e.key) {
      case 'Home':
        e.preventDefault();
        setActive(0);
        break;
      case 'End':
        e.preventDefault();
        setActive(last);
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
      default:
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
        aria-controls={open ? gridId : undefined}
        aria-label={`Avatar: ${avatarName(value)}. Cambiar avatar`}
        title={`${avatarName(value)} · cambiar avatar`}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else openGrid();
        }}
        onKeyDown={onButtonKey}
        className={`avatar-btn ${open ? 'is-open' : ''} ${className}`}
      >
        <Avatar id={value} size={size} ring={ring} />
        <span
          className="avatar-btn-badge"
          aria-hidden="true"
          style={size < 36 ? { width: 13, height: 13, fontSize: 8, right: -4, bottom: -4 } : undefined}
        >
          ✎
        </span>
      </button>

      {open && pos && createPortal(
        <div
          className="avatar-pop paper animate-fade-in"
          style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="avatar-pop-title" aria-hidden="true">
            <span className="label-caps">Elige tu avatar</span>
            <span className="avatar-pop-name">{AVATAR_NAMES[active]}</span>
          </div>
          <div
            ref={gridRef}
            id={gridId}
            role="listbox"
            tabIndex={-1}
            aria-label="Elige tu avatar"
            aria-activedescendant={`${baseId}-opt-${active}`}
            onKeyDown={onGridKey}
            className="avatar-grid"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {AVATAR_NAMES.map((name, i) => (
              <div
                key={i}
                id={`${baseId}-opt-${i}`}
                role="option"
                aria-selected={i === value}
                aria-label={name}
                title={name}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={`avatar-opt ${i === active ? 'is-active' : ''} ${i === value ? 'is-selected' : ''}`}
              >
                <Avatar id={i} size={44} />
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
