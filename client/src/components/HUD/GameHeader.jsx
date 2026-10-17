import { useEffect, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useSocket } from '../../context/SocketContext';
import { pieceColor } from '../../utils/theme';
import { FlagIcon, HourglassIcon, EyeIcon, MenuIcon } from '../Shared/Icons';
import { formatDuration, useGameElapsed } from '../../utils/gameClock';
import { BrandPlate } from '../Shared/Brand';
import { Avatar } from '../Shared/Avatar';

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
  const {
    gameState, myPlayerId, isMyTurn, setActiveModal, serverOffset,
    isSpectator, spectators,
  } = useGame();
  const elapsed = useGameElapsed(gameState?.startedAt, gameState?.endedAt, serverOffset);
  const gameOver = gameState?.phase === 'gameOver';
  const msLeft = useCountdown(gameState?.turnDeadline, serverOffset);
  const secondsLeft = msLeft === null ? null : Math.ceil(msLeft / 1000);
  const lowTime = secondsLeft !== null && secondsLeft <= 10;
  const limitMs = (gameState?.turnTimeLimit || 0) * 1000;
  const timeFraction = msLeft === null || !limitMs ? null : Math.max(0, Math.min(1, msLeft / limitMs));
  const isDiscardPhase = gameState?.phase === 'robberDiscard';
  const { connected } = useSocket();

  const currentTurnPlayer = gameState?.players?.[gameState.currentPlayerId];
  const pillPlayer = currentTurnPlayer;
  const pillMine = isMyTurn;
  const pillText = isMyTurn ? 'Tu turno' : `Turno de ${currentTurnPlayer?.name}`;

  const turnColor = pieceColor(pillPlayer?.color);

  const endVotes = gameState?.endVotes || [];
  // Players who left the game don't vote
  const totalPlayers = (gameState?.playerOrder || []).filter((pid) => !gameState?.players?.[pid]?.left).length;
  const iVotedEnd = endVotes.includes(myPlayerId);
  // Someone wants to end and is waiting on me
  const endVotePending = endVotes.length > 0 && !iVotedEnd;

  return (
    <header className="hud-head night-rail safe-x [--pad-x:0.6rem] min-[360px]:[--pad-x:0.75rem] sm:[--pad-x:1.25rem] relative h-[calc(3rem+env(safe-area-inset-top))] sm:h-[calc(3.5rem+env(safe-area-inset-top))] phland:h-[calc(2.75rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] flex items-center justify-between gap-2 sm:gap-3 z-20 shrink-0 min-w-0 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.8)]">
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
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <BrandPlate className="w-8 h-[21px] sm:w-9 sm:h-6" />
          <span className="hidden min-[440px]:inline phland:hidden lg:inline font-display text-[22px] leading-none text-paper-light whitespace-nowrap">
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
      <div className="flex items-center justify-end gap-1.5 min-[360px]:gap-2 sm:gap-3 min-w-0">
        {pillPlayer && (
          <div
            className={`flex items-center gap-1.5 min-[360px]:gap-2 pl-1 pr-2.5 min-[360px]:pr-3 py-1 phland:py-0.5 rounded-full border min-w-0 transition-colors ${
              pillMine
                ? 'pill-mine bg-gradient-to-b from-chakra-light to-chakra text-ink border-paper-light'
                : 'bg-black/30 text-paper/85 border-paper/15'
            }`}
          >
            <Avatar id={pillPlayer.avatarId} size={26} ring={turnColor} className="phland:!w-[22px] phland:!h-[22px]" />
            <span className={`text-[13px] truncate ${pillMine ? 'font-extrabold sm:uppercase sm:tracking-[0.06em]' : 'font-bold'}`}>
              {pillText}
            </span>
            {secondsLeft !== null && (
              <span
                className={`flex items-center gap-1 pl-1.5 min-[360px]:pl-2 border-l font-serif font-extrabold text-[15px] tabular-nums shrink-0 ${
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

        {/* Game clock (everyone, spectators too); stops at game over */}
        {elapsed !== null && (
          <span
            className={`shrink-0 font-serif font-extrabold text-[12px] sm:text-[13px] tabular-nums leading-none ${gameOver ? 'text-paper/45' : 'text-paper/75'}`}
            title={gameOver ? 'Duración de la partida' : 'Tiempo de partida'}
            aria-label={`Duración de la partida: ${formatDuration(elapsed)}`}
            role="timer"
          >
            {formatDuration(elapsed)}
          </span>
        )}

        {/* Spectators: badge for them, eye + count for the players */}
        {isSpectator ? (
          <span
            className="flex items-center gap-1 shrink-0 px-1.5 sm:px-2 py-1 rounded-[3px] border border-chakra/70 bg-chakra/15 text-chakra-light text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.06em]"
            title="Estás observando la partida"
          >
            <EyeIcon className="w-4 h-4" />
            <span className="hidden min-[440px]:inline">Observando</span>
          </span>
        ) : spectators.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveModal('roomMenu')}
            className="hidden min-[360px]:flex items-center gap-1 shrink-0 text-paper/70 hover:text-paper-light text-[12px] font-bold tabular-nums cursor-pointer"
            title={`Observando: ${spectators.map((sp) => sp.name).join(', ')}`}
            aria-label={`${spectators.length} espectadores`}
          >
            <EyeIcon className="w-4 h-4" />
            {spectators.length}
          </button>
        )}

        {/* End game by unanimous vote (also in the menu; on narrow phones only while a vote is open) */}
        {!isSpectator && (
        <button
          type="button"
          onClick={() => setActiveModal('endGame')}
          className={`${endVotePending ? 'flex' : 'hidden min-[400px]:flex'} items-center justify-center gap-1.5 min-h-[36px] min-w-[36px] shrink-0 px-2 sm:px-2.5 py-1 rounded-[3px] border text-[12px] font-bold transition-colors cursor-pointer ${
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
        )}

        {/* Room menu: players & spectators, kick (host), leave */}
        <button
          type="button"
          onClick={() => setActiveModal('roomMenu')}
          className="flex items-center justify-center min-h-[36px] min-w-[36px] shrink-0 px-1.5 rounded-[3px] border border-paper/20 text-paper/70 hover:text-paper-light hover:border-paper/45 cursor-pointer"
          title="Menú de la sala"
          aria-label="Menú de la sala"
        >
          <MenuIcon className="w-4.5 h-4.5" />
        </button>

        {/* Connection status */}
        <div
          className="flex items-center gap-1.5 text-xs shrink-0"
          title={connected ? 'Conectado al servidor' : 'Desconectado'}
          role="status"
          aria-label={connected ? 'Conectado al servidor' : 'Desconectado'}
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
