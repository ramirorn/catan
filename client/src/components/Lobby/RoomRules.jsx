import { Dropdown, SegmentedControl } from '../Shared/Choice';
import { ThemeSwatch } from '../Shared/ThemeSwatch';
import { DEFAULT_BOARD, boardThemeOf } from '../../utils/cosmetics';
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

/**
 * Board theme of the room (shop item). The host picks one of the boards
 * their account owns (guests only have the classic one); everybody else
 * sees which one will be used.
 */
export function BoardThemeRule({ value, catalog = [], owned = [], readOnly = false, onChange, idPrefix = 'rules', className = '', note }) {
  const current = boardThemeOf(value);
  const nameOf = (id) => catalog.find((i) => i.id === id)?.name || 'Clásico';
  if (readOnly) {
    return (
      <div className={`min-w-0 ${className}`}>
        <span className="label-caps block">Tablero</span>
        <span className="flex items-center gap-1.5 font-serif font-extrabold text-[17px] text-ink leading-tight min-w-0">
          <ThemeSwatch themeId={current} size={16} />
          <span className="truncate">{nameOf(current)}</span>
        </span>
      </div>
    );
  }
  const ids = catalog.filter((i) => i.slot === 'board' && (i.isDefault || owned.includes(i.id))).map((i) => i.id);
  if (!ids.includes(DEFAULT_BOARD)) ids.unshift(DEFAULT_BOARD);
  if (!ids.includes(current)) ids.push(current);
  const options = ids.map((id) => ({ value: id, label: nameOf(id), icon: <ThemeSwatch themeId={id} size={15} /> }));
  return (
    <div className={`min-w-0 ${className}`}>
      <span id={`${idPrefix}-board-label`} className="label-caps block mb-1">Tablero</span>
      <Dropdown
        id={`${idPrefix}-board`}
        ariaLabelledby={`${idPrefix}-board-label`}
        options={options}
        value={current}
        onChange={(v) => v !== current && onChange?.(v)}
      />
      {note && <p className="text-[11.5px] leading-snug text-ink-faint mt-1">{note}</p>}
    </div>
  );
}
