import { describe, expect, it } from "vitest";
import {
  MATCH_CONFIG,
  bladeWorldPosition,
  createWorld,
  stepWorld,
  type InputFrame,
  type WorldState
} from "@bbh/arcade-core";
import {
  predictLocalState,
  pruneAcknowledgedFrames,
  pushInputFrame,
  smoothPredictedSkater
} from "./prediction.js";

const SLOT = "home-skater-1";
const TICK = MATCH_CONFIG.fixedTickMs;

function frame(sequence: number, overrides: Partial<InputFrame> = {}): InputFrame {
  return {
    playerId: "session-a",
    slotId: SLOT,
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

function serverWorld(): WorldState {
  const world = createWorld(42, "arcade3v3");
  world.phase = "playing";
  return world;
}

function snapshotOf(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}

describe("input-replay prediction", () => {
  it("converges to the authoritative result once every frame is applied", () => {
    // The "server" applies 40 movement frames tick by tick. The client, seeing
    // only a stale snapshot (as if ~150ms behind), replays its unacked frames
    // on top and must land exactly where the server does.
    const frames = Array.from({ length: 40 }, (_, index) =>
      frame(index + 1, { moveX: 1, moveY: index % 2 === 0 ? 0.3 : 0, turbo: true })
    );

    const server = serverWorld();
    let staleSnapshot: WorldState | null = null;
    const STALE_TICKS = 10; // ~160ms behind

    for (const [index, current] of frames.entries()) {
      if (index === frames.length - STALE_TICKS) {
        staleSnapshot = snapshotOf(server);
      }

      stepWorld(server, [current], TICK);
    }

    const unacked = frames.slice(frames.length - STALE_TICKS);
    const predicted = predictLocalState(staleSnapshot, SLOT, unacked);
    const authoritative = server.skaters.find((skater) => skater.id === SLOT);

    expect(predicted).not.toBeNull();
    expect(predicted?.skater.position.x).toBeCloseTo(
      authoritative?.position.x ?? Number.NaN,
      6
    );
    expect(predicted?.skater.position.y).toBeCloseTo(
      authoritative?.position.y ?? Number.NaN,
      6
    );
    expect(predicted?.skater.facing).toBeCloseTo(
      authoritative?.facing ?? Number.NaN,
      6
    );
  });

  it("predicts the carried puck through the tether (no blade lag)", () => {
    const world = serverWorld();
    world.puck.carrierSlotId = SLOT;
    world.puck.position = bladeWorldPosition(world.skaters[0]);
    const snapshot = snapshotOf(world);

    const unacked = Array.from({ length: 8 }, (_, index) =>
      frame(index + 1, { moveX: 1, turbo: true })
    );
    const predicted = predictLocalState(snapshot, SLOT, unacked);

    expect(predicted?.puck.carrierSlotId).toBe(SLOT);
    // The predicted puck moved forward with the predicted skater.
    expect(predicted?.puck.position.x).toBeGreaterThan(
      snapshot.puck.position.x + 10
    );
  });

  it("never double-fires a shot gesture across repeated re-predictions", () => {
    const world = serverWorld();
    world.puck.carrierSlotId = SLOT;
    world.puck.position = bladeWorldPosition(world.skaters[0]);
    const snapshot = snapshotOf(world);

    // Neutral then full-forward: a wrist flick in the unacked buffer.
    const unacked = [frame(1), frame(2, { stickY: 1 }), frame(3, { stickY: 1 })];

    // Re-predicting from the same snapshot (as happens every render) must
    // produce the same single release each time — clones never accumulate.
    const first = predictLocalState(snapshot, SLOT, unacked);
    const second = predictLocalState(snapshot, SLOT, unacked);

    expect(first?.puck.carrierSlotId).toBeNull();
    expect(first?.puck.shotBySlotId).toBe(SLOT);
    expect(JSON.stringify(second?.puck)).toBe(JSON.stringify(first?.puck));
    expect(snapshot.puck.carrierSlotId).toBe(SLOT); // input world untouched
  });

  it("prunes acknowledged frames and bounds the buffer", () => {
    const buffer: InputFrame[] = [];

    for (let sequence = 1; sequence <= 200; sequence += 1) {
      pushInputFrame(buffer, frame(sequence));
    }

    expect(buffer.length).toBeLessThanOrEqual(128);

    pruneAcknowledgedFrames(buffer, 190);
    expect(buffer[0]?.sequence).toBe(191);
    expect(buffer).toHaveLength(10);

    pruneAcknowledgedFrames(buffer, undefined);
    expect(buffer).toHaveLength(10);
  });

  it("blends small reconciliation errors and snaps large ones", () => {
    const world = serverWorld();
    const base = world.skaters[0];
    const nudged = {
      ...base,
      position: { x: base.position.x + 20, y: base.position.y }
    };
    const far = {
      ...base,
      position: { x: base.position.x + 500, y: base.position.y }
    };

    const blended = smoothPredictedSkater(base, nudged);
    expect(blended.position.x).toBeGreaterThan(base.position.x);
    expect(blended.position.x).toBeLessThan(nudged.position.x);

    const snapped = smoothPredictedSkater(base, far);
    expect(snapped.position.x).toBe(far.position.x);
  });
});
