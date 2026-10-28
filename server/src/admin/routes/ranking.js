// "Ranking": the public leaderboards as players see them, exclusions of a
// game or of every result of an account, and the weekly reset.
//
// Weekly reset: app_settings 'ranking' = { weekResetAt }. The weekly query
// counts results from GREATEST(Monday 00:00 Argentina, weekResetAt), so a
// reset only empties the current week (next Monday it is irrelevant) and can
// be undone. The all-time ranking is never affected.
import { AdminError, isUuid, requireReason } from '../service.js';

const SCOPES = ['game', 'user'];

export function registerRankingRoutes(router, { accounts, runtime, economy, audit, handle }) {
  const requireDb = () => {
    if (!economy || !accounts || !accounts.enabled) throw new AdminError(503, 'El ranking necesita la base de datos');
  };
  const targetOf = (body) => {
    const scope = body && body.scope;
    if (!SCOPES.includes(scope)) throw new AdminError(400, 'Indica si es una partida o una cuenta');
    if (!isUuid(body.id)) throw new AdminError(404, scope === 'game' ? 'No existe esa partida' : 'No existe esa cuenta');
    return { scope, id: body.id.toLowerCase() };
  };

  router.get('/ranking', handle(async (req, res) => {
    requireDb();
    const period = req.query.period === 'week' ? 'week' : 'all';
    const [board, excluded] = await Promise.all([accounts.leaderboard(period, { limit: 50 }), economy.excludedList(30)]);
    res.json({ period, rows: board.rows, weekResetAt: runtime.getWeekResetAt(), excluded });
  }));

  router.get('/ranking/users/:id', handle(async (req, res) => {
    requireDb();
    if (!isUuid(req.params.id)) throw new AdminError(404, 'No existe esa cuenta');
    res.json({ results: await economy.userResults(req.params.id.toLowerCase()) });
  }));

  router.post('/ranking/exclude', handle(async (req, res) => {
    requireDb();
    const { scope, id } = targetOf(req.body);
    const reason = requireReason(req.body && req.body.reason);
    const r = await economy.setExcluded({ scope, id, excluded: true, reason }, {
      adminId: req.admin.id,
      action: `ranking.exclude.${scope}`,
      targetType: scope === 'game' ? 'game' : 'user',
      targetId: id,
      details: { reason },
    });
    if (r.status === 'none') throw new AdminError(404, 'No hay resultados para eso');
    accounts.invalidateLeaderboard();
    res.json({ success: true, changed: r.changed });
  }));

  router.post('/ranking/restore', handle(async (req, res) => {
    requireDb();
    const { scope, id } = targetOf(req.body);
    const r = await economy.setExcluded({ scope, id, excluded: false }, {
      adminId: req.admin.id,
      action: `ranking.restore.${scope}`,
      targetType: scope === 'game' ? 'game' : 'user',
      targetId: id,
      details: {},
    });
    if (r.status === 'none') throw new AdminError(404, 'No hay resultados para eso');
    accounts.invalidateLeaderboard();
    res.json({ success: true, changed: r.changed });
  }));

  router.post('/ranking/week/reset', handle(async (req, res) => {
    requireDb();
    const reason = requireReason(req.body && req.body.reason);
    const before = runtime.getWeekResetAt();
    const at = await runtime.setWeekResetAt(new Date().toISOString(), req.admin.id);
    accounts.invalidateLeaderboard();
    await audit(req, 'ranking.week.reset', 'server', null, { reason, weekResetAt: at, previous: before });
    res.json({ success: true, weekResetAt: at });
  }));

  router.post('/ranking/week/undo', handle(async (req, res) => {
    requireDb();
    const before = runtime.getWeekResetAt();
    if (!before) throw new AdminError(409, 'El ranking semanal no se reinició');
    await runtime.setWeekResetAt(null, req.admin.id);
    accounts.invalidateLeaderboard();
    await audit(req, 'ranking.week.undo', 'server', null, { previous: before });
    res.json({ success: true, weekResetAt: null });
  }));
}
