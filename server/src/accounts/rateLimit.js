// Tiny in-memory sliding-window rate limiter (one server instance).
export function createRateLimiter() {
  const hits = new Map(); // key → timestamps (ms)

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, times] of hits) {
      if (!times.length || now - times[times.length - 1] > 60 * 60 * 1000) hits.delete(key);
    }
  }, 10 * 60 * 1000);
  if (typeof sweep.unref === 'function') sweep.unref();

  /** Express middleware: at most `max` requests per `windowMs` per IP and bucket */
  return function limit(bucket, max, windowMs, message = 'Demasiados intentos. Espera un momento y vuelve a probar.') {
    return (req, res, next) => {
      const key = `${bucket}:${req.ip}`;
      const now = Date.now();
      const times = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (times.length >= max) {
        const retry = Math.ceil((windowMs - (now - times[0])) / 1000);
        res.setHeader('Retry-After', String(retry));
        return res.status(429).json({ error: message });
      }
      times.push(now);
      hits.set(key, times);
      next();
    };
  };
}
