import { describe, expect, it } from "vitest";
import {
  PUCK_CONFIG,
  RINK_CONFIG,
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
    aimX: 1,
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

describe("puck simulation", () => {
  it("allows a skater to pick up a loose puck by stick reach", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    const skater = world.skaters[0];
    world.puck.position = {
      x: skater.position.x + PUCK_CONFIG.carryOffset,
      y: skater.position.y
    };

    stepWorld(world, [inputFrame(skater.id, 1)], 16);

    expect(world.puck.carrierSlotId).toBe(skater.id);
    expect(world.puck.lastTouchSlotId).toBe(skater.id);
    expect(world.puck.position.x).toBeGreaterThan(skater.position.x);
  });

  it("applies friction to a loose puck", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    world.puck.velocity = { x: 600, y: 0 };

    stepWorld(world, [], 100);

    expect(world.puck.position.x).toBeGreaterThan(RINK_CONFIG.width / 2);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(world.puck.velocity.x).toBeLessThan(600);
  });

  it("rebounds from boards and remains inside the rink", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    world.puck.position = {
      x: RINK_CONFIG.width - PUCK_CONFIG.radius / 2,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 900, y: 0 };

    stepWorld(world, [], 100);

    expect(world.puck.position.x).toBeLessThanOrEqual(
      RINK_CONFIG.width - PUCK_CONFIG.radius
    );
    expect(world.puck.velocity.x).toBeLessThan(0);
  });
});
