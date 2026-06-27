import { describe, expect, it } from "vitest";
import { ARCADE_CHARACTERS } from "./characters.js";
import { CHARACTER_SPECIALS, SPECIAL_IDS } from "./specials.js";

describe("special config", () => {
  it("defines cooldown and duration rules for every special", () => {
    for (const special of CHARACTER_SPECIALS) {
      expect(special.chargeRequired).toBe(1);
      expect(special.cooldownMs).toBeGreaterThan(0);
      expect(special.durationMs).toBeGreaterThan(0);
    }
  });

  it("keeps every character special valid", () => {
    for (const character of ARCADE_CHARACTERS) {
      expect(SPECIAL_IDS).toContain(character.specialId);
    }
  });
});
