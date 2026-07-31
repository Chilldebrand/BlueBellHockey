import { describe, expect, it } from "vitest";
import { createWorld } from "../index.js";
import { normalizeOrZero } from "./physics.js";
import {
  findAimedPassRecipient,
  passFlightSeconds,
  passTargetWithAssist,
  predictPassTarget,
  PASS_LEAD_MAX_DISTANCE
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

describe("pass flight time and lead", () => {
  it("takes longer than distance/speed because the puck slows down", () => {
    const distance = 800;
    const speed = 1634;

    const naive = distance / speed;
    const actual = passFlightSeconds(distance, speed);

    expect(actual).toBeGreaterThan(naive);
    // ~0.58s for a 800-unit feed at pass speed, against the naive ~0.49s.
    expect(actual).toBeCloseTo(0.58, 1);
  });

  it("leads a long pass by the WHOLE flight, not a clipped 0.3s", () => {
    // The old cap was shorter than the flight, so every feed to a moving
    // teammate landed behind them by the difference.
    const receiver = { position: { x: 800, y: 0 }, velocity: { x: 0, y: 400 } };

    const target = predictPassTarget({ x: 0, y: 0 }, receiver, 1634);
    const lead = target.y - receiver.position.y;

    expect(lead).toBeGreaterThan(400 * 0.3);
    expect(lead).toBeCloseTo(400 * passFlightSeconds(800, 1634), 0);
  });

  it("still bounds the lead so a flying receiver can't drag the aim away", () => {
    const receiver = { position: { x: 800, y: 0 }, velocity: { x: 0, y: 4000 } };

    const target = predictPassTarget({ x: 0, y: 0 }, receiver, 1634);

    expect(target.y - receiver.position.y).toBeLessThanOrEqual(
      PASS_LEAD_MAX_DISTANCE + 1e-6
    );
  });

  it("never aims at a knocked-down or frozen teammate", () => {
    for (const state of ["knockedDown", "frozen"] as const) {
      const { world, passer, receiver } = setupPassWorld();
      const aim = normalizeOrZero({
        x: receiver.position.x - passer.position.x,
        y: receiver.position.y - passer.position.y
      });

      expect(findAimedPassRecipient(world, passer, aim)).toBe(receiver);

      receiver.contactState = state;
      expect(findAimedPassRecipient(world, passer, aim)).not.toBe(receiver);
    }
  });
});
