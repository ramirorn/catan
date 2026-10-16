import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { Modal } from '../Shared/Modal';
import { ConfirmDialog } from '../Shared/ConfirmDialog';
import { pieceColor } from '../../utils/theme';
import { PHASE } from '../../utils/constants';
import { formatDuration, useGameElapsed } from '../../utils/gameClock';
import { SettlementIcon, CrownIcon, EyeIcon, ExitIcon, FlagIcon } from '../Shared/Icons';

/**
 * Room menu (header ☰): game info, who is playing / watching, the host's
 * «Expulsar» buttons and «Salir de la partida». Leaving and kicking ask first.
 */
export function RoomMenuModal({ isOpen, onClose }) {
  const {
    gameState, myPlayerId, isSpectator, isHost, hostId, spectators, serverOffset,
    leaveRoom, kickPlayer, setActiveModal,
  } = useGame();
  const [confirm, setConfirm] = useState(null); // { kind: 'leave' } | { kind: 'kick', id, name }
  const elapsed = useGameElapsed(gameState?.startedAt, gameState?.endedAt, serverOffset);

  if (!isOpen || !gameState) return null;

  const inLobby = gameState.phase === PHASE.LOBBY;
  const gameOver = gameState.phase === PHASE.GAME_OVER;
  const order = gameState.playerOrder || [];

  if (confirm) {
    const close = () => setConfirm(null);
    if (confirm.kind === 'leave') {
      return (
        <ConfirmDialog
          isOpen
          title={isSpectator ? '¿Dejar de observar?' : '¿Salir de la partida?'}
          confirmLabel={isSpectator ? 'Dejar de observar' : 'Salir'}
          onCancel={close}
          onConfirm={() => {
            close();
            onClose();
            leaveRoom();
          }}
        >
          {isSpectator ? (
            <p>Volverás al menú principal. Puedes volver a observar con el código de la sala.</p>
          ) : inLobby || gameOver ? (
            <p>Volverás al menú principal.</p>
          ) : (
            <p>
              Dejarás tu asiento y volverás al menú principal. Tus piezas se quedan en el tablero y el servidor
              pasará tus turnos. Mientras dure la partida puedes volver con el código <strong className="text-ink">{gameState.roomId}</strong>.
            </p>
          )}
        </ConfirmDialog>
      );
    }
    return (
      <ConfirmDialog
        isOpen
        title="¿Expulsar de la sala?"
        confirmLabel="Expulsar"
        onCancel={close}
        onConfirm={() => {
          close();
          kickPlayer(confirm.id);
        }}
      >
        <p>
          <strong className="text-ink">{confirm.name}</strong> volverá al menú principal y no podrá entrar otra vez a esta sala.
          {!inLobby && !confirm.spectator && ' Su asiento queda en el tablero y el servidor pasa sus turnos.'}
        </p>
      </ConfirmDialog>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Sala ${gameState.roomId}`}
      maxWidth="max-w-md"
      actions={
        <>
          <button type="button" className="btn btn-ghost min-h-[42px] px-4 py-1.5" onClick={onClose}>
            Volver
          </button>
          <button type="button" className="btn btn-primary min-h-[42px] px-4 py-1.5" onClick={() => setConfirm({ kind: 'leave' })}>
            <ExitIcon className="w-4 h-4" />
            {isSpectator ? 'Dejar de observar' : 'Salir de la partida'}
          </button>
        </>
      }
    >
      <dl className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="border border-ink/15 rounded-[3px] py-1.5">
          <dt className="label-caps !text-[10px]">Duración</dt>
          <dd className="font-serif font-extrabold text-lg tabular-nums text-ink">{elapsed === null ? '—' : formatDuration(elapsed)}</dd>
        </div>
        <div className="border border-ink/15 rounded-[3px] py-1.5">
          <dt className="label-caps !text-[10px]">Ronda</dt>
          <dd className="font-serif font-extrabold text-lg text-ink">{gameState.turnNumber || '—'}</dd>
        </div>
        <div className="border border-ink/15 rounded-[3px] py-1.5">
          <dt className="label-caps !text-[10px]">Espectadores</dt>
          <dd className="font-serif font-extrabold text-lg text-ink">{spectators.length}</dd>
        </div>
      </dl>

      {isSpectator && (
        <p className="flex items-center gap-2 mb-4 px-3 py-2 border border-chakra/60 bg-chakra/10 rounded-[3px] text-[13px] text-ink">
          <EyeIcon className="w-4 h-4 text-chakra shrink-0" />
          Estás observando: ves el tablero y la crónica, pero no las cartas de nadie.
        </p>
      )}

      {!isSpectator && !inLobby && !gameOver && (
        <button
          type="button"
          onClick={() => setActiveModal('endGame')}
          className="w-full mb-4 flex items-center justify-center gap-2 min-h-[40px] px-3 py-1.5 border border-ink/25 rounded-[3px] text-[13px] font-bold text-ink hover:border-ink/50 cursor-pointer"
        >
          <FlagIcon className="w-4 h-4" />
          Votar para terminar la partida
        </button>
      )}

      <div className="label-caps mb-1">Ninjas</div>
      <ul className="border-t border-ink/15 mb-4">
        {order.map((pid) => {
          const p = gameState.players?.[pid];
          if (!p) return null;
          const status = p.left ? 'Se fue' : p.connected === false ? 'Desconectado' : null;
          return (
            <li key={pid} className="flex items-center justify-between gap-2 py-1.5 border-b border-ink/15">
              <span className={`flex items-center gap-2 min-w-0 ${p.left ? 'opacity-55' : ''}`}>
                <span className="w-6 h-6 rounded-[3px] flex items-center justify-center shrink-0" style={{ backgroundColor: pieceColor(p.color) }}>
                  <SettlementIcon className="w-3.5 h-3.5 text-paper-light" />
                </span>
                <span className="font-bold text-ink truncate">
                  {p.name}
                  {pid === myPlayerId && <span className="ml-1 font-normal italic text-ink-faint text-[12px]">(tú)</span>}
                </span>
                {pid === hostId && <CrownIcon className="w-4 h-4 text-chakra shrink-0" aria-label="Anfitrión" />}
                {status && <span className="text-[12px] italic text-ink-faint shrink-0">{status}</span>}
              </span>
              {isHost && pid !== myPlayerId && !p.left && (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[34px] px-2.5 py-1 text-[12px] shrink-0"
                  onClick={() => setConfirm({ kind: 'kick', id: pid, name: p.name })}
                >
                  Expulsar
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="label-caps mb-1 flex items-center gap-1.5">
        <EyeIcon className="w-3.5 h-3.5" /> Espectadores
      </div>
      {spectators.length === 0 ? (
        <p className="text-[13px] italic text-ink-faint py-1.5 border-t border-ink/15">Nadie está observando.</p>
      ) : (
        <ul className="border-t border-ink/15">
          {spectators.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-ink/15">
              <span className="text-ink truncate">
                {s.name}
                {s.id === myPlayerId && <span className="ml-1 italic text-ink-faint text-[12px]">(tú)</span>}
              </span>
              {isHost && (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[34px] px-2.5 py-1 text-[12px] shrink-0"
                  onClick={() => setConfirm({ kind: 'kick', id: s.id, name: s.name, spectator: true })}
                >
                  Expulsar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
