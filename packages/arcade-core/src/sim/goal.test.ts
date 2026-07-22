import { describe, expect, it } from "vitest";
import {
  GOAL_FACEOFF_COUNTDOWN_MS,
  RINK_CONFIG,
  createWorld,
  goalLineX,
  resolveGoals,
  stepWorld,
  type WorldState
} from "../index";

/** Playing world with the away goalie dragged out of the shot lane. */
function worldWithOpenAwayNet(
  rules?: { timeLimitMs: number; goalLimit: number }
): WorldState {
  const world = createWorld(1, "arcade3v3", undefined, rules);
  world.phase = "playing";
  const awayGoalie = world.goalies.find((goalie) => goalie.teamId === "away");

  if (awayGoalie) {
    awayGoalie.position.y = RINK_CONFIG.height / 2 + 260;
  }

  return world;
}

describe("goal scoring and match loop", () => {
  it("scores when the puck crosses the goal line through the mouth", () => {
    const world = worldWithOpenAwayNet();
    world.puck.position = {
      x: goalLineX("away") - 10,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 1000, y: 0 };
    world.puck.shotBySlotId = "home-skater-1";
    world.puck.lastTouchSlotId = "home-skater-1";

    stepWorld(world, [], 16);

    expect(world.score.home).toBe(1);
    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.position).toEqual({
      x: RINK_CONFIG.width / 2,
      y: RINK_CONFIG.height / 2
    });
    expect(world.eventQueue).toContainEqual(
      expect.objectContaining({ type: "goal", sourceSlotId: "home-skater-1" })
    );
  });

  it("starts a 3s faceoff countdown after a mid-match goal", () => {
    const world = worldWithOpenAwayNet();
    world.puck.position = {
      x: goalLineX("away") - 10,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 1000, y: 0 };
    world.puck.lastTouchSlotId = "home-skater-1";

    stepWorld(world, [], 16);

    expect(world.score.home).toBe(1);
    expect(world.phase).toBe("playing");
    expect(world.faceoffUntilMs).toBe(
      world.time.nowMs + GOAL_FACEOFF_COUNTDOWN_MS - 16
    );
  });

  it("ends immediately with no countdown on an overtime or cap-reaching goal", () => {
    const overtime = worldWithOpenAwayNet();
    overtime.isOvertime = true;
    overtime.puck.position = {
      x: goalLineX("away") - 10,
      y: RINK_CONFIG.height / 2
    };
    overtime.puck.velocity = { x: 1000, y: 0 };
    overtime.puck.lastTouchSlotId = "home-skater-1";
    stepWorld(overtime, [], 16);
    expect(overtime.phase).toBe("ended");
    expect(overtime.faceoffUntilMs).toBe(0);

    const capped = worldWithOpenAwayNet({ timeLimitMs: 180_000, goalLimit: 3 });
    capped.score.home = 2;
    capped.puck.position = {
      x: goalLineX("away") - 10,
      y: RINK_CONFIG.height / 2
    };
    capped.puck.velocity = { x: 1000, y: 0 };
    capped.puck.lastTouchSlotId = "home-skater-1";
    stepWorld(capped, [], 16);
    expect(capped.phase).toBe("ended");
    expect(capped.faceoffUntilMs).toBe(0);
  });

  it("credits the shooter with a goal in player stats", () => {
    const world = worldWithOpenAwayNet();
    world.puck.position = {
      x: goalLineX("away") - 10,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 1000, y: 0 };
    world.puck.shotBySlotId = "home-skater-1";
    world.puck.lastTouchSlotId = "home-skater-1";

    stepWorld(world, [], 16);

    expect(world.stats.players["home-skater-1"]?.goals).toBe(1);
    expect(world.stats.players["home-skater-2"]).toEqual({
      goals: 0,
      assists: 0,
      hits: 0
    });
  });

  it("credits one primary assist to a distinct same-team passer", () => {
    const world = worldWithOpenAwayNet();
    world.puck.position = {
      x: goalLineX("away") - 10,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 1000, y: 0 };
    world.puck.shotBySlotId = "home-skater-2";
    world.puck.lastTouchSlotId = "home-skater-2";
    world.puck.assistCandidateSlotId = "home-skater-1";

    stepWorld(world, [], 16);

    expect(world.stats.players["home-skater-1"]?.assists).toBe(1);
    expect(world.stats.players["home-skater-2"]?.assists).toBe(0);
  });

  it("does not award a self-assist", () => {
    const world = worldWithOpenAwayNet();
    world.puck.position = {
      x: goalLineX("away") - 10,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 1000, y: 0 };
    world.puck.shotBySlotId = "home-skater-1";
    world.puck.lastTouchSlotId = "home-skater-1";
    world.puck.assistCandidateSlotId = "home-skater-1";

    stepWorld(world, [], 16);

    expect(world.stats.players["home-skater-1"]?.assists).toBe(0);
  });

  it("returns skaters and goalies to their faceoff spots after a goal", () => {
    const world = worldWithOpenAwayNet();
    const scorer = world.skaters.find((s) => s.id === "home-skater-1")!;
    // Drive the scorer deep and moving, like they just crashed the net.
    scorer.position = { x: goalLineX("away") - 40, y: RINK_CONFIG.height / 2 + 80 };
    scorer.velocity = { x: 600, y: 0 };

    world.puck.position = { x: goalLineX("away") - 10, y: RINK_CONFIG.height / 2 };
    world.puck.velocity = { x: 1000, y: 0 };
    world.puck.shotBySlotId = "home-skater-1";
    world.puck.lastTouchSlotId = "home-skater-1";

    stepWorld(world, [], 16);

    expect(world.score.home).toBe(1);
    // Scorer is recentered near the faceoff, not stranded down by the net.
    expect(scorer.position.x).toBeLessThan(RINK_CONFIG.width / 2);
    expect(scorer.velocity).toEqual({ x: 0, y: 0 });
    const awayGoalie = world.goalies.find((g) => g.teamId === "away")!;
    expect(awayGoalie.position.y).toBe(RINK_CONFIG.height / 2);
  });

  it("rejects pucks outside the mouth band as non-goals", () => {
    const world = worldWithOpenAwayNet();
    world.puck.position = { x: goalLineX("away") - 10, y: 10 };
    world.puck.velocity = { x: 1000, y: 0 };

    stepWorld(world, [], 16);

    expect(world.score.home).toBe(0);
    expect(world.score.away).toBe(0);
  });

  it("does not score a goalie-held puck even if its position is in the goal", () => {
    const world = worldWithOpenAwayNet();
    world.puck.goalieCarrierId = "home-goalie";
    world.puck.position = {
      x: goalLineX("away") + 10,
      y: RINK_CONFIG.height / 2
    };

    resolveGoals(world);

    expect(world.score).toEqual({ home: 0, away: 0 });
    expect(world.eventQueue.some((event) => event.type === "goal")).toBe(false);
  });

  it("ends the match when a non-zero goal cap is reached", () => {
    const world = worldWithOpenAwayNet({
      timeLimitMs: 180_000,
      goalLimit: 3
    });
    world.score.home = 2;
    world.puck.position = {
      x: goalLineX("away") - 10,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 1000, y: 0 };

    stepWorld(world, [], 16);

    expect(world.phase).toBe("ended");
    expect(world.winnerTeamId).toBe("home");
  });

  it("does not end an uncapped match at five goals", () => {
    const world = worldWithOpenAwayNet({
      timeLimitMs: 180_000,
      goalLimit: 0
    });
    world.score.home = 4;
    world.puck.position = {
      x: goalLineX("away") - 10,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: 1000, y: 0 };

    stepWorld(world, [], 16);

    expect(world.score.home).toBe(5);
    expect(world.phase).toBe("playing");
    expect(world.winnerTeamId).toBeNull();
  });

  it("ends overtime with the first scoring team", () => {
    const world = worldWithOpenAwayNet({
      timeLimitMs: 180_000,
      goalLimit: 0
    });
    world.isOvertime = true;
    world.remainingMs = 0;
    world.puck.position = {
      x: goalLineX("away") + 10,
      y: RINK_CONFIG.height / 2
    };

    resolveGoals(world);

    expect(world.phase).toBe("ended");
    expect(world.winnerTeamId).toBe("home");
    expect(world.remainingMs).toBe(0);
  });
});
