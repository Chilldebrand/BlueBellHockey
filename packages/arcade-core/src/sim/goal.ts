import { MATCH_CONFIG } from "../config/match.js";
import { RINK_CONFIG } from "../config/rink.js";
import type { TeamId } from "../config/teams.js";
import { puckInsideGoal } from "./net.js";
import { goalieSpawn, skaterSpawn, spawnFacing } from "./spawns.js";
import { playerStatLine } from "./stats.js";
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
  const scorerId = world.puck.shotBySlotId ?? world.puck.lastTouchSlotId;
  const scorerStats = scorerId ? playerStatLine(world.stats, scorerId) : null;
  if (scorerStats) {
    scorerStats.goals += 1;
  }
  if (world.puck.shotBySlotId) {
    world.stats[scoringTeam].shots += 1;
    world.stats.shots[scoringTeam] += 1;
  }
  world.eventQueue.push({
    id: `goal-${world.time.tick}-${scoringTeam}`,
    type: "goal",
    atMs: world.time.nowMs,
    sourceSlotId: scorerId ?? undefined
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
  world.puck.passedFromSlotId = null;
  world.puck.passedAtMs = 0;
  world.puck.pickupDisabledForSlotId = null;
  world.puck.pickupDisabledUntilMs = 0;

  // Reset the players too, not just the puck — otherwise a scorer is left
  // stranded by the net while the camera snaps to the center-ice faceoff,
  // leaving the player unable to find their character.
  for (const skater of world.skaters) {
    const teamSide = skater.teamId === "home" ? -1 : 1;
    skater.position = skaterSpawn(skater.slot.index, teamSide);
    skater.velocity = { x: 0, y: 0 };
    skater.facing = spawnFacing(teamSide);
  }
  for (const goalie of world.goalies) {
    const teamSide = goalie.teamId === "home" ? -1 : 1;
    goalie.position = goalieSpawn(teamSide);
    goalie.velocity = { x: 0, y: 0 };
  }
}

function scoringTeamForPuck(world: WorldState): TeamId | null {
  // Goals are physical cages off the end walls now: a goal is the puck
  // sitting inside a cage's scoring volume (crossed the goal line through
  // the mouth, under the bar, between the posts).
  return puckInsideGoal(world);
}
