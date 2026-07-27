import { RINK_CONFIG } from "@bbh/arcade-core";
import { describe, expect, it } from "vitest";
import {
  ARENA_MAX_STRUCTURE_HEIGHT,
  bowlRowLength,
  computeArenaLayout,
  STAND_CLEARANCE,
  STAND_ROW_DEPTH,
  STAND_SETBACK,
  standOuterEdge
} from "./arenaLayout.js";

const ARBITRARY_RINK = { width: 4000, height: 900 };

describe("computeArenaLayout", () => {
  it("derives four distinct stands, two per axis, for any rink size", () => {
    for (const rink of [RINK_CONFIG, ARBITRARY_RINK]) {
      const layout = computeArenaLayout(rink);

      expect(layout.stands).toHaveLength(4);
      expect(new Set(layout.stands.map((stand) => stand.id)).size).toBe(4);
      expect(layout.stands.filter((stand) => stand.axis === "x")).toHaveLength(2);
      expect(layout.stands.filter((stand) => stand.axis === "z")).toHaveLength(2);
    }
  });

  it("keeps every stand's inner edge at least the clearance outside the rink footprint", () => {
    for (const rink of [RINK_CONFIG, ARBITRARY_RINK]) {
      const layout = computeArenaLayout(rink);

      for (const stand of layout.stands) {
        // The facing axis of an x-running stand is z (footprint 0..height)
        // and vice versa.
        const footprintMax = stand.axis === "x" ? rink.height : rink.width;
        if (stand.direction === -1) {
          expect(stand.innerEdge).toBeLessThanOrEqual(-STAND_CLEARANCE);
        } else {
          expect(stand.innerEdge).toBeGreaterThanOrEqual(
            footprintMax + STAND_CLEARANCE
          );
        }
      }
    }
  });

  it("keeps stand rake in the spec band and under the camera-safe ceiling", () => {
    const layout = computeArenaLayout(RINK_CONFIG);

    for (const stand of layout.stands) {
      expect(stand.rowCount).toBeGreaterThanOrEqual(8);
      expect(stand.rowCount).toBeLessThanOrEqual(12);
      expect(stand.topHeight).toBeGreaterThanOrEqual(350);
      expect(stand.topHeight).toBeLessThanOrEqual(400);
      expect(stand.topHeight).toBeLessThan(ARENA_MAX_STRUCTURE_HEIGHT);
    }
    expect(layout.wall.height).toBeLessThan(ARENA_MAX_STRUCTURE_HEIGHT);
    expect(ARENA_MAX_STRUCTURE_HEIGHT).toBeLessThan(940);
  });

  it("encloses every stand's outer edge inside the wall", () => {
    for (const rink of [RINK_CONFIG, ARBITRARY_RINK]) {
      const layout = computeArenaLayout(rink);

      for (const stand of layout.stands) {
        const outer = standOuterEdge(stand);
        if (stand.direction === -1) {
          const wallMin = stand.axis === "x" ? layout.wall.minZ : layout.wall.minX;
          expect(outer).toBeGreaterThan(wallMin);
        } else {
          const wallMax = stand.axis === "x" ? layout.wall.maxZ : layout.wall.maxX;
          expect(outer).toBeLessThan(wallMax);
        }
      }
    }
  });

  // The bowl is nested rectangular rings. Each row's x-running pair must own
  // the corner squares outright and its z-running pair must stop exactly where
  // that coverage starts: any shortfall is a black corner void (the bug this
  // replaced), any excess is two coplanar top faces fighting for the depth
  // buffer.
  it("tiles every row corner-to-corner with no gap and no overlap", () => {
    for (const rink of [RINK_CONFIG, ARBITRARY_RINK]) {
      const layout = computeArenaLayout(rink);
      const xRunner = layout.stands.find((stand) => stand.axis === "x")!;
      const zRunner = layout.stands.find((stand) => stand.axis === "z")!;

      for (let row = 0; row < xRunner.rowCount; row += 1) {
        const innerOffset = STAND_SETBACK + row * STAND_ROW_DEPTH;
        const outerOffset = innerOffset + STAND_ROW_DEPTH;

        // The x-running row reaches the ring's OUTER offset past both rink
        // ends, so it covers the full corner square.
        expect(bowlRowLength(xRunner, row)).toBe(rink.width + 2 * outerOffset);
        // The z-running row stops at the ring's INNER offset — precisely the
        // near edge of what the x-running row already covers.
        expect(bowlRowLength(zRunner, row)).toBe(rink.height + 2 * innerOffset);
      }
    }
  });

  it("grows every row outward so no row is shorter than the one in front", () => {
    const layout = computeArenaLayout(RINK_CONFIG);

    for (const stand of layout.stands) {
      for (let row = 1; row < stand.rowCount; row += 1) {
        expect(bowlRowLength(stand, row)).toBeGreaterThan(
          bowlRowLength(stand, row - 1)
        );
      }
    }
  });

  it("keeps the apron between the boards and the first row of seats", () => {
    for (const rink of [RINK_CONFIG, ARBITRARY_RINK]) {
      const { apron } = computeArenaLayout(rink);

      expect(apron.innerDepth).toBeLessThan(apron.outerDepth);
      expect(apron.outerDepth).toBe(STAND_SETBACK);
      // Thin enough that skaters and the puck are never visually on top of it.
      expect(apron.thickness).toBeLessThan(10);
    }
  });

  it("is pure: identical inputs produce deeply equal layouts", () => {
    expect(computeArenaLayout(RINK_CONFIG)).toEqual(
      computeArenaLayout({ ...RINK_CONFIG })
    );
  });
});
