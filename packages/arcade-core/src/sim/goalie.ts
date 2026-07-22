import { RINK_CONFIG, goalLineX } from "../config/rink.js";
import type { TeamId } from "../config/teams.js";
import type { GoalieEntity, Vec2, WorldState } from "./types.js";
import { clamp } from "./physics.js";
import { GOAL_HEIGHT } from "./puck.js";

// Goalie-resize powerups. Giant grows the user's OWN goalie into a near-wall;
// Mini shrinks the OPPOSING goalie so the user scores easier. The multiplier
// scales the save reach (the dominant save lever) AND the rendered model, so
// the visual always matches the hitbox. Shared by the client via
// goalieSizeMultiplier so there's one source of truth.
export const GIANT_GOALIE_SIZE = 2.2;
export // Playtest 2026-07-21: 0.45 read as unfairly tiny — nudged up.
const MINI_GOALIE_SIZE = 0.55;

/**
 * Effective size multiplier for a goalie right now, from active goalie-resize
 * powerups. Giant is owned by a skater on the goalie's OWN team; Mini by a
 * skater on the ATTACKING team. Pure + deterministic (reads world state only).
 */
export function goalieSizeMultiplier(
  world: WorldState,
  goalieTeamId: TeamId
): number {
  let multiplier = 1;
  for (const powerup of world.activePowerups) {
    if (!powerup.slotId) {
      continue;
    }
    const owner = world.skaters.find((skater) => skater.id === powerup.slotId);
    if (!owner) {
      continue;
    }
    if (powerup.type === "giant-goalie" && owner.teamId === goalieTeamId) {
      multiplier *= GIANT_GOALIE_SIZE;
    } else if (powerup.type === "mini-goalie" && owner.teamId !== goalieTeamId) {
      multiplier *= MINI_GOALIE_SIZE;
    }
  }
  return multiplier;
}

export interface GoalieConfig {
  readonly homeX: number;
  readonly awayX: number;
  readonly creaseHalfHeight: number;
  readonly lateralSpeed: number;
  /** Blade/pad reach around the goalie's body for the save test. */
  readonly saveReach: number;
  /** Only pucks within this of the goal line concern the goalie. */
  readonly saveZoneDepth: number;
  /** A shot slower than this AND centered gets covered (whistle, faceoff). */
  readonly coverMaxSpeed: number;
  /** Puck must be within this of the goalie's body line to be covered. */
  readonly coverMaxOffset: number;
  /** Rebounds keep this fraction of the shot's pace... */
  readonly reboundSpeedFactor: number;
  /** ...but never leave slower than this (live scramble, not a dead puck). */
  readonly reboundMinSpeed: number;
  /**
   * Human-like reaction lag (ms). The goalie slides toward where the puck *was*
   * this long ago, so a fast shot or cross-crease pass leaves him a beat behind
   * and opens the far side; slow stickhandling barely lags. 0 = the old
   * frame-perfect wall.
   */
  readonly reactionDelayMs: number;
}

export const GOALIE_CONFIG: GoalieConfig = {
  // Goalies stand just in front of their (now interior) goal line.
  homeX: goalLineX("home") + RINK_CONFIG.goalieDepth,
  awayX: goalLineX("away") - RINK_CONFIG.goalieDepth,
  creaseHalfHeight: RINK_CONFIG.goalWidth / 2,
  // Tuning 2026-07-07: goalies ~20% better — quicker across, longer reach,
  // faster reactions (shots are also 20% hotter now, so saves keep pace).
  lateralSpeed: 624,
  saveReach: 84,
  saveZoneDepth: 340,
  coverMaxSpeed: 520,
  coverMaxOffset: 46,
  reboundSpeedFactor: 0.45,
  reboundMinSpeed: 320,
  reactionDelayMs: 120
};

export type GoalieSaveType = "pad" | "body" | "glove" | "blocker" | "cover";

const GOALIE_HOLD_UP_ICE_OFFSET = 28;

export function goalieHoldPosition(goalie: GoalieEntity): Vec2 {
  const upIce = goalie.teamId === "home" ? 1 : -1;
  return {
    x: goalie.position.x + upIce * GOALIE_HOLD_UP_ICE_OFFSET,
    y: goalie.position.y
  };
}

