import { useState } from 'react';
import { adminPost, usePolling } from '../api';
import { ActionDialog, Badge, Btn, Card, Empty, ErrorNote, Field, Pager } from '../ui';
import { PHASE_LABELS, fmtDate, fmtTime } from '../format';
import { useGame } from '../../context/GameContext';
import { Dropdown } from '../../components/Shared/Choice';

const REASON_LABELS = { insultos: 'Insultos', trampa: 'Trampa', spam: 'Spam', nombre: 'Nombre ofensivo', otro: 'Otro' };
const REPORT_STATUS = { open: 'Abierto', resolved: 'Resuelto', dismissed: 'Descartado' };
const MUTE_OPTIONS = [
  { value: '5', label: '5 minutos' },
  { value: '15', label: '15 minutos' },
  { value: '30', label: '30 minutos' },
  { value: '60', label: '1 hora' },
  { value: '1440', label: '1 día' },
  { value: '10080', label: '7 días' },
  { value: 'game', label: 'Hasta que termine la partida' },
];
const STATUS_OPTIONS = [
  { value: 'open', label: 'Abiertos' },
  { value: 'resolved', label: 'Resueltos' },
  { value: 'dismissed', label: 'Descartados' },
  { value: '', label: 'Todos' },
];
const REASON_OPTIONS = [{ value: '', label: 'Todos los motivos' }, ...Object.entries(REASON_LABELS).map(([value, label]) => ({ value, label }))];
const SUSPEND_OPTIONS = [
  { value: '1', label: '1 día' },
  { value: '3', label: '3 días' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
];

/**
 * Mute dialog body + request. target = { roomId?, targetId?, userId?, name }
 * (from a room: roomId + targetId; an account anywhere: userId).
 */
function MuteDialog({ target, onClose, onDone }) {
  const { addToast } = useGame();
  const [duration, setDuration] = useState('30');
  const [reason, setReason] = useState('');
  const options = target.roomId ? MUTE_OPTIONS : MUTE_OPTIONS.filter((o) => o.value !== 'game');
  const confirm = async () => {
    const body = { reason, ...(duration === 'game' ? { untilGameEnd: true } : { minutes: Number(duration) }) };
    if (target.roomId) Object.assign(body, { roomId: target.roomId, targetId: target.targetId });
    else body.userId = target.userId;
    const r = await adminPost('/moderation/mute', body);
    if (r.ok) {
      addToast(`${target.name} silenciado`, 'success');
      if (onDone) onDone();
    }
    return r;
  };
  return (
    <ActionDialog title={`Silenciar a ${target.name}`} confirmLabel="Silenciar" onConfirm={confirm} onClose={onClose}>
      <p className="text-[13px]">
        No podrá escribir en el chat. {target.roomId && !target.userId ? 'Es invitado: el silencio vale para este dispositivo mientras siga en el servidor.' : 'Se guarda en su cuenta.'}
      </p>
      <Field label="Duración">
        <Dropdown options={options} value={duration} onChange={setDuration} ariaLabel="Duración del silencio" />
      </Field>
      <Field label="Motivo (opcional, lo verá el jugador)">
        <input className="field !py-1.5 text-[14px]" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: insultos en el chat" />
      </Field>
    </ActionDialog>
  );
}

function RoomChat({ roomId, onBack }) {
  const { data, error, reload } = usePolling(`/moderation/rooms/${roomId}/chat`, 3000);
  const { addToast } = useGame();
  const [dialog, setDialog] = useState(null); // { kind: 'delete', msg } | { kind: 'mute', person }

  const deleteMsg = async () => {
    const r = await adminPost(`/moderation/rooms/${roomId}/chat/${dialog.msg.id}/delete`);
    if (r.ok) addToast('Mensaje borrado para todos', 'success');
    reload();
    return r;
  };
  const unmute = async (person) => {
    const r = await adminPost('/moderation/unmute', { key: person.muted.key });
    addToast(r.ok ? `${person.name} puede volver a escribir` : r.error, r.ok ? 'success' : 'error');
    reload();
  };

  return (
    <Card
      title={`Chat de la sala ${roomId}`}
      actions={<><Badge tone="leaf">En vivo</Badge><Btn onClick={onBack}>Volver a las salas</Btn></>}
    >
      <ErrorNote>{error}</ErrorNote>
      {data && (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <ol className="max-h-[420px] overflow-y-auto border border-ink/15 rounded-[2px] bg-paper-light/40 text-[13px]">
            {data.messages.length === 0 && <li><Empty>Todavía no hay mensajes.</Empty></li>}
            {data.messages.map((m) => (
              <li key={m.id} className="flex items-start gap-2 px-2 py-1.5 border-b border-dotted border-ink/20 last:border-b-0">
                <span className="text-[11px] text-ink-faint tabular-nums mt-px shrink-0">{fmtTime(m.timestamp)}</span>
                <span className="flex-1 min-w-0 break-words"><strong>{m.playerName}:</strong> {m.message}</span>
                <button
                  type="button"
                  className="shrink-0 text-[12px] font-bold text-shu-dark hover:underline cursor-pointer"
                  onClick={() => setDialog({ kind: 'delete', msg: m })}
                >
                  Borrar
                </button>
              </li>
            ))}
          </ol>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-ink-faint font-bold mb-1">En la sala ({PHASE_LABELS[data.phase] || data.phase})</p>
            <ul className="space-y-1">
              {data.people.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-1 text-[13px]">
                  <span className={`truncate ${p.left ? 'text-ink-faint line-through' : ''}`}>
                    {p.name}{p.spectator && <span className="text-ink-faint"> (esp.)</span>}{!p.accountId && <span className="text-ink-faint"> · invitado</span>}
                  </span>
                  {p.muted ? (
                    <Btn className="!min-h-[28px] !px-1.5 !text-[12px]" title={p.muted.roomId ? 'Hasta que termine la partida' : `Hasta ${fmtDate(p.muted.until)}`} onClick={() => unmute(p)}>Quitar silencio</Btn>
                  ) : (
                    <Btn className="!min-h-[28px] !px-1.5 !text-[12px]" onClick={() => setDialog({ kind: 'mute', person: p })}>Silenciar</Btn>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {dialog && dialog.kind === 'delete' && (
        <ActionDialog key="del" title="Borrar mensaje" confirmLabel="Borrar" onConfirm={deleteMsg} onClose={() => setDialog(null)}>
          <p className="text-[14px]">Se quita del historial y desaparece del chat de todos: <strong>{dialog.msg.playerName}</strong>: «{dialog.msg.message}»</p>
        </ActionDialog>
      )}
      {dialog && dialog.kind === 'mute' && (
        <MuteDialog
          target={{ roomId, targetId: dialog.person.id, userId: dialog.person.accountId, name: dialog.person.name }}
          onClose={() => setDialog(null)}
          onDone={reload}
        />
      )}
    </Card>
  );
}

function WordsCard({ words, wordsMax, reload }) {
  const { addToast } = useGame();
  const [draft, setDraft] = useState(null); // edited list (null = untouched)
  const [input, setInput] = useState('');
  const [dialog, setDialog] = useState(null); // 'save' | 'reset'
  const list = draft || words.words;
  const add = () => {
    const parts = input.split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return;
    setDraft([...new Set([...list, ...parts])]);
    setInput('');
  };
  const confirm = async () => {
    const r = dialog === 'reset' ? await adminPost('/moderation/words', { reset: true }) : await adminPost('/moderation/words', { words: list });
    if (r.ok) {
      addToast('Lista de palabras guardada', 'success');
      setDraft(null);
      reload();
    }
    return r;
  };
  return (
    <Card title="Palabras prohibidas" actions={<Badge tone={words.isDefault ? 'ink' : 'chakra'}>{words.isDefault ? 'Lista por defecto' : 'Personalizada'}</Badge>}>
      <p className="text-[13px] text-ink-soft mb-2">
        Se reemplazan por *** en el chat y en los nombres. No distingue mayúsculas ni tildes y entiende leetspeak simple (m1erd4).
      </p>
      <div className="flex flex-wrap gap-1 mb-2">
        {list.map((w) => (
          <span key={w} className="inline-flex items-center gap-1 pl-1.5 pr-0.5 py-px rounded-[2px] border border-ink/25 text-[12px] bg-paper-light/60">
            {w}
            <button type="button" className="px-1 text-shu-dark font-bold cursor-pointer" aria-label={`Quitar ${w}`} onClick={() => setDraft(list.filter((x) => x !== w))}>×</button>
          </span>
        ))}
        {list.length === 0 && <Empty>La lista está vacía: no se filtra nada.</Empty>}
      </div>
      <form className="flex gap-2 mb-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input className="field !py-1.5 text-[14px] flex-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Agregar palabra (o varias separadas por coma)" maxLength={200} />
        <Btn type="submit">Agregar</Btn>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="primary" disabled={!draft} onClick={() => setDialog('save')}>Guardar cambios</Btn>
        {draft && <Btn onClick={() => setDraft(null)}>Descartar</Btn>}
        {!words.isDefault && <Btn onClick={() => setDialog('reset')}>Volver a la lista por defecto</Btn>}
        <span className="text-[12px] text-ink-faint ml-auto">{list.length}/{wordsMax}</span>
      </div>
      {dialog && (
        <ActionDialog key={dialog} title={dialog === 'reset' ? 'Lista por defecto' : 'Guardar palabras'} confirmLabel="Guardar" onConfirm={confirm} onClose={() => setDialog(null)}>
          <p className="text-[14px]">{dialog === 'reset' ? `Se vuelve a la lista por defecto (${words.defaults.length} palabras).` : `Se aplicará al momento a ${list.length} palabra(s).`}</p>
        </ActionDialog>
      )}
    </Card>
  );
}

function ReportRow({ r, onOpenUser, onAction }) {
  return (
    <li className="py-2.5 border-t border-ink/15 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <Badge tone={r.status === 'open' ? 'shu' : r.status === 'resolved' ? 'leaf' : 'ink'}>{REPORT_STATUS[r.status]}</Badge>
        <Badge tone="chakra">{REASON_LABELS[r.reason] || r.reason}</Badge>
        <span className="text-ink-faint">#{r.id} · {fmtDate(r.createdAt)} · sala {r.roomId}</span>
      </div>
      <p className="mt-1 text-[14px]">
        <strong>{r.reporterName}</strong> reportó a <strong>{r.targetName}</strong>
        {r.targetUserId ? (
          <> (<button type="button" className="text-chakra-dark font-bold hover:underline cursor-pointer" onClick={() => onOpenUser(r.targetUserId)}>ver cuenta{r.targetDisplayName && r.targetDisplayName !== r.targetName ? `: ${r.targetDisplayName}` : ''}</button>)</>
        ) : <span className="text-ink-faint"> (invitado)</span>}
        {r.targetReports > 1 && <span className="text-shu-dark text-[12px] font-bold"> · {r.targetReports} reportes en total</span>}
      </p>
      {r.details && <p className="text-[13px] text-ink-soft mt-0.5">«{r.details}»</p>}
      {r.chatExcerpt.length > 0 && (
        <details className="mt-1">
          <summary className="text-[12px] font-bold text-ink-soft cursor-pointer">Chat de la sala ({r.chatExcerpt.length} mensajes)</summary>
          <ol className="mt-1 text-[12px] border-l-2 border-ink/20 pl-2 space-y-0.5">
            {r.chatExcerpt.map((m) => (
              <li key={m.id} className={m.reported ? 'bg-shu/10 font-semibold' : m.playerId === r.targetPlayerId ? 'text-ink' : 'text-ink-faint'}>
                <span className="tabular-nums">{fmtTime(m.timestamp)}</span> <strong>{m.playerName}:</strong> {m.message}
              </li>
            ))}
          </ol>
        </details>
      )}
      {r.status !== 'open' && (
        <p className="text-[12px] text-ink-faint mt-1">
          {REPORT_STATUS[r.status]} por {r.resolvedByName || 'un admin'} el {fmtDate(r.resolvedAt)}{r.notes ? ` — ${r.notes}` : ''}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {r.status === 'open' ? (
          <>
            <Btn variant="leaf" onClick={() => onAction('resolve', r)}>Resolver</Btn>
            <Btn onClick={() => onAction('dismiss', r)}>Descartar</Btn>
          </>
        ) : (
          <Btn onClick={() => onAction('reopen', r)}>Reabrir</Btn>
        )}
        {(r.inRoom || r.targetUserId) && <Btn onClick={() => onAction('mute', r)}>Silenciar</Btn>}
        {r.inRoom && <Btn onClick={() => onAction('kick', r)}>Expulsar de la sala</Btn>}
        {r.targetUserId && r.targetStatus === 'active' && <Btn onClick={() => onAction('suspend', r)}>Suspender</Btn>}
      </div>
    </li>
  );
}

function ReportsCard({ onOpenUser }) {
  const { addToast } = useGame();
  const [status, setStatus] = useState('open');
  const [reason, setReason] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // { kind, r }
  const [form, setForm] = useState({ notes: '', days: '3' });
  const params = new URLSearchParams({ status, reason, page: String(page) }).toString();
  const { data, error, reload } = usePolling(`/reports?${params}`, 15000);

  const open = (kind, r) => {
    setForm({ notes: '', days: '3' });
    setDialog({ kind, r });
  };
  const confirm = async () => {
    const { kind, r } = dialog;
    let res;
    if (kind === 'resolve' || kind === 'dismiss' || kind === 'reopen') {
      res = await adminPost(`/reports/${r.id}/status`, { status: { resolve: 'resolved', dismiss: 'dismissed', reopen: 'open' }[kind], notes: form.notes });
      if (res.ok) addToast(kind === 'resolve' ? 'Reporte resuelto' : kind === 'dismiss' ? 'Reporte descartado' : 'Reporte reabierto', 'success');
    } else if (kind === 'kick') {
      res = await adminPost(`/live/rooms/${r.roomId}/kick`, { targetId: r.targetPlayerId, reason: form.notes });
      if (res.ok) addToast(`${r.targetName} expulsado de la sala`, 'success');
    } else if (kind === 'suspend') {
      const until = new Date(Date.now() + Number(form.days) * 86_400_000).toISOString();
      res = await adminPost(`/users/${r.targetUserId}/status`, { action: 'suspend', until, reason: form.notes });
      if (res.ok) addToast('Cuenta suspendida', 'success');
    }
    reload();
    return res;
  };

  const counts = data ? data.counts : {};
  return (
    <Card
      title="Reportes"
      actions={<Badge tone={counts.open ? 'shu' : 'leaf'}>{counts.open || 0} abiertos</Badge>}
    >
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <Dropdown options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} ariaLabel="Estado" className="sm:w-44" />
        <Dropdown options={REASON_OPTIONS} value={reason} onChange={(v) => { setReason(v); setPage(1); }} ariaLabel="Motivo" className="sm:w-48" />
      </div>
      <ErrorNote>{error}</ErrorNote>
      {data && data.reports.length === 0 ? <Empty>No hay reportes con esos filtros.</Empty> : (
        <ul>{(data ? data.reports : []).map((r) => <ReportRow key={r.id} r={r} onOpenUser={onOpenUser} onAction={open} />)}</ul>
      )}
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}

      {dialog && dialog.kind === 'mute' && (
        <MuteDialog
          target={dialog.r.inRoom
            ? { roomId: dialog.r.roomId, targetId: dialog.r.targetPlayerId, userId: dialog.r.targetUserId, name: dialog.r.targetName }
            : { userId: dialog.r.targetUserId, name: dialog.r.targetName }}
          onClose={() => setDialog(null)}
          onDone={reload}
        />
      )}
      {dialog && dialog.kind !== 'mute' && (
        <ActionDialog
          key={dialog.kind}
          title={{ resolve: 'Resolver reporte', dismiss: 'Descartar reporte', reopen: 'Reabrir reporte', kick: `Expulsar a ${dialog.r.targetName}`, suspend: `Suspender a ${dialog.r.targetName}` }[dialog.kind]}
          confirmLabel={{ resolve: 'Resolver', dismiss: 'Descartar', reopen: 'Reabrir', kick: 'Expulsar', suspend: 'Suspender' }[dialog.kind]}
          onConfirm={confirm}
          onClose={() => setDialog(null)}
        >
          {dialog.kind === 'kick' && <p className="text-[13px]">Sale de la sala {dialog.r.roomId} y no puede volver a entrar.</p>}
          {dialog.kind === 'suspend' && (
            <Field label="Duración">
              <Dropdown options={SUSPEND_OPTIONS} value={form.days} onChange={(v) => setForm((f) => ({ ...f, days: v }))} ariaLabel="Duración de la suspensión" />
            </Field>
          )}
          <Field label={dialog.kind === 'dismiss' || dialog.kind === 'suspend' ? 'Motivo / nota (obligatorio)' : 'Nota (opcional)'}>
            <input className="field !py-1.5 text-[14px]" maxLength={300} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Field>
        </ActionDialog>
      )}
    </Card>
  );
}

export function ModerationTab({ onOpenUser }) {
  const { data, error, reload } = usePolling('/moderation', 5000);
  const { addToast } = useGame();
  const [room, setRoom] = useState(null);

  const unmute = async (m) => {
    const r = await adminPost('/moderation/unmute', { key: m.key });
    addToast(r.ok ? `${m.name || 'Jugador'} puede volver a escribir` : r.error, r.ok ? 'success' : 'error');
    reload();
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        {room ? (
          <RoomChat key={room} roomId={room} onBack={() => setRoom(null)} />
        ) : (
          <Card title="Chat en vivo">
            <ErrorNote>{error}</ErrorNote>
            {data && data.rooms.length === 0 && <Empty>No hay salas abiertas.</Empty>}
            <ul>
              {(data ? data.rooms : []).map((r) => (
                <li key={r.roomId} className="flex items-center justify-between gap-2 py-1.5 border-t border-ink/10 first:border-t-0 text-[13px]">
                  <span className="min-w-0">
                    <strong className="font-mono">{r.roomId}</strong> <Badge>{PHASE_LABELS[r.phase] || r.phase}</Badge>
                    <span className="block text-ink-faint truncate">{r.players.join(', ') || 'sin jugadores'}{r.spectators ? ` · ${r.spectators} esp.` : ''}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-ink-faint tabular-nums">{r.messages} msj{r.lastAt ? ` · ${fmtTime(r.lastAt)}` : ''}</span>
                    <Btn onClick={() => setRoom(r.roomId)}>Ver chat</Btn>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title="Silenciados">
          {data && data.mutes.length === 0 && <Empty>Nadie está silenciado.</Empty>}
          <ul>
            {(data ? data.mutes : []).map((m) => (
              <li key={m.key} className="flex items-center justify-between gap-2 py-1.5 border-t border-ink/10 first:border-t-0 text-[13px]">
                <span className="min-w-0">
                  <strong>{m.name || m.playerId}</strong> {m.userId ? <Badge tone="chakra">Cuenta</Badge> : <Badge>Invitado</Badge>}
                  <span className="block text-ink-faint">{m.roomId ? `Hasta que termine la partida ${m.roomId}` : `Hasta ${fmtDate(m.until)}`}{m.reason ? ` · ${m.reason}` : ''}</span>
                </span>
                <Btn onClick={() => unmute(m)}>Quitar</Btn>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <ReportsCard onOpenUser={onOpenUser} />
        {data && <WordsCard words={data.words} wordsMax={data.wordsMax} reload={reload} />}
      </div>
    </div>
  );
}
