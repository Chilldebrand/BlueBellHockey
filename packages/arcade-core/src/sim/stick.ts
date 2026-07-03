import type { InputFrame, SkaterEntity, Vec2 } from "./types.js";
import { clamp, rotate } from "./physics.js";

export interface StickConfig {
  /** Blade rest distance ahead of the body when the stick is neutral. */
  readonly restOffset: number;
  /** Extra forward reach at full stick deflection (negative pulls behind). */
  readonly forwardRange: number;
  /** Lateral reach at full stick deflection. */
  readonly lateralRange: number;
  /** How fast the blade eases toward the stick sample (per second). */
  readonly bladeLerpRate: number;
}

export const STICK_CONFIG: StickConfig = {
  restOffset: 52,
  forwardRange: 78,
  lateralRange: 72,
  bladeLerpRate: 22
};

export function createStickState(): SkaterEntity["stick"] {
  return { localX: 0, localY: 0, prevLocalX: 0, prevLocalY: 0 };
}

/**
 * Ease the blade toward the raw stick sample, rate-limited so the blade moves
 * like a physical stick. Called once per tick before the puck step.
 */
export function updateStick(
  skater: SkaterEntity,
  input: InputFrame | undefined,
  dt: number,
  config: StickConfig = STICK_CONFIG
): void {
  const stick = skater.stick;
  const targetX = clamp(input?.stickX ?? 0, -1, 1);
  const targetY = clamp(input?.stickY ?? 0, -1, 1);
  const blend = Math.min(1, config.bladeLerpRate * dt);

  stick.prevLocalX = stick.localX;
  stick.prevLocalY = stick.localY;
  stick.localX += (targetX - stick.localX) * blend;
  stick.localY += (targetY - stick.localY) * blend;
}

/** Blade offset from the body center in body space (x forward, y lateral). */
export function bladeBodyOffset(
  skater: SkaterEntity,
  config: StickConfig = STICK_CONFIG
): Vec2 {
  return {
    x: config.restOffset + skater.stick.localY * config.forwardRange,
    y: skater.stick.localX * config.lateralRange
  };
}

/** World-space blade position: body offset rotated by facing. */
export function bladeWorldPosition(
  skater: SkaterEntity,
  config: StickConfig = STICK_CONFIG
): Vec2 {
  const offset = rotate(bladeBodyOffset(skater, config), skater.facing);

  return {
    x: skater.position.x + offset.x,
    y: skater.position.y + offset.y
  };
}

/**
 * World-space blade velocity over the last tick: body motion plus the blade's
 * own sweep. Drives poke direction and adds bite to gathered pucks.
 */
export function bladeWorldVelocity(
  skater: SkaterEntity,
  dt: number,
  config: StickConfig = STICK_CONFIG
): Vec2 {
  if (dt <= 0) {
    return { ...skater.velocity };
  }

  const sweep = rotate(
    {
      x: (skater.stick.localY - skater.stick.prevLocalY) * config.forwardRange,
      y: (skater.stick.localX - skater.stick.prevLocalX) * config.lateralRange
    },
    skater.facing
  );

  return {
    x: skater.velocity.x + sweep.x / dt,
    y: skater.velocity.y + sweep.y / dt
  };
}
