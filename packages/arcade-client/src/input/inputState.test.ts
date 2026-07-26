import { describe, expect, it } from "vitest";
import {
  createInputFrame,
  createNeutralInputState,
  mergeInputStates
} from "./inputState.js";

describe("arcade input state", () => {
  it("creates neutral input without powerup activation", () => {
    expect(createNeutralInputState().usePowerup).toBe(false);
  });

  it("merges powerup activation from either input source", () => {
    const neutral = createNeutralInputState();
    const activating = { ...neutral, usePowerup: true };

    expect(mergeInputStates(activating, neutral).usePowerup).toBe(true);
    expect(mergeInputStates(neutral, activating).usePowerup).toBe(true);
  });

  it("copies powerup activation into the input frame", () => {
    const frame = createInputFrame({
      input: { ...createNeutralInputState(), usePowerup: true },
      playerId: "player-1",
      slotId: "home-skater-1",
      sequence: 4
    });

    expect(frame.usePowerup).toBe(true);
  });
});

describe("screen-to-world movement mapping", () => {
  // Screen-up is W / stick-up, which the trackers report as moveY -1.
  const pushUpScreen = { ...createNeutralInputState(), moveY: -1 };
  const pushRightScreen = { ...createNeutralInputState(), moveX: 1 };

  const frameFor = (
    input: ReturnType<typeof createNeutralInputState>,
    viewOrientation: 1 | -1
  ) =>
    createInputFrame({
      input,
      playerId: "player-1",
      slotId: "home-skater-1",
      sequence: 1,
      viewOrientation
    });

  it("sends the classic view up-ice toward +x (home attacks up)", () => {
    expect(frameFor(pushUpScreen, 1).moveX).toBe(1);
    expect(frameFor(pushRightScreen, 1).moveY).toBe(1);
  });

  it("sends the flipped view up-screen toward -x (away attacks up)", () => {
    // The camera is yawed 180 degrees, so pushing up the screen has to drive
    // the skater toward the HOME net — away's attacking end.
    expect(frameFor(pushUpScreen, -1).moveX).toBe(-1);
  });

  it("mirrors screen-right with the camera so strafing is not inverted", () => {
    expect(frameFor(pushRightScreen, -1).moveY).toBe(-1);
  });

  it("leaves the skill stick untouched — it is body-relative on both ends", () => {
    const windup = { ...createNeutralInputState(), stickX: 0.5, stickY: -1 };

    expect(frameFor(windup, -1).stickY).toBe(frameFor(windup, 1).stickY);
    expect(frameFor(windup, -1).stickX).toBe(frameFor(windup, 1).stickX);
  });

  it("defaults to the classic framing (Free Skate, Shootout, spectating)", () => {
    const frame = createInputFrame({
      input: pushUpScreen,
      playerId: "player-1",
      slotId: "home-skater-1",
      sequence: 1
    });

    expect(frame.moveX).toBe(1);
  });
});
