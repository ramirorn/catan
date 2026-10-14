import express from 'express';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import cors from 'cors';
import { LobbyManager } from './lobby/LobbyManager.js';
import { registerSocketHandlers } from './socket/handlers.js';

const app = express();
app.use(cors());

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

// Register all socket event handlers
registerSocketHandlers(io, lobbyManager);

// Serve the built client (client/dist) when it exists, e.g. on Render
const clientDist = join(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Any other GET falls back to the app shell
  app.get(/^\/(?!socket\.io|health).*/, (req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
  console.log(`Serving client from ${clientDist}`);
}

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🎲 Catan server running on http://localhost:${PORT}`);
});
