import { describe, expect, it } from "vitest";
import {
  PUCK_CONFIG,
  createWorld,
  magnitude,
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

  it("leads a moving receiver instead of passing to their old position", () => {
    const world = givePuckToFirstSkater();
    const passer = world.skaters[0];
    const receiver = world.skaters[1];
    receiver.position = { x: passer.position.x + 360, y: passer.position.y };
    receiver.velocity = { x: 0, y: 480 };
    world.skaters[2].position = {
      x: passer.position.x + 640,
      y: passer.position.y + 640
    };

    tapPass(world, { moveX: 1, moveY: 0 });

    expect(world.puck.velocity.y).toBeGreaterThan(150);
  });

  it("uses the 40 percent faster quick and charged pass speeds", () => {
    const tap = givePuckToFirstSkater();
    tapPass(tap, { moveX: 1 });
    expect(PUCK_CONFIG.passSpeed).toBe(1512);
    expect(magnitude(tap.puck.velocity)).toBeCloseTo(
      PUCK_CONFIG.passSpeed +
        PUCK_CONFIG.passChargeSpeedBonus * (16 / PUCK_CONFIG.passChargeMaxMs)
    );

    const charged = givePuckToFirstSkater();
    for (let sequence = 1; sequence <= 38; sequence += 1) {
      stepWorld(
        charged,
        [inputFrame("home-skater-1", sequence, { pass: true })],
        16
      );
    }
    stepWorld(charged, [inputFrame("home-skater-1", 39, { pass: false })], 16);

    expect(PUCK_CONFIG.passChargeSpeedBonus).toBe(638);
    expect(magnitude(charged.puck.velocity)).toBeCloseTo(2150, 0);
  });

  it("keeps a fully charged pass catchable by its intended teammate", () => {
    const world = givePuckToFirstSkater();
    const passer = world.skaters[0];
    const receiver = world.skaters[1];
    receiver.position = { x: passer.position.x + 360, y: passer.position.y };
    world.skaters[2].position = {
      x: passer.position.x + 720,
      y: passer.position.y + 720
    };

    for (let sequence = 1; sequence <= 38; sequence += 1) {
      stepWorld(
        world,
        [inputFrame("home-skater-1", sequence, { pass: true, moveX: 1 })],
        16
      );
    }
    stepWorld(world, [inputFrame("home-skater-1", 39, { moveX: 1 })], 16);

    for (let sequence = 40; sequence <= 55; sequence += 1) {
      stepWorld(world, [inputFrame(receiver.id, sequence)], 16);
      if (world.puck.carrierSlotId === receiver.id) {
        break;
      }
    }

    expect(PUCK_CONFIG.passCatchMaxRelativeSpeed).toBe(2400);
    expect(world.puck.carrierSlotId).toBe(receiver.id);
  });
});
