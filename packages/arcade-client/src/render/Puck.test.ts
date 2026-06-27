import { describe, expect, it } from "vitest";
import { PUCK_CONFIG, createWorld } from "@bbh/arcade-core";
import { predictedCarriedPuck } from "./Puck.js";

describe("predictedCarriedPuck", () => {
  it("keeps a carried puck attached to the predicted local carrier", () => {
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

    expect(puck.position).toEqual({
      x: predictedCarrier.position.x + PUCK_CONFIG.carryOffset,
      y: predictedCarrier.position.y
    });
  });
});
