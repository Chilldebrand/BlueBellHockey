import { describe, expect, it } from "vitest";
import { createWorld, stepWorld } from "./world.js";
import type { InputFrame, WorldState } from "./types.js";

function input(
  slotId: string,
  overrides: Partial<InputFrame> = {}
): InputFrame {
  return {
    playerId: "session-a",
    slotId,
    sequence: 1,
    moveX: 1,
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

function playingWorld(): WorldState {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  return world;
}

describe("turbo and assist targeting", () => {
  it("depletes turbo while active and recharges when released", () => {
    const world = playingWorld();
    const skater = world.skaters[0];

    stepWorld(world, [input(skater.id, { turbo: true })], 500);
    const afterTurbo = skater.turboMeter;
    const turboSpeed = Math.hypot(skater.velocity.x, skater.velocity.y);

    stepWorld(world, [input(skater.id, { turbo: false, moveX: 0 })], 500);

    expect(afterTurbo).toBeLessThan(1);
    expect(skater.turboMeter).toBeGreaterThan(afterTurbo);
    expect(turboSpeed).toBeGreaterThan(640);
  });

  it("applies a handling tradeoff while turboing", () => {
    const turboWorld = playingWorld();
    const normalWorld = playingWorld();
    const turboSkater = turboWorld.skaters[0];
    const normalSkater = normalWorld.skaters[0];

    stepWorld(turboWorld, [input(turboSkater.id, { moveX: 0, moveY: 1, turbo: true })], 100);
    stepWorld(normalWorld, [input(normalSkater.id, { moveX: 0, moveY: 1, turbo: false })], 100);

    expect(Math.abs(turboSkater.velocity.y)).toBeLessThan(
      Math.abs(normalSkater.velocity.y) * 1.1
    );
  });

});
