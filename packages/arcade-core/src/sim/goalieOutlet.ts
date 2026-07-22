import { TUNING } from "../config/tuning.js";
import { containCircleInRink } from "./boards.js";
import { goalieHoldPosition, resetGoalieOutletState } from "./goalie.js";
import { passTargetWithAssist } from "./passTargeting.js";
import { magnitude, normalizeOrZero } from "./physics.js";
import type { GoalieEntity, InputFrame, SkaterEntity, Vec2, WorldState } from "./types.js";

/** Maximum deterministic goalie hold before a safe outlet is forced. */
export const GOALIE_OUTLET_TIMEOUT_MS = 2500;

/**
 * Outlet passes travel at this fraction of the skater pass formula (playtest
 * 2026-07-22: full-speed goalie rockets were uncatchable and overpowered).
 * Scales the whole range so holding to charge still matters: quick release
 * ~980, full charge ~1394 — exactly 60% of a player's charged max.
 */
export const GOALIE_OUTLET_PASS_FACTOR = 0.6;

// Matches the pass-aim deadzone used by skater passing in actions.ts.
const OUTLET_AIM_DEADZONE = 0.3;

/**
 * Steps the single goalie currently holding a covered puck. Movement input only
 * changes the remembered outlet aim; the goalie body and all other actions are
 * intentionally ignored. Returns true only on an outlet release.
 */
export function stepGoalieOutlet(
  world: WorldState,
  goalie: GoalieEntity,
  input: InputFrame | undefined,
  dtMs: number
): boolean {
  if (world.puck.goalieCarrierId !== goalie.id) {
    resetGoalieOutletState(goalie);
    return false;
  }

  if (world.time.nowMs - goalie.possessionStartedAtMs >= GOALIE_OUTLET_TIMEOUT_MS) {
    releaseGoalieOutlet(world, goalie, fallbackDirection(world, goalie));
    return true;
  }

  const inputAim = { x: input?.moveX ?? 0, y: input?.moveY ?? 0 };
  if (magnitude(inputAim) > OUTLET_AIM_DEADZONE) {
    goalie.outletAim = normalizeOrZero(inputAim);
  }

  if (input?.pass === true) {
    goalie.passChargeMs = Math.min(
      goalie.passChargeMs + Math.max(0, dtMs),
      TUNING.puck.passChargeMaxMs
    );
    goalie.passWasHeld = true;
    return false;
  }

  if (!goalie.passWasHeld) {
    return false;
  }

  releaseGoalieOutlet(world, goalie, goalie.outletAim);
  return true;
}

/**
 * Selects a safe deterministic fallback receiver: first an unblocked teammate
 * ahead of the goalie, otherwise the nearest eligible teammate anywhere.
 */
export function selectGoalieOutletTarget(
  world: WorldState,
  goalie: GoalieEntity
): SkaterEntity | null {
  const eligible = world.skaters.filter(
    (skater) => skater.teamId === goalie.teamId && skater.contactState === "ready"
  );
  const upIce = goalie.teamId === "home" ? 1 : -1;
  const openUpIce = eligible.filter(
    (skater) =>
      (skater.position.x - goalie.position.x) * upIce > 0 &&
      !isOutletLaneBlocked(world, goalie, skater)
  );

  return nearestByDistance(openUpIce, goalie) ?? nearestByDistance(eligible, goalie);
}

function releaseGoalieOutlet(world: WorldState, goalie: GoalieEntity, direction: Vec2): void {
  const charge = Math.min(
    goalie.passChargeMs / TUNING.puck.passChargeMaxMs,
    1
  );
  const releasePosition = goalieHoldPosition(goalie);
  const speed =
    (TUNING.puck.passSpeed + TUNING.puck.passChargeSpeedBonus * charge) *
    GOALIE_OUTLET_PASS_FACTOR;
  const target = passTargetWithAssist(
    world,
    { id: goalie.id, teamId: goalie.teamId, position: releasePosition },
    direction,
    speed
  );
  const normalized = target
    ? normalizeOrZero({
        x: target.x - releasePosition.x,
        y: target.y - releasePosition.y
      })
    : fallbackDirection(world, goalie);

  world.puck.goalieCarrierId = null;
  world.puck.carrierSlotId = null;
  world.puck.lastTouchSlotId = goalie.id;
  world.puck.assistCandidateSlotId = null;
  world.puck.shotBySlotId = null;
  world.puck.shotPower = 0;
  world.puck.isChargedShot = false;
  // The outlet IS a pass: marking the goalie as passer gives teammates the
  // wide reception-assist gates (otherwise the strict loose-puck speed gate
  // made outlets bounce off every blade until drag slowed them).
  world.puck.passedFromSlotId = goalie.id;
  world.puck.passedAtMs = world.time.nowMs;
  world.puck.pickupDisabledForSlotId = goalie.id;
  world.puck.pickupDisabledUntilMs =
    world.time.nowMs + TUNING.puck.releasePickupCooldownMs;
  world.puck.position = { ...releasePosition };
  world.puck.velocity = {
    x: normalized.x * speed,
    y: normalized.y * speed
  };
  containCircleInRink(world.puck.position, world.puck.velocity, TUNING.puck.radius, 0);
  world.puck.height = 0;
  world.puck.verticalVelocity = 0;

  resetGoalieOutletState(goalie);
}

function fallbackDirection(world: WorldState, goalie: GoalieEntity): Vec2 {
  const target = selectGoalieOutletTarget(world, goalie);
  if (target) {
    const releasePosition = goalieHoldPosition(goalie);
    return normalizeOrZero({
      x: target.position.x - releasePosition.x,
      y: target.position.y - releasePosition.y
    });
  }

  return { x: goalie.teamId === "home" ? 1 : -1, y: 0 };
}

function isOutletLaneBlocked(
  world: WorldState,
  goalie: GoalieEntity,
  teammate: SkaterEntity
): boolean {
  const start = goalieHoldPosition(goalie);

  return world.skaters.some(
    (opponent) =>
      opponent.teamId !== goalie.teamId &&
      distanceToSegment(opponent.position, start, teammate.position) <
        TUNING.ai.openLaneBlockRadius
  );
}

function nearestByDistance(
  candidates: readonly SkaterEntity[],
  goalie: GoalieEntity
): SkaterEntity | null {
  let nearest: SkaterEntity | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distanceSquared =
      (candidate.position.x - goalie.position.x) ** 2 +
      (candidate.position.y - goalie.position.y) ** 2;

    if (
      distanceSquared < nearestDistanceSquared ||
      (distanceSquared === nearestDistanceSquared &&
        (nearest === null || candidate.id < nearest.id))
    ) {
      nearest = candidate;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearest;
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
        segmentLengthSquared
    )
  );
  return Math.hypot(
    point.x - (start.x + segmentX * projection),
    point.y - (start.y + segmentY * projection)
  );
}
