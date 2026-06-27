import {
  createNeutralInputState,
  type ArcadeInputState
} from "./inputState.js";

export interface GamepadLike {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean }[];
}

export function gamepadStateFromGamepad(
  gamepad: GamepadLike | null | undefined,
  deadzone = 0.18
): ArcadeInputState {
  if (!gamepad) {
    return createNeutralInputState();
  }

  return {
    ...createNeutralInputState(),
    moveX: applyDeadzone(gamepad.axes[0] ?? 0, deadzone),
    moveY: applyDeadzone(gamepad.axes[1] ?? 0, deadzone),
    aimX: applyDeadzone(gamepad.axes[2] ?? 0, deadzone),
    aimY: applyDeadzone(gamepad.axes[3] ?? 0, deadzone),
    pass: gamepad.buttons[0]?.pressed === true,
    shoot: gamepad.buttons[1]?.pressed === true,
    check: gamepad.buttons[2]?.pressed === true,
    turbo: gamepad.buttons[5]?.pressed === true,
    switchTarget: gamepad.buttons[4]?.pressed === true,
    usePowerup: gamepad.buttons[3]?.pressed === true,
    special: gamepad.buttons[7]?.pressed === true
  };
}

function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) {
    return 0;
  }

  return Math.min(1, Math.max(-1, value));
}
