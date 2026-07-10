import { describe, expect, it } from "vitest";
import { keyboardStateFromPressedKeys } from "./keyboard.js";

describe("keyboardStateFromPressedKeys", () => {
  it("activates the held powerup with Q", () => {
    const input = keyboardStateFromPressedKeys(new Set(["KeyQ"]));

    expect(input.usePowerup).toBe(true);
  });
});
