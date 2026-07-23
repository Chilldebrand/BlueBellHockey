import { describe, expect, it } from "vitest";
import {
  RINK_CONFIG,
  bladeWorldPosition,
  createWorld,
  goalLineX,
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
    // "Harder" means FASTER, not loftier: a slap is a flat rocket. It still
    // clears the ice, but no longer out-lifts a wrist — that extra lift used to
    // clang every neutral slapper off the crossbar. Aiming up is now what sends
    // a slap top-shelf.
    expect(slap.puck.verticalVelocity).toBeGreaterThan(0);
  });

  it("releases a side-carry draw-back as a snap: between wrist and slap pace", () => {
    const wrist = carrierWorld();
    playStick(wrist, [
      [0, 0],
      [0, 1]
    ]);

    const slap = carrierWorld();
    const straightBack: [number, number][] = Array.from(
      { length: 30 },
      () => [0, -1] as [number, number]
    );
    playStick(slap, [[0, 0], ...straightBack, [0, 1]]);

    const snap = carrierWorld();
    const sideBack: [number, number][] = Array.from(
      { length: 30 },
      () => [1, -1] as [number, number]
    );
    // Carry the puck out to the side first, then draw back and flick.
    playStick(snap, [[1, 0], [1, 0], [1, 0], ...sideBack, [0, 1]]);

    expect(snap.puck.carrierSlotId).toBeNull();
    expect(snap.puck.isChargedShot).toBe(false); // charged flag stays slap-only
    expect(
      snap.eventQueue.some(
        (event) => event.type === "shot" && event.detail === "snap"
      )
    ).toBe(true);
    expect(magnitude(snap.puck.velocity)).toBeGreaterThan(
      magnitude(wrist.puck.velocity)
    );
    expect(magnitude(snap.puck.velocity)).toBeLessThan(
      magnitude(slap.puck.velocity)
    );
  });

  it("classifies the windup kind once at entry from the lateral stick", () => {
    const straight = carrierWorld();
    playStick(straight, [
      [0, 0],
      [0.3, -1] // modest side lean still reads as a straight pull-back
    ]);
    expect(straight.skaters[0].gesture.phase).toBe("windup");
    expect(straight.skaters[0].gesture.windupKind).toBe("slap");

    const side = carrierWorld();
    playStick(side, [
      [1, 0],
      [1, -1]
    ]);
    expect(side.skaters[0].gesture.phase).toBe("windup");
    expect(side.skaters[0].gesture.windupKind).toBe("snap");

    // Sweeping to the side mid-windup does not flip an armed slap.
    playStick(straight, [[1, -1]]);
    expect(straight.skaters[0].gesture.windupKind).toBe("slap");
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

  it("defaults shots to the middle of the attacking net", () => {
    const world = carrierWorld();

    playStick(world, [
      [0, 0],
      [0, 1] // neutral left stick at release
    ]);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.velocity.x).toBeGreaterThan(500); // at the away net

    // Project the shot to the goal line: it should arrive at net center
    // even though the shooter is off-center.
    const puck = world.puck;
    const ticksToLine = (goalLineX("away") - puck.position.x) / puck.velocity.x;
    const arrivalY = puck.position.y + puck.velocity.y * ticksToLine;
    expect(arrivalY).toBeCloseTo(RINK_CONFIG.height / 2, 0);
  });

  it("places the shot in the net with the left stick (NHL aiming)", () => {
    const world = carrierWorld();

    stepWorld(world, [frame("home-skater-1", 1)], TICK);
    // Flick + left stick held screen-right (world +y): far-side placement.
    stepWorld(
      world,
      [frame("home-skater-1", 2, { stickY: 1, moveY: 0.9 })],
      TICK
    );

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.velocity.y).toBeGreaterThan(40); // toward the +y post

    const high = carrierWorld();
    stepWorld(high, [frame("home-skater-1", 1)], TICK);
    stepWorld(high, [frame("home-skater-1", 2, { stickY: 1, moveX: 1 })], TICK);

    const low = carrierWorld();
    stepWorld(low, [frame("home-skater-1", 1)], TICK);
    stepWorld(low, [frame("home-skater-1", 2, { stickY: 1, moveX: -1 })], TICK);

    // Screen-up aim lifts it toward the bar; screen-down keeps it on the ice.
    expect(high.puck.verticalVelocity).toBeGreaterThan(
      low.puck.verticalVelocity + 50
    );
  });

  it("lifts a neutral-aim shot off the ice", () => {
    const world = carrierWorld();

    stepWorld(world, [frame("home-skater-1", 1)], TICK);
    // Neutral left stick (no up/down aim) — most shots should still lift.
    stepWorld(world, [frame("home-skater-1", 2, { stickY: 1 })], TICK);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.verticalVelocity).toBeGreaterThan(120);
  });

  it("aims the away team at the opposite (home) net", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    world.puck.carrierSlotId = "away-skater-1";
    world.puck.lastTouchSlotId = "away-skater-1";
    world.puck.position = bladeWorldPosition(world.skaters[3]);

    stepWorld(world, [frame("away-skater-1", 1)], TICK);
    stepWorld(world, [frame("away-skater-1", 2, { stickY: 1 })], TICK);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.velocity.x).toBeLessThan(-500); // toward the home net
  });

  it("arms and fires a one-timer off a teammate's pass", () => {
    const world = carrierWorld();
    const passer = world.skaters[0]; // home-skater-1, facing +x
    const receiver = world.skaters[1]; // home-skater-2
    receiver.position = { x: passer.position.x + 260, y: passer.position.y };
    receiver.facing = 0;

    // Pass (charge on hold, fire on release), then let the puck travel.
    stepWorld(world, [frame(passer.id, 1, { pass: true })], TICK);
    stepWorld(world, [frame(passer.id, 2, { pass: false })], TICK);

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
