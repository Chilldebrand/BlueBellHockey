import { describe, expect, it } from "vitest";
import { TEAM_IDS, TEAM_PALETTES, contrastRatio } from "./teams.js";

describe("arcade team palettes", () => {
  it("defines readable original palettes for both teams", () => {
    expect(Object.keys(TEAM_PALETTES).sort()).toEqual([...TEAM_IDS].sort());

    for (const teamId of TEAM_IDS) {
      const palette = TEAM_PALETTES[teamId];

      expect(palette.displayName).not.toMatch(/\b(nhl|rangers|bruins|leafs)\b/i);
      expect(contrastRatio(palette.uniform.jersey, palette.uniform.numbers)).toBeGreaterThan(4.5);
      expect(contrastRatio(palette.uniform.jersey, palette.uniform.trim)).toBeGreaterThan(2);
    }
  });

  it("keeps home and away palettes visually distinct", () => {
    expect(
      contrastRatio(
        TEAM_PALETTES.home.uniform.jersey,
        TEAM_PALETTES.away.uniform.jersey
      )
    ).toBeGreaterThan(2.5);
  });
});
