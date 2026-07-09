import { describe, expect, it } from "vitest";
import { RINK_CONFIG, createWorld, type SkaterEntity, type Vec2 } from "../../index";
import {
  buildTacticalContext,
  selectTacticalState
} from "./tactics.js";

function skater(world: ReturnType<typeof createWorld>, id: string): SkaterEntity {
  const entity = world.skaters.find((candidate) => candidate.id === id);

  if (!entity) {
    throw new Error(`Missing skater ${id}`);
  }

  return entity;
}

function placeAll(
  world: ReturnType<typeof createWorld>,
  positions: Record<string, Vec2>
): void {
  for (const [id, position] of Object.entries(positions)) {
    skater(world, id).position = { ...position };
  }
}

describe("tactical context", () => {
  it("derives attack from friendly possession without mutating the world", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    world.puck.carrierSlotId = carrier.id;
    const before = structuredClone(world);

    const context = buildTacticalContext(world, "home");

    expect(context.state).toBe("attack");
    expect(selectTacticalState(context)).toBe("attack");
    expect(context.carrierId).toBe(carrier.id);
    expect(context.threatId).toBeNull();
    expect(context.puckPosition).toEqual(world.puck.position);
    expect(world).toEqual(before);
  });

  it("derives defend and ranks nearby opponents as greater pressure", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "away-skater-1");
    const nearDefender = skater(world, "home-skater-1");
    const farDefender = skater(world, "home-skater-2");
    carrier.position = { x: 1200, y: 500 };
    nearDefender.position = { x: 1240, y: 500 };
    farDefender.position = { x: 400, y: 900 };
    world.puck.carrierSlotId = carrier.id;

    const context = buildTacticalContext(world, "home");

    expect(context.state).toBe("defend");
    expect(context.threatId).toBe(carrier.id);
    expect(context.pressureBySlotId.get(nearDefender.id)).toBeGreaterThan(
      context.pressureBySlotId.get(farDefender.id) ?? 0
    );
  });

  it("uses recent simulation-time possession signals for transition", () => {
    const world = createWorld(1, "arcade3v3");
    world.time.nowMs = 1_000;
    world.puck.carrierSlotId = null;
    world.puck.passedFromSlotId = "home-skater-1";
    world.puck.passedAtMs = 800;
    world.puck.lastTouchSlotId = "home-skater-1";

    const context = buildTacticalContext(world, "home");

    expect(context.state).toBe("transition");
    expect(context.carrierId).toBeNull();
  });

  it("recognizes a contested loose puck when no transition signal remains", () => {
    const world = createWorld(1, "arcade3v3");
    const center = { x: RINK_CONFIG.width / 2, y: RINK_CONFIG.height / 2 };
    world.puck.position = center;
    placeAll(world, {
      "home-skater-1": { x: center.x - 100, y: center.y },
      "away-skater-1": { x: center.x + 110, y: center.y }
    });

    const context = buildTacticalContext(world, "home");

    expect(context.state).toBe("loose-puck");
    expect(context.hasNumbersAdvantage).toBe(false);
  });

  it("resets when no useful tactical signal is available", () => {
    const world = createWorld(1, "arcade3v3");
    world.skaters = [];

    const context = buildTacticalContext(world, "home");

    expect(context.state).toBe("reset");
    expect(context.threatId).toBeNull();
    expect(context.hasNumbersAdvantage).toBe(false);
  });

  it("is deterministic and uses only the world snapshot", () => {
    const world = createWorld(7, "arcade3v3");
    const first = buildTacticalContext(world, "away");
    const second = buildTacticalContext(world, "away");

    expect(first).toEqual(second);
    expect(first.openLaneScores).toEqual(second.openLaneScores);
  });
});
