/**
 * Measures what a live in-play snapshot actually costs on the wire, and what deflate would save.
 *
 * Boots the real server, joins one client into a private room (bots fill the rest), starts the
 * match, feeds some movement so the world isn't artificially static, then captures in-play
 * `server.worldSnapshot` messages and encodes each with @colyseus/msgpackr — the exact encoder the
 * transport uses — before running zlib.deflateRawSync over it, which is what permessage-deflate
 * does per message.
 *
 * The deflate numbers here are a LOWER BOUND on the real win: permessage-deflate keeps its
 * compression context across messages by default, and consecutive snapshots are near-identical, so
 * the sliding window works even harder in production than in this per-message measurement.
 *
 *   npx tsx scripts/measure-snapshot-bandwidth.ts   (from packages/arcade-server)
 */
import { deflateRawSync } from "node:zlib";
import { pack } from "@colyseus/msgpackr";
import { Client } from "colyseus.js";
import { createArcadeServer } from "../src/index.js";
import type { ServerWorldSnapshotMessage } from "@bbh/arcade-core";

const PORT = 2598;
const CODE = "MEASUR";
const CAPTURE_TARGET = 120;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function kib(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

async function main(): Promise<void> {
  const { gameServer } = createArcadeServer();
  await gameServer.listen(PORT);

  const client = new Client(`ws://localhost:${PORT}`);
  const room = await client.create("arcade", {
    mode: "arcade3v3",
    privateCode: CODE,
    quickMatch: false,
    playerName: "measure"
  });

  const raw: number[] = [];
  const deflated: number[] = [];
  const eventQueueShare: number[] = [];
  let playing = false;

  room.onMessage("server.worldSnapshot", (message: ServerWorldSnapshotMessage) => {
    if (!playing && message.world.phase === "playing") {
      playing = true;
    }
    if (!playing || raw.length >= CAPTURE_TARGET) {
      return;
    }

    const encoded = pack(message);
    raw.push(encoded.byteLength);
    deflated.push(deflateRawSync(encoded).byteLength);

    // How much of the packet is the retained event queue, re-sent every snapshot.
    const withoutQueue = pack({ ...message, world: { ...message.world, eventQueue: [] } });
    eventQueueShare.push(1 - withoutQueue.byteLength / encoded.byteLength);
  });
  room.onMessage("server.error", (message: unknown) => {
    console.error("server.error:", message);
  });

  await wait(400);
  room.send("client.setReady", { ready: true });
  await wait(200);
  room.send("client.requestStart");

  // Feed real movement once playing so skaters/puck are in motion — a static faceoff world
  // compresses unrealistically well.
  let sequence = 0;
  const inputTimer = setInterval(() => {
    if (!playing) {
      return;
    }
    sequence += 1;
    room.send("client.input", {
      type: "client.input",
      frame: {
        playerId: "measure",
        slotId: "home-skater-1",
        sequence,
        moveX: Math.sin(sequence / 20),
        moveY: Math.cos(sequence / 20),
        stickX: 0,
        stickY: 0,
        pass: false,
        check: false,
        turbo: sequence % 60 < 30,
        switchTarget: false
      }
    });
  }, 16);

  const deadline = Date.now() + 30_000;
  while (raw.length < CAPTURE_TARGET && Date.now() < deadline) {
    await wait(250);
  }
  clearInterval(inputTimer);

  if (raw.length === 0) {
    throw new Error("no in-play snapshots captured — did the match start?");
  }

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanRaw = mean(raw);
  const meanDeflated = mean(deflated);
  const perClientRawMbps = (meanRaw * 31.25 * 8) / 1_000_000;
  const perClientDeflatedMbps = (meanDeflated * 31.25 * 8) / 1_000_000;

  console.log(`captured ${raw.length} in-play snapshots (msgpackr-encoded, as the wire sends them)`);
  console.log(`  raw:      mean ${kib(meanRaw)}  -> ${perClientRawMbps.toFixed(2)} Mbit/s per client at 31.25/s`);
  console.log(`  deflated: mean ${kib(meanDeflated)}  -> ${perClientDeflatedMbps.toFixed(2)} Mbit/s per client`);
  console.log(`  ratio:    ${(100 * (1 - meanDeflated / meanRaw)).toFixed(1)}% smaller (per-message; context takeover does better)`);
  console.log(`  eventQueue share of packet: mean ${(100 * mean(eventQueueShare)).toFixed(1)}%`);
  console.log(`  six-client room: raw ${(6 * perClientRawMbps).toFixed(1)} Mbit/s -> deflated ${(6 * perClientDeflatedMbps).toFixed(1)} Mbit/s`);

  await room.leave();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
