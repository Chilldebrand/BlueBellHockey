import { describe, expect, it } from "vitest";
import {
  PUCK_CONFIG,
  createWorld,
  goalieHoldPosition,
  magnitude,
  stepWorld,
  type GoalieEntity,
  type InputFrame,
  type WorldState
} from "../index.js";
import {
  GOALIE_OUTLET_TIMEOUT_MS,
  selectGoalieOutletTarget,
  stepGoalieOutlet
} from "./goalieOutlet.js";

function playingWorld(): WorldState {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  return world;
}

function homeGoalieOf(world: WorldState): GoalieEntity {
  const goalie = world.goalies.find((candidate) => candidate.teamId === "home");
  if (!goalie) {
    throw new Error("Missing home goalie");
  }
  return goalie;
}

function goalieInput(
  goalie: GoalieEntity,
  sequence: number,
  overrides: Partial<InputFrame> = {}
): InputFrame {
  return {
    playerId: "session-a",
    slotId: goalie.id,
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

function givePuckToGoalie(world: WorldState, goalie: GoalieEntity): void {
  world.puck.goalieCarrierId = goalie.id;
  world.puck.carrierSlotId = null;
  world.puck.position = goalieHoldPosition(goalie);
  world.puck.velocity = { x: 0, y: 0 };
  world.puck.height = 0;
  world.puck.verticalVelocity = 0;
  goalie.passChargeMs = 0;
  goalie.outletAim = { x: 1, y: 0 };
  goalie.possessionStartedAtMs = world.time.nowMs;
  goalie.passWasHeld = false;
}

function homeSkater(world: WorldState, index: number) {
  const skater = world.skaters.filter((candidate) => candidate.teamId === "home")[index];
  if (!skater) {
    throw new Error(`Missing home skater ${index}`);
  }
  return skater;
}

describe("goalie outlets", () => {
  it("initializes outlet state and resets it for a new covered save", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);

    expect(goalie.passChargeMs).toBe(0);
    expect(goalie.outletAim).toEqual({ x: 1, y: 0 });
    expect(goalie.possessionStartedAtMs).toBe(0);
    expect(goalie.passWasHeld).toBe(false);

    goalie.passChargeMs = 300;
    goalie.outletAim = { x: 0, y: 1 };
    goalie.possessionStartedAtMs = 123;
    goalie.passWasHeld = true;
    world.puck.position = { x: goalie.position.x + 24, y: goalie.position.y };
    world.puck.velocity = { x: -300, y: 0 };
    world.puck.shotBySlotId = "away-skater-1";
    world.puck.lastTouchSlotId = "away-skater-1";
    const coveredAtMs = world.time.nowMs;

    stepWorld(world, [], 16);

    expect(world.puck.goalieCarrierId).toBe(goalie.id);
    expect(goalie.passChargeMs).toBe(0);
    expect(goalie.outletAim).toEqual({ x: 1, y: 0 });
    expect(goalie.possessionStartedAtMs).toBe(coveredAtMs);
    expect(goalie.passWasHeld).toBe(false);
  });

  it("charges only while held and releases on the pass falling edge", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    givePuckToGoalie(world, goalie);

    expect(stepGoalieOutlet(world, goalie, goalieInput(goalie, 1, { pass: true }), 200)).toBe(false);
    expect(goalie.passChargeMs).toBe(200);
    expect(goalie.passWasHeld).toBe(true);
    expect(world.puck.goalieCarrierId).toBe(goalie.id);

    expect(stepGoalieOutlet(world, goalie, goalieInput(goalie, 2, { pass: true }), 200)).toBe(false);
    expect(goalie.passChargeMs).toBe(400);
    expect(world.puck.goalieCarrierId).toBe(goalie.id);

    expect(stepGoalieOutlet(world, goalie, goalieInput(goalie, 3), 16)).toBe(true);
    expect(world.puck.goalieCarrierId).toBeNull();
    expect(world.puck.velocity.x).toBeGreaterThan(0);
  });

  it("uses the latest goalie frame and remembers a nonzero aim through neutral input", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    givePuckToGoalie(world, goalie);

    stepWorld(
      world,
      [
        goalieInput(goalie, 1, { pass: true, moveX: 1 }),
        goalieInput(goalie, 2, { pass: true, moveY: 1 })
      ],
      16
    );
    stepWorld(world, [goalieInput(goalie, 3, { pass: true, moveX: 0.2 })], 16);

    expect(goalie.outletAim).toEqual({ x: 0, y: 1 });

    stepWorld(world, [goalieInput(goalie, 4)], 16);

    expect(world.puck.velocity.y).toBeGreaterThan(0);
    expect(Math.abs(world.puck.velocity.x)).toBeLessThan(1);
  });

  it("scales outlet speed with the existing pass charge limits", () => {
    const tap = playingWorld();
    const tapGoalie = homeGoalieOf(tap);
    givePuckToGoalie(tap, tapGoalie);
    stepGoalieOutlet(tap, tapGoalie, goalieInput(tapGoalie, 1, { pass: true }), 16);
    stepGoalieOutlet(tap, tapGoalie, goalieInput(tapGoalie, 2), 16);

    const held = playingWorld();
    const heldGoalie = homeGoalieOf(held);
    givePuckToGoalie(held, heldGoalie);
    stepGoalieOutlet(
      held,
      heldGoalie,
      goalieInput(heldGoalie, 1, { pass: true }),
      PUCK_CONFIG.passChargeMaxMs
    );
    stepGoalieOutlet(held, heldGoalie, goalieInput(heldGoalie, 2), 16);

    expect(magnitude(tap.puck.velocity)).toBeCloseTo(
      PUCK_CONFIG.passSpeed +
        PUCK_CONFIG.passChargeSpeedBonus * (16 / PUCK_CONFIG.passChargeMaxMs)
    );
    expect(magnitude(held.puck.velocity)).toBeCloseTo(
      PUCK_CONFIG.passSpeed + PUCK_CONFIG.passChargeSpeedBonus
    );
  });

  it("releases from the goalie-safe hold point, clears possession, and locks out self pickup", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    givePuckToGoalie(world, goalie);
    const releaseAtMs = world.time.nowMs;

    stepGoalieOutlet(world, goalie, goalieInput(goalie, 1, { pass: true }), 16);
    stepGoalieOutlet(world, goalie, goalieInput(goalie, 2), 16);

    expect(world.puck.position).toEqual(goalieHoldPosition(goalie));
    expect(world.puck.goalieCarrierId).toBeNull();
    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.pickupDisabledForSlotId).toBe(goalie.id);
    expect(world.puck.pickupDisabledUntilMs).toBe(
      releaseAtMs + PUCK_CONFIG.releasePickupCooldownMs
    );
    expect(goalie.passChargeMs).toBe(0);
    expect(goalie.passWasHeld).toBe(false);
  });

  it("releases the deterministic fallback at the exact timeout boundary", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    givePuckToGoalie(world, goalie);
    goalie.possessionStartedAtMs = 0;

    world.time = { ...world.time, nowMs: GOALIE_OUTLET_TIMEOUT_MS - 1 };
    expect(stepGoalieOutlet(world, goalie, undefined, 0)).toBe(false);
    expect(world.puck.goalieCarrierId).toBe(goalie.id);

    world.time = { ...world.time, nowMs: GOALIE_OUTLET_TIMEOUT_MS };
    expect(stepGoalieOutlet(world, goalie, undefined, 0)).toBe(true);
    expect(world.puck.goalieCarrierId).toBeNull();
  });

  it("prefers the nearest unblocked teammate in the up-ice half-plane", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    const upIce = homeSkater(world, 0);
    const closerBehind = homeSkater(world, 1);
    givePuckToGoalie(world, goalie);

    upIce.position = { x: goalie.position.x + 300, y: goalie.position.y };
    closerBehind.position = { x: goalie.position.x - 20, y: goalie.position.y };

    expect(selectGoalieOutletTarget(world, goalie)).toBe(upIce);
  });

  it("falls back to the nearest eligible teammate when every up-ice lane is blocked", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    const blockedUpIce = homeSkater(world, 0);
    const fallback = homeSkater(world, 1);
    const blocker = world.skaters.find((candidate) => candidate.teamId === "away");
    if (!blocker) {
      throw new Error("Missing blocker");
    }
    givePuckToGoalie(world, goalie);

    blockedUpIce.position = { x: goalie.position.x + 400, y: goalie.position.y };
    fallback.position = { x: goalie.position.x - 200, y: goalie.position.y };
    blocker.position = { x: goalie.position.x + 200, y: goalie.position.y };

    expect(selectGoalieOutletTarget(world, goalie)).toBe(fallback);
  });

  it("breaks deterministic target-ranking ties by slot ID", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    const first = homeSkater(world, 0);
    const second = homeSkater(world, 1);
    const other = homeSkater(world, 2);
    givePuckToGoalie(world, goalie);

    first.position = { x: goalie.position.x + 300, y: goalie.position.y - 60 };
    second.position = { x: goalie.position.x + 300, y: goalie.position.y + 60 };
    other.position = { x: goalie.position.x - 700, y: goalie.position.y };

    expect(selectGoalieOutletTarget(world, goalie)).toBe(first);
  });

  it("never lets goalie movement or unavailable actions leak from goalie input", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    givePuckToGoalie(world, goalie);
    const beforePosition = { ...goalie.position };

    stepWorld(
      world,
      [
        goalieInput(goalie, 1, {
          moveX: 1,
          moveY: -1,
          stickX: 1,
          stickY: 1,
          check: true,
          turbo: true,
          switchTarget: true,
          poke: true,
          dive: true,
          usePowerup: true,
          special: true
        })
      ],
      16
    );

    expect(goalie.position).toEqual(beforePosition);
    expect(goalie.velocity).toEqual({ x: 0, y: 0 });
    expect(world.puck.goalieCarrierId).toBe(goalie.id);
    expect(world.eventQueue).toEqual([]);
    expect(world.skaters.every((skater) => skater.contactState === "ready")).toBe(true);
    expect(world.skaters.every((skater) => skater.selectedTargetSlotId === null)).toBe(true);
  });
});
