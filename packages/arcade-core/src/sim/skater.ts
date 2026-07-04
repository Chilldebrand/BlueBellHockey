import type { InputFrame, SkaterEntity, Vec2 } from "./types.js";
import { containCircleInRink } from "./boards.js";
import {
  angleDifference,
  angleOf,
  clamp,
  dot,
  expDecay,
  fromAngle,
  magnitude,
  normalizeOrZero,
  turnToward
} from "./physics.js";

export interface SkaterMovementConfig {
  /** Thrust along the facing direction (units/s²). */
  readonly acceleration: number;
  readonly maxSpeed: number;
  readonly radius: number;
  /** Per-second decay of along-facing speed — light, this is the ice glide. */
  readonly glideDrag: number;
  /** Extra per-second decay applied when there is no movement input. */
  readonly releaseDrag: number;
  /** Per-second decay of sideways speed — heavy, this is the edge bite. */
  readonly lateralGrip: number;
  /** Per-second decay while the stick is pulled against travel (hard stop). */
  readonly brakeDrag: number;
  /** How fast facing turns toward the stick at a standstill (rad/s). */
  readonly turnRate: number;
  /** Fraction of turnRate still available at max speed (broad fast arcs). */
  readonly highSpeedTurnRetention: number;
  /** Per-second decay pulling an over-cap skater back to max speed. */
  readonly overSpeedDrag: number;
  readonly boardRestitution: number;
  readonly boardTangentRetention: number;
  readonly turboAccelerationMultiplier: number;
  readonly turboMaxSpeedMultiplier: number;
  /** Turbo turns worse: multiplies turn rate (< 1). */
  readonly turboTurnRateMultiplier: number;
  /** Turbo edges bite less: multiplies lateral grip (< 1). */
  readonly turboGripMultiplier: number;
  readonly turboDrainPerSecond: number;
  readonly turboRechargePerSecond: number;
  readonly turboMinActivation: number;
  /** Per-second velocity decay while sliding out a knockdown. */
  readonly knockdownDrag: number;
  /** Speed multiplier while winding up a slap shot — telegraphs the bomb. */
  readonly windupSpeedMultiplier: number;
}

// Feel pass 2026-07-03: normal skating slowed so turbo reads as a real burst
// (cruise 560, turbo 840 — a full 50% jump instead of the old 38%).
export const SKATER_MOVEMENT_CONFIG: SkaterMovementConfig = {
  acceleration: 1450,
  maxSpeed: 560,
  radius: 38,
  glideDrag: 0.55,
  releaseDrag: 1.15,
  lateralGrip: 7.5,
  brakeDrag: 5.5,
  // NHL-25 fluidity pass: livelier turning, especially at speed.
  turnRate: 10.5,
  highSpeedTurnRetention: 0.5,
  overSpeedDrag: 2.4,
  boardRestitution: 0.35,
  boardTangentRetention: 0.86,
  turboAccelerationMultiplier: 1.42,
  turboMaxSpeedMultiplier: 1.5,
  turboTurnRateMultiplier: 0.55,
  turboGripMultiplier: 0.45,
  turboDrainPerSecond: 0.78,
  turboRechargePerSecond: 0.4,
  turboMinActivation: 0.08,
  knockdownDrag: 3.05,
  windupSpeedMultiplier: 0.62
};

/**
 * Facing + anisotropic-grip skating. The stick steers the skater's facing at
 * a capped, speed-dependent turn rate; thrust pushes along facing; velocity
 * is split into an along-facing component (long glide) and a lateral one
 * (fast decay — the edges bite), so hard turns at speed carve a visible,
 * controllable drift arc instead of snapping direction. Turbo trades top
 * speed for turn rate and grip.
 */
