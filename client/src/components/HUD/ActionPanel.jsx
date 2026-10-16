import { useGame } from '../../context/GameContext';
import { PHASE, BUILD_COSTS, RESOURCE } from '../../utils/constants';
import { RoadIcon, SettlementIcon, CityIcon, TradeIcon, CardsIcon, ArrowRightIcon } from '../Shared/Icons';
import { ResourceBundle } from '../Shared/ResourceCard';

export function ActionPanel() {
  const {
    gameState,
    myPlayer,
    isMyTurn,
    isSpecialBuild,
    isMySpecialBuild,
    buildMode,
    setBuildMode,
    setActiveModal,
    endTurn,
    myPlayerId,
  } = useGame();

  // Special build: the player whose turn comes next does not build now (they
  // build in their own turn, right after rolling); tell them they are up next
  const order = gameState?.playerOrder || [];
  const nextPlayerId = order.length
    ? order[(order.indexOf(gameState?.currentPlayerId) + 1) % order.length]
    : null;
  const iAmNext = isSpecialBuild && !isMySpecialBuild && nextPlayerId === myPlayerId;

  const isMainPhase = gameState?.phase === PHASE.MAIN && isMyTurn;
  // Building is allowed in my main phase or during my special build
  const canBuild = isMainPhase || isMySpecialBuild;
  const freeRoads = gameState?.freeRoadsRemaining || 0;
  // Road Building can be played before rolling, so its free roads too
  const canLayFreeRoads = freeRoads > 0 && isMyTurn && gameState?.phase === PHASE.ROLL_DICE;

  const res = myPlayer?.resources || {};

  const canAffordRoad =
    freeRoads > 0 ||
    ((res[RESOURCE.WOOD] || 0) >= BUILD_COSTS.road[RESOURCE.WOOD] &&
      (res[RESOURCE.BRICK] || 0) >= BUILD_COSTS.road[RESOURCE.BRICK]);

  const canAffordSettlement =
    (res[RESOURCE.WOOD] || 0) >= BUILD_COSTS.settlement[RESOURCE.WOOD] &&
    (res[RESOURCE.BRICK] || 0) >= BUILD_COSTS.settlement[RESOURCE.BRICK] &&
    (res[RESOURCE.SHEEP] || 0) >= BUILD_COSTS.settlement[RESOURCE.SHEEP] &&
    (res[RESOURCE.WHEAT] || 0) >= BUILD_COSTS.settlement[RESOURCE.WHEAT];

  const canAffordCity =
    (res[RESOURCE.WHEAT] || 0) >= BUILD_COSTS.city[RESOURCE.WHEAT] &&
    (res[RESOURCE.ORE] || 0) >= BUILD_COSTS.city[RESOURCE.ORE];

  const handleToggleBuild = (type) => {
    if (buildMode === type) {
      setBuildMode(null);
    } else {
      setBuildMode(type);
    }
  };

  return (
    <div className="hud-actions-row">
      <ActionButton
        disabled={!(canBuild || canLayFreeRoads) || !canAffordRoad}
        onClick={() => handleToggleBuild('road')}
        title="Camino: 1 Madera, 1 Arcilla"
        active={buildMode === 'road'}
        icon={<RoadIcon className="w-5 h-5" />}
        label="Camino"
        badge={freeRoads > 0 ? freeRoads : null}
        badgeTitle="Caminos gratis"
        cost={freeRoads > 0 ? null : BUILD_COSTS.road}
      />
      <ActionButton
        disabled={!canBuild || !canAffordSettlement}
        onClick={() => handleToggleBuild('settlement')}
        title="Poblado: 1 Madera, 1 Arcilla, 1 Oveja, 1 Trigo"
        active={buildMode === 'settlement'}
        icon={<SettlementIcon className="w-5 h-5" />}
        label="Poblado"
        cost={BUILD_COSTS.settlement}
      />
      <ActionButton
        disabled={!canBuild || !canAffordCity}
        onClick={() => handleToggleBuild('city')}
        title="Ciudad: 2 Trigo, 3 Piedra"
        active={buildMode === 'city'}
        icon={<CityIcon className="w-5 h-5" />}
        label="Ciudad"
        cost={BUILD_COSTS.city}
      />

      <span className="hud-sep hidden sm:block w-px self-stretch my-1 bg-paper/15 mx-0.5" aria-hidden="true" />

      <ActionButton
        disabled={!isMainPhase && !(
          // Off-turn: still open to see / answer someone else's pending offer
          gameState?.activeTrade?.status === 'pending' && gameState.activeTrade.proposerId !== myPlayerId
        )}
        onClick={() => setActiveModal('trade')}
        title="Comercio con la banca u otros ninjas"
        icon={<TradeIcon className="w-5 h-5" />}
        label="Comercio"
      />
      <ActionButton
        disabled={isSpecialBuild ? !isMySpecialBuild : !isMyTurn}
        onClick={() => setActiveModal('devCard')}
        title="Cartas de Desarrollo"
        icon={<CardsIcon className="w-5 h-5" />}
        label="Cartas"
        badge={myPlayer?.devCards?.length || null}
        badgeTitle="Cartas de desarrollo en mano"
      />

      {/* Pasar Turno button */}
      {isMainPhase && (
        <button
          type="button"
          onClick={endTurn}
          className="btn btn-primary hud-cta ml-1 sm:ml-2 px-3 sm:px-4 text-sm whitespace-nowrap"
          title="Pasar turno"
        >
          <span className="sm:hidden phland:inline">Pasar</span>
          <span className="hidden sm:inline phland:hidden">Pasar turno</span>
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      )}

      {iAmNext && (
        <span
          className="ml-1 sm:ml-2 px-2 py-1 text-[12px] leading-tight font-bold text-chakra-light whitespace-nowrap"
          title="Cuando terminen de construir los demás, empieza tu turno y tiras los dados"
        >
          <span className="sm:hidden">Luego tiras tú</span>
          <span className="hidden sm:inline">Después tiras tú los dados</span>
        </span>
      )}

      {/* Special build (another player's turn just ended): pass to the next ninja */}
      {isMySpecialBuild && !isMyTurn && (
        <button
          type="button"
          onClick={endTurn}
          className="btn btn-primary hud-cta ml-1 sm:ml-2 px-3 sm:px-4 text-sm whitespace-nowrap"
          title="Termina tu fase especial de construcción"
        >
          <span className="sm:hidden phland:inline">Listo</span>
          <span className="hidden sm:inline phland:hidden">Terminar construcción</span>
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function ActionButton({ disabled, onClick, title, active = false, icon, label, cost, badge = null, badgeTitle }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`hud-btn group relative flex flex-col items-center justify-center gap-0.5 px-1 sm:px-2 pt-1.5 pb-1 rounded-[2px] border text-[clamp(9.5px,2.8vw,11px)] font-bold leading-none transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${
        active
          ? 'bg-chakra text-ink border-chakra-light shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_0_0_2px_rgba(246,160,75,0.4)]'
          : disabled
          ? 'bg-white/[0.04] border-paper/10 text-paper/30'
          : 'paper text-ink border-black shadow-[0_2px_0_#000] hover:-translate-y-px hover:shadow-[0_3px_0_#000,0_0_0_1px_var(--color-chakra)]'
      }`}
    >
      {icon}
      <span className="whitespace-nowrap mt-0.5">{label}</span>
      {badge !== null && (
        <span
          className="hanko absolute -top-1.5 -right-1 min-w-[18px] h-[18px] px-1 font-serif font-extrabold text-[11px] leading-none"
          title={badgeTitle}
          aria-label={`${badgeTitle}: ${badge}`}
        >
          {badge}
        </span>
      )}
      {cost && (
        <span className={`hidden sm:block phland:hidden mt-0.5 ${disabled && !active ? 'opacity-40' : ''}`}>
          <ResourceBundle bundle={cost} chipClassName="w-2.5 h-2.5" iconClassName="hidden" />
        </span>
      )}
    </button>
  );
}
