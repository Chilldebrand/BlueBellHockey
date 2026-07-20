import { describe, expect, it } from "vitest";
import { createWorld } from "../index.js";
import {
  findAimedPassRecipient,
  passTargetWithAssist,
  predictPassTarget
} from "./passTargeting.js";

function setupPassWorld() {
  const world = createWorld(1, "arcade3v3");
  const passer = world.skaters.find((skater) => skater.id === "home-skater-1");
  const receiver = world.skaters.find((skater) => skater.id === "home-skater-2");

  if (!passer || !receiver) {
    throw new Error("Missing home skaters");
  }

  for (const skater of world.skaters) {
    if (skater.teamId === "home" && skater.id !== passer.id && skater.id !== receiver.id) {
      skater.position = { x: passer.position.x + 600, y: passer.position.y + 600 };
    }
  }

  receiver.position = { x: passer.position.x + 400, y: passer.position.y };
  return { world, passer, receiver };
}

describe("predictive pass targeting", () => {
  it("leads an aimed teammate along their skating path", () => {
    const { world, passer, receiver } = setupPassWorld();
    receiver.velocity = { x: 400, y: 0 };

    const target = passTargetWithAssist(world, passer, { x: 1, y: 0 }, 1512);

    expect(target?.x).toBeGreaterThan(receiver.position.x);
    expect(target?.y).toBe(receiver.position.y);
  });

  it("keeps a stationary receiver at their current position", () => {
    const { world, passer, receiver } = setupPassWorld();

    expect(passTargetWithAssist(world, passer, { x: 1, y: 0 }, 1512)).toEqual(
      receiver.position
    );
  });

  it("returns no target when no teammate is inside the aimed cone", () => {
    const { world, passer } = setupPassWorld();

    expect(passTargetWithAssist(world, passer, { x: -1, y: 0 }, 1512)).toBeNull();
  });

  it("selects a same-team recipient 60 degrees off the aim direction", () => {
    const { world, passer, receiver } = setupPassWorld();
    receiver.position = {
      x: passer.position.x + 200,
      y: passer.position.y + 200 * Math.sqrt(3)
    };
    const otherTeammates = world.skaters.filter(
      (skater) => skater.teamId === passer.teamId && skater.id !== passer.id && skater.id !== receiver.id
    );
    for (const teammate of otherTeammates) {
      teammate.position = { x: passer.position.x - 300, y: passer.position.y };
    }

    expect(findAimedPassRecipient(world, passer, { x: 1, y: 0 })?.id).toBe(receiver.id);
  });

  it("caps the predicted target inside the rink instead of leading beyond the boards", () => {
    const { receiver } = setupPassWorld();
    receiver.position = { x: 2570, y: 780 };
    receiver.velocity = { x: 1000, y: 0 };

    expect(predictPassTarget({ x: 2100, y: 780 }, receiver, 1512)).toEqual({
      x: 2540,
      y: 780
    });
  });
});
