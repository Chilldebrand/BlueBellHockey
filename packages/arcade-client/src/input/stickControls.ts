import type { TeamId } from "@bbh/arcade-core";

export function transformStickForTeam(
  stickY: number,
  teamId: TeamId,
  alwaysUp: boolean,
  preserveAccessibilityShotGesture = false
): number {
  return teamId === "away" && !alwaysUp && !preserveAccessibilityShotGesture
    ? -stickY
    : stickY;
}
