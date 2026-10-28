import { useState } from 'react';
import { ConfirmDialog } from '../components/Shared/ConfirmDialog';
import { STATUS_LABELS, liveStatus } from './format';

// Dense building blocks of the admin panel: same paper / ink look as the
// game, tighter spacing.

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`paper rounded-[2px] border border-paper-edge shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)] ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 pt-2.5 pb-2 border-b border-dashed border-ink/25">
          {title && <h2 className="font-display text-[18px] leading-tight text-ink">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-3 sm:px-4 py-3">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = 'ink' }) {
  const color = tone === 'shu' ? 'text-shu' : tone === 'leaf' ? 'text-leaf' : tone === 'chakra' ? 'text-chakra-dark' : 'text-ink';
  return (
    <div className="paper rounded-[2px] border border-paper-edge shadow-[0_4px_10px_-6px_rgba(0,0,0,0.6)] px-3 py-2 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-ink-faint font-bold truncate">{label}</p>
      <p className={`font-display text-[22px] leading-tight tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-[12px] text-ink-faint leading-snug">{hint}</p>}
    </div>
  );
}

const BADGE_TONES = {
  ink: 'bg-ink/10 text-ink border-ink/30',
  shu: 'bg-shu/10 text-shu-dark border-shu/40',
  leaf: 'bg-leaf/10 text-leaf border-leaf/40',
  chakra: 'bg-chakra/10 text-chakra-dark border-chakra/40',
  steel: 'bg-steel/20 text-steel-dark border-steel-dark/40',
};

export function Badge({ tone = 'ink', children, title }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 px-1.5 py-px rounded-[2px] border text-[11px] font-bold whitespace-nowrap ${BADGE_TONES[tone] || BADGE_TONES.ink}`}>
      {children}
    </span>
  );
}

export function Btn({ variant = 'ghost', className = '', ...props }) {
  const v = variant === 'primary' ? 'btn-primary' : variant === 'leaf' ? 'btn-leaf' : 'btn-ghost';
  return <button type="button" className={`btn ${v} min-h-[34px] px-2.5 py-1 text-[13px] ${className}`} {...props} />;
}

export function Field({ label, hint, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-[12px] font-bold uppercase tracking-wider text-ink-faint mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-ink-faint mt-1">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <p role="alert" className="text-[13px] font-semibold text-shu-dark bg-shu/10 border border-shu/30 px-2 py-1.5 rounded-[2px]">{children}</p>;
}

export function Empty({ children }) {
  return <p className="text-[13px] text-ink-faint italic py-3 text-center">{children}</p>;
}

export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-[13px] text-ink-soft">
      <span>{total} resultado{total === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2">
        <Btn disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</Btn>
        <span className="tabular-nums">{page} / {pages}</span>
        <Btn disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</Btn>
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for an admin action. `onConfirm` is async and returns
 * { ok, error }; the dialog stays open and shows the error when it fails.
 * Mount it conditionally (with a key) so every opening starts clean.
 */
export function ActionDialog({ title, confirmLabel = 'Confirmar', onConfirm, onClose, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const r = await onConfirm();
    setBusy(false);
    if (r && r.ok === false) setError(r.error || 'No se pudo completar');
    else onClose();
  };
  return (
    <ConfirmDialog isOpen title={title} confirmLabel={busy ? 'Un momento…' : confirmLabel} onConfirm={confirm} onCancel={onClose}>
      <div className="space-y-2 text-ink">
        {children}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </ConfirmDialog>
  );
}

/** Horizontal bars: rows = [{ label, value }] */
export function Bars({ rows, format = (v) => v, unit = '' }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <Empty>Sin datos todavía</Empty>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(4.5rem,8rem)_1fr_auto] items-center gap-2 text-[12px]">
          <span className="text-ink-soft truncate">{r.label}</span>
          <span className="h-3 bg-ink/10 rounded-[1px] overflow-hidden">
            <span className="block h-full bg-shu/80" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="tabular-nums font-bold text-ink w-12 text-right">{format(r.value)}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

/** Vertical columns for a daily series: rows = [{ day: 'YYYY-MM-DD', value }] */
export function DayColumns({ rows, label }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      <div className="flex items-end gap-[3px] h-28" role="img" aria-label={label}>
        {rows.map((r) => (
          <div key={r.day} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full" title={`${r.day}: ${r.value}`}>
            <span className="text-[10px] tabular-nums text-ink-soft leading-none mb-0.5">{r.value || ''}</span>
            <span className="w-full bg-shu/80 rounded-t-[1px]" style={{ height: `${(r.value / max) * 100}%`, minHeight: r.value ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1 border-t border-ink/30 pt-0.5">
        {rows.map((r, i) => (
          <span key={r.day} className="flex-1 min-w-0 text-center text-[9px] text-ink-faint tabular-nums">
            {i % 2 === 0 || rows.length < 8 ? r.day.slice(8) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StatusBadge({ user }) {
  const s = liveStatus(user);
  return <Badge tone={s === 'active' ? 'leaf' : 'shu'}>{STATUS_LABELS[s]}</Badge>;
}
