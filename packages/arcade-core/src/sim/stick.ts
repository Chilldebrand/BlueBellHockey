import type { InputFrame, SkaterEntity, Vec2 } from "./types.js";
import { clamp, rotate } from "./physics.js";

export interface StickConfig {
  /** Blade rest distance ahead of the body when the stick is neutral. */
  readonly restOffset: number;
  /**
   * Lateral rest offset of the blade (right of facing) when the stick is
   * neutral: a right-handed forehand carry sits the puck off to the right
   * rather than dead centre. The whole lateral range shifts with it.
   */
  readonly restLateral: number;
  /** Extra forward reach at full stick deflection (negative pulls behind). */
  readonly forwardRange: number;
  /**
   * Lateral travel from the rest offset at full stick deflection, per side.
   * Split because the reach is deliberately ASYMMETRIC: the carry sits off to
   * the right (restLateral), so a single range would either cramp the
   * backhand side or throw the forehand side miles out.
   *
   * What these two numbers buy, measured from the body centre:
   *   forehand/right extent = restLateral + lateralRangeRight = +84
   *   backhand/left  extent = restLateral - lateralRangeLeft  = -67.2
   *
   * 2026-07-26 (user): right reach cut 15% (116.5 -> 99), then cut another
   * 15% on playtest (99 -> 84) because it still reached too far. The left
   * tracks it at 80% of the right reach throughout (-27.5 -> -67.2), so the
   * stick crosses the body on the backhand instead of barely clearing the hip.
   * Total sweep is 151.2, close to the original 144 — the first pass widened
   * it to 178 and that extra arc is what read as MORE reach, not less.
   */
  readonly lateralRangeRight: number;
  readonly lateralRangeLeft: number;
  /** How fast the blade eases toward the stick sample (per second). */
  readonly bladeLerpRate: number;
  /** Extra forward reach while a poke-check lunge is live. */
  readonly pokeReachBonus: number;
}

// bladeLerpRate tuned up (22 → 34) for NHL-25-style dangle fluidity: the
// blade tracks the stick nearly one-to-one instead of trailing it.
export const STICK_CONFIG: StickConfig = {
  // Playtested carry: blade sits closer in and further to the right (a strong
  // right-handed forehand cradle) rather than dead ahead.
  restOffset: 22,
  restLateral: 44.5,
  forwardRange: 78,
  lateralRangeRight: 39.5,
  lateralRangeLeft: 111.7,
  bladeLerpRate: 34,
  pokeReachBonus: 58
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

/**
 * Lateral blade offset for a stick sample. The two ranges meet at localX 0
 * (the rest carry), so the curve is continuous — sweeps that cross the middle
 * do not jump.
 */
export function lateralBladeOffset(
  localX: number,
  config: StickConfig = STICK_CONFIG
): number {
  const range = localX >= 0 ? config.lateralRangeRight : config.lateralRangeLeft;
  return config.restLateral + localX * range;
}

/**
 * Blade offset from the body center in body space (x forward, y lateral).
 * Pass the sim time to include a live poke-check lunge in the reach.
 */
export function bladeBodyOffset(
  skater: SkaterEntity,
  config: StickConfig = STICK_CONFIG,
  nowMs = 0
): Vec2 {
  const pokeBonus = skater.pokeUntilMs > nowMs ? config.pokeReachBonus : 0;

  return {
    x: config.restOffset + skater.stick.localY * config.forwardRange + pokeBonus,
    y: lateralBladeOffset(skater.stick.localX, config)
  };
}

/**
 * The neutral carry point just ahead-right of the skates ("by the feet").
 * During a slap windup the puck tethers here instead of the drawn-back
 * blade — in real hockey only the stick goes back, not the puck.
 */
export function carryRestWorldPosition(
  skater: SkaterEntity,
  config: StickConfig = STICK_CONFIG
): Vec2 {
  const offset = rotate(
    { x: config.restOffset, y: config.restLateral },
    skater.facing
  );

  return {
    x: skater.position.x + offset.x,
    y: skater.position.y + offset.y
  };
}

/** World-space blade position: body offset rotated by facing. */
export function bladeWorldPosition(
  skater: SkaterEntity,
  config: StickConfig = STICK_CONFIG,
  nowMs = 0
): Vec2 {
  const offset = rotate(bladeBodyOffset(skater, config, nowMs), skater.facing);

  return {
    x: skater.position.x + offset.x,
    y: skater.position.y + offset.y
  };
}

/**
 * How far the blade itself swept this tick, ignoring body motion. Rotation
 * preserves length, so the raw local delta is the world distance.
 *
 * The carry tether uses this to tell a DANGLE apart from an over-dangle: when
 * the stick rips across, the puck physically cannot keep pace with the blade
 * for a few ticks, and without this a hard deke read as losing the puck.
 */
export function bladeSweepDistance(
  skater: SkaterEntity,
  config: StickConfig = STICK_CONFIG
): number {
  return Math.hypot(
    (skater.stick.localY - skater.stick.prevLocalY) * config.forwardRange,
    lateralSweep(skater, config)
  );
}

/**
 * Lateral distance the blade actually moved this tick. Taken as a DIFFERENCE
 * of offsets rather than delta x range, because the two lateral ranges differ
 * — a sweep that crosses the centre travels at one rate on the backhand side
 * and another on the forehand side.
 */
function lateralSweep(skater: SkaterEntity, config: StickConfig): number {
  return (
    lateralBladeOffset(skater.stick.localX, config) -
    lateralBladeOffset(skater.stick.prevLocalX, config)
  );
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
      y: lateralSweep(skater, config)
    },
    skater.facing
  );

  return {
    x: skater.velocity.x + sweep.x / dt,
    y: skater.velocity.y + sweep.y / dt
  };
}
