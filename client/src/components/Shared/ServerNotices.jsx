import { useEffect, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useGame } from '../../context/GameContext';
import { useAuth } from '../../context/AuthContext';
import { AlertIcon, CloseIcon, HourglassIcon, InfoIcon } from './Icons';

// Messages from the village council (the server): global announcements sent
// by an admin (menu and game) and the maintenance banner (menu only).

const DISMISSED_KEY = 'catan_dismissed_notice';

function wasDismissed(id) {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === id;
  } catch {
    return false;
  }
}

function rememberDismissed(id) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, id);
  } catch {
    // storage blocked
  }
}

const SEVERITY = {
  info: { border: '!border-l-chakra', icon: 'text-chakra', label: 'Aviso de la aldea' },
  warning: { border: '!border-l-res-wheat', icon: 'text-chakra-dark', label: 'Atención, ninjas' },
  danger: { border: '!border-l-shu', icon: 'text-shu', label: 'Aviso urgente' },
};

export function ServerNotices() {
  const { socket } = useSocket();
  const { gameState } = useGame();
  const { refresh } = useAuth();
  const [announcement, setAnnouncement] = useState(null);
  const [maintenance, setMaintenance] = useState(null);

  useEffect(() => {
    if (!socket) return undefined;
    const onStatus = (status) => {
      const m = status && status.maintenance;
      setMaintenance(m && m.on ? m : null);
    };
    const onAnnouncement = (a) => {
      if (!a || a.clear || !a.id || typeof a.message !== 'string') {
        setAnnouncement(null);
        return;
      }
      if (!wasDismissed(a.id)) setAnnouncement(a);
    };
    // Suspended / banned while connected: the server already made this socket
    // a guest; refreshing the session shows why and signs the account out
    const onBlocked = () => {
      refresh();
    };
    socket.on('serverStatus', onStatus);
    socket.on('announcement', onAnnouncement);
    socket.on('accountBlocked', onBlocked);
    return () => {
      socket.off('serverStatus', onStatus);
      socket.off('announcement', onAnnouncement);
      socket.off('accountBlocked', onBlocked);
    };
  }, [socket, refresh]);

  const showMaintenance = !!maintenance && !gameState;
  if (!announcement && !showMaintenance) return null;

  const sev = SEVERITY[announcement?.severity] || SEVERITY.info;
  const dismiss = () => {
    if (announcement) rememberDismissed(announcement.id);
    setAnnouncement(null);
  };

  return (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[65] flex flex-col items-center gap-2 px-3 pointer-events-none">
      {announcement && (
        <div
          role="alert"
          className={`paper animate-toast-slide pointer-events-auto w-full max-w-xl flex items-start gap-3 pl-3 pr-2 py-2.5 rounded-[2px] border border-paper-edge border-l-4 shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)] ${sev.border}`}
        >
          <span className={`shrink-0 mt-0.5 ${sev.icon}`}>
            {announcement.severity === 'info' ? <InfoIcon className="w-5 h-5" /> : <AlertIcon className="w-5 h-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] leading-tight text-ink">{sev.label}</p>
            <p className="text-[14px] text-ink-soft leading-snug break-words">{announcement.message}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 w-9 h-9 -my-1 flex items-center justify-center rounded-full text-ink-faint hover:text-shu hover:bg-ink/5"
            aria-label="Cerrar aviso"
            title="Cerrar"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      {showMaintenance && (
        <div
          role="status"
          className="paper pointer-events-auto w-full max-w-xl flex items-start gap-3 px-3 py-2.5 rounded-[2px] border border-paper-edge border-l-4 !border-l-res-wheat shadow-[0_10px_24px_-8px_rgba(0,0,0,0.7)]"
        >
          <HourglassIcon className="w-5 h-5 shrink-0 mt-0.5 text-chakra-dark" />
          <div className="min-w-0">
            <p className="font-display text-[15px] leading-tight text-ink">Mantenimiento en curso</p>
            <p className="text-[14px] text-ink-soft leading-snug break-words">{maintenance.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
