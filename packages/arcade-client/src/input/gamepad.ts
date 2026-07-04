import {
  createNeutralInputState,
  type ArcadeInputState
} from "./inputState.js";

export interface GamepadLike {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean }[];
}

/**
 * EA NHL 25 Skill Stick layout (Xbox indices): left stick skates, right stick
 * IS the puck — sweep to stickhandle, flick up = wrist shot, pull back then
 * flick up = slap shot. Controller up maps to stick-forward in body space.
 *
 *   A  = pass (offense) / stick lift (defense)
 *   B  = shoulder check      X = hip check   (both body checks here)
 *   LB = block shot (dive)   RB = poke check
 *   RT = switch player       L3 = skate/hustle (turbo)
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
    check:
      gamepad.buttons[1]?.pressed === true || // B — shoulder check
      gamepad.buttons[2]?.pressed === true, // X — hip check
    dive: gamepad.buttons[4]?.pressed === true, // LB — block shot
    poke: gamepad.buttons[5]?.pressed === true, // RB — poke check
    switchTarget: gamepad.buttons[7]?.pressed === true, // RT
    turbo: gamepad.buttons[10]?.pressed === true // L3 — hustle
  };
}

function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) {
    return 0;
  }

  return Math.min(1, Math.max(-1, value));
}
