import { describe, expect, it } from "vitest";
import { STICK_CONFIG, lateralBladeOffset } from "../index";

const RIGHT_EXTENT = lateralBladeOffset(1);
const LEFT_EXTENT = lateralBladeOffset(-1);

describe("lateral stick reach", () => {
  it("reaches +84 on the forehand side — two 15% cuts off the old 116.5", () => {
    expect(RIGHT_EXTENT).toBeCloseTo(84, 6);
    expect(RIGHT_EXTENT).toBeCloseTo(116.5 * 0.85 * 0.85, 0);
  });

  it("reaches 80% of that across the body on the backhand side", () => {
    expect(LEFT_EXTENT).toBeCloseTo(-67.2, 6);
    expect(Math.abs(LEFT_EXTENT) / RIGHT_EXTENT).toBeCloseTo(0.8, 3);
  });

  it("keeps the total sweep near the original 144, not the 178 first pass", () => {
    // The first attempt cut the right end but opened the left so far that the
    // whole arc grew — which read in play as MORE reach, not less.
    expect(RIGHT_EXTENT - LEFT_EXTENT).toBeCloseTo(151.2, 1);
  });

  it("rests at the forehand carry offset with the stick centred", () => {
    expect(lateralBladeOffset(0)).toBe(STICK_CONFIG.restLateral);
  });

  it("is continuous through the centre so a sweep never jumps", () => {
    // The two ranges differ, so the gap either side of centre must shrink
    // with the step — a discontinuity would hold it at a fixed size.
    const wide = lateralBladeOffset(1e-4) - lateralBladeOffset(-1e-4);
    const narrow = lateralBladeOffset(1e-6) - lateralBladeOffset(-1e-6);

    expect(Math.abs(narrow)).toBeLessThan(Math.abs(wide) / 50);
    expect(Math.abs(narrow)).toBeLessThan(1e-3);
  });

  it("moves monotonically from the backhand extent to the forehand extent", () => {
    let previous = LEFT_EXTENT;

    for (let localX = -0.9; localX <= 1.0001; localX += 0.1) {
      const offset = lateralBladeOffset(localX);
      expect(offset).toBeGreaterThan(previous);
      previous = offset;
    }
  });

  it("crosses the body on the backhand — the old reach never did", () => {
    // Old config bottomed out at -27.5, still outside the hip; the point of
    // the change is that a backhand dangle now actually reaches across.
    expect(LEFT_EXTENT).toBeLessThan(-27.5);
  });
});
