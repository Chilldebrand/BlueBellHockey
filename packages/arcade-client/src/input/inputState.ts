import type { InputFrame } from "@bbh/arcade-core";
import type { ViewOrientation } from "../render/viewOrientation.js";

export interface ArcadeInputState {
  readonly moveX: number;
  readonly moveY: number;
  /** Raw right-stick sample in body space: X lateral, Y forward. */
  readonly stickX: number;
  readonly stickY: number;
  readonly pass: boolean;
  readonly check: boolean;
  readonly turbo: boolean;
  /** Backskate: glide the way you push while staying turned toward the play. */
  readonly skateBackward: boolean;
  readonly poke: boolean;
  readonly dive: boolean;
  readonly usePowerup: boolean;
}

export function createNeutralInputState(): ArcadeInputState {
  return {
    moveX: 0,
    moveY: 0,
    stickX: 0,
    stickY: 0,
    pass: false,
    check: false,
    turbo: false,
    skateBackward: false,
    poke: false,
    dive: false,
    usePowerup: false
  };
}

export function createInputFrame({
  input,
  playerId,
  slotId,
  sequence,
  viewOrientation = 1
}: {
  readonly input: ArcadeInputState;
  readonly playerId: string;
  readonly slotId: string;
  readonly sequence: number;
  /** Must match the camera's orientation or movement comes out inverted. */
  readonly viewOrientation?: ViewOrientation;
}): InputFrame {
  return {
    playerId,
    slotId,
    sequence,
    // North-south camera: screen-up is sim +x (up-ice) and screen-right is
    // sim +y, so movement rotates from screen space into world space here.
    // A flipped view (orientation -1, away attacking up their own screen)
    // yaws the camera 180 degrees, so BOTH screen axes mirror with it.
    // The skill stick is body-relative and needs no camera mapping: with the
    // camera behind your own net either way, your skater faces up-screen on
    // both teams, so stick-forward is screen-up for everyone.
    moveX: clampAxis(-input.moveY * viewOrientation),
    moveY: clampAxis(input.moveX * viewOrientation),
    stickX: clampAxis(input.stickX),
    stickY: clampAxis(input.stickY),
    pass: input.pass,
    check: input.check,
    turbo: input.turbo,
    skateBackward: input.skateBackward,
    poke: input.poke,
    dive: input.dive,
    usePowerup: input.usePowerup
  };
}

export function mergeInputStates(
  primary: ArcadeInputState,
  secondary: ArcadeInputState
): ArcadeInputState {
  return {
    moveX: dominantAxis(primary.moveX, secondary.moveX),
    moveY: dominantAxis(primary.moveY, secondary.moveY),
    stickX: dominantAxis(primary.stickX, secondary.stickX),
    stickY: dominantAxis(primary.stickY, secondary.stickY),
    pass: primary.pass || secondary.pass,
    check: primary.check || secondary.check,
    turbo: primary.turbo || secondary.turbo,
    skateBackward: primary.skateBackward || secondary.skateBackward,
    poke: primary.poke || secondary.poke,
    dive: primary.dive || secondary.dive,
    usePowerup: primary.usePowerup || secondary.usePowerup
  };
}

function clampAxis(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function dominantAxis(primary: number, secondary: number): number {
  return Math.abs(primary) >= Math.abs(secondary) ? primary : secondary;
}
