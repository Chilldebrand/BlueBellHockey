import { describe, expect, it } from "vitest";
import { RINK_CONFIG, createWorld } from "../../index";
import {
  DEFAULT_BOT_DIFFICULTY,
  assignTeamRoles,
  selectBotDecision,
  slotPositionTarget
} from "./decision.js";
import { createBotInputFrame } from "./bot.js";

describe("bot input frames", () => {
  it("never emits the retired use-powerup control (pickup auto-activates)", () => {
    const world = createWorld(1, "arcade3v3");
    const bot = world.skaters.find((skater) => skater.id === "home-skater-1")!;

    expect(createBotInputFrame(bot, world, 1).usePowerup).toBeUndefined();
  });

  it("converts a carrier shoot decision into a stick flick", () => {
    const world = createWorld(1, "arcade3v3");
    const bot = world.skaters.find((skater) => skater.id === "home-skater-1");

    if (!bot) {
      throw new Error("Missing bot skater");
    }

    bot.position = {
      x: RINK_CONFIG.width - 400,
      y: RINK_CONFIG.height / 2 - 30
    };
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
      stickY: 1, // full-forward stick sample reads as a wrist flick in the sim
      turbo: true
    });
    expect(Math.hypot(frame.moveX, frame.moveY)).toBeCloseTo(1);
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
    defender.position = { x: 960, y: 380 };
    world.puck.carrierSlotId = bot.id;

    const frame = createBotInputFrame(bot, world, 8, {
      ...DEFAULT_BOT_DIFFICULTY,
      passWillingness: 1
    });

    expect(frame.pass).toBe(true);
    expect(frame.stickY).toBe(0); // passing, not flicking a shot
  });

  it("eases station bots into their spot instead of orbiting it", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = world.skaters.find((s) => s.id === "home-skater-1")!;
    const slotMan = world.skaters.find((s) => s.id === "home-skater-2")!;
    slotMan.characterId = "luna-thread";
    world.puck.carrierSlotId = carrier.id;
    carrier.position = { x: 900, y: 500 };
    // Park the slot man exactly at his station; a third mate stays far back so
    // the roles are stable.
    world.skaters.find((s) => s.id === "home-skater-3")!.position = {
      x: 400,
      y: 900
    };
    slotMan.position = { ...slotPositionTarget("home", world) };
    expect(assignTeamRoles(world, "home").get(slotMan.id)).toBe("attack-slot");
    expect(selectBotDecision(slotMan, world).intent).toBe("support");

    // The slot station cycles, so park him exactly on the CURRENT cycled
    // target and confirm he eases off there.
    slotMan.position = { ...selectBotDecision(slotMan, world).moveTarget };
    const atStation = createBotInputFrame(slotMan, world, 1);
    expect(Math.hypot(atStation.moveX, atStation.moveY)).toBeLessThan(0.05);

    // Puck-attacking roles keep full stick even when close: the carrier still
    // drives at the net.
    const attacking = createBotInputFrame(carrier, world, 1);
    expect(Math.hypot(attacking.moveX, attacking.moveY)).toBeCloseTo(1);
  });

  it("keeps a cutting attacker at full throttle near its moving lane", () => {
    const world = createWorld(1, "arcade3v3");
    const carrier = world.skaters.find((s) => s.id === "home-skater-1")!;
    const cutter = world.skaters.find((s) => s.id === "home-skater-2")!;
    carrier.position = { x: 1800, y: RINK_CONFIG.height / 2 };
    cutter.characterId = "milo-ghost";
    world.puck.position = { ...carrier.position };
    world.puck.carrierSlotId = carrier.id;

    const target = selectBotDecision(cutter, world).moveTarget;
    cutter.position = { x: target.x - 20, y: target.y };

    const frame = createBotInputFrame(cutter, world, 9);

    expect(selectBotDecision(cutter, world).intent).toBe("cut");
    expect(Math.hypot(frame.moveX, frame.moveY)).toBeCloseTo(1);
  });
});
