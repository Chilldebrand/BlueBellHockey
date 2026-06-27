import { RINK_CONFIG } from "../config/rink.js";
import type { InputFrame, PuckState, SkaterEntity, Vec2, WorldState } from "./types.js";
import { clamp, magnitude, normalizeOrZero } from "./physics.js";
import { inputAimOrFacing, passDirectionWithAssist } from "./actions.js";

export interface PuckConfig {
  readonly radius: number;
  readonly carryOffset: number;
  readonly stickReach: number;
  readonly frictionPerSecond: number;
  readonly boardRestitution: number;
  readonly passSpeed: number;
  readonly wristShotSpeed: number;
  readonly maxChargedShotSpeed: number;
  readonly maxChargeMs: number;
  readonly releasePickupCooldownMs: number;
}

export const PUCK_CONFIG: PuckConfig = {
  radius: 18,
  carryOffset: 58,
  stickReach: 82,
  frictionPerSecond: 1.65,
  boardRestitution: 0.72,
  passSpeed: 820,
  wristShotSpeed: 1040,
  maxChargedShotSpeed: 1460,
  maxChargeMs: 600,
  releasePickupCooldownMs: 220
};

export function createInitialPuckState(position: Vec2): PuckState {
  return {
    position,
    velocity: { x: 0, y: 0 },
    carrierSlotId: null,
    lastTouchSlotId: null,
    shotBySlotId: null,
    shotPower: 0,
    isChargedShot: false,
    chargeBySlotId: null,
    chargeStartedAtMs: null,
    pickupDisabledForSlotId: null,
    pickupDisabledUntilMs: 0
  };
}

export function stepPuck(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>,
  dtMs: number,
  config: PuckConfig = PUCK_CONFIG
): void {
  const carrier = world.puck.carrierSlotId
    ? world.skaters.find((skater) => skater.id === world.puck.carrierSlotId)
    : undefined;

  if (carrier) {
    stepCarriedPuck(world, carrier, inputsBySlot.get(carrier.id), config);
    return;
  }

  stepLoosePuck(world.puck, dtMs, config);
  tryPickupLoosePuck(world, inputsBySlot, config);
}

function stepCarriedPuck(
  world: WorldState,
  carrier: SkaterEntity,
  input: InputFrame | undefined,
  config: PuckConfig
): void {
  const direction = inputAimOrFacing(input, carrier);

  world.puck.position = carriedPuckPosition(carrier, direction, config);
  world.puck.velocity = { x: 0, y: 0 };
  world.puck.lastTouchSlotId = carrier.id;

  if (input?.pass) {
    releasePuck(world, carrier, passDirectionWithAssist(world, carrier, input), {
      speed: config.passSpeed,
      shotPower: 0,
      isChargedShot: false,
      shotBySlotId: null,
      pickupCooldownMs: config.releasePickupCooldownMs
    });
    return;
  }

  if (input?.shoot) {
    if (world.puck.chargeBySlotId !== carrier.id) {
      world.puck.chargeBySlotId = carrier.id;
      world.puck.chargeStartedAtMs = world.time.nowMs;
    }
    return;
  }

  if (world.puck.chargeBySlotId === carrier.id) {
    const chargeMs = Math.max(
      0,
      world.time.nowMs - (world.puck.chargeStartedAtMs ?? world.time.nowMs)
    );
    const charge = clamp(chargeMs / config.maxChargeMs, 0, 1);
    const speed =
      config.wristShotSpeed +
      (config.maxChargedShotSpeed - config.wristShotSpeed) * charge;

    releasePuck(world, carrier, direction, {
      speed,
      shotPower: speed,
      isChargedShot: charge > 0.15,
      shotBySlotId: carrier.id,
      pickupCooldownMs: config.releasePickupCooldownMs
    });
  }
}

