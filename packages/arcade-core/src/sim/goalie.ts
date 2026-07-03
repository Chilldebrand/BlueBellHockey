import { RINK_CONFIG } from "../config/rink.js";
import type { TeamId } from "../config/teams.js";
import type { GoalieEntity, WorldState } from "./types.js";
import { clamp } from "./physics.js";
import { GOAL_HEIGHT } from "./puck.js";
import { resetForFaceoff } from "./goal.js";

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
}

export const GOALIE_CONFIG: GoalieConfig = {
  homeX: RINK_CONFIG.goalLineOffset,
  awayX: RINK_CONFIG.width - RINK_CONFIG.goalLineOffset,
  creaseHalfHeight: RINK_CONFIG.goalWidth / 2,
  lateralSpeed: 560,
  saveReach: 74,
  saveZoneDepth: 340,
  coverMaxSpeed: 520,
  coverMaxOffset: 46,
  reboundSpeedFactor: 0.45,
  reboundMinSpeed: 320
};

export type GoalieSaveType = "pad" | "body" | "glove" | "blocker" | "cover";

export function stepGoalies(
  world: WorldState,
  dtMs: number,
  config: GoalieConfig = GOALIE_CONFIG
): void {
  for (const goalie of world.goalies) {
    trackPuckInCrease(goalie, world.puck.position.y, dtMs, config);
    resolveGoalieSave(world, goalie, dtMs, config);
  }
}

function trackPuckInCrease(
  goalie: GoalieEntity,
  puckY: number,
  dtMs: number,
  config: GoalieConfig
): void {
  const targetY = clamp(
    puckY,
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

  if (puck.carrierSlotId || puck.height >= GOAL_HEIGHT) {
    return;
  }

  const defendedLine = goalie.teamId === "home" ? 0 : RINK_CONFIG.width;

  if (Math.abs(puck.position.x - defendedLine) > config.saveZoneDepth) {
    return;
  }

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

  if (
    closestDistance > config.saveReach &&
    restingDistance > config.saveReach
  ) {
    return;
  }

  // A goalie smothering his own team's dump-in isn't a save.
  const shooter = puck.lastTouchSlotId;
  const shooterTeam = shooter
    ? world.skaters.find((skater) => skater.id === shooter)?.teamId
    : undefined;

  if (shooterTeam === goalie.teamId) {
    return;
  }

  const speed = Math.hypot(puck.velocity.x, puck.velocity.y);
  const lateral = puck.position.y - goalie.position.y;
  const saveType = goalieSaveType(puck.height, lateral, speed, config);
  const attackingTeam: TeamId = goalie.teamId === "home" ? "away" : "home";

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

  if (saveType === "cover") {
    // Frozen under the goalie: whistle, center-ice faceoff.
    world.eventQueue.push({
      id: `cover-${world.time.tick}-${goalie.id}`,
      type: "cover",
      atMs: world.time.nowMs,
      targetSlotId: goalie.id
    });
    resetForFaceoff(world);
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
    x: goalie.position.x + upIce * (config.saveReach * 0.6),
    y: goalie.position.y + lateralSign * 12
  };
  puck.verticalVelocity = Math.max(120, Math.abs(puck.verticalVelocity) * 0.35);
  puck.shotBySlotId = null;
  puck.lastTouchSlotId = goalie.id;
  puck.pickupDisabledForSlotId = null;
  puck.pickupDisabledUntilMs = world.time.nowMs + 100;
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
