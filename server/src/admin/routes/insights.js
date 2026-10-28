// "Estadísticas" and "Sistema".
import { summarizeRooms } from './live.js';

const STATS_TTL_MS = 60_000;
const STARTED_AT = Date.now();

export function registerInsightRoutes(router, { live, settings, store, errorLog, audit, handle }) {
  let statsCache = null; // { at, data }

  router.get('/stats', handle(async (req, res) => {
    const fresh = req.query.fresh === '1';
    if (!statsCache || fresh || Date.now() - statsCache.at > STATS_TTL_MS) {
      statsCache = { at: Date.now(), data: await store.stats() };
    }
    const rooms = live.liveRooms();
    const boardsLive = { standard: 0, extended: 0 };
    for (const r of rooms) boardsLive[r.boardType === 'extended' ? 'extended' : 'standard'] += 1;
    res.json({
      cachedAt: statsCache.at,
      db: statsCache.data,
      live: {
        connections: live.connections(),
        rooms: summarizeRooms(rooms),
        boards: boardsLive,
        counters: live.counters(),
      },
    });
  }));

  router.get('/system', handle(async (req, res) => {
    let db = { ok: false, latencyMs: null, error: null };
    try {
      db = { ok: true, latencyMs: Math.round((await store.ping()) * 10) / 10, error: null };
    } catch (err) {
      db = { ok: false, latencyMs: null, error: err.message };
    }
    const mem = process.memoryUsage();
    res.json({
      startedAt: STARTED_AT,
      uptimeS: Math.round(process.uptime()),
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal, external: mem.external },
      db,
      rooms: summarizeRooms(live.liveRooms()),
      connections: live.connections(),
      maintenance: settings.getMaintenance(),
      errors: errorLog.recentErrors(),
    });
  }));

  router.post('/system/errors/clear', handle(async (req, res) => {
    errorLog.clearErrors();
    await audit(req, 'system.errors.clear', 'server', null, {});
    res.json({ success: true });
  }));
}
