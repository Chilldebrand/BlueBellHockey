import { describe, expect, it } from "vitest";
import {
  CHECK_CONFIG,
  STICK_CONFIG,
  bladeWorldPosition,
  createWorld,
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

function playingWorld(): WorldState {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  return world;
}

describe("poke check", () => {
  it("lunges the blade forward for the poke window, then retracts", () => {
    const world = playingWorld();
    const defender = world.skaters[3];
    const restBlade = bladeWorldPosition(defender, undefined, world.time.nowMs);

    stepWorld(world, [frame(defender.id, 1, { poke: true })], 16);

    const lungedBlade = bladeWorldPosition(defender, undefined, world.time.nowMs);
    const reachGain = Math.abs(lungedBlade.x - restBlade.x);
    expect(reachGain).toBeGreaterThan(STICK_CONFIG.pokeReachBonus * 0.8);

    // Past the window the reach is back to normal (and the cooldown holds).
    stepWorld(world, [], CHECK_CONFIG.pokeDurationMs + 50);
    const settledBlade = bladeWorldPosition(defender, undefined, world.time.nowMs);
    expect(Math.abs(settledBlade.x - restBlade.x)).toBeLessThan(10);
    expect(defender.pokeCooldownUntilMs).toBeGreaterThan(world.time.nowMs);
  });

  it("strips a carrier at lunge range that resting reach cannot touch", () => {
    const world = playingWorld();
    const carrier = world.skaters[0];
    const defender = world.skaters[3];
    world.puck.carrierSlotId = carrier.id;
    world.puck.position = { ...bladeWorldPosition(carrier) };
    defender.facing = Math.PI; // blade toward the puck
    // Park the defender so its resting blade sits ~78 units up-ice of the puck
    // (outside the strip range) and only the +pokeReachBonus lunge closes it —
    // anchored to the real blade so it survives stick rest tuning.
    const defenderBladeOffset = bladeWorldPosition({
      ...defender,
      position: { x: 0, y: 0 }
    });
    defender.position = {
      x: world.puck.position.x + 78 - defenderBladeOffset.x,
      y: world.puck.position.y - defenderBladeOffset.y
    };

    // Without the poke: still carried.
    stepWorld(world, [frame(carrier.id, 1)], 16);
    expect(world.puck.carrierSlotId).toBe(carrier.id);

    stepWorld(world, [frame(defender.id, 1, { poke: true })], 16);
    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.stats.away.takeaways).toBe(1);
  });

  it("treats off-puck pass presses as a stick lift (NHL A-button)", () => {
    const world = playingWorld();
    const defender = world.skaters[3];

    stepWorld(world, [frame(defender.id, 1, { pass: true })], 16);

    expect(defender.pokeUntilMs).toBeGreaterThan(0);
  });
});

describe("block shot (dive)", () => {
  it("lays the skater out with a forward lunge and recovers after", () => {
    const world = playingWorld();
    const defender = world.skaters[3];
    defender.facing = Math.PI;

    stepWorld(world, [frame(defender.id, 1, { dive: true })], 16);

    expect(defender.contactState).toBe("diving");
    expect(defender.velocity.x).toBeLessThan(-200); // lunged along facing
    expect(
      world.eventQueue.some((event) => event.type === "dive")
    ).toBe(true);

    stepWorld(world, [], CHECK_CONFIG.diveDurationMs + 32);
    expect(defender.contactState).toBe("ready");
    expect(defender.diveCooldownUntilMs).toBeGreaterThan(world.time.nowMs);
  });

  it("blocks a low shot with the sprawled body", () => {
    const world = playingWorld();
    const blocker = world.skaters[3];
    blocker.contactState = "diving";
    blocker.contactStateUntilMs = world.time.nowMs + 800;
    blocker.position = { x: 1400, y: 500 };
    world.puck.position = { x: 1330, y: 500 };
    world.puck.velocity = { x: 1100, y: 0 };
    world.puck.lastTouchSlotId = "home-skater-1";
    world.puck.shotBySlotId = "home-skater-1";

    stepWorld(world, [], 16);

    expect(world.puck.velocity.x).toBeLessThan(0); // deflected back
    expect(world.puck.shotBySlotId).toBeNull();
    expect(
      world.eventQueue.some((event) => event.type === "block")
    ).toBe(true);
  });

  it("cannot dive while carrying and cannot act while down", () => {
    const world = playingWorld();
    const carrier = world.skaters[0];
    world.puck.carrierSlotId = carrier.id;

    stepWorld(world, [frame(carrier.id, 1, { dive: true })], 16);
    expect(carrier.contactState).toBe("ready");

    const defender = world.skaters[3];
    stepWorld(world, [frame(defender.id, 1, { dive: true })], 16);
    expect(defender.contactState).toBe("diving");

    // While down: checks and pokes are dead inputs.
    stepWorld(
      world,
      [frame(defender.id, 2, { check: true, poke: true })],
      16
    );
    expect(defender.pokeUntilMs).toBe(0);
    expect(
      world.eventQueue.some((event) => event.type === "hit")
    ).toBe(false);
  });
});
