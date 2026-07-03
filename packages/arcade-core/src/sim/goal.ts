import { MATCH_CONFIG } from "../config/match.js";
import { RINK_CONFIG } from "../config/rink.js";
import type { TeamId } from "../config/teams.js";
import { GOAL_HEIGHT } from "./puck.js";
import type { WorldState } from "./types.js";

export function resolveGoals(world: WorldState): void {
  if (world.puck.carrierSlotId) {
    return;
  }

  const scoringTeam = scoringTeamForPuck(world);
  if (!scoringTeam) {
    return;
  }

  world.score[scoringTeam] += 1;
  world.stats[scoringTeam].goals += 1;
  world.stats.goals[scoringTeam] += 1;
  if (world.puck.shotBySlotId) {
    world.stats[scoringTeam].shots += 1;
    world.stats.shots[scoringTeam] += 1;
  }
  world.eventQueue.push({
    id: `goal-${world.time.tick}-${scoringTeam}`,
    type: "goal",
    atMs: world.time.nowMs,
    sourceSlotId: world.puck.shotBySlotId ?? world.puck.lastTouchSlotId ?? undefined
  });

  resetForFaceoff(world);

  if (world.score[scoringTeam] >= MATCH_CONFIG.targetScore) {
    world.phase = "ended";
    world.winnerTeamId = scoringTeam;
  }
}

export function resetForFaceoff(world: WorldState): void {
  world.puck.position = {
    x: RINK_CONFIG.width / 2,
    y: RINK_CONFIG.height / 2
  };
  world.puck.velocity = { x: 0, y: 0 };
  world.puck.height = 0;
  world.puck.verticalVelocity = 0;
  world.puck.carrierSlotId = null;
  world.puck.shotBySlotId = null;
  world.puck.shotPower = 0;
  world.puck.isChargedShot = false;
  world.puck.pickupDisabledForSlotId = null;
  world.puck.pickupDisabledUntilMs = 0;
}

function scoringTeamForPuck(world: WorldState): TeamId | null {
  const inGoalMouth =
    Math.abs(world.puck.position.y - RINK_CONFIG.height / 2) <=
    RINK_CONFIG.goalWidth / 2;

  if (!inGoalMouth) {
    return null;
  }

  // Over the bar is not a goal (the puck step already clangs those out, but
  // the scoring rule must not depend on it).
  if (world.puck.height >= GOAL_HEIGHT) {
    return null;
  }

  if (world.puck.position.x >= RINK_CONFIG.width) {
    return "home";
  }

  if (world.puck.position.x <= 0) {
    return "away";
  }

  return null;
}
