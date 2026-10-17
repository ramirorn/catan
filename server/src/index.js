import './env.js';
import express from 'express';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import { LobbyManager } from './lobby/LobbyManager.js';
import { registerSocketHandlers } from './socket/handlers.js';
import { createAccounts } from './accounts/index.js';

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
app.use('/api', accounts.router);
console.log(accounts.enabled ? 'Accounts enabled (Neon)' : 'Accounts disabled: set DATABASE_URL and NEON_AUTH_BASE_URL to enable them');

// Register all socket event handlers
registerSocketHandlers(io, lobbyManager, {}, accounts);

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
