// Server-authoritative turn timer.
// One timeout per room, keyed by engine.getTimerKey() ("who must act now").
// sync() is called before every state broadcast: it keeps the running timer if
// the key is unchanged, restarts it when the acting player/phase changes and
// clears it when nothing has to be timed (lobby, game over, no limit).

// Short extra time when a turn that already timed out needs the same player
// again (e.g. moving the robber after the others discarded)
export const TIMEOUT_GRACE_MS = 10000;

export function createTurnTimers({
  onExpire,
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  function clear(room) {
    if (!room) return;
    if (room.turnTimer) clearTimer(room.turnTimer.handle);
    room.turnTimer = null;
    if (room.engine) room.engine.turnDeadline = null;
  }

  function sync(roomId, room) {
    if (!room) return;
    const engine = room.engine;
    const limitMs = engine.getTimerLimitMs ? engine.getTimerLimitMs() : (engine.turnTimeLimit || 0) * 1000;
    const key = limitMs > 0 ? engine.getTimerKey() : null;

    if (!key) {
      clear(room);
      room.pausedTimer = null;
      return;
    }
    if (room.turnTimer && room.turnTimer.key === key) return; // same player still acting

    // Pause: while e.g. a peace pact waits for an answer, the turn timer it
    // interrupts keeps what was left and resumes with it afterwards
    const pausedKey = engine.getPausedTimerKey ? engine.getPausedTimerKey() : null;
    if (pausedKey && room.turnTimer && room.turnTimer.key === pausedKey && engine.turnDeadline) {
      room.pausedTimer = { key: pausedKey, remainingMs: Math.max(0, engine.turnDeadline - now()) };
    }
    clear(room);
    let ms = key === engine.timedOutKey ? Math.min(TIMEOUT_GRACE_MS, limitMs) : limitMs;
    const paused = room.pausedTimer;
    if (paused && paused.key === key) {
      // Resume, with a short minimum so nobody loses the turn the moment it comes back
      ms = Math.min(limitMs, Math.max(paused.remainingMs, Math.min(TIMEOUT_GRACE_MS, limitMs)));
      room.pausedTimer = null;
    } else if (paused && paused.key !== pausedKey) {
      room.pausedTimer = null; // the paused turn is over
    }
    engine.turnDeadline = now() + ms;
    const timer = { key, handle: null };
    timer.handle = setTimer(() => {
      // Stale timer (cleared or replaced meanwhile): do nothing
      if (room.turnTimer !== timer) return;
      room.turnTimer = null;
      engine.turnDeadline = null;
      onExpire(roomId, key);
    }, ms);
    if (timer.handle && typeof timer.handle.unref === 'function') timer.handle.unref();
    room.turnTimer = timer;
  }

  return { sync, clear };
}
