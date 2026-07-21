import { RINK_CONFIG } from "@bbh/arcade-core";
import { describe, expect, it } from "vitest";
import {
  ARENA_MAX_STRUCTURE_HEIGHT,
  computeArenaLayout,
  STAND_CLEARANCE,
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

  it("keeps corner blocks outside the rink footprint", () => {
    for (const rink of [RINK_CONFIG, ARBITRARY_RINK]) {
      const layout = computeArenaLayout(rink);

      expect(layout.corners).toHaveLength(4);
      for (const corner of layout.corners) {
        const minX = corner.center.x - corner.sizeX / 2;
        const maxX = corner.center.x + corner.sizeX / 2;
        const minZ = corner.center.z - corner.sizeZ / 2;
        const maxZ = corner.center.z + corner.sizeZ / 2;
        // Each block must not reach into the footprint interior: at least one
        // axis extent stays entirely at or beyond a footprint edge.
        const outsideX = maxX <= 0 || minX >= rink.width;
        const outsideZ = maxZ <= 0 || minZ >= rink.height;
        expect(outsideX || outsideZ).toBe(true);
        expect(corner.height).toBeLessThan(ARENA_MAX_STRUCTURE_HEIGHT);
      }
    }
  });

  it("is pure: identical inputs produce deeply equal layouts", () => {
    expect(computeArenaLayout(RINK_CONFIG)).toEqual(
      computeArenaLayout({ ...RINK_CONFIG })
    );
  });
});
