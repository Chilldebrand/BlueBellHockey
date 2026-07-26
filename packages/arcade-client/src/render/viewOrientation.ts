import type { TeamId } from "@bbh/arcade-core";

/**
 * Which sim direction "up the screen" points for THIS viewer.
 *
 * `1` = the classic broadcast framing: sim +x is up-screen, so home attacks
 * up. `-1` yaws the whole rig 180 degrees so sim -x is up-screen instead —
 * away's attacking direction. Nobody wants to play downhill, so every client
 * watches their own team attack toward the top of the screen.
 *
 * This is a CLIENT PRESENTATION value only. The sim, the server, and the wire
 * never see it: it is applied to the camera and folded into the local input
 * frame BEFORE the frame is predicted or sent, exactly like the team stick
 * flip it replaces. Both clients still drive the same world-space frames.
 */
export type ViewOrientation = 1 | -1;

export function viewOrientationForTeam(
  teamId: TeamId | null | undefined
): ViewOrientation {
  return teamId === "away" ? -1 : 1;
}
