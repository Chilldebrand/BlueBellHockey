import { existsSync } from "fs";
import { createServer } from "http";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { getArcadeCoreInfo } from "@bbh/arcade-core";
import { Server } from "colyseus";
import express from "express";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ArcadeRoom } from "./rooms/ArcadeRoom.js";

export interface ArcadeServerInfo {
  readonly name: string;
  readonly coreVersion: string;
}

export function getArcadeServerInfo(): ArcadeServerInfo {
  const coreInfo = getArcadeCoreInfo();

  return {
    name: "@bbh/arcade-server",
    coreVersion: coreInfo.version
  };
}

export function registerArcadeRooms(gameServer: Server): Server {
  gameServer
    .define("arcade", ArcadeRoom)
    .filterBy(["privateCode", "mode"]);
  return gameServer;
}

export { ArcadeRoom };

export function createArcadeServer(): { readonly app: express.Express; readonly gameServer: Server } {
  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // Serve the built client from the same origin when it exists (same depth
  // from src/ via tsx and from dist/ when compiled). One host serves page AND
  // websocket, so a single tunnel — or a single deploy — is enough, and the
  // client build's wss URL matches the page origin. Matchmake/health routes
  // are excluded from the SPA fallback (and matchmaking is POST anyway).
  const clientDist = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../arcade-client/dist"
  );
  if (existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^\/(?!matchmake|health).*/, (_req, res) =>
      res.sendFile(resolve(clientDist, "index.html"))
    );
  }

  const httpServer = createServer(app);
  const gameServer = registerArcadeRooms(
    new Server({
      transport: new WebSocketTransport({
        server: httpServer,
        // permessage-deflate, negotiated per client — a client that doesn't offer it just gets the
        // uncompressed stream, so this is backward compatible by construction.
        //
        // The in-play world snapshot is ~5.5 KiB of msgpack at 31.25/s per client — ~1.4 Mbit/s
        // each, ~8.4 Mbit/s for a six-human room (measured: scripts/measure-snapshot-bandwidth.ts).
        // Per-message deflate takes 80% of that off, and context takeover does better still,
        // because consecutive snapshots are near-identical and stay in the sliding window. On a
        // self-hosted uplink that's the difference between rooms fitting comfortably and
        // saturating — and uplink saturation presents as exactly the jitter players report as lag.
        perMessageDeflate: {
          // Level 1 keeps the deflate cost trivial at this message rate; the redundancy between
          // consecutive snapshots does most of the work regardless of level.
          zlibDeflateOptions: { level: 1, memLevel: 8 },
          // Tiny messages (acks, pongs, lobby chatter) aren't worth a deflate round trip.
          threshold: 512,
          concurrencyLimit: 10
        }
      })
    })
  );

  return { app, gameServer };
}

function isMainModule(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const serverInfo = getArcadeServerInfo();
  // 2567 everywhere: matches the client's DEFAULT_WS_URL and .claude/launch.json
  // so both `npm run dev` and the preview launcher agree.
  const port = Number(process.env.PORT ?? 2567);
  const { gameServer } = createArcadeServer();

  void gameServer.listen(port).then(() => {
    console.log(`${serverInfo.name} listening on ws://localhost:${port}`);
    console.log(`${serverInfo.name} ready with core ${serverInfo.coreVersion}`);
  });
}
