import { describe, expect, it } from "vitest";
import { bladeWorldPosition, createWorld } from "@bbh/arcade-core";
import { predictedCarriedPuck } from "./Puck.js";

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
});
