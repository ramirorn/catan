import { useState } from 'react';
import { adminPost, usePolling } from '../api';
import { ActionDialog, Badge, Btn, Card, Empty, ErrorNote, Field, Stat } from '../ui';
import { BOARD_LABELS, PHASE_LABELS, fmtAgo, fmtDuration, fmtTime } from '../format';
import { useGame } from '../../context/GameContext';
import { PlayerAvatar } from '../../components/Shared/Avatar';

const POLL_MS = 4000;

function phaseTone(phase) {
  if (phase === 'lobby') return 'steel';
  if (phase === 'gameOver') return 'ink';
  return 'leaf';
}

function MemberRow({ person, spectator = false, room, onKick, onOpenUser }) {
  return (
    <li className="flex items-center gap-2 py-1 text-[13px] min-w-0">
      <PlayerAvatar player={person} size={22} spectator={spectator} />
      <span className={`font-bold truncate ${person.left ? 'line-through text-ink-faint' : ''}`}>{person.name}</span>
      {!spectator && room.phase !== 'lobby' && <span className="tabular-nums text-ink-faint">{person.vp} PV</span>}
      <span className="flex flex-wrap gap-1">
        {person.isHost && <Badge tone="chakra">Anfitrión</Badge>}
        {!person.connected && !person.left && <Badge tone="steel">Desconectado</Badge>}
        {person.left && <Badge tone="ink">{person.kicked ? 'Expulsado' : 'Salió'}</Badge>}
        {person.accountId && (
          <button type="button" onClick={() => onOpenUser(person.accountId)} className="underline decoration-dotted text-[11px] text-sea font-bold" title="Ver la cuenta">
            cuenta
          </button>
        )}
      </span>
      {!person.left && !person.kicked && (
        <button type="button" className="ml-auto text-[12px] font-bold text-shu hover:underline shrink-0" onClick={() => onKick(person, spectator)}>
          Expulsar
        </button>
      )}
    </li>
  );
}

function RoomCard({ room, now, onObserve, onClose, onKick, onOpenUser }) {
  const host = room.players.find((p) => p.id === room.host);
  const running = room.startedAt && room.phase !== 'lobby';
  const duration = running ? ((room.endedAt || now) - room.startedAt) / 1000 : null;
  return (
    <article className="paper rounded-[2px] border border-paper-edge shadow-[0_6px_16px_-8px_rgba(0,0,0,0.7)] flex flex-col">
      <header className="flex flex-wrap items-center gap-2 px-3 pt-2.5 pb-2 border-b border-dashed border-ink/25">
        <span className="font-mono font-bold text-[18px] tracking-wider">{room.roomId}</span>
        <Badge tone={phaseTone(room.phase)}>{PHASE_LABELS[room.phase] || room.phase}</Badge>
        {room.round > 0 && <span className="text-[12px] text-ink-soft">Ronda {room.round}</span>}
        <span className="text-[12px] text-ink-faint ml-auto">{BOARD_LABELS[room.boardType] || room.boardType} · {room.vpToWin} PV</span>
      </header>
      <div className="px-3 py-2 text-[12px] text-ink-soft space-y-0.5">
        <p>Creada {fmtAgo(room.createdAt, now)}{room.startedAt ? ` · empezó ${fmtTime(room.startedAt)}` : ''}{duration !== null ? ` · dura ${fmtDuration(duration)}` : ''}</p>
        <p>Anfitrión: <strong className="text-ink">{host ? host.name : '—'}</strong>{room.adminWatchers > 0 ? ` · ${room.adminWatchers} admin observando` : ''}</p>
      </div>
      <div className="px-3 pb-2">
        <p className="text-[11px] uppercase tracking-wider text-ink-faint font-bold">Jugadores ({room.players.filter((p) => !p.left).length})</p>
        <ul className="divide-y divide-ink/10">
          {room.players.map((p) => <MemberRow key={p.id} person={p} room={room} onKick={onKick} onOpenUser={onOpenUser} />)}
        </ul>
        {room.spectators.length > 0 && (
          <>
            <p className="mt-2 text-[11px] uppercase tracking-wider text-ink-faint font-bold">Espectadores ({room.spectators.filter((s) => s.connected).length})</p>
            <ul className="divide-y divide-ink/10">
              {room.spectators.map((s) => <MemberRow key={s.id} person={s} spectator room={room} onKick={onKick} onOpenUser={onOpenUser} />)}
            </ul>
          </>
        )}
      </div>
      <footer className="mt-auto flex flex-wrap gap-2 px-3 py-2 border-t border-dashed border-ink/25 bg-paper-deep/40">
        <Btn onClick={() => onObserve(room.roomId)}>Observar</Btn>
        <Btn variant="primary" className="ml-auto" onClick={() => onClose(room)}>Cerrar sala</Btn>
      </footer>
    </article>
  );
}

