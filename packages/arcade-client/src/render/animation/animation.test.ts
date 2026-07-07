import { describe, expect, it } from "vitest";
import {
  createGestureState,
  createStickState,
  type GoalieEntity,
  type PuckState,
  type SkaterEntity
} from "@bbh/arcade-core";
import { selectGoalieAnimation } from "./goalieAnimation.js";
import { selectSkaterAnimation } from "./skaterAnimation.js";

function skater(overrides: Partial<SkaterEntity> = {}): SkaterEntity {
  return {
    id: "home-skater-1",
    slot: { id: "home-skater-1", teamId: "home", index: 0 },
    teamId: "home",
    characterId: "kip-hook",
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facing: 0,
    stick: createStickState(),
    gesture: createGestureState(),
    contactState: "ready",
    contactStateUntilMs: 0,
    checkCooldownUntilMs: 0,
    activeCheckUntilMs: 0,
    activeCheckPower: 0,
    pokeUntilMs: 0,
    pokeCooldownUntilMs: 0,
    diveCooldownUntilMs: 0,
    turboMeter: 1,
    turboCooldownUntilMs: 0,
    oneTimerUntilMs: 0,
    passChargeMs: 0,
    selectedTargetSlotId: null,
    heldPowerupType: null,
    specialCharge: 0,
    specialCooldownUntilMs: 0,
    ...overrides
  };
}

const puck: PuckState = {
  position: { x: 0, y: 0 },
  velocity: { x: 0, y: 0 },
  height: 0,
  verticalVelocity: 0,
  carrierSlotId: null,
  lastTouchSlotId: null,
  shotBySlotId: null,
  shotPower: 0,
  isChargedShot: false,
  passedFromSlotId: null,
  passedAtMs: 0,
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

  it("shows the windup while charging and the shot right after release", () => {
    const windingUp = skater({
      gesture: { ...createGestureState(), phase: "windup" }
    });
    expect(
      selectSkaterAnimation({
        skater: windingUp,
        puck: { ...puck, carrierSlotId: "home-skater-1" },
        events: [],
        nowMs: 0
      })
    ).toBe("chargeShot");

    expect(
      selectSkaterAnimation({
        skater: skater(),
        puck,
        events: [
          { id: "shot-1", type: "shot", atMs: 0, sourceSlotId: "home-skater-1" }
        ],
        nowMs: 100
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
