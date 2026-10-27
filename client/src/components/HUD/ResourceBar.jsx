import { useGame } from '../../context/GameContext';
import { RESOURCE } from '../../utils/constants';
import { ResourceCard } from '../Shared/ResourceCard';
import { hidePayout, useHandDelta } from './revealSignal';

export function ResourceBar() {
  const { myPlayer, gameState, myPlayerId } = useGame();
  // The cards of a roll appear when "Recursos recibidos" opens, and a robbed
  // card when "te robó / le robaste" shows: never mid-animation
  const { delta: pending } = useHandDelta(gameState, myPlayerId);
  const resources = hidePayout(myPlayer?.resources, pending) || {
    [RESOURCE.WOOD]: 0,
    [RESOURCE.BRICK]: 0,
    [RESOURCE.SHEEP]: 0,
    [RESOURCE.WHEAT]: 0,
    [RESOURCE.ORE]: 0,
  };

  const resourceKeys = [
    RESOURCE.WOOD,
    RESOURCE.BRICK,
    RESOURCE.SHEEP,
    RESOURCE.WHEAT,
    RESOURCE.ORE,
  ];

  const totalCards = Object.values(resources).reduce((a, b) => a + b, 0);

  return (
    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
      <div className="hidden lg:flex flex-col items-start leading-none shrink-0">
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-paper/55">Tu mano</span>
        <span className="font-serif font-extrabold text-[24px] text-paper-light mt-1">{totalCards}</span>
      </div>

      <div className="hud-hand-cards flex-1 min-w-0" aria-label={`Tu mano: ${totalCards} cartas`}>
        {resourceKeys.map((resKey) => {
          const count = resources[resKey] || 0;
          return (
            <div key={`${resKey}-${count}`} className={`min-w-0 ${count > 0 ? 'animate-res-bump' : ''}`}>
              <ResourceCard type={resKey} count={count} size="hand" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
