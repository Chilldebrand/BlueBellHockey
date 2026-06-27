import { describe, expect, it } from "vitest";
import { computeCameraTarget, computeCameraPosition } from "./CameraRig.js";

describe("camera rig math", () => {
  it("clamps puck-follow target inside rink bounds", () => {
    expect(
      computeCameraTarget({
        puck: { x: -500, y: 2000 },
        rink: { width: 2000, height: 1000 }
      })
    ).toEqual({ x: 220, y: 780 });
  });

  it("uses a high diagonal camera offset over the clamped target", () => {
    const target = { x: 1000, y: 500 };

    expect(computeCameraPosition(target)).toEqual({
      x: 520,
      y: 1180,
      z: 980
    });
  });
});
