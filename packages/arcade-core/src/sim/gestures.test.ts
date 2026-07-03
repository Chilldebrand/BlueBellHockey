import { describe, expect, it } from "vitest";
import {
  bladeWorldPosition,
  createWorld,
  magnitude,
  stepWorld,
  type InputFrame,
  type WorldState
} from "../index";

function frame(
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

function carrierWorld(): WorldState {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  world.puck.carrierSlotId = "home-skater-1";
  world.puck.lastTouchSlotId = "home-skater-1";
  world.puck.position = bladeWorldPosition(world.skaters[0]);

  return world;
}

const TICK = 16;

/** Step a sequence of stick samples, one per tick, for the carrier. */
function playStick(world: WorldState, samples: readonly [number, number][]): void {
  samples.forEach(([stickX, stickY], index) => {
    stepWorld(
      world,
      [frame("home-skater-1", index + 1, { stickX, stickY })],
      TICK
    );
  });
}

describe("skill-stick gestures", () => {
  it("fires a wrist shot on a forward flick", () => {
    const world = carrierWorld();

    playStick(world, [
      [0, 0],
      [0, 1] // full-forward jump in one tick = fast flick
    ]);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.velocity.x).toBeGreaterThan(500); // toward +x (facing)
    expect(world.puck.shotBySlotId).toBe("home-skater-1");
    expect(world.eventQueue.some((event) => event.type === "shot")).toBe(true);
  });

  it("does not shoot from slow stickhandling", () => {
    const world = carrierWorld();

    // Ease the stick forward gradually — handling, not a flick.
    playStick(world, [
      [0, 0.05],
      [0, 0.1],
      [0, 0.15],
      [0, 0.2],
      [0, 0.25],
      [0, 0.3]
    ]);

    expect(world.puck.carrierSlotId).toBe("home-skater-1");
  });

  it("fires a slap shot out of a windup, harder than a wrist shot", () => {
    const wrist = carrierWorld();
    playStick(wrist, [
      [0, 0],
      [0, 1]
    ]);

    const slap = carrierWorld();
    const windup: [number, number][] = Array.from(
      { length: 30 },
      () => [0, -1] as [number, number]
    );
    playStick(slap, [[0, 0], ...windup, [0, 1]]);

    expect(slap.puck.carrierSlotId).toBeNull();
    expect(slap.puck.isChargedShot).toBe(true);
    expect(magnitude(slap.puck.velocity)).toBeGreaterThan(
      magnitude(wrist.puck.velocity)
    );
    expect(slap.puck.verticalVelocity).toBeGreaterThan(
      wrist.puck.verticalVelocity
    );
  });

  it("slows the carrier while winding up (telegraphed slapper)", () => {
    const world = carrierWorld();
    const skater = world.skaters[0];
    skater.velocity = { x: 600, y: 0 };

    stepWorld(
      world,
      [frame("home-skater-1", 1, { moveX: 1, stickY: -1 })],
      500
    );

    const windupSpeed = Math.hypot(skater.velocity.x, skater.velocity.y);
    expect(world.skaters[0].gesture.phase).toBe("windup");
    expect(windupSpeed).toBeLessThan(500);
  });

  it("enforces a cooldown between releases", () => {
    const world = carrierWorld();

    playStick(world, [
      [0, 0],
      [0, 1]
    ]);
    expect(world.puck.carrierSlotId).toBeNull();

    // Instantly re-gather and flick again inside the cooldown window.
    world.puck.carrierSlotId = "home-skater-1";
    world.puck.velocity = { x: 0, y: 0 };
    world.puck.position = bladeWorldPosition(world.skaters[0]);
    playStick(world, [
      [0, 0],
      [0, 1]
    ]);

    expect(world.puck.carrierSlotId).toBe("home-skater-1");
  });

  it("bends the shot toward the lateral stick position", () => {
    const world = carrierWorld();

    playStick(world, [
      [0, 0],
      [0.8, 1]
    ]);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.velocity.y).toBeGreaterThan(50); // pulled to the stick side
  });

  it("arms and fires a one-timer off a teammate's pass", () => {
    const world = carrierWorld();
    const passer = world.skaters[0]; // home-skater-1, facing +x
    const receiver = world.skaters[1]; // home-skater-2
    receiver.position = { x: passer.position.x + 260, y: passer.position.y };
    receiver.facing = 0;

    // Pass, then let the puck travel to the receiver.
    stepWorld(world, [frame(passer.id, 1, { pass: true })], TICK);

    for (let tick = 0; tick < 40 && world.puck.carrierSlotId === null; tick += 1) {
      stepWorld(world, [], TICK);
    }

    expect(world.puck.carrierSlotId).toBe(receiver.id);
    expect(receiver.oneTimerUntilMs).toBeGreaterThan(world.time.nowMs);

    // Immediate forward flick: the one-timer beats a plain wrist shot.
    stepWorld(
      world,
      [
        {
          ...frame(receiver.id, 2),
          slotId: receiver.id,
          stickY: 1
        }
      ],
      TICK
    );

    expect(world.puck.carrierSlotId).toBeNull();
    expect(magnitude(world.puck.velocity)).toBeGreaterThan(1100); // > wrist max
    expect(world.eventQueue.some((event) => event.type === "oneTimer")).toBe(
      true
    );
  });

  it("interprets identical samples identically on two sim instances", () => {
    const script: [number, number][] = [
      [0, 0.2],
      [0.4, -0.6],
      [0, -1],
      [0, -1],
      [-0.3, 0.4],
      [0, 1],
      [0, 0]
    ];
    const first = carrierWorld();
    const second = carrierWorld();
    playStick(first, script);
    playStick(second, script);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
