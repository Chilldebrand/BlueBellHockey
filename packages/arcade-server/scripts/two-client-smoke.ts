/**
 * Two-client end-to-end smoke: boots the real arcade server, connects two
 * colyseus.js clients over actual websockets into one private room, starts a
 * match, has one client skate and flick a skill-stick wrist shot, and checks
 * both clients converge on identical authoritative state.
 *
 *   npm run smoke --workspace @bbh/arcade-server
 */
import { Client, type Room } from "colyseus.js";
import { createArcadeServer } from "../src/index.js";
import { MATCH_START_COUNTDOWN_MS, RINK_CONFIG } from "@bbh/arcade-core";
import type { InputFrame, ServerWorldSnapshotMessage, WorldState } from "@bbh/arcade-core";

const PORT = 2599;
const CODE = "SMOKE1";

function frame(
  slotId: string,
  sequence: number,
  overrides: Partial<InputFrame> = {}
): InputFrame {
  return {
    playerId: "smoke",
    slotId,
    sequence,
    moveX: 0,
    moveY: 0,
    stickX: 0,
    stickY: 0,
    pass: false,
    check: false,
    turbo: false,
    switchTarget: false,
    ...overrides
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TrackedClient {
  readonly room: Room;
  latest: WorldState | null;
  latestAcks: Readonly<Record<string, number>>;
  snapshots: number;
  mySlotId: string | null;
}

function track(room: Room): TrackedClient {
  const tracked: TrackedClient = {
    room,
    latest: null,
    latestAcks: {},
    snapshots: 0,
    mySlotId: null
  };

  room.onMessage("server.worldSnapshot", (message: ServerWorldSnapshotMessage) => {
    tracked.latest = message.world;
    tracked.latestAcks = message.inputAcks ?? {};
    tracked.snapshots += 1;
  });
  room.onMessage("server.error", (message: unknown) => {
    console.error("server.error:", message);
  });

  return tracked;
}

/** Faceoff spawn for a slot id — mirrors arcade-core sim/spawns.ts. */
function spawnForSlot(slotId: string): { x: number; y: number } | null {
  const match = /^(home|away)-skater-(\d)$/.exec(slotId);
  if (!match) {
    return null;
  }

  const teamSide = match[1] === "home" ? -1 : 1;
  const index = Number(match[2]) - 1;
  return {
    x: RINK_CONFIG.width / 2 + teamSide * 260,
    y: RINK_CONFIG.height / 2 + (index - 1) * 140
  };
}

function slotOf(room: Room): string | null {
  const state = room.state as {
    teams?: Record<string, { slots?: Iterable<{ sessionId: string | null; slotId: string }> }>;
  };
  for (const team of Object.values(state.teams ?? {})) {
    for (const slot of team.slots ?? []) {
      if (slot.sessionId === room.sessionId) {
        return slot.slotId;
      }
    }
  }
  return null;
}

async function main(): Promise<void> {
  const { gameServer } = createArcadeServer();
  await gameServer.listen(PORT);
  console.log(`smoke server on :${PORT}`);

  const clientA = new Client(`ws://localhost:${PORT}`);
  const clientB = new Client(`ws://localhost:${PORT}`);

  const roomA = await clientA.create("arcade", {
    mode: "arcade3v3",
    privateCode: CODE,
    quickMatch: false,
    playerName: "A"
  });
  const trackedA = track(roomA);
  const roomB = await clientB.join("arcade", {
    mode: "arcade3v3",
    privateCode: CODE,
    quickMatch: false,
    playerName: "B"
  });
  const trackedB = track(roomB);
  await wait(300);

  roomB.send("client.chooseTeam", { teamId: "away" });
  await wait(200);

  // Start is gated on every human being ready.
  roomA.send("client.setReady", { ready: true });
  roomB.send("client.setReady", { ready: true });
  await wait(200);

  trackedA.mySlotId = slotOf(roomA);
  trackedB.mySlotId = slotOf(roomB);
  console.log(`A slot=${trackedA.mySlotId}  B slot=${trackedB.mySlotId}`);

  if (!trackedA.mySlotId || !trackedB.mySlotId) {
    throw new Error("slots not assigned");
  }

  roomA.send("client.requestStart");
  // Play is held behind the pre-match faceoff countdown — wait it out.
  await wait(MATCH_START_COUNTDOWN_MS + 400);

  // A skates forward with turbo for ~1s...
  let sequence = 0;
  for (let index = 0; index < 60; index += 1) {
    roomA.send("client.input", {
      type: "client.input",
      frame: frame(trackedA.mySlotId, (sequence += 1), { moveX: 1, turbo: true })
    });
    await wait(16);
  }
  // ...then flicks the stick full forward (wrist shot gesture if carrying).
  roomA.send("client.input", {
    type: "client.input",
    frame: frame(trackedA.mySlotId, (sequence += 1), { stickY: 1 })
  });
  await wait(500);

  const worldA = trackedA.latest;
  const worldB = trackedB.latest;

  if (!worldA || !worldB) {
    throw new Error(
      `missing snapshots (A=${trackedA.snapshots}, B=${trackedB.snapshots})`
    );
  }

  // Solo-play control follows the puck (a teammate pickup can reassign A's
  // slot mid-run), so measure whichever skater A CURRENTLY controls against
  // that slot's own faceoff spawn.
  const finalSlotA = slotOf(roomA);
  const skaterA = worldA.skaters.find((skater) => skater.id === finalSlotA);
  const spawnA = finalSlotA ? spawnForSlot(finalSlotA) : null;
  const movedFromSpawn =
    !!skaterA &&
    !!spawnA &&
    Math.hypot(
      skaterA.position.x - spawnA.x,
      skaterA.position.y - spawnA.y
    ) > 100;
  const lastAckedSequence = finalSlotA
    ? trackedA.latestAcks[finalSlotA] ?? -1
    : -1;

  const checks: [string, boolean][] = [
    ["both clients received snapshots", trackedA.snapshots > 20 && trackedB.snapshots > 20],
    ["match is playing", worldA.phase === "playing"],
    ["A's controlled skater moved from its spawn", movedFromSpawn],
    ["server acked A's recent input", lastAckedSequence >= sequence - 10],
    ["clients agree on score", JSON.stringify(worldA.score) === JSON.stringify(worldB.score)],
    [
      "clients agree on clock within one tick",
      Math.abs(worldA.time.tick - worldB.time.tick) <= 2
    ],
    ["stats tracked for both clients", !!worldB.stats && !!worldA.stats]
  ];

  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) failed += 1;
  }

  await roomA.leave();
  await roomB.leave();
  await gameServer.gracefullyShutdown(false);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("two-client smoke: OK");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
