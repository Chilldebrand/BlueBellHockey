import { describe, expect, it } from "vitest";
import { createWorld } from "../index";
import {
  nearestTeammateToPuck,
  resolveManualSwitchTarget,
  resolveReceptionSwitch,
  resolveTeamPossessionSwitch
} from "./control.js";

describe("resolveReceptionSwitch", () => {
  it("switches to the teammate who gathers the controlled skater's pass", () => {
    const world = createWorld(1, "arcade3v3");
    // Pre-step the carrier was home-skater-1 (the human); post-step a teammate
    // has gathered the pass.
    world.puck.carrierSlotId = "home-skater-2";

    expect(
      resolveReceptionSwitch(world, "home-skater-1", "home-skater-1")
    ).toBe("home-skater-2");
  });

  it("does not fire again once control has moved to the receiver", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "home-skater-2";

    // After the switch, the human controls home-skater-2 and (a later tick) the
    // pre-step carrier is also home-skater-2 — no phantom re-switch.
    expect(
      resolveReceptionSwitch(world, "home-skater-2", "home-skater-2")
    ).toBeNull();
  });

  it("ignores a self-pickup (controlled skater regathers its own puck)", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "home-skater-1";

    expect(
      resolveReceptionSwitch(world, "home-skater-1", "home-skater-1")
    ).toBeNull();
  });

  it("ignores an opponent interception", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "away-skater-1";

    expect(
      resolveReceptionSwitch(world, "home-skater-1", "home-skater-1")
    ).toBeNull();
  });

  it("does not fire when the controlled skater was not the passer", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "home-skater-3";

    // The controlled human held nothing (prev carrier was a different teammate).
    expect(
      resolveReceptionSwitch(world, "home-skater-1", "home-skater-2")
    ).toBeNull();
  });

  it("does not fire when the puck went loose (no new carrier)", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = null;

    expect(
      resolveReceptionSwitch(world, "home-skater-1", "home-skater-1")
    ).toBeNull();
  });
});

describe("resolveTeamPossessionSwitch", () => {
  it("switches to a teammate who picks up a loose puck (not just a pass)", () => {
    const world = createWorld(1, "arcade3v3");
    // The human controlled home-skater-1 and held nothing (puck was loose);
    // a teammate has just gathered it.
    world.puck.carrierSlotId = "home-skater-2";

    expect(
      resolveTeamPossessionSwitch(world, "home-skater-1", null)
    ).toBe("home-skater-2");
  });

  it("switches even when a different teammate was the previous carrier", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "home-skater-3";

    expect(
      resolveTeamPossessionSwitch(world, "home-skater-1", "home-skater-2")
    ).toBe("home-skater-3");
  });

  it("does not fire while the same teammate keeps carrying", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "home-skater-2";

    expect(
      resolveTeamPossessionSwitch(world, "home-skater-1", "home-skater-2")
    ).toBeNull();
  });

  it("ignores a pickup by the opponent", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "away-skater-1";

    expect(
      resolveTeamPossessionSwitch(world, "home-skater-1", null)
    ).toBeNull();
  });

  it("ignores the controlled skater gathering the puck itself", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "home-skater-1";

    expect(
      resolveTeamPossessionSwitch(world, "home-skater-1", null)
    ).toBeNull();
  });

  it("does not fire while the puck is loose", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = null;

    expect(
      resolveTeamPossessionSwitch(world, "home-skater-1", "home-skater-2")
    ).toBeNull();
  });
});

describe("nearestTeammateToPuck", () => {
  it("returns the nearest same-team skater to the puck, excluding self", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.position = { x: 1000, y: 500 };

    const controlled = world.skaters.find((s) => s.id === "home-skater-1")!;
    const near = world.skaters.find((s) => s.id === "home-skater-2")!;
    const far = world.skaters.find((s) => s.id === "home-skater-3")!;
    controlled.position = { x: 100, y: 100 };
    near.position = { x: 1020, y: 520 };
    far.position = { x: 400, y: 900 };
    // An opponent sitting on the puck must be ignored.
    world.skaters.find((s) => s.id === "away-skater-1")!.position = {
      x: 1000,
      y: 500
    };

    expect(nearestTeammateToPuck(world, "home-skater-1")).toBe("home-skater-2");
  });

  it("returns null when the controlled skater has no teammates", () => {
    const world = createWorld(1, "arcade3v3");
    world.skaters = world.skaters.filter(
      (s) => s.teamId === "away" || s.id === "home-skater-1"
    );

    expect(nearestTeammateToPuck(world, "home-skater-1")).toBeNull();
  });
});

describe("resolveManualSwitchTarget", () => {
  it("switches to the nearest teammate when the human is not carrying", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = null;
    world.puck.position = { x: 1000, y: 500 };
    world.skaters.find((s) => s.id === "home-skater-2")!.position = {
      x: 1010,
      y: 505
    };
    world.skaters.find((s) => s.id === "home-skater-3")!.position = {
      x: 200,
      y: 200
    };

    expect(resolveManualSwitchTarget(world, "home-skater-1")).toBe(
      "home-skater-2"
    );
  });

  it("does not switch while the human is carrying the puck", () => {
    const world = createWorld(1, "arcade3v3");
    world.puck.carrierSlotId = "home-skater-1";

    expect(resolveManualSwitchTarget(world, "home-skater-1")).toBeNull();
  });
});
