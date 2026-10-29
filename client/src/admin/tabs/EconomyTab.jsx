import { useState } from 'react';
import { Toggle } from '../../components/Shared/Toggle';
import { DateTimePicker } from '../../components/Shared/DateTimePicker';
import { adminPost, usePolling } from '../api';
import { ActionDialog, Badge, Bars, Btn, Card, Empty, ErrorNote, Field, Stat } from '../ui';
import { fmtDate, fmtNum } from '../format';
import { useGame } from '../../context/GameContext';
import { Avatar } from '../../components/Shared/Avatar';

const RULE_LABELS = {
  finish: 'Por terminar la partida',
  win: 'Extra por ganar',
  perVp: 'Por cada punto de victoria',
  minVoteMinutes: 'Minutos mínimos (partidas terminadas por votación)',
};

// Local "YYYY-MM-DDTHH:MM" value of DateTimePicker
function localValue(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ItemDialog({ item, onClose, onDone }) {
  const { addToast } = useGame();
  const ov = item.override;
  const [form, setForm] = useState(() => {
    const now = Date.now();
    return {
    price: ov && ov.price ? String(ov.price) : '',
    enabled: ov ? ov.enabled !== false : true,
    sale: !!(ov && ov.salePercent),
    percent: ov && ov.salePercent ? String(ov.salePercent) : '20',
    startsAt: localValue(ov && ov.saleStarts ? ov.saleStarts : now),
    endsAt: localValue(ov && ov.saleEnds ? ov.saleEnds : now + 3 * 86_400_000),
    };
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const list = Number(form.price) || item.price;
  const preview = form.sale && Number(form.percent) ? Math.max(1, Math.round((list * (100 - Number(form.percent))) / 100)) : list;
  const confirm = async () => {
    const body = {
      price: form.price.trim() ? Number(form.price) : null,
      enabled: form.enabled,
      sale: form.sale ? { percent: Number(form.percent), startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() } : null,
    };
    const r = await adminPost(`/economy/items/${item.id}`, body);
    if (r.ok) {
      addToast(`${item.name} actualizado`, 'success');
      onDone();
    }
    return r;
  };
  return (
    <ActionDialog title={item.name} confirmLabel="Guardar" onConfirm={confirm} onClose={onClose}>
      <Field label={`Precio (catálogo: ${item.price} Ryō)`} hint="Vacío = el precio del catálogo">
        <input className="field !py-1.5 text-[14px]" inputMode="numeric" value={form.price} onChange={(e) => set({ price: e.target.value.replace(/\D/g, '') })} placeholder={String(item.price)} />
      </Field>
      <Toggle
        className="mb-2 !flex"
        checked={form.enabled}
        onChange={(v) => set({ enabled: v })}
        label="A la venta"
        hint="Si lo quitas, quien ya lo tiene lo conserva"
      />
      <Toggle className="mb-2 !flex" checked={form.sale} onChange={(v) => set({ sale: v })} label="Oferta temporal" />
      {form.sale && (
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2">
          <Field label="% desc.">
            <input className="field !py-1.5 text-[14px]" inputMode="numeric" value={form.percent} onChange={(e) => set({ percent: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
          </Field>
          <Field label="Desde">
            <DateTimePicker value={form.startsAt} onChange={(v) => set({ startsAt: v })} ariaLabel="Inicio de la oferta" />
          </Field>
          <span />
          <Field label="Hasta">
            <DateTimePicker value={form.endsAt} onChange={(v) => set({ endsAt: v })} ariaLabel="Fin de la oferta" />
          </Field>
        </div>
      )}
      <p className="text-[13px]">Los jugadores verán: {form.enabled ? (preview !== list ? <><s>{list}</s> <strong className="text-shu">{preview} Ryō</strong> (durante la oferta)</> : <strong>{list} Ryō</strong>) : <strong>no está a la venta</strong>}</p>
    </ActionDialog>
  );
}

function RewardsCard({ rewards, onDone }) {
  const { addToast } = useGame();
  const [form, setForm] = useState(null);
  const [dialog, setDialog] = useState(null); // 'save' | 'reset'
  const values = form || Object.fromEntries(Object.keys(RULE_LABELS).map((k) => [k, String(rewards.current[k])]));
  const changed = Object.keys(RULE_LABELS).some((k) => Number(values[k]) !== rewards.current[k]);
  const isDefault = Object.keys(RULE_LABELS).every((k) => rewards.current[k] === rewards.defaults[k]);
  const confirm = async () => {
    const body = dialog === 'reset' ? { reset: true } : Object.fromEntries(Object.keys(RULE_LABELS).map((k) => [k, Number(values[k])]));
    const r = await adminPost('/economy/rewards', body);
    if (r.ok) {
      addToast('Reglas de Ryō actualizadas: valen desde la próxima partida que termine', 'success', 4000);
      setForm(null);
      onDone();
    }
    return r;
  };
  return (
    <Card title="Recompensas de Ryō" actions={<Badge tone={isDefault ? 'ink' : 'chakra'}>{isDefault ? 'Valores por defecto' : 'Modificadas'}</Badge>}>
      <div className="grid sm:grid-cols-2 gap-x-3">
        {Object.entries(RULE_LABELS).map(([k, label]) => (
          <Field key={k} label={label} hint={`Por defecto ${rewards.defaults[k]} · entre ${rewards.limits[k][0]} y ${rewards.limits[k][1]}`}>
            <input
              className="field !py-1.5 text-[14px]"
              inputMode="numeric"
              value={values[k]}
              onChange={(e) => setForm({ ...values, [k]: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            />
          </Field>
        ))}
      </div>
      <p className="text-[12px] text-ink-faint mb-2">
        Ejemplo con los valores actuales: el ganador con 10 PV recibe {rewards.current.finish + rewards.current.win + rewards.current.perVp * 10} Ryō. Máximo {rewards.current.maxVpCounted} PV contados; hacen falta {rewards.current.minPlayers} ninjas hasta el final.
      </p>
      <div className="flex flex-wrap gap-2">
        <Btn variant="primary" disabled={!changed} onClick={() => setDialog('save')}>Guardar</Btn>
        {form && <Btn onClick={() => setForm(null)}>Descartar</Btn>}
        {!isDefault && <Btn onClick={() => setDialog('reset')}>Volver a los valores por defecto</Btn>}
      </div>
      {dialog && (
        <ActionDialog key={dialog} title="Recompensas de Ryō" confirmLabel="Guardar" onConfirm={confirm} onClose={() => setDialog(null)}>
          <p className="text-[14px]">{dialog === 'reset' ? 'Se vuelve a los valores por defecto.' : 'Se aplica a las partidas que terminen a partir de ahora.'}</p>
        </ActionDialog>
      )}
    </Card>
  );
}

export function EconomyTab({ onOpenUser }) {
  const { data, error, reload } = usePolling('/economy', 30000);
  const [editing, setEditing] = useState(null);
  const stats = data && data.stats;

  return (
    <div className="grid gap-6">
      <ErrorNote>{error}</ErrorNote>
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="Ryō en circulación" value={fmtNum(stats.totals.circulation)} hint={`${fmtNum(stats.totals.holders)} cuentas con saldo`} tone="chakra" />
          <Stat label="Ryō ganados" value={fmtNum(stats.totals.earned)} hint="En partidas" />
          <Stat label="Ryō gastados" value={fmtNum(stats.totals.spent)} hint="En la tienda (registradas)" />
          <Stat label="Compras" value={fmtNum(stats.totals.purchases)} />
          <Stat label="Datos" value={fmtDate(data.statsAt)} hint="Se refrescan cada 30 s" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
        <Card title="Catálogo de la tienda">
          <p className="text-[13px] text-ink-soft mb-2">Los objetos se definen en el código; aquí se cambia precio, venta y ofertas sin desplegar.</p>
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="admin-table w-full text-[13px] min-w-[560px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="py-1 px-2">Objeto</th>
                  <th className="py-1 px-2 text-right">Precio</th>
                  <th className="py-1 px-2">Estado</th>
                  <th className="py-1 px-2 text-right">Vendidos</th>
                  <th className="py-1 px-2 text-right">Dueños</th>
                  <th className="py-1 px-2" />
                </tr>
              </thead>
              <tbody>
                {(data ? data.items : []).map((i) => {
                  const e = i.effective;
                  const sold = stats && stats.perItem[i.id];
                  return (
                    <tr key={i.id} className="border-t border-ink/10">
                      <td className="py-1.5 px-2">
                        <strong className="whitespace-nowrap">{i.name}</strong>
                        <span className="block text-[11px] text-ink-faint">{i.slot === 'pieces' ? 'Fichas' : 'Tablero'} · {i.id}</span>
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                        {e.salePercent ? <><s className="text-ink-faint">{e.listPrice}</s> <strong className="text-shu">{e.price}</strong></> : <strong>{e.price}</strong>}
                        {e.listPrice !== i.price && <span className="block text-[11px] text-ink-faint">catálogo {i.price}</span>}
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex flex-wrap gap-1">
                          {!e.available && <Badge tone="shu">Retirado</Badge>}
                          {e.salePercent && <Badge tone="chakra" title={`Hasta ${fmtDate(e.saleEndsAt)}`}>-{e.salePercent}% hasta {fmtDate(e.saleEndsAt)}</Badge>}
                          {i.override && i.override.salePercent && !e.salePercent && <Badge title="Programada o vencida">Oferta {fmtDate(i.override.saleStarts)}–{fmtDate(i.override.saleEnds)}</Badge>}
                          {e.available && !e.salePercent && !(i.override && i.override.salePercent) && <Badge tone="leaf">A la venta</Badge>}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">
                        {sold ? <>{sold.sold}<span className="block text-[11px] text-ink-faint">{fmtNum(sold.spent)} Ryō</span></> : '0'}
                      </td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{stats ? stats.owners[i.id] || 0 : '…'}</td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        <Btn onClick={() => setEditing(i)}>Editar</Btn>
                        {i.override && <ResetButton item={i} onDone={reload} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        {data && <RewardsCard rewards={data.rewards} onDone={reload} />}
      </div>

      {stats && (
        <div className="grid gap-6 lg:grid-cols-3 items-start">
          <Card title="Mayores saldos">
            {stats.top.length === 0 ? <Empty>Sin cuentas todavía.</Empty> : (
              <ol className="space-y-1">
                {stats.top.map((u, idx) => (
                  <li key={u.userId} className="flex items-center gap-2 text-[13px]">
                    <span className="w-5 text-right tabular-nums text-ink-faint">{idx + 1}</span>
                    <Avatar id={u.avatarId} size={22} />
                    <button type="button" className="flex-1 min-w-0 text-left truncate font-bold hover:underline cursor-pointer" onClick={() => onOpenUser(u.userId)}>{u.displayName}</button>
                    <span className="tabular-nums">{fmtNum(u.coins)}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card title="Ventas por objeto">
            <Bars rows={(data.items || []).map((i) => ({ label: i.name, value: (stats.perItem[i.id] || {}).sold || 0 })).filter((r) => r.value > 0)} />
          </Card>
          <Card title="Últimas compras">
            {stats.recent.length === 0 ? <Empty>Todavía no hay compras registradas.</Empty> : (
              <ul className="space-y-1 text-[13px]">
                {stats.recent.map((p) => (
                  <li key={p.id} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <button type="button" className="font-bold hover:underline cursor-pointer" onClick={() => onOpenUser(p.userId)}>{p.displayName || 'Cuenta borrada'}</button> · {p.itemName}
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-soft">
                      {p.pricePaid}{p.salePercent ? ` (-${p.salePercent}%)` : ''} · {fmtDate(p.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {editing && <ItemDialog key={editing.id} item={editing} onClose={() => setEditing(null)} onDone={reload} />}
    </div>
  );
}

function ResetButton({ item, onDone }) {
  const { addToast } = useGame();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn className="ml-1" onClick={() => setOpen(true)}>Restablecer</Btn>
      {open && (
        <ActionDialog
          title={`Restablecer ${item.name}`}
          confirmLabel="Restablecer"
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            const r = await adminPost(`/economy/items/${item.id}`, { reset: true });
            if (r.ok) {
              addToast(`${item.name} vuelve al catálogo (${item.price} Ryō, a la venta, sin oferta)`, 'success');
              onDone();
            }
            return r;
          }}
        >
          <p className="text-[14px]">Se quitan el precio cambiado, la oferta y el retiro.</p>
        </ActionDialog>
      )}
    </>
  );
}
