import { describe, expect, it } from "vitest";
import { CHECK_CONFIG, createWorld, stepWorld, type InputFrame } from "../index";

function inputFrame(
  slotId: string,
  sequence: number,
  overrides: Partial<InputFrame> = {}
): InputFrame {
  return {
    playerId: "session-a",
    slotId,
    sequence,
    moveX: 0,
    moveY: 0,
    stickX: 0,
    stickY: 0,
    pass: false,
    check: false,
    turbo: false,
    switchTarget: false,
    ...overrides
  };
}

function worldWithContact() {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  const hitter = world.skaters[0];
  const target = world.skaters[3];
  hitter.position = { x: 500, y: 500 };
  target.position = { x: 555, y: 500 };
  hitter.velocity = { x: 520, y: 0 };
  target.velocity = { x: 0, y: 0 };

  return { hitter, target, world };
}

describe("checking and knockdowns", () => {
  it("emits a hit event for a legal off-puck check without penalties", () => {
    const { hitter, target, world } = worldWithContact();

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);

    expect(world.eventQueue).toContainEqual(
      expect.objectContaining({
        type: "hit",
        sourceSlotId: hitter.id,
        targetSlotId: target.id
      })
    );
    expect(world.eventQueue.some((event) => event.type === "penalty")).toBe(false);
  });

  it("knocks the puck loose when the carrier is hit", () => {
    const { hitter, target, world } = worldWithContact();
    world.puck.carrierSlotId = target.id;

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);

    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.lastTouchSlotId).toBe(hitter.id);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
  });

  it("uses check cooldown to avoid repeated hits every tick", () => {
    const { hitter, world } = worldWithContact();

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);
    stepWorld(world, [inputFrame(hitter.id, 2, { check: true })], 16);

    expect(world.eventQueue.filter((event) => event.type === "hit")).toHaveLength(1);
    expect(hitter.checkCooldownUntilMs).toBeGreaterThan(world.time.nowMs);
  });

  it("knocks down high-force targets and recovers them automatically", () => {
    const { hitter, target, world } = worldWithContact();
    hitter.velocity = { x: CHECK_CONFIG.knockdownSpeed + 120, y: 0 };

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);

    expect(target.contactState).toBe("knockedDown");
    expect(world.eventQueue).toContainEqual(
      expect.objectContaining({
        type: "knockdown",
        targetSlotId: target.id
      })
    );

    stepWorld(world, [], CHECK_CONFIG.knockdownMs + 16);

    expect(target.contactState).toBe("ready");
  });
});
