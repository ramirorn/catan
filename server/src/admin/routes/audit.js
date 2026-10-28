// "Registro": the admin_actions audit log.
import { isUuid } from '../service.js';
import { pageOf } from './users.js';

const ACTION_RE = /^[a-z][a-z0-9.]{0,63}$/;

export function registerAuditRoutes(router, { store, handle }) {
  router.get('/actions', handle(async (req, res) => {
    const action = typeof req.query.action === 'string' && ACTION_RE.test(req.query.action) ? req.query.action : '';
    const adminId = isUuid(req.query.adminId) ? req.query.adminId : null;
    res.json(await store.listActions({ action, adminId, page: pageOf(req.query.page), pageSize: 50 }));
  }));

  router.get('/actions/meta', handle(async (req, res) => {
    res.json(await store.actionsMeta());
  }));
}
