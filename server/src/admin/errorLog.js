// Last server errors, kept in memory for the admin "Sistema" tab: every
// console.error plus uncaught exceptions / unhandled rejections, with a
// timestamp. Nothing is written to disk and only admins can read it.
import { format } from 'util';

const MAX_ENTRIES = 50;
const MAX_TEXT = 2000;
const entries = [];
let counter = 0;
let installed = false;

export function recordError(source, text) {
  counter += 1;
  entries.push({ id: counter, at: Date.now(), source, text: String(text).slice(0, MAX_TEXT) });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

/** Newest first */
export function recentErrors() {
  return entries.slice().reverse();
}

export function clearErrors() {
  entries.length = 0;
}

function describe(err) {
  if (err && err.stack) return err.stack.split('\n').slice(0, 6).join('\n');
  return format('%o', err);
}

/** Hooks console.error and the process error events (once) */
export function installErrorLog() {
  if (installed) return;
  installed = true;
  const original = console.error.bind(console);
  console.error = (...args) => {
    try {
      recordError('console', format(...args));
    } catch {
      // never break logging
    }
    original(...args);
  };
  // Observes without changing Node's behaviour for uncaught exceptions
  process.on('uncaughtExceptionMonitor', (err) => recordError('uncaught', describe(err)));
  // A forgotten promise must not take every running game down with it
  process.on('unhandledRejection', (reason) => {
    recordError('unhandledRejection', describe(reason));
    original('Unhandled promise rejection:', reason);
  });
}
