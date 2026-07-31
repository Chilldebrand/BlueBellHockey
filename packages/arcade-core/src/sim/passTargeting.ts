import { RINK_CONFIG } from "../config/rink.js";
import type { TeamId } from "../config/teams.js";
import {
  clamp,
  clampMagnitude,
  dot,
  normalizeOrZero
} from "./physics.js";
import type { SkaterEntity, Vec2, WorldState } from "./types.js";

export const PASS_AIM_ASSIST_COSINE = 0.42;
/**
 * Ceiling on how far ahead of a receiver a pass may aim, in seconds of their
 * travel.
 *
 * 0.3 -> 0.85 (2026-07-26, "make passes track better"). The old cap was
 * shorter than a real pass takes to arrive: a 800-unit feed at passSpeed 1634
 * is airborne ~0.58s once friction is priced in, so the lead only ever
 * accounted for half the flight and every pass to a moving teammate landed
 * behind them. PASS_LEAD_MAX_DISTANCE is the real safety net — it bounds how
 * far out the aim can be dragged regardless of how fast the receiver is.
 */
export const PASS_LEAD_MAX_SECONDS = 0.85;
/**
 * Hard bound on the lead, whatever the flight time says. 220 -> 320: at 220 a
 * skater near top speed (504) on a long feed still got clamped short, so the
 * pass trailed them even after the flight-time fix. 320 covers a full-speed
 * receiver for ~0.63s, which is longer than any realistic pass, so this is
 * back to being a guard against absurd inputs rather than a routine limiter.
 */
export const PASS_LEAD_MAX_DISTANCE = 320;
const PASS_TARGET_RINK_MARGIN = 60;
/**
 * Puck friction used to estimate flight time. Mirrors PUCK_CONFIG's value;
 * kept as a local constant so this module stays dependency-free (puck.ts is
 * downstream of pass targeting).
 */
const PASS_FRICTION_PER_SECOND = 0.55;

/**
 * Time for a puck launched at `speed` to cover `distance`, accounting for
 * friction. Speed decays multiplicatively (v = v0 * f^t), so distance is
 * v0 * (1 - f^t) / k with k = -ln(f) — inverting that gives the flight time.
 * A straight distance/speed estimate systematically UNDER-shoots, which is
 * the other half of why passes trailed their receiver.
 */
export function passFlightSeconds(
  distance: number,
  speed: number,
  frictionPerSecond = PASS_FRICTION_PER_SECOND
): number {
  const v0 = Math.max(speed, 1);
  if (frictionPerSecond <= 0 || frictionPerSecond >= 1) {
    return distance / v0;
  }

  const k = -Math.log(frictionPerSecond);
  const reach = v0 / k;
  if (distance >= reach) {
    // Friction stops the puck before it gets there; fall back to the cap.
    return PASS_LEAD_MAX_SECONDS;
  }

  return -Math.log(1 - distance / reach) / k;
}

/** A skater who cannot skate cannot receive: never aim a pass at them. */
function canReceivePass(skater: SkaterEntity): boolean {
  return skater.contactState !== "knockedDown" && skater.contactState !== "frozen";
}

export interface PassSource {
  readonly id: string;
  readonly teamId: TeamId;
  readonly position: Vec2;
}

export function passTargetWithAssist(
  world: WorldState,
  source: PassSource,
  aim: Vec2,
  speed: number,
  assistCosine = PASS_AIM_ASSIST_COSINE
): Vec2 | null {
  const recipient = findAimedPassRecipient(world, source, aim, assistCosine);
  return recipient ? predictPassTarget(source.position, recipient, speed) : null;
}

export function findAimedPassRecipient(
  world: WorldState,
  source: PassSource,
  aim: Vec2,
  assistCosine = PASS_AIM_ASSIST_COSINE
): SkaterEntity | null {
  let bestRecipient: SkaterEntity | null = null;
  let bestScore = assistCosine;

  for (const teammate of world.skaters) {
    if (
      teammate.id === source.id ||
      teammate.teamId !== source.teamId ||
      !canReceivePass(teammate)
    ) {
      continue;
    }

    const toTeammate = normalizeOrZero({
      x: teammate.position.x - source.position.x,
      y: teammate.position.y - source.position.y
    });
    const score = dot(aim, toTeammate);

    if (score > bestScore) {
      bestScore = score;
      bestRecipient = teammate;
    }
  }

  return bestRecipient;
}

export function predictPassTarget(
  sourcePosition: Vec2,
  recipient: Pick<SkaterEntity, "position" | "velocity">,
  speed: number
): Vec2 {
  const distance = Math.hypot(
    recipient.position.x - sourcePosition.x,
    recipient.position.y - sourcePosition.y
  );
  const travelSeconds = Math.min(
    PASS_LEAD_MAX_SECONDS,
    passFlightSeconds(distance, speed)
  );
  const lead = clampMagnitude(
    {
      x: recipient.velocity.x * travelSeconds,
      y: recipient.velocity.y * travelSeconds
    },
    PASS_LEAD_MAX_DISTANCE
  );

  return {
    x: clamp(
      recipient.position.x + lead.x,
      PASS_TARGET_RINK_MARGIN,
      RINK_CONFIG.width - PASS_TARGET_RINK_MARGIN
    ),
    y: clamp(
      recipient.position.y + lead.y,
      PASS_TARGET_RINK_MARGIN,
      RINK_CONFIG.height - PASS_TARGET_RINK_MARGIN
    )
  };
}
