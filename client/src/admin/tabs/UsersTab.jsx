import { useEffect, useState } from 'react';
import { usePolling } from '../api';
import { Badge, Card, Empty, ErrorNote, Pager, SearchField, StatusBadge } from '../ui';
import { ROLE_LABELS, fmtDate, fmtNum } from '../format';
import { Dropdown } from '../../components/Shared/Choice';
import { Avatar } from '../../components/Shared/Avatar';
import { UserDetail } from './UserDetail';

const ROLE_OPTIONS = [
  { value: '', label: 'Todos los roles' },
  { value: 'player', label: 'Jugadores' },
  { value: 'admin', label: 'Admins' },
];
const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'active', label: 'Activas' },
  { value: 'suspended', label: 'Suspendidas' },
  { value: 'banned', label: 'Bloqueadas' },
];

export function UsersTab({ admin, focusUserId, onFocusUser }) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  const params = new URLSearchParams({ q, role, status, page: String(page) }).toString();
  const { data, error, loading, reload } = usePolling(`/users?${params}`, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start">
      <Card title="Cuentas">
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <SearchField value={text} onChange={setText} placeholder="Buscar por nombre, correo o id" ariaLabel="Buscar cuentas" />
          <Dropdown options={ROLE_OPTIONS} value={role} onChange={(v) => { setRole(v); setPage(1); }} ariaLabel="Filtrar por rol" className="sm:w-40" />
          <Dropdown options={STATUS_OPTIONS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} ariaLabel="Filtrar por estado" className="sm:w-44" />
        </div>
        <ErrorNote>{error}</ErrorNote>
        {data && data.users.length === 0 && !loading ? (
          <Empty>Ninguna cuenta coincide.</Empty>
        ) : (
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="admin-table w-full text-[13px] min-w-[520px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="py-1 px-2">Ninja</th>
                  <th className="py-1 px-2 text-right">Ryō</th>
                  <th className="py-1 px-2 text-right">Partidas</th>
                  <th className="py-1 px-2">Estado</th>
                  <th className="py-1 px-2">Alta</th>
                </tr>
              </thead>
              <tbody>
                {(data ? data.users : []).map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => onFocusUser(u.id)}
                    className={`cursor-pointer ${focusUserId === u.id ? 'is-selected' : ''}`}
                  >
                    <td className="py-1.5 px-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar id={u.avatarId} size={32} />
                        <div className="min-w-0">
                          <p className="font-bold truncate">
                            {u.displayName} {u.role === 'admin' && <Badge tone="chakra">{ROLE_LABELS.admin}</Badge>}
                          </p>
                          <p className="text-[12px] text-ink-faint truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{fmtNum(u.coins)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{u.gamesWon}/{u.gamesPlayed}</td>
                    <td className="py-1.5 px-2"><StatusBadge user={u} /></td>
                    <td className="py-1.5 px-2 whitespace-nowrap text-ink-soft">{fmtDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Card>

      {focusUserId ? (
        <UserDetail key={focusUserId} userId={focusUserId} admin={admin} onChanged={reload} onClose={() => onFocusUser(null)} />
      ) : (
        <Card title="Detalle">
          <Empty>Elige una cuenta de la lista para ver su perfil y moderarla.</Empty>
        </Card>
      )}
    </div>
  );
}
