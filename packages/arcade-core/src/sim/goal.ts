import { RINK_CONFIG } from "../config/rink.js";
import type { TeamId } from "../config/teams.js";
import { puckInsideGoal } from "./net.js";
import { goalieSpawn, skaterSpawn, spawnFacing } from "./spawns.js";
import { playerStatLine } from "./stats.js";
import type { WorldState } from "./types.js";

/** Countdown held before the opening faceoff of a match. */
export const MATCH_START_COUNTDOWN_MS = 5000;
/** Countdown held at center ice after each goal before play resumes. */
export const GOAL_FACEOFF_COUNTDOWN_MS = 3000;

/** Flip a waiting world into play behind the pre-match countdown. */
export function beginPlay(
  world: WorldState,
  countdownMs = MATCH_START_COUNTDOWN_MS
): void {
  world.phase = "playing";
  startFaceoffCountdown(world, countdownMs);
}

/**
 * Hold play at the faceoff for durationMs of sim time. Time keeps flowing
 * during the hold (so the countdown can expire deterministically on every
 * peer), so duration windows that must survive into live play are shifted.
 */
export function startFaceoffCountdown(
  world: WorldState,
  durationMs: number
): void {
  world.faceoffUntilMs = world.time.nowMs + durationMs;
  for (const powerup of world.activePowerups) {
    powerup.expiresAtMs += durationMs;
  }
  world.bananaPeels = world.bananaPeels.map((peel) => ({
    ...peel,
    spawnedAtMs: peel.spawnedAtMs + durationMs
  }));
}

export function resolveGoals(world: WorldState): void {
  if (world.puck.carrierSlotId || world.puck.goalieCarrierId) {
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
  const scorer = scorerId
    ? world.skaters.find((skater) => skater.id === scorerId)
    : undefined;
  const assistCandidate = world.puck.assistCandidateSlotId
    ? world.skaters.find(
        (skater) => skater.id === world.puck.assistCandidateSlotId
      )
    : undefined;
  if (
    scorer &&
    assistCandidate &&
    scorer.id !== assistCandidate.id &&
    scorer.teamId === scoringTeam &&
    assistCandidate.teamId === scoringTeam
  ) {
    playerStatLine(world.stats, assistCandidate.id)!.assists += 1;
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

  if (
    world.isOvertime ||
    (world.rules.goalLimit > 0 &&
      world.score[scoringTeam] >= world.rules.goalLimit)
  ) {
    world.phase = "ended";
    world.winnerTeamId = scoringTeam;
  } else {
    // Play resumes behind a short center-ice countdown, not instantly.
    startFaceoffCountdown(world, GOAL_FACEOFF_COUNTDOWN_MS);
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
  world.puck.goalieCarrierId = null;
  world.puck.carrierSlotId = null;
  world.puck.assistCandidateSlotId = null;
  world.puck.shotBySlotId = null;
  world.puck.shotPower = 0;
  world.puck.isChargedShot = false;
  world.puck.passedFromSlotId = null;
  world.puck.passedAtMs = 0;
  world.puck.pickupDisabledForSlotId = null;
  world.puck.pickupDisabledUntilMs = 0;
  world.puck.pokeGatherDisabledForSlotId = null;
  world.puck.pokeGatherDisabledUntilMs = 0;

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
