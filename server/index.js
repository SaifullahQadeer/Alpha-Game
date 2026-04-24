/**
 * Neon Arena — Server entry
 * ------------------------------------------------------------
 * Express serves the static client.
 * Socket.io handles realtime multiplayer.
 * A single default GameRoom hosts the MVP match; multi-room
 * matchmaking is a trivial extension (see GameRoom comments).
 */
'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const GameRoom = require('./game/GameRoom');
const C = require('./game/constants');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Keep default JSON parser + allow same-origin (client served from here)
  cors: { origin: '*' },
  // Tune for low-latency games; defaults are fine, but reduce ping to 10s
  pingInterval: 10000,
  pingTimeout: 5000,
});

// --- Static client ------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'client'), {
  maxAge: '1h',
  extensions: ['html'],
}));

// Health check for ops / load balancers
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// --- Rooms --------------------------------------------------------------
// MVP: single global room. To scale: maintain a Map<roomId, GameRoom> and
// assign on join (least-loaded or matchmaker). Each room runs its own tick.
const defaultRoom = new GameRoom('arena-1', io);
defaultRoom.start();

// --- Socket lifecycle ---------------------------------------------------
io.on('connection', (socket) => {
  // eslint-disable-next-line no-console
  console.log(`[+] ${socket.id} connected (${io.engine.clientsCount} online)`);

  socket.on('joinGame', ({ name, characterId, mapId } = {}) => {
    const safeName = String(name || '').replace(/[^\w \-]/g, '').slice(0, 16) || `P-${socket.id.slice(0, 4)}`;
    const safeChar = C.CHARACTERS[characterId] ? characterId : C.DEFAULT_CHARACTER;
    const safeMap  = C.MAPS[mapId] ? mapId : undefined; // let room keep current if not provided
    defaultRoom.addPlayer(socket, safeName, safeChar, safeMap);
  });

  socket.on('disconnect', (reason) => {
    // eslint-disable-next-line no-console
    console.log(`[-] ${socket.id} disconnected (${reason})`);
    defaultRoom.removePlayer(socket.id);
  });
});

// --- Boot ---------------------------------------------------------------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`\n  NEON ARENA\n  http://localhost:${PORT}\n  tick=${C.TICK_RATE}Hz  map=${C.MAP_SIZE}m  maxHP=${C.MAX_HEALTH}\n`);
});