export function GamesTab({ onObserve, onOpenUser }) {
  const { data, error, reload } = usePolling('/live', POLL_MS);
  const { addToast } = useGame();
  const [dialog, setDialog] = useState(null); // { kind: 'close' | 'kick', room, person?, spectator? }
  const [reason, setReason] = useState('');

  const openDialog = (d) => {
    setReason('');
    setDialog(d);
  };

  const confirm = async () => {
    if (dialog.kind === 'close') {
      const r = await adminPost(`/live/rooms/${dialog.room.roomId}/close`, { reason });
      if (r.ok) addToast(`Sala ${dialog.room.roomId} cerrada`, 'success');
      reload();
      return r;
    }
    const r = await adminPost(`/live/rooms/${dialog.room.roomId}/kick`, { targetId: dialog.person.id, reason });
    if (r.ok) addToast(`${dialog.person.name} fue expulsado de ${dialog.room.roomId}`, 'success');
    reload();
    return r;
  };

  const rooms = data ? [...data.rooms].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0) || b.createdAt - a.createdAt) : [];
  const now = data ? data.now : 0;

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Stat label="Conectados" value={data ? data.connections.players : '…'} hint={data ? `${data.connections.accounts} con cuenta` : null} />
        <Stat label="Salas" value={data ? data.counts.total : '…'} />
        <Stat label="En juego" value={data ? data.counts.running : '…'} tone="leaf" />
        <Stat label="Esperando" value={data ? data.counts.lobby : '…'} />
        <Stat label="Terminadas" value={data ? data.counts.over : '…'} />
        <Stat label="Mantenimiento" value={data ? (data.maintenance.on ? 'Activo' : 'No') : '…'} tone={data && data.maintenance.on ? 'shu' : 'ink'} />
      </div>
      <ErrorNote>{error}</ErrorNote>

      <Card title="Salas en este servidor" actions={<Btn onClick={reload}>Actualizar</Btn>}>
        {data && rooms.length === 0 ? (
          <Empty>No hay salas abiertas ahora mismo.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.roomId}
                room={room}
                now={now}
                onObserve={onObserve}
                onOpenUser={onOpenUser}
                onClose={(r) => openDialog({ kind: 'close', room: r })}
                onKick={(person, spectator) => openDialog({ kind: 'kick', room, person, spectator })}
              />
            ))}
          </div>
        )}
        <p className="mt-3 text-[12px] text-ink-faint">Se actualiza cada {POLL_MS / 1000} s. Las salas viven en la memoria del servidor: un reinicio o despliegue las cierra todas.</p>
      </Card>

      {dialog && (
        <ActionDialog
          key={`${dialog.kind}-${dialog.room.roomId}-${dialog.person?.id || ''}`}
          title={dialog.kind === 'close' ? `Cerrar la sala ${dialog.room.roomId}` : `Expulsar a ${dialog.person.name}`}
          confirmLabel={dialog.kind === 'close' ? 'Cerrar sala' : 'Expulsar'}
          onConfirm={confirm}
          onClose={() => setDialog(null)}
        >
          <p className="text-[14px] text-ink-soft">
            {dialog.kind === 'close'
              ? 'Todos los jugadores y espectadores vuelven al menú con tu mensaje. La partida se pierde y no paga Ryō.'
              : `${dialog.spectator ? 'El espectador' : 'El jugador'} vuelve al menú y no podrá volver a entrar en esta sala.`}
          </p>
          <Field label={dialog.kind === 'close' ? 'Motivo (lo verán los jugadores)' : 'Motivo (opcional, lo verá)'}>
            <textarea className="field min-h-[70px] text-[14px]" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </ActionDialog>
      )}
    </div>
  );
}
