import { describe, expect, it } from "vitest";
import { createWorld } from "@bbh/arcade-core";
import { interpolateSkaters, interpolateVector } from "./interpolation.js";

describe("snapshot interpolation", () => {
  it("lerps vector values with clamped alpha", () => {
    expect(interpolateVector({ x: 0, y: 10 }, { x: 10, y: 20 }, 0.5)).toEqual({
      x: 5,
      y: 15
    });
    expect(interpolateVector({ x: 0, y: 0 }, { x: 10, y: 10 }, 2)).toEqual({
      x: 10,
      y: 10
    });
  });

  it("interpolates remote skaters while leaving the local skater authoritative", () => {
    const previous = createWorld(1, "arcade3v3");
    const current = createWorld(1, "arcade3v3");
    previous.skaters[0].position.x = 100;
    current.skaters[0].position.x = 200;
    previous.skaters[1].position.x = 300;
    current.skaters[1].position.x = 500;

    const skaters = interpolateSkaters(previous, current, 0.5, "home-skater-1");

    expect(skaters[0].position.x).toBe(200);
    expect(skaters[1].position.x).toBe(400);
  });
});
