import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { ResourceCard } from '../Shared/ResourceCard';

// Lets the dice settle before the cards appear
const SHOW_DELAY_MS = 700;

/**
 * Shows the resources this player just received (dice roll or second
 * setup settlement). Driven by gameState.lastProduction, whose id changes
 * on every payout; a payout that was already there when we joined is ignored.
 */
export function ProductionModal() {
  const { gameState } = useGame();
  const production = gameState?.lastProduction ?? null;
  const productionId = production?.id ?? null;
  // Primitive deps only: every state push is a new object even when the
  // payout is unchanged, which would cancel the delay timer
  const mineKey = JSON.stringify(production?.mine ?? null);
  const source = production?.source ?? null;
  const roll = production?.roll ?? null;

  const [shown, setShown] = useState(null);
  const seenIdRef = useRef(undefined);

  useEffect(() => {
    if (seenIdRef.current === undefined) {
      // First state received (fresh game or reconnect): nothing new yet
      seenIdRef.current = productionId;
      return undefined;
    }
    if (productionId === null || productionId === seenIdRef.current) return undefined;
    seenIdRef.current = productionId;

    const mine = JSON.parse(mineKey);
    const total = mine ? Object.values(mine).reduce((a, b) => a + b, 0) : 0;
    if (total === 0) return undefined;

    const timer = setTimeout(() => setShown({ mine, source, roll }), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [productionId, mineKey, source, roll]);

  if (!shown) return null;

  const close = () => setShown(null);
  const entries = Object.entries(shown.mine).filter(([, n]) => n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0);

  return (
    <Modal
      isOpen
      onClose={close}
      title="Recursos recibidos"
      maxWidth="max-w-md"
      actions={
        <button type="button" className="btn btn-primary px-5 py-1.5" onClick={close} autoFocus>
          Aceptar
        </button>
      }
    >
      <p className="text-ink-soft mb-5">
        {shown.source === 'setup'
          ? 'Tu segundo poblado te da sus primeros recursos.'
          : <>Salió un <strong className="text-ink">{shown.roll}</strong>. Te toca{total === 1 ? '' : 'n'} {total} carta{total === 1 ? '' : 's'}:</>}
      </p>
      <div className="flex flex-wrap justify-center gap-4 pb-2">
        {entries.map(([type, n], i) => (
          <div key={type} className="animate-card-in" style={{ animationDelay: `${i * 110}ms` }}>
            <ResourceCard type={type} count={n} size="lg" />
          </div>
        ))}
      </div>
    </Modal>
  );
}
