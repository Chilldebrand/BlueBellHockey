import { describe, expect, it } from "vitest";
import {
  BANANA_SPAWN_EVERY,
  POWERUP_DEFINITIONS,
  POWERUP_SPAWN_POINTS,
  POWERUP_SPAWN_WEIGHTS,
  POWERUP_TYPES,
  isBananaSpawn,
  powerupTypeForSpawn
} from "./powerups.js";

describe("powerup config", () => {
  it("defines the six active arcade powerups", () => {
    expect(POWERUP_TYPES).toEqual([
      "speed-boost",
      "hard-shot",
      "freeze",
      "bulldozer",
      "mini-goalie",
      "giant-goalie"
    ]);
    expect(Object.keys(POWERUP_DEFINITIONS)).toHaveLength(6);
    expect(POWERUP_SPAWN_POINTS.length).toBeGreaterThanOrEqual(3);
  });

  it("chooses spawn types deterministically from seed and index", () => {
    for (let index = 0; index < 24; index += 1) {
      expect(powerupTypeForSpawn(7, index)).toBe(powerupTypeForSpawn(7, index));
      expect(POWERUP_TYPES).toContain(powerupTypeForSpawn(7, index));
      expect(isBananaSpawn(7, index)).toBe(isBananaSpawn(7, index));
    }
    // Different seeds diverge somewhere in a match's worth of spawns.
    const seedsDiffer = Array.from({ length: 20 }, (_, index) =>
      powerupTypeForSpawn(1, index)
    ).join() !==
      Array.from({ length: 20 }, (_, index) =>
        powerupTypeForSpawn(2, index)
      ).join();
    expect(seedsDiffer).toBe(true);
  });

  it("makes every powerup type reachable in play", () => {
    // Regression: the old linear (seed+index) selection was correlated with
    // the banana check and the round-robin point, so speed-boost and
    // bulldozer could never spawn for ANY seed.
    for (const seed of [1, 2, 3, 7, 42, 1337]) {
      const seen = new Set<string>();
      for (let index = 0; index < 120; index += 1) {
        if (!isBananaSpawn(seed, index)) {
          seen.add(powerupTypeForSpawn(seed, index));
        }
      }
      expect([...seen].sort()).toEqual([...POWERUP_TYPES].sort());
    }
  });

  it("weights goalie resizes rarer and freeze/speed more frequent", () => {
    const counts: Record<string, number> = {};
    const total = 4000;
    for (let index = 0; index < total; index += 1) {
      const type = powerupTypeForSpawn(9, index);
      counts[type] = (counts[type] ?? 0) + 1;
    }

    const weightTotal = POWERUP_TYPES.reduce(
      (sum, type) => sum + POWERUP_SPAWN_WEIGHTS[type],
      0
    );
    for (const type of POWERUP_TYPES) {
      const expected = (POWERUP_SPAWN_WEIGHTS[type] / weightTotal) * total;
      // Hash output is uniform, so each bucket lands near its weight share.
      expect(counts[type]).toBeGreaterThan(expected * 0.7);
      expect(counts[type]).toBeLessThan(expected * 1.3);
    }
    expect(counts["freeze"]).toBeGreaterThan(counts["mini-goalie"]);
    expect(counts["speed-boost"]).toBeGreaterThan(counts["giant-goalie"]);
  });

  it("spreads banana peels across spawn points at a bounded rate", () => {
    for (const seed of [1, 2, 3, 7, 42]) {
      const bananaPoints = new Set<number>();
      let bananas = 0;
      const total = 300;
      for (let index = 0; index < total; index += 1) {
        if (isBananaSpawn(seed, index)) {
          bananas += 1;
          bananaPoints.add(index % POWERUP_SPAWN_POINTS.length);
        }
      }
      // ~1 in BANANA_SPAWN_EVERY on average, and not pinned to one point.
      expect(bananas).toBeGreaterThan(total / (BANANA_SPAWN_EVERY * 2));
      expect(bananas).toBeLessThan(total / (BANANA_SPAWN_EVERY / 2));
      expect(bananaPoints.size).toBeGreaterThan(1);
    }
  });
});
