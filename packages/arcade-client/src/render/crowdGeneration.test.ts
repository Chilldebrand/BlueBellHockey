import { RINK_CONFIG } from "@bbh/arcade-core";
import { describe, expect, it } from "vitest";
import {
  ARENA_MAX_STRUCTURE_HEIGHT,
  computeArenaLayout,
  standOuterEdge
} from "./arenaLayout.js";
import {
  ARENA_CROWD_SEED,
  BRIGHT_APPAREL_COLORS,
  FULL_DETAIL_FAN_CAP,
  generateCrowd,
  NEUTRAL_APPAREL_COLORS,
  REDUCED_DETAIL_FAN_CAP,
  TEAM_ACCENT_APPAREL_COLORS
} from "./crowdGeneration.js";

const LAYOUT = computeArenaLayout(RINK_CONFIG);
const ALL_APPAREL_COLORS = [
  ...NEUTRAL_APPAREL_COLORS,
  ...TEAM_ACCENT_APPAREL_COLORS,
  ...BRIGHT_APPAREL_COLORS
];

describe("generateCrowd", () => {
  it("returns the identical crowd for the same layout, seed, and detail", () => {
    expect(generateCrowd(LAYOUT, ARENA_CROWD_SEED, "full")).toEqual(
      generateCrowd(LAYOUT, ARENA_CROWD_SEED, "full")
    );
  });

  it("restyles with a different seed without changing count or bounds", () => {
    const first = generateCrowd(LAYOUT, 1, "full");
    const second = generateCrowd(LAYOUT, 2, "full");

    expect(second.spectators.length).toBe(first.spectators.length);
    expect(second.countByStand).toEqual(first.countByStand);
    expect(
      second.spectators.some(
        (fan, index) =>
          fan.apparelColor !== first.spectators[index]!.apparelColor ||
          fan.skinTone !== first.spectators[index]!.skinTone ||
          fan.apparel !== first.spectators[index]!.apparel
      )
    ).toBe(true);
  });

  it("keeps every fan inside its stand footprint and under the height ceiling", () => {
    const bySide = new Map(LAYOUT.stands.map((stand) => [stand.id, stand]));

    for (const fan of generateCrowd(LAYOUT, ARENA_CROWD_SEED, "full").spectators) {
      const stand = bySide.get(fan.standId)!;
      const facing = stand.axis === "x" ? fan.position.z : fan.position.x;
      const along = stand.axis === "x" ? fan.position.x : fan.position.z;
      const outer = standOuterEdge(stand);

      if (stand.direction === -1) {
        expect(facing).toBeLessThan(stand.innerEdge);
        expect(facing).toBeGreaterThan(outer);
      } else {
        expect(facing).toBeGreaterThan(stand.innerEdge);
        expect(facing).toBeLessThan(outer);
      }
      expect(along).toBeGreaterThan(stand.centerAlong - stand.length / 2 - 10);
      expect(along).toBeLessThan(stand.centerAlong + stand.length / 2 + 10);
      expect(fan.position.y).toBeLessThan(ARENA_MAX_STRUCTURE_HEIGHT);
      expect(fan.position.y).toBeGreaterThanOrEqual(stand.baseHeight);
    }
  });

  it("stays under the full-detail cap with a substantial bowl population", () => {
    const crowd = generateCrowd(LAYOUT, ARENA_CROWD_SEED, "full");

    expect(crowd.spectators.length).toBeLessThanOrEqual(FULL_DETAIL_FAN_CAP);
    expect(crowd.spectators.length).toBeGreaterThan(1200);
  });

  it("halves density in reduced detail, drops accessories, and keeps all four stands", () => {
    const full = generateCrowd(LAYOUT, ARENA_CROWD_SEED, "full");
    const reduced = generateCrowd(LAYOUT, ARENA_CROWD_SEED, "reduced");

    expect(reduced.spectators.length).toBeLessThanOrEqual(REDUCED_DETAIL_FAN_CAP);
    expect(reduced.spectators.length).toBeGreaterThan(full.spectators.length * 0.4);
    expect(reduced.spectators.length).toBeLessThan(full.spectators.length * 0.6);
    expect(reduced.spectators.every((fan) => fan.accessory === "none")).toBe(true);
    expect(new Set(reduced.spectators.map((fan) => fan.standId)).size).toBe(4);
  });

  it("mixes apparel categories in every stand with a minority of team accents", () => {
    const crowd = generateCrowd(LAYOUT, ARENA_CROWD_SEED, "full");

    for (const stand of LAYOUT.stands) {
      const fans = crowd.spectators.filter((fan) => fan.standId === stand.id);
      expect(new Set(fans.map((fan) => fan.apparel)).size).toBeGreaterThanOrEqual(3);
    }

    const accentShare =
      crowd.spectators.filter((fan) =>
        TEAM_ACCENT_APPAREL_COLORS.includes(fan.apparelColor)
      ).length / crowd.spectators.length;
    expect(accentShare).toBeLessThan(0.4);
    expect(accentShare).toBeGreaterThan(0.05);
    expect(
      crowd.spectators.every((fan) => ALL_APPAREL_COLORS.includes(fan.apparelColor))
    ).toBe(true);
  });

  it("never reaches for Math.random", () => {
    expect(generateCrowd.toString()).not.toContain("Math.random");
  });
});
