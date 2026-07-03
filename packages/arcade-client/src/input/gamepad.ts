import {
  createNeutralInputState,
  type ArcadeInputState
} from "./inputState.js";

export interface GamepadLike {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean }[];
}

/**
 * NHL-style hybrid layout: left stick skates, right stick IS the puck —
 * sweep it to stickhandle, flick up for a wrist shot, pull back then flick
 * up for a slap shot. Controller up maps to stick-forward (+Y in body space).
 * The stick uses a light deadzone so slow dangles aren't eaten.
 */
export function gamepadStateFromGamepad(
  gamepad: GamepadLike | null | undefined,
  moveDeadzone = 0.18,
  stickDeadzone = 0.08
): ArcadeInputState {
  if (!gamepad) {
    return createNeutralInputState();
  }

  return {
    ...createNeutralInputState(),
    moveX: applyDeadzone(gamepad.axes[0] ?? 0, moveDeadzone),
    moveY: applyDeadzone(gamepad.axes[1] ?? 0, moveDeadzone),
    stickX: applyDeadzone(gamepad.axes[2] ?? 0, stickDeadzone),
    stickY: applyDeadzone(-(gamepad.axes[3] ?? 0), stickDeadzone),
    pass: gamepad.buttons[0]?.pressed === true, // A
    check: gamepad.buttons[2]?.pressed === true, // X
    turbo:
      gamepad.buttons[5]?.pressed === true || // RB
      gamepad.buttons[7]?.pressed === true, // RT
    switchTarget: gamepad.buttons[4]?.pressed === true // LB
  };
}

function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) {
    return 0;
  }

  return Math.min(1, Math.max(-1, value));
}
