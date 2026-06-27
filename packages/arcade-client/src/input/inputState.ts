import type { InputFrame } from "@bbh/arcade-core";

export interface ArcadeInputState {
  readonly moveX: number;
  readonly moveY: number;
  readonly aimX: number;
  readonly aimY: number;
  readonly pass: boolean;
  readonly shoot: boolean;
  readonly check: boolean;
  readonly turbo: boolean;
  readonly switchTarget: boolean;
  readonly usePowerup: boolean;
  readonly special: boolean;
}

export function createNeutralInputState(): ArcadeInputState {
  return {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    pass: false,
    shoot: false,
    check: false,
    turbo: false,
    switchTarget: false,
    usePowerup: false,
    special: false
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
    moveX: clampAxis(input.moveX),
    moveY: clampAxis(input.moveY),
    aimX: clampAxis(input.aimX),
    aimY: clampAxis(input.aimY),
    pass: input.pass,
    shoot: input.shoot,
    check: input.check,
    turbo: input.turbo,
    switchTarget: input.switchTarget,
    usePowerup: input.usePowerup,
    special: input.special
  };
}

export function mergeInputStates(
  primary: ArcadeInputState,
  secondary: ArcadeInputState
): ArcadeInputState {
  return {
    moveX: dominantAxis(primary.moveX, secondary.moveX),
    moveY: dominantAxis(primary.moveY, secondary.moveY),
    aimX: dominantAxis(primary.aimX, secondary.aimX),
    aimY: dominantAxis(primary.aimY, secondary.aimY),
    pass: primary.pass || secondary.pass,
    shoot: primary.shoot || secondary.shoot,
    check: primary.check || secondary.check,
    turbo: primary.turbo || secondary.turbo,
    switchTarget: primary.switchTarget || secondary.switchTarget,
    usePowerup: primary.usePowerup || secondary.usePowerup,
    special: primary.special || secondary.special
  };
}

function clampAxis(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function dominantAxis(primary: number, secondary: number): number {
  return Math.abs(primary) >= Math.abs(secondary) ? primary : secondary;
}