function stepLoosePuck(
  puck: PuckState,
  dtMs: number,
  config: PuckConfig
): void {
  const dtSeconds = dtMs / 1000;

  puck.position = {
    x: puck.position.x + puck.velocity.x * dtSeconds,
    y: puck.position.y + puck.velocity.y * dtSeconds
  };

  if (!isAcrossGoalMouth(puck)) {
    reboundFromBoards(puck, config);
  }

  const drag = Math.max(0, 1 - config.frictionPerSecond * dtSeconds);
  puck.velocity = {
    x: puck.velocity.x * drag,
    y: puck.velocity.y * drag
  };
}

function isAcrossGoalMouth(puck: PuckState): boolean {
  return (
    (puck.position.x <= 0 || puck.position.x >= RINK_CONFIG.width) &&
    Math.abs(puck.position.y - RINK_CONFIG.height / 2) <= RINK_CONFIG.goalWidth / 2
  );
}

function tryPickupLoosePuck(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>,
  config: PuckConfig
): void {
  for (const skater of world.skaters) {
    if (
      world.puck.pickupDisabledForSlotId === skater.id &&
      world.time.nowMs < world.puck.pickupDisabledUntilMs
    ) {
      continue;
    }

    const direction = inputAimOrFacing(inputsBySlot.get(skater.id), skater);
    const stick = carriedPuckPosition(skater, direction, config);
    const distance = magnitude({
      x: world.puck.position.x - stick.x,
      y: world.puck.position.y - stick.y
    });

    if (distance <= config.stickReach) {
      world.puck.carrierSlotId = skater.id;
      world.puck.lastTouchSlotId = skater.id;
      world.puck.shotBySlotId = null;
      world.puck.shotPower = 0;
      world.puck.isChargedShot = false;
      world.puck.chargeBySlotId = null;
      world.puck.chargeStartedAtMs = null;
      world.puck.pickupDisabledForSlotId = null;
      world.puck.pickupDisabledUntilMs = 0;
      world.puck.position = stick;
      world.puck.velocity = { x: 0, y: 0 };
      return;
    }
  }
}

function releasePuck(
  world: WorldState,
  carrier: SkaterEntity,
  direction: Vec2,
  release: {
    readonly speed: number;
    readonly shotPower: number;
    readonly isChargedShot: boolean;
    readonly shotBySlotId: string | null;
    readonly pickupCooldownMs: number;
  }
): void {
  const normalized = normalizeOrZero(direction);

  world.puck.carrierSlotId = null;
  world.puck.lastTouchSlotId = carrier.id;
  world.puck.shotBySlotId = release.shotBySlotId;
  world.puck.shotPower = release.shotPower;
  world.puck.isChargedShot = release.isChargedShot;
  world.puck.chargeBySlotId = null;
  world.puck.chargeStartedAtMs = null;
  world.puck.pickupDisabledForSlotId = carrier.id;
  world.puck.pickupDisabledUntilMs = world.time.nowMs + release.pickupCooldownMs;
  world.puck.velocity = {
    x: normalized.x * release.speed,
    y: normalized.y * release.speed
  };
}

function carriedPuckPosition(
  skater: SkaterEntity,
  direction: Vec2,
  config: PuckConfig
): Vec2 {
  return {
    x: skater.position.x + direction.x * config.carryOffset,
    y: skater.position.y + direction.y * config.carryOffset
  };
}

function reboundFromBoards(puck: PuckState, config: PuckConfig): void {
  const minX = config.radius;
  const maxX = RINK_CONFIG.width - config.radius;
  const minY = config.radius;
  const maxY = RINK_CONFIG.height - config.radius;
  const clampedX = clamp(puck.position.x, minX, maxX);
  const clampedY = clamp(puck.position.y, minY, maxY);

  if (clampedX !== puck.position.x) {
    puck.velocity.x = -puck.velocity.x * config.boardRestitution;
  }

  if (clampedY !== puck.position.y) {
    puck.velocity.y = -puck.velocity.y * config.boardRestitution;
  }

  puck.position = {
    x: clampedX,
    y: clampedY
  };
}
