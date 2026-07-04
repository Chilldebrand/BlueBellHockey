import { describe, expect, it } from "vitest";
import {
  COLLISION_CONFIG,
  RINK_CONFIG,
  createWorld,
  goalLineX,
  netBackX,
  netBoxFor,
  resolveSkaterCollisions,
  type WorldState
} from "../index";

function playingWorld(): WorldState {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  return world;
}

describe("skater body contact", () => {
  it("separates overlapping skaters symmetrically", () => {
    const world = playingWorld();
    const [first, , , second] = [
      world.skaters[0],
      null,
      null,
      world.skaters[3]
    ];
    first.position = { x: 1000, y: 500 };
    second.position = { x: 1030, y: 500 }; // 30 apart, radius 38 → overlap

    resolveSkaterCollisions(world);

    const gap = Math.hypot(
      second.position.x - first.position.x,
      second.position.y - first.position.y
    );
    expect(gap).toBeCloseTo(COLLISION_CONFIG.skaterRadius * 2, 6);
    // Symmetric: both moved the same amount away from the midpoint.
    expect(1015 - first.position.x).toBeCloseTo(second.position.x - 1015, 6);
  });

  it("exchanges momentum with low restitution and conserves it", () => {
    const world = playingWorld();
    const first = world.skaters[0];
    const second = world.skaters[3];
    first.position = { x: 1000, y: 500 };
    second.position = { x: 1070, y: 500 };
    first.velocity = { x: 600, y: 0 };
    second.velocity = { x: 0, y: 0 };

    const momentumBefore = first.velocity.x + second.velocity.x;
    resolveSkaterCollisions(world);

    expect(first.velocity.x).toBeLessThan(600);
    expect(second.velocity.x).toBeGreaterThan(0);
    // Equal masses, equal-and-opposite impulse: momentum is conserved.
    expect(first.velocity.x + second.velocity.x).toBeCloseTo(momentumBefore, 6);
  });

  it("leaves separating skaters' velocities alone", () => {
    const world = playingWorld();
    const first = world.skaters[0];
    const second = world.skaters[3];
    first.position = { x: 1000, y: 500 };
    second.position = { x: 1050, y: 500 };
    first.velocity = { x: -200, y: 0 }; // moving apart
    second.velocity = { x: 200, y: 0 };

    resolveSkaterCollisions(world);

    expect(first.velocity.x).toBe(-200);
    expect(second.velocity.x).toBe(200);
  });

  it("jostles the puck off a carrier on a hard opposing bump", () => {
    const world = playingWorld();
    const carrier = world.skaters[0];
    const bumper = world.skaters[3];
    world.puck.carrierSlotId = carrier.id;
    carrier.position = { x: 1000, y: 500 };
    bumper.position = { x: 1060, y: 500 };
    bumper.velocity = { x: -(COLLISION_CONFIG.jostleStripSpeed + 100), y: 0 };

    resolveSkaterCollisions(world);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.pickupDisabledForSlotId).toBe(carrier.id);
    expect(world.eventQueue.some((event) => event.type === "jostle")).toBe(true);
  });

  it("does not jostle on a teammate bump", () => {
    const world = playingWorld();
    const carrier = world.skaters[0];
    const teammate = world.skaters[1];
    world.puck.carrierSlotId = carrier.id;
    carrier.position = { x: 1000, y: 500 };
    teammate.position = { x: 1060, y: 500 };
    teammate.velocity = { x: -800, y: 0 };

    resolveSkaterCollisions(world);

    expect(world.puck.carrierSlotId).toBe(carrier.id);
  });

  it("keeps skaters out of the net cage but lets them skate behind it", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    const box = netBoxFor("away");

    // Dropped inside the cage: ejected clear of it.
    skater.position = {
      x: (goalLineX("away") + netBackX("away")) / 2,
      y: RINK_CONFIG.height / 2
    };
    resolveSkaterCollisions(world);

    const inflate = COLLISION_CONFIG.skaterRadius - 1;
    const stillInside =
      skater.position.x > box.minX - inflate &&
      skater.position.x < box.maxX + inflate &&
      skater.position.y > box.minY - inflate &&
      skater.position.y < box.maxY + inflate;
    expect(stillInside).toBe(false);

    // The corridor behind the net is open ice.
    skater.position = { x: RINK_CONFIG.width - 70, y: RINK_CONFIG.height / 2 };
    const before = { ...skater.position };
    resolveSkaterCollisions(world);
    expect(skater.position).toEqual(before);
  });

  it("keeps skaters out of the goalie's body", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    const goalie = world.goalies[0];
    skater.position = { ...goalie.position };
    skater.velocity = { x: -300, y: 0 };

    resolveSkaterCollisions(world);

    const gap = Math.hypot(
      skater.position.x - goalie.position.x,
      skater.position.y - goalie.position.y
    );
    expect(gap).toBeCloseTo(
      COLLISION_CONFIG.skaterRadius + COLLISION_CONFIG.goalieRadius,
      6
    );
  });
});
