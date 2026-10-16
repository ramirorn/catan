import { useGame } from '../../context/GameContext';
import { pieceColor } from '../../utils/theme';
import { SettlementIcon, RoadIcon, SwordsIcon, CardsIcon, TurnMarkerIcon } from '../Shared/Icons';
import { ResourceChip } from '../Shared/ResourceCard';
import { RESOURCE_NAMES } from '../../utils/constants';
import { useLogExpanded, setLogExpanded } from './logLayout';

const BANK_ORDER = ['wood', 'brick', 'sheep', 'wheat', 'ore'];

export function ScoreBoard() {
  const { gameState, myPlayerId } = useGame();
  const logExpanded = useLogExpanded();

  if (!gameState?.players) return null;

  const playerOrder = gameState.playerOrder || [];
  const players = playerOrder.map((pid) => gameState.players[pid]).filter(Boolean);
  // 5–6 ninjas: one-line rows so the log / chat below keeps its room
  const dense = players.length >= 5;

  if (logExpanded) return <MiniStandings players={players} gameState={gameState} myPlayerId={myPlayerId} />;

  return (
    <section className={`hud-score px-4 ${dense ? 'pt-3' : 'pt-4'} phland:pt-3 pb-3 shrink-0`}>
      <div className="flex items-baseline justify-between gap-2 mb-2 compact:pr-10">
        <h2 className={`font-display ${dense ? 'text-[20px]' : 'text-[23px]'} leading-none text-ink`}>Ninjas</h2>
        <span className="label-caps !text-[10px] text-right">
          {gameState.vpToWin ?? 10} PV para ganar
          {/* The header hides the room code on phones: show it here */}
          <span className="hidden compact:block mt-1 !tracking-[0.14em]">
            Sala <span className="font-serif text-ink">{gameState.roomId}</span>
          </span>
        </span>
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
              className={`relative flex items-center ${dense ? 'gap-2 py-1' : 'gap-2.5 py-2'} pl-4 pr-1 border-b border-dashed border-ink/15 last:border-b-0 transition-colors ${
                isCurrentTurn ? "bg-chakra/15" : ""
              }`}
            >
              {/* Turn marker */}
              {isCurrentTurn && (
                <TurnMarkerIcon className="absolute -left-0.5 w-3.5 h-3.5 text-shu" />
              )}

              {/* Player piece */}
              <span
                className={`${dense ? 'w-5 h-5' : 'w-6 h-6'} rounded-[3px] flex items-center justify-center shrink-0 shadow-[inset_0_-2px_0_rgba(0,0,0,0.25)]`}
                style={{ backgroundColor: color }}
              >
                <SettlementIcon className={`${dense ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-paper-light`} />
              </span>

              {/* Player name */}
              <span className={`flex-1 min-w-0 leading-tight ${dense ? 'flex items-center gap-2' : ''}`}>
                <span className={`block truncate ${dense ? 'flex-1 min-w-0 text-[13px]' : 'text-[14px]'} ${isCurrentTurn ? 'font-extrabold' : 'font-semibold'}`}>
                  {p.name}
                  {isMe && <span className="ml-1 font-normal italic text-ink-faint text-[12px]">(tú)</span>}
                  {/* Left the game for good vs. just lost the connection */}
                  {!isMe && (p.left || p.connected === false) && (
                    <span className={`ml-1 font-normal italic text-[12px] ${p.left ? 'text-shu' : 'text-ink-faint'}`}>
                      ({p.left ? 'Se fue' : 'desconectado'})
                    </span>
                  )}
                </span>
                <span className={`flex items-center text-[11px] text-ink-faint ${dense ? 'gap-1.5 shrink-0' : 'gap-2 mt-0.5'}`}>
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
                      {!dense && 'Camino'}
                    </span>
                  )}
                  {p.hasLargestArmy && (
                    <span
                      className="inline-flex items-center gap-0.5 text-shu font-bold"
                      title="Gran Ejército (+2 PV)"
                    >
                      <SwordsIcon className="w-3.5 h-3.5" />
                      {!dense && 'Ejército'}
                    </span>
                  )}
                </span>
              </span>

              {/* VP count */}
              {dense ? (
                <span className="text-right shrink-0 leading-none min-w-[2.6rem]">
                  <span className="font-serif font-extrabold text-[17px] text-ink">{p.publicVP}</span>
                  <span className="ml-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">PV</span>
                </span>
              ) : (
                <span className="text-right shrink-0 leading-none">
                  <span className="font-serif font-extrabold text-[22px] text-ink">{p.publicVP}</span>
                  <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-ink-faint mt-0.5">PV</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* What's left in the bank (19 of each resource, 24 in the 5–6 player extension) */}
      {gameState.bank && (
        <div className={`${dense ? 'mt-1.5' : 'mt-2.5'} flex items-center gap-2`} aria-label="Cartas que quedan en el banco">
          <span className="label-caps !text-[10px] !tracking-[0.1em] shrink-0">Banco</span>
          <ul className="flex-1 min-w-0 flex flex-wrap items-center justify-end gap-x-1 gap-y-1">
            {BANK_ORDER.map((r) => {
              const left = gameState.bank[r] ?? 0;
              const low = left <= 3;
              return (
                <li
                  key={r}
                  className="flex items-center gap-0.5"
                  title={`${RESOURCE_NAMES[r]}: quedan ${left} en el banco`}
                >
                  <ResourceChip type={r} className="w-4 h-4" iconClassName="w-3 h-3" />
                  <span className={`font-serif font-extrabold text-[12.5px] tabular-nums min-w-[2ch] ${left === 0 ? 'text-shu line-through' : low ? 'text-shu' : 'text-ink'}`}>
                    {left}
                  </span>
                </li>
              );
            })}
            {gameState.devCardsRemaining !== undefined && (
              <li
                className="flex items-center gap-0.5 pl-1 border-l border-ink/20"
                title={`Cartas de desarrollo: quedan ${gameState.devCardsRemaining}`}
                aria-label={`Cartas de desarrollo: quedan ${gameState.devCardsRemaining}`}
              >
                <CardsIcon className="w-4 h-4 text-ink-soft shrink-0" />
                <span className="font-serif font-extrabold text-[12.5px] tabular-nums min-w-[2ch] text-ink">{gameState.devCardsRemaining}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Standings squeezed into a strip while the log / chat is enlarged: colour
 * piece + points per ninja, current turn highlighted. Tap to restore.
 */
function MiniStandings({ players, gameState, myPlayerId }) {
  return (
    <section className="hud-score hud-score-mini px-3 pt-2.5 pb-2 shrink-0 compact:pr-12">
      <button
        type="button"
        onClick={() => setLogExpanded(false)}
        className="w-full flex items-center gap-2 text-left cursor-pointer group"
        title="Mostrar la clasificación completa"
        aria-label="Mostrar la clasificación completa"
      >
        <span className="font-display text-[17px] leading-none text-ink shrink-0 group-hover:text-shu">Ninjas</span>
        <ul className="flex-1 min-w-0 flex flex-wrap items-center gap-0.5">
          {players.map((p) => {
            const turn = p.id === gameState.currentPlayerId;
            const me = p.id === myPlayerId;
            return (
              <li
                key={p.id}
                className={`flex items-center gap-1 pl-0.5 pr-1 py-0.5 rounded-[2px] ${turn ? 'bg-chakra/25 ring-1 ring-chakra/60' : ''}`}
                title={`${p.name}${me ? ' (tú)' : ''}: ${p.publicVP} PV`}
              >
                <span className="w-3.5 h-3.5 rounded-[2px] shrink-0" style={{ backgroundColor: pieceColor(p.color) }} />
                <span className={`font-serif font-extrabold text-[13px] leading-none tabular-nums ${me ? 'underline decoration-2 decoration-chakra underline-offset-2' : ''}`}>
                  {p.publicVP}
                </span>
              </li>
            );
          })}
        </ul>
      </button>
    </section>
  );
}
