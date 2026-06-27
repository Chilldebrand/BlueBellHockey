import { createServer } from "http";
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

  const httpServer = createServer(app);
  const gameServer = registerArcadeRooms(
    new Server({
      transport: new WebSocketTransport({ server: httpServer })
    })
  );

  return { app, gameServer };
}

function isMainModule(): boolean {
  return process.argv[1] === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const serverInfo = getArcadeServerInfo();
  const port = Number(process.env.PORT ?? 2568);
  const { gameServer } = createArcadeServer();

  void gameServer.listen(port).then(() => {
    console.log(`${serverInfo.name} listening on ws://localhost:${port}`);
    console.log(`${serverInfo.name} ready with core ${serverInfo.coreVersion}`);
  });
}
