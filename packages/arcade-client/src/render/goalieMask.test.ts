import { describe, expect, it } from "vitest";
import {
  buildMaskVents,
  faceToMaskUv,
  maskUvToFace,
  MASK_CHEVRONS,
  MASK_EYES
} from "./goalieMask.js";

describe("goalie mask layout", () => {
  it("is deterministic — the same shell every run", () => {
    expect(buildMaskVents()).toEqual(buildMaskVents());
  });

  it("keeps every vent inside the shell", () => {
    for (const vent of buildMaskVents()) {
      // Allowing for the oval's own half-height, nothing may spill past the rim.
      const reach = Math.hypot(vent.x, vent.y) + vent.r * vent.stretch;
      expect(reach).toBeLessThan(1);
    }
  });

  it("never drills a vent through an eye opening", () => {
    for (const vent of buildMaskVents()) {
      for (const eye of MASK_EYES) {
        expect(Math.hypot(vent.x - eye.x, vent.y - eye.y)).toBeGreaterThan(eye.r);
      }
    }
  });

  it("drills a usable number of vents", () => {
    const vents = buildMaskVents();

    expect(vents.length).toBeGreaterThan(40);
    expect(vents.length).toBeLessThan(200);
  });

  it("mirrors the eyes and the painted chevrons across the centre line", () => {
    expect(MASK_EYES[0]!.x).toBeCloseTo(-MASK_EYES[1]!.x, 6);
    expect(MASK_EYES[0]!.y).toBeCloseTo(MASK_EYES[1]!.y, 6);

    // Chevrons come in mirrored pairs: brow left/right, then cheek left/right.
    for (let pair = 0; pair < MASK_CHEVRONS.length; pair += 2) {
      const left = MASK_CHEVRONS[pair]!;
      const right = MASK_CHEVRONS[pair + 1]!;
      expect(right).toHaveLength(left.length);
      left.forEach(([x, y], index) => {
        expect(right[index]![0]).toBeCloseTo(-x, 6);
        expect(right[index]![1]).toBeCloseTo(y, 6);
      });
    }
  });
});

describe("mask uv remap", () => {
  it("round-trips a face point through the polar layout", () => {
    for (const [x, y] of [
      [0.3, 0.16],
      [-0.5, 0.4],
      [0.1, -0.6]
    ] as Array<[number, number]>) {
      const { u, v } = faceToMaskUv(x, y);
      const back = maskUvToFace(u, v);

      expect(back.x).toBeCloseTo(x, 6);
      expect(back.y).toBeCloseTo(y, 6);
    }
  });

  it("puts the middle of the face on the pole and the rim at the edge", () => {
    expect(faceToMaskUv(0, 0).v).toBe(0);
    expect(faceToMaskUv(1, 0).v).toBeCloseTo(1, 6);
  });

  it("keeps u inside 0..1 all the way round", () => {
    for (let i = 0; i < 32; i += 1) {
      const angle = (i / 32) * Math.PI * 2;
      const { u } = faceToMaskUv(Math.cos(angle) * 0.7, Math.sin(angle) * 0.7);

      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });
});
