import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { adminApi } from './api';
import { GamesTab } from './tabs/GamesTab';
import { UsersTab } from './tabs/UsersTab';
import { NoticesTab } from './tabs/NoticesTab';
import { StatsTab } from './tabs/StatsTab';
import { SystemTab } from './tabs/SystemTab';
import { AuditTab } from './tabs/AuditTab';
import { ModerationTab } from './tabs/ModerationTab';
import { EconomyTab } from './tabs/EconomyTab';
import { RankingTab } from './tabs/RankingTab';
import { ObserveView } from './ObserveView';
import { ShurikenIcon } from '../components/Shared/Icons';

// Admin panel shell (/admin). Tabs are a plain list: a new tool is a new
// entry here plus its component in ./tabs and its routes on the server
// (server/src/admin/routes).
const TABS = [
  { id: 'partidas', label: 'Partidas', Component: GamesTab },
  { id: 'usuarios', label: 'Usuarios', Component: UsersTab },
  { id: 'moderacion', label: 'Moderación', Component: ModerationTab },
  { id: 'tienda', label: 'Tienda y economía', Component: EconomyTab },
  { id: 'ranking', label: 'Ranking', Component: RankingTab },
  { id: 'avisos', label: 'Avisos y mantenimiento', Component: NoticesTab },
  { id: 'estadisticas', label: 'Estadísticas', Component: StatsTab },
  { id: 'sistema', label: 'Sistema', Component: SystemTab },
  { id: 'registro', label: 'Registro', Component: AuditTab },
];

function tabFromHash() {
  const id = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
  return TABS.some((t) => t.id === id) ? id : TABS[0].id;
}

/** What a non-admin sees: nothing that hints at a panel */
function NotFound() {
  useEffect(() => {
    document.title = 'Página no encontrada · Catán Shinobi';
  }, []);
  return (
    <main className="night-surface min-h-dvh w-full flex items-center justify-center p-4">
      <div className="paper max-w-sm w-full text-center px-6 py-8 rounded-[2px] border border-paper-edge">
        <h1 className="font-display text-[26px] text-ink">Página no encontrada</h1>
        <p className="mt-2 text-ink-soft text-[14px]">Este camino no lleva a ninguna aldea.</p>
        <a href="/" className="btn btn-primary mt-5 min-h-[42px] px-5 py-1.5">Volver al menú</a>
      </div>
    </main>
  );
}

export default function AdminApp() {
  const { status } = useAuth();
  const { gameState } = useGame();
  const [access, setAccess] = useState({ state: 'loading', admin: null });
  const [tab, setTab] = useState(tabFromHash);
  const [focusUserId, setFocusUserId] = useState(null);
  const [observing, setObserving] = useState(null);

  // Ask the server who we are once the session is known (404 = not an admin)
  useEffect(() => {
    if (status === 'loading') return undefined;
    let cancelled = false;
    adminApi('/me').then((r) => {
      if (cancelled) return;
      setAccess(r.ok && r.data.admin ? { state: 'ok', admin: r.data.admin } : { state: 'denied', admin: null });
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (access.state === 'ok') document.title = 'Consejo de la aldea · Catán Shinobi';
  }, [access.state]);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((id) => {
    setTab(id);
    try {
      window.history.replaceState(null, '', `#${id}`);
    } catch {
      // ignore
    }
  }, []);

  const closeObserve = useCallback(() => setObserving(null), []);

  const openUser = useCallback((userId) => {
    setFocusUserId(userId);
    go('usuarios');
  }, [go]);

  if (access.state === 'loading') {
    return <div className="night-surface min-h-dvh w-full" aria-busy="true" />;
  }
  if (access.state !== 'ok') return <NotFound />;

  const Active = (TABS.find((t) => t.id === tab) || TABS[0]).Component;

  return (
    <div className="night-surface min-h-dvh w-full text-ink font-sans">
      <header className="night-rail sticky top-0 z-30 border-b-2 border-black/70 shadow-[0_6px_16px_-6px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 flex items-center gap-3">
          <ShurikenIcon className="w-5 h-5 text-shu shrink-0" hole="#10141d" />
          <h1 className="font-display text-paper-light text-[19px] sm:text-[22px] leading-tight truncate">Consejo de la aldea</h1>
          <span className="ml-auto text-[12px] text-paper/70 truncate hidden sm:inline">
            Admin: <strong className="text-paper-light">{access.admin.displayName}</strong>
          </span>
          <a href="/" className="btn btn-ghost !text-paper-light !border-paper/40 hover:!bg-white/10 min-h-[32px] px-2.5 py-0.5 text-[12px] shrink-0">
            Ir al juego
          </a>
        </div>
        <nav className="max-w-7xl mx-auto px-2 sm:px-4 flex gap-1 overflow-x-auto" aria-label="Secciones">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => go(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`shrink-0 px-3 py-2 text-[13px] font-bold border-b-[3px] transition-colors ${
                tab === t.id ? 'text-paper-light border-shu' : 'text-paper/60 border-transparent hover:text-paper-light'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-5 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Active
          admin={access.admin}
          onObserve={setObserving}
          onOpenUser={openUser}
          focusUserId={focusUserId}
          onFocusUser={setFocusUserId}
        />
      </main>

      {observing && <ObserveView roomId={observing} hasState={!!gameState} onClose={closeObserve} />}
    </div>
  );
}
