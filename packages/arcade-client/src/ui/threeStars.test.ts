import { describe, expect, it } from "vitest";
import { createWorld, type WorldState } from "@bbh/arcade-core";
import { selectThreeStars } from "./threeStars.js";

function worldWithStats(
  stats: Record<string, { goals: number; assists: number; hits: number }>
): WorldState {
  const world = createWorld(7, "quickplay");
  for (const [slotId, line] of Object.entries(stats)) {
    world.stats.players[slotId] = line;
  }
  return world;
}

describe("selectThreeStars", () => {
  it("scores goals, assists, and hits with 5/3/1 weights", () => {
    const world = worldWithStats({
      "home-skater-1": { goals: 1, assists: 0, hits: 0 },
      "home-skater-2": { goals: 0, assists: 1, hits: 1 },
      "home-skater-3": { goals: 0, assists: 0, hits: 4 }
    });

    expect(selectThreeStars(world).slice(0, 3).map((star) => star.score)).toEqual([
      5,
      4,
      4
    ]);
  });

  it("breaks ties by goals, assists, hits, then slot ID", () => {
    const world = worldWithStats({
      "home-skater-1": { goals: 2, assists: 0, hits: 0 },
      "home-skater-2": { goals: 1, assists: 1, hits: 2 },
      "home-skater-3": { goals: 0, assists: 2, hits: 4 },
      "away-skater-1": { goals: 1, assists: 0, hits: 5 },
      "away-skater-2": { goals: 0, assists: 3, hits: 1 },
      "away-skater-3": { goals: 0, assists: 0, hits: 0 }
    });

    expect(selectThreeStars(world).map((star) => star.slotId)).toEqual([
      "home-skater-1",
      "home-skater-2",
      "away-skater-1"
    ]);
  });

  it("uses slot ID as the final deterministic tie-break", () => {
    const world = worldWithStats({
      "home-skater-1": { goals: 0, assists: 0, hits: 0 },
      "home-skater-2": { goals: 0, assists: 0, hits: 0 },
      "home-skater-3": { goals: 0, assists: 0, hits: 0 },
      "away-skater-1": { goals: 0, assists: 0, hits: 0 },
      "away-skater-2": { goals: 0, assists: 0, hits: 0 },
      "away-skater-3": { goals: 0, assists: 0, hits: 0 }
    });

    expect(selectThreeStars(world).map((star) => star.slotId)).toEqual([
      "away-skater-1",
      "away-skater-2",
      "away-skater-3"
    ]);
  });

  it("includes all eligible skaters across teams and returns exactly three", () => {
    const world = worldWithStats({
      "home-skater-1": { goals: 1, assists: 0, hits: 0 },
      "home-skater-2": { goals: 0, assists: 0, hits: 0 },
      "home-skater-3": { goals: 0, assists: 0, hits: 0 },
      "away-skater-1": { goals: 0, assists: 1, hits: 2 },
      "away-skater-2": { goals: 0, assists: 0, hits: 5 },
      "away-skater-3": { goals: 0, assists: 0, hits: 0 }
    });

    const stars = selectThreeStars(world);

    expect(stars).toHaveLength(3);
    expect(stars.map((star) => star.slotId)).toEqual([
      "home-skater-1",
      "away-skater-1",
      "away-skater-2"
    ]);
    expect(stars.map((star) => star.rank)).toEqual([1, 2, 3]);
    expect(stars[0]).toMatchObject({
      teamId: "home",
      characterId: world.skaters[0].characterId,
      goals: 1,
      assists: 0,
      hits: 0,
      score: 5
    });
  });
});
