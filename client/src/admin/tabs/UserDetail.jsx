import { useState } from 'react';
import { adminPost, usePolling } from '../api';
import { ActionDialog, Badge, Btn, Card, Empty, ErrorNote, Field, Stat, StatusBadge } from '../ui';
import { ACTION_LABELS, BOARD_LABELS, ROLE_LABELS, fmtDate, fmtDuration, fmtNum, liveStatus } from '../format';
import { useGame } from '../../context/GameContext';
import { Avatar } from '../../components/Shared/Avatar';
import { Dropdown, SegmentedControl } from '../../components/Shared/Choice';
import { DateTimePicker } from '../../components/Shared/DateTimePicker';

const DAY = 24 * 60 * 60 * 1000;
const SUSPEND_PRESETS = [
  { value: '1', label: '1 día' },
  { value: '3', label: '3 días' },
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
];

// Local "YYYY-MM-DDTHH:MM" value of DateTimePicker
function localInputValue(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function describeDetails(details) {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}

export function UserDetail({ userId, admin, onChanged, onClose }) {
  const { data, error, reload } = usePolling(`/users/${userId}`, 0);
  const { data: catalog } = usePolling('/catalog', 0);
  const { addToast } = useGame();
  const [dialog, setDialog] = useState(null); // 'coins' | 'gift' | 'suspend' | 'ban' | 'lift' | 'rename' | 'role'
  const [form, setForm] = useState({});
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const user = data && data.user;
  const open = (kind) => {
    const base = { reason: '' };
    if (kind === 'coins') Object.assign(base, { sign: '+', amount: '' });
    if (kind === 'gift') Object.assign(base, { itemId: '' });
    if (kind === 'suspend') Object.assign(base, { preset: '3', until: localInputValue(Date.now() + 3 * DAY) });
    if (kind === 'rename') Object.assign(base, { displayName: user.displayName });
    setForm(base);
    setDialog(kind);
  };

  const done = (r, message) => {
    if (r.ok) {
      addToast(message, 'success');
      reload();
      onChanged();
    }
    return r;
  };

  const confirm = async () => {
    const base = `/users/${userId}`;
    switch (dialog) {
      case 'coins': {
        const n = Number.parseInt(form.amount, 10);
        if (!Number.isInteger(n) || n <= 0) return { ok: false, error: 'Escribe una cantidad mayor que 0' };
        const delta = form.sign === '-' ? -n : n;
        const r = await adminPost(`${base}/coins`, { delta, reason: form.reason });
        return done(r, `Saldo actualizado: ${r.ok ? fmtNum(r.data.coins) : ''} Ryō`);
      }
      case 'gift': {
        if (!form.itemId) return { ok: false, error: 'Elige un objeto' };
        const r = await adminPost(`${base}/gift`, { itemId: form.itemId, reason: form.reason });
        return done(r, `Regalado: ${r.ok ? r.data.name : ''}`);
      }
      case 'suspend': {
        const t = new Date(form.until).getTime();
        if (!Number.isFinite(t)) return { ok: false, error: 'Elige una fecha válida' };
        return done(await adminPost(`${base}/status`, { action: 'suspend', until: new Date(t).toISOString(), reason: form.reason }), 'Cuenta suspendida');
      }
      case 'ban':
        return done(await adminPost(`${base}/status`, { action: 'ban', reason: form.reason }), 'Cuenta bloqueada');
      case 'lift':
        return done(await adminPost(`${base}/status`, { action: 'lift', reason: form.reason }), 'Sanción levantada');
      case 'rename':
        return done(await adminPost(`${base}/rename`, { displayName: form.displayName, reason: form.reason }), 'Nombre cambiado');
      case 'role': {
        const role = user.role === 'admin' ? 'player' : 'admin';
        return done(await adminPost(`${base}/role`, { role }), role === 'admin' ? 'Ahora es admin' : 'Ya no es admin');
      }
      default:
        return { ok: true };
    }
  };

  if (!user) {
    return (
      <Card title="Detalle" actions={<Btn onClick={onClose}>Cerrar</Btn>}>
        {error ? <ErrorNote>{error}</ErrorNote> : <p className="text-ink-faint text-[13px]">Cargando…</p>}
      </Card>
    );
  }

  const status = liveStatus(user);
  const isSelf = admin && admin.id === user.id;
  const owned = new Set(user.items.map((i) => i.itemId));
  const giftOptions = [{ value: '', label: 'Elige un objeto…' }, ...((catalog && catalog.items) || [])
    .filter((i) => !owned.has(i.id))
    .map((i) => ({ value: i.id, label: `${i.name} (${i.slot === 'board' ? 'tablero' : 'piezas'}, ${i.price} Ryō)` }))];

  const titles = {
    coins: 'Ajustar Ryō',
    gift: 'Regalar un objeto',
    suspend: `Suspender a ${user.displayName}`,
    ban: `Bloquear a ${user.displayName}`,
    lift: 'Levantar la sanción',
    rename: 'Cambiar el nombre',
    role: user.role === 'admin' ? 'Quitar el rol de admin' : 'Dar rol de admin',
  };

  return (
    <Card
      title={user.displayName}
      actions={<Btn onClick={onClose}>Cerrar</Btn>}
    >
      <div className="flex items-start gap-3">
        <Avatar id={user.avatarId} size={56} />
        <div className="min-w-0 text-[13px] space-y-0.5">
          <p className="break-all"><span className="text-ink-faint">Correo:</span> {user.email}</p>
          <p className="break-all text-[12px] text-ink-faint">id {user.id}</p>
          <p><span className="text-ink-faint">Alta:</span> {fmtDate(user.createdAt)} · {user.authProvider === 'google' ? 'Google' : 'correo y contraseña'}</p>
          <p className="flex flex-wrap items-center gap-1.5">
            <Badge tone={user.role === 'admin' ? 'chakra' : 'ink'}>{ROLE_LABELS[user.role] || user.role}</Badge>
            <StatusBadge user={user} />
            {status === 'suspended' && <span className="text-[12px]">hasta {fmtDate(user.suspendedUntil)}</span>}
          </p>
          {status !== 'active' && user.banReason && <p className="text-[12px] text-shu-dark">Motivo: {user.banReason}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <Stat label="Ryō" value={fmtNum(user.coins)} />
        <Stat label="Partidas" value={fmtNum(user.gamesPlayed)} />
        <Stat label="Victorias" value={fmtNum(user.gamesWon)} />
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <Btn onClick={() => open('coins')}>Ajustar Ryō</Btn>
        <Btn onClick={() => open('gift')}>Regalar objeto</Btn>
        <Btn onClick={() => open('rename')}>Cambiar nombre</Btn>
        {status === 'active' && !isSelf && user.role !== 'admin' && <Btn onClick={() => open('suspend')}>Suspender</Btn>}
        {status !== 'banned' && !isSelf && user.role !== 'admin' && <Btn variant="primary" onClick={() => open('ban')}>Bloquear</Btn>}
        {(status !== 'active' || user.status !== 'active') && !isSelf && <Btn variant="leaf" onClick={() => open('lift')}>Levantar sanción</Btn>}
        {!isSelf && status === 'active' && <Btn onClick={() => open('role')}>{user.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}</Btn>}
      </div>

      {user.liveSeats.length > 0 && (
        <p className="mt-3 text-[13px] text-leaf font-bold">Jugando ahora en: {user.liveSeats.map((s) => s.roomId).join(', ')}</p>
      )}

      <h3 className="mt-4 font-display text-[16px]">Objetos</h3>
      <p className="text-[13px] text-ink-soft">
        Equipado: piezas <strong>{user.equipped.pieces}</strong> · tablero <strong>{user.equipped.board}</strong>
      </p>
      {user.items.length ? (
        <ul className="mt-1 flex flex-wrap gap-1">
          {user.items.map((i) => <li key={i.itemId}><Badge tone="steel" title={`Desde ${fmtDate(i.acquiredAt)}`}>{i.name}</Badge></li>)}
        </ul>
      ) : <p className="text-[13px] text-ink-faint">Solo los objetos gratuitos.</p>}

      <h3 className="mt-4 font-display text-[16px]">Partidas recientes</h3>
      {user.results.length ? (
        <div className="overflow-x-auto">
          <table className="admin-table w-full text-[12px] min-w-[420px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="py-1 pr-2">Fecha</th><th className="pr-2">Sala</th><th className="pr-2">Resultado</th><th className="pr-2 text-right">PV</th><th className="pr-2 text-right">Ryō</th><th>Duración</th>
              </tr>
            </thead>
            <tbody>
              {user.results.map((r) => (
                <tr key={r.gameId} className="border-t border-ink/10">
                  <td className="py-1 pr-2 whitespace-nowrap">{fmtDate(r.playedAt)}</td>
                  <td className="pr-2 font-mono">{r.roomId}</td>
                  <td className="pr-2">{r.won ? 'Victoria' : 'Derrota'}{r.endedBy === 'vote' ? ' (votación)' : ''} · {r.players} j. {r.boardType ? `· ${BOARD_LABELS[r.boardType]}` : ''}</td>
                  <td className="pr-2 text-right tabular-nums">{r.vp}</td>
                  <td className="pr-2 text-right tabular-nums">+{r.coins}</td>
                  <td className="whitespace-nowrap">{fmtDuration(r.durationS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>Todavía no terminó partidas con cuenta.</Empty>}

      <h3 className="mt-4 font-display text-[16px]">Historial de moderación</h3>
      {user.history.length ? (
        <ul className="text-[12px] space-y-1">
          {user.history.map((h) => (
            <li key={h.id} className="border-t border-ink/10 pt-1">
              <strong>{ACTION_LABELS[h.action] || h.action}</strong> · {fmtDate(h.at)} · por {h.adminName || '—'}
              <span className="block text-ink-faint break-words">{describeDetails(h.details)}</span>
            </li>
          ))}
        </ul>
      ) : <Empty>Sin acciones de moderación.</Empty>}

      {dialog && (
        <ActionDialog key={dialog} title={titles[dialog]} confirmLabel="Confirmar" onConfirm={confirm} onClose={() => setDialog(null)}>
          {dialog === 'coins' && (
            <>
              <p className="text-[13px] text-ink-soft">Saldo actual: <strong>{fmtNum(user.coins)} Ryō</strong>. Nunca puede quedar en negativo.</p>
              <div className="flex gap-2 items-end">
                <SegmentedControl
                  options={[{ value: '+', label: 'Sumar' }, { value: '-', label: 'Restar' }]}
                  value={form.sign}
                  onChange={(v) => set({ sign: v })}
                  ariaLabel="Sumar o restar"
                />
                <input className="field !py-1.5 text-[14px] w-28" inputMode="numeric" placeholder="Cantidad" value={form.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d]/g, '').slice(0, 7) })} aria-label="Cantidad" />
              </div>
            </>
          )}
          {dialog === 'gift' && (
            <Field label="Objeto del catálogo">
              <Dropdown options={giftOptions} value={form.itemId} onChange={(v) => set({ itemId: v })} ariaLabel="Objeto" />
            </Field>
          )}
          {dialog === 'suspend' && (
            <>
              <p className="text-[13px] text-ink-soft">No podrá jugar con su cuenta hasta esa fecha (sí como invitado). Si está en una partida, sale de ella ahora.</p>
              <SegmentedControl
                options={SUSPEND_PRESETS}
                value={form.preset}
                onChange={(v) => set({ preset: v, until: localInputValue(Date.now() + Number(v) * DAY) })}
                ariaLabel="Duración"
              />
              <Field label="Hasta">
                <DateTimePicker value={form.until} onChange={(v) => set({ until: v, preset: '' })} ariaLabel="Suspendida hasta" />
              </Field>
            </>
          )}
          {dialog === 'ban' && (
            <p className="text-[13px] text-ink-soft">Bloqueo permanente: no podrá volver a jugar con esta cuenta hasta que se levante. Si está en una partida, sale de ella ahora.</p>
          )}
          {dialog === 'rename' && (
            <Field label="Nuevo nombre (1 a 20 caracteres)">
              <input className="field !py-1.5 text-[14px]" maxLength={20} value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} />
            </Field>
          )}
          {dialog === 'role' && (
            <p className="text-[13px] text-ink-soft">
              {user.role === 'admin'
                ? 'Perderá el acceso al panel al instante. No se puede quitar al último admin.'
                : 'Tendrá acceso completo a este panel. Concédelo solo a personas de confianza.'}
            </p>
          )}
          {dialog !== 'role' && (
            <Field label={['coins', 'suspend', 'ban'].includes(dialog) ? 'Motivo (obligatorio)' : 'Motivo (opcional)'}>
              <textarea className="field min-h-[60px] text-[14px]" maxLength={300} value={form.reason} onChange={(e) => set({ reason: e.target.value })} />
            </Field>
          )}
        </ActionDialog>
      )}
    </Card>
  );
}
