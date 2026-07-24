import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEAM_IDENTITIES,
  TEAM_IDENTITIES,
  TEAM_IDENTITY_IDS,
  TEAM_IDS,
  TEAM_PALETTES,
  contrastRatio,
  isTeamIdentityId,
  teamIdentityFor
} from "./teams.js";

describe("team identity catalog", () => {
  it("defines readable, original identities with unique looks and names", () => {
    expect(Object.keys(TEAM_IDENTITIES).sort()).toEqual(
      [...TEAM_IDENTITY_IDS].sort()
    );

    const jerseys = new Set<string>();
    const shortNames = new Set<string>();
    const displayNames = new Set<string>();

    for (const identityId of TEAM_IDENTITY_IDS) {
      const identity = TEAM_IDENTITIES[identityId];

      expect(identity.id).toBe(identityId);
      expect(identity.displayName).not.toMatch(/\b(nhl|rangers|bruins|leafs)\b/i);
      expect(identity.shortName).toMatch(/^[A-Z]{3}$/);
      // Jersey numbers must stay readable on every jersey color.
      expect(
        contrastRatio(identity.uniform.jersey, identity.uniform.numbers)
      ).toBeGreaterThan(3.5);
      // One primary color from jersey through pants and socks.
      expect(identity.uniform.pants).toBe(identity.uniform.jersey);
      expect(identity.uniform.socks).toBe(identity.uniform.jersey);

      jerseys.add(identity.uniform.jersey);
      shortNames.add(identity.shortName);
      displayNames.add(identity.displayName);
    }

    expect(jerseys.size).toBe(TEAM_IDENTITY_IDS.length);
    expect(shortNames.size).toBe(TEAM_IDENTITY_IDS.length);
    expect(displayNames.size).toBe(TEAM_IDENTITY_IDS.length);
  });

  it("keeps the default matchup visually distinct (blue vs red)", () => {
    const channel = (hex: string, index: number) =>
      Number.parseInt(hex.replace("#", "").slice(index * 2, index * 2 + 2), 16);
    const home = TEAM_IDENTITIES[DEFAULT_TEAM_IDENTITIES.home].uniform.jersey;
    const away = TEAM_IDENTITIES[DEFAULT_TEAM_IDENTITIES.away].uniform.jersey;

    expect(channel(home, 2)).toBeGreaterThan(channel(home, 0) * 2);
    expect(channel(away, 0)).toBeGreaterThan(channel(away, 2) * 2);
  });

  it("derives the legacy side palettes from the default identities", () => {
    expect(Object.keys(TEAM_PALETTES).sort()).toEqual([...TEAM_IDS].sort());
    expect(TEAM_PALETTES.home.id).toBe("home");
    expect(TEAM_PALETTES.away.id).toBe("away");
    expect(TEAM_PALETTES.home.uniform).toEqual(
      TEAM_IDENTITIES["blue-blades"].uniform
    );
    expect(TEAM_PALETTES.away.uniform).toEqual(
      TEAM_IDENTITIES["red-rockets"].uniform
    );
  });

  it("validates identity ids and falls back to side defaults", () => {
    expect(isTeamIdentityId("purple-phantoms")).toBe(true);
    expect(isTeamIdentityId("maroon-marauders")).toBe(false);
    expect(isTeamIdentityId(7)).toBe(false);
    expect(isTeamIdentityId(null)).toBe(false);

    expect(teamIdentityFor("home", "gold-gauntlets").id).toBe("gold-gauntlets");
    expect(teamIdentityFor("home", "nope").id).toBe("blue-blades");
    expect(teamIdentityFor("away", null).id).toBe("red-rockets");
    expect(teamIdentityFor("away", undefined).id).toBe("red-rockets");
  });
});
