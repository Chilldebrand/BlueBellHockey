import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TUNING,
  TUNING,
  applyTuning,
  createWorld,
  resetTuning,
  snapshotTuning,
  stepWorld
} from "../index";

afterEach(() => {
  resetTuning();
});

describe("tuning", () => {
  it("starts with live values matching the frozen defaults", () => {
    expect(snapshotTuning()).toEqual(DEFAULT_TUNING);
    expect(Object.isFrozen(DEFAULT_TUNING)).toBe(true);
    expect(Object.isFrozen(DEFAULT_TUNING.skater)).toBe(true);
  });

  it("applies overrides and resets back to defaults", () => {
    applyTuning({ skater: { maxSpeed: 999 }, flags: { powerupsEnabled: false } });

    expect(TUNING.skater.maxSpeed).toBe(999);
    expect(TUNING.flags.powerupsEnabled).toBe(false);
    expect(DEFAULT_TUNING.skater.maxSpeed).not.toBe(999);

    resetTuning();

    expect(snapshotTuning()).toEqual(DEFAULT_TUNING);
  });

  it("feeds live values into the world step", () => {
    applyTuning({ skater: { maxSpeed: 0, acceleration: 0 } });

    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    const skater = world.skaters[0];
    const input = {
      playerId: "p",
      slotId: skater.id,
      sequence: 1,
      moveX: 1,
      moveY: 0,
      aimX: 0,
      aimY: 0,
      pass: false,
      shoot: false,
      check: false,
      turbo: false,
      switchTarget: false,
      usePowerup: false,
      special: false
    };

    for (let tick = 0; tick < 20; tick += 1) {
      stepWorld(world, [input], 16);
    }

    expect(Math.abs(skater.velocity.x)).toBeLessThan(1e-6);
  });
});
