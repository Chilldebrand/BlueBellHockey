import type { GoalieEntity, PuckState, Vec2 } from "@bbh/arcade-core";

export interface ServerGoalieIntent {
  readonly goalieId: string;
  readonly target: Vec2;
}

export function createServerGoalieIntent(
  goalie: GoalieEntity,
  puck: PuckState
): ServerGoalieIntent {
  return {
    goalieId: goalie.id,
    target: {
      x: goalie.position.x,
      y: puck.position.y
    }
  };
}
