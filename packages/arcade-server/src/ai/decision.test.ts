import { createWorld, type SkaterEntity } from "@bbh/arcade-core";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOT_DIFFICULTY,
  chooseBotRole,
  findPassTarget,
  selectBotDecision,
} from "./decision.js";

function skater(world: ReturnType<typeof createWorld>, id: string): SkaterEntity {
  const entity = world.skaters.find((candidate) => candidate.id === id);

  if (!entity) {
    throw new Error(`Missing skater ${id}`);
  }

  return entity;
}

const alwaysAct = {
  ...DEFAULT_BOT_DIFFICULTY,
  shotAggression: 1,
  passWillingness: 1,
  specialFrequency: 1
};

describe("bot decision helpers", () => {
  it("assigns only the nearest loose-puck teammate as carrier", () => {
    const world = createWorld(1, "arcade3v3");
    const first = skater(world, "home-skater-1");
    const second = skater(world, "home-skater-2");
    world.puck.position = { x: first.position.x + 5, y: first.position.y };

    expect(chooseBotRole(first, world)).toBe("carrier");
    expect(chooseBotRole(second, world)).not.toBe("carrier");
  });

  it("moves puck carriers toward the net and shoots from range", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    carrier.position = { x: 1580, y: 500 };
    carrier.specialCharge = 1;
    world.puck.carrierSlotId = carrier.id;

    const decision = selectBotDecision(carrier, world, alwaysAct);

    expect(decision.role).toBe("carrier");
    expect(decision.moveTarget.x).toBeGreaterThan(carrier.position.x);
    expect(decision.aimTarget.x).toBeGreaterThan(carrier.position.x);
    expect(decision.shoot).toBe(true);
    expect(decision.special).toBe(true);
  });

  it("passes when a carrier is pressured and a teammate is open", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    const support = skater(world, "home-skater-3");
    const defender = skater(world, "away-skater-1");
    carrier.position = { x: 920, y: 500 };
    support.position = { x: 1240, y: 720 };
    defender.position = { x: 980, y: 510 };
    world.puck.carrierSlotId = carrier.id;

    const decision = selectBotDecision(carrier, world, alwaysAct);

    expect(findPassTarget(carrier, world, alwaysAct)?.id).toBe(support.id);
    expect(decision.pass).toBe(true);
    expect(decision.switchTarget).toBe(true);
    expect(decision.aimTarget).toEqual(support.position);
  });

  it("puts support bots into lanes instead of clumping on the carrier", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    const support = skater(world, "home-skater-2");
    carrier.position = { x: 900, y: 500 };
    support.position = { x: 840, y: 500 };
    world.puck.carrierSlotId = carrier.id;

    const decision = selectBotDecision(support, world, alwaysAct);

    expect(decision.role).toBe("support");
    expect(decision.moveTarget.x).toBeGreaterThan(carrier.position.x);
    expect(decision.moveTarget.y).not.toBe(carrier.position.y);
    expect(decision.pass).toBe(false);
  });

  it("pressures and checks opposing puck carriers", () => {
    const world = createWorld(1, "arcade3v3");
    const defender = skater(world, "home-skater-1");
    const carrier = skater(world, "away-skater-1");
    defender.position = { x: 930, y: 500 };
    carrier.position = { x: 1000, y: 500 };
    world.puck.carrierSlotId = carrier.id;

    const decision = selectBotDecision(defender, world, alwaysAct);

    expect(decision.role).toBe("defender");
    expect(decision.moveTarget).toEqual(carrier.position);
    expect(decision.check).toBe(true);
  });

  it("uses held powerups in situational offensive and defensive contexts", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    const defender = skater(world, "away-skater-1");
    carrier.position = { x: 1600, y: 500 };
    defender.position = { x: 1540, y: 500 };
    carrier.heldPowerupType = "speed-boost";
    defender.heldPowerupType = "instant-special";
    world.puck.carrierSlotId = carrier.id;

    expect(selectBotDecision(carrier, world, alwaysAct).usePowerup).toBe(true);
    expect(selectBotDecision(defender, world, alwaysAct).usePowerup).toBe(true);
  });
});