export function stepSkater(
  skater: SkaterEntity,
  input: InputFrame | undefined,
  dtMs: number,
  config: SkaterMovementConfig = SKATER_MOVEMENT_CONFIG
): void {
  const dt = dtMs / 1000;

  if (skater.contactState === "knockedDown" || skater.contactState === "diving") {
    const slide = expDecay(config.knockdownDrag, dt);
    skater.velocity.x *= slide;
    skater.velocity.y *= slide;
    integrateAndContain(skater, dt, config);
    return;
  }

  const move = normalizedMovement(input);
  const hasInput = magnitude(move) > 0;
  const turboActive =
    input?.turbo === true && skater.turboMeter >= config.turboMinActivation;

  skater.turboMeter = clamp(
    skater.turboMeter +
      (turboActive
        ? -config.turboDrainPerSecond
        : config.turboRechargePerSecond) *
        dt,
    0,
    1
  );

  const maxSpeed =
    config.maxSpeed *
    (turboActive ? config.turboMaxSpeedMultiplier : 1) *
    (skater.gesture.phase === "windup" ? config.windupSpeedMultiplier : 1);
  const speed = magnitude(skater.velocity);
  let braking = false;

  if (hasInput) {
    const desired = angleOf(move);
    const speedFactor = maxSpeed > 0 ? clamp(speed / maxSpeed, 0, 1) : 1;
    const turnRate =
      config.turnRate *
      (1 - speedFactor * (1 - config.highSpeedTurnRetention)) *
      (turboActive ? config.turboTurnRateMultiplier : 1);

    skater.facing = turnToward(skater.facing, desired, turnRate * dt);

    const alignment = Math.cos(angleDifference(skater.facing, desired));

    if (alignment > 0) {
      const thrust =
        config.acceleration *
        (turboActive ? config.turboAccelerationMultiplier : 1) *
        alignment;
      skater.velocity.x += Math.cos(skater.facing) * thrust * dt;
      skater.velocity.y += Math.sin(skater.facing) * thrust * dt;
    } else if (alignment < -0.35) {
      // Stick pulled against the body: dig in and stop hard.
      braking = true;
    }
  }

  applyAnisotropicDrag(skater, dt, config, {
    hasInput,
    braking,
    turboActive
  });
  capSpeed(skater, maxSpeed, dt, config);
  integrateAndContain(skater, dt, config);
}

function applyAnisotropicDrag(
  skater: SkaterEntity,
  dt: number,
  config: SkaterMovementConfig,
  state: { hasInput: boolean; braking: boolean; turboActive: boolean }
): void {
  const forward = fromAngle(skater.facing);
  const along = dot(skater.velocity, forward);
  const lateralX = skater.velocity.x - forward.x * along;
  const lateralY = skater.velocity.y - forward.y * along;

  let alongDrag = config.glideDrag;

  if (state.braking) {
    alongDrag += config.brakeDrag;
  } else if (!state.hasInput) {
    alongDrag += config.releaseDrag;
  }

  const grip =
    config.lateralGrip * (state.turboActive ? config.turboGripMultiplier : 1);
  const alongScale = expDecay(alongDrag, dt);
  const lateralScale = expDecay(grip, dt);

  skater.velocity.x = forward.x * along * alongScale + lateralX * lateralScale;
  skater.velocity.y = forward.y * along * alongScale + lateralY * lateralScale;
}

/**
 * Thrust never pushes past the cap, but speed already above it (e.g. turbo
 * just released) bleeds off smoothly instead of being chopped in one tick.
 */
function capSpeed(
  skater: SkaterEntity,
  maxSpeed: number,
  dt: number,
  config: SkaterMovementConfig
): void {
  const speed = magnitude(skater.velocity);

  if (speed <= maxSpeed || speed === 0) {
    return;
  }

  const scale = Math.max(maxSpeed / speed, expDecay(config.overSpeedDrag, dt));
  skater.velocity.x *= scale;
  skater.velocity.y *= scale;
}

function integrateAndContain(
  skater: SkaterEntity,
  dt: number,
  config: SkaterMovementConfig
): void {
  skater.position.x += skater.velocity.x * dt;
  skater.position.y += skater.velocity.y * dt;
  containCircleInRink(
    skater.position,
    skater.velocity,
    config.radius,
    config.boardRestitution,
    config.boardTangentRetention
  );
}

function normalizedMovement(input: InputFrame | undefined): Vec2 {
  if (!input) {
    return { x: 0, y: 0 };
  }

  const raw = {
    x: clamp(input.moveX, -1, 1),
    y: clamp(input.moveY, -1, 1)
  };

  if (magnitude(raw) > 1) {
    return normalizeOrZero(raw);
  }

  return raw;
}
