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
  } = useGame();

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
    <div className="flex items-stretch justify-between md:justify-start gap-1 sm:gap-2 shrink-0 min-w-max">
      <ActionButton
        disabled={!(canBuild || canLayFreeRoads) || !canAffordRoad}
        onClick={() => handleToggleBuild('road')}
        title="Camino: 1 Madera, 1 Arcilla"
        active={buildMode === 'road'}
        icon={<RoadIcon className="w-5 h-5" />}
        label={`Camino${freeRoads > 0 ? ` (${freeRoads})` : ''}`}
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
        title="Ciudad: 2 Trigo, 3 Mineral"
        active={buildMode === 'city'}
        icon={<CityIcon className="w-5 h-5" />}
        label="Ciudad"
        cost={BUILD_COSTS.city}
      />

      <span className="hidden sm:block w-px self-stretch my-1 bg-paper/15 mx-0.5" aria-hidden="true" />

      <ActionButton
        disabled={!isMainPhase}
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
        label={`Cartas${myPlayer?.devCards?.length ? ` (${myPlayer.devCards.length})` : ''}`}
      />

      {/* Pasar Turno button */}
      {isMainPhase && (
        <button
          type="button"
          onClick={endTurn}
          className="btn btn-primary ml-1 sm:ml-2 px-3 sm:px-4 text-sm whitespace-nowrap"
        >
          <span className="sm:hidden">Pasar</span>
          <span className="hidden sm:inline">Pasar turno</span>
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      )}

      {/* Special build: pass to the next ninja */}
      {isMySpecialBuild && (
        <button
          type="button"
          onClick={endTurn}
          className="btn btn-primary ml-1 sm:ml-2 px-3 sm:px-4 text-sm whitespace-nowrap"
          title="Termina tu fase especial de construcción"
        >
          <span className="sm:hidden">Listo</span>
          <span className="hidden sm:inline">Terminar construcción</span>
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function ActionButton({ disabled, onClick, title, active = false, icon, label, cost }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`group relative flex flex-col items-center justify-center gap-0.5 min-w-[46px] sm:min-w-[64px] px-1 sm:px-2 pt-1.5 pb-1 rounded-[2px] border text-[10px] sm:text-[11px] font-bold leading-none transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${
        active
          ? 'bg-chakra text-ink border-chakra-light shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_0_0_2px_rgba(246,160,75,0.4)]'
          : disabled
          ? 'bg-white/[0.04] border-paper/10 text-paper/30'
          : 'paper text-ink border-black shadow-[0_2px_0_#000] hover:-translate-y-px hover:shadow-[0_3px_0_#000,0_0_0_1px_var(--color-chakra)]'
      }`}
    >
      {icon}
      <span className="whitespace-nowrap mt-0.5">{label}</span>
      {cost && (
        <span className={`hidden sm:block mt-0.5 ${disabled && !active ? 'opacity-40' : ''}`}>
          <ResourceBundle bundle={cost} chipClassName="w-2.5 h-2.5" iconClassName="hidden" />
        </span>
      )}
    </button>
  );
}
