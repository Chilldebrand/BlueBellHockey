import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BANANA_LIFETIME_MS,
  POWERUP_SPAWN_INTERVAL_MS,
  POWERUP_SPAWN_POINTS
} from "../config/powerups.js";
import { applyTuning, resetTuning } from "../config/tuning.js";
import type { InputFrame, WorldState } from "./types.js";
import { createWorld, stepWorld } from "./world.js";

// Powerups/specials are cut from the grounded-arcade scope and disabled by
// default; these tests cover the dormant systems with the flags forced on.
beforeEach(() => {
  applyTuning({ flags: { powerupsEnabled: true, specialsEnabled: true } });
});

afterEach(() => {
  resetTuning();
});

function input(slotId: string, overrides: Partial<InputFrame> = {}): InputFrame {
  return {
    playerId: "session-a",
    slotId,
    sequence: 1,
    moveX: 0,
    moveY: 0,
    stickX: 0,
    stickY: 0,
    pass: false,
    check: false,
    turbo: false,
    switchTarget: false,
    usePowerup: false,
    special: false,
    ...overrides
  };
}

function playingWorld(): WorldState {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  return world;
}

describe("powerup simulation", () => {
  it("does not spawn before the first cadence boundary", () => {
    const world = playingWorld();
    world.time.nowMs = POWERUP_SPAWN_INTERVAL_MS - 1;
    stepWorld(world, [], 1);
    expect(world.powerupPickups).toHaveLength(0);
    expect(world.bananaPeels).toHaveLength(0);
    expect(world.lastPowerupSpawnIndex).toBe(-1);
  });

  it("processes due spawn indices in order with unique scheduler event ids", () => {
    const world = playingWorld();
    world.time.nowMs = POWERUP_SPAWN_INTERVAL_MS;
    stepWorld(world, [], 1);
    expect(world.lastPowerupSpawnIndex).toBe(0);
    expect(world.powerupPickups.map((pickup) => pickup.id)).toEqual([
      "powerup-spawn-0-hard-shot"
    ]);
    expect(
      world.eventQueue
        .filter((event) => event.type === "powerupSpawn")
        .map((event) => event.id)
    ).toEqual(["powerup-spawn-0-0"]);

    world.time.nowMs = POWERUP_SPAWN_INTERVAL_MS * 9;
    stepWorld(world, [], 1);
    expect(world.lastPowerupSpawnIndex).toBe(8);
    const schedulerEventIds = world.eventQueue
      .filter(
        (event) =>
          event.type === "powerupSpawn" || event.type === "bananaSpawn"
      )
      .map((event) => event.id);
    expect(schedulerEventIds).toEqual([
      "powerup-spawn-1-1",
      "banana-spawn-1-2",
      "powerup-spawn-1-3",
      "powerup-spawn-1-4",
      "banana-spawn-1-5",
      "powerup-spawn-1-6",
      "powerup-spawn-1-7",
      "banana-spawn-1-8"
    ]);
    expect(new Set(schedulerEventIds).size).toBe(schedulerEventIds.length);

    world.powerupPickups = [];
    world.bananaPeels = [];
    stepWorld(world, [], 1);
    expect(world.powerupPickups).toEqual([]);
    expect(world.bananaPeels).toEqual([]);
    expect(
      world.eventQueue
        .filter(
          (event) =>
            event.type === "powerupSpawn" || event.type === "bananaSpawn"
        )
        .map((event) => event.id)
    ).toEqual(schedulerEventIds);
  });

  it("lets a skater pick up and consume one valid powerup", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    skater.position = { ...POWERUP_SPAWN_POINTS[0] };
    world.powerupPickups.push({
      id: "pickup-speed",
      type: "speed-boost",
      position: { ...POWERUP_SPAWN_POINTS[0] },
      spawnedAtMs: 0
    });

    stepWorld(world, [], 16);

    expect(skater.heldPowerupType).toBe("speed-boost");
    expect(world.powerupPickups).toHaveLength(0);

    stepWorld(world, [input(skater.id, { usePowerup: true })], 16);

    expect(skater.heldPowerupType).toBeNull();
    expect(world.activePowerups.at(-1)).toMatchObject({
      type: "speed-boost",
      slotId: skater.id
    });
  });

  it("validates special charge and cooldown before activation", () => {
    const world = playingWorld();
    const skater = world.skaters[0];

    stepWorld(world, [input(skater.id, { special: true })], 16);
    expect(world.eventQueue.some((event) => event.type === "specialUse")).toBe(false);

    skater.specialCharge = 1;
    stepWorld(world, [input(skater.id, { special: true, sequence: 2 })], 16);
    const cooldown = skater.specialCooldownUntilMs;

    expect(world.eventQueue.some((event) => event.type === "specialUse")).toBe(true);
    expect(skater.specialCharge).toBe(0);

    skater.specialCharge = 1;
    stepWorld(world, [input(skater.id, { special: true, sequence: 3 })], 16);
    expect(skater.specialCooldownUntilMs).toBe(cooldown);
  });
});

