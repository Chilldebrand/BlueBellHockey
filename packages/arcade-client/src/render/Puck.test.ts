import { describe, expect, it } from "vitest";
import {
  bladeWorldPosition,
  carryRestWorldPosition,
  createWorld
} from "@bbh/arcade-core";
import {
  pocketCarriedPuck,
  predictedCarriedPuck,
  puckShadowAppearance
} from "./Puck.js";

describe("predictedCarriedPuck", () => {
  it("snaps a carried puck to the predicted local carrier's blade", () => {
    const world = createWorld(1, "arcade3v3");
    const predictedCarrier = {
      ...world.skaters[0],
      position: {
        x: world.skaters[0].position.x + 100,
        y: world.skaters[0].position.y + 20
      }
    };
    world.puck.carrierSlotId = predictedCarrier.id;

    const puck = predictedCarriedPuck(world.puck, predictedCarrier);

    expect(puck.position).toEqual(bladeWorldPosition(predictedCarrier));
  });

  it("returns the authoritative puck when someone else carries it", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "away-skater-1";

    const puck = predictedCarriedPuck(world.puck, world.skaters[0]);

    expect(puck).toBe(world.puck);
  });

  it("parks the puck at the feet during a slap windup but not a snap windup", () => {
    const world = createWorld(1, "arcade3v3");
    const base = world.skaters[0];
    const slapCarrier = {
      ...base,
      stick: { ...base.stick, localY: -1 },
      gesture: { ...base.gesture, phase: "windup" as const, windupKind: "slap" as const }
    };
    world.puck.carrierSlotId = slapCarrier.id;

    expect(predictedCarriedPuck(world.puck, slapCarrier).position).toEqual(
      carryRestWorldPosition(slapCarrier)
    );

    const snapCarrier = {
      ...slapCarrier,
      gesture: { ...slapCarrier.gesture, windupKind: "snap" as const }
    };
    expect(predictedCarriedPuck(world.puck, snapCarrier).position).toEqual(
      bladeWorldPosition(snapCarrier)
    );
  });
});

describe("pocketCarriedPuck", () => {
  it("nudges a carried puck along the blade (right of facing)", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = world.skaters[0]; // faces +x, so right-of-facing is +y
    world.puck.carrierSlotId = carrier.id;
    const before = { ...world.puck.position };

    const puck = pocketCarriedPuck(world.puck, carrier);

    expect(puck.position.y).toBeGreaterThan(before.y);
    expect(puck.position.x).toBeCloseTo(before.x + 1.5, 1); // +forward
  });

  it("leaves a loose or opponent-carried puck untouched", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "away-skater-1";

    expect(pocketCarriedPuck(world.puck, world.skaters[0])).toBe(world.puck);
  });
});

describe("puckShadowAppearance", () => {
  it("is full-size and darkest for a grounded puck", () => {
    expect(puckShadowAppearance(0)).toEqual({ scale: 1, opacity: 0.42 });
  });

  it("shrinks and fades monotonically as the puck rises", () => {
    const grounded = puckShadowAppearance(0);
    const midShot = puckShadowAppearance(50); // typical wrist/slap peak
    const crossbar = puckShadowAppearance(95); // GOAL_HEIGHT

    expect(midShot.scale).toBeLessThan(grounded.scale);
    expect(midShot.opacity).toBeLessThan(grounded.opacity);
    expect(crossbar.scale).toBeLessThan(midShot.scale);
    expect(crossbar.opacity).toBeLessThan(midShot.opacity);
    // Never vanishes entirely — a faint marker stays under top-shelf shots.
    expect(crossbar.scale).toBeGreaterThan(0.4);
    expect(crossbar.opacity).toBeGreaterThan(0.1);
  });

  it("clamps negative and beyond-crossbar heights", () => {
    expect(puckShadowAppearance(-5)).toEqual(puckShadowAppearance(0));
    expect(puckShadowAppearance(300)).toEqual(puckShadowAppearance(95));
  });
});
