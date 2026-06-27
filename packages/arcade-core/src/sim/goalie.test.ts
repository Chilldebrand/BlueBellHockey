import { describe, expect, it } from "vitest";
import { GOALIE_CONFIG, RINK_CONFIG, createWorld, stepWorld } from "../index";

describe("goalie simulation", () => {
  it("keeps goalies inside their creases while tracking the puck laterally", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    world.puck.position = { x: RINK_CONFIG.width / 2, y: RINK_CONFIG.height - 40 };

    stepWorld(world, [], 100);

    const homeGoalie = world.goalies.find((goalie) => goalie.teamId === "home");
    expect(homeGoalie?.position.x).toBe(GOALIE_CONFIG.homeX);
    expect(homeGoalie?.position.y).toBeGreaterThan(RINK_CONFIG.height / 2);
    expect(homeGoalie?.position.y).toBeLessThanOrEqual(
      RINK_CONFIG.height / 2 + GOALIE_CONFIG.creaseHalfHeight
    );
  });

  it("produces save rebounds and save stats for reachable shots", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    const homeGoalie = world.goalies.find((goalie) => goalie.teamId === "home");
    if (!homeGoalie) {
      throw new Error("Missing home goalie");
    }
    world.puck.position = { x: homeGoalie.position.x + 20, y: homeGoalie.position.y };
    world.puck.velocity = { x: -900, y: 0 };
    world.puck.shotBySlotId = "away-skater-1";

    stepWorld(world, [], 16);

    expect(world.score.away).toBe(0);
    expect(world.stats.saves.home).toBe(1);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(world.eventQueue).toContainEqual(
      expect.objectContaining({ type: "save", targetSlotId: "home-goalie" })
    );
  });
});
