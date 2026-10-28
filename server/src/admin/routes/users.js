// "Usuarios": search, detail and moderation of accounts (Postgres).
import { publicCatalog } from '../../shop/catalog.js';
import { blockedMessage } from '../access.js';
import { AdminError, isUuid } from '../service.js';

const PAGE_SIZE = 25;
const ROLES = ['', 'player', 'admin'];
const STATUSES = ['', 'active', 'suspended', 'banned'];

export function pageOf(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

export function registerUserRoutes(router, { accounts, live, store, service, handle }) {
  const userId = (req) => {
    if (!isUuid(req.params.id)) throw new AdminError(404, 'No existe esa cuenta');
    return req.params.id.toLowerCase();
  };

  router.get('/users', handle(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const role = ROLES.includes(req.query.role) ? req.query.role : '';
    const status = STATUSES.includes(req.query.status) ? req.query.status : '';
    res.json(await store.searchUsers({ q, role, status, page: pageOf(req.query.page), pageSize: PAGE_SIZE }));
  }));

  router.get('/users/:id', handle(async (req, res) => {
    const id = userId(req);
    const user = await store.userDetail(id);
    if (!user) throw new AdminError(404, 'No existe esa cuenta');
    res.json({ user: { ...user, liveSeats: live.roomsOfAccount(id) } });
  }));

  router.get('/catalog', (req, res) => {
    res.json({ items: publicCatalog().filter((i) => !i.isDefault) });
  });

  router.post('/users/:id/coins', handle(async (req, res) => {
    const { delta, reason } = req.body || {};
    res.json({ success: true, ...(await service.adjustCoins(req.admin.id, userId(req), delta, reason)) });
  }));

  router.post('/users/:id/gift', handle(async (req, res) => {
    const { itemId, reason } = req.body || {};
    res.json({ success: true, ...(await service.giftItem(req.admin.id, userId(req), itemId, reason)) });
  }));

  router.post('/users/:id/status', handle(async (req, res) => {
    const id = userId(req);
    const { action, until, reason } = req.body || {};
    const result = await service.setStatus(req.admin.id, id, { action, until, reason });
    accounts.invalidateAccess(id);
    let kicked = null;
    if (result.status !== 'active') {
      // Out of every seat now, and their sockets become guests
      const message = blockedMessage({ status: result.status, suspendedUntil: result.until, banReason: result.reason });
      kicked = live.kickAccount(id, message);
    }
    res.json({ success: true, ...result, kicked });
  }));

  router.post('/users/:id/rename', handle(async (req, res) => {
    const { displayName, reason } = req.body || {};
    res.json({ success: true, ...(await service.rename(req.admin.id, userId(req), displayName, reason)) });
  }));

  router.post('/users/:id/role', handle(async (req, res) => {
    const id = userId(req);
    const { role } = req.body || {};
    const result = await service.setRole(req.admin.id, id, role);
    accounts.invalidateAccess(id);
    res.json({ success: true, ...result });
  }));
}
