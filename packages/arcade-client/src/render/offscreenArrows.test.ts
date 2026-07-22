import { describe, expect, it } from "vitest";
import {
  ARROW_EDGE_MARGIN_PX,
  applyArrowPlacement,
  placeEdgeArrow,
  registerArrowElement
} from "./offscreenArrows.js";

describe("placeEdgeArrow", () => {
  it("hides arrows for on-screen skaters, including exactly at the edge", () => {
    expect(placeEdgeArrow(0, 0, 1280, 720).visible).toBe(false);
    expect(placeEdgeArrow(1, -1, 1280, 720).visible).toBe(false);
    expect(placeEdgeArrow(Number.NaN, 0, 1280, 720).visible).toBe(false);
  });

  it("clamps a far-right target to the right margin pointing right", () => {
    const placement = placeEdgeArrow(3, 0, 1280, 720);

    expect(placement.visible).toBe(true);
    expect(placement.x).toBeCloseTo(1280 - ARROW_EDGE_MARGIN_PX);
    expect(placement.y).toBeCloseTo(360);
    expect(placement.angleRad).toBeCloseTo(0);
  });

  it("clamps a target above the screen to the top margin pointing up", () => {
    // NDC y is up; CSS y is down — above the screen means small CSS y.
    const placement = placeEdgeArrow(0, 2.5, 1280, 720);

    expect(placement.visible).toBe(true);
    expect(placement.x).toBeCloseTo(640);
    expect(placement.y).toBeCloseTo(ARROW_EDGE_MARGIN_PX);
    expect(placement.angleRad).toBeCloseTo(-Math.PI / 2);
  });

  it("clamps corner targets inside both margins", () => {
    const placement = placeEdgeArrow(-4, -4, 1000, 500);

    expect(placement.visible).toBe(true);
    expect(placement.x).toBeGreaterThanOrEqual(ARROW_EDGE_MARGIN_PX - 1e-6);
    expect(placement.y).toBeLessThanOrEqual(500 - ARROW_EDGE_MARGIN_PX + 1e-6);
  });
});

describe("arrow element registry", () => {
  it("applies placements to registered elements and ignores unregistered ids", () => {
    const element = {
      style: { visibility: "", transform: "" }
    } as unknown as HTMLElement;

    registerArrowElement("home-skater-1", element);
    applyArrowPlacement("home-skater-1", {
      visible: true,
      x: 100,
      y: 50,
      angleRad: Math.PI
    });
    expect(element.style.visibility).toBe("visible");
    expect(element.style.transform).toContain("translate(100px, 50px)");

    applyArrowPlacement("home-skater-1", {
      visible: false,
      x: 0,
      y: 0,
      angleRad: 0
    });
    expect(element.style.visibility).toBe("hidden");

    registerArrowElement("home-skater-1", null);
    expect(() =>
      applyArrowPlacement("home-skater-1", {
        visible: true,
        x: 0,
        y: 0,
        angleRad: 0
      })
    ).not.toThrow();
  });
});
