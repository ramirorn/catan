// «Pacto de paz» (robber bribe house rule).
//  · PeacePactButton: shown to the robber mover next to the phase banner.
//  · PeacePactModal: the mover picks a ninja and up to 2 cards, then waits for
//    the answer (server deadline) and sees the result.
//  · PeacePactPrompt: the target's «Aceptar / Rechazar» with the countdown.
// The server enforces everything (one pact per robber move, protected hexes,
// no steal); these only ask and show.

import { useEffect, useMemo, useState } from 'react';
import { PEACE_PACT_MAX_CARDS, canOfferPact, cardsOf, pactTargets, requestText } from './peacePactUtils';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { PlayerAvatar } from '../Shared/Avatar';
import { ResourceCard } from '../Shared/ResourceCard';
import { CardsIcon, HourglassIcon, MinusIcon, PeaceSealIcon } from '../Shared/Icons';
import { useStageReady } from '../Effects/fxSignal';
import { PHASE, RESOURCE, RESOURCE_NAMES } from '../../utils/constants';

const RESOURCES = [RESOURCE.WOOD, RESOURCE.BRICK, RESOURCE.SHEEP, RESOURCE.WHEAT, RESOURCE.ORE];

/** Seconds left until a server deadline (null without one) */
function useSecondsLeft(deadline, serverOffset) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [deadline]);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline - (now + serverOffset)) / 1000));
}

function Countdown({ deadline }) {
  const { serverOffset } = useGame();
  const secs = useSecondsLeft(deadline, serverOffset);
  if (secs === null) return null;
  return (
    <span
      className={`inline-flex shrink-0 whitespace-nowrap items-center gap-1 font-serif font-extrabold tabular-nums ${secs <= 5 ? 'text-shu' : 'text-ink'}`}
      role="timer"
      aria-label={`${secs} segundos`}
    >
      <HourglassIcon className="w-4 h-4" />
      {secs} s
    </span>
  );
}


/** Button for the robber mover (sits under the phase banner, 2D and 3D) */
export function PeacePactButton({ className = '' }) {
  const { gameState, isMyTurn, myPlayerId, setActiveModal } = useGame();
  if (!canOfferPact(gameState, isMyTurn, myPlayerId)) return null;
  return (
    <button
      type="button"
      onClick={() => setActiveModal('peacePact')}
      className={`btn paper pointer-events-auto min-h-[40px] px-3 py-1.5 text-[13px] border border-ink/70 shadow-[0_4px_10px_rgba(0,0,0,0.45)] ${className}`}
      title="Pídele hasta 2 cartas a un ninja a cambio de no atacarlo con el ladrón"
    >
      <PeaceSealIcon className="w-4 h-4 text-chakra" />
      <span>Pacto de paz</span>
    </button>
  );
}

