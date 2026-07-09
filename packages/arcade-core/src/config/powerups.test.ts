import { describe, expect, it } from "vitest";
import {
  POWERUP_DEFINITIONS,
  POWERUP_SPAWN_POINTS,
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

  it("chooses deterministic spawn types from seed and index", () => {
    // (seed + index) % 6 indexes into POWERUP_TYPES.
    expect(powerupTypeForSpawn(1, 0)).toBe("hard-shot"); // 1
    expect(powerupTypeForSpawn(1, 1)).toBe("freeze"); // 2
    expect(powerupTypeForSpawn(1, 2)).toBe("bulldozer"); // 3
    expect(powerupTypeForSpawn(1, 3)).toBe("mini-goalie"); // 4
    expect(powerupTypeForSpawn(1, 4)).toBe("giant-goalie"); // 5
    expect(powerupTypeForSpawn(1, 5)).toBe("speed-boost"); // 0 (wraps)
    // Cycle repeats every 6.
    expect(powerupTypeForSpawn(1, 6)).toBe("hard-shot");
  });

  it("decides banana-peel spawns deterministically (every 3rd)", () => {
    expect(isBananaSpawn(1, 2)).toBe(true); // (1+2) % 3 === 0
    expect(isBananaSpawn(1, 0)).toBe(false);
    expect(isBananaSpawn(1, 1)).toBe(false);
    expect(isBananaSpawn(0, 3)).toBe(true);
  });
});
