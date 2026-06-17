import { createServer } from 'http';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { monitor } from '@colyseus/monitor';
import { MatchRoom } from './rooms/MatchRoom.js';

const port = Number(process.env.PORT ?? 2567);
const app = express();
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/colyseus', monitor());

const gameServer = new Server({
  transport: new WebSocketTransport({ server: createServer(app) }),
});

gameServer.define('match', MatchRoom);

gameServer.listen(port).then(() => {
  console.log(`[bbh] server listening on ws://localhost:${port}`);
  console.log(`[bbh] colyseus monitor on http://localhost:${port}/colyseus`);
});
