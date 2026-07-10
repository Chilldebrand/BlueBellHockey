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
