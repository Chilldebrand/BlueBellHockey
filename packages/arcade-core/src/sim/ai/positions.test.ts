import { describe, expect, it } from "vitest";
import {
  RINK_CONFIG,
  createWorld,
  type SkaterEntity,
  type Vec2
} from "../../index";
import { buildTacticalContext } from "./tactics.js";
import {
  chooseBotIntent,
  scorePositionCandidate,
  shouldKeepCurrentIntent
} from "./positions.js";

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

describe("relative AI positions", () => {
  it("creates distinct support and safety targets around a friendly carrier", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    const support = skater(world, "home-skater-2");
    const safety = skater(world, "home-skater-3");
    carrier.characterId = "rook-rocket";
    support.characterId = "luna-thread";
    safety.characterId = "orin-pads";
    placeAll(world, {
      [carrier.id]: { x: 1200, y: 780 },
      [support.id]: { x: 900, y: 500 },
      [safety.id]: { x: 700, y: 1050 }
    });
    world.puck.carrierSlotId = carrier.id;
    const context = buildTacticalContext(world, "home");

    const supportChoice = chooseBotIntent(support, world, context);
    const safetyChoice = chooseBotIntent(safety, world, context);

    expect(supportChoice.intent).toBe("support");
    expect(safetyChoice.intent).toBe("trail");
    expect(supportChoice.target.x).toBeGreaterThan(carrier.position.x);
    expect(safetyChoice.target.x).toBeLessThan(carrier.position.x);
    expect(
      Math.hypot(
        supportChoice.target.x - safetyChoice.target.x,
        supportChoice.target.y - safetyChoice.target.y
      )
    ).toBeGreaterThan(300);
  });

  it("rewards an open separated lane over a blocked teammate cluster", () => {
    const world = createWorld(1, "arcade3v3");
    const bot = skater(world, "home-skater-2");
    const teammate = skater(world, "home-skater-1");
    const blocker = skater(world, "away-skater-1");
    world.puck.carrierSlotId = teammate.id;
    teammate.position = { x: 1000, y: 780 };
    bot.position = { x: 800, y: 500 };
    blocker.position = { x: 1300, y: 780 };
    const context = buildTacticalContext(world, "home");
    const blockedCluster = { x: 1300, y: 780 };
    const openWideLane = { x: 1300, y: 1120 };

    expect(
      scorePositionCandidate(bot, blockedCluster, world, context)
    ).toBeLessThan(scorePositionCandidate(bot, openWideLane, world, context));
  });

  it("protects the slot instead of assigning a distant defender to an unsafe chase", () => {
    const world = createWorld(1, "arcade3v3");
    const nearDefender = skater(world, "home-skater-1");
    const farDefender = skater(world, "home-skater-3");
    const carrier = skater(world, "away-skater-1");
    placeAll(world, {
      [nearDefender.id]: { x: 1120, y: 780 },
      [farDefender.id]: { x: 360, y: 780 },
      [carrier.id]: { x: 1240, y: 780 }
    });
    world.puck.carrierSlotId = carrier.id;
    const context = buildTacticalContext(world, "home");

    const choice = chooseBotIntent(farDefender, world, context);

    expect(choice.intent).toBe("protect-slot");
    expect(choice.target.x).toBeLessThan(RINK_CONFIG.width / 2);
  });

  it("breaks ties by slot id and retains an adequate current target", () => {
    const world = createWorld(1, "arcade3v3");
    const first = skater(world, "home-skater-1");
    const second = skater(world, "home-skater-2");
    first.position = { x: 1000, y: 780 };
    second.position = { x: 1000, y: 780 };
    const context = buildTacticalContext(world, "home");

    expect(chooseBotIntent(first, world, context)).toEqual(
      chooseBotIntent(first, world, context)
    );
    expect(shouldKeepCurrentIntent(0.8, 0.9)).toBe(true);
    expect(shouldKeepCurrentIntent(0.8, 1.1)).toBe(false);
  });
});
