import { useState } from 'react';
import { adminPost, usePolling } from '../api';
import { ActionDialog, Badge, Btn, Card, Empty, ErrorNote, Field } from '../ui';
import { fmtDate } from '../format';
import { useGame } from '../../context/GameContext';
import { SegmentedControl } from '../../components/Shared/Choice';
import { Avatar } from '../../components/Shared/Avatar';

const PERIODS = [
  { value: 'week', label: 'Esta semana' },
  { value: 'all', label: 'Siempre' },
];

function UserResults({ player, onAction, onOpenUser }) {
  const { data, error } = usePolling(`/ranking/users/${player.userId}`, 0);
  const results = data ? data.results : [];
  const anyIncluded = results.some((r) => !r.excluded);
  const anyExcluded = results.some((r) => r.excluded);
  return (
    <Card
      title={player.displayName}
      actions={<Btn onClick={() => onOpenUser(player.userId)}>Ver cuenta</Btn>}
    >
      <ErrorNote>{error}</ErrorNote>
      <div className="flex flex-wrap gap-2 mb-2">
        {anyIncluded && <Btn variant="primary" onClick={() => onAction({ kind: 'exclude', scope: 'user', id: player.userId, label: `todas las partidas de ${player.displayName}` })}>Excluir todas sus partidas</Btn>}
        {anyExcluded && <Btn variant="leaf" onClick={() => onAction({ kind: 'restore', scope: 'user', id: player.userId, label: `todas las partidas de ${player.displayName}` })}>Restaurar todas</Btn>}
      </div>
      {data && results.length === 0 && <Empty>Sin partidas registradas.</Empty>}
      <ul className="text-[13px]">
        {results.map((r) => (
          <li key={r.gameId} className="flex items-center justify-between gap-2 py-1.5 border-t border-ink/10 first:border-t-0">
            <span className="min-w-0">
              {r.won ? <Badge tone="leaf">Ganó</Badge> : <Badge>Jugó</Badge>} {r.vp} PV · {r.players} ninjas · sala {r.roomId}
              <span className="block text-[12px] text-ink-faint">{fmtDate(r.playedAt)}{r.excluded ? ` · excluida: ${r.excludedReason || ''}` : ''}</span>
            </span>
            {r.excluded ? (
              <Btn onClick={() => onAction({ kind: 'restore', scope: 'game', id: r.gameId, label: `la partida de la sala ${r.roomId}` })}>Restaurar</Btn>
            ) : (
              <Btn onClick={() => onAction({ kind: 'exclude', scope: 'game', id: r.gameId, label: `la partida de la sala ${r.roomId} (para todos sus jugadores)` })}>Excluir</Btn>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RankingTab({ onOpenUser }) {
  const { addToast } = useGame();
  const [period, setPeriod] = useState('week');
  const { data, error, reload } = usePolling(`/ranking?period=${period}`, 30000);
  const [player, setPlayer] = useState(null);
  const [dialog, setDialog] = useState(null); // { kind: 'exclude'|'restore'|'reset'|'undo', scope, id, label }
  const [reason, setReason] = useState('');
  const [version, setVersion] = useState(0);

  const open = (d) => {
    setReason('');
    setDialog(d);
  };
  const confirm = async () => {
    let r;
    if (dialog.kind === 'exclude') r = await adminPost('/ranking/exclude', { scope: dialog.scope, id: dialog.id, reason });
    else if (dialog.kind === 'restore') r = await adminPost('/ranking/restore', { scope: dialog.scope, id: dialog.id });
    else if (dialog.kind === 'reset') r = await adminPost('/ranking/week/reset', { reason });
    else r = await adminPost('/ranking/week/undo');
    if (r.ok) {
      addToast({ exclude: 'Excluido del ranking', restore: 'Vuelve a contar en el ranking', reset: 'Ranking semanal reiniciado', undo: 'Reinicio deshecho' }[dialog.kind], 'success');
      setVersion((v) => v + 1);
    }
    reload();
    return r;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="grid gap-6">
        <Card title="Ranking" actions={<SegmentedControl options={PERIODS} value={period} onChange={(v) => { setPeriod(v); setPlayer(null); }} ariaLabel="Periodo" />}>
          <p className="text-[13px] text-ink-soft mb-2">Igual que el que ven los jugadores: más victorias; empate, menos partidas. No cuenta lo excluido.</p>
          <ErrorNote>{error}</ErrorNote>
          {data && data.rows.length === 0 && <Empty>Nadie ganó todavía en este periodo.</Empty>}
          <ol>
            {(data ? data.rows : []).map((r) => (
              <li key={r.userId}>
                <button
                  type="button"
                  onClick={() => setPlayer(r)}
                  className={`w-full flex items-center gap-2 py-1.5 px-1 text-left text-[13px] border-t border-ink/10 hover:bg-chakra/10 cursor-pointer ${player && player.userId === r.userId ? 'bg-chakra/15' : ''}`}
                >
                  <span className="w-6 text-right tabular-nums font-bold">{r.rank}</span>
                  <Avatar id={r.avatarId} size={22} />
                  <span className="flex-1 min-w-0 truncate font-bold">{r.displayName}</span>
                  <span className="tabular-nums">{r.wins} vict. · {r.games} part.</span>
                </button>
              </li>
            ))}
          </ol>
        </Card>
        <Card title="Reiniciar ranking semanal">
          <p className="text-[13px] text-ink-soft mb-2">
            El ranking semanal empieza cada lunes a las 00:00 (Argentina). Reiniciarlo hace que solo cuenten las partidas desde ahora hasta el próximo lunes. No borra nada ni toca el ranking de siempre, y se puede deshacer.
          </p>
          {data && data.weekResetAt && <p className="text-[13px] font-bold mb-2">Reiniciado el {fmtDate(data.weekResetAt)}.</p>}
          <div className="flex flex-wrap gap-2">
            <Btn variant="primary" onClick={() => open({ kind: 'reset' })}>Reiniciar ranking semanal</Btn>
            {data && data.weekResetAt && <Btn onClick={() => open({ kind: 'undo' })}>Deshacer reinicio</Btn>}
          </div>
        </Card>
      </div>
      <div className="grid gap-6">
        {player ? (
          <UserResults key={`${player.userId}-${version}`} player={player} onAction={open} onOpenUser={onOpenUser} />
        ) : (
          <Card title="Partidas de un jugador"><Empty>Elige a alguien del ranking para ver y excluir sus partidas.</Empty></Card>
        )}
        <Card title="Excluido del ranking">
          {data && data.excluded.length === 0 && <Empty>No hay partidas excluidas.</Empty>}
          <ul className="text-[13px]">
            {(data ? data.excluded : []).map((g) => (
              <li key={g.gameId} className="flex items-center justify-between gap-2 py-1.5 border-t border-ink/10 first:border-t-0">
                <span className="min-w-0">
                  Sala {g.roomId} · {fmtDate(g.playedAt)}
                  <span className="block text-[12px] text-ink-faint truncate">{(g.players || []).map((p) => `${p.name}${p.won ? ' (ganó)' : ''}`).join(', ')}</span>
                  {g.reason && <span className="block text-[12px] text-ink-soft">Motivo: {g.reason}</span>}
                </span>
                <Btn onClick={() => open({ kind: 'restore', scope: 'game', id: g.gameId, label: `la partida de la sala ${g.roomId}` })}>Restaurar</Btn>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {dialog && (
        <ActionDialog
          key={dialog.kind + (dialog.id || '')}
          title={{ exclude: 'Excluir del ranking', restore: 'Restaurar en el ranking', reset: 'Reiniciar ranking semanal', undo: 'Deshacer reinicio' }[dialog.kind]}
          confirmLabel={{ exclude: 'Excluir', restore: 'Restaurar', reset: 'Reiniciar', undo: 'Deshacer' }[dialog.kind]}
          onConfirm={confirm}
          onClose={() => setDialog(null)}
        >
          {dialog.kind === 'exclude' && <p className="text-[14px]">Deja de contar {dialog.label} en los rankings (semanal y de siempre). Los Ryō cobrados no cambian.</p>}
          {dialog.kind === 'restore' && <p className="text-[14px]">Vuelve a contar {dialog.label}.</p>}
          {dialog.kind === 'undo' && <p className="text-[14px]">El ranking semanal vuelve a contar desde el lunes.</p>}
          {(dialog.kind === 'exclude' || dialog.kind === 'reset') && (
            <Field label="Motivo">
              <input className="field !py-1.5 text-[14px]" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={dialog.kind === 'reset' ? 'Ej.: nueva temporada' : 'Ej.: partida arreglada entre cuentas'} />
            </Field>
          )}
        </ActionDialog>
      )}
    </div>
  );
}
