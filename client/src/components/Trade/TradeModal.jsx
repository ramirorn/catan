import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { RESOURCE, RESOURCE_NAMES } from '../../utils/constants';
import { ResourceChip } from '../Shared/ResourceCard';
import { AnchorIcon, TradeIcon, CheckIcon, CloseIcon, ArrowRightIcon, PlusIcon, MinusIcon } from '../Shared/Icons';

const EMPTY_BUNDLE = {
  [RESOURCE.WOOD]: 0,
  [RESOURCE.BRICK]: 0,
  [RESOURCE.SHEEP]: 0,
  [RESOURCE.WHEAT]: 0,
  [RESOURCE.ORE]: 0,
};

export function TradeModal({ isOpen, onClose }) {
  const {
    gameState,
    myPlayerId,
    myPlayer,
    bankTrade,
    proposeTrade,
    respondToTrade,
    acceptTrade,
    cancelTrade,
  } = useGame();

  const [tradeType, setTradeType] = useState('bank');
  
  // Bank trade state
  const [bankGive, setBankGive] = useState(RESOURCE.WOOD);
  const [bankReceive, setBankReceive] = useState(RESOURCE.BRICK);

  // Player trade state
  const [offering, setOffering] = useState({
    [RESOURCE.WOOD]: 0,
    [RESOURCE.BRICK]: 0,
    [RESOURCE.SHEEP]: 0,
    [RESOURCE.WHEAT]: 0,
    [RESOURCE.ORE]: 0,
  });
  const [requesting, setRequesting] = useState({
    [RESOURCE.WOOD]: 0,
    [RESOURCE.BRICK]: 0,
    [RESOURCE.SHEEP]: 0,
    [RESOURCE.WHEAT]: 0,
    [RESOURCE.ORE]: 0,
  });

  // Counter-offer form (responder's point of view: what I give / what I get)
  const [counterOpen, setCounterOpen] = useState(false);
  const [counterGive, setCounterGive] = useState(EMPTY_BUNDLE);
  const [counterGet, setCounterGet] = useState(EMPTY_BUNDLE);

  if (!isOpen) return null;

  const portRatios = gameState?.portRatios || {
    [RESOURCE.WOOD]: 4,
    [RESOURCE.BRICK]: 4,
    [RESOURCE.SHEEP]: 4,
    [RESOURCE.WHEAT]: 4,
    [RESOURCE.ORE]: 4,
  };

  const myResources = myPlayer?.resources || {};
  const activeTrade = gameState?.activeTrade;
  const isTradeProposer = activeTrade && activeTrade.proposerId === myPlayerId;

  // Bank trade validation
  const giveRatio = portRatios[bankGive] || 4;
  const canAffordBankTrade = (myResources[bankGive] || 0) >= giveRatio && bankGive !== bankReceive;

  const handleBankTrade = () => {
    if (!canAffordBankTrade) return;
    bankTrade(bankGive, bankReceive);
  };

  // Player trade helpers
  const handleOfferChange = (res, delta) => {
    const current = offering[res] || 0;
    const maxAvailable = myResources[res] || 0;
    const next = Math.max(0, Math.min(maxAvailable, current + delta));
    setOffering((prev) => ({ ...prev, [res]: next }));
  };

  const handleRequestChange = (res, delta) => {
    const current = requesting[res] || 0;
    const next = Math.max(0, current + delta);
    setRequesting((prev) => ({ ...prev, [res]: next }));
  };

  const totalOffered = Object.values(offering).reduce((a, b) => a + b, 0);
  const totalRequested = Object.values(requesting).reduce((a, b) => a + b, 0);
  const canPropose = totalOffered > 0 && totalRequested > 0;

  const openCounter = () => {
    // Start from the original offer, flipped to my side
    setCounterGive({ ...EMPTY_BUNDLE, ...(activeTrade?.requesting || {}) });
    setCounterGet({ ...EMPTY_BUNDLE, ...(activeTrade?.offering || {}) });
    setCounterOpen(true);
  };
  const changeCounterGive = (res, delta) => {
    const max = myResources[res] || 0;
    setCounterGive((prev) => ({ ...prev, [res]: Math.max(0, Math.min(max, (prev[res] || 0) + delta)) }));
  };
  const changeCounterGet = (res, delta) => {
    setCounterGet((prev) => ({ ...prev, [res]: Math.max(0, (prev[res] || 0) + delta) }));
  };
  const sumOf = (b) => Object.values(b || {}).reduce((a, n) => a + n, 0);
  const canSendCounter = sumOf(counterGive) > 0 && sumOf(counterGet) > 0;
  const sendCounter = () => {
    if (!canSendCounter) return;
    respondToTrade('counter', { give: counterGive, get: counterGet });
    setCounterOpen(false);
  };
  const myResponse = activeTrade?.responses?.[myPlayerId];
  const myCounter = activeTrade?.counterOffers?.[myPlayerId];

  const handlePropose = () => {
    if (!canPropose) return;
    proposeTrade(offering, requesting);
  };

  const resourceList = [
    RESOURCE.WOOD,
    RESOURCE.BRICK,
    RESOURCE.SHEEP,
    RESOURCE.WHEAT,
    RESOURCE.ORE,
  ];

  const renderBundle = (bundle) => {
    const entries = Object.entries(bundle || {}).filter(([, v]) => v > 0);
    if (entries.length === 0) return <span className="italic text-ink-faint">nada</span>;
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1.5">
        {entries.map(([r, v]) => (
          <span key={r} className="inline-flex items-center gap-1.5 font-semibold text-ink">
            <span className="font-serif font-extrabold text-lg leading-none">{v}</span>
            <ResourceChip type={r} />
            <span className="text-[13px]">{RESOURCE_NAMES[r]}</span>
          </span>
        ))}
      </span>
    );
  };

  const renderStepper = (col, res) => (
    <span className="flex items-center gap-1 min-[360px]:gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => col.onChange(res, -1)}
        className="stepper"
        aria-label={`${col.title}: menos ${RESOURCE_NAMES[res]}`}
      >
        <MinusIcon className="w-3.5 h-3.5" />
      </button>
      <span className="font-serif font-extrabold text-lg w-6 text-center text-ink tabular-nums">{col.values[res] || 0}</span>
      <button
        type="button"
        onClick={() => col.onChange(res, 1)}
        className="stepper"
        aria-label={`${col.title}: más ${RESOURCE_NAMES[res]}`}
      >
        <PlusIcon className="w-3.5 h-3.5" />
      </button>
    </span>
  );

  const renderSteppers = (cols) => (
    <>
      {/* Phones: one row per resource, both sides next to each other */}
      <table className="sm:hidden w-full mb-1 border-collapse">
        <thead>
          <tr>
            <th className="w-full" />
            {cols.map((col) => (
              <th key={col.title} className="label-caps !text-[10px] text-center pb-1 pl-1.5 min-[360px]:pl-2.5 whitespace-nowrap font-bold">
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resourceList.map((res) => (
            <tr key={res} className="border-t border-ink/15">
              <td className="py-1.5 pr-1">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold min-w-0">
                  <ResourceChip type={res} className="w-6 h-6" iconClassName="w-4 h-4" />
                  <span className="max-[359px]:sr-only truncate">{RESOURCE_NAMES[res]}</span>
                </span>
              </td>
              {cols.map((col, i) => (
                <td
                  key={col.title}
                  className={`py-1.5 pl-1.5 min-[360px]:pl-2.5 ${i > 0 ? 'border-l border-dashed border-ink/20' : ''}`}
                >
                  {renderStepper(col, res)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Wider screens: one list per side */}
      <div className="hidden sm:grid grid-cols-2 gap-6 mb-5">
        {cols.map((col) => (
          <div key={col.title}>
            <div className="label-caps mb-1">{col.title}</div>
            <ul className="border-t border-ink/15">
              {resourceList.map((res) => (
                <li key={res} className="flex items-center justify-between gap-2 py-1.5 border-b border-ink/15">
                  <span className="flex items-center gap-2 text-[14px] font-semibold">
                    <ResourceChip type={res} />
                    <span>{RESOURCE_NAMES[res]}</span>
                  </span>
                  {renderStepper(col, res)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );

  const tabClass = (isActive) =>
    `flex-1 flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] py-2 text-[13px] min-[360px]:text-[14px] font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
      isActive ? 'border-chakra text-ink' : 'border-transparent text-ink-faint hover:text-ink-soft'
    }`;

  const optionRow = (isSelected, extra = '') =>
    `w-full min-h-[40px] flex items-center justify-between gap-2 px-2.5 py-1.5 sm:py-2 rounded-[3px] border text-[14px] font-semibold transition-colors cursor-pointer ${extra} ${
      isSelected
        ? 'bg-paper-light border-shu text-ink shadow-[0_0_0_1px_var(--color-shu)]'
        : 'bg-transparent border-ink/20 text-ink-soft hover:border-ink/40 hover:bg-paper-light/60'
    }`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Comercio"
      maxWidth="max-w-2xl"
      actions={
        <button type="button" onClick={onClose} className="btn btn-ghost px-4 py-2 text-[13px]">
          Cerrar
        </button>
      }
    >
      {/* Active Trade Banner */}
      {activeTrade && activeTrade.status === 'pending' && (
        <div className="paper-inset p-3 sm:p-4 mb-4 sm:mb-5 border-l-4 !border-l-chakra">
          <div className="label-caps !text-ink-soft mb-3">
            {isTradeProposer ? 'Tu propuesta activa' : `Propuesta de ${activeTrade.proposerName}`}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <span className="block text-[12px] text-ink-faint mb-1">Ofrece</span>
              {renderBundle(activeTrade.offering)}
            </div>
            <div>
              <span className="block text-[12px] text-ink-faint mb-1">Pide a cambio</span>
              {renderBundle(activeTrade.requesting)}
            </div>
          </div>

          {/* Proposer view */}
          {isTradeProposer ? (
            <div>
              <div className="text-[12px] text-ink-faint mb-1">Respuestas de los ninjas</div>
              <ul className="mb-3 border-t border-ink/15">
                {Object.entries(activeTrade.responses).map(([pid, resp]) => {
                  const pName = gameState.players[pid]?.name || 'Ninja';
                  const isAccepted = resp === 'accept';
                  if (resp === 'counter') {
                    const c = activeTrade.counterOffers?.[pid];
                    // Ignore malformed counters instead of crashing the modal
                    if (!c?.offering || !c?.requesting) return null;
                    // Stored from my side: I give c.offering, I get c.requesting
                    const iCanPay = Object.entries(c.offering).every(([r, n]) => (myResources[r] || 0) >= n);
                    return (
                      <li key={pid} className="py-2.5 border-b border-ink/15 text-[14px]">
                        <div className="mb-1.5">
                          {pName}: <strong className="text-chakra">contraoferta</strong>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                          <div>
                            <span className="block text-[12px] text-ink-faint mb-0.5">Tú das</span>
                            {renderBundle(c.offering)}
                          </div>
                          <div>
                            <span className="block text-[12px] text-ink-faint mb-0.5">Tú recibes</span>
                            {renderBundle(c.requesting)}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!iCanPay}
                          onClick={() => acceptTrade(pid)}
                          className="btn btn-primary min-h-[40px] px-3 py-1 text-[13px]"
                        >
                          {iCanPay ? 'Aceptar contraoferta' : 'No tienes esos recursos'}
                        </button>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={pid}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-ink/15 text-[14px]"
                    >
                      <span>
                        {pName}:{' '}
                        <strong className={isAccepted ? 'text-leaf' : 'text-shu'}>
                          {isAccepted ? 'aceptó' : 'rechazó'}
                        </strong>
                      </span>
                      {isAccepted && (
                        <button
                          type="button"
                          onClick={() => acceptTrade(pid)}
                          className="btn btn-leaf min-h-[40px] px-3 py-1 text-[13px]"
                        >
                          Comerciar con {pName}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              <button type="button" onClick={cancelTrade} className="btn btn-ghost min-h-[40px] px-3 py-1.5 text-[13px] !text-shu !border-shu/50">
                Cancelar propuesta
              </button>
            </div>
          ) : (
            /* Recipient view */
            <div>
              {myResponse === 'reject' ? (
                <p className="text-[14px] italic text-ink-soft">
                  Rechazaste esta oferta.
                </p>
              ) : (
              <>
              {myResponse === 'counter' && myCounter && !counterOpen && (
                <p className="text-[13px] text-ink-soft mb-3">
                  Enviaste una contraoferta. Esperando a que {activeTrade.proposerName} la acepte.
                </p>
              )}
              {counterOpen ? (
                <div>
                  <div className="label-caps mb-2">Tu contraoferta</div>
                  {renderSteppers([
                    { title: 'Tú das', values: counterGive, onChange: changeCounterGive },
                    { title: 'Tú pides', values: counterGet, onChange: changeCounterGet },
                  ])}
                  <div className="inset-sticky flex gap-2">
                    <button type="button" disabled={!canSendCounter} onClick={sendCounter} className="btn btn-primary flex-1 sm:flex-none min-h-[44px] px-3 min-[360px]:px-4 py-2 text-[13px] min-[360px]:text-[14px]">
                      Enviar contraoferta
                    </button>
                    <button type="button" onClick={() => setCounterOpen(false)} className="btn btn-ghost min-h-[44px] px-3 min-[360px]:px-4 py-2 text-[13px] min-[360px]:text-[14px]">
                      Volver
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => respondToTrade('accept')} className="btn btn-leaf min-h-[44px] px-4 py-2 text-[14px]">
                    <CheckIcon className="w-4 h-4" />
                    Aceptar e intercambiar
                  </button>
                  <button type="button" onClick={() => respondToTrade('reject')} className="btn btn-ghost min-h-[44px] px-4 py-2 text-[14px]">
                    <CloseIcon className="w-4 h-4" />
                    Rechazar
                  </button>
                  <button type="button" onClick={openCounter} className="btn btn-ghost min-h-[44px] px-4 py-2 text-[14px]">
                    <TradeIcon className="w-4 h-4" />
                    {myResponse === 'counter' ? 'Cambiar contraoferta' : 'Contraoferta'}
                  </button>
                </div>
              )}
              </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex mb-4 sm:mb-5 border-b border-ink/15" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tradeType === 'bank'}
          onClick={() => setTradeType('bank')}
          className={tabClass(tradeType === 'bank')}
        >
          <AnchorIcon className="w-4 h-4" />
          Banca y puertos
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tradeType === 'players'}
          onClick={() => setTradeType('players')}
          className={tabClass(tradeType === 'players')}
        >
          <TradeIcon className="w-4 h-4" />
          Entre ninjas
        </button>
      </div>

      {tradeType === 'bank' ? (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4 mb-1 sm:mb-5 items-start">
            {/* Give */}
            <div>
              <div className="label-caps mb-2">Entregas (según tu puerto)</div>
              <div className="space-y-1.5">
                {resourceList.map((res) => {
                  const ratio = portRatios[res] || 4;
                  const available = myResources[res] || 0;
                  const isSelected = bankGive === res;
                  const canAfford = available >= ratio;

                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setBankGive(res)}
                      className={optionRow(isSelected)}
                    >
                      <span className="flex items-center gap-2">
                        <ResourceChip type={res} />
                        <span>{RESOURCE_NAMES[res]}</span>
                      </span>
                      <span className="flex items-baseline gap-2 text-[12px]">
                        <span className={`font-serif font-extrabold text-[15px] ${canAfford ? 'text-leaf' : 'text-ink-faint'}`}>
                          {ratio}:1
                        </span>
                        <span className="text-ink-faint">tienes {available}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden sm:flex self-center text-ink-faint pt-6">
              <ArrowRightIcon className="w-6 h-6" />
            </div>

            {/* Receive */}
            <div>
              <div className="label-caps mb-2">Recibes (1 recurso)</div>
              <div className="space-y-1.5">
                {resourceList.map((res) => {
                  const isSelected = bankReceive === res;
                  const isSame = bankGive === res;

                  return (
                    <button
                      key={res}
                      type="button"
                      disabled={isSame}
                      onClick={() => setBankReceive(res)}
                      className={optionRow(isSelected && !isSame, isSame ? '!opacity-30 !cursor-not-allowed' : '')}
                    >
                      <span className="flex items-center gap-2">
                        <ResourceChip type={res} />
                        <span>{RESOURCE_NAMES[res]}</span>
                      </span>
                      <span className="font-serif font-extrabold text-[15px] text-ink">+1</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="sheet-sticky">
          <button
            type="button"
            disabled={!canAffordBankTrade}
            onClick={handleBankTrade}
            className="btn btn-primary w-full py-3 text-[14px]"
          >
            {canAffordBankTrade
              ? `Intercambiar ${giveRatio} ${RESOURCE_NAMES[bankGive]} por 1 ${RESOURCE_NAMES[bankReceive]}`
              : `Necesitas ${giveRatio} ${RESOURCE_NAMES[bankGive]} (tienes ${myResources[bankGive] || 0})`}
          </button>
          </div>
        </div>
      ) : (
        /* Player to Player Trade */
        <div>
          {renderSteppers([
            { title: 'Tú ofreces', values: offering, onChange: handleOfferChange },
            { title: 'Tú pides', values: requesting, onChange: handleRequestChange },
          ])}

          <div className="sheet-sticky">
          <button
            type="button"
            disabled={!canPropose}
            onClick={handlePropose}
            className="btn btn-primary w-full py-3 text-[14px]"
          >
            {canPropose ? 'Enviar propuesta a los ninjas' : 'Selecciona recursos para ofrecer y pedir'}
          </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
