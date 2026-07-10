import {
  createNeutralInputState,
  type ArcadeInputState
} from "./inputState.js";

export interface KeyboardInputTracker {
  readonly read: () => ArcadeInputState;
  readonly dispose: () => void;
}

type KeyTarget = Pick<
  Window,
  "addEventListener" | "removeEventListener"
>;

// Simple-shot accessibility fallback: keyboard players don't have an analog
// stick, so Space synthesizes the same raw stick samples a gamepad would
// produce — tap = forward flick (wrist), hold = pull back (windup) and the
// release flicks forward (slap). The sim only ever sees stick samples.
const SIMPLE_SHOT_TAP_MS = 180;
const SIMPLE_SHOT_FLICK_FRAMES = 3;

export function createKeyboardInputTracker(
  target: KeyTarget = window,
  now: () => number = () => performance.now()
): KeyboardInputTracker {
  const pressed = new Set<string>();
  let shootHeldSinceMs: number | null = null;
  let flickFramesLeft = 0;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "Space" && !pressed.has("Space")) {
      shootHeldSinceMs = now();
    }

    pressed.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "Space") {
      flickFramesLeft = SIMPLE_SHOT_FLICK_FRAMES;
      shootHeldSinceMs = null;
    }

    pressed.delete(event.code);
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);

  return {
    read: () => {
      const base = keyboardStateFromPressedKeys(pressed);
      let stickY = base.stickY;

      if (pressed.has("Space") && shootHeldSinceMs !== null) {
        // Held past the tap window: wind up (pull the stick back).
        if (now() - shootHeldSinceMs > SIMPLE_SHOT_TAP_MS) {
          stickY = -1;
        }
      } else if (flickFramesLeft > 0) {
        flickFramesLeft -= 1;
        stickY = 1;
      }

      return { ...base, stickY };
    },
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      pressed.clear();
    }
  };
}

export function keyboardStateFromPressedKeys(
  pressed: ReadonlySet<string>
): ArcadeInputState {
  return {
    ...createNeutralInputState(),
    moveX:
      Number(pressed.has("KeyD") || pressed.has("ArrowRight")) -
      Number(pressed.has("KeyA") || pressed.has("ArrowLeft")),
    moveY:
      Number(pressed.has("KeyS") || pressed.has("ArrowDown")) -
      Number(pressed.has("KeyW") || pressed.has("ArrowUp")),
    // IJKL nudges the stick directly for keyboard dangles.
    stickX: Number(pressed.has("KeyL")) - Number(pressed.has("KeyJ")),
    stickY: Number(pressed.has("KeyI")) - Number(pressed.has("KeyK")),
    pass: pressed.has("KeyF"),
    check: pressed.has("KeyG"),
    poke: pressed.has("KeyR"),
    dive: pressed.has("KeyV"),
    usePowerup: pressed.has("KeyQ"),
    turbo: pressed.has("ShiftLeft") || pressed.has("ShiftRight")
  };
}
