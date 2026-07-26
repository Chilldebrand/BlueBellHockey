import { describe, expect, it } from "vitest";
import { computeCameraTarget, computeCameraPosition } from "./CameraRig.js";
import { viewOrientationForTeam } from "./viewOrientation.js";

describe("camera rig math", () => {
  it("clamps puck-follow target inside rink bounds", () => {
    expect(
      computeCameraTarget({
        puck: { x: -500, y: 2000 },
        rink: { width: 2000, height: 1000 }
      })
    ).toEqual({ x: 220, y: 780 });
  });

  it("sits low behind the target on -x so play reads north-south and close", () => {
    const target = { x: 1000, y: 500 };

    expect(computeCameraPosition(target)).toEqual({
      x: 202,
      y: 987,
      z: 500
    });
  });

  it("keeps a fixed height and distance regardless of target", () => {
    const nearGoal = computeCameraPosition({ x: 300, y: 300 });
    const midIce = computeCameraPosition({ x: 1300, y: 780 });

    expect(nearGoal.y).toBe(midIce.y); // never zooms
    expect(nearGoal.x - 300).toBe(midIce.x - 1300); // constant back-offset
  });

  it("sits on the OPPOSITE side for a flipped view so away also attacks up", () => {
    const target = { x: 1000, y: 500 };

    expect(computeCameraPosition(target, -1)).toEqual({
      x: 1798,
      y: 987,
      z: 500
    });
  });

  it("mirrors the rig exactly — same height, same distance, opposite end", () => {
    const target = { x: 1000, y: 500 };
    const home = computeCameraPosition(target, 1);
    const away = computeCameraPosition(target, -1);

    expect(away.y).toBe(home.y);
    expect(away.z).toBe(home.z);
    expect(away.x - target.x).toBe(-(home.x - target.x));
  });
});

describe("view orientation", () => {
  it("flips only for the away team", () => {
    expect(viewOrientationForTeam("home")).toBe(1);
    expect(viewOrientationForTeam("away")).toBe(-1);
  });

  it("falls back to the classic framing without a team (spectating, lobby)", () => {
    expect(viewOrientationForTeam(null)).toBe(1);
    expect(viewOrientationForTeam(undefined)).toBe(1);
  });
});
