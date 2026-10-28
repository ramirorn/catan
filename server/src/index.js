import './env.js';
import { installErrorLog, recentErrors, clearErrors } from './admin/errorLog.js';
import express from 'express';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { LobbyManager } from './lobby/LobbyManager.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { createAccounts } from './accounts/index.js';
import { createAdmin } from './admin/index.js';
import { createSettings } from './admin/settings.js';

// Last ~50 server errors for the admin "Sistema" tab
installErrorLog();

const app = express();
// Render (and other hosts) put a proxy in front: trust it for https / client IP
app.set('trust proxy', 1);
app.disable('x-powered-by');

const httpServer = createServer(app);
// In production the client is served from this same server (same origin, no
// CORS needed). CORS_ORIGIN (comma-separated) allows a client hosted elsewhere.
const devOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
const extraOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
const io = new Server(httpServer, {
  cors: {
    origin: [...devOrigins, ...extraOrigins],
    methods: ['GET', 'POST'],
  },
});

const lobbyManager = new LobbyManager();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: lobbyManager.listRooms().length });
});

// Accounts (Neon Postgres + Neon Auth): REST API under /api. Without
// DATABASE_URL / NEON_AUTH_BASE_URL it only answers "accounts disabled".
const accounts = createAccounts();
console.log(accounts.enabled ? 'Accounts enabled (Neon)' : 'Accounts disabled: set DATABASE_URL and NEON_AUTH_BASE_URL to enable them');

// Server-wide switches (maintenance mode), persisted when there is a database
const settings = createSettings({ pool: accounts.enabled ? accounts.pool : null });
settings.load();

// Register all socket event handlers. The admin panel is created right after
// (it needs the live-control API they return); the socket side reaches it
// through these late-bound callbacks.
let admin = null;
const live = registerSocketHandlers(io, lobbyManager, {}, accounts, {
  settings,
  isAdmin: (userId) => (admin ? admin.isAdmin(userId) : Promise.resolve(false)),
  onAdminAction: (...args) => admin && admin.logSocketAction(...args),
});
admin = createAdmin({ accounts, live, settings, errorLog: { recentErrors, clearErrors } });

// Hidden admin panel API (404 for everyone who is not an admin), then the
// public accounts API
app.use('/api/admin', admin.router);
app.use('/api', accounts.router);

// Serve the built client (client/dist) when it exists, e.g. on Render
const clientDist = join(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(clientDist)) {
  // Hashed build files (assets/*) never change: cache them for a year.
  // index.html, the service worker and the manifest must always be
  // revalidated so a new deploy is picked up.
  const noCache = /(?:^|[\\/])(?:index\.html|sw\.js|workbox-[\w-]+\.js|manifest\.webmanifest)$/;
  app.use(
    express.static(clientDist, {
      setHeaders(res, filePath) {
        if (noCache.test(filePath)) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (/[\\/]assets[\\/]/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        if (filePath.endsWith('.webmanifest')) {
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        }
      },
    }),
  );
  // Any other GET falls back to the app shell
  app.get(/^\/(?!socket\.io|health|api(?:\/|$)).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(clientDist, 'index.html'));
  });
  console.log(`Serving client from ${clientDist}`);
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🎲 Catan server running on http://localhost:${PORT}`);
});
