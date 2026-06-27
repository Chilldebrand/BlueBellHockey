import { describe, expect, it } from "vitest";
import {
  MATCH_CONFIG,
  RINK_CONFIG,
  createWorld,
  stepWorld
} from "../index";

describe("goal scoring and match loop", () => {
  it("scores only when the puck enters through the goal mouth", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    world.puck.position = { x: RINK_CONFIG.width - 4, y: RINK_CONFIG.height / 2 };
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

  it("rejects side net clips as non-goals", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    world.puck.position = { x: RINK_CONFIG.width - 4, y: 10 };
    world.puck.velocity = { x: 1000, y: 0 };

    stepWorld(world, [], 16);

    expect(world.score.home).toBe(0);
    expect(world.score.away).toBe(0);
  });

  it("ends the match when the target score is reached", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    world.score.home = MATCH_CONFIG.targetScore - 1;
    world.puck.position = { x: RINK_CONFIG.width - 4, y: RINK_CONFIG.height / 2 };
    world.puck.velocity = { x: 1000, y: 0 };

    stepWorld(world, [], 16);

    expect(world.phase).toBe("ended");
    expect(world.winnerTeamId).toBe("home");
  });
});
