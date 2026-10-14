import { useGame } from '../../context/GameContext';
import { RESOURCE } from '../../utils/constants';
import { ResourceCard } from '../Shared/ResourceCard';

export function ResourceBar() {
  const { myPlayer } = useGame();
  const resources = myPlayer?.resources || {
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

      <div className="flex items-end gap-1.5 sm:gap-2.5 pt-2 pr-2">
        {resourceKeys.map((resKey) => {
          const count = resources[resKey] || 0;
          return (
            <div key={`${resKey}-${count}`} className={count > 0 ? 'animate-res-bump' : ''}>
              <ResourceCard type={resKey} count={count} size="md" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
