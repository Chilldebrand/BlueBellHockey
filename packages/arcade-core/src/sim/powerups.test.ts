import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POWERUP_SPAWN_POINTS } from "../config/powerups.js";
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
  it("spawns deterministic rink pickups on cadence", () => {
    const world = playingWorld();

    stepWorld(world, [], 10000);
    stepWorld(world, [], 16);

    expect(world.powerupPickups[0]).toMatchObject({
      type: "goalie-freeze",
      position: POWERUP_SPAWN_POINTS[1]
    });
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
