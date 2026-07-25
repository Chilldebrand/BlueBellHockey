import { describe, expect, it } from "vitest";
import {
  CHECK_CONFIG,
  createWorld,
  defaultCharacterIdForSlot,
  stepWorld,
  type CharacterId,
  type InputFrame
} from "../index";

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

/**
 * Hitter bearing down on a target 55 units ahead (inside check radius).
 * Characters pinned to the stat-neutral kip-hook (power 3 / balance 3) so the
 * force table is exactly the configured baseline; tests that exercise stat
 * scaling override per-slot.
 */
function worldWithContact(
  characters: Record<string, CharacterId> = {}
) {
  const world = createWorld(1, "arcade3v3", {
    "home-skater-1": "kip-hook",
    "away-skater-1": "kip-hook",
    ...characters
  });
  world.phase = "playing";
  const hitter = world.skaters[0];
  const target = world.skaters[3];
  hitter.position = { x: 500, y: 500 };
  target.position = { x: 555, y: 500 };
  hitter.velocity = { x: 520, y: 0 };
  // Moving laterally so the target is NOT anchored unless a test wants it.
  target.velocity = { x: 0, y: 200 };

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

  it("only bumps on a standstill press — no free stumbles", () => {
    const { hitter, target, world } = worldWithContact();
    hitter.velocity = { x: 0, y: 0 };

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);

    expect(world.eventQueue.some((event) => event.type === "hit")).toBe(true);
    expect(target.contactState).toBe("ready");
    // Physical shove still lands.
    expect(target.velocity.x).toBeGreaterThan(0);
  });

  it("credits only the hitter with a hit in player stats", () => {
    const { hitter, target, world } = worldWithContact();

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);

    expect(world.stats.players[hitter.id]?.hits).toBe(1);
    expect(world.stats.players[target.id]).toEqual({
      goals: 0,
      assists: 0,
      hits: 0,
      shots: 0,
      saves: 0,
      powerups: 0
    });
  });

  it("stumbles a target from an aligned cruise-speed hit", () => {
    const { hitter, target, world } = worldWithContact();
    hitter.velocity = { x: 520, y: 0 }; // force ≈ 780 vs threshold 520

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);

    expect(target.contactState).toBe("stumbling");
    expect(world.eventQueue.some((event) => event.type === "knockdown")).toBe(
      false
    );
  });

  it("knocks the puck loose when the carrier is hit hard enough", () => {
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

  it("knocks down high-speed targets and recovers them automatically", () => {
    // Turbo tops out near 760; past momentumSurgeSpeed the collision term
    // takes over, so a power-5 checker at that pace flattens comfortably.
    const { hitter, target, world } = worldWithContact({
      "home-skater-1": "dash-iron"
    });
    hitter.velocity = { x: 760, y: 0 };

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

describe("stat-scaled hitting", () => {
  it("lets a power-5 hitter flatten at a speed where a neutral one can't", () => {
    const neutral = worldWithContact();
    neutral.hitter.velocity = { x: 680, y: 0 };
    stepWorld(
      neutral.world,
      [inputFrame(neutral.hitter.id, 1, { check: true })],
      16
    );
    expect(neutral.target.contactState).toBe("stumbling");

    const heavy = worldWithContact({ "home-skater-1": "dash-iron" }); // power 5
    heavy.hitter.velocity = { x: 680, y: 0 }; // same speed, power carries it over
    stepWorld(heavy.world, [inputFrame(heavy.hitter.id, 1, { check: true })], 16);
    expect(heavy.target.contactState).toBe("knockedDown");
  });

  it("lets a balance-5 target stay up through a hit that fells a neutral one", () => {
    const neutral = worldWithContact({ "home-skater-1": "dash-iron" });
    neutral.hitter.velocity = { x: 680, y: 0 };
    stepWorld(
      neutral.world,
      [inputFrame(neutral.hitter.id, 1, { check: true })],
      16
    );
    expect(neutral.target.contactState).toBe("knockedDown");

    // …but a balance-5 tank raises the bar and stays up at that same speed.
    const tank = worldWithContact({
      "home-skater-1": "dash-iron",
      "away-skater-1": "tess-flash" // balance 5
    });
    tank.hitter.velocity = { x: 680, y: 0 };
    stepWorld(tank.world, [inputFrame(tank.hitter.id, 1, { check: true })], 16);
    expect(tank.target.contactState).toBe("stumbling");
  });

  it("makes anchored (braced) targets harder to knock down", () => {
    const moving = worldWithContact({ "home-skater-1": "dash-iron" });
    moving.hitter.velocity = { x: 680, y: 0 };
    stepWorld(
      moving.world,
      [inputFrame(moving.hitter.id, 1, { check: true })],
      16
    );
    expect(moving.target.contactState).toBe("knockedDown");

    const braced = worldWithContact({ "home-skater-1": "dash-iron" });
    braced.hitter.velocity = { x: 680, y: 0 };
    braced.target.velocity = { x: 0, y: 0 }; // anchored → threshold ×1.2
    stepWorld(
      braced.world,
      [inputFrame(braced.hitter.id, 1, { check: true })],
      16
    );
    expect(braced.target.contactState).toBe("stumbling");
  });
});

describe("momentum knockdowns", () => {
  it("lets a small fast skater flatten a big balanced one at full flight", () => {
    // The headline case (playtest 2026-07-24): rook-rocket is power 2 /
    // balance 2, dash-iron is power 5 / balance 5. Under the old purely
    // power-scaled formula this was arithmetically impossible at ANY speed.
    const flying = worldWithContact({
      "home-skater-1": "rook-rocket",
      "away-skater-1": "dash-iron"
    });
    flying.hitter.velocity = { x: 780, y: 0 }; // his turbo ceiling
    stepWorld(
      flying.world,
      [inputFrame(flying.hitter.id, 1, { check: true })],
      16
    );
    expect(flying.target.contactState).toBe("knockedDown");

    // He has to actually be flying, though — the same hit a notch slower is
    // still just a stumble, so speed is the price of the knockdown.
    const slower = worldWithContact({
      "home-skater-1": "rook-rocket",
      "away-skater-1": "dash-iron"
    });
    slower.hitter.velocity = { x: 700, y: 0 };
    stepWorld(
      slower.world,
      [inputFrame(slower.hitter.id, 1, { check: true })],
      16
    );
    expect(slower.target.contactState).toBe("stumbling");
  });

  it("leaves every hit below the surge speed exactly as it was", () => {
    // The surge term is max(0, closing - momentumSurgeSpeed), so ordinary
    // contact is untouched: cruise still stumbles and a standstill press
    // still only shoves. Cheapening those was the thing to avoid.
    const cruise = worldWithContact();
    cruise.hitter.velocity = { x: 520, y: 0 };
    stepWorld(cruise.world, [inputFrame(cruise.hitter.id, 1, { check: true })], 16);
    expect(cruise.target.contactState).toBe("stumbling");

    const still = worldWithContact();
    still.hitter.velocity = { x: 0, y: 0 };
    stepWorld(still.world, [inputFrame(still.hitter.id, 1, { check: true })], 16);
    expect(still.target.contactState).toBe("ready");
  });

  it("does not reward a glancing hit at the same speed", () => {
    // Alignment discounts the closing speed BEFORE the surge threshold, so
    // brushing past someone at full tilt is not a knockdown.
    const square = worldWithContact({ "away-skater-1": "dash-iron" });
    square.hitter.velocity = { x: 780, y: 0 };
    stepWorld(square.world, [inputFrame(square.hitter.id, 1, { check: true })], 16);
    expect(square.target.contactState).toBe("knockedDown");

    const glancing = worldWithContact({ "away-skater-1": "dash-iron" });
    glancing.hitter.velocity = { x: 780, y: 0 };
    glancing.hitter.facing = Math.PI / 3; // still within the target cone
    stepWorld(
      glancing.world,
      [inputFrame(glancing.hitter.id, 1, { check: true })],
      16
    );
    expect(glancing.target.contactState).not.toBe("knockedDown");
  });
});

describe("whiffs, lunges, and bounce-backs", () => {
  it("lunges the checker forward and staggers them after a clean miss", () => {
    const world = createWorld(1, "arcade3v3", {
      "home-skater-1": "kip-hook"
    });
    world.phase = "playing";
    const hitter = world.skaters[0];
    hitter.position = { x: 500, y: 500 };
    hitter.velocity = { x: 200, y: 0 };
    // Nobody anywhere near — guaranteed miss.

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);
    expect(hitter.velocity.x).toBeGreaterThan(300); // lunge applied

    // Ride out the active window → whiff recovery.
    for (let tick = 0; tick < 12; tick += 1) {
      stepWorld(world, [], 16);
    }
    expect(hitter.contactState).toBe("stumbling");
    expect(world.eventQueue.some((event) => event.type === "checkWhiff")).toBe(
      true
    );

    stepWorld(world, [], CHECK_CONFIG.whiffRecoveryMs + 32);
    expect(hitter.contactState).toBe("ready");
  });

  it("connects during the active window when the lunge closes the gap", () => {
    const { hitter, target, world } = worldWithContact();
    target.position = { x: 650, y: 500 }; // out of instant range (150 > 96)
    target.velocity = { x: 0, y: 200 };

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);
    expect(world.eventQueue.some((event) => event.type === "hit")).toBe(false);

    for (let tick = 0; tick < 8; tick += 1) {
      stepWorld(world, [], 16);
    }

    expect(world.eventQueue.some((event) => event.type === "hit")).toBe(true);
  });

  it("bounces a weak checker off an anchored, better-balanced target", () => {
    const { hitter, target, world } = worldWithContact({
      "away-skater-1": "tess-flash" // balance 5
    });
    hitter.velocity = { x: 0, y: 0 }; // force ≈ 130
    target.velocity = { x: 0, y: 0 }; // anchored; bounce cutoff = 624×0.5 = 312

    stepWorld(world, [inputFrame(hitter.id, 1, { check: true })], 16);

    expect(hitter.contactState).toBe("stumbling");
    expect(hitter.velocity.x).toBeLessThan(0); // recoiled backwards
    expect(target.contactState).toBe("ready");
    expect(world.eventQueue.some((event) => event.type === "bounceBack")).toBe(
      true
    );
  });
});

describe("flick-to-hit", () => {
  it("turns a right-stick up-flick into a check attempt when not carrying", () => {
    const { hitter, target, world } = worldWithContact();

    // stickY 0 → 1 in one tick = a wrist-flick latch; without the puck it now
    // fires a body check instead of arming a shot.
    stepWorld(world, [inputFrame(hitter.id, 1, { stickY: 1 })], 16);

    expect(world.eventQueue).toContainEqual(
      expect.objectContaining({
        type: "hit",
        sourceSlotId: hitter.id,
        targetSlotId: target.id
      })
    );
    expect(hitter.gesture.pendingReleaseType).toBe("none");
  });

  it("keeps the up-flick as a wrist shot when carrying the puck", () => {
    const { hitter, target, world } = worldWithContact();
    world.puck.carrierSlotId = hitter.id;
    // Open ice: body-contact proximity would strip the tethered puck in the
    // collision step before the shot could fire.
    target.position = { x: 1400, y: 1000 };

    stepWorld(world, [inputFrame(hitter.id, 1, { stickY: 1 })], 16);

    expect(world.puck.carrierSlotId).toBeNull(); // shot released
    expect(world.puck.shotBySlotId).toBe(hitter.id);
    expect(world.eventQueue.some((event) => event.type === "hit")).toBe(false);
  });
});

describe("character plumbing", () => {
  it("assigns deterministic default characters and honors overrides", () => {
    const defaults = createWorld(7, "arcade3v3");
    for (const skater of defaults.skaters) {
      expect(skater.characterId).toBe(defaultCharacterIdForSlot(skater.slot));
    }

    const overridden = createWorld(7, "arcade3v3", {
      "home-skater-2": "zara-crush"
    });
    expect(
      overridden.skaters.find((skater) => skater.id === "home-skater-2")
        ?.characterId
    ).toBe("zara-crush");
    // Untouched slots keep the default.
    expect(
      overridden.skaters.find((skater) => skater.id === "away-skater-3")
        ?.characterId
    ).toBe(
      defaultCharacterIdForSlot({ teamId: "away", index: 2 })
    );
  });
});