/** One resource of the request: tap the card to ask for one more, «−» for one less */
function ResourcePick({ res, count, canAdd, onChange }) {
  const name = RESOURCE_NAMES[res];
  return (
    <li className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(res, 1)}
        disabled={!canAdd}
        className={`pact-pick ${count > 0 ? 'is-on' : ''}`}
        aria-label={`Pedir 1 ${name} más${count ? ` (pides ${count})` : ''}`}
        title={name}
      >
        <ResourceCard type={res} size="sm" count={count || undefined} showName={false} />
      </button>
      <button
        type="button"
        onClick={() => onChange(res, -1)}
        className={`stepper !w-8 !h-7 ${count > 0 ? '' : 'invisible'}`}
        aria-label={`Pedir 1 ${name} menos`}
        tabIndex={count > 0 ? 0 : -1}
      >
        <MinusIcon className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

function OfferForm() {
  const { gameState, myPlayerId, offerPeacePact } = useGame();
  const targets = pactTargets(gameState, myPlayerId);
  const [targetId, setTargetId] = useState(() => targets[0]?.id ?? null);
  const [picked, setRequest] = useState({});
  // The chosen ninja ran out of cards / went away: the first one left
  const target = targets.find((p) => p.id === targetId) || targets[0] || null;
  const limit = Math.min(PEACE_PACT_MAX_CARDS, cardsOf(target));
  const pickedTotal = Object.values(picked).reduce((a, b) => a + b, 0);
  // Never more than the target holds
  const request = pickedTotal > limit ? {} : picked;
  const total = pickedTotal > limit ? 0 : pickedTotal;

  const change = (res, d) => {
    if (d > 0 && total >= limit) return;
    setRequest({ ...request, [res]: Math.max(0, (request[res] || 0) + d) });
  };

  const send = () => {
    if (!target || total < 1) return;
    const clean = Object.fromEntries(Object.entries(request).filter(([, n]) => n > 0));
    offerPeacePact(target.id, clean);
  };

  return (
    <>
      <p className="text-[13.5px] text-ink-soft leading-snug mb-2">
        Pide hasta {PEACE_PACT_MAX_CARDS} cartas a un ninja: si acepta, el ladrón no irá a sus casillas ni le robará.
        No ves su mano; si no tiene lo que pides, no podrá aceptar.
      </p>

      <span className="label-caps block mb-1">Ninja</span>
      <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-1.5 mb-3" role="radiogroup" aria-label="Ninja para el pacto">
        {targets.map((p) => {
          const on = p.id === targetId;
          return (
            <li key={p.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTargetId(p.id)}
                className={`w-full min-h-[44px] flex items-center justify-between gap-2 px-2 py-1.5 rounded-[3px] border text-left cursor-pointer transition-colors ${
                  on ? 'bg-paper-light border-shu shadow-[0_0_0_1px_var(--color-shu)]' : 'border-ink/25 hover:border-ink/45 hover:bg-paper-light/50'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <PlayerAvatar player={p} size={28} />
                  <span className="font-bold text-[14px] text-ink truncate">{p.name}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-faint shrink-0">
                  <CardsIcon className="w-4 h-4" />
                  {cardsOf(p)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-baseline justify-between">
        <span className="label-caps">Cartas que pides</span>
        <span className="font-serif font-extrabold text-ink">
          {total}
          <span className="text-ink-faint"> / {limit}</span>
        </span>
      </div>
      <ul className="grid grid-cols-5 gap-1 justify-items-center pt-1.5 mb-2 border-t border-ink/15">
        {RESOURCES.map((res) => (
          <ResourcePick key={res} res={res} count={request[res] || 0} canAdd={total < limit} onChange={change} />
        ))}
      </ul>

      <div className="sheet-sticky">
        <button type="button" disabled={!target || total < 1} onClick={send} className="btn btn-primary w-full py-3 text-[15px]">
          <PeaceSealIcon className="w-4 h-4" />
          {target && total > 0 ? `Ofrecer pacto a ${target.name}` : 'Elige al menos 1 carta'}
        </button>
      </div>
    </>
  );
}

/** Mover's window: offer, then wait for the answer, then the result */
export function PeacePactModal({ isOpen, onClose }) {
  const { gameState, myPlayerId, cancelPeacePact } = useGame();
  const pact = gameState?.peacePact;
  const mine = pact && pact.fromId === myPlayerId ? pact : null;
  const inRobberMove = gameState?.phase === PHASE.ROBBER_MOVE;

  // The robber move is over (placed, time ran out…): nothing left to show
  useEffect(() => {
    if (isOpen && !inRobberMove) onClose?.();
  }, [isOpen, inRobberMove, onClose]);

  // A signed pact plays its animation first; the result shows afterwards
  const resolved = !!mine && mine.status !== 'pending';
  const resultReady = useStageReady(isOpen && resolved);

  if (!isOpen || !inRobberMove) return null;
  if (resolved && !resultReady) return null;
  const target = mine ? gameState.players?.[mine.toId] : null;

  let body;
  if (!mine) {
    body = <OfferForm />;
  } else if (mine.status === 'pending') {
    body = (
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <PlayerAvatar player={target} size={44} />
          <PeaceSealIcon className="w-8 h-8 text-chakra animate-pulse" />
        </div>
        <p className="text-[15px] text-ink leading-snug mb-1">
          Esperando la respuesta de <strong>{target?.name}</strong>…
        </p>
        <p className="text-[13px] text-ink-soft mb-3">Pides {requestText(mine.request)}</p>
        <div className="mb-4"><Countdown deadline={mine.deadline} /></div>
        {gameState.turnTimeLimit > 0 && (
          <p className="text-[12px] text-ink-faint mb-3">Tu tiempo de turno está en pausa mientras decide.</p>
        )}
        <button type="button" onClick={cancelPeacePact} className="btn btn-ghost w-full py-2.5 text-[14px]">
          Retirar el pacto
        </button>
      </div>
    );
  } else {
    const accepted = mine.status === 'accepted';
    const msg = accepted
      ? `¡${target?.name} aceptó! Te dio ${requestText(mine.request)}. Sus casillas quedan protegidas: elige otro hexágono para el ladrón.`
      : mine.status === 'expired'
        ? `${target?.name} no respondió a tiempo. Mueve al ladrón como quieras.`
        : mine.status === 'cancelled'
          ? 'Retiraste el pacto. Mueve al ladrón como quieras.'
          : `${target?.name} rechazó el pacto. Mueve al ladrón como quieras.`;
    body = (
      <div className="text-center">
        <PeaceSealIcon className={`w-10 h-10 mx-auto mb-2 ${accepted ? 'text-chakra' : 'text-ink-faint'}`} />
        <p className="text-[15px] text-ink leading-snug mb-4">{msg}</p>
        <button type="button" onClick={onClose} className="btn btn-primary w-full py-3 text-[15px]">
          Mover al ladrón
        </button>
      </div>
    );
  }

  // While waiting the window can't be dismissed by accident (it reopens anyway)
  const closable = !mine || mine.status !== 'pending';
  return (
    <Modal isOpen onClose={closable ? onClose : undefined} title="Pacto de paz" maxWidth="max-w-md">
      {body}
    </Modal>
  );
}

/** Target's prompt: «Minato te ofrece un pacto de paz: dame 1 Trigo y no te atacaré» */
export function PeacePactPrompt() {
  const { gameState, myPlayerId, myPlayer, isSpectator, respondPeacePact } = useGame();
  const pact = gameState?.peacePact;
  const forMe = !isSpectator && pact?.status === 'pending' && pact.toId === myPlayerId && gameState.phase === PHASE.ROBBER_MOVE;
  // After the dice / animations, never over them
  const open = useStageReady(forMe);
  const from = pact ? gameState.players?.[pact.fromId] : null;
  const missing = useMemo(() => {
    if (!forMe || !pact.request) return [];
    const mine = myPlayer?.resources || {};
    return Object.entries(pact.request).filter(([r, n]) => (mine[r] || 0) < n).map(([r]) => RESOURCE_NAMES[r] || r);
  }, [forMe, pact, myPlayer]);

  if (!open) return null;
  const canPay = missing.length === 0;

  return (
    <Modal isOpen title="Pacto de paz" maxWidth="max-w-md">
      <div className="flex items-start gap-3 mb-3">
        <PlayerAvatar player={from} size={44} />
        <p className="text-[15px] text-ink leading-snug">
          <strong>{from?.name || 'Un ninja'}</strong> te ofrece un pacto de paz:{' '}
          <em>«dame {requestText(pact.request)} y no te atacaré»</em>
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 mb-3 text-[13px] text-ink-soft">
        <span>Si aceptas, el ladrón no podrá ir a tus casillas ni robarte en este movimiento.</span>
        <Countdown deadline={pact.deadline} />
      </div>
      {!canPay && (
        <p className="mb-3 p-2 border-l-4 border-shu bg-shu/8 text-[13.5px] text-ink" role="alert">
          No puedes aceptar: no tienes suficiente {missing.join(' ni ')}.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => respondPeacePact(false)} className="btn btn-ghost min-h-[44px] py-2.5 text-[15px]">
          Rechazar
        </button>
        <button
          type="button"
          onClick={() => respondPeacePact(true)}
          disabled={!canPay}
          className="btn btn-primary min-h-[44px] py-2.5 text-[15px]"
        >
          <PeaceSealIcon className="w-4 h-4" />
          Aceptar
        </button>
      </div>
    </Modal>
  );
}