describe("reworked powerup effects", () => {
  it("freeze turns a random opponent into an ice block and pops their puck", () => {
    const world = playingWorld();
    const user = world.skaters.find((s) => s.teamId === "home")!;
    const away = world.skaters.filter((s) => s.teamId === "away");
    // Leave exactly one eligible target so the (deterministic) pick is known;
    // knocked-down skaters are skipped by the freeze selector.
    away[1].contactState = "knockedDown";
    away[1].contactStateUntilMs = 1_000_000;
    away[2].contactState = "knockedDown";
    away[2].contactStateUntilMs = 1_000_000;
    const target = away[0];
    world.puck.carrierSlotId = target.id;
    user.heldPowerupType = "freeze";

    stepWorld(world, [input(user.id, { usePowerup: true })], 16);

    expect(target.contactState).toBe("frozen");
    expect(target.contactStateUntilMs).toBeGreaterThan(world.time.nowMs);
    // The ice block can't hold the puck.
    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.eventQueue.some((event) => event.type === "freeze")).toBe(true);
    // The user is unaffected — freeze buffs nobody.
    expect(user.contactState).toBe("ready");
  });

  it("freeze never targets the user's own team", () => {
    const world = playingWorld();
    const user = world.skaters.find((s) => s.teamId === "home")!;
    user.heldPowerupType = "freeze";

    stepWorld(world, [input(user.id, { usePowerup: true })], 16);

    const frozen = world.skaters.filter((s) => s.contactState === "frozen");
    expect(frozen).toHaveLength(1);
    expect(frozen[0].teamId).toBe("away");
  });

  it("a frozen skater is locked in place and ignores input", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    skater.contactState = "frozen";
    skater.contactStateUntilMs = world.time.nowMs + 5000;
    skater.position = { x: 900, y: 600 };
    const before = { ...skater.position };

    stepWorld(world, [input(skater.id, { moveX: 1, turbo: true })], 16);

    expect(skater.position).toEqual(before);
    expect(skater.velocity).toEqual({ x: 0, y: 0 });
  });

  it("hard-shot fires a faster shot than a normal one", () => {
    const shoot = (withHardShot: boolean): number => {
      const world = playingWorld();
      const shooter = world.skaters.find((s) => s.id === "home-skater-1")!;
      shooter.position = { x: 700, y: 600 };
      world.puck.carrierSlotId = shooter.id;
      shooter.gesture.pendingReleaseType = "wrist";
      shooter.gesture.pendingReleasePower = 0.8;
      if (withHardShot) {
        world.activePowerups.push({
          id: "hs",
          type: "hard-shot",
          slotId: shooter.id,
          position: null,
          expiresAtMs: world.time.nowMs + 4300
        });
      }
      stepWorld(world, [input(shooter.id)], 16);
      return world.puck.shotPower;
    };

    const normal = shoot(false);
    const hard = shoot(true);
    expect(hard).toBeGreaterThan(normal);
    expect(hard).toBeCloseTo(normal * 1.35, 0);
  });

  it("speed-boost raises sustained top speed", () => {
    const run = (boosted: boolean): number => {
      const world = playingWorld();
      const skater = world.skaters.find((s) => s.id === "home-skater-1")!;
      skater.position = { x: 500, y: 700 };
      skater.velocity = { x: 0, y: 0 };
      if (boosted) {
        world.activePowerups.push({
          id: "sb",
          type: "speed-boost",
          slotId: skater.id,
          position: null,
          expiresAtMs: world.time.nowMs + 1_000_000
        });
      }
      for (let tick = 0; tick < 30; tick += 1) {
        stepWorld(world, [input(skater.id, { moveX: 1 })], 16);
      }
      return Math.hypot(skater.velocity.x, skater.velocity.y);
    };

    const normal = run(false);
    const boosted = run(true);
    expect(boosted).toBeGreaterThan(normal);
  });

  it("bulldozer flattens any contact into a knockdown", () => {
    const world = createWorld(1, "arcade3v3", {
      "home-skater-1": "kip-hook",
      "away-skater-1": "kip-hook"
    });
    world.phase = "playing";
    const hitter = world.skaters[0];
    const target = world.skaters[3];
    hitter.position = { x: 500, y: 500 };
    target.position = { x: 555, y: 500 };
    // Standstill: a normal check here would only bump (force ≈ 130).
    hitter.velocity = { x: 0, y: 0 };
    world.activePowerups.push({
      id: "bd",
      type: "bulldozer",
      slotId: hitter.id,
      position: null,
      expiresAtMs: world.time.nowMs + 4000
    });

    stepWorld(world, [input(hitter.id, { check: true })], 16);

    expect(target.contactState).toBe("knockedDown");
    expect(world.eventQueue.some((event) => event.type === "knockdown")).toBe(
      true
    );
  });
});

describe("banana peels", () => {
  it("wipes out a skater who skates over a peel and pops their puck", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    skater.position = { x: 900, y: 600 };
    skater.velocity = { x: 300, y: 0 };
    world.puck.carrierSlotId = skater.id;
    world.bananaPeels.push({
      id: "banana-1",
      position: { x: 905, y: 600 },
      spawnedAtMs: world.time.nowMs
    });

    stepWorld(world, [input(skater.id)], 16);

    expect(skater.contactState).toBe("knockedDown");
    expect(world.bananaPeels).toHaveLength(0); // consumed
    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.eventQueue.some((event) => event.type === "bananaSlip")).toBe(
      true
    );
  });

  it("leaves a peel untouched when nobody is near it", () => {
    const world = playingWorld();
    world.bananaPeels.push({
      id: "banana-far",
      position: { x: 50, y: 50 },
      spawnedAtMs: world.time.nowMs
    });

    stepWorld(world, [], 16);

    expect(world.bananaPeels.some((peel) => peel.id === "banana-far")).toBe(true);
  });

  it("rots a peel away after its lifetime", () => {
    const world = playingWorld();
    world.bananaPeels.push({
      id: "banana-old",
      position: { x: 50, y: 50 }, // far from any skater
      spawnedAtMs: 0
    });

    // Time advances at the END of a step, so the first step pushes the clock
    // past the lifetime and the second runs the expiry check with it applied.
    stepWorld(world, [], BANANA_LIFETIME_MS + 16);
    stepWorld(world, [], 16);

    expect(world.bananaPeels.some((peel) => peel.id === "banana-old")).toBe(
      false
    );
  });
});
