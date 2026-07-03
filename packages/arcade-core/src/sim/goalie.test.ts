import { describe, expect, it } from "vitest";
import {
  GOALIE_CONFIG,
  RINK_CONFIG,
  createWorld,
  stepWorld,
  type GoalieEntity,
  type WorldState
} from "../index";

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

function shotAtHomeGoalie(
  world: WorldState,
  overrides: {
    readonly speed?: number;
    readonly lateral?: number;
    readonly height?: number;
  } = {}
): void {
  const goalie = homeGoalieOf(world);
  world.puck.position = {
    x: goalie.position.x + 24,
    y: goalie.position.y + (overrides.lateral ?? 0)
  };
  world.puck.velocity = { x: -(overrides.speed ?? 900), y: 0 };
  world.puck.height = overrides.height ?? 0;
  world.puck.shotBySlotId = "away-skater-1";
  world.puck.lastTouchSlotId = "away-skater-1";
}

function lastSave(world: WorldState) {
  return [...world.eventQueue].reverse().find((event) => event.type === "save");
}

describe("goalie simulation", () => {
  it("keeps goalies inside their creases while tracking the puck laterally", () => {
    const world = playingWorld();
    world.puck.position = { x: RINK_CONFIG.width / 2, y: RINK_CONFIG.height - 40 };

    stepWorld(world, [], 100);

    const homeGoalie = homeGoalieOf(world);
    expect(homeGoalie.position.x).toBe(GOALIE_CONFIG.homeX);
    expect(homeGoalie.position.y).toBeGreaterThan(RINK_CONFIG.height / 2);
    expect(homeGoalie.position.y).toBeLessThanOrEqual(
      RINK_CONFIG.height / 2 + GOALIE_CONFIG.creaseHalfHeight
    );
  });

  it("kicks out an up-ice rebound with save stats for hot shots", () => {
    const world = playingWorld();
    shotAtHomeGoalie(world, { speed: 900 });

    stepWorld(world, [], 16);

    expect(world.score.away).toBe(0);
    expect(world.stats.saves.home).toBe(1);
    expect(world.stats.shots.away).toBe(1);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(world.puck.lastTouchSlotId).toBe("home-goalie");
    expect(lastSave(world)).toMatchObject({ targetSlotId: "home-goalie" });
  });

  it("picks the save type from puck height and side", () => {
    const padWorld = playingWorld();
    shotAtHomeGoalie(padWorld, { height: 0 });
    stepWorld(padWorld, [], 16);
    expect(lastSave(padWorld)?.detail).toBe("pad");

    const gloveWorld = playingWorld();
    shotAtHomeGoalie(gloveWorld, { height: 70, lateral: 30 });
    stepWorld(gloveWorld, [], 16);
    expect(lastSave(gloveWorld)?.detail).toBe("glove");

    const blockerWorld = playingWorld();
    shotAtHomeGoalie(blockerWorld, { height: 70, lateral: -30 });
    stepWorld(blockerWorld, [], 16);
    expect(lastSave(blockerWorld)?.detail).toBe("blocker");
  });

  it("covers a slow centered shot and resets to a center faceoff", () => {
    const world = playingWorld();
    shotAtHomeGoalie(world, { speed: 300, lateral: 5 });

    stepWorld(world, [], 16);

    expect(lastSave(world)?.detail).toBe("cover");
    expect(world.eventQueue.some((event) => event.type === "cover")).toBe(true);
    expect(world.puck.position).toEqual({
      x: RINK_CONFIG.width / 2,
      y: RINK_CONFIG.height / 2
    });
    expect(world.score).toEqual({ home: 0, away: 0 });
  });

  it("sweeps the puck path so a rocket cannot tunnel through the goalie", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    // The puck already ended up BEHIND the goalie this tick — its path
    // crossed the crease between ticks at extreme speed.
    world.puck.position = { x: goalie.position.x - 40, y: goalie.position.y };
    world.puck.velocity = { x: -3200, y: 0 };
    world.puck.shotBySlotId = "away-skater-1";
    world.puck.lastTouchSlotId = "away-skater-1";

    stepWorld(world, [], 16);

    expect(world.score.away).toBe(0);
    expect(world.stats.saves.home).toBe(1);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
  });

  it("ignores a teammate's dump-in (no phantom saves)", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    world.puck.position = { x: goalie.position.x + 24, y: goalie.position.y };
    world.puck.velocity = { x: -400, y: 0 };
    world.puck.lastTouchSlotId = "home-skater-2";
    world.puck.shotBySlotId = null;

    stepWorld(world, [], 16);

    expect(world.stats.saves.home).toBe(0);
  });
});
