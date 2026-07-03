import { describe, expect, it } from "vitest";
import {
  GOAL_HEIGHT,
  PUCK_CONFIG,
  RINK_CONFIG,
  createWorld,
  stepWorld,
  type InputFrame,
  type WorldState
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

function playingWorld(): WorldState {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  return world;
}

describe("puck simulation", () => {
  it("allows a skater to pick up a loose puck by stick reach", () => {
    const world = playingWorld();
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

  it("applies ice friction to a loose puck", () => {
    const world = playingWorld();
    world.puck.velocity = { x: 600, y: 0 };

    stepWorld(world, [], 100);

    expect(world.puck.position.x).toBeGreaterThan(RINK_CONFIG.width / 2);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(world.puck.velocity.x).toBeLessThan(600);
  });

  it("rebounds from a straight wall and remains inside the rink", () => {
    const world = playingWorld();
    world.puck.position = {
      x: RINK_CONFIG.width - PUCK_CONFIG.radius / 2,
      y: 300 // straight end wall, outside both the corner arc and the mouth
    };
    world.puck.velocity = { x: 900, y: 0 };

    stepWorld(world, [], 100);

    expect(world.puck.position.x).toBeLessThanOrEqual(
      RINK_CONFIG.width - PUCK_CONFIG.radius
    );
    expect(world.puck.velocity.x).toBeLessThan(0);
  });

  it("keeps pace in the air and scrubs it on the ice", () => {
    const airborne = playingWorld();
    const grounded = playingWorld();
    airborne.puck.velocity = { x: 800, y: 0 };
    airborne.puck.height = 60;
    airborne.puck.verticalVelocity = 260;
    grounded.puck.velocity = { x: 800, y: 0 };

    stepWorld(airborne, [], 100);
    stepWorld(grounded, [], 100);

    expect(airborne.puck.velocity.x).toBeGreaterThan(grounded.puck.velocity.x);
  });

  it("bounces a falling puck off the ice with deadened planar speed", () => {
    const world = playingWorld();
    world.puck.position = { x: RINK_CONFIG.width / 2, y: 300 };
    world.puck.velocity = { x: 400, y: 0 };
    world.puck.height = 80;
    world.puck.verticalVelocity = -400;

    stepWorld(world, [], 100);
    stepWorld(world, [], 100); // second step reaches the ice

    expect(world.puck.height).toBeGreaterThanOrEqual(0);
    expect(world.puck.verticalVelocity).toBeGreaterThan(0); // bounced up
    expect(world.puck.velocity.x).toBeLessThan(400); // landing scrubbed pace
  });

  it("clangs a high puck off the crossbar instead of scoring", () => {
    const world = playingWorld();
    world.puck.position = {
      x: RINK_CONFIG.width - PUCK_CONFIG.radius - 4,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 900, y: 0 };
    world.puck.height = GOAL_HEIGHT + 10;
    world.puck.verticalVelocity = 0;

    stepWorld(world, [], 16);

    expect(world.score.home).toBe(0);
    expect(world.puck.velocity.x).toBeLessThan(0); // bounced back out
    expect(
      world.eventQueue.some((event) => event.type === "post")
    ).toBe(true);
  });

  it("scores a low puck through the same goal mouth", () => {
    const world = playingWorld();
    world.puck.position = {
      x: RINK_CONFIG.width - PUCK_CONFIG.radius - 4,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 900, y: 0 };

    stepWorld(world, [], 32);

    expect(world.score.home).toBe(1);
  });

  it("deflects off a goal post", () => {
    const world = playingWorld();
    const postY = RINK_CONFIG.height / 2 + RINK_CONFIG.goalWidth / 2 + PUCK_CONFIG.postRadius;
    world.puck.position = {
      x: RINK_CONFIG.width - 60,
      y: postY
    };
    world.puck.velocity = { x: 1200, y: 0 };

    stepWorld(world, [], 32);

    expect(world.score.home).toBe(0);
    expect(world.puck.velocity.x).toBeLessThan(0);
    expect(
      world.eventQueue.some((event) => event.type === "post")
    ).toBe(true);
  });
});
