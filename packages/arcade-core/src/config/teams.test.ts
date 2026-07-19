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
    // Distinctness comes from opposing hues (blue vs red), not luminance - a
    // bright red and a bright blue can be equally light yet unmistakable.
    const channel = (hex: string, index: number) =>
      Number.parseInt(hex.replace("#", "").slice(index * 2, index * 2 + 2), 16);
    const home = TEAM_PALETTES.home.uniform.jersey;
    const away = TEAM_PALETTES.away.uniform.jersey;

    // Home reads blue (blue channel dominates red)...
    expect(channel(home, 2)).toBeGreaterThan(channel(home, 0) * 2);
    // ...away reads red (red channel dominates blue).
    expect(channel(away, 0)).toBeGreaterThan(channel(away, 2) * 2);
  });

  it("uses one primary color from skater jersey through pants and socks", () => {
    expect(TEAM_PALETTES.home.uniform.jersey).toBe("#1267d8");
    expect(TEAM_PALETTES.away.uniform.jersey).toBe("#b3132b");

    for (const teamId of TEAM_IDS) {
      const uniform = TEAM_PALETTES[teamId].uniform;
      expect(uniform.pants).toBe(uniform.jersey);
      expect(uniform.socks).toBe(uniform.jersey);
      expect(uniform.numbers).toBe("#ffffff");
      expect(uniform.trim).toBe("#ffffff");
    }
  });
});
