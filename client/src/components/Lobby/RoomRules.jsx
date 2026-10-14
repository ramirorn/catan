import { VP_TO_WIN_OPTIONS, TURN_TIME_OPTIONS, DEFAULT_VP_TO_WIN, turnTimeLabel } from '../../utils/constants';

// Compact room rules: victory points target + time limit per turn.
// Editable selects for the host, plain values for everyone else.
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

  const selectClass = 'field !py-1.5 !text-[14px] font-bold cursor-pointer';

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      <div>
        <label htmlFor={`${idPrefix}-vp`} className="label-caps block mb-1">Puntos para ganar</label>
        <select
          id={`${idPrefix}-vp`}
          className={selectClass}
          value={vpToWin}
          onChange={(e) => onChange?.({ vpToWin: Number(e.target.value) })}
        >
          {VP_TO_WIN_OPTIONS.map((vp) => (
            <option key={vp} value={vp}>{vp} PV</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-time`} className="label-caps block mb-1">Tiempo por turno</label>
        <select
          id={`${idPrefix}-time`}
          className={selectClass}
          value={turnTimeLimit}
          onChange={(e) => onChange?.({ turnTimeLimit: Number(e.target.value) })}
        >
          {TURN_TIME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
