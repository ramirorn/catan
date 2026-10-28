import { useCallback, useEffect, useRef, useState } from 'react';

// Admin API client. Every request carries the X-Catan-Admin header (the
// server answers 404 without it) and the session cookie.
const BASE = import.meta.env.VITE_SERVER_URL ? `${import.meta.env.VITE_SERVER_URL}/api/admin` : '/api/admin';

export async function adminApi(path, { method = 'GET', body, timeout = 15000 } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: { 'X-Catan-Admin': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    return { ok: false, status: 0, data: { error: 'No hay conexión con el servidor' } };
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data: data || {} };
}

/** POST helper: { ok, error, data } */
export async function adminPost(path, body = {}) {
  const r = await adminApi(path, { method: 'POST', body });
  return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.data.error || 'No se pudo completar' };
}

/**
 * GET `path` now and every `intervalMs` while the tab is visible (0 = once).
 * Keeps the last good data when a refresh fails.
 */
export function usePolling(path, intervalMs = 0) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const reload = useCallback(async () => {
    if (!path) return null;
    const r = await adminApi(path);
    if (!alive.current) return r;
    setState((prev) => (r.ok
      ? { data: r.data, error: null, loading: false }
      : { data: prev.data, error: r.data.error || 'No se pudo cargar', loading: false }));
    return r;
  }, [path]);

  useEffect(() => {
    alive.current = true;
    reload();
    let timer = null;
    if (intervalMs > 0) {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') reload();
      }, intervalMs);
    }
    return () => {
      alive.current = false;
      if (timer) clearInterval(timer);
    };
  }, [reload, intervalMs]);

  return { ...state, reload };
}
