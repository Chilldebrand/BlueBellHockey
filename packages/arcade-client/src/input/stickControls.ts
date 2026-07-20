import type { TeamId } from "@bbh/arcade-core";

export function transformStickForTeam(
  stickY: number,
  teamId: TeamId,
  alwaysUp: boolean
): number {
  return teamId === "away" && !alwaysUp ? -stickY : stickY;
}
