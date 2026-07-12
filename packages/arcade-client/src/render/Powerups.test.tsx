import type { PowerupPickup } from "@bbh/arcade-core";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { Powerups } from "./Powerups.js";

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
  it("wraps each pickup in an enlarged named visual with an emissive halo", () => {
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

    expect(visualElements.map((element) => element.props.name)).toContain(
      "powerup-visual"
    );
    expect(
      visualElements.find((element) => element.props.name === "powerup-visual")
        ?.props.scale
    ).toBe(1.55);
    expect(visualElements.map((element) => element.props.name)).toContain(
      "powerup-halo"
    );
  });
});
