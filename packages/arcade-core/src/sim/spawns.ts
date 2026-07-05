import { RINK_CONFIG } from "../config/rink.js";
import type { Vec2 } from "./types.js";

/** Team side: home spawns on -x and attacks +x; away mirrors it. */
export type TeamSide = -1 | 1;

/** Faceoff spawn for a skater by 0-based slot index, fanned around center ice. */
export function skaterSpawn(index: number, teamSide: TeamSide): Vec2 {
  return {
    x: RINK_CONFIG.width / 2 + teamSide * 260,
    y: RINK_CONFIG.height / 2 + (index - 1) * 140
  };
}

/** Goalie rest position: in the crease just off its own goal line. */
export function goalieSpawn(teamSide: TeamSide): Vec2 {
  const inset = RINK_CONFIG.goalLineInset + RINK_CONFIG.goalieDepth;

  return {
    x: teamSide === -1 ? inset : RINK_CONFIG.width - inset,
    y: RINK_CONFIG.height / 2
  };
}

/** Body orientation a skater faces at spawn (toward the attacking end). */
export function spawnFacing(teamSide: TeamSide): number {
  return teamSide === -1 ? 0 : Math.PI;
}
