import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import {
  DEV_CARD,
  DEV_CARD_INFO,
  BUILD_COSTS,
  RESOURCE,
  RESOURCE_NAMES,
} from '../../utils/constants';
import { DevCardIcon, HourglassIcon, MedalIcon, CardsIcon } from '../Shared/Icons';
import { ResourceBundle } from '../Shared/ResourceCard';

export function DevCardModal({ isOpen, onClose }) {
  const { gameState, myPlayer, isMyTurn, isSpecialBuild, isMySpecialBuild, buyDevCard, playDevCard } = useGame();

  const [selectedCard, setSelectedCard] = useState(null);
  
  // Year of Plenty state
  const [yopRes1, setYopRes1] = useState(RESOURCE.WOOD);
  const [yopRes2, setYopRes2] = useState(RESOURCE.BRICK);

  // Monopoly state
  const [monopolyRes, setMonopolyRes] = useState(RESOURCE.ORE);

  if (!isOpen) return null;

  const res = myPlayer?.resources || {};
  const canAffordBuy =
    (res[RESOURCE.SHEEP] || 0) >= BUILD_COSTS.devCard[RESOURCE.SHEEP] &&
    (res[RESOURCE.WHEAT] || 0) >= BUILD_COSTS.devCard[RESOURCE.WHEAT] &&
    (res[RESOURCE.ORE] || 0) >= BUILD_COSTS.devCard[RESOURCE.ORE];

  const cardsInDeck = gameState?.devCardsRemaining || 0;
  const cardsInHand = myPlayer?.devCards || [];
  const boughtThisTurn = myPlayer?.devCardBoughtThisTurn || [];
  const alreadyPlayedCard = myPlayer?.hasPlayedDevCardThisTurn;
  // Buying: my main phase or my special build. Playing: never during a special build.
  const canBuyNow = (isMyTurn && gameState?.phase === 'main') || isMySpecialBuild;
  const canPlayNow = isMyTurn && !isSpecialBuild;

  const handlePlay = (cardType) => {
    if (!canPlayNow || alreadyPlayedCard) return;
    setSelectedCard(null);

    if (cardType === DEV_CARD.YEAR_OF_PLENTY) {
      playDevCard(cardType, { resource1: yopRes1, resource2: yopRes2 });
    } else if (cardType === DEV_CARD.MONOPOLY) {
      playDevCard(cardType, { resource: monopolyRes });
    } else {
      playDevCard(cardType);
    }
  };

  const resourceList = [
    RESOURCE.WOOD,
    RESOURCE.BRICK,
    RESOURCE.SHEEP,
    RESOURCE.WHEAT,
    RESOURCE.ORE,
  ];

  const selectClass = 'field !py-1.5 !text-[13px] cursor-pointer';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cartas de desarrollo"
      maxWidth="max-w-2xl"
      actions={
        <button type="button" onClick={onClose} className="btn btn-ghost px-4 py-2 text-[13px]">
          Cerrar
        </button>
      }
    >
      {/* Buy card */}
      <div className="paper-inset flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3.5 mb-5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="relative w-11 h-14 shrink-0 rounded-[3px] bg-ink border border-ink shadow-[2px_2px_0_#c4aa7e] flex items-center justify-center">
            <div className="absolute inset-1 border border-chakra/60 rounded-[2px]" />
            <CardsIcon className="w-5 h-5 text-chakra-light" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-ink">Adquirir carta de desarrollo</div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[12px] text-ink-faint">
              <span>Coste</span>
              <ResourceBundle bundle={BUILD_COSTS.devCard} chipClassName="w-4.5 h-4.5" iconClassName="w-3 h-3" />
              <span className="ml-1">· {cardsInDeck} en mazo</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!canBuyNow || !canAffordBuy || cardsInDeck === 0}
          title={!canBuyNow && gameState?.phase === 'rollDice' ? 'Primero tira los dados para comprar' : undefined}
          onClick={buyDevCard}
          className="btn btn-primary px-4 py-2.5 text-[13px] shrink-0"
        >
          {canAffordBuy ? 'Comprar carta' : 'Recursos insuficientes'}
        </button>
      </div>

      {/* Cards in Hand */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="label-caps">Tus cartas en mano</span>
          <span className="font-serif font-extrabold text-lg text-ink">{cardsInHand.length}</span>
        </div>

        {cardsInHand.length === 0 ? (
          <p className="text-center py-8 italic text-ink-faint border border-dashed border-ink/25 rounded-[3px]">
            Aún no tienes cartas de desarrollo en tu poder.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cardsInHand.map((card, idx) => {
              const info = DEV_CARD_INFO[card] || { name: card, icon: '', description: '' };
              // Only the copies bought this turn are blocked (they are appended last to the hand)
              const sameTypeBefore = cardsInHand.slice(0, idx).filter((c) => c === card).length;
              const sameTypeTotal = cardsInHand.filter((c) => c === card).length;
              const boughtOfType = boughtThisTurn.filter((c) => c === card).length;
              const isBoughtThisTurn = sameTypeBefore >= sameTypeTotal - boughtOfType;
              const isVP = card === DEV_CARD.VICTORY_POINT;
              const canPlay = canPlayNow && !alreadyPlayedCard && !isBoughtThisTurn && !isVP;
              const isSelected = selectedCard === idx;

              return (
                <div
                  key={`${card}-${idx}`}
                  onClick={() => setSelectedCard(isSelected ? null : idx)}
                  className={`relative flex gap-3 p-3 rounded-[4px] border bg-paper-light cursor-pointer transition-all ${
                    isSelected
                      ? 'border-shu shadow-[0_0_0_1px_var(--color-shu),0_6px_14px_-6px_rgba(0,0,0,0.4)]'
                      : 'border-paper-edge shadow-[0_2px_0_rgba(196,170,126,0.8)] hover:-translate-y-0.5'
                  }`}
                >
                  <div
                    className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center border ${
                      isVP ? 'bg-chakra text-paper-light border-[#7d5f26]' : 'bg-ink text-paper-light border-ink'
                    }`}
                  >
                    <DevCardIcon type={card} className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[17px] leading-tight text-ink">{info.name}</div>
                    <p className="text-[12.5px] text-ink-soft leading-snug mt-0.5">{info.description}</p>

                    {isBoughtThisTurn && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-shu mt-2">
                        <HourglassIcon className="w-3.5 h-3.5" />
                        Comprada este turno (jugable en el siguiente)
                      </span>
                    )}

                    {isVP && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-chakra mt-2">
                        <MedalIcon className="w-3.5 h-3.5" />
                        +1 Punto de Victoria oculto
                      </span>
                    )}

                    {/* Contextual actions */}
                    {isSelected && canPlay && (
                      <div className="mt-3 pt-3 border-t border-dashed border-ink/25">
                        {card === DEV_CARD.YEAR_OF_PLENTY && (
                          <div className="space-y-1.5 mb-2.5">
                            <span className="label-caps !text-[10px]">Elige 2 recursos</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              <select
                                className={selectClass}
                                value={yopRes1}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setYopRes1(e.target.value)}
                              >
                                {resourceList.map((r) => (
                                  <option key={r} value={r}>
                                    {RESOURCE_NAMES[r]}
                                  </option>
                                ))}
                              </select>
                              <select
                                className={selectClass}
                                value={yopRes2}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setYopRes2(e.target.value)}
                              >
                                {resourceList.map((r) => (
                                  <option key={r} value={r}>
                                    {RESOURCE_NAMES[r]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {card === DEV_CARD.MONOPOLY && (
                          <div className="space-y-1.5 mb-2.5">
                            <span className="label-caps !text-[10px]">Recurso objetivo</span>
                            <select
                              className={selectClass}
                              value={monopolyRes}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setMonopolyRes(e.target.value)}
                            >
                              {resourceList.map((r) => (
                                <option key={r} value={r}>
                                  {RESOURCE_NAMES[r]}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlay(card);
                          }}
                          className="btn btn-primary w-full py-1.5 text-[13px]"
                        >
                          Jugar carta ahora
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
