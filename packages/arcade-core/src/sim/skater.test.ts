import { describe, expect, it } from "vitest";
import {
  RINK_CONFIG,
  SKATER_MOVEMENT_CONFIG,
  createWorld,
  stepWorld,
  type InputFrame
} from "../index";

function inputFrame(
  slotId: string,
  sequence: number,
  overrides: Partial<InputFrame> = {}
): InputFrame {
  return {
    playerId: "session-a",
    slotId,
    sequence,
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    pass: false,
    shoot: false,
    check: false,
    turbo: false,
    switchTarget: false,
    usePowerup: false,
    special: false,
    ...overrides
  };
}

function speedOf(slotId: string, world = createWorld(1, "arcade3v3")): number {
  const skater = world.skaters.find((candidate) => candidate.id === slotId);
  if (!skater) {
    throw new Error(`Missing skater ${slotId}`);
  }

  return Math.hypot(skater.velocity.x, skater.velocity.y);
}

describe("skater movement", () => {
  it("accelerates a controlled skater from compact input fields", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    const skater = world.skaters[0];
    const startX = skater.position.x;

    stepWorld(world, [inputFrame(skater.id, 1, { moveX: 1 })], 100);

    expect(skater.position.x).toBeGreaterThan(startX);
    expect(skater.velocity.x).toBeGreaterThan(0);
    expect(speedOf(skater.id, world)).toBeLessThanOrEqual(
      SKATER_MOVEMENT_CONFIG.maxSpeed
    );
  });

  it("glides and decays velocity without fresh movement input", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    const skater = world.skaters[0];

    stepWorld(world, [inputFrame(skater.id, 1, { moveX: 1 })], 100);
    const acceleratedSpeed = speedOf(skater.id, world);
    const acceleratedX = skater.position.x;
    stepWorld(world, [], 100);

    expect(skater.position.x).toBeGreaterThan(acceleratedX);
    expect(speedOf(skater.id, world)).toBeGreaterThan(0);
    expect(speedOf(skater.id, world)).toBeLessThan(acceleratedSpeed);
  });

  it("keeps skaters inside the rink bounds", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    const skater = world.skaters[0];
    skater.position.x = RINK_CONFIG.width - SKATER_MOVEMENT_CONFIG.radius / 2;
    skater.velocity.x = SKATER_MOVEMENT_CONFIG.maxSpeed;

    stepWorld(world, [inputFrame(skater.id, 1, { moveX: 1 })], 100);

    expect(skater.position.x).toBeLessThanOrEqual(
      RINK_CONFIG.width - SKATER_MOVEMENT_CONFIG.radius
    );
    expect(skater.velocity.x).toBe(0);
  });

  it("produces deterministic results for repeated input sequences", () => {
    const first = createWorld(1, "arcade3v3");
    const second = createWorld(1, "arcade3v3");
    first.phase = "playing";
    second.phase = "playing";
    const inputs = [
      inputFrame("home-skater-1", 1, { moveX: 1, moveY: 0.25 }),
      inputFrame("home-skater-1", 2, { moveX: 0.5, moveY: 1 }),
      inputFrame("home-skater-1", 3)
    ];

    for (const input of inputs) {
      stepWorld(first, [input], 100);
      stepWorld(second, [input], 100);
    }

    expect(second.skaters[0]).toEqual(first.skaters[0]);
    expect(second.time).toEqual(first.time);
  });
});
