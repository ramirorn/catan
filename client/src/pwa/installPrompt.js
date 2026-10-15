// Keeps the browser's `beforeinstallprompt` event (Android / desktop Chrome &
// Edge) so the lobby can offer its own "Instalar app" button. Imported from
// main.jsx so the listener exists before the event fires.
import { useSyncExternalStore } from 'react';

let deferredPrompt = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferredPrompt = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** true when the browser offered installation and it has not been used yet */
export function useCanInstall() {
  return useSyncExternalStore(subscribe, () => !!deferredPrompt, () => false);
}

/** Shows the native install dialog. Resolves to 'accepted' | 'dismissed' | null */
export async function promptInstall() {
  const e = deferredPrompt;
  if (!e) return null;
  deferredPrompt = null; // the event can only be used once
  emit();
  e.prompt();
  try {
    const { outcome } = await e.userChoice;
    return outcome;
  } catch {
    return null;
  }
}

/** Running as an installed app (home screen / app window) */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/** iPhone / iPad (iPadOS reports itself as a Mac with touch) */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
