import { describe, expect, it } from "vitest";
import {
  createKeyboardInputTracker,
  keyboardStateFromPressedKeys
} from "./keyboard.js";

describe("keyboardStateFromPressedKeys", () => {
  it("backskates with Q", () => {
    // Q used to fire a held powerup; pickups have auto-activated since
    // 2026-07-13, so the key was bound to nothing the sim reads.
    const input = keyboardStateFromPressedKeys(new Set(["KeyQ"]));

    expect(input.skateBackward).toBe(true);
    expect(input.usePowerup).toBe(false);
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
