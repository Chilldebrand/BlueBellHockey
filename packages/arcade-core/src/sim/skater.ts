import type { InputFrame, SkaterEntity, Vec2 } from "./types.js";
import { containCircleInRink } from "./boards.js";
import { characterStatMultiplier, SPEED_STAT_SPREAD } from "./statScaling.js";
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
  /**
   * Extra turn rate at a dead stop, easing back to 1x by
   * `lowSpeedTurnBoostSpeed`. This is the pivot-on-the-spot multiplier.
   *
   * Why it exists: thrust is gated on `alignment > 0`, so a skater changing
   * direction gets NO acceleration at all until facing is within 90 deg of
   * the stick, and only partial thrust after that. From a standstill that is
   * a real dead beat before you move — which is what "turning is so slow when
   * you start skating" was. Boosting only the low-speed end fixes the standing
   * pivot without touching the broad fast arcs that make skating feel grounded.
   */
  readonly lowSpeedTurnBoost: number;
  /** Speed at which the standstill turn boost has fully faded to 1x. */
  readonly lowSpeedTurnBoostSpeed: number;
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
  /** Speed cap multiplier while stumbling (hit recovery / check whiff). */
  readonly stumbleSpeedMultiplier: number;
  /** Top-speed multiplier while backskating — you give up pace to face the play. */
  readonly backwardSpeedMultiplier: number;
  /** Acceleration multiplier while backskating (C-cuts, not crossovers). */
  readonly backwardAccelerationMultiplier: number;
  /**
   * Turn-rate multiplier while backskating. Pivoting the body on your heels is
   * slower than carving forward, so reversing which way you are retreating
   * costs a beat — that beat is what an attacker cuts around.
   */
  readonly backwardTurnRateMultiplier: number;
  /**
   * Lateral-grip multiplier while backskating, so a transition carries its
   * speed through the pivot instead of the edges scrubbing it off when the
   * body is briefly side-on to travel.
   */
  readonly backwardTransitionGripMultiplier: number;
}

// Sustained multiplier applied to top speed + acceleration while the
// speed-boost powerup is active (on top of, and stacking with, turbo).
export const SPEED_BOOST_MULTIPLIER = 1.25;

