import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { ResourceCard, ResourceChip } from '../Shared/ResourceCard';
import { AlertIcon } from '../Shared/Icons';
import { whenStageIdle } from '../Effects/fxSignal';
import { payoutKey, revealPayout } from './revealSignal';
import { RESOURCE_NAMES } from '../../utils/constants';

// Second setup settlement: a short beat after the piece lands
const SHOW_DELAY_MS = 700;
// Dice payouts: give the 3D throw a moment to start, then wait until it has
// finished (diceSignal) and open right as it fades out
const ROLL_START_MS = 150;
const AFTER_DICE_MS = 120;
// Never hold the cards back longer than this, whatever happens to the dice
const MAX_WAIT_MS = 8000;

/**
 * Shows the resources this player just received (dice roll or second
 * setup settlement), and what the empty bank could not pay them. Driven by
 * gameState.lastProduction, whose id changes on every payout; a payout that
 * was already there when we joined is ignored.
 */
export function ProductionModal() {
  const { gameState } = useGame();
  const production = gameState?.lastProduction ?? null;
  const productionId = production?.id ?? null;
  // Primitive deps only: every state push is a new object even when the
  // payout is unchanged, which would cancel the delay timer
  const mineKey = JSON.stringify(production?.mine ?? null);
  const shortKey = JSON.stringify(production?.short ?? null);
  const source = production?.source ?? null;
  const roll = production?.roll ?? null;
  // Until this card opens, the hand bar & co. hide these cards (revealSignal)
  const key = payoutKey(gameState);

  const [shown, setShown] = useState(null);
  const seenIdRef = useRef(undefined);

  useEffect(() => {
    if (seenIdRef.current === undefined) {
      // First state received (fresh game or reconnect): nothing new yet, so
      // whatever payout is already there is shown in the hand right away
      seenIdRef.current = productionId;
      revealPayout(key);
      return undefined;
    }
    if (productionId === null || productionId === seenIdRef.current) return undefined;
    seenIdRef.current = productionId;

    const mine = JSON.parse(mineKey);
    const short = JSON.parse(shortKey);
    const total = mine ? Object.values(mine).reduce((a, b) => a + b, 0) : 0;
    if (total === 0 && !short) return undefined;

    let done = false;
    const show = () => {
      if (done) return;
      done = true;
      revealPayout(key);
      setShown({ mine, short, source, roll });
    };
    if (source !== 'roll') {
      const timer = setTimeout(show, SHOW_DELAY_MS);
      return () => {
        clearTimeout(timer);
        if (!done) revealPayout(key);
      };
    }
    let after = null;
    let cancelWait = () => {};
    const start = setTimeout(() => {
      // Dice first, then any board animation queued behind them
      cancelWait = whenStageIdle(() => {
        after = setTimeout(show, AFTER_DICE_MS);
      });
    }, ROLL_START_MS);
    const cap = setTimeout(show, MAX_WAIT_MS);
    return () => {
      clearTimeout(start);
      clearTimeout(after);
      clearTimeout(cap);
      cancelWait();
      // Superseded or unmounted before the card opened: never leave cards hidden
      if (!done) revealPayout(key);
    };
  }, [productionId, mineKey, shortKey, source, roll, key]);

  if (!shown) return null;

  const close = () => setShown(null);
  const entries = Object.entries(shown.mine || {}).filter(([, n]) => n > 0);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  const shortEntries = Object.entries(shown.short || {});

  return (
    <Modal
      isOpen
      onClose={close}
      title={total > 0 ? 'Recursos recibidos' : 'El almacén de la aldea está vacío'}
      maxWidth="max-w-md"
      actions={
        <button type="button" className="btn btn-primary min-h-[42px] px-5 py-1.5" onClick={close} autoFocus>
          Aceptar
        </button>
      }
    >
      {total > 0 && (
        <>
          <p className="text-ink-soft mb-5">
            {shown.source === 'setup'
              ? 'Tu segundo poblado te da sus primeros recursos.'
              : <>Salió un <strong className="text-ink">{shown.roll}</strong>. Te toca{total === 1 ? '' : 'n'} {total} carta{total === 1 ? '' : 's'}:</>}
          </p>
          <div className="flex flex-wrap justify-center gap-3 min-[360px]:gap-4 pt-2 pb-2">
            {entries.map(([type, n], i) => (
              <div key={type} className="animate-card-in" style={{ animationDelay: `${i * 110}ms` }}>
                <ResourceCard type={type} count={n} size="lg" />
              </div>
            ))}
          </div>
        </>
      )}
      {shortEntries.length > 0 && (
        <BankShortage entries={shortEntries} roll={shown.roll} alone={total === 0} />
      )}
    </Modal>
  );
}

/** «El almacén de la aldea está vacío»: what the bank could not pay me */
function BankShortage({ entries, roll, alone }) {
  return (
    <div className={`paper-inset p-3 sm:p-4 border-l-4 !border-l-shu ${alone ? '' : 'mt-4'}`}>
      <p className="flex items-center gap-2 font-bold text-shu mb-1.5">
        <AlertIcon className="w-4 h-4 shrink-0" />
        {alone ? 'Los mensajeros volvieron con las manos vacías' : 'El almacén de la aldea no alcanzó'}
      </p>
      <p className="text-ink-soft text-[13px] mb-3">
        {alone && <>Salió un <strong className="text-ink">{roll}</strong>, pero </>}
        {alone ? 'en' : 'En'} el almacén de la aldea no quedan cartas para todos los ninjas. Por el código de la aldea,
        si no alcanza para todos nadie cobra ese recurso en esta tirada (si lo cobra un solo ninja, se lleva lo que quede).
      </p>
      <ul className="border-t border-ink/15">
        {entries.map(([res, { owed, paid }]) => (
          <li key={res} className="flex items-center gap-2 py-1.5 border-b border-ink/15 text-[14px]">
            <ResourceChip type={res} />
            <span className="font-semibold">{RESOURCE_NAMES[res] || res}</span>
            <span className="ml-auto text-[13px] text-right">
              Te tocaban <strong>{owed}</strong> ·{' '}
              {paid > 0 ? <>solo quedaban <strong>{paid}</strong></> : <strong className="text-shu">no recibes nada</strong>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
