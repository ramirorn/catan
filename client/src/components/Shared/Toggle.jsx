/**
 * Themed on/off switch (replaces native checkboxes): a lacquered track with
 * a paper knob. `label` and `hint` sit to its right and are part of the
 * click target.
 */
export function Toggle({ checked, onChange, label, hint, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`toggle ${checked ? 'is-on' : ''} ${className}`}
    >
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-knob" />
      </span>
      {(label || hint) && (
        <span className="min-w-0 text-left">
          {label && <span className="block font-semibold text-ink leading-tight">{label}</span>}
          {hint && <span className="block text-[12px] text-ink-faint leading-snug">{hint}</span>}
        </span>
      )}
    </button>
  );
}
