import { describe, expect, it } from "vitest";
import type { GoalieEntity, PuckState, SkaterEntity } from "@bbh/arcade-core";
import { selectGoalieAnimation } from "./goalieAnimation.js";
import { selectSkaterAnimation } from "./skaterAnimation.js";

function skater(overrides: Partial<SkaterEntity> = {}): SkaterEntity {
  return {
    id: "home-skater-1",
    slot: { id: "home-skater-1", teamId: "home", index: 0 },
    teamId: "home",
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    contactState: "ready",
    contactStateUntilMs: 0,
    checkCooldownUntilMs: 0,
    activeCheckUntilMs: 0,
    ...overrides
  };
}

const puck: PuckState = {
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  carrierSlotId: null,
  lastTouchSlotId: null,
  shotBySlotId: null,
  shotPower: 0,
  isChargedShot: false,
  chargeBySlotId: null,
  chargeStartedAtMs: null,
  pickupDisabledForSlotId: null,
  pickupDisabledUntilMs: 0
};

describe("gameplay animation adapters", () => {
  it("selects distinct skater states from authoritative gameplay state", () => {
    expect(selectSkaterAnimation({ skater: skater(), puck, events: [], nowMs: 0 })).toBe("idle");
    expect(
      selectSkaterAnimation({
        skater: skater({ velocity: { x: 260, y: 40 } }),
        puck,
        events: [],
        nowMs: 0
      })
    ).toBe("hardTurn");
    expect(
      selectSkaterAnimation({
        skater: skater({ activeCheckUntilMs: 200 }),
        puck,
        events: [],
        nowMs: 100
      })
    ).toBe("check");
    expect(
      selectSkaterAnimation({
        skater: skater({ contactState: "knockedDown" }),
        puck,
        events: [],
        nowMs: 0
      })
    ).toBe("down");
  });

  it("uses local input hints only for visual state selection", () => {
    expect(
      selectSkaterAnimation({
        skater: skater(),
        puck: { ...puck, carrierSlotId: "home-skater-1" },
        events: [],
        nowMs: 0,
        localHints: { shoot: true }
      })
    ).toBe("wristShot");
  });

  it("selects goalie save and slide states without skater clips", () => {
    const goalie: GoalieEntity = {
      id: "home-goalie",
      slot: { id: "home-goalie", teamId: "home", owner: "server" },
      teamId: "home",
      owner: "server",
      position: { x: 0, y: 0 },
      velocity: { x: 120, y: 0 }
    };

    expect(selectGoalieAnimation({ goalie, events: [], nowMs: 0 })).toBe("slide");
    expect(
      selectGoalieAnimation({
        goalie,
        events: [{ id: "save-1", type: "save", atMs: 100, targetSlotId: "home-goalie", force: 700 }],
        nowMs: 120
      })
    ).toBe("padSave");
  });
});
