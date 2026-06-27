import { describe, expect, it } from "vitest";
import {
  ARCADE_CHARACTERS,
  CHARACTER_STAT_BUDGET,
  CHARACTER_STAT_KEYS,
  characterStatTotal
} from "./characters.js";
import { SPECIAL_IDS } from "./specials.js";

describe("arcade characters", () => {
  it("defines 10 to 12 original characters with unique ids", () => {
    const ids = ARCADE_CHARACTERS.map((character) => character.id);

    expect(ARCADE_CHARACTERS.length).toBeGreaterThanOrEqual(10);
    expect(ARCADE_CHARACTERS.length).toBeLessThanOrEqual(12);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every character on the fixed stat budget", () => {
    for (const character of ARCADE_CHARACTERS) {
      expect(Object.keys(character.stats).sort()).toEqual(
        [...CHARACTER_STAT_KEYS].sort()
      );
      expect(characterStatTotal(character.stats)).toBe(CHARACTER_STAT_BUDGET);
      expect(Math.min(...Object.values(character.stats))).toBeGreaterThanOrEqual(2);
      expect(Math.max(...Object.values(character.stats))).toBeLessThanOrEqual(5);
    }
  });

  it("uses valid special ids and non-branded original names", () => {
    const forbidden = /\b(nhl|maple|leafs|rangers|bruins|penguins|canadiens|oilers|gretzky|crosby|ovechkin)\b/i;

    for (const character of ARCADE_CHARACTERS) {
      expect(SPECIAL_IDS).toContain(character.specialId);
      expect(character.displayName).not.toMatch(forbidden);
      expect(character.silhouette).not.toMatch(forbidden);
    }
  });
});
