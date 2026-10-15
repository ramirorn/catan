import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { pieceColor } from '../../utils/theme';
import { SettlementIcon, CheckIcon, HourglassIcon } from '../Shared/Icons';

/**
 * Vote to end the game. It only ends when every ninja votes yes.
 */
export function EndGameModal({ isOpen, onClose }) {
  const { gameState, myPlayerId, voteEndGame } = useGame();
  if (!isOpen || !gameState) return null;

  const votes = gameState.endVotes || [];
  const order = gameState.playerOrder || [];
  const iVoted = votes.includes(myPlayerId);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="¿Terminar la partida?"
      maxWidth="max-w-md"
      actions={
        <>
          <button type="button" className="btn btn-ghost min-h-[42px] px-4 py-1.5" onClick={onClose}>
            Volver
          </button>
          {iVoted ? (
            <button type="button" className="btn btn-ghost min-h-[42px] px-4 py-1.5" onClick={() => voteEndGame(false)}>
              Retirar mi voto
            </button>
          ) : (
            <button type="button" className="btn btn-primary min-h-[42px] px-4 py-1.5" onClick={() => voteEndGame(true)}>
              Votar para terminar
            </button>
          )}
        </>
      }
    >
      <p className="text-ink-soft mb-4">
        La partida termina solo si <strong className="text-ink">todos los ninjas</strong> votan que sí. Al terminar se
        muestra la clasificación con los puntos de cada uno.
      </p>

      <div className="flex items-baseline justify-between mb-1">
        <span className="label-caps">Votos</span>
        <span className="font-serif font-extrabold text-lg text-ink">
          {votes.length}
          <span className="text-ink-faint"> / {order.length}</span>
        </span>
      </div>
      <ul className="border-t border-ink/15">
        {order.map((pid) => {
          const p = gameState.players?.[pid];
          if (!p) return null;
          const voted = votes.includes(pid);
          return (
            <li key={pid} className="flex items-center justify-between gap-3 py-2 border-b border-ink/15">
              <span className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-6 h-6 rounded-[3px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: pieceColor(p.color) }}
                >
                  <SettlementIcon className="w-3.5 h-3.5 text-paper-light" />
                </span>
                <span className="font-bold text-ink truncate">
                  {p.name}
                  {pid === myPlayerId && <span className="ml-1.5 font-normal italic text-ink-faint text-[13px]">(tú)</span>}
                </span>
              </span>
              {voted ? (
                <span className="inline-flex items-center gap-1 text-[13px] font-bold text-leaf shrink-0">
                  <CheckIcon className="w-4 h-4" /> <span className="max-[359px]:hidden">Quiere terminar</span><span className="min-[360px]:hidden">Sí</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[13px] italic text-ink-faint shrink-0">
                  <HourglassIcon className="w-4 h-4" /> Sin votar
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
