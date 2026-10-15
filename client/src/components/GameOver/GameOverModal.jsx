import { useGame } from '../../context/GameContext';
import { resetPlayerId } from '../../context/SocketContext';
import { PHASE } from '../../utils/constants';
import { pieceColor } from '../../utils/theme';
import { CrownIcon, SettlementIcon, RoadIcon, SwordsIcon } from '../Shared/Icons';
import { ScrollPanel } from '../Shared/ScrollPanel';

export function GameOverModal() {
  const { gameState, myPlayerId } = useGame();

  if (gameState?.phase !== PHASE.GAME_OVER) return null;

  const winnerId = gameState.scoring?.winnerId || gameState.winner?.id;
  const winner = winnerId ? gameState.players?.[winnerId] : null;
  const isMeWinner = winnerId === myPlayerId;

  const playerList = Object.values(gameState.players || {}).sort(
    (a, b) =>
      b.publicVP + (b.hiddenVP || 0) - (a.publicVP + (a.hiddenVP || 0))
  );

  const handlePlayAgain = () => {
    // New identity, otherwise the reload would reconnect us to this finished game
    resetPlayerId();
    window.location.reload();
  };

  return (
    <div className="modal-wrap fixed inset-0 z-50 flex items-center justify-center bg-[#070a12]/80 animate-fade-in">
      <ScrollPanel as="div" className="animate-modal-pop max-w-md w-full" bodyClassName="modal-sheet px-5 sm:px-8 pt-7 phland:pt-4 pb-6 phland:pb-4 text-center overflow-y-auto">
        {/* Crest */}
        <div className="mx-auto mb-3 w-16 h-16 phland:w-12 phland:h-12 flex hanko -rotate-6 !rounded-[10px] shadow-[inset_0_0_0_2px_rgba(251,241,224,0.6),0_3px_0_#5a140a]">
          <CrownIcon className="w-9 h-9 text-paper-light" />
        </div>

        <h1 className="font-display text-[26px] min-[360px]:text-[30px] sm:text-[34px] phland:text-[26px] leading-tight text-ink mb-1">
          {gameState.endedByAgreement
            ? 'Misión terminada'
            : isMeWinner ? '¡La victoria es tuya!' : `¡${winner?.name || 'Un ninja'} se impone!`}
        </h1>
        <p className="text-[14px] italic text-ink-soft mb-5">
          {gameState.endedByAgreement
            ? 'Todos los ninjas acordaron terminar la partida. Así quedaron los puntos:'
            : `La misión ha concluido: alguien alcanzó ${gameState.vpToWin ?? 10} o más Puntos de Victoria.`}
        </p>

        {/* Final Standings */}
        <div className="text-left mb-6">
          <div className="label-caps mb-1">Clasificación final</div>
          <hr className="brush-rule" />
          <ol>
            {playerList.map((p, rank) => {
              const totalVp = p.publicVP + (p.hiddenVP || 0);
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between gap-3 py-2.5 border-b border-dashed border-ink/20 ${
                    rank === 0 ? 'font-bold' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`font-serif font-extrabold w-6 text-center ${rank === 0 ? 'text-shu text-2xl' : 'text-ink-faint text-lg'}`}>
                      {rank + 1}
                    </span>
                    <span
                      className="w-6 h-6 rounded-[3px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: pieceColor(p.color) }}
                    >
                      <SettlementIcon className="w-3.5 h-3.5 text-paper-light" />
                    </span>
                    <span className="text-ink truncate">{p.name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-ink-soft shrink-0">
                    {p.hasLongestRoad && (
                      <span title="Camino más largo">
                        <RoadIcon className="w-4 h-4" />
                      </span>
                    )}
                    {p.hasLargestArmy && (
                      <span title="Gran ejército">
                        <SwordsIcon className="w-4 h-4" />
                      </span>
                    )}
                    <span className="font-serif font-extrabold text-xl text-ink">{totalVp}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">PV</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <button type="button" onClick={handlePlayAgain} className="btn btn-primary w-full min-h-[44px] py-3 text-[15px]">
          Jugar una nueva partida
        </button>
      </ScrollPanel>
    </div>
  );
}
