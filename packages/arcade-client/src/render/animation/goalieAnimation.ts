import type { GoalieEntity, WorldEvent } from "@bbh/arcade-core";
import type { GoalieAnimationState } from "./clipMap.js";

export interface GoalieAnimationInput {
  readonly goalie: GoalieEntity;
  readonly events: readonly WorldEvent[];
  readonly nowMs: number;
}

export function selectGoalieAnimation({
  goalie,
  events,
  nowMs
}: GoalieAnimationInput): GoalieAnimationState {
  const saveEvent = events.find(
    (event) =>
      event.type === "save" &&
      nowMs - event.atMs <= 700 &&
      (event.sourceSlotId === goalie.id || event.targetSlotId === goalie.id)
  );

  if (saveEvent?.force && saveEvent.force > 680) {
    return "padSave";
  }

  if (saveEvent) {
    return goalie.teamId === "home" ? "gloveSave" : "blockerSave";
  }

  if (Math.hypot(goalie.velocity.x, goalie.velocity.y) > 80) {
    return "slide";
  }

  return "ready";
}
