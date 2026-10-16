import { useEffect, useState } from 'react';

/** "m:ss", or "h:mm:ss" from one hour on */
export function formatDuration(ms) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * Elapsed time of the current game (ms), on the server's clock: startedAt and
 * endedAt come from the server, serverOffset = server clock − local clock.
 * Ticks once a second while the game runs and stops at game over.
 */
export function useGameElapsed(startedAt, endedAt, serverOffset = 0) {
  const [now, setNow] = useState(() => Date.now());
  const running = !!startedAt && !endedAt;
  useEffect(() => {
    if (!running) return undefined;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [running]);
  if (!startedAt) return null;
  const end = endedAt || now + serverOffset;
  return Math.max(0, end - startedAt);
}
