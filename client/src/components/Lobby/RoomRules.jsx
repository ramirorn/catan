import { Dropdown, SegmentedControl } from '../Shared/Choice';
import { VP_TO_WIN_OPTIONS, TURN_TIME_OPTIONS, DEFAULT_VP_TO_WIN, turnTimeLabel } from '../../utils/constants';

const PACT_OPTIONS = [
  { value: true, label: 'Sí' },
  { value: false, label: 'No' },
];
const PACT_HELP = 'Pacto de paz: al mover el ladrón puedes pedirle hasta 2 cartas a un ninja a cambio de no atacarlo';

const GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2';
// Short labels on narrow phones, so the three rules fit in one row
const Label = ({ id, long, short, className = '' }) => (
  <span id={id} className={`label-caps block truncate ${className}`}>
    <span className="max-[419px]:hidden">{long}</span>
    <span className="min-[420px]:hidden" aria-hidden="true">{short}</span>
  </span>
);

// Compact room rules: victory points target, time limit per turn and the
// «Pacto de paz» house rule. Themed selectors for the host, plain values for
// everyone else.
export function RoomRules({
  vpToWin = DEFAULT_VP_TO_WIN,
  turnTimeLimit = 0,
  peacePacts = true,
  onChange,
  readOnly = false,
  idPrefix = 'rules',
  className = '',
}) {
  if (readOnly) {
    return (
      <div className={`${GRID} ${className}`}>
        <div className="min-w-0">
          <Label long="Puntos" short="Puntos" />
          <span className="font-serif font-extrabold text-[17px] text-ink leading-tight">{vpToWin} PV</span>
        </div>
        <div className="min-w-0">
          <Label long="Tiempo por turno" short="Tiempo" />
          <span className="font-serif font-extrabold text-[17px] text-ink leading-tight">{turnTimeLabel(turnTimeLimit)}</span>
        </div>
        <div className="min-w-0" title={PACT_HELP}>
          <span className="label-caps block">Pactos</span>
          <span className="font-serif font-extrabold text-[17px] text-ink leading-tight">{peacePacts ? 'Sí' : 'No'}</span>
        </div>
      </div>
    );
  }

  const vpOptions = VP_TO_WIN_OPTIONS.map((vp) => ({ value: vp, label: `${vp} PV` }));

  return (
    <div className={`${GRID} ${className}`}>
      <div className="min-w-0">
        <Label id={`${idPrefix}-vp-label`} long="Puntos" short="Puntos" className="mb-1" />
        <Dropdown
          id={`${idPrefix}-vp`}
          ariaLabelledby={`${idPrefix}-vp-label`}
          options={vpOptions}
          value={vpToWin}
          onChange={(v) => onChange?.({ vpToWin: Number(v) })}
        />
      </div>
      <div className="min-w-0">
        <Label id={`${idPrefix}-time-label`} long="Tiempo por turno" short="Tiempo" className="mb-1" />
        <Dropdown
          id={`${idPrefix}-time`}
          ariaLabelledby={`${idPrefix}-time-label`}
          options={TURN_TIME_OPTIONS}
          value={turnTimeLimit}
          onChange={(v) => onChange?.({ turnTimeLimit: Number(v) })}
        />
      </div>
      <div className="min-w-0" title={PACT_HELP}>
        <span id={`${idPrefix}-pact-label`} className="label-caps block mb-1">Pactos</span>
        <SegmentedControl
          ariaLabelledby={`${idPrefix}-pact-label`}
          options={PACT_OPTIONS}
          value={peacePacts !== false}
          onChange={(v) => onChange?.({ peacePacts: v === true })}
          className="!flex-nowrap"
          chipClassName="rules-pact-chip"
        />
      </div>
    </div>
  );
}
