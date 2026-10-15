import { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';
import { pieceColor } from '../../utils/theme';
import { SettlementIcon, FlagIcon, HourglassIcon } from '../Shared/Icons';
import { BrandPlate } from '../Shared/Brand';

// Seconds left until the server's turn deadline (null when there is no limit)
function useCountdown(deadline, serverOffset) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return undefined;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, deadline - (now + serverOffset));
}

function formatSeconds(total) {
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function GameHeader() {
  const { gameState, myPlayerId, isMyTurn, isSpecialBuild, isMySpecialBuild, setActiveModal, serverOffset } = useGame();
  const msLeft = useCountdown(gameState?.turnDeadline, serverOffset);
  const secondsLeft = msLeft === null ? null : Math.ceil(msLeft / 1000);
  const lowTime = secondsLeft !== null && secondsLeft <= 10;
  const limitMs = (gameState?.turnTimeLimit || 0) * 1000;
  const timeFraction = msLeft === null || !limitMs ? null : Math.max(0, Math.min(1, msLeft / limitMs));
  const isDiscardPhase = gameState?.phase === 'robberDiscard';
  const { connected } = useSocket();

  const currentTurnPlayer = gameState?.players?.[gameState.currentPlayerId];
  // During the special building phase the pill shows who is building
  const specialBuilder = isSpecialBuild ? gameState?.players?.[gameState.specialBuilderId] : null;
  const pillPlayer = specialBuilder || currentTurnPlayer;
  const pillMine = isSpecialBuild ? isMySpecialBuild : isMyTurn;
  const pillText = isSpecialBuild
    ? (isMySpecialBuild ? 'Tu construcción especial' : `Construye ${specialBuilder?.name || ''}`)
    : (isMyTurn ? 'Tu turno' : `Turno de ${currentTurnPlayer?.name}`);

  const turnColor = pieceColor(pillPlayer?.color);

  const endVotes = gameState?.endVotes || [];
  const totalPlayers = gameState?.playerOrder?.length || 0;
  const iVotedEnd = endVotes.includes(myPlayerId);
  // Someone wants to end and is waiting on me
  const endVotePending = endVotes.length > 0 && !iVotedEnd;

  return (
    <header className="night-rail relative h-14 px-3 sm:px-5 flex items-center justify-between gap-3 z-20 shrink-0 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.8)]">
      {/* Headband stripe */}
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-chakra" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-[3px] h-px bg-black/70" aria-hidden="true" />

      {/* Turn timer: a slim bar everyone can read, red in the last 10 s */}
      {timeFraction !== null && (
        <div className="timer-track" aria-hidden="true">
          <div
            className={`timer-fill ${lowTime ? 'is-low' : ''}`}
            style={{
              transform: `scaleX(${timeFraction})`,
              backgroundColor: lowTime ? 'var(--color-shu-light)' : turnColor,
              boxShadow: lowTime ? '0 0 8px rgba(212, 73, 47, 0.9)' : undefined,
            }}
          />
        </div>
      )}

      {/* Brand & Room Info */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <BrandPlate className="w-9 h-6" />
          <span className="hidden min-[440px]:inline font-display text-[22px] leading-none text-paper-light whitespace-nowrap">
            Catán <span className="text-chakra-light">Shinobi</span>
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 pl-3 sm:pl-4 border-l border-paper/15 text-xs">
          <span className="text-paper/55 uppercase tracking-[0.14em] font-bold text-[10px]">Sala</span>
          <span className="font-serif font-extrabold text-paper-light tracking-[0.14em] text-[13px] px-1.5 py-0.5 border border-shu-light/80 bg-shu/25 rounded-[2px]">
            {gameState?.roomId}
          </span>
        </div>
      </div>

      {/* Turn & Status info */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {pillPlayer && (
          <div
            title={isSpecialBuild ? 'Fase especial de construcción' : undefined}
            className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border min-w-0 transition-colors ${
              pillMine
                ? 'pill-mine bg-gradient-to-b from-chakra-light to-chakra text-ink border-paper-light'
                : 'bg-black/30 text-paper/85 border-paper/15'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)] ring-1 ${
                pillMine ? 'ring-ink/70' : 'ring-black/40'
              }`}
              style={{ backgroundColor: turnColor }}
            >
              <SettlementIcon className="w-3.5 h-3.5 text-paper-light" />
            </span>
            <span className={`text-[13px] truncate ${pillMine ? 'font-extrabold sm:uppercase sm:tracking-[0.06em]' : 'font-bold'}`}>
              {pillText}
            </span>
            {secondsLeft !== null && (
              <span
                className={`flex items-center gap-1 pl-2 border-l font-serif font-extrabold text-[15px] tabular-nums shrink-0 ${
                  pillMine ? 'border-ink/30' : 'border-paper/20'
                } ${
                  lowTime
                    ? `${pillMine ? 'text-shu-dark' : 'text-shu-light'} animate-pulse`
                    : pillMine ? 'text-ink' : 'text-paper-light'
                }`}
                title={isDiscardPhase ? 'Tiempo para descartar' : 'Tiempo restante del turno'}
                role="timer"
                aria-label={`Tiempo restante: ${secondsLeft} segundos`}
              >
                <HourglassIcon className="w-3.5 h-3.5" />
                {formatSeconds(secondsLeft)}
              </span>
            )}
          </div>
        )}

        {/* Turn Number */}
        <div className="hidden md:flex items-baseline gap-1 text-paper/60 text-xs">
          <span className="uppercase tracking-[0.14em] font-bold text-[10px]">Ronda</span>
          <span className="font-serif font-extrabold text-paper/90 text-sm">{gameState?.turnNumber || 1}</span>
        </div>

        {/* End game by unanimous vote */}
        <button
          type="button"
          onClick={() => setActiveModal('endGame')}
          className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-[3px] border text-[12px] font-bold transition-colors cursor-pointer ${
            endVotePending
              ? 'border-chakra bg-chakra/20 text-chakra-light animate-turn-pulse'
              : 'border-paper/20 text-paper/70 hover:text-paper-light hover:border-paper/45'
          }`}
          title="Terminar la partida (por votación unánime)"
          aria-label="Terminar la partida"
        >
          <FlagIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Terminar</span>
          {endVotes.length > 0 && (
            <span className="font-serif">{endVotes.length}/{totalPlayers}</span>
          )}
        </button>

        {/* Connection status */}
        <div
          className="flex items-center gap-1.5 text-xs"
          title={connected ? 'Conectado al servidor' : 'Desconectado'}
        >
          <span
            className={`w-2 h-2 rounded-full ring-2 ring-black/40 ${
              connected ? 'bg-[#8fbf5e]' : 'bg-shu-light'
            }`}
          />
          <span className="hidden lg:inline text-paper/60 text-[12px]">
            {connected ? 'En línea' : 'Desconectado'}
          </span>
        </div>
      </div>
    </header>
  );
}
