import { describe, expect, it } from "vitest";
import { MATCH_CONFIG, type InputFrame } from "@bbh/arcade-core";
import { createLocalSim, FREE_SKATE_SLOT_ID } from "./localSim.js";
import {
  createInputRecorder,
  parseRecording,
  serializeRecording
} from "../dev/recorder.js";

function scriptedFrame(tick: number): InputFrame {
  return {
    playerId: "test",
    slotId: FREE_SKATE_SLOT_ID,
    sequence: tick + 1,
    moveX: Math.sin(tick * 0.2),
    moveY: Math.cos(tick * 0.15),
    stickX: Math.sin(tick * 0.4),
    stickY: tick % 45 === 0 ? 1 : Math.cos(tick * 0.3) * 0.4,
    pass: tick % 30 === 0,
    check: false,
    turbo: tick % 3 === 0,
    switchTarget: false
  };
}

describe("local sim", () => {
  it("advances in fixed ticks and keeps the leftover in the accumulator", () => {
    const sim = createLocalSim({ seed: 5 });

    const first = sim.advance(MATCH_CONFIG.fixedTickMs * 2 + 3, () => null);
    expect(first.ticksAdvanced).toBe(2);
    expect(first.previousWorld).not.toBeNull();

    // 3ms carry + 13ms = 16ms → exactly one more tick
    const second = sim.advance(MATCH_CONFIG.fixedTickMs - 3, () => null);
    expect(second.ticksAdvanced).toBe(1);
    expect(sim.getTick()).toBe(3);
  });

  it("never ends the endless session", () => {
    const sim = createLocalSim({ seed: 5 });

    for (let index = 0; index < 50; index += 1) {
      sim.advance(MATCH_CONFIG.fixedTickMs * 10, () => null);
    }

    expect(sim.getWorld().phase).toBe("playing");
    expect(sim.getWorld().remainingMs).toBeGreaterThan(0);
  });

  it("runs a full 3v3 of AI teammates and opponents around the controlled skater", () => {
    const sim = createLocalSim({ seed: 5, practice: true });
    const world = sim.getWorld();

    // Full rosters present, both goalies tending net.
    expect(world.skaters).toHaveLength(6);
    expect(world.skaters.some((skater) => skater.id === FREE_SKATE_SLOT_ID)).toBe(
      true
    );

    // With no human input, the five non-controlled skaters are AI-driven and
    // should move, while the un-driven controlled skater stays put.
    for (let index = 0; index < 60; index += 1) {
      sim.advance(MATCH_CONFIG.fixedTickMs, () => null);
    }

    const after = sim.getWorld();
    const others = after.skaters.filter(
      (skater) => skater.id !== sim.getControlledSlotId()
    );

    // The five AI skaters chase the puck / take up lanes, so several move.
    expect(
      others.filter(
        (skater) => Math.hypot(skater.velocity.x, skater.velocity.y) > 0
      ).length
    ).toBeGreaterThan(0);
  });

  it("temporarily controls the covering goalie and releases an aimed outlet", () => {
    const sim = createLocalSim({ seed: 5 });
    const world = sim.getWorld();
    const goalie = world.goalies.find((g) => g.id === "home-goalie")!;

    // Force a covered save by the human's own goalie.
    world.puck.carrierSlotId = null;
    world.puck.goalieCarrierId = "home-goalie";
    goalie.possessionStartedAtMs = world.time.nowMs;

    const frame = (
      tick: number,
      overrides: Partial<InputFrame>
    ): InputFrame => ({
      playerId: "test",
      slotId: FREE_SKATE_SLOT_ID,
      sequence: tick + 1,
      moveX: 0,
      moveY: 0,
      stickX: 0,
      stickY: 0,
      pass: false,
      check: false,
      turbo: false,
      switchTarget: false,
      ...overrides
    });

    // Hold the pass while aiming up-ice: input drives the goalie, not the
    // skater, and the pass press must NOT latch a manual body switch.
    sim.advance(MATCH_CONFIG.fixedTickMs, (tick) =>
      frame(tick, { pass: true, moveX: 1 })
    );
    expect(sim.getControlledEntityId()).toBe("home-goalie");
    expect(sim.getControlledSlotId()).toBe(FREE_SKATE_SLOT_ID);
    expect(sim.getWorld().puck.goalieCarrierId).toBe("home-goalie");

    // Bots keep skating around the frozen moment.
    expect(
      sim
        .getWorld()
        .skaters.filter(
          (skater) =>
            skater.id !== FREE_SKATE_SLOT_ID &&
            Math.hypot(skater.velocity.x, skater.velocity.y) > 0
        ).length
    ).toBeGreaterThan(0);

    // Falling edge releases the outlet along the remembered aim.
    sim.advance(MATCH_CONFIG.fixedTickMs, (tick) =>
      frame(tick, { pass: false, moveX: 1 })
    );
    expect(sim.getWorld().puck.goalieCarrierId).toBeNull();
    expect(sim.getWorld().puck.velocity.x).toBeGreaterThan(0);

    // Control returns to the remembered skater on the next tick.
    sim.advance(MATCH_CONFIG.fixedTickMs, (tick) => frame(tick, {}));
    expect(sim.getControlledEntityId()).toBe(FREE_SKATE_SLOT_ID);
    expect(sim.getControlledSlotId()).toBe(FREE_SKATE_SLOT_ID);
  });

  it("never grants control of the opposing goalie", () => {
    const sim = createLocalSim({ seed: 5 });
    const world = sim.getWorld();
    const goalie = world.goalies.find((g) => g.id === "away-goalie")!;

    world.puck.carrierSlotId = null;
    world.puck.goalieCarrierId = "away-goalie";
    goalie.possessionStartedAtMs = world.time.nowMs;

    sim.advance(MATCH_CONFIG.fixedTickMs, () => null);

    expect(sim.getControlledEntityId()).toBe(FREE_SKATE_SLOT_ID);
  });

  it("replays a recorded input script to an identical world", () => {
    const seed = 99;
    const recorder = createInputRecorder();
    const liveSim = createLocalSim({ seed });
    recorder.start();

    for (let tick = 0; tick < 240; tick += 1) {
      liveSim.advance(MATCH_CONFIG.fixedTickMs, (worldTick) => {
        const frame = scriptedFrame(worldTick);
        recorder.capture(frame);
        return frame;
      });
    }

    const recording = parseRecording(
      serializeRecording(recorder.stop(seed, FREE_SKATE_SLOT_ID))
    );
    expect(recording.frames).toHaveLength(240);

    const replaySim = createLocalSim({ seed: recording.seed });
    const startTick = replaySim.getTick();

    for (let tick = 0; tick < recording.frames.length; tick += 1) {
      replaySim.advance(
        MATCH_CONFIG.fixedTickMs,
        (worldTick) => recording.frames[worldTick - startTick] ?? null
      );
    }

    expect(JSON.stringify(replaySim.getWorld())).toBe(
      JSON.stringify(liveSim.getWorld())
    );
  });
});
