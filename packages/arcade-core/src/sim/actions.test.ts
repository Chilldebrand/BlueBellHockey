import { describe, expect, it } from "vitest";
import { createWorld, magnitude, stepWorld, type InputFrame } from "../index";

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
    stickX: 0,
    stickY: 0,
    pass: false,
    check: false,
    turbo: false,
    switchTarget: false,
    ...overrides
  };
}

function givePuckToFirstSkater() {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  world.puck.carrierSlotId = "home-skater-1";
  world.puck.lastTouchSlotId = "home-skater-1";
  world.puck.position = {
    ...world.skaters[0].position
  };

  return world;
}

describe("puck actions", () => {
  it("passes in the aimed direction and releases the carrier", () => {
    const world = givePuckToFirstSkater();

    stepWorld(world, [inputFrame("home-skater-1", 1, { pass: true })], 16);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.lastTouchSlotId).toBe("home-skater-1");
    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(Math.abs(world.puck.velocity.y)).toBeLessThan(1);
  });

  it("does not let the passer immediately reclaim a released puck", () => {
    const world = givePuckToFirstSkater();

    stepWorld(world, [inputFrame("home-skater-1", 1, { pass: true })], 16);
    stepWorld(world, [inputFrame("home-skater-1", 2)], 16);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.pickupDisabledForSlotId).toBe("home-skater-1");
  });

  it("assists passes toward same-team skaters near the aim vector", () => {
    const world = givePuckToFirstSkater();
    world.skaters[1].position = {
      x: world.skaters[0].position.x + 200,
      y: world.skaters[0].position.y + 200
    };

    stepWorld(world, [inputFrame("home-skater-1", 1, { pass: true })], 16);

    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(world.puck.velocity.y).toBeGreaterThan(0);
  });

});
