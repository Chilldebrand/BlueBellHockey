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

  it("backskates on LT (standard button 6) and nothing else", () => {
    const pressedOnly = (index: number): GamepadLike => ({
      axes: [],
      buttons: Array.from({ length: 11 }, (_, i) => ({ pressed: i === index }))
    });

    const lt = gamepadStateFromGamepad(pressedOnly(6));
    expect(lt.skateBackward).toBe(true);
    // LT must not be confused with its neighbours: LB dives, RT passes.
    expect(lt.dive).toBe(false);
    expect(lt.pass).toBe(false);
    expect(gamepadStateFromGamepad(pressedOnly(4)).skateBackward).toBe(false);
    expect(gamepadStateFromGamepad(pressedOnly(7)).skateBackward).toBe(false);
  });
});
