// Accounts: REST API under /api, socket token check and the Ryō award at the
// end of a game. Everything degrades gracefully without DATABASE_URL /
// NEON_AUTH_BASE_URL: the API answers "accounts disabled" and guests play
// exactly as before.
import express from 'express';
import { getPool } from '../db/pool.js';
import { createNeonAuth } from './neonAuth.js';
import { createRateLimiter } from './rateLimit.js';
import { COIN_NAME, computeRewards } from './rewards.js';
import { cleanDisplayName, ensureUser, getAccess, getLeaderboard, getStats, getUser, recordGame, updateProfile } from './store.js';
import { blockedMessage, isAdminAccess, parseAdminEmails } from '../admin/access.js';
import { createShopService, ShopError } from '../shop/service.js';
import { createPgShopStore } from '../shop/store.js';
import { DEFAULT_ITEMS } from '../shop/catalog.js';
import { createRuntime } from '../admin/runtime.js';

const DISABLED_MESSAGE = 'Las cuentas no están disponibles en este servidor. Puedes jugar como invitado.';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
// Neon Auth cookies we clear on logout even if the upstream call fails
const CLEAR_COOKIES = ['session_token', 'session_data', 'dont_remember', 'session_challenge', 'session_challange']
  .map((n) => `__Secure-neon-auth.${n}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);

function isAvatarId(v) {
  return Number.isInteger(v) && v >= 0 && v < 12;
}

// Friendly Spanish messages for Neon Auth error codes
function authErrorMessage(res) {
  const code = res.data && res.data.code;
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD':
    case 'CREDENTIAL_ACCOUNT_NOT_FOUND':
      return 'Correo o contraseña incorrectos';
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return 'Ya existe una cuenta con ese correo. Inicia sesión.';
    case 'PASSWORD_TOO_SHORT':
      return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres`;
    case 'PASSWORD_TOO_LONG':
      return 'La contraseña es demasiado larga';
    case 'INVALID_EMAIL':
      return 'Ese correo no es válido';
    case 'INVALID_ORIGIN':
      return 'Este sitio todavía no está autorizado para iniciar sesión (falta agregar el dominio en Neon Auth)';
    case 'USER_BANNED':
      return 'Esta cuenta está bloqueada';
    default:
      if (res.status === 429) return 'Demasiados intentos. Espera un momento y vuelve a probar.';
      return 'No se pudo completar. Inténtalo de nuevo.';
  }
}

