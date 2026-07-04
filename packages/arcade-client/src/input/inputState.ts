import type { InputFrame } from "@bbh/arcade-core";

export interface ArcadeInputState {
  readonly moveX: number;
  readonly moveY: number;
  /** Raw right-stick sample in body space: X lateral, Y forward. */
  readonly stickX: number;
  readonly stickY: number;
  readonly pass: boolean;
  readonly check: boolean;
  readonly turbo: boolean;
  readonly switchTarget: boolean;
  readonly poke: boolean;
  readonly dive: boolean;
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
    switchTarget: false,
    poke: false,
    dive: false
  };
}

export function createInputFrame({
  input,
  playerId,
  slotId,
  sequence
}: {
  readonly input: ArcadeInputState;
  readonly playerId: string;
  readonly slotId: string;
  readonly sequence: number;
}): InputFrame {
  return {
    playerId,
    slotId,
    sequence,
    // North-south camera: screen-up is sim +x (up-ice) and screen-right is
    // sim +y, so movement rotates from screen space into world space here.
    // The skill stick is body-relative and needs no camera mapping.
    moveX: clampAxis(-input.moveY),
    moveY: clampAxis(input.moveX),
    stickX: clampAxis(input.stickX),
    stickY: clampAxis(input.stickY),
    pass: input.pass,
    check: input.check,
    turbo: input.turbo,
    switchTarget: input.switchTarget,
    poke: input.poke,
    dive: input.dive
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
    switchTarget: primary.switchTarget || secondary.switchTarget,
    poke: primary.poke || secondary.poke,
    dive: primary.dive || secondary.dive
  };
}

function clampAxis(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function dominantAxis(primary: number, secondary: number): number {
  return Math.abs(primary) >= Math.abs(secondary) ? primary : secondary;
}
