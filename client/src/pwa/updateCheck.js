// Asks the service worker to look for a new deploy. PwaLayer hands over the
// registration; anyone can then trigger a check, e.g. the socket when it
// reconnects (every deploy restarts the server, so a reconnection is the
// first sign that a new version is online).

let registration = null;
let lastCheck = 0;
// Never more often than this (a flapping connection would hammer the server)
const MIN_GAP_MS = 10 * 1000;

export function setUpdateRegistration(reg) {
  registration = reg || null;
}

export function checkForUpdate() {
  const now = Date.now();
  if (!registration || registration.installing || !navigator.onLine || now - lastCheck < MIN_GAP_MS) return;
  lastCheck = now;
  registration.update().catch(() => {});
}
