import { useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useGame } from '../context/GameContext';
import { BoardView } from '../components/Board/BoardView';
import { DiceOverlay } from '../components/Dice3D/DiceOverlay';
import { ScoreBoard } from '../components/HUD/ScoreBoard';
import { GameLog } from '../components/HUD/GameLog';
import { PlayerAvatar } from '../components/Shared/Avatar';
import { EyeIcon } from '../components/Shared/Icons';
import { PHASE_LABELS } from './format';

/**
 * Hidden, read-only observer: the server streams the public spectator view of
 * the room to this admin socket without listing it as a spectator. Reuses the
 * game's own board, scoreboard and log.
 */
export function ObserveView({ roomId, hasState, onClose }) {
  const { socket, connected } = useSocket();
  const { gameState, resetToMenu, addToast } = useGame();
  const [error, setError] = useState('');
  const sawState = useRef(false);

  useEffect(() => {
    if (!socket || !connected) return undefined;
    resetToMenu();
    socket.emit('admin:observe', { roomId }, (res) => {
      if (!res || !res.success) setError((res && res.error) || 'No se pudo observar la sala');
    });
    return () => {
      socket.emit('admin:unobserve', {}, () => {});
      resetToMenu();
    };
  }, [socket, connected, roomId, resetToMenu]);

  // The room was closed while watching (roomClosed resets the game state)
  useEffect(() => {
    if (hasState) sawState.current = true;
    else if (sawState.current) {
      sawState.current = false;
      onClose();
    }
  }, [hasState, onClose]);

  useEffect(() => {
    if (!error) return;
    addToast(error, 'error', 5000);
    onClose();
  }, [error, addToast, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const state = gameState && gameState.roomId === roomId ? gameState : null;

  return (
    <div className="game-ui fixed inset-0 z-40 flex flex-col night-surface text-ink" role="dialog" aria-modal="true" aria-label={`Observando la sala ${roomId}`}>
      <div className="night-rail flex items-center gap-3 px-3 sm:px-4 py-2 border-b-2 border-black/70 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <EyeIcon className="w-5 h-5 text-chakra-light shrink-0" />
        <div className="min-w-0">
          <p className="font-display text-paper-light text-[17px] leading-tight truncate">
            Sala <span className="font-mono">{roomId}</span>
            {state && <span className="text-paper/70 text-[13px] font-sans"> · {PHASE_LABELS[state.phase] || state.phase}{state.turnNumber ? ` · ronda ${state.turnNumber}` : ''}</span>}
          </p>
          <p className="text-[12px] text-paper/60 leading-tight">Observación oculta de solo lectura: nadie te ve en la sala ni puedes jugar o escribir.</p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-primary ml-auto min-h-[36px] px-3 py-1 text-[13px] shrink-0">
          Dejar de observar
        </button>
      </div>

      {!state ? (
        <div className="flex-1 flex items-center justify-center text-paper/70" aria-busy="true">Conectando con la sala…</div>
      ) : !state.board ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="paper max-w-md mx-auto rounded-[2px] border border-paper-edge p-4">
            <h2 className="font-display text-[20px]">Sala de espera</h2>
            <ul className="mt-3 space-y-2">
              {state.playerOrder.map((pid) => {
                const p = state.players[pid];
                return p ? (
                  <li key={pid} className="flex items-center gap-2 text-[14px]">
                    <PlayerAvatar player={p} size={28} />
                    <span className="font-bold">{p.name}</span>
                    {state.hostId === pid && <span className="text-[12px] text-ink-faint">(anfitrión)</span>}
                  </li>
                ) : null;
              })}
            </ul>
            <p className="mt-3 text-[13px] text-ink-faint">Espectadores: {state.spectators?.length || 0}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">
          <main className="relative flex-1 min-h-[45dvh] min-w-0 flex items-center justify-center overflow-hidden">
            <BoardView />
            <DiceOverlay />
          </main>
          <aside className="paper relative w-full md:w-80 shrink-0 flex flex-col max-h-[45dvh] md:max-h-none border-t-[3px] md:border-t-0 md:border-l-[3px] border-ink overflow-hidden">
            <ScoreBoard />
            <GameLog />
          </aside>
        </div>
      )}
    </div>
  );
}
