import { describe, expect, it } from "vitest";
import { frontGripT, lerp3, segmentBetween } from "./stickGeometry.js";

// Matches CharacterModel's rig: shoulders sit at forward 0, the butt and the
// grip floor at 6, and the hands ride the shaft at these fractions.
const BUTT_FORWARD = 6;
const MIN_FORWARD = 6;
const TOP_HAND_T = 0.16;
const LOW_HAND_T = 0.42;

describe("frontGripT", () => {
  it("leaves the grip alone when the whole shaft is already in front", () => {
    expect(frontGripT(BUTT_FORWARD, 40, TOP_HAND_T, MIN_FORWARD)).toBe(TOP_HAND_T);
    expect(frontGripT(BUTT_FORWARD, 40, LOW_HAND_T, MIN_FORWARD)).toBe(LOW_HAND_T);
  });

  it("keeps both hands in front when the blade is drawn back", () => {
    // Full pull-back: sim blade x = 22 - 78 = -56, model-local /1.6 = -35.
    const bladeForward = -35;

    for (const t of [TOP_HAND_T, LOW_HAND_T]) {
      const clamped = frontGripT(BUTT_FORWARD, bladeForward, t, MIN_FORWARD);
      const handForward =
        BUTT_FORWARD + clamped * (bladeForward - BUTT_FORWARD);

      expect(handForward).toBeGreaterThanOrEqual(MIN_FORWARD - 1e-9);
    }
  });

  it("chokes the hands up the shaft rather than lifting them off it", () => {
    // Clamping the FRACTION (not the point) is what keeps butt, hands and
    // blade collinear — the gloves must stay on the shaft.
    const bladeForward = -35;
    const t = frontGripT(BUTT_FORWARD, bladeForward, LOW_HAND_T, MIN_FORWARD);

    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThan(LOW_HAND_T);
  });

  it("never pushes a grip past the blade or behind the butt", () => {
    for (const bladeForward of [-60, -35, -6, 0, 5.9, 6, 30]) {
      for (const t of [TOP_HAND_T, LOW_HAND_T]) {
        const clamped = frontGripT(BUTT_FORWARD, bladeForward, t, MIN_FORWARD);

        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(t);
      }
    }
  });

  it("degenerates safely when the blade sits exactly on the butt", () => {
    expect(frontGripT(BUTT_FORWARD, BUTT_FORWARD, TOP_HAND_T, 40)).toBe(0);
  });
});

describe("segmentBetween", () => {
  it("centres the box on the midpoint and reports the span", () => {
    const segment = segmentBetween([0, 0, 0], [0, 10, 0]);

    expect(segment.position).toEqual([0, 5, 0]);
    expect(segment.length).toBeCloseTo(10, 6);
  });

  it("measures a diagonal run", () => {
    const segment = segmentBetween([0, 0, 0], [3, 4, 0]);

    expect(segment.length).toBeCloseTo(5, 6);
    expect(segment.position).toEqual([1.5, 2, 0]);
  });

  it("never returns a zero length that would collapse a box", () => {
    expect(segmentBetween([1, 2, 3], [1, 2, 3]).length).toBeGreaterThan(0);
  });
});

describe("lerp3", () => {
  it("walks from one point to the other", () => {
    expect(lerp3([0, 0, 0], [10, 20, 30], 0)).toEqual([0, 0, 0]);
    expect(lerp3([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15]);
    expect(lerp3([0, 0, 0], [10, 20, 30], 1)).toEqual([10, 20, 30]);
  });
});
