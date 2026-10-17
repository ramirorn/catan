import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Avatar } from '../Shared/Avatar';
import { SegmentedControl } from '../Shared/Choice';
import { CrownIcon } from '../Shared/Icons';
import { MenuShell, PanelHeading } from './MenuParts';

const API_BASE = import.meta.env.VITE_SERVER_URL ? `${import.meta.env.VITE_SERVER_URL}/api` : '/api';

const PERIODS = [
  { value: 'week', label: 'Esta semana' },
  { value: 'all', label: 'Histórico' },
];

// Gold, silver and bronze seals for the podium
const MEDALS = ['#c9a227', '#9aa3ad', '#b0703c'];

function RankRow({ row, mine }) {
  const medal = row.rank <= 3 ? MEDALS[row.rank - 1] : null;
  return (
    <li
      className={`flex items-center gap-2.5 px-2 py-1.5 border-b border-dashed border-ink/15 last:border-b-0 ${
        mine ? 'bg-chakra/20 rounded-[2px]' : ''
      }`}
    >
      <span
        className={`w-7 shrink-0 text-center font-serif font-extrabold tabular-nums ${medal ? 'text-[17px]' : 'text-[14px] text-ink-faint'}`}
        style={medal ? { color: medal } : undefined}
      >
        {medal ? <CrownIcon className="w-5 h-5 mx-auto" aria-label={`Puesto ${row.rank}`} /> : row.rank}
      </span>
      <Avatar id={row.avatarId} size={26} />
      <span className="flex-1 min-w-0 leading-tight">
        <span className="block truncate text-[14px] font-semibold text-ink">
          {row.displayName}
          {mine && <span className="ml-1 font-normal italic text-ink-faint text-[12px]">(tú)</span>}
        </span>
        <span className="block text-[11px] text-ink-faint">
          {row.games} {row.games === 1 ? 'partida' : 'partidas'}
        </span>
      </span>
      <span className="shrink-0 text-right leading-none" title={`${row.wins} ${row.wins === 1 ? 'victoria' : 'victorias'}`}>
        <span className="font-serif font-extrabold text-[18px] text-ink tabular-nums">{row.wins}</span>
        <span className="block text-[9px] font-bold uppercase tracking-[0.1em] text-ink-faint mt-0.5">
          {row.wins === 1 ? 'victoria' : 'victorias'}
        </span>
      </span>
    </li>
  );
}

/** Players with the most wins, this week (from Monday) and all time */
export function RankingScreen({ onBack, onLogin, onProfile }) {
  const { user, status } = useAuth();
  const [period, setPeriod] = useState('week');
  const [board, setBoard] = useState({ loading: true, rows: [], me: null, error: '' });

  useEffect(() => {
    let alive = true;
    setBoard((b) => ({ ...b, loading: true, error: '' }));
    fetch(`${API_BASE}/leaderboard?period=${period}`, { credentials: 'include', signal: AbortSignal.timeout(15000) })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!alive) return;
        if (!ok) throw new Error(data?.error || 'No se pudo cargar el ranking');
        setBoard({ loading: false, rows: data.rows || [], me: data.me || null, error: '' });
      })
      .catch((err) => {
        if (alive) setBoard({ loading: false, rows: [], me: null, error: err.message || 'No se pudo cargar el ranking' });
      });
    return () => {
      alive = false;
    };
  }, [period, user?.id]);

  const myId = user?.id;
  const meOutsideTop = board.me && !board.rows.some((r) => r.userId === board.me.userId);

  return (
    <MenuShell onProfile={onProfile} onLogin={onLogin} compactTitle>
      <PanelHeading
        title="Ranking"
        subtitle={period === 'week' ? 'Más victorias desde el lunes.' : 'Más victorias de todos los tiempos.'}
        onBack={onBack}
      />

      <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} ariaLabel="Período del ranking" className="mb-3" />

      {board.loading ? (
        <p className="py-6 text-center text-[13px] italic text-ink-faint">Consultando los pergaminos…</p>
      ) : board.error ? (
        <p className="py-6 text-center text-[13px] text-shu">{board.error}</p>
      ) : board.rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] italic text-ink-faint">
          {period === 'week' ? 'Nadie ha ganado esta semana todavía. ¡Sé el primero!' : 'Todavía no hay victorias registradas.'}
        </p>
      ) : (
        <ol className="max-h-[min(22rem,33dvh)] overflow-y-auto overscroll-contain paper-inset">
          {board.rows.map((row) => (
            <RankRow key={row.userId} row={row} mine={row.userId === myId} />
          ))}
        </ol>
      )}

      {meOutsideTop && (
        <ol className="mt-2 paper-inset">
          <RankRow row={board.me} mine />
        </ol>
      )}

      <p className="mt-3 text-[12px] leading-snug text-ink-faint">
        {user
          ? 'Cuentan las partidas que terminas con tu cuenta. El ranking semanal se reinicia cada lunes.'
          : status === 'disabled'
            ? 'Las cuentas no están disponibles ahora.'
            : 'Inicia sesión para aparecer en el ranking: las partidas como invitado no cuentan.'}
      </p>
    </MenuShell>
  );
}
