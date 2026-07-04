import { describe, expect, it } from "vitest";
import {
  computeCameraTarget,
  computeCameraPosition,
  shouldPunchIn
} from "./CameraRig.js";

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
      x: 480,
      y: 860,
      z: 500
    });
  });

  it("punches in only within the window after a goal or knockdown", () => {
    const goal = { id: "g1", type: "goal", atMs: 10_000 } as const;
    const noise = [
      { id: "s1", type: "shot", atMs: 10_400 },
      { id: "p1", type: "poke", atMs: 10_600 },
      { id: "n1", type: "netMesh", atMs: 10_800 },
      { id: "s2", type: "save", atMs: 10_900 }
    ];

    // Inside the window — punches in even with later events piled after it.
    expect(shouldPunchIn([goal, ...noise], 10_900)).toBe(true);

    // Window elapsed — no punch, no matter what sits in the queue.
    expect(shouldPunchIn([goal, ...noise], 11_200)).toBe(false);

    // Ordinary play events never punch.
    expect(shouldPunchIn(noise, 10_900)).toBe(false);
  });
});