// `runtime` (optional): live admin settings (admin/runtime.js) — reward rules,
// shop overrides, banned words, weekly ranking reset. One is created when
// not given.
export function createAccounts(env = process.env, { runtime: givenRuntime = null } = {}) {
  const enabled = !!(env.DATABASE_URL && env.NEON_AUTH_BASE_URL);
  const pool = enabled ? getPool() : null;
  const auth = enabled ? createNeonAuth(env.NEON_AUTH_BASE_URL) : null;
  const limit = createRateLimiter();
  const router = express.Router();
  const runtime = givenRuntime || createRuntime({ pool });
  // Admins own the admin-only items (role checked through the access cache)
  const shop = createShopService(enabled ? createPgShopStore(pool) : null, {
    pricing: runtime,
    isAdmin: async (userId) => isAdminAccess(await loadAccess(userId)),
  });
  // Display names go through the banned-words filter too
  const cleanName = (value) => {
    const name = cleanDisplayName(value);
    return name ? cleanDisplayName(runtime.filterText(name).text) : '';
  };
  // Current Ryō rules as shown to players
  const rewardInfo = () => {
    const r = runtime.getRewardRules();
    return { finish: r.finish, win: r.win, perVp: r.perVp, minVoteMinutes: r.minVoteMinutes };
  };
  // ADMIN_EMAILS: accounts that become admins when they sign in
  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);
  const ensure = (authUser, opts = {}) => ensureUser(pool, authUser, { ...opts, adminEmails });

  // Role / moderation status of an account, cached a few seconds (every
  // socket connection and API call checks it). Admin actions call
  // invalidateAccess so a ban applies at once.
  const ACCESS_TTL_MS = 10_000;
  const accessCache = new Map(); // userId → { access, at }
  async function loadAccess(userId, { fresh = false } = {}) {
    if (!enabled || !userId) return null;
    const hit = accessCache.get(userId);
    if (!fresh && hit && Date.now() - hit.at < ACCESS_TTL_MS) return hit.access;
    const access = await getAccess(pool, userId);
    if (accessCache.size >= 2000) accessCache.delete(accessCache.keys().next().value);
    accessCache.set(userId, { access, at: Date.now() });
    return access;
  }
  const invalidateAccess = (userId) => {
    if (userId) accessCache.delete(userId);
    else accessCache.clear();
  };
  // Spanish message when the account may not play (null = fine). A database
  // hiccup never locks anyone out.
  async function accountBlock(userId) {
    try {
      return blockedMessage(await loadAccess(userId));
    } catch (err) {
      console.warn('Could not check the account status:', err.message);
      return null;
    }
  }

  // Our own origin as the browser sees it (Render terminates https: trust proxy)
  const originOf = (req) => `${req.protocol}://${req.get('host')}`;

  router.use(express.json({ limit: '8kb' }));

  // Same-origin only: no CORS headers are ever sent, and state-changing
  // requests coming from another site are refused
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.get('origin');
      if (origin && origin !== originOf(req)) return res.status(403).json({ error: 'Origen no permitido' });
    }
    next();
  });

  router.get('/config', (req, res) => {
    res.json({
      accounts: enabled,
      google: enabled,
      message: enabled ? null : DISABLED_MESSAGE,
      coinName: COIN_NAME,
      rewards: rewardInfo(),
    });
  });

  // ─── Shop catalogue: open to everyone (guests see it, signed-in users also
  // get what they own and wear) ───
  router.get('/shop', limit('shop', 60, 60_000), async (req, res) => {
    let userId = null;
    try {
      if (enabled && auth.sessionToken(req.get('cookie'))) {
        const authUser = await auth.getSessionUser(req.get('cookie'), originOf(req));
        if (authUser) userId = authUser.id;
      }
      res.json({ ...(await shop.view(userId)), rewards: rewardInfo() });
    } catch (err) {
      console.error('API GET /shop failed:', err.message);
      // The catalogue itself never depends on the database
      if (!res.headersSent) res.json({ ...(await shop.view(null)), error: 'No se pudo cargar tu inventario' });
    }
  });

  // Everything below needs accounts
  router.use((req, res, next) => {
    if (!enabled) return res.status(503).json({ error: DISABLED_MESSAGE, disabled: true });
    next();
  });

  const sendCookies = (res, cookies) => {
    for (const c of cookies || []) res.append('Set-Cookie', c);
  };

  // Wraps async handlers: upstream / database errors become a clean 5xx
  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(`API ${req.method} ${req.path} failed:`, err.message);
      if (!res.headersSent) res.status(502).json({ error: 'El servidor de cuentas no responde. Inténtalo en un momento.' });
    }
  };

  async function currentUser(req) {
    const authUser = await auth.getSessionUser(req.get('cookie'), originOf(req));
    if (!authUser) return null;
    // Suspended / banned accounts are signed out everywhere
    if (await accountBlock(authUser.id)) return null;
    return { authUser };
  }

  // ─── Session ───
  router.get('/me', limit('me', 60, 60_000), handle(async (req, res) => {
    const cookie = req.get('cookie');
    if (!auth.sessionToken(cookie)) return res.json({ user: null });
    // Uncached on purpose: Neon Auth may extend the session and re-set its cookie
    const r = await auth.call('get-session', { cookie, origin: originOf(req) });
    sendCookies(res, r.cookies);
    if (!r.ok || !r.data || !r.data.user) return res.json({ user: null });
    let user;
    try {
      user = await ensure(r.data.user);
    } catch (err) {
      // Signed in, but our database is slow to wake: tell the client to retry
      // instead of making it look signed out
      console.warn('ensureUser failed in /me:', err.message);
      return res.status(503).json({ user: null, retry: true });
    }
    const blocked = await accountBlock(user.id);
    if (blocked) {
      auth.forgetSession(cookie);
      sendCookies(res, CLEAR_COOKIES);
      return res.json({ user: null, blocked });
    }
    res.json({ user });
  }));

  // Short-lived JWT for the socket connection (verified by the game server)
  router.get('/auth/token', limit('token', 60, 60_000), handle(async (req, res) => {
    const cookie = req.get('cookie');
    if (!auth.sessionToken(cookie)) return res.json({ token: null });
    const authUser = await auth.getSessionUser(cookie, originOf(req));
    if (authUser && (await accountBlock(authUser.id))) return res.json({ token: null });
    const r = await auth.call('token', { cookie, origin: originOf(req) });
    res.json({ token: r.ok && r.data && typeof r.data.token === 'string' ? r.data.token : null });
  }));

  router.post('/auth/register', limit('register', 5, 15 * 60_000), handle(async (req, res) => {
    const { email, password, displayName, avatarId } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const name = cleanName(displayName);
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) return res.status(400).json({ error: 'Escribe un correo válido' });
    if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
      return res.status(400).json({ error: `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres` });
    }
    if (password.length > PASSWORD_MAX) return res.status(400).json({ error: 'La contraseña es demasiado larga' });
    if (!name) return res.status(400).json({ error: 'Escribe tu nombre de ninja' });

    const r = await auth.call('sign-up/email', {
      method: 'POST',
      origin: originOf(req),
      body: { email: cleanEmail, password, name },
    });
    if (!r.ok || !r.data || !r.data.user) return res.status(r.status >= 500 ? 502 : 400).json({ error: authErrorMessage(r) });
    sendCookies(res, r.cookies);
    const user = await ensure(r.data.user, { avatarId: isAvatarId(avatarId) ? avatarId : undefined });
    res.json({ user });
  }));

  router.post('/auth/login', limit('login', 10, 10 * 60_000), handle(async (req, res) => {
    const { email, password, avatarId } = req.body || {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(cleanEmail) || typeof password !== 'string' || !password || password.length > PASSWORD_MAX) {
      return res.status(400).json({ error: 'Correo o contraseña incorrectos' });
    }
    const r = await auth.call('sign-in/email', {
      method: 'POST',
      origin: originOf(req),
      body: { email: cleanEmail, password, rememberMe: true },
    });
    if (!r.ok || !r.data || !r.data.user) return res.status(r.status >= 500 ? 502 : 401).json({ error: authErrorMessage(r) });
    const user = await ensure(r.data.user, { avatarId: isAvatarId(avatarId) ? avatarId : undefined });
    // A suspended / banned account gets no session cookie (stays a guest)
    const blocked = await accountBlock(user.id);
    if (blocked) return res.status(403).json({ error: blocked, blocked: true });
    sendCookies(res, r.cookies);
    res.json({ user });
  }));

  router.post('/auth/logout', limit('logout', 20, 60_000), handle(async (req, res) => {
    const cookie = req.get('cookie');
    auth.forgetSession(cookie);
    let cookies = [];
    if (auth.sessionToken(cookie)) {
      try {
        const r = await auth.call('sign-out', { method: 'POST', cookie, origin: originOf(req), body: {} });
        cookies = r.cookies;
      } catch (err) {
        console.warn('Neon Auth sign-out failed:', err.message);
      }
    }
    sendCookies(res, cookies.length ? cookies : CLEAR_COOKIES);
    res.json({ success: true });
  }));

  // "Continuar con Google": a plain link. Neon Auth runs the Google flow and
  // comes back to /api/auth/callback with a one-time verifier.
  router.get('/auth/google', limit('google', 20, 10 * 60_000), handle(async (req, res) => {
    const origin = originOf(req);
    const r = await auth.call('sign-in/social', {
      method: 'POST',
      origin,
      body: {
        provider: 'google',
        callbackURL: `${origin}/api/auth/callback`,
        // Without this, a brand-new account is sent back to "/" and its session
        // verifier is never exchanged (the user had to sign in a second time)
        newUserCallbackURL: `${origin}/api/auth/callback`,
        errorCallbackURL: `${origin}/api/auth/callback?error=1`,
        disableRedirect: true,
      },
    });
    const url = r.ok && r.data && typeof r.data.url === 'string' ? r.data.url : null;
    if (!url || !/^https:\/\//.test(url)) {
      console.warn('Google sign-in could not start:', r.status, r.data && r.data.code);
      return res.redirect(302, '/?login=error');
    }
    sendCookies(res, r.cookies);
    res.redirect(302, url);
  }));

  router.get('/auth/callback', limit('callback', 20, 10 * 60_000), handle(async (req, res) => {
    const verifier = typeof req.query.neon_auth_session_verifier === 'string' ? req.query.neon_auth_session_verifier : '';
    if (req.query.error || !verifier || verifier.length > 512) return res.redirect(302, '/?login=error');
    // A brand-new Google account can take a moment to be ready upstream, so
    // the one-time verifier exchange is retried a couple of times
    let r = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise((done) => setTimeout(done, 700 * attempt));
      r = await auth.call('get-session', {
        cookie: req.get('cookie'),
        origin: originOf(req),
        query: { neon_auth_session_verifier: verifier },
      });
      if (r.ok && r.data && r.data.user) break;
    }
    if (!r || !r.ok || !r.data || !r.data.user) {
      console.warn('Google callback: no session after the verifier exchange', r && r.status);
      return res.redirect(302, '/?login=error');
    }
    // A slow database must not undo the sign-in (the profile row is created
    // on the next /me anyway)
    try {
      await ensure(r.data.user);
    } catch (err) {
      console.warn('ensureUser failed in the Google callback:', err.message);
    }
    if (await accountBlock(r.data.user.id)) return res.redirect(302, '/?login=blocked');
    sendCookies(res, r.cookies);
    res.redirect(302, '/?login=google');
  }));

  // ─── Profile & stats ───
  router.patch('/profile', limit('profile', 30, 60_000), handle(async (req, res) => {
    const session = await currentUser(req);
    if (!session) return res.status(401).json({ error: 'Inicia sesión primero' });
    const { displayName, avatarId } = req.body || {};
    const change = {};
    if (displayName !== undefined) {
      const name = cleanName(displayName);
      if (!name) return res.status(400).json({ error: 'Escribe tu nombre de ninja' });
      change.displayName = name;
    }
    if (avatarId !== undefined) {
      if (!isAvatarId(avatarId)) return res.status(400).json({ error: 'Avatar no válido' });
      change.avatarId = avatarId;
    }
    await ensure(session.authUser);
    const user = await updateProfile(pool, session.authUser.id, change);
    res.json({ user });
  }));

  router.get('/stats', limit('stats', 30, 60_000), handle(async (req, res) => {
    const session = await currentUser(req);
    if (!session) return res.status(401).json({ error: 'Inicia sesión primero' });
    const stats = await getStats(pool, session.authUser.id);
    res.json({ stats });
  }));

  // ─── Ranking (public): most wins, all time and this week ───
  // The shared top list is cached for a minute so the menu never hammers the
  // database; the caller's own position is a cheap extra query.
  const LEADERBOARD_TTL_MS = 60_000;
  const leaderboardCache = new Map(); // period → { at, rows }
  const invalidateLeaderboard = () => leaderboardCache.clear();
  const boardOpts = (extra) => ({ ...extra, weekResetAt: runtime.getWeekResetAt() });
  router.get('/leaderboard', limit('leaderboard', 30, 60_000), handle(async (req, res) => {
    const period = req.query.period === 'week' ? 'week' : 'all';
    const session = await currentUser(req).catch(() => null);
    const userId = session ? session.authUser.id : null;
    const hit = leaderboardCache.get(period);
    if (hit && Date.now() - hit.at < LEADERBOARD_TTL_MS) {
      const me = userId ? (hit.rows.find((r) => r.userId === userId) || (await getLeaderboard(pool, period, boardOpts({ limit: 0, userId }))).me) : null;
      return res.json({ period, rows: hit.rows, me });
    }
    const board = await getLeaderboard(pool, period, boardOpts({ limit: 20, userId }));
    leaderboardCache.set(period, { at: Date.now(), rows: board.rows });
    res.json({ period, rows: board.rows, me: board.me });
  }));

  // ─── Shop: buy / equip (signed in only) ───
  const shopHandle = (fn) => handle(async (req, res) => {
    const session = await currentUser(req);
    if (!session) return res.status(401).json({ error: 'Inicia sesión para comprar' });
    await ensure(session.authUser);
    try {
      await fn(req, res, session.authUser.id);
    } catch (err) {
      if (!(err instanceof ShopError)) throw err;
      res.status(err.status).json({ error: err.message, ...err.extra });
    }
  });

  router.post('/shop/buy', limit('shop-buy', 20, 60_000), shopHandle(async (req, res, userId) => {
    const { itemId, expectedPrice } = req.body || {};
    const result = await shop.buy(userId, itemId, expectedPrice);
    res.json({ ...result, ...(await shop.view(userId)) });
  }));

  router.post('/shop/equip', limit('shop-equip', 40, 60_000), shopHandle(async (req, res, userId) => {
    const { slot, itemId } = req.body || {};
    const result = await shop.equip(userId, slot, itemId);
    res.json({ ...result, ...(await shop.view(userId)) });
  }));

  router.use((req, res) => res.status(404).json({ error: 'No encontrado' }));

  // ─── Used by the socket layer ───
  async function verifySocketToken(token) {
    if (!enabled || !token) return null;
    return auth.verifyToken(token);
  }

  /**
   * Pays a finished game (called once per game by the socket layer). Returns
   * { eligible, reason, paid: [{ playerId, userId, coins, total }] }.
   */
  async function awardGame(summary) {
    const result = computeRewards(summary, runtime.getRewardRules());
    if (!enabled || !result.eligible || !result.awards.length) return { ...result, paid: [] };
    const rows = await recordGame(pool, summary, result.awards);
    const byUser = new Map(rows.map((r) => [r.userId, r]));
    const paid = result.awards
      .filter((a) => byUser.has(a.userId))
      .map((a) => ({ playerId: a.playerId, userId: a.userId, coins: byUser.get(a.userId).coins, total: byUser.get(a.userId).total }));
    return { ...result, paid };
  }

  // Equipped cosmetics of a seat ({ pieces, board }); defaults for guests or
  // when the database is not reachable (a game never waits on the shop)
  async function getLoadout(userId) {
    if (!enabled || !userId) return { ...DEFAULT_ITEMS };
    try {
      return await shop.loadout(userId);
    } catch (err) {
      console.warn('Could not load the equipped items:', err.message);
      return { ...DEFAULT_ITEMS };
    }
  }

  async function ownsItem(userId, itemId) {
    return shop.owns(enabled ? userId : null, itemId);
  }

  /** Signed-in Neon Auth user of a request (null when signed out) */
  async function sessionUser(req) {
    if (!enabled || !auth.sessionToken(req.get('cookie'))) return null;
    return auth.getSessionUser(req.get('cookie'), originOf(req));
  }

  return {
    enabled,
    router,
    pool,
    runtime,
    invalidateLeaderboard,
    leaderboard: (period, opts = {}) => getLeaderboard(pool, period, boardOpts(opts)),
    adminEmails,
    sessionUser,
    ensureUser: (authUser) => (enabled ? ensure(authUser) : null),
    getAccess: loadAccess,
    invalidateAccess,
    accountBlock: (userId) => (enabled && userId ? accountBlock(userId) : Promise.resolve(null)),
    verifySocketToken,
    awardGame,
    getLoadout,
    ownsItem,
    getUser: (id) => (enabled ? getUser(pool, id) : null),
  };
}
