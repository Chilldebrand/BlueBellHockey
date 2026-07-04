export interface RinkConfig {
  readonly width: number;
  readonly height: number;
  /** Radius of the rounded board corners (a real rink is not a rectangle). */
  readonly cornerRadius: number;
  /** Distance of each goal line from its end wall — leaves room behind the net. */
  readonly goalLineInset: number;
  /** How deep the net cage extends from the goal line toward the end wall. */
  readonly netDepth: number;
  readonly goalWidth: number;
  /** Where goalies stand: just in front of their goal line. */
  readonly goalieDepth: number;
}

export const RINK_CONFIG: RinkConfig = {
  width: 2000,
  height: 1200,
  cornerRadius: 310,
  goalLineInset: 170,
  netDepth: 50,
  goalWidth: 220,
  goalieDepth: 44
};

/** X of the goal line a team defends (home defends low-x, away high-x). */
export function goalLineX(teamId: "home" | "away"): number {
  return teamId === "home"
    ? RINK_CONFIG.goalLineInset
    : RINK_CONFIG.width - RINK_CONFIG.goalLineInset;
}

/** X of the back of the net cage (between the goal line and the end wall). */
export function netBackX(teamId: "home" | "away"): number {
  return teamId === "home"
    ? RINK_CONFIG.goalLineInset - RINK_CONFIG.netDepth
    : RINK_CONFIG.width - RINK_CONFIG.goalLineInset + RINK_CONFIG.netDepth;
}
