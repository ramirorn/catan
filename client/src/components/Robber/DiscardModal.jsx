import { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { RESOURCE, RESOURCE_NAMES } from '../../utils/constants';
import { ResourceCard } from '../Shared/ResourceCard';
import { AlertIcon } from '../Shared/Icons';

export function DiscardModal({ isOpen }) {
  const { myPlayer, discardCards } = useGame();

  const myResources = myPlayer?.resources || {
    [RESOURCE.WOOD]: 0,
    [RESOURCE.BRICK]: 0,
    [RESOURCE.SHEEP]: 0,
    [RESOURCE.WHEAT]: 0,
    [RESOURCE.ORE]: 0,
  };

  const totalCards = Object.values(myResources).reduce((a, b) => a + b, 0);
  const targetToDiscard = Math.floor(totalCards / 2);

  const [discarding, setDiscarding] = useState({
    [RESOURCE.WOOD]: 0,
    [RESOURCE.BRICK]: 0,
    [RESOURCE.SHEEP]: 0,
    [RESOURCE.WHEAT]: 0,
    [RESOURCE.ORE]: 0,
  });

  // Reset the selection every time the modal opens (a new 7 was rolled)
  useEffect(() => {
    if (isOpen) {
      setDiscarding({
        [RESOURCE.WOOD]: 0,
        [RESOURCE.BRICK]: 0,
        [RESOURCE.SHEEP]: 0,
        [RESOURCE.WHEAT]: 0,
        [RESOURCE.ORE]: 0,
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDiscardCount = Object.values(discarding).reduce((a, b) => a + b, 0);
  const isComplete = currentDiscardCount === targetToDiscard;

  const handleChange = (res, delta) => {
    const current = discarding[res] || 0;
    const available = myResources[res] || 0;
    const next = Math.max(0, Math.min(available, current + delta));

    if (delta > 0 && currentDiscardCount >= targetToDiscard) return;

    setDiscarding((prev) => ({ ...prev, [res]: next }));
  };

  const handleSubmit = () => {
    if (!isComplete) return;
    discardCards(discarding);
  };

  const resourceList = [
    RESOURCE.WOOD,
    RESOURCE.BRICK,
    RESOURCE.SHEEP,
    RESOURCE.WHEAT,
    RESOURCE.ORE,
  ];

  return (
    <Modal isOpen={isOpen} title="¡Emboscada del renegado!" maxWidth="max-w-md">
      {/* Alert banner */}
      <div className="flex items-start gap-3 p-3 mb-4 border-l-4 border-shu bg-shu/8 text-[14px] leading-relaxed text-ink">
        <AlertIcon className="w-5 h-5 text-shu shrink-0 mt-0.5" />
        <p>
          ¡Salió un <strong>7</strong>! Como tu mano supera las 7 cartas ({totalCards} cartas),
          debes entregar la mitad (<strong>{targetToDiscard} cartas</strong>) al ladrón renegado.
        </p>
      </div>

      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <span className="label-caps">Cartas a descartar</span>
          <span className="font-serif font-extrabold text-xl text-ink">
            {currentDiscardCount}
            <span className="text-ink-faint"> / {targetToDiscard}</span>
          </span>
        </div>

        <ul className="border-t border-ink/15">
          {resourceList.map((res) => {
            const available = myResources[res] || 0;
            const count = discarding[res] || 0;

            if (available === 0) return null;

            return (
              <li key={res} className="flex items-center justify-between gap-3 py-2 border-b border-ink/15">
                <div className="flex items-center gap-3">
                  <ResourceCard type={res} size="sm" showName={false} />
                  <span className="leading-tight">
                    <span className="block font-bold text-ink">{RESOURCE_NAMES[res]}</span>
                    <span className="text-[12px] text-ink-faint">tienes {available}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange(res, -1)}
                    disabled={count === 0}
                    className="stepper"
                    aria-label={`Quitar ${RESOURCE_NAMES[res]}`}
                  >
                    −
                  </button>
                  <span className="font-serif font-extrabold text-xl w-7 text-center text-ink">{count}</span>
                  <button
                    type="button"
                    onClick={() => handleChange(res, 1)}
                    disabled={count >= available || currentDiscardCount >= targetToDiscard}
                    className="stepper"
                    aria-label={`Añadir ${RESOURCE_NAMES[res]}`}
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        disabled={!isComplete}
        onClick={handleSubmit}
        className="btn btn-primary w-full py-3 text-[15px]"
      >
        {isComplete
          ? `Confirmar descarte de ${targetToDiscard} cartas`
          : `Selecciona ${targetToDiscard - currentDiscardCount} carta(s) más`}
      </button>
    </Modal>
  );
}
