/**
 * Measures REAL wire bandwidth for a client during live play, compression included.
 *
 * Two colyseus.js clients: one drives the room (ready, start, continuous input against bot fill),
 * one sits in it passively and measures. The script pins colyseus.js to the `ws` implementation
 * (Node's native WebSocket hides its TCP socket), which both offers permessage-deflate by default
 * on the client side and exposes `_socket.bytesRead` — so the measurement compares actual TCP
 * bytes received against decompressed payload bytes delivered. That ratio is the true
 * permessage-deflate win with context takeover, the thing the offline per-message estimate in
 * measure-snapshot-bandwidth.ts can only lower-bound.
 *
 *   npx tsx scripts/measure-wire.ts   (from packages/arcade-server)
 */
import type { Socket } from "node:net";
import WebSocket from "ws";

// Must happen before colyseus.js loads: its transport captures globalThis.WebSocket at import
// time, and Node's built-in implementation neither exposes the socket nor negotiates deflate.
//
// Subclassed to keep the deflate OFFER (so server->client compression negotiates, which is the
// thing being measured) while never compressing this side's own sends. colyseus.js reuses one
// internal buffer across room.send() calls and hands ws a VIEW of it; `ws` queues that view for
// async deflate, so the next send overwrites it mid-compression and the server reads a corrupted
// frame. Browsers are immune — the WebSocket spec copies on send() — so this is a harness-only
// hazard (and one for anyone running a Node bot with colyseus.js + ws).
class NoSendCompressWebSocket extends WebSocket {
  constructor(url: string, opts?: object) {
    super(url, { ...opts, perMessageDeflate: { threshold: Number.MAX_SAFE_INTEGER } });
  }
}
(globalThis as { WebSocket?: unknown }).WebSocket = NoSendCompressWebSocket;

const { Client } = await import("colyseus.js");
const { createArcadeServer } = await import("../src/index.js");

const PORT = 2597;
const CODE = "WIRE01";
const MEASURE_SECONDS = 10;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WsInternals {
  connection: { transport: { ws: WebSocket & { _socket: Socket } } };
}

async function main(): Promise<void> {
  const { gameServer } = createArcadeServer();
  await gameServer.listen(PORT);

  const driver = new Client(`ws://localhost:${PORT}`);
  const driverRoom = await driver.create("arcade", {
    mode: "arcade3v3",
    privateCode: CODE,
    quickMatch: false,
    playerName: "driver"
  });
  let phase = "waiting";
  driverRoom.onMessage("server.worldSnapshot", (message: { world: { phase: string } }) => {
    phase = message.world.phase;
  });
  driverRoom.onMessage("server.error", (m: unknown) => console.error("server.error:", m));

  const measurerClient = new Client(`ws://localhost:${PORT}`);
  const measurerRoom = await measurerClient.join("arcade", {
    mode: "arcade3v3",
    privateCode: CODE,
    quickMatch: false,
    playerName: "wire"
  });
  measurerRoom.onMessage("server.worldSnapshot", () => {});
  measurerRoom.onMessage("server.error", () => {});

  const measurerWs = (measurerRoom as unknown as WsInternals).connection.transport.ws;
  let payloadBytes = 0;
  let messages = 0;
  measurerWs.on("message", (data: Buffer) => {
    payloadBytes += data.byteLength;
    messages += 1;
  });

  await wait(400);
  driverRoom.send("client.setReady", { ready: true });
  measurerRoom.send("client.setReady", { ready: true });
  await wait(200);
  driverRoom.send("client.requestStart");

  let sequence = 0;
  const inputTimer = setInterval(() => {
    if (phase !== "playing") {
      return;
    }
    sequence += 1;
    driverRoom.send("client.input", {
      type: "client.input",
      frame: {
        playerId: "driver",
        slotId: "home-skater-1",
        sequence,
        moveX: Math.sin(sequence / 20),
        moveY: Math.cos(sequence / 20),
        stickX: 0,
        stickY: 0,
        pass: sequence % 90 === 0,
        check: false,
        turbo: sequence % 60 < 30,
        switchTarget: false
      }
    });
  }, 16);

  const playingDeadline = Date.now() + 20_000;
  while (phase !== "playing" && Date.now() < playingDeadline) {
    await wait(100);
  }
  if (phase !== "playing") {
    throw new Error("match never started");
  }

  // Window the measurement to live play only: zero the counters once playing, then run the clock.
  const socket = measurerWs._socket;
  const wireStart = socket.bytesRead;
  payloadBytes = 0;
  messages = 0;
  await wait(MEASURE_SECONDS * 1000);

  const wireBytes = socket.bytesRead - wireStart;
  clearInterval(inputTimer);

  const extensions = (measurerWs as unknown as { extensions: Record<string, unknown> }).extensions;
  const wireMbps = (wireBytes * 8) / (MEASURE_SECONDS * 1_000_000);
  const payloadMbps = (payloadBytes * 8) / (MEASURE_SECONDS * 1_000_000);

  console.log(`extensions negotiated: ${JSON.stringify(extensions) || "(none)"}`);
  console.log(`in-play window: ${MEASURE_SECONDS}s, ${messages} messages`);
  console.log(`  payload (decompressed): ${(payloadBytes / 1024).toFixed(1)} KiB  = ${payloadMbps.toFixed(2)} Mbit/s`);
  console.log(`  wire (actual TCP):      ${(wireBytes / 1024).toFixed(1)} KiB  = ${wireMbps.toFixed(2)} Mbit/s`);
  console.log(`  wire/payload: ${((100 * wireBytes) / payloadBytes).toFixed(1)}%`);

  // Hard exit, deliberately no graceful leave: this is a measurement harness, the numbers are
  // already printed, and a wedged room-disposal await must not turn a finished run into a hang.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
