import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { isIOS, isStandalone, promptInstall, useCanInstall } from '../../pwa/installPrompt';
import { AlertIcon, CloseIcon, InfoIcon } from './Icons';

const IOS_HINT_KEY = 'catan_ios_install_hint_seen';
const UPDATE_CHECK_MS = 30 * 60 * 1000;

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Service worker registration (production build only: in `vite dev` the
 * virtual module does nothing), "new version" toast and offline banner.
 */
export function PwaLayer() {
  const online = useOnline();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Look for a new deploy now and then, and whenever the app comes back
      // to the foreground (installed apps can stay open for days)
      const check = () => {
        if (navigator.onLine && !registration.installing) registration.update().catch(() => {});
      };
      setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  return (
    <>
      {!online && (
        <div
          role="status"
          className="fixed z-[70] top-[calc(env(safe-area-inset-top)+0.5rem)] left-1/2 -translate-x-1/2 w-max max-w-[calc(100vw-1.5rem)] pointer-events-none animate-toast-slide"
        >
          <div className="paper flex items-center gap-2.5 pl-3 pr-4 py-2 rounded-[2px] border border-paper-edge border-l-4 !border-l-shu shadow-[0_8px_18px_-6px_rgba(0,0,0,0.6)]">
            <AlertIcon className="w-4.5 h-4.5 shrink-0 text-shu" />
            <span className="text-[13px] leading-snug text-ink">
              <strong className="font-bold">Sin conexión.</strong>{' '}
              <span className="text-ink-soft">Shinobi necesita internet; volverá a conectarse solo.</span>
            </span>
          </div>
        </div>
      )}

      {needRefresh && (
        <div className="fixed z-[65] top-[calc(env(safe-area-inset-top)+3.5rem)] sm:top-[calc(env(safe-area-inset-top)+4rem)] phland:top-[calc(env(safe-area-inset-top)+3.1rem)] left-[max(0.75rem,env(safe-area-inset-left))] max-w-[calc(100vw-1.5rem)] sm:max-w-sm animate-toast-slide">
          <div
            role="status"
            className="paper flex items-center gap-2.5 pl-3 pr-1.5 py-1.5 rounded-[2px] border border-paper-edge border-l-4 !border-l-chakra shadow-[0_8px_18px_-6px_rgba(0,0,0,0.6)]"
          >
            <InfoIcon className="w-4.5 h-4.5 shrink-0 text-chakra" />
            <span className="text-[13px] font-semibold text-ink leading-snug">Nueva versión disponible</span>
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="btn btn-primary min-h-[36px] px-3 py-1 text-[13px] shrink-0"
            >
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-ink-faint hover:text-ink hover:bg-ink/5"
              aria-label="Más tarde"
              title="Más tarde"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Small "Instalar app" link for the lobby: opens the native dialog on
 * Android / desktop Chrome, or explains "Compartir → Agregar a pantalla de
 * inicio" on iPhone / iPad (shown once by itself, then on tap). Renders
 * nothing when the game already runs as an installed app.
 */
export function InstallAppButton({ className = '' }) {
  const canInstall = useCanInstall();
  const [ios] = useState(() => isIOS() && !isStandalone());
  const [hintOpen, setHintOpen] = useState(false);
  const wrapRef = useRef(null);

  // First visit on iOS: show the hint once
  useEffect(() => {
    if (!ios) return undefined;
    let seen = true;
    try {
      seen = localStorage.getItem(IOS_HINT_KEY) === '1';
    } catch {
      // storage blocked: just don't auto-open
    }
    if (seen) return undefined;
    const t = setTimeout(() => setHintOpen(true), 1200);
    return () => clearTimeout(t);
  }, [ios]);

  const closeHint = () => {
    setHintOpen(false);
    try {
      localStorage.setItem(IOS_HINT_KEY, '1');
    } catch {
      // ignore
    }
  };

  // Tap outside closes the hint
  useEffect(() => {
    if (!hintOpen) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) closeHint();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [hintOpen]);

  if (!canInstall && !ios) return null;

  return (
    <div ref={wrapRef} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => (canInstall ? promptInstall() : hintOpen ? closeHint() : setHintOpen(true))}
        className="inline-flex items-center gap-1 min-h-[32px] -my-2 px-1.5 text-[12px] font-bold text-chakra-dark hover:text-shu underline underline-offset-2 decoration-chakra/50 cursor-pointer"
        aria-expanded={ios ? hintOpen : undefined}
      >
        Instalar app
      </button>

      {ios && hintOpen && (
        <div
          role="dialog"
          aria-label="Instalar en iPhone"
          className="absolute right-0 bottom-[calc(100%+0.6rem)] z-30 w-[min(17rem,calc(100vw-2.5rem))] paper border border-paper-edge border-l-4 !border-l-chakra rounded-[2px] shadow-[0_10px_22px_-6px_rgba(0,0,0,0.65)] pl-3 pr-2 py-2.5 animate-toast-slide"
        >
          <div className="flex items-start gap-2">
            <p className="text-[13px] leading-snug text-ink">
              <strong className="font-bold">Juega a pantalla completa:</strong> en Safari toca{' '}
              <ShareGlyph className="inline-block w-4 h-4 -mt-0.5 text-[#2f6fd6]" />{' '}
              <strong>Compartir</strong> → <strong>Agregar a pantalla de inicio</strong>.
            </p>
            <button
              type="button"
              onClick={closeHint}
              className="w-8 h-8 -mt-1 shrink-0 flex items-center justify-center rounded-full text-ink-faint hover:text-ink hover:bg-ink/5"
              aria-label="Entendido"
              title="Entendido"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}
