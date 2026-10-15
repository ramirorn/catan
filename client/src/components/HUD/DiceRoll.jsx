import { useGame } from '../../context/GameContext';
import { PHASE } from '../../utils/constants';
import { DiceIcon } from '../Shared/Icons';
import { useDiceBusy } from '../Dice3D/diceSignal';

const PIPS = {
  1: [[12, 12]],
  2: [[7.5, 7.5], [16.5, 16.5]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7.5, 7.5], [16.5, 7.5], [7.5, 16.5], [16.5, 16.5]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7.5, 6.5], [16.5, 6.5], [7.5, 12], [16.5, 12], [7.5, 17.5], [16.5, 17.5]],
};

/** One flat die face (SVG). value null = blank face (dice still in the air). */
export function DieFace({ value, className = '', style, label = true }) {
  const pips = PIPS[value] || [];
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label ? `Dado: ${value ?? '?'}` : undefined}
    >
      <rect x="1" y="1" width="22" height="22" rx="4.5" fill="#f4ecda" />
      <rect x="1" y="1" width="22" height="22" rx="4.5" fill="none" stroke="#1f1b17" strokeWidth="1" />
      <path d="M3 21.5 Q2 12 3.5 3" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" fill="none" />
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={value === 1 ? 3 : 2} fill={value === 1 ? '#b6331f' : '#1f1b17'} />
      ))}
    </svg>
  );
}

export function DiceRoll() {
  const { gameState, isMyTurn, rollDice, isRolling } = useGame();
  // While the 3D throw is on screen the footer dice tumble blank (no spoiler)
  const diceBusy = useDiceBusy();
  const tumbling = isRolling || diceBusy;

  const isRollPhase = gameState?.phase === PHASE.ROLL_DICE && isMyTurn;
  const lastRoll = gameState?.lastDiceRoll;

  const renderDie = (val, idx) => (
    <DieFace
      key={`${idx}-${val}-${lastRoll?.id ?? lastRoll?.total}-${tumbling}`}
      value={diceBusy ? null : val}
      label={!diceBusy}
      className={`w-[clamp(22px,7.2vw,34px)] h-[clamp(22px,7.2vw,34px)] sm:w-10 sm:h-10 phland:w-7 phland:h-7 drop-shadow-[0_3px_3px_rgba(0,0,0,0.5)] ${
        tumbling ? 'animate-dice-tumble' : 'animate-dice-settle'
      }`}
      style={tumbling && idx === 1 ? { animationDelay: '-0.2s' } : undefined}
    />
  );

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      {lastRoll && (
        <div
          className={`${isRollPhase ? 'hidden sm:flex phland:hidden' : 'flex'} items-center gap-1 sm:gap-1.5 pl-1 sm:pl-1.5 pr-2 sm:pr-2.5 py-1 rounded-[4px] bg-black/30 border border-paper/10 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]`}
          title={diceBusy ? 'Tirando…' : `Tirada Total: ${lastRoll.total}`}
        >
          {renderDie(lastRoll.die1, 0)}
          {renderDie(lastRoll.die2, 1)}
          <div
            className={`pl-1 sm:pl-1.5 font-serif font-extrabold text-xl sm:text-2xl phland:text-xl leading-none min-w-[1.6ch] text-center ${
              lastRoll.total === 7 && !diceBusy ? 'text-shu-light' : 'text-paper-light'
            }`}
          >
            {diceBusy ? '·' : lastRoll.total}
          </div>
        </div>
      )}

      {isRollPhase && (
        <button
          type="button"
          onClick={rollDice}
          disabled={isRolling}
          className={`btn btn-primary min-h-[44px] px-3 sm:px-5 py-2.5 text-sm sm:text-[15px] whitespace-nowrap ${isRolling ? '' : 'btn-cta'}`}
        >
          <DiceIcon className={`w-5 h-5 ${isRolling ? 'animate-dice-tumble' : ''}`} />
          {isRolling ? (
            <span>Tirando…</span>
          ) : (
            <>
              <span className="hidden min-[400px]:inline">Lanzar dados</span>
              <span className="min-[400px]:hidden">Lanzar</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
