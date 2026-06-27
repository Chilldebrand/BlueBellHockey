import { RINK_CONFIG } from "../config/rink.js";
import type { InputFrame, SkaterEntity, Vec2 } from "./types.js";
import { clamp, clampMagnitude, magnitude, normalizeOrZero } from "./physics.js";

export interface SkaterMovementConfig {
  readonly acceleration: number;
  readonly maxSpeed: number;
  readonly glideDrag: number;
  readonly radius: number;
}

export const SKATER_MOVEMENT_CONFIG: SkaterMovementConfig = {
  acceleration: 2200,
  maxSpeed: 640,
  glideDrag: 3.2,
  radius: 38
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

  if (magnitude(movement) > 0) {
    skater.velocity = clampMagnitude(
      {
        x: skater.velocity.x + movement.x * config.acceleration * dtSeconds,
        y: skater.velocity.y + movement.y * config.acceleration * dtSeconds
      },
      config.maxSpeed
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
