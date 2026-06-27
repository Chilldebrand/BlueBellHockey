import { RINK_CONFIG } from "../config/rink.js";
import type { TeamId } from "../config/teams.js";
import type { GoalieEntity, WorldState } from "./types.js";
import { clamp } from "./physics.js";

export interface GoalieConfig {
  readonly homeX: number;
  readonly awayX: number;
  readonly creaseHalfHeight: number;
  readonly lateralSpeed: number;
  readonly saveRadius: number;
  readonly reboundSpeed: number;
}

export const GOALIE_CONFIG: GoalieConfig = {
  homeX: RINK_CONFIG.goalLineOffset,
  awayX: RINK_CONFIG.width - RINK_CONFIG.goalLineOffset,
  creaseHalfHeight: RINK_CONFIG.goalWidth / 2,
  lateralSpeed: 520,
  saveRadius: 72,
  reboundSpeed: 620
};

export function stepGoalies(
  world: WorldState,
  dtMs: number,
  config: GoalieConfig = GOALIE_CONFIG
): void {
  for (const goalie of world.goalies) {
    trackPuckInCrease(goalie, world.puck.position.y, dtMs, config);
    resolveGoalieSave(world, goalie, config);
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

function resolveGoalieSave(
  world: WorldState,
  goalie: GoalieEntity,
  config: GoalieConfig
): void {
  if (world.puck.carrierSlotId) {
    return;
  }

  const distance = Math.hypot(
    world.puck.position.x - goalie.position.x,
    world.puck.position.y - goalie.position.y
  );

  if (distance > config.saveRadius) {
    return;
  }

  const attackingTeam: TeamId = goalie.teamId === "home" ? "away" : "home";
  const direction = goalie.teamId === "home" ? 1 : -1;
  world.stats[goalie.teamId].saves += 1;
  world.stats.saves[goalie.teamId] += 1;
  world.puck.carrierSlotId = null;
  world.puck.velocity = {
    x: direction * config.reboundSpeed,
    y: (world.puck.position.y - RINK_CONFIG.height / 2) * 2
  };
  world.puck.pickupDisabledForSlotId = null;
  world.puck.pickupDisabledUntilMs = 0;
  world.eventQueue.push({
    id: `save-${world.time.tick}-${goalie.id}`,
    type: "save",
    atMs: world.time.nowMs,
    sourceSlotId: world.puck.shotBySlotId ?? undefined,
    targetSlotId: goalie.id,
    force: Math.abs(world.puck.velocity.x)
  });

  if (world.puck.shotBySlotId) {
    world.stats[attackingTeam].shots += 1;
    world.stats.shots[attackingTeam] += 1;
  }
}
