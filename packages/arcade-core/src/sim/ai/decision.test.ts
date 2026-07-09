import { describe, expect, it } from "vitest";
import {
  RINK_CONFIG,
  createWorld,
  goalLineX,
  type SkaterEntity,
  type Vec2
} from "../../index";
import {
  CONTESTED_PUCK_MARGIN,
  COVER_STANDOFF,
  DEFAULT_BOT_DIFFICULTY,
  HOLD_BACK_MIN_DEPTH,
  POINT_LINE_OFFSET,
  SLOT_CYCLE_RADIUS_X,
  SLOT_DEPTH,
  assignTeamRoles,
  chooseBotRole,
  coverTarget,
  findPassTarget,
  passReceptionTarget,
  selectBotDecision,
  slotPositionTarget,
  shouldPass,
  shouldShoot
} from "./decision.js";

function skater(world: ReturnType<typeof createWorld>, id: string): SkaterEntity {
  const entity = world.skaters.find((candidate) => candidate.id === id);

  if (!entity) {
    throw new Error(`Missing skater ${id}`);
  }

  return entity;
}

/** Pin every skater so spawn geometry can't pollute distance rankings. */
function placeAll(
  world: ReturnType<typeof createWorld>,
  positions: Record<string, Vec2>
): void {
  for (const [id, position] of Object.entries(positions)) {
    skater(world, id).position = { ...position };
  }
}

const CENTER = { x: RINK_CONFIG.width / 2, y: RINK_CONFIG.height / 2 };

const alwaysAct = {
  ...DEFAULT_BOT_DIFFICULTY,
  shotAggression: 1,
  passWillingness: 1,
  specialFrequency: 1
};

