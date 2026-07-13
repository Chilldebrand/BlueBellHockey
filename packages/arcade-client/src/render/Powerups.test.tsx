import type { PowerupPickup } from "@bbh/arcade-core";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { Powerups } from "./Powerups.js";

function elementRef(element: ReactElement): unknown {
  return (element as ReactElement & { ref: unknown }).ref;
}

vi.mock("@react-three/fiber", () => ({
  useFrame: vi.fn()
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useRef: vi.fn((initial) => ({ current: initial }))
  };
});

describe("Powerups", () => {
  it("keeps the halo outside the bobbing visual group above the ice", () => {
    const pickup: PowerupPickup = {
      id: "pickup-1",
      type: "speed-boost",
      position: { x: 12, y: -8 },
      spawnedAtMs: 0
    };

    const tree = Powerups({ pickups: [pickup] });
    const floatingIcon = (tree.props.children as ReactElement[])[0];
    const floatingGroup = (
      floatingIcon.type as (props: typeof floatingIcon.props) => ReactElement
    )(floatingIcon.props);
    const visualElements = floatingGroup.props.children as ReactElement[];
    const visual = visualElements.find(
      (element) => element.props.name === "powerup-visual"
    );
    const halo = visualElements.find(
      (element) => element.props.name === "powerup-halo"
    );

    // 4x pickups (2026-07-13): icon floats at 55, scaled 6.2; the halo is a
    // ground ring that must cancel the float height to sit just above the ice.
    expect(floatingGroup.props.position).toEqual([12, 55, -8]);
    expect(elementRef(floatingGroup)).toBeNull();
    expect(visual?.props.scale).toBe(6.2);
    expect(visual && elementRef(visual)).toBeDefined();
    expect(halo?.props.position).toEqual([0, -53, 0]);
    expect(halo && elementRef(halo)).toBeDefined();
    expect(visualElements.indexOf(halo as ReactElement)).toBeGreaterThan(
      visualElements.indexOf(visual as ReactElement)
    );
  });
});
