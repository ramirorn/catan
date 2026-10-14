import { useGame } from '../../context/GameContext';
import { PHASE } from '../../utils/constants';
import { DiceIcon } from '../Shared/Icons';

const PIPS = {
  1: [[12, 12]],
  2: [[7.5, 7.5], [16.5, 16.5]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7.5, 7.5], [16.5, 7.5], [7.5, 16.5], [16.5, 16.5]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7.5, 6.5], [16.5, 6.5], [7.5, 12], [16.5, 12], [7.5, 17.5], [16.5, 17.5]],
};

export function DiceRoll() {
  const { gameState, isMyTurn, rollDice, isRolling } = useGame();

  const isRollPhase = gameState?.phase === PHASE.ROLL_DICE && isMyTurn;
  const lastRoll = gameState?.lastDiceRoll;

  const renderDie = (val, idx) => {
    const pips = PIPS[val] || [];
    return (
      <svg
        key={`${idx}-${val}-${lastRoll?.total}`}
        viewBox="0 0 24 24"
        className={`w-8 h-8 sm:w-10 sm:h-10 drop-shadow-[0_3px_3px_rgba(0,0,0,0.5)] ${
          isRolling ? 'animate-dice-tumble' : 'animate-dice-settle'
        }`}
        style={isRolling && idx === 1 ? { animationDelay: '-0.2s' } : undefined}
        role="img"
        aria-label={`Dado: ${val}`}
      >
        <rect x="1" y="1" width="22" height="22" rx="4.5" fill="#f4ecda" />
        <rect x="1" y="1" width="22" height="22" rx="4.5" fill="none" stroke="#1f1b17" strokeWidth="1" />
        <path d="M3 21.5 Q2 12 3.5 3" stroke="#fff" strokeOpacity="0.5" strokeWidth="1" fill="none" />
        {pips.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={val === 1 ? 3 : 2} fill={val === 1 ? '#b6331f' : '#1f1b17'} />
        ))}
      </svg>
    );
  };

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      {lastRoll && (
        <div
          className={`${isRollPhase ? 'hidden sm:flex' : 'flex'} items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-[4px] bg-black/30 border border-paper/10 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]`}
          title={`Tirada Total: ${lastRoll.total}`}
        >
          {renderDie(lastRoll.die1, 0)}
          {renderDie(lastRoll.die2, 1)}
          <div
            className={`pl-1 sm:pl-1.5 font-serif font-extrabold text-xl sm:text-2xl leading-none min-w-[1.6ch] text-center ${
              lastRoll.total === 7 ? 'text-shu-light' : 'text-paper-light'
            }`}
          >
            {lastRoll.total}
          </div>
        </div>
      )}

      {isRollPhase && (
        <button
          type="button"
          onClick={rollDice}
          disabled={isRolling}
          className="btn btn-primary px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap"
        >
          <DiceIcon className={`w-5 h-5 ${isRolling ? 'animate-dice-tumble' : ''}`} />
          <span>{isRolling ? 'Tirando…' : 'Lanzar dados'}</span>
        </button>
      )}
    </div>
  );
}
