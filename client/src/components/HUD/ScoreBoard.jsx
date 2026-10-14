import { useGame } from '../../context/GameContext';
import { pieceColor } from '../../utils/theme';
import { SettlementIcon, RoadIcon, SwordsIcon, CardsIcon, TurnMarkerIcon } from '../Shared/Icons';
import { ResourceChip } from '../Shared/ResourceCard';
import { RESOURCE_NAMES } from '../../utils/constants';

const BANK_ORDER = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

export function ScoreBoard() {
  const { gameState, myPlayerId } = useGame();

  if (!gameState?.players) return null;

  const playerOrder = gameState.playerOrder || [];
  const players = playerOrder.map((pid) => gameState.players[pid]).filter(Boolean);

  return (
    <section className="px-4 pt-4 pb-3 shrink-0">
      <div className="flex items-baseline justify-between mb-2 pr-9 md:pr-0">
        <h2 className="font-display text-[23px] leading-none text-ink">Ninjas</h2>
        <span className="label-caps !text-[10px]">{gameState.vpToWin ?? 10} PV para ganar</span>
      </div>
      <hr className="brush-rule mb-1" />

      <ul>
        {players.map((p) => {
          const isCurrentTurn = p.id === gameState.currentPlayerId;
          const isMe = p.id === myPlayerId;
          const totalCards =
            p.totalResources ??
            (p.resources ? Object.values(p.resources).reduce((a, b) => a + b, 0) : 0);
          const color = pieceColor(p.color);

          return (
            <li
              key={p.id}
              className={`relative flex items-center gap-2.5 pl-4 pr-1 py-2 border-b border-dashed border-ink/15 last:border-b-0 transition-colors ${
                isCurrentTurn ? "bg-chakra/15" : ""
              }`}
            >
              {/* Turn marker */}
              {isCurrentTurn && (
                <TurnMarkerIcon className="absolute -left-0.5 w-3.5 h-3.5 text-shu" />
              )}

              {/* Player piece */}
              <span
                className="w-6 h-6 rounded-[3px] flex items-center justify-center shrink-0 shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]"
                style={{ backgroundColor: color }}
              >
                <SettlementIcon className="w-3.5 h-3.5 text-paper-light" />
              </span>

              {/* Player name */}
              <span className="flex-1 min-w-0 leading-tight">
                <span className={`block truncate text-[14px] ${isCurrentTurn ? 'font-extrabold' : 'font-semibold'}`}>
                  {p.name}
                  {isMe && <span className="ml-1 font-normal italic text-ink-faint text-[12px]">(tú)</span>}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-ink-faint mt-0.5">
                  <span className="inline-flex items-center gap-0.5" title="Cartas de recursos en mano">
                    <CardsIcon className="w-3.5 h-3.5" />
                    {totalCards}
                  </span>
                  {p.hasLongestRoad && (
                    <span
                      className="inline-flex items-center gap-0.5 text-shu font-bold"
                      title="Camino más Largo (+2 PV)"
                    >
                      <RoadIcon className="w-3.5 h-3.5" />
                      Camino
                    </span>
                  )}
                  {p.hasLargestArmy && (
                    <span
                      className="inline-flex items-center gap-0.5 text-shu font-bold"
                      title="Gran Ejército (+2 PV)"
                    >
                      <SwordsIcon className="w-3.5 h-3.5" />
                      Ejército
                    </span>
                  )}
                </span>
              </span>

              {/* VP count */}
              <span className="text-right shrink-0 leading-none">
                <span className="font-serif font-extrabold text-[22px] text-ink">{p.publicVP}</span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-ink-faint mt-0.5">PV</span>
              </span>
            </li>
          );
        })}
      </ul>

      {/* What's left in the bank (19 of each resource, 24 in the 5–6 player extension) */}
      {gameState.bank && (
        <div className="mt-2.5 flex items-center justify-between gap-2" aria-label="Cartas que quedan en el banco">
          <span className="label-caps !text-[10px] shrink-0">Banco</span>
          <ul className="flex items-center gap-2">
            {BANK_ORDER.map((r) => {
              const left = gameState.bank[r] ?? 0;
              const low = left <= 3;
              return (
                <li
                  key={r}
                  className="flex items-center gap-1"
                  title={`${RESOURCE_NAMES[r]}: quedan ${left} en el banco`}
                >
                  <ResourceChip type={r} className="w-4 h-4" iconClassName="w-3 h-3" />
                  <span className={`font-serif font-extrabold text-[13px] tabular-nums ${left === 0 ? 'text-shu line-through' : low ? 'text-shu' : 'text-ink'}`}>
                    {left}
                  </span>
                </li>
              );
            })}
            {gameState.devCardsRemaining !== undefined && (
              <li className="flex items-center gap-1 pl-2 border-l border-ink/20" title={`Cartas de desarrollo: quedan ${gameState.devCardsRemaining}`}>
                <CardsIcon className="w-4 h-4 text-ink-soft" />
                <span className="font-serif font-extrabold text-[13px] tabular-nums text-ink">{gameState.devCardsRemaining}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