/** Clears transient outlet state, keeping an idle goalie pointed safely up ice. */
export function resetGoalieOutletState(
  goalie: GoalieEntity,
  possessionStartedAtMs = 0
): void {
  goalie.passChargeMs = 0;
  goalie.outletAim = { x: goalie.teamId === "home" ? 1 : -1, y: 0 };
  goalie.possessionStartedAtMs = possessionStartedAtMs;
  goalie.passWasHeld = false;
}

export function stepGoalies(
  world: WorldState,
  dtMs: number,
  config: GoalieConfig = GOALIE_CONFIG
): void {
  for (const goalie of world.goalies) {
    trackPuckInCrease(
      goalie,
      world.puck.position.y,
      world.puck.velocity.y,
      dtMs,
      config
    );
    if (world.puck.goalieCarrierId === goalie.id) {
      holdPuckByGoalie(world, goalie);
      continue;
    }
    resetGoalieOutletState(goalie);
    resolveGoalieSave(world, goalie, dtMs, config);
  }
}

function trackPuckInCrease(
  goalie: GoalieEntity,
  puckY: number,
  puckVelY: number,
  dtMs: number,
  config: GoalieConfig
): void {
  // React with human latency: aim where the puck was reactionDelayMs ago,
  // estimated from its current lateral velocity. A hot shot or cross-crease
  // pass leaves him a beat behind (far side opens); slow puck movement barely
  // lags, so he keeps his angle.
  const laggedY = puckY - puckVelY * (config.reactionDelayMs / 1000);
  const targetY = clamp(
    laggedY,
    RINK_CONFIG.height / 2 - config.creaseHalfHeight,
    RINK_CONFIG.height / 2 + config.creaseHalfHeight
  );
  const maxMove = config.lateralSpeed * (dtMs / 1000);
  const delta = clamp(targetY - goalie.position.y, -maxMove, maxMove);

  goalie.position = {
    x: goalie.teamId === "home" ? config.homeX : config.awayX,
    y: goalie.position.y + delta
  };
  goalie.velocity = {
    x: 0,
    y: delta / (dtMs / 1000 || 1)
  };
}

/**
 * Goalie stop, ported from the original prototype's battle-tested logic:
 * a loose puck bearing in on the net that crosses the goalie's reach this
 * tick (swept segment test — fast shots can't tunnel) is stopped. A slow,
 * centered shot is covered (whistle, center faceoff); anything hot kicks
 * out a directional rebound to crash. Pucks above the bar are the
 * crossbar's problem, not the goalie's.
 */