// Feel pass 2026-07-03: normal skating slowed so turbo reads as a real burst
// (cruise/turbo keep a full 50% jump). Playtest 2026-07-21: top pace cut 10%
// (560 → 504, turbo 840 → 756); the speed STAT now scales this per character
// (±3%, see statScaling.ts) so the roster genuinely varies.
export const SKATER_MOVEMENT_CONFIG: SkaterMovementConfig = {
  acceleration: 1450,
  maxSpeed: 504,
  radius: 38,
  glideDrag: 0.55,
  releaseDrag: 1.15,
  // Playtest 2026-07-22: direction changes carve harder (grip 7.5→9), stops
  // on a reversal bite faster (brake 5.5→7), and turning keeps more of its
  // rate at speed (retention 0.5→0.62, base rate 10.5→11.5). Forward/back
  // accel and caps untouched — those already felt right.
  lateralGrip: 9,
  brakeDrag: 7,
  turnRate: 11.5,
  highSpeedTurnRetention: 0.62,
  // 2.1x at a dead stop: a 180 turn drops from ~0.27s to ~0.13s, so pushing a
  // new direction from a standstill bites almost immediately. Gone by 240,
  // which is under half of maxSpeed 504 — real skating arcs are untouched.
  lowSpeedTurnBoost: 2.1,
  lowSpeedTurnBoostSpeed: 240,
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
  windupSpeedMultiplier: 0.62,
  stumbleSpeedMultiplier: 0.55,
  // 0.72 -> 0.9 (user, 2026-07-26): "hockey players do this all the time" —
  // a defenceman turning to retreat keeps nearly all their pace. Paired with
  // not braking through the pivot (see stepSkater), so switching to backwards
  // at speed now carries the speed instead of scrubbing it.
  backwardSpeedMultiplier: 0.9,
  backwardAccelerationMultiplier: 0.7,
  backwardTurnRateMultiplier: 0.8,
  // Measured dip in entry speed through the pivot: 0.22 -> 59%, 0.14 -> 68%,
  // 0.08 -> 75%, 0.05 -> ~80%, 0.0 -> 86% (the rest is glide drag and the 0.9
  // speed cap). 0.05 keeps a little edge bite while retreating.
  backwardTransitionGripMultiplier: 0.05
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
  config: SkaterMovementConfig = SKATER_MOVEMENT_CONFIG,
  speedBoosted = false
): void {
  const dt = dtMs / 1000;

  // Frozen: a hard lock (freeze powerup). No input, no slide — the ice block
  // sits exactly where it was caught until recoverContactStates thaws it.
  if (skater.contactState === "frozen") {
    skater.velocity.x = 0;
    skater.velocity.y = 0;
    return;
  }

  if (skater.contactState === "knockedDown" || skater.contactState === "diving") {
    const slide = expDecay(config.knockdownDrag, dt);
    skater.velocity.x *= slide;
    skater.velocity.y *= slide;
    integrateAndContain(skater, dt, config);
    return;
  }

  const boost =
    (speedBoosted ? SPEED_BOOST_MULTIPLIER : 1) *
    characterStatMultiplier(skater.characterId, "speed", SPEED_STAT_SPREAD);

  const move = normalizedMovement(input);
  const hasInput = magnitude(move) > 0;
  // Backskate: travel the way the stick pushes while the body stays turned
  // the other way. Nobody hustles backwards, so turbo is simply off while it
  // is held (and the meter refills, as it does any time turbo is inactive).
  const backward = input?.skateBackward === true;
  const turboActive =
    !backward &&
    input?.turbo === true &&
    skater.turboMeter >= config.turboMinActivation;

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
    boost *
    (turboActive ? config.turboMaxSpeedMultiplier : 1) *
    (backward ? config.backwardSpeedMultiplier : 1) *
    (skater.gesture.phase === "windup" ? config.windupSpeedMultiplier : 1) *
    (skater.contactState === "stumbling" ? config.stumbleSpeedMultiplier : 1);
  const speed = magnitude(skater.velocity);
  let braking = false;

  if (hasInput) {
    // The body aims OPPOSITE the push while backskating, and thrust then runs
    // out through the skater's back — so everything below (turn, alignment,
    // braking) is the same contest, just measured against the reversed body
    // angle. Facing is what the stick, checks, and shots all key off, which is
    // exactly why retreating this way keeps your stick pointed at the play.
    const desired = backward ? angleOf(move) + Math.PI : angleOf(move);
    const speedFactor = maxSpeed > 0 ? clamp(speed / maxSpeed, 0, 1) : 1;
    // Standing pivots get a boost that fades out as you pick up speed, so the
    // dead beat before thrust engages is short at a standstill and the broad
    // arcs at pace are exactly as before.
    const standstill =
      config.lowSpeedTurnBoostSpeed > 0
        ? clamp(1 - speed / config.lowSpeedTurnBoostSpeed, 0, 1)
        : 0;
    const turnRate =
      config.turnRate *
      (1 - speedFactor * (1 - config.highSpeedTurnRetention)) *
      (1 + (config.lowSpeedTurnBoost - 1) * standstill) *
      (turboActive ? config.turboTurnRateMultiplier : 1) *
      (backward ? config.backwardTurnRateMultiplier : 1);

    skater.facing = turnToward(skater.facing, desired, turnRate * dt);

    const alignment = Math.cos(angleDifference(skater.facing, desired));

    if (alignment > 0) {
      const thrust =
        config.acceleration *
        boost *
        (turboActive ? config.turboAccelerationMultiplier : 1) *
        (backward ? config.backwardAccelerationMultiplier : 1) *
        alignment;
      const push = backward ? -1 : 1;
      skater.velocity.x += Math.cos(skater.facing) * push * thrust * dt;
      skater.velocity.y += Math.sin(skater.facing) * push * thrust * dt;
    } else if (alignment < -0.35 && !backward) {
      // Stick pulled against the body: dig in and stop hard.
      //
      // NOT while backskating. Engaging it at speed asks the body to spin 180
      // to face the other way, which is maximum misalignment BY DESIGN — and
      // reading that as "dig in and stop" slammed the brakes on for the whole
      // pivot, which is why switching to backwards scrubbed nearly all your
      // pace. A player turning to skate backwards carries their speed through
      // the transition; release the button to brake.
      braking = true;
    }
  }

  applyAnisotropicDrag(skater, dt, config, {
    hasInput,
    braking,
    turboActive,
    backward
  });
  capSpeed(skater, maxSpeed, dt, config);
  integrateAndContain(skater, dt, config);
}

function applyAnisotropicDrag(
  skater: SkaterEntity,
  dt: number,
  config: SkaterMovementConfig,
  state: {
    hasInput: boolean;
    braking: boolean;
    turboActive: boolean;
    backward: boolean;
  }
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

  // Grip is measured against the BODY axis, so mid-way through a backskate
  // pivot the velocity is momentarily perpendicular to the body and the edge
  // bite scrubs nearly all of it off — measured as a dip to 21% of entry speed
  // before recovering. A real transition is a mohawk: the blades stay pointed
  // along travel while the upper body turns, so almost nothing is scrubbed.
  // Softening grip only while backskating models that. It self-limits: once
  // the pivot settles the velocity lies on the body axis and there is no
  // lateral component left for this to act on.
  const grip =
    config.lateralGrip *
    (state.turboActive ? config.turboGripMultiplier : 1) *
    (state.backward ? config.backwardTransitionGripMultiplier : 1);
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
