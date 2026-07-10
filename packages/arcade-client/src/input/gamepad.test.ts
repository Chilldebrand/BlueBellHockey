import { describe, expect, it } from "vitest";
import { gamepadStateFromGamepad, type GamepadLike } from "./gamepad.js";

describe("gamepadStateFromGamepad", () => {
  it("activates the held powerup with standard button 3", () => {
    const gamepad: GamepadLike = {
      axes: [],
      buttons: Array.from({ length: 4 }, (_, index) => ({
        pressed: index === 3
      }))
    };

    expect(gamepadStateFromGamepad(gamepad).usePowerup).toBe(true);
  });
});
