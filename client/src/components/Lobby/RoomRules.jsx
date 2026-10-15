import { Dropdown } from '../Shared/Choice';
import { VP_TO_WIN_OPTIONS, TURN_TIME_OPTIONS, DEFAULT_VP_TO_WIN, turnTimeLabel } from '../../utils/constants';

// Compact room rules: victory points target + time limit per turn.
// Themed dropdowns for the host, plain values for everyone else.
export function RoomRules({ vpToWin = DEFAULT_VP_TO_WIN, turnTimeLimit = 0, onChange, readOnly = false, idPrefix = 'rules', className = '' }) {
  if (readOnly) {
    return (
      <div className={`grid grid-cols-2 gap-2 ${className}`}>
        <div>
          <span className="label-caps block">Puntos para ganar</span>
          <span className="font-serif font-extrabold text-[17px] text-ink leading-tight">{vpToWin} PV</span>
        </div>
        <div>
          <span className="label-caps block">Tiempo por turno</span>
          <span className="font-serif font-extrabold text-[17px] text-ink leading-tight">{turnTimeLabel(turnTimeLimit)}</span>
        </div>
      </div>
    );
  }

  const vpOptions = VP_TO_WIN_OPTIONS.map((vp) => ({ value: vp, label: `${vp} PV` }));

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <div>
        <span id={`${idPrefix}-vp-label`} className="label-caps block mb-1">Puntos para ganar</span>
        <Dropdown
          id={`${idPrefix}-vp`}
          ariaLabelledby={`${idPrefix}-vp-label`}
          options={vpOptions}
          value={vpToWin}
          onChange={(v) => onChange?.({ vpToWin: Number(v) })}
        />
      </div>
      <div>
        <span id={`${idPrefix}-time-label`} className="label-caps block mb-1">Tiempo por turno</span>
        <Dropdown
          id={`${idPrefix}-time`}
          ariaLabelledby={`${idPrefix}-time-label`}
          options={TURN_TIME_OPTIONS}
          value={turnTimeLimit}
          onChange={(v) => onChange?.({ turnTimeLimit: Number(v) })}
        />
      </div>
    </div>
  );
}