function resolveGoalieSave(
  world: WorldState,
  goalie: GoalieEntity,
  dtMs: number,
  config: GoalieConfig
): void {
  const puck = world.puck;

  if (puck.carrierSlotId || puck.goalieCarrierId || puck.height >= GOAL_HEIGHT) {
    return;
  }

  const defendedLine = goalLineX(goalie.teamId);

  if (Math.abs(puck.position.x - defendedLine) > config.saveZoneDepth) {
    return;
  }

  // Giant/Mini goalie powerups scale the reach (and the model, client-side).
  const saveReach = config.saveReach * goalieSizeMultiplier(world, goalie.teamId);

  const headingIn =
    goalie.teamId === "home" ? puck.velocity.x < 0 : puck.velocity.x > 0;

  if (!headingIn) {
    return;
  }

  // Swept test: closest approach of the puck's path this tick to the goalie.
  const dt = dtMs / 1000;
  const prev = {
    x: puck.position.x - puck.velocity.x * dt,
    y: puck.position.y - puck.velocity.y * dt
  };
  const sweepX = puck.position.x - prev.x;
  const sweepY = puck.position.y - prev.y;
  const sweepLengthSq = sweepX * sweepX + sweepY * sweepY;
  const t =
    sweepLengthSq > 1e-9
      ? clamp(
          ((goalie.position.x - prev.x) * sweepX +
            (goalie.position.y - prev.y) * sweepY) /
            sweepLengthSq,
          0,
          1
        )
      : 1;
  const closestX = prev.x + sweepX * t;
  const closestY = prev.y + sweepY * t;
  const closestDistance = Math.hypot(
    closestX - goalie.position.x,
    closestY - goalie.position.y
  );
  const restingDistance = Math.hypot(
    puck.position.x - goalie.position.x,
    puck.position.y - goalie.position.y
  );

  if (closestDistance > saveReach && restingDistance > saveReach) {
    return;
  }

  // A goalie still stops his own team's errant pass drifting into the net
  // (before this, friendly pucks sailed straight through for own goals) —
  // but smothering your own dump-in is NOT a save: no stat, no announcer
  // event, no shot credited.
  const shooter = puck.lastTouchSlotId;
  const shooterTeam = shooter
    ? world.skaters.find((skater) => skater.id === shooter)?.teamId
    : undefined;
  const friendlyPuck = shooterTeam === goalie.teamId;

  const speed = Math.hypot(puck.velocity.x, puck.velocity.y);
  const lateral = puck.position.y - goalie.position.y;
  const saveType = goalieSaveType(puck.height, lateral, speed, config);
  const attackingTeam: TeamId = goalie.teamId === "home" ? "away" : "home";

  if (!friendlyPuck) {
    world.stats[goalie.teamId].saves += 1;
    world.stats.saves[goalie.teamId] += 1;

    if (puck.shotBySlotId) {
      world.stats[attackingTeam].shots += 1;
      world.stats.shots[attackingTeam] += 1;
    }

    world.eventQueue.push({
      id: `save-${world.time.tick}-${goalie.id}`,
      type: "save",
      atMs: world.time.nowMs,
      sourceSlotId: puck.shotBySlotId ?? shooter ?? undefined,
      targetSlotId: goalie.id,
      force: speed,
      detail: saveType
    });
  }
  puck.assistCandidateSlotId = null;

  if (saveType === "cover") {
    world.eventQueue.push({
      id: `cover-${world.time.tick}-${goalie.id}`,
      type: "cover",
      atMs: world.time.nowMs,
      targetSlotId: goalie.id
    });
    puck.carrierSlotId = null;
    puck.goalieCarrierId = goalie.id;
    puck.position = goalieHoldPosition(goalie);
    puck.velocity = { x: 0, y: 0 };
    puck.height = 0;
    puck.verticalVelocity = 0;
    puck.lastTouchSlotId = goalie.id;
    puck.assistCandidateSlotId = null;
    puck.shotBySlotId = null;
    puck.shotPower = 0;
    puck.isChargedShot = false;
    puck.passedFromSlotId = null;
    puck.passedAtMs = 0;
    puck.pickupDisabledForSlotId = null;
    puck.pickupDisabledUntilMs = 0;
    resetGoalieOutletState(goalie, world.time.nowMs);
    return;
  }

  // Rebound: kicked back up-ice, off to the side it came in on.
  const upIce = goalie.teamId === "home" ? 1 : -1;
  const lateralSign = Math.abs(lateral) < 0.5 ? Math.sign(puck.velocity.y) || 1 : Math.sign(lateral);
  const length = Math.hypot(1, 0.8);
  const out = Math.max(config.reboundMinSpeed, speed * config.reboundSpeedFactor);

  puck.velocity = {
    x: (upIce / length) * out,
    y: ((lateralSign * 0.8) / length) * out
  };
  puck.position = {
    x: goalie.position.x + upIce * (saveReach * 0.6),
    y: goalie.position.y + lateralSign * 12
  };
  puck.verticalVelocity = Math.max(120, Math.abs(puck.verticalVelocity) * 0.35);
  puck.goalieCarrierId = null;
  puck.shotBySlotId = null;
  puck.lastTouchSlotId = goalie.id;
  puck.pickupDisabledForSlotId = null;
  puck.pickupDisabledUntilMs = world.time.nowMs + 100;
}

function holdPuckByGoalie(world: WorldState, goalie: GoalieEntity): void {
  const puck = world.puck;
  puck.carrierSlotId = null;
  puck.position = goalieHoldPosition(goalie);
  puck.velocity = { x: 0, y: 0 };
  puck.height = 0;
  puck.verticalVelocity = 0;
}

function goalieSaveType(
  height: number,
  lateral: number,
  speed: number,
  config: GoalieConfig
): GoalieSaveType {
  if (speed < config.coverMaxSpeed && Math.abs(lateral) < config.coverMaxOffset) {
    return "cover";
  }

  if (height < 30) {
    return "pad";
  }

  if (height < 60) {
    return "body";
  }

  return lateral < 0 ? "blocker" : "glove";
}
