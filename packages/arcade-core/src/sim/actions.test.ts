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

/** Hold the pass button one tick, then release it — the pass fires on release. */
function tapPass(world: ReturnType<typeof givePuckToFirstSkater>, aim: Partial<InputFrame> = {}) {
  stepWorld(world, [inputFrame("home-skater-1", 1, { pass: true, ...aim })], 16);
  stepWorld(world, [inputFrame("home-skater-1", 2, { pass: false, ...aim })], 16);
}

describe("puck actions", () => {
  it("passes along the left-stick aim and releases the carrier", () => {
    const world = givePuckToFirstSkater();

    // Aim up-ice (+x) with the left stick; no teammate lies that way.
    tapPass(world, { moveX: 1 });

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.lastTouchSlotId).toBe("home-skater-1");
    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(Math.abs(world.puck.velocity.y)).toBeLessThan(1);
  });

  it("holds the pass until the button is released", () => {
    const world = givePuckToFirstSkater();

    // Button held: the carrier is still charging, no pass yet.
    stepWorld(world, [inputFrame("home-skater-1", 1, { pass: true })], 16);
    expect(world.puck.carrierSlotId).toBe("home-skater-1");

    // Release fires it.
    stepWorld(world, [inputFrame("home-skater-1", 2, { pass: false })], 16);
    expect(world.puck.carrierSlotId).toBeNull();
  });

  it("charges a stronger pass the longer the button is held", () => {
    const tap = givePuckToFirstSkater();
    tapPass(tap, { moveX: 1 });
    const tapSpeed = magnitude(tap.puck.velocity);

    const held = givePuckToFirstSkater();
    for (let seq = 1; seq <= 45; seq += 1) {
      stepWorld(held, [inputFrame("home-skater-1", seq, { pass: true, moveX: 1 })], 16);
    }
    stepWorld(held, [inputFrame("home-skater-1", 46, { pass: false, moveX: 1 })], 16);
    const heldSpeed = magnitude(held.puck.velocity);

    expect(heldSpeed).toBeGreaterThan(tapSpeed + 200);
  });

  it("does not let the passer immediately reclaim a released puck", () => {
    const world = givePuckToFirstSkater();

    tapPass(world);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.pickupDisabledForSlotId).toBe("home-skater-1");
  });

  it("assists passes toward a teammate inside the aim cone", () => {
    const world = givePuckToFirstSkater();
    world.skaters[1].position = {
      x: world.skaters[0].position.x + 200,
      y: world.skaters[0].position.y + 200
    };

    // Aim the left stick toward the teammate (up-ice and to the side).
    tapPass(world, { moveX: 1, moveY: 1 });

    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(world.puck.velocity.y).toBeGreaterThan(0);
  });
});
