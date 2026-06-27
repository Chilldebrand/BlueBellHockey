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

export function createKeyboardInputTracker(
  target: KeyTarget = window
): KeyboardInputTracker {
  const pressed = new Set<string>();
  const onKeyDown = (event: KeyboardEvent) => {
    pressed.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent) => {
    pressed.delete(event.code);
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);

  return {
    read: () => keyboardStateFromPressedKeys(pressed),
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
    pass: pressed.has("KeyJ"),
    shoot: pressed.has("Space"),
    check: pressed.has("KeyK"),
    turbo: pressed.has("ShiftLeft") || pressed.has("ShiftRight"),
    switchTarget: pressed.has("KeyQ"),
    usePowerup: pressed.has("KeyE"),
    special: pressed.has("KeyF")
  };
}
