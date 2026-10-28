// Admin panel API, mounted at /api/admin. Hidden on purpose: anything that
// is not a signed-in, active admin gets the same 404 as an unknown URL, so
// the panel's existence is never revealed.
//
// Layout (add new tabs as new route files with the same signature):
//   ./routes/live.js      Partidas + Avisos y mantenimiento (in-memory rooms)
//   ./routes/users.js     Usuarios (accounts in Postgres)
//   ./routes/insights.js  Estadísticas + Sistema
//   ./routes/audit.js     Registro (admin_actions)
// Each one exports `register(router, ctx)`; ctx is built below.
import express from 'express';
import { createRateLimiter } from '../accounts/rateLimit.js';
import { isAdminAccess } from './access.js';
import { AdminError, createAdminService } from './service.js';
import { createPgAdminStore } from './store.js';
import { registerLiveRoutes } from './routes/live.js';
import { registerUserRoutes } from './routes/users.js';
import { registerInsightRoutes } from './routes/insights.js';
import { registerAuditRoutes } from './routes/audit.js';

export const NOT_FOUND = { error: 'No encontrado' };
// Every admin request carries this header: a cross-site page cannot send it
// without a CORS preflight (which is never answered)
export const ADMIN_HEADER = 'x-catan-admin';

/**
 * Express middleware: req.admin = { id, displayName, email } for an active
 * admin, otherwise a plain 404. The role is read from the database on every
 * request (no cache), so a revoked admin loses access at once.
 */
export function createAdminGuard(accounts) {
  return async function requireAdmin(req, res, next) {
    try {
      if (!accounts || !accounts.enabled) return res.status(404).json(NOT_FOUND);
      if (req.get(ADMIN_HEADER) !== '1') return res.status(404).json(NOT_FOUND);
      const authUser = await accounts.sessionUser(req);
      if (!authUser || typeof authUser.id !== 'string') return res.status(404).json(NOT_FOUND);
      let access = await accounts.getAccess(authUser.id, { fresh: true });
      // ADMIN_EMAILS: promote on the spot (also done at every sign-in)
      const email = String(authUser.email || '').toLowerCase();
      if ((!access || access.role !== 'admin') && accounts.adminEmails && accounts.adminEmails.has(email)) {
        await accounts.ensureUser(authUser);
        access = await accounts.getAccess(authUser.id, { fresh: true });
      }
      if (!isAdminAccess(access)) return res.status(404).json(NOT_FOUND);
      req.admin = { id: access.id, displayName: access.displayName, email: access.email };
      next();
    } catch (err) {
      console.error('Admin auth check failed:', err.message);
      res.status(404).json(NOT_FOUND);
    }
  };
}

/**
 * `live` is the object returned by registerSocketHandlers, `settings` the
 * maintenance store (createSettings), `errorLog` { recentErrors, clearErrors }.
 * `store` can be injected (tests); by default it is the Postgres one.
 */
export function createAdmin({ accounts, live, settings, errorLog, store = null }) {
  const router = express.Router();
  const enabled = !!(accounts && accounts.enabled);
  const adminStore = store || (enabled ? createPgAdminStore(accounts.pool) : null);
  const service = adminStore ? createAdminService(adminStore) : null;
  const limit = createRateLimiter();

  router.use(express.json({ limit: '8kb' }));

  // Never cached, never framed, same origin only
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.get('origin');
      if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(404).json(NOT_FOUND);
    }
    next();
  });
  // Rate limits before the auth check (probing costs the same)
  router.use(limit('admin', 300, 60_000));
  router.use((req, res, next) => (req.method === 'GET' ? next() : limit('admin-write', 60, 60_000)(req, res, next)));
  router.use(createAdminGuard(accounts));

  // Records an admin action (live actions; DB writes log inside their own transaction)
  async function audit(req, action, targetType, targetId, details = {}) {
    if (!adminStore) return;
    try {
      await adminStore.logAction({ adminId: req.admin ? req.admin.id : null, action, targetType, targetId, details });
    } catch (err) {
      console.error(`Could not write the admin log (${action}):`, err.message);
    }
  }

  // Async handler wrapper: AdminError → its status, anything else → 500
  const handle = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof AdminError) return res.status(err.status).json({ error: err.message });
      console.error(`Admin ${req.method} ${req.path} failed:`, err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Error del servidor. Inténtalo de nuevo.' });
    }
  };

  const ctx = { accounts, live, settings, errorLog, store: adminStore, service, audit, handle };

  router.get('/me', (req, res) => {
    res.json({ admin: req.admin });
  });

  registerLiveRoutes(router, ctx);
  registerUserRoutes(router, ctx);
  registerInsightRoutes(router, ctx);
  registerAuditRoutes(router, ctx);

  router.use((req, res) => res.status(404).json(NOT_FOUND));

  /** Socket side: is this account an active admin right now? (DB, no cache) */
  async function isAdmin(userId) {
    if (!enabled || !userId) return false;
    return isAdminAccess(await accounts.getAccess(userId, { fresh: true }));
  }

  /** Socket side audit (observe a room) */
  function logSocketAction(adminId, action, targetType, targetId, details) {
    if (!adminStore) return;
    adminStore.logAction({ adminId, action, targetType, targetId, details }).catch((err) => {
      console.error(`Could not write the admin log (${action}):`, err.message);
    });
  }

  return { router, isAdmin, logSocketAction };
}
