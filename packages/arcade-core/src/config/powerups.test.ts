import { describe, expect, it } from "vitest";
import {
  POWERUP_DEFINITIONS,
  POWERUP_SPAWN_POINTS,
  POWERUP_TYPES,
  powerupTypeForSpawn
} from "./powerups.js";

describe("powerup config", () => {
  it("defines six original short-lived arcade powerups", () => {
    expect(POWERUP_TYPES).toEqual([
      "speed-boost",
      "hard-shot",
      "goalie-freeze",
      "puck-magnet",
      "shield",
      "instant-special"
    ]);
    expect(Object.keys(POWERUP_DEFINITIONS)).toHaveLength(6);
    expect(POWERUP_SPAWN_POINTS.length).toBeGreaterThanOrEqual(3);
  });

  it("chooses deterministic spawn types from seed and index", () => {
    expect(powerupTypeForSpawn(1, 0)).toBe("hard-shot");
    expect(powerupTypeForSpawn(1, 6)).toBe("hard-shot");
  });
});
