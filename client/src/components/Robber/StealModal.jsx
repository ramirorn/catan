import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { pieceColor } from '../../utils/theme';
import { RobberIcon, SettlementIcon, CardsIcon } from '../Shared/Icons';
import { useStageReady } from '../Effects/fxSignal';

export function StealModal({ isOpen: wantOpen, onClose }) {
  const { gameState, robberVictims, stealCard } = useGame();
  // Wait for the dice / the renegade's leap (or a Knight) before asking
  const isOpen = useStageReady(wantOpen);

  if (!isOpen || !robberVictims || robberVictims.length === 0) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Robar una carta" maxWidth="max-w-md">
      <div className="flex items-start gap-3 mb-4">
        <RobberIcon className="w-9 h-9 text-ink shrink-0" />
        <p className="text-[14px] text-ink-soft leading-relaxed">
          ¡El ladrón renegado bloqueó este hexágono! Elige a un ninja vecino para arrebatarle 1 carta de recurso al azar.
        </p>
      </div>

      <ul className="border-t border-ink/15">
        {robberVictims.map((pid) => {
          const player = gameState?.players?.[pid];
          if (!player) return null;
          const totalCards =
            player.totalResources ??
            (player.resources ? Object.values(player.resources).reduce((a, b) => a + b, 0) : 0);

          return (
            <li key={pid} className="border-b border-ink/15">
              <button
                type="button"
                onClick={() => stealCard(pid)}
                className="w-full min-h-[52px] flex items-center justify-between gap-2 min-[360px]:gap-3 py-2.5 px-1 hover:bg-ink/5 transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-7 h-7 rounded-[3px] flex items-center justify-center shrink-0 shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]"
                    style={{ backgroundColor: pieceColor(player.color) }}
                  >
                    <SettlementIcon className="w-4 h-4 text-paper-light" />
                  </span>
                  <span className="font-bold text-[15px] text-ink truncate">{player.name}</span>
                </span>
                <span className="flex items-center gap-2 min-[360px]:gap-3 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[13px] text-ink-faint">
                    <CardsIcon className="w-4 h-4" />
                    {totalCards}<span className="max-[359px]:sr-only"> cartas</span>
                  </span>
                  <span className="btn btn-primary px-3 py-1 text-[13px]">Robar</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
