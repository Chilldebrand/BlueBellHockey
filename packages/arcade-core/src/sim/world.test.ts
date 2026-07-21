import { describe, expect, it } from "vitest";
import {
  GOALIE_SLOTS,
  SKATER_SLOTS,
  createWorld,
  stepWorld,
  type GoalLimit,
  type TimeLimitMs
} from "../index";

describe("world lifecycle", () => {
  it("creates a deterministic initial world for the same seed and mode", () => {
    const first = createWorld(12345, "arcade3v3");
    const second = createWorld(12345, "arcade3v3");

    expect(second).toEqual(first);
  });

  it("creates six skater slots and two server-owned goalie slots", () => {
    const world = createWorld(12345, "arcade3v3");

    expect(SKATER_SLOTS).toHaveLength(6);
    expect(world.skaters).toHaveLength(6);
    expect(SKATER_SLOTS.filter((slot) => slot.teamId === "home")).toHaveLength(3);
    expect(SKATER_SLOTS.filter((slot) => slot.teamId === "away")).toHaveLength(3);

    expect(GOALIE_SLOTS).toHaveLength(2);
    expect(world.goalies).toHaveLength(2);
    expect(world.goalies.every((goalie) => goalie.owner === "server")).toBe(true);
  });

  it("initializes score to zero for both teams", () => {
    const world = createWorld(12345, "arcade3v3");

    expect(world.score).toEqual({
      home: 0,
      away: 0
    });
  });

  it("initializes zero player stat lines for all skaters", () => {
    const world = createWorld(12345, "arcade3v3");

    for (const slot of SKATER_SLOTS) {
      expect(world.stats.players[slot.id]).toEqual({
        goals: 0,
        assists: 0,
        hits: 0
      });
    }
  });

  it("advances the clock only while playing", () => {
    const waitingWorld = createWorld(12345, "arcade3v3");

    const waitingResult = stepWorld(waitingWorld, [], 16);
    expect(waitingResult).toBe(waitingWorld);
    expect(waitingWorld.time.nowMs).toBe(0);

    const playingWorld = createWorld(12345, "arcade3v3");
    playingWorld.phase = "playing";

    const playingResult = stepWorld(playingWorld, [], 16);
    expect(playingResult).toBe(playingWorld);
    expect(playingWorld.time.nowMs).toBe(16);
    expect(playingWorld.time.tick).toBe(1);
  });

  it("enters unlimited overtime when tied regulation reaches zero", () => {
    const world = createWorld(12345, "arcade3v3", undefined, {
      timeLimitMs: 180_000,
      goalLimit: 0
    });
    world.phase = "playing";
    world.remainingMs = 16;
    world.score = { home: 2, away: 2 };

    stepWorld(world, [], 16);

    expect(world.phase).toBe("playing");
    expect(world.isOvertime).toBe(true);
    expect(world.remainingMs).toBe(0);
    expect(world.winnerTeamId).toBeNull();
  });

  it("snapshots caller-provided rules when creating a world", () => {
    const rules: { timeLimitMs: TimeLimitMs; goalLimit: GoalLimit } = {
      timeLimitMs: 180_000,
      goalLimit: 3
    };
    const world = createWorld(12345, "arcade3v3", undefined, rules);

    rules.timeLimitMs = 600_000;
    rules.goalLimit = 10;

    expect(world.rules).toEqual({ timeLimitMs: 180_000, goalLimit: 3 });
    expect(world.remainingMs).toBe(180_000);
  });

  it("creates independent mutable vectors for simulation entities", () => {
    const world = createWorld(12345, "arcade3v3");

    expect(world.skaters[0].velocity).not.toBe(world.skaters[1].velocity);
    expect(world.skaters[0].velocity).not.toBe(world.goalies[0].velocity);
    expect(world.skaters[0].velocity).not.toBe(world.puck.velocity);
  });
});
