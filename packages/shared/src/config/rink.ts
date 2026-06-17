// Rink dimensions in world units (metres-ish). Centered at origin.
// X is goal-to-goal (length), Z is side-to-side (width), Y is up.
export const RINK = {
  halfLength: 30,
  halfWidth: 18,
  cornerRadius: 8,
  boardRestitution: 0.55,
  goalLineX: 27, // |x| at which a goal counts
  goalWidth: 7, // mouth size: scoring requires |z| < goalWidth/2
  goalHeight: 2.2,
  faceoffZ: 11,
  centerFaceoff: { x: 0, z: 0 },
} as const;

export const SKATER_RADIUS = 0.55;
export const PUCK_RADIUS = 0.18;

/** Team 0 attacks +X, defends -X. Team 1 attacks -X, defends +X. */
export function attackingGoalX(team: 0 | 1): number {
  return team === 0 ? RINK.goalLineX : -RINK.goalLineX;
}
export function defendingGoalX(team: 0 | 1): number {
  return team === 0 ? -RINK.goalLineX : RINK.goalLineX;
}
