import { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { pieceColor } from '../../utils/theme';
import { CrownIcon, CopyIcon, HourglassIcon, EyeIcon, ExitIcon } from '../Shared/Icons';
import { ConfirmDialog } from '../Shared/ConfirmDialog';
import { ScrollPanel } from '../Shared/ScrollPanel';
import { BrandPlate } from '../Shared/Brand';
import { RoomRules } from './RoomRules';
import { PlayerAvatar } from '../Shared/Avatar';
import { AvatarPicker } from '../Shared/AvatarPicker';
import { SPECTATOR_RING } from '../../utils/avatars';

export function WaitingRoom() {
  const {
    gameState, myPlayerId, startGame, addToast, updateRoomSettings,
    hostId, isHost, isSpectator, spectators, leaveRoom, kickPlayer,
    avatarId, setAvatarId,
  } = useGame();
  const [confirm, setConfirm] = useState(null); // { kind: 'leave' } | { kind: 'kick', id, name }

  if (!gameState) return null;

  const players = (gameState.playerOrder || []).map((pid) => gameState.players?.[pid]).filter(Boolean);
  const canStart = players.length >= 2;

  const copyRoomCode = () => {
    navigator.clipboard.writeText(gameState.roomId);
    addToast('¡Código de sala copiado al portapapeles!', 'success');
  };

  const maxPlayers = gameState.boardType === 'extended' ? 6 : 4;
  const emptySlots = Math.max(0, maxPlayers - players.length);

  return (
    <div className="night-surface relative h-dvh w-full overflow-hidden">
      <div className="h-full w-full flex flex-col items-center justify-center safe-x [--pad-x:0.75rem] min-[360px]:[--pad-x:1rem] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-[max(1.5rem,env(safe-area-inset-top))] sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] phland:pt-[max(0.6rem,env(safe-area-inset-top))] phland:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3 mb-3 sm:mb-4 shrink-0 tiny:mb-2 phland:hidden">
          <BrandPlate className="w-12 h-8 tiny:w-10 tiny:h-[27px]" />
          <span className="font-display text-[30px] tiny:text-[26px] sm:text-[36px] leading-none text-paper-light drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
            Catán <span className="text-chakra">Shinobi</span>
          </span>
        </div>

        <ScrollPanel className="animate-modal-pop w-full max-w-lg md:max-w-3xl phland:max-w-3xl min-h-0 flex flex-col" bodyClassName="px-4 min-[360px]:px-5 sm:px-8 pt-5 tiny:pt-4 pb-5 tiny:pb-4 phland:pt-3 phland:pb-3.5 min-h-0 overflow-y-auto flex flex-col md:grid md:grid-cols-2 md:grid-rows-[auto_1fr] md:gap-x-8 phland:grid phland:grid-cols-2 phland:grid-rows-[auto_1fr] phland:gap-x-6">
          <div className="shrink-0 md:col-start-1 md:row-start-1 phland:col-start-1 phland:row-start-1">
          <p className="label-caps">Sala de reunión</p>
          <h2 className="font-display text-[23px] min-[360px]:text-[26px] sm:text-[30px] tiny:text-[22px] phland:text-[22px] leading-tight text-ink mt-0.5">
            Reuniendo al escuadrón
          </h2>

          {/* Room Code */}
          <div className="mt-3 mb-4 tiny:mt-2 tiny:mb-3 phland:mt-2 phland:mb-2.5 flex items-center justify-between gap-2 min-[360px]:gap-4 px-3 min-[360px]:px-4 py-2.5 tiny:py-2 phland:py-1.5 shrink-0 border-y-2 border-double border-ink/40 bg-paper-deep/30">
            <div className="min-w-0">
              <div className="text-[12px] text-ink-faint">Comparte este código de sala</div>
              <div className="inline-block font-serif font-extrabold text-[24px] min-[360px]:text-[28px] sm:text-[32px] phland:text-[26px] leading-none tracking-[0.16em] min-[360px]:tracking-[0.22em] text-shu mt-1.5 px-2 py-1 border-2 border-shu rounded-[3px] -rotate-1">
                {gameState.roomId}
              </div>
            </div>
            <button type="button" onClick={copyRoomCode} className="btn btn-ghost min-h-[44px] min-w-[44px] px-3 py-2 text-[13px] shrink-0" title="Copiar código" aria-label="Copiar código de sala">
              <CopyIcon className="w-4 h-4" />
              <span className="max-[359px]:hidden phland:max-[760px]:hidden">Copiar</span>
            </button>
          </div>

          {/* Room rules: the host can still change them; the others see them */}
          <RoomRules
            idPrefix="room"
            className="mb-4 tiny:mb-3 phland:mb-2"
            readOnly={!isHost}
            vpToWin={gameState.vpToWin}
            turnTimeLimit={gameState.turnTimeLimit}
            peacePacts={gameState.peacePacts !== false}
            onChange={updateRoomSettings}
          />
          </div>

          {/* Settlers List */}
          <div className="mb-4 tiny:mb-3 md:mb-0 phland:mb-0 min-h-[7.5rem] flex flex-col md:col-start-2 md:row-start-1 md:row-span-2 md:pt-1 phland:col-start-2 phland:row-start-1 phland:row-span-2 phland:min-h-0">
            <div className="flex items-baseline justify-between mb-1 shrink-0">
              <span className="label-caps">Ninjas conectados</span>
              <span className="font-serif font-extrabold text-lg text-ink">
                {players.length}
                <span className="text-ink-faint"> / {maxPlayers}</span>
              </span>
            </div>

            <ul className="border-t border-ink/15 min-h-0 overflow-y-auto">
              {players.map((p) => {
                const isThisHost = p.id === hostId;
                const isMe = p.id === myPlayerId;

                return (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 short:py-1.5 phland:py-1.5 border-b border-ink/15">
                    <div className="flex items-center gap-3 min-w-0">
                      {isMe ? (
                        <AvatarPicker value={avatarId} onChange={setAvatarId} ring={pieceColor(p.color)} size={30} />
                      ) : (
                        <PlayerAvatar player={p} size={30} />
                      )}
                      <span className="text-[15px] font-bold text-ink truncate">
                        {p.name}
                        {isMe && <span className="ml-1.5 font-normal italic text-ink-faint text-[13px]">(tú)</span>}
                      </span>
                    </div>

                    <span className="flex items-center gap-2 shrink-0">
                      {isThisHost && (
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-chakra shrink-0">
                          <CrownIcon className="w-4 h-4" />
                          <span className="max-[359px]:hidden">Anfitrión</span>
                        </span>
                      )}
                      {isHost && !isMe && (
                        <button
                          type="button"
                          className="btn btn-ghost min-h-[34px] px-2.5 py-1 text-[12px]"
                          onClick={() => setConfirm({ kind: 'kick', id: p.id, name: p.name })}
                        >
                          Expulsar
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
              {Array.from({ length: emptySlots }, (_, i) => (
                <li key={`empty-${i}`} className="flex items-center gap-3 py-2 short:py-1.5 phland:py-1.5 border-b border-ink/15">
                  <span className="w-[30px] h-[30px] rounded-full border border-dashed border-ink/30 shrink-0" />
                  <span className="text-[14px] italic text-ink-faint">Plaza libre</span>
                </li>
              ))}
            </ul>

            {/* Spectators (anyone can watch, also once the game is running) */}
            {spectators.length > 0 && (
              <div className="mt-3 shrink-0">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="label-caps flex items-center gap-1.5">
                    <EyeIcon className="w-3.5 h-3.5" /> Espectadores
                  </span>
                  <span className="font-serif font-extrabold text-ink">{spectators.length}</span>
                </div>
                <ul className="border-t border-ink/15 max-h-28 overflow-y-auto">
                  {spectators.map((sp) => (
                    <li key={sp.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-ink/15">
                      <span className="flex items-center gap-2 min-w-0 text-[14px] text-ink">
                        {sp.id === myPlayerId ? (
                          <AvatarPicker value={avatarId} onChange={setAvatarId} ring={SPECTATOR_RING} size={24} />
                        ) : (
                          <PlayerAvatar player={sp} size={24} spectator />
                        )}
                        <span className="truncate">{sp.name}</span>
                        {sp.id === myPlayerId && <span className="shrink-0 italic text-ink-faint text-[13px]">(tú)</span>}
                      </span>
                      {isHost && (
                        <button
                          type="button"
                          className="btn btn-ghost min-h-[34px] px-2.5 py-1 text-[12px] shrink-0"
                          onClick={() => setConfirm({ kind: 'kick', id: sp.id, name: sp.name })}
                        >
                          Expulsar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Start / Waiting Action */}
          <div className="shrink-0 md:col-start-1 md:row-start-2 md:self-end phland:col-start-1 phland:row-start-2 phland:self-end">
          {isSpectator ? (
            <div className="flex items-center justify-center gap-2 py-2 text-[14px] italic text-ink-soft">
              <EyeIcon className="w-4 h-4 text-chakra" />
              <span>Estás observando. La partida se verá aquí cuando empiece.</span>
            </div>
          ) : isHost ? (
            <div>
              <button
                type="button"
                onClick={startGame}
                disabled={!canStart}
                className="btn btn-primary w-full min-h-[44px] py-3 phland:py-2.5 text-[15px]"
              >
                {canStart ? 'Comenzar la misión' : 'Esperando más ninjas (mínimo 2)…'}
              </button>
              {!canStart && (
                <p className="text-center text-[13px] italic text-ink-faint mt-2 tiny:hidden phland:text-[12px] phland:mt-1.5">
                  ¡Comparte el código con un amigo o abre otra ventana del navegador para jugar!
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 text-[14px] italic text-ink-soft">
              <HourglassIcon className="w-4 h-4 text-chakra" />
              <span>Esperando a que el anfitrión inicie la partida…</span>
            </div>
          )}
            <button
              type="button"
              onClick={() => setConfirm({ kind: 'leave' })}
              className="btn btn-ghost w-full min-h-[40px] mt-2 py-2 text-[14px]"
            >
              <ExitIcon className="w-4 h-4" />
              {isSpectator ? 'Dejar de observar' : 'Salir de la sala'}
            </button>
          </div>
        </ScrollPanel>

        <ConfirmDialog
          isOpen={!!confirm}
          title={confirm?.kind === 'kick' ? '¿Expulsar de la sala?' : isSpectator ? '¿Dejar de observar?' : '¿Salir de la sala?'}
          confirmLabel={confirm?.kind === 'kick' ? 'Expulsar' : 'Salir'}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const c = confirm;
            setConfirm(null);
            if (c?.kind === 'kick') kickPlayer(c.id);
            else leaveRoom();
          }}
        >
          {confirm?.kind === 'kick' ? (
            <p><strong className="text-ink">{confirm.name}</strong> volverá al menú principal y no podrá entrar otra vez a esta sala.</p>
          ) : (
            <p>Volverás al menú principal.{isHost && players.length > 1 ? ' Otro ninja pasará a ser el anfitrión.' : ''}</p>
          )}
        </ConfirmDialog>
      </div>
    </div>
  );
}
