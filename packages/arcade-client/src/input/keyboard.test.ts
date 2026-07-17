import { describe, expect, it } from "vitest";
import {
  createKeyboardInputTracker,
  keyboardStateFromPressedKeys
} from "./keyboard.js";

describe("keyboardStateFromPressedKeys", () => {
  it("activates the held powerup with Q", () => {
    const input = keyboardStateFromPressedKeys(new Set(["KeyQ"]));

    expect(input.usePowerup).toBe(true);
  });

  it("clears held gameplay keys when settings suspend live input", () => {
    const listeners = new Map<string, (event: { code: string }) => void>();
    const tracker = createKeyboardInputTracker(
      {
        addEventListener: (
          type: string,
          listener: EventListenerOrEventListenerObject
        ) => {
          listeners.set(
            type,
            listener as unknown as (event: { code: string }) => void
          );
        },
        removeEventListener: () => undefined
      },
      () => 0
    );

    listeners.get("keydown")?.({ code: "KeyW" });
    listeners.get("keydown")?.({ code: "Space" });
    expect(tracker.read().moveY).toBe(-1);

    tracker.clear();

    expect(tracker.read()).toEqual(keyboardStateFromPressedKeys(new Set()));
  });
});
