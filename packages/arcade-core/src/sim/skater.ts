import { RINK_CONFIG } from "../config/rink.js";
import type { InputFrame, SkaterEntity, Vec2 } from "./types.js";
import { clamp, clampMagnitude, magnitude, normalizeOrZero } from "./physics.js";

export interface SkaterMovementConfig {
  readonly acceleration: number;
  readonly maxSpeed: number;
  readonly glideDrag: number;
  readonly radius: number;
  readonly turboAccelerationMultiplier: number;
  readonly turboMaxSpeedMultiplier: number;
  readonly turboHandlingPenalty: number;
  readonly turboDrainPerSecond: number;
  readonly turboRechargePerSecond: number;
  readonly turboMinActivation: number;
}

export const SKATER_MOVEMENT_CONFIG: SkaterMovementConfig = {
  acceleration: 2350,
  maxSpeed: 675,
  glideDrag: 3.05,
  radius: 38,
  turboAccelerationMultiplier: 1.32,
  turboMaxSpeedMultiplier: 1.38,
  turboHandlingPenalty: 0.82,
  turboDrainPerSecond: 0.78,
  turboRechargePerSecond: 0.4,
  turboMinActivation: 0.08
};

export function stepSkater(
  skater: SkaterEntity,
  input: InputFrame | undefined,
  dtMs: number,
  config: SkaterMovementConfig = SKATER_MOVEMENT_CONFIG
): void {
  const dtSeconds = dtMs / 1000;
  if (skater.contactState === "knockedDown") {
    skater.position = {
      x: skater.position.x + skater.velocity.x * dtSeconds,
      y: skater.position.y + skater.velocity.y * dtSeconds
    };
    skater.velocity = {
      x: skater.velocity.x * Math.max(0, 1 - config.glideDrag * dtSeconds),
      y: skater.velocity.y * Math.max(0, 1 - config.glideDrag * dtSeconds)
    };
    clampSkaterToRink(skater, config);
    return;
  }

  const movement = normalizedMovement(input);
  const turboActive =
    input?.turbo === true && skater.turboMeter >= config.turboMinActivation;

  if (turboActive) {
    skater.turboMeter = clamp(
      skater.turboMeter - config.turboDrainPerSecond * dtSeconds,
      0,
      1
    );
  } else {
    skater.turboMeter = clamp(
      skater.turboMeter + config.turboRechargePerSecond * dtSeconds,
      0,
      1
    );
  }

  if (magnitude(movement) > 0) {
    const acceleration = turboActive
      ? config.acceleration * config.turboAccelerationMultiplier
      : config.acceleration;
    const maxSpeed = turboActive
      ? config.maxSpeed * config.turboMaxSpeedMultiplier
      : config.maxSpeed;
    const handling = turboActive ? config.turboHandlingPenalty : 1;
    skater.velocity = clampMagnitude(
      {
        x: skater.velocity.x + movement.x * acceleration * handling * dtSeconds,
        y: skater.velocity.y + movement.y * acceleration * handling * dtSeconds
      },
      maxSpeed
    );
  } else {
    const drag = Math.max(0, 1 - config.glideDrag * dtSeconds);
    skater.velocity = {
      x: skater.velocity.x * drag,
      y: skater.velocity.y * drag
    };
  }

  skater.position = {
    x: skater.position.x + skater.velocity.x * dtSeconds,
    y: skater.position.y + skater.velocity.y * dtSeconds
  };
  clampSkaterToRink(skater, config);
}

function normalizedMovement(input: InputFrame | undefined): Vec2 {
  if (!input) {
    return { x: 0, y: 0 };
  }

  return normalizeOrZero({
    x: clamp(input.moveX, -1, 1),
    y: clamp(input.moveY, -1, 1)
  });
}

function clampSkaterToRink(
  skater: SkaterEntity,
  config: SkaterMovementConfig
): void {
  const minX = config.radius;
  const maxX = RINK_CONFIG.width - config.radius;
  const minY = config.radius;
  const maxY = RINK_CONFIG.height - config.radius;
  const clampedX = clamp(skater.position.x, minX, maxX);
  const clampedY = clamp(skater.position.y, minY, maxY);

  if (clampedX !== skater.position.x) {
    skater.velocity.x = 0;
  }

  if (clampedY !== skater.position.y) {
    skater.velocity.y = 0;
  }

  skater.position = {
    x: clampedX,
    y: clampedY
  };
}
