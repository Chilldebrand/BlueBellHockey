import { RINK_CONFIG } from "@bbh/arcade-core";
import { describe, expect, it } from "vitest";
import {
  ARENA_MAX_STRUCTURE_HEIGHT,
  bowlRowLength,
  computeArenaLayout,
  standOuterEdge
} from "./arenaLayout.js";
import {
  ARENA_CROWD_SEED,
  BRIGHT_APPAREL_COLORS,
  cornerTurn,
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
      // Rows grow outward up the rake, so the widest legal span is the LAST
      // row's — that is exactly the corner seating the continuous bowl added.
      const widestRun = bowlRowLength(stand, stand.rowCount - 1);
      expect(along).toBeGreaterThan(stand.centerAlong - widestRun / 2 - 10);
      expect(along).toBeLessThan(stand.centerAlong + widestRun / 2 + 10);
      expect(fan.position.y).toBeLessThan(ARENA_MAX_STRUCTURE_HEIGHT);
      expect(fan.position.y).toBeGreaterThanOrEqual(stand.baseHeight);
    }
  });

  it("stays under the full-detail cap with a substantial bowl population", () => {
    const crowd = generateCrowd(LAYOUT, ARENA_CROWD_SEED, "full");

    // STRICTLY below: hitting the cap truncates whichever stands generate
    // last, which shows up in game as one side of the bowl sitting empty.
    expect(crowd.spectators.length).toBeLessThan(FULL_DETAIL_FAN_CAP);
    expect(crowd.spectators.length).toBeGreaterThan(1200);
  });

  it("seats fans around the corners, past both ends of the rink footprint", () => {
    const crowd = generateCrowd(LAYOUT, ARENA_CROWD_SEED, "full");
    const south = crowd.spectators.filter((fan) => fan.standId === "south");

    // The old bowl cut every stand 320 short of the corner and parked a black
    // block in the gap; the continuous bowl must actually put people there.
    expect(south.some((fan) => fan.position.x < 0)).toBe(true);
    expect(south.some((fan) => fan.position.x > RINK_CONFIG.width)).toBe(true);
  });

  it("turns corner seats toward the rink and leaves the rest square on", () => {
    const stand = LAYOUT.stands.find((candidate) => candidate.id === "south")!;
    const width = RINK_CONFIG.width;
    const overshoot = 400;

    expect(cornerTurn(stand, width / 2, width, overshoot)).toBe(0);

    // South fans face +z (yaw 0). Past the +x end they need a -x component,
    // which is a negative yaw; past the -x end, the mirror image.
    const pastFarEnd = cornerTurn(stand, width + overshoot, width, overshoot);
    const pastNearEnd = cornerTurn(stand, -overshoot, width, overshoot);

    expect(Math.sin(pastFarEnd)).toBeLessThan(0);
    expect(Math.sin(pastNearEnd)).toBeGreaterThan(0);
    expect(pastFarEnd).toBe(-pastNearEnd);
  });

  it("ramps the corner turn with distance round the bend", () => {
    const stand = LAYOUT.stands.find((candidate) => candidate.id === "east")!;
    const height = RINK_CONFIG.height;

    const justPast = Math.abs(cornerTurn(stand, height + 40, height, 400));
    const wellPast = Math.abs(cornerTurn(stand, height + 400, height, 400));

    expect(justPast).toBeGreaterThan(0);
    expect(wellPast).toBeGreaterThan(justPast);
    // Never so far round that a fan has their back to the ice.
    expect(wellPast).toBeLessThan(Math.PI / 4);
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
