import { useState } from 'react';
import { usePolling } from '../api';
import { Btn, Card, Empty, ErrorNote, Pager } from '../ui';
import { ACTION_LABELS, fmtDate } from '../format';
import { Dropdown } from '../../components/Shared/Choice';

function describe(details) {
  if (!details || typeof details !== 'object') return '';
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}

export function AuditTab({ onOpenUser }) {
  const [action, setAction] = useState('');
  const [adminId, setAdminId] = useState('');
  const [page, setPage] = useState(1);
  const { data: meta } = usePolling('/actions/meta', 0);
  const params = new URLSearchParams({ action, adminId, page: String(page) }).toString();
  const { data, error, reload } = usePolling(`/actions?${params}`, 15_000);

  const actionOptions = [{ value: '', label: 'Todas las acciones' }, ...((meta && meta.actions) || []).map((a) => ({ value: a, label: ACTION_LABELS[a] || a }))];
  const adminOptions = [{ value: '', label: 'Todos los admins' }, ...((meta && meta.admins) || []).map((a) => ({ value: a.id, label: a.displayName }))];

  return (
    <Card title="Registro de acciones" actions={<Btn onClick={reload}>Actualizar</Btn>}>
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <Dropdown options={actionOptions} value={action} onChange={(v) => { setAction(v); setPage(1); }} ariaLabel="Filtrar por acción" className="sm:w-64" />
        <Dropdown options={adminOptions} value={adminId} onChange={(v) => { setAdminId(v); setPage(1); }} ariaLabel="Filtrar por admin" className="sm:w-56" />
      </div>
      <ErrorNote>{error}</ErrorNote>
      {data && data.actions.length === 0 ? (
        <Empty>No hay acciones registradas con esos filtros.</Empty>
      ) : (
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                <th className="py-1 px-2">Fecha</th>
                <th className="py-1 px-2">Admin</th>
                <th className="py-1 px-2">Acción</th>
                <th className="py-1 px-2">Sobre</th>
                <th className="py-1 px-2">Detalles</th>
              </tr>
            </thead>
            <tbody>
              {(data ? data.actions : []).map((a) => (
                <tr key={a.id} className="border-t border-ink/10 align-top">
                  <td className="py-1.5 px-2 whitespace-nowrap">{fmtDate(a.createdAt)}</td>
                  <td className="py-1.5 px-2">{a.adminName || '—'}</td>
                  <td className="py-1.5 px-2 font-bold">{ACTION_LABELS[a.action] || a.action}</td>
                  <td className="py-1.5 px-2 whitespace-nowrap">
                    {a.targetType === 'user' && a.targetId ? (
                      <button type="button" className="underline decoration-dotted text-sea font-bold" onClick={() => onOpenUser(a.targetId)}>cuenta</button>
                    ) : a.targetType === 'room' && a.targetId ? (
                      <span className="font-mono">sala {a.targetId}</span>
                    ) : (a.targetType || '—')}
                  </td>
                  <td className="py-1.5 px-2 text-ink-soft break-words max-w-[28rem]">{describe(a.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </Card>
  );
}