describe("bot decision helpers", () => {
  it("assigns only the nearest loose-puck teammate as the chaser", () => {
    const world = createWorld(1, "arcade3v3");
    const first = skater(world, "home-skater-1");
    const second = skater(world, "home-skater-2");
    const third = skater(world, "home-skater-3");
    world.puck.position = { x: first.position.x + 5, y: first.position.y };

    expect(chooseBotRole(first, world)).toBe("chase");
    expect(chooseBotRole(second, world)).not.toBe("chase");
    expect(chooseBotRole(third, world)).not.toBe("chase");
  });

  it("moves puck carriers toward the net and shoots from range", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    // In the slot near the attacking (away) net.
    carrier.position = {
      x: RINK_CONFIG.width - 400,
      y: RINK_CONFIG.height / 2 - 30
    };
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
    defender.position = { x: 960, y: 380 };
    world.puck.carrierSlotId = carrier.id;

    const decision = selectBotDecision(carrier, world, alwaysAct);

    expect(findPassTarget(carrier, world, alwaysAct)?.id).toBe(support.id);
    expect(decision.pass).toBe(true);
    expect(decision.switchTarget).toBe(true);
    expect(decision.aimTarget).toEqual(support.position);
  });

  it("rejects an autonomous pass lane occupied by a defender", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    const support = skater(world, "home-skater-3");
    const blocker = skater(world, "away-skater-1");
    carrier.position = { x: 900, y: 500 };
    support.position = { x: 1240, y: 720 };
    blocker.position = { x: 1070, y: 610 };
    skater(world, "home-skater-2").position = { x: 500, y: 780 };
    world.puck.carrierSlotId = carrier.id;

    expect(findPassTarget(carrier, world, alwaysAct)).toBeNull();
    expect(shouldPass(carrier, world, alwaysAct)).toBe(false);
  });

  it("rejects an autonomous shot lane occupied by a defender", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    const blocker = skater(world, "away-skater-1");
    carrier.position = { x: 2100, y: RINK_CONFIG.height / 2 };
    blocker.position = { x: 2260, y: RINK_CONFIG.height / 2 };
    world.puck.carrierSlotId = carrier.id;

    expect(shouldShoot(carrier, world, alwaysAct)).toBe(false);
  });

  it("sends only the lane-aligned teammate toward a fresh pass intercept", () => {
    const world = createWorld(1, "arcade3v3");
    const receiver = skater(world, "home-skater-2");
    const otherMate = skater(world, "home-skater-3");
    world.time.nowMs = 1_000;
    world.puck.position = { x: 1000, y: RINK_CONFIG.height / 2 };
    world.puck.velocity = { x: 900, y: 0 };
    world.puck.passedFromSlotId = "home-skater-1";
    world.puck.passedAtMs = 800;
    receiver.position = { x: 1400, y: RINK_CONFIG.height / 2 };
    otherMate.position = { x: 1200, y: 1180 };

    expect(passReceptionTarget(receiver, world)).toEqual({
      x: 1315,
      y: RINK_CONFIG.height / 2
    });
    expect(passReceptionTarget(otherMate, world)).toBeNull();
  });

  it("spreads the attacking team into carrier + attack-slot + hold-back", () => {
    const world = createWorld(1, "arcade3v3");
    placeAll(world, {
      "home-skater-1": { x: 900, y: 500 },
      "home-skater-2": { x: 1600, y: 700 }, // closer to the attacking net
      "home-skater-3": { x: 700, y: 900 }
    });
    world.puck.carrierSlotId = "home-skater-1";

    const roles = assignTeamRoles(world, "home");
    expect([...roles.values()].sort()).toEqual([
      "attack-slot",
      "carrier",
      "hold-back"
    ]);
    expect(roles.get("home-skater-2")).toBe("attack-slot");
    expect(roles.get("home-skater-3")).toBe("hold-back");

    // The attack-slot compatibility role now uses a relative scoring cut,
    // while the trailer remains behind the puck as the safety option.
    const slotDecision = selectBotDecision(
      skater(world, "home-skater-2"),
      world,
      alwaysAct
    );
    expect(slotDecision.intent).toBe("cut");
    expect(slotDecision.moveTarget.x).toBeGreaterThan(900);

    const safetyDecision = selectBotDecision(
      skater(world, "home-skater-3"),
      world,
      alwaysAct
    );
    expect(safetyDecision.moveTarget.x).toBeLessThanOrEqual(
      RINK_CONFIG.width / 2
    );
    expect(safetyDecision.moveTarget.x).toBeGreaterThanOrEqual(
      goalLineX("home") + HOLD_BACK_MIN_DEPTH
    );
  });

  it("uses relative tendency targets while preserving compatible role labels", () => {
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
    world.puck.position = { ...carrier.position };
    world.puck.carrierSlotId = carrier.id;

    const supportDecision = selectBotDecision(support, world, alwaysAct);
    const safetyDecision = selectBotDecision(safety, world, alwaysAct);

    expect(supportDecision.role).toBe("attack-slot");
    expect(safetyDecision.role).toBe("hold-back");
    expect(supportDecision.intent).toBe("support");
    expect(safetyDecision.intent).toBe("trail");
    expect(supportDecision.moveTarget).toEqual({ x: 1500, y: 360 });
    expect(safetyDecision.moveTarget).toEqual({ x: 700, y: 590 });
  });

  it("keeps a relative cut stable instead of orbiting a fixed slot", () => {
    const world = createWorld(1, "arcade3v3");
    placeAll(world, {
      "home-skater-1": { x: 900, y: 500 },
      "home-skater-2": { x: 1600, y: 700 },
      "home-skater-3": { x: 700, y: 900 }
    });
    world.puck.carrierSlotId = "home-skater-1";

    const early = selectBotDecision(
      skater(world, "home-skater-2"),
      world,
      alwaysAct
    ).moveTarget;
    world.time.nowMs += 2500;
    const later = selectBotDecision(
      skater(world, "home-skater-2"),
      world,
      alwaysAct
    ).moveTarget;

    expect(later).toEqual(early);
  });

  it("keeps a safety tendency trailing a deep attack", () => {
    const world = createWorld(1, "arcade3v3");
    placeAll(world, {
      "home-skater-1": { x: 2350, y: 700 }, // carrier deep in the attack
      "home-skater-2": { x: 1900, y: 900 },
      "home-skater-3": { x: 800, y: 800 }
    });
    world.puck.carrierSlotId = "home-skater-1";
    world.puck.position = { x: 2350, y: 700 };
    skater(world, "home-skater-3").characterId = "orin-pads";

    const trailer = selectBotDecision(
      skater(world, "home-skater-3"),
      world,
      alwaysAct
    );
    expect(trailer.role).toBe("hold-back");
    expect(trailer.intent).toBe("trail");
    expect(trailer.moveTarget.x).toBe(1850);
  });

  it("pressures and checks opposing puck carriers", () => {
    const world = createWorld(1, "arcade3v3");
    const defender = skater(world, "home-skater-1");
    const carrier = skater(world, "away-skater-1");
    defender.position = { x: 930, y: 500 };
    // Checks are speed-gated now — a bot only throws one with momentum.
    defender.velocity = { x: 420, y: 0 };
    carrier.position = { x: 1000, y: 500 };
    world.puck.carrierSlotId = carrier.id;

    const decision = selectBotDecision(defender, world, alwaysAct);

    expect(decision.role).toBe("pressure");
    expect(decision.moveTarget).toEqual(carrier.position);
    expect(decision.check).toBe(true);
  });

  it("pressures the ranked slot threat instead of a wide low-danger carrier", () => {
    const world = createWorld(1, "arcade3v3");
    const defender = skater(world, "home-skater-1");
    const support = skater(world, "home-skater-2");
    const carrier = skater(world, "away-skater-1");
    const slotThreat = skater(world, "away-skater-2");
    defender.position = { x: 700, y: RINK_CONFIG.height / 2 };
    support.position = { x: 1250, y: 1200 };
    carrier.position = { x: 1650, y: 1400 };
    slotThreat.position = { x: 620, y: RINK_CONFIG.height / 2 };
    world.puck.position = { ...carrier.position };
    world.puck.carrierSlotId = carrier.id;

    const decision = selectBotDecision(defender, world, alwaysAct);

    expect(decision.intent).toBe("pressure");
    expect(decision.moveTarget).toEqual(slotThreat.position);
  });

  it("exposes tactical context metadata alongside the compatible role decision", () => {
    const world = createWorld(1, "arcade3v3");
    const defender = skater(world, "home-skater-1");
    const carrier = skater(world, "away-skater-1");
    defender.position = { x: 960, y: 500 };
    carrier.position = { x: 1000, y: 500 };
    world.puck.carrierSlotId = carrier.id;
    world.time.nowMs = 640;

    const decision = selectBotDecision(defender, world, alwaysAct);

    expect(decision.role).toBe("pressure");
    expect(decision.state).toBe("defend");
    expect(decision.intent).toBe("pressure");
    expect(decision.reason).toBe("defend:pressure");
    expect(decision.decisionScore).toBeGreaterThan(0);
    expect(decision.intentChangedAtMs).toBe(640);
  });

  it("puts both off-puck defenders in man coverage on their marks", () => {
    const world = createWorld(1, "arcade3v3");
    placeAll(world, {
      "home-skater-1": { x: 1000, y: 780 }, // closest to the carrier -> pressure
      "home-skater-2": { x: 700, y: 700 },
      "home-skater-3": { x: 400, y: 900 },
      "away-skater-1": { x: 1100, y: 780 }, // carrier / threat
      "away-skater-2": { x: 600, y: 700 }, // deep in our zone -> covered
      "away-skater-3": { x: 2200, y: 800 } // far away -> still man-covered
    });
    world.puck.carrierSlotId = "away-skater-1";

    const roles = assignTeamRoles(world, "home");
    expect(roles.get("home-skater-1")).toBe("pressure");
    expect(roles.get("home-skater-2")).toBe("cover");
    // No net-camping: the second defender shadows the far mark instead of
    // orbiting a net-front spot.
    expect(roles.get("home-skater-3")).toBe("cover");

    // The covering defender shadows goal-side of the mark, not on top of it.
    const coverDecision = selectBotDecision(
      skater(world, "home-skater-2"),
      world,
      alwaysAct
    );
    const mark = skater(world, "away-skater-2").position;
    const standoff = Math.hypot(
      coverDecision.moveTarget.x - mark.x,
      coverDecision.moveTarget.y - mark.y
    );
    expect(standoff).toBeCloseTo(COVER_STANDOFF, 0);
    expect(coverDecision.moveTarget.x).toBeLessThan(mark.x); // goal side
  });

  it("sends both teams' closest skaters after a near-tie loose puck", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.position = { ...CENTER };
    placeAll(world, {
      "home-skater-1": { x: CENTER.x - 300, y: CENTER.y },
      "home-skater-2": { x: 400, y: 600 },
      "home-skater-3": { x: 350, y: 950 },
      "away-skater-1": { x: CENTER.x + 300 + CONTESTED_PUCK_MARGIN / 2, y: CENTER.y },
      "away-skater-2": { x: 2200, y: 600 },
      "away-skater-3": { x: 2250, y: 950 }
    });

    expect(assignTeamRoles(world, "home").get("home-skater-1")).toBe("chase");
    expect(assignTeamRoles(world, "away").get("away-skater-1")).toBe("chase");
  });

  it("collapses into defensive shape when clearly losing a loose-puck race", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.position = { ...CENTER };
    placeAll(world, {
      "home-skater-1": { x: 600, y: CENTER.y }, // 700 away — losing by > margin
      "home-skater-2": { x: 500, y: 600 },
      "home-skater-3": { x: 400, y: 900 },
      "away-skater-1": { x: CENTER.x + 50, y: CENTER.y }, // about to win it
      "away-skater-2": { x: 1800, y: 700 },
      "away-skater-3": { x: 2000, y: 900 }
    });

    const homeRoles = assignTeamRoles(world, "home");
    expect([...homeRoles.values()]).toContain("pressure");
    expect([...homeRoles.values()]).not.toContain("chase");
    // The winning team still races it.
    expect(assignTeamRoles(world, "away").get("away-skater-1")).toBe("chase");
  });

  it("breaks identical-distance ties deterministically by slot id", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.position = { x: 1200, y: RINK_CONFIG.height / 2 };
    placeAll(world, {
      "home-skater-1": { x: 1200, y: RINK_CONFIG.height / 2 - 80 },
      "home-skater-2": { x: 1200, y: RINK_CONFIG.height / 2 + 80 }, // same distance
      "home-skater-3": { x: 300, y: 900 },
      "away-skater-1": { x: 2200, y: 600 },
      "away-skater-2": { x: 2300, y: 800 },
      "away-skater-3": { x: 2400, y: 1000 }
    });

    const first = assignTeamRoles(world, "home");
    expect(first.get("home-skater-1")).toBe("chase");
    // Stable across repeated evaluation (pure function of the world).
    expect(assignTeamRoles(world, "home")).toEqual(first);
  });

  it("places the high slot in front of the correct net for both teams", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.position = { x: CENTER.x, y: CENTER.y + 400 };

    const homeSlot = slotPositionTarget("home", world);
    expect(homeSlot.x).toBe(goalLineX("away") - SLOT_DEPTH);
    expect(homeSlot.y).toBeGreaterThan(CENTER.y); // nudged toward puck side

    const awaySlot = slotPositionTarget("away", world);
    expect(awaySlot.x).toBe(goalLineX("home") + SLOT_DEPTH);
  });

  it("computes cover points on the mark-to-net line at the standoff", () => {
    const mark = { x: 800, y: RINK_CONFIG.height / 2 };
    const point = coverTarget(mark, "home"); // home net is at low x

    expect(point.x).toBeCloseTo(mark.x - COVER_STANDOFF, 5);
    expect(point.y).toBeCloseTo(mark.y, 5);
  });

  it("uses held powerups in situational offensive and defensive contexts", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = skater(world, "home-skater-1");
    const defender = skater(world, "away-skater-1");
    carrier.position = {
      x: RINK_CONFIG.width - 400,
      y: RINK_CONFIG.height / 2
    };
    defender.position = {
      x: RINK_CONFIG.width - 460,
      y: RINK_CONFIG.height / 2
    };
    carrier.heldPowerupType = "speed-boost";
    // Bulldozer fires right before a hit: the defender is closing on the
    // carrier at speed and in check range.
    defender.heldPowerupType = "bulldozer";
    defender.velocity = { x: 400, y: 0 };
    world.puck.carrierSlotId = carrier.id;

    expect(selectBotDecision(carrier, world, alwaysAct).usePowerup).toBe(true);
    expect(selectBotDecision(defender, world, alwaysAct).usePowerup).toBe(true);
  });
});
