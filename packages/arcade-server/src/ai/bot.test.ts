import { createWorld } from "@bbh/arcade-core";
import { describe, expect, it } from "vitest";
import { DEFAULT_BOT_DIFFICULTY } from "./decision.js";
import { createBotInputFrame } from "./bot.js";

describe("bot input frames", () => {
  it("converts a carrier decision into normalized authoritative input", () => {
    const world = createWorld(1, "arcade3v3");
    const bot = world.skaters.find((skater) => skater.id === "home-skater-1");

    if (!bot) {
      throw new Error("Missing bot skater");
    }

    bot.position = { x: 1580, y: 500 };
    bot.specialCharge = 1;
    world.puck.carrierSlotId = bot.id;

    const frame = createBotInputFrame(bot, world, 7, {
      ...DEFAULT_BOT_DIFFICULTY,
      shotAggression: 1,
      specialFrequency: 1
    });

    expect(frame).toMatchObject({
      playerId: "bot:home-skater-1",
      slotId: "home-skater-1",
      sequence: 7,
      pass: false,
      shoot: true,
      turbo: true,
      special: true
    });
    expect(Math.hypot(frame.moveX, frame.moveY)).toBeCloseTo(1);
    expect(frame.aimX).toBeGreaterThan(0);
  });

  it("uses pressure to create pass and target-switch frames", () => {
    const world = createWorld(1, "arcade3v3");
    const bot = world.skaters.find((skater) => skater.id === "home-skater-1");
    const support = world.skaters.find((skater) => skater.id === "home-skater-3");
    const defender = world.skaters.find((skater) => skater.id === "away-skater-1");

    if (!bot || !support || !defender) {
      throw new Error("Missing skaters");
    }

    bot.position = { x: 900, y: 500 };
    support.position = { x: 1220, y: 700 };
    defender.position = { x: 960, y: 500 };
    world.puck.carrierSlotId = bot.id;

    const frame = createBotInputFrame(bot, world, 8, {
      ...DEFAULT_BOT_DIFFICULTY,
      passWillingness: 1
    });

    expect(frame.pass).toBe(true);
    expect(frame.switchTarget).toBe(true);
    expect(frame.aimX).toBeGreaterThan(0);
    expect(frame.aimY).toBeGreaterThan(0);
  });
});
