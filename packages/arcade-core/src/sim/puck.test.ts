import { describe, expect, it } from "vitest";
import {
  GOAL_HEIGHT,
  PUCK_CONFIG,
  RINK_CONFIG,
  bladeWorldPosition,
  createWorld,
  goalLineX,
  netBackX,
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

describe("puck simulation", () => {
  it("allows a skater to gather a loose puck near the blade", () => {
    const world = playingWorld();
    const skater = world.skaters[0]; // faces +x, blade rests ahead
    // Drop the loose puck right on the blade so it gathers.
    world.puck.position = { ...bladeWorldPosition(skater) };

    stepWorld(world, [inputFrame(skater.id, 1)], 16);

    expect(world.puck.carrierSlotId).toBe(skater.id);
    expect(world.puck.lastTouchSlotId).toBe(skater.id);
    expect(world.puck.position.x).toBeGreaterThan(skater.position.x);
  });

  it("lets a teammate catch a fast pass that a loose puck would deflect off", () => {
    const world = playingWorld();
    const receiver = world.skaters.find((s) => s.id === "home-skater-2")!;
    receiver.velocity = { x: 0, y: 0 };
    // A full-speed pass arriving right on the blade, marked as thrown by a
    // teammate: the reception assist gathers it.
    world.puck.position = { ...bladeWorldPosition(receiver) };
    world.puck.velocity = { x: PUCK_CONFIG.passSpeed + 300, y: 0 };
    world.puck.passedFromSlotId = "home-skater-1";
    world.puck.passedAtMs = world.time.nowMs;

    stepWorld(world, [inputFrame(receiver.id, 1)], 16);

    expect(world.puck.carrierSlotId).toBe(receiver.id);
  });

  it("does not extend the catch assist to opponents intercepting a pass", () => {
    const world = playingWorld();
    const interceptor = world.skaters.find((s) => s.id === "away-skater-1")!;
    interceptor.velocity = { x: 0, y: 0 };
    world.puck.position = { ...bladeWorldPosition(interceptor) };
    world.puck.velocity = { x: PUCK_CONFIG.passSpeed + 300, y: 0 };
    world.puck.passedFromSlotId = "home-skater-1"; // other team's pass

    stepWorld(world, [inputFrame(interceptor.id, 1)], 16);

    // Too hot to handle for anyone but the intended team.
    expect(world.puck.carrierSlotId).not.toBe(interceptor.id);
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
      y: 400 // straight end wall, outside both the corner arc and the net
    };
    world.puck.velocity = { x: 900, y: 0 };

    stepWorld(world, [], 100);

    expect(world.puck.position.x).toBeLessThanOrEqual(
      RINK_CONFIG.width - PUCK_CONFIG.radius
    );
    expect(world.puck.velocity.x).toBeLessThan(0);
  });

  it("lifts a wrist shot clearly off the ice", () => {
    const world = playingWorld();
    const shooter = world.skaters.find((s) => s.id === "home-skater-1")!;
    // Shoot from the home end so the puck has open ice (home attacks +x) and
    // won't reach the far net/goalie during the measured flight.
    shooter.position = { x: RINK_CONFIG.width * 0.35, y: RINK_CONFIG.height / 2 };
    world.puck.carrierSlotId = shooter.id;
    world.puck.position = { ...bladeWorldPosition(shooter) };
    // Latch a neutral-aim wrist shot at a solid (not full) power.
    shooter.gesture.pendingReleaseType = "wrist";
    shooter.gesture.pendingReleasePower = 0.8;

    // Release tick: the shot leaves the blade.
    stepWorld(world, [inputFrame(shooter.id, 1)], 16);
    expect(world.puck.carrierSlotId).toBeNull();

    let peakHeight = world.puck.height;
    for (let tick = 0; tick < 10; tick += 1) {
      stepWorld(world, [], 16);
      peakHeight = Math.max(peakHeight, world.puck.height);
    }

    // A grounded skim would peak within a puck radius; a real lift clears it.
    expect(peakHeight).toBeGreaterThan(20);
  });

  it("keeps a downward-aimed shot low along the ice", () => {
    const world = playingWorld();
    const shooter = world.skaters.find((s) => s.id === "home-skater-1")!;
    shooter.position = { x: RINK_CONFIG.width * 0.35, y: RINK_CONFIG.height / 2 };
    world.puck.carrierSlotId = shooter.id;
    world.puck.position = { ...bladeWorldPosition(shooter) };
    shooter.gesture.pendingReleaseType = "wrist";
    shooter.gesture.pendingReleasePower = 0.8;

    // moveX is the height aim in world space; negative keeps the shot low.
    stepWorld(world, [inputFrame(shooter.id, 1, { moveX: -1 })], 16);
    expect(world.puck.carrierSlotId).toBeNull();

    let peakHeight = world.puck.height;
    for (let tick = 0; tick < 10; tick += 1) {
      stepWorld(world, [], 16);
      peakHeight = Math.max(peakHeight, world.puck.height);
    }

    // A low shot stays much lower than a neutral/top-shelf one.
    expect(peakHeight).toBeLessThan(15);
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
      x: goalLineX("away") - PUCK_CONFIG.radius - 4,
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

  it("scores a low puck through the goal mouth when the goalie is beaten", () => {
    const world = playingWorld();
    const awayGoalie = world.goalies.find((goalie) => goalie.teamId === "away");
    if (!awayGoalie) {
      throw new Error("Missing away goalie");
    }
    // Goalie caught way over on the far side: cross-crease shot beats him.
    awayGoalie.position.y = RINK_CONFIG.height / 2 + 260;
    world.puck.position = {
      x: goalLineX("away") - 15,
      y: RINK_CONFIG.height / 2 - 60
    };
    world.puck.velocity = { x: 900, y: 0 };

    stepWorld(world, [], 32);

    expect(world.score.home).toBe(1);
  });

  it("lets skaters carry the puck behind the net (no goal from the corridor)", () => {
    const world = playingWorld();
    // Puck loose in the behind-net corridor, drifting across the mouth band.
    world.puck.position = {
      x: RINK_CONFIG.width - 60,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 0, y: 200 };

    stepWorld(world, [], 100);

    expect(world.score.home).toBe(0);
    expect(world.score.away).toBe(0);
  });

  it("bounces a corridor puck off the back of the net, not through it", () => {
    const world = playingWorld();
    world.puck.position = {
      x: RINK_CONFIG.width - 60, // behind the away net
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: -700, y: 0 }; // toward the net back

    stepWorld(world, [], 100);

    expect(world.puck.velocity.x).toBeGreaterThanOrEqual(0); // deflected
    expect(world.puck.position.x).toBeGreaterThan(netBackX("away") - 1);
    expect(world.score.away).toBe(0);
    expect(world.score.home).toBe(0);
  });

  it("tethers the carried puck: it trails the blade instead of teleporting", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    world.puck.carrierSlotId = skater.id;
    world.puck.position = { ...skater.position };

    stepWorld(world, [inputFrame(skater.id, 1, { moveX: 1, turbo: true })], 16);

    const blade = {
      x: skater.position.x + 52, // rest offset ahead of a facing-+x skater
      y: skater.position.y
    };
    const gap = Math.hypot(
      world.puck.position.x - blade.x,
      world.puck.position.y - blade.y
    );

    expect(world.puck.carrierSlotId).toBe(skater.id);
    expect(gap).toBeGreaterThan(1); // lags, not pinned
    expect(gap).toBeLessThan(PUCK_CONFIG.carryBreakDistance);
  });

  it("loses the puck when it falls too far off the blade", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    world.puck.carrierSlotId = skater.id;
    world.puck.position = {
      x: skater.position.x - PUCK_CONFIG.carryBreakDistance - 30,
      y: skater.position.y
    };

    stepWorld(world, [inputFrame(skater.id, 1)], 16);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.pickupDisabledForSlotId).toBe(skater.id);
  });

  it("lets an opponent's blade poke the carried puck loose", () => {
    const world = playingWorld();
    const carrier = world.skaters[0];
    const defender = world.skaters[3]; // away team
    world.puck.carrierSlotId = carrier.id;
    // Puck riding at the carrier's blade; place the defender so its resting
    // blade sits right on it (independent of the stick rest tuning).
    world.puck.position = { ...bladeWorldPosition(carrier) };
    defender.facing = Math.PI; // blade points -x, toward the puck
    const defenderBladeOffset = bladeWorldPosition({
      ...defender,
      position: { x: 0, y: 0 }
    });
    defender.position = {
      x: world.puck.position.x - defenderBladeOffset.x,
      y: world.puck.position.y - defenderBladeOffset.y
    };

    stepWorld(world, [inputFrame(carrier.id, 1)], 16);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.lastTouchSlotId).toBe(defender.id);
    expect(world.stats.away.takeaways).toBe(1);
    expect(
      world.eventQueue.some((event) => event.type === "poke")
    ).toBe(true);
  });

  it("deflects off a goal post", () => {
    const world = playingWorld();
    const postY = RINK_CONFIG.height / 2 + RINK_CONFIG.goalWidth / 2 + PUCK_CONFIG.postRadius;
    world.puck.position = {
      x: goalLineX("away") - 46,
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
