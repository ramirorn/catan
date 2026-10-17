import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Player accounts (optional): the server talks to Neon Auth and keeps the
// session in an httpOnly cookie on our own domain. Guests never need this.

const AuthContext = createContext(null);

// Same origin in production; in `vite dev` the /api proxy forwards to :3001
const API_BASE = import.meta.env.VITE_SERVER_URL ? `${import.meta.env.VITE_SERVER_URL}/api` : '/api';
const ME_TIMEOUT_MS = 8000;

async function api(path, { method = 'GET', body, timeout = 15000 } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
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

// One-shot message carried back by the Google redirect (?login=google|error)
function takeLoginParam() {
  try {
    const url = new URL(window.location.href);
    const value = url.searchParams.get('login');
    if (!value) return null;
    url.searchParams.delete('login');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    return value;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  // status: 'loading' | 'guest' | 'user' | 'disabled'
  const [status, setStatus] = useState('loading');
  const [user, setUserState] = useState(null);
  const [config, setConfig] = useState(null);
  const [notice, setNotice] = useState(() => {
    const p = typeof window === 'undefined' ? null : takeLoginParam();
    if (p === 'google') return { type: 'success', text: '¡Sesión iniciada con Google!' };
    if (p === 'error') return { type: 'error', text: 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.' };
    return null;
  });
  const readyRef = useRef(null);
  const userRef = useRef(null);
  // The ref is read by getSocketToken right after a sign-in, before any render
  const setUser = useCallback((next) => {
    setUserState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      userRef.current = value;
      return value;
    });
    if (typeof next !== 'function') userRef.current = next;
  }, []);

  const refresh = useCallback(async () => {
    const [cfg, me] = await Promise.all([api('/config', { timeout: ME_TIMEOUT_MS }), api('/me', { timeout: ME_TIMEOUT_MS })]);
    if (cfg.ok) setConfig(cfg.data);
    if (cfg.ok && !cfg.data.accounts) {
      setUser(null);
      setStatus('disabled');
      return null;
    }
    const next = me.ok ? me.data.user || null : null;
    setUser(next);
    setStatus(next ? 'user' : cfg.ok ? 'guest' : 'disabled');
    return next;
  }, [setUser]);

  useEffect(() => {
    readyRef.current = refresh();
  }, [refresh]);

  const accept = useCallback((res) => {
    if (res.ok && res.data.user) {
      setUser(res.data.user);
      setStatus('user');
      return { success: true, user: res.data.user };
    }
    return { success: false, error: res.data.error || 'No se pudo completar. Inténtalo de nuevo.' };
  }, [setUser]);

  const register = useCallback(async ({ email, password, displayName, avatarId }) =>
    accept(await api('/auth/register', { method: 'POST', body: { email, password, displayName, avatarId } })), [accept]);

  const login = useCallback(async ({ email, password, avatarId }) =>
    accept(await api('/auth/login', { method: 'POST', body: { email, password, avatarId } })), [accept]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    setStatus((s) => (s === 'disabled' ? s : 'guest'));
  }, [setUser]);

  // A plain navigation: the server starts the Google flow and comes back
  const loginWithGoogle = useCallback(() => {
    window.location.assign(`${API_BASE}/auth/google`);
  }, []);

  const updateProfile = useCallback(async (change) => {
    const res = await api('/profile', { method: 'PATCH', body: change });
    if (res.status === 401) {
      setUser(null);
      setStatus('guest');
    }
    return accept(res);
  }, [accept, setUser]);

  const fetchStats = useCallback(async () => {
    const res = await api('/stats');
    if (!res.ok || !res.data.stats) return null;
    const { coins, gamesPlayed, gamesWon } = res.data.stats;
    setUser((u) => (u ? { ...u, coins, gamesPlayed, gamesWon } : u));
    return res.data.stats;
  }, [setUser]);

  // Short-lived token for the game connection (null for guests)
  const getSocketToken = useCallback(async () => {
    try {
      await readyRef.current;
    } catch {
      // ignore
    }
    if (!userRef.current) return null;
    const res = await api('/auth/token', { timeout: ME_TIMEOUT_MS });
    return res.ok && typeof res.data.token === 'string' ? res.data.token : null;
  }, []);

  // Ryō paid at the end of a game: keep the menu balance current
  const applyCoins = useCallback((total, won) => {
    if (!Number.isInteger(total)) return;
    setUser((u) => (u ? {
      ...u,
      coins: total,
      gamesPlayed: u.gamesPlayed + 1,
      gamesWon: u.gamesWon + (won ? 1 : 0),
    } : u));
  }, [setUser]);

  // ─── Shop: catalogue (everyone) + owned / equipped items (signed in) ───
  const [shop, setShop] = useState(null);
  const shopUserRef = useRef(undefined);
  const acceptShop = useCallback((data) => {
    if (!data || !Array.isArray(data.catalog)) return;
    setShop({
      catalog: data.catalog,
      signedIn: !!data.signedIn,
      owned: Array.isArray(data.owned) ? data.owned : [],
      equipped: data.equipped || {},
    });
    if (data.signedIn && Number.isInteger(data.coins)) setUser((u) => (u ? { ...u, coins: data.coins } : u));
  }, [setUser]);

  const loadShop = useCallback(async () => {
    const res = await api('/shop');
    if (res.ok) acceptShop(res.data);
    return res.ok;
  }, [acceptShop]);

  const shopAction = useCallback(async (path, body) => {
    const res = await api(path, { method: 'POST', body });
    if (res.status === 401) {
      setUser(null);
      setStatus((s) => (s === 'disabled' ? s : 'guest'));
    }
    if (res.ok) acceptShop(res.data);
    else if (Number.isInteger(res.data.coins)) setUser((u) => (u ? { ...u, coins: res.data.coins } : u));
    return res.ok ? { success: true, ...res.data } : { success: false, error: res.data.error || 'No se pudo completar. Inténtalo de nuevo.' };
  }, [acceptShop, setUser]);

  const buyItem = useCallback((itemId) => shopAction('/shop/buy', { itemId }), [shopAction]);
  const equipItem = useCallback((slot, itemId) => shopAction('/shop/equip', { slot, itemId }), [shopAction]);

  // The inventory belongs to an account: reload it when the account changes
  const shopUserId = status === 'loading' ? undefined : user ? user.id : null;
  useEffect(() => {
    if (shopUserId === undefined || shopUserRef.current === shopUserId) return;
    shopUserRef.current = shopUserId;
    loadShop();
  }, [shopUserId, loadShop]);

  const clearNotice = useCallback(() => setNotice(null), []);
  const currentUserId = useCallback(() => (userRef.current ? userRef.current.id : null), []);

  const value = useMemo(() => ({
    status,
    user,
    config,
    accountsEnabled: status !== 'disabled' && config?.accounts !== false,
    coinName: config?.coinName || 'Ryō',
    notice,
    clearNotice,
    setNotice,
    refresh,
    register,
    login,
    logout,
    loginWithGoogle,
    updateProfile,
    fetchStats,
    getSocketToken,
    currentUserId,
    applyCoins,
    shop,
    loadShop,
    buyItem,
    equipItem,
  }), [currentUserId, status, user, config, notice, clearNotice, refresh, register, login, logout, loginWithGoogle, updateProfile, fetchStats, getSocketToken, applyCoins, shop, loadShop, buyItem, equipItem]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
