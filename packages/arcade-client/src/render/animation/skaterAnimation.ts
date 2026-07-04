import type { PuckState, SkaterEntity, WorldEvent } from "@bbh/arcade-core";
import type { SkaterAnimationState } from "./clipMap.js";

export interface SkaterAnimationInput {
  readonly skater: SkaterEntity;
  readonly puck: PuckState;
  readonly events: readonly WorldEvent[];
  readonly nowMs: number;
  readonly localHints?: {
    readonly pass?: boolean;
    readonly shoot?: boolean;
    readonly turbo?: boolean;
    readonly check?: boolean;
  };
}

export function selectSkaterAnimation({
  skater,
  puck,
  events,
  nowMs,
  localHints
}: SkaterAnimationInput): SkaterAnimationState {
  if (recentEvent(events, nowMs, "goal", skater.id)) {
    return "celebrate";
  }

  if (skater.contactState === "knockedDown" || skater.contactState === "diving") {
    return "down";
  }

  if (skater.contactState === "stumbling") {
    return "stumble";
  }

  if (skater.contactStateUntilMs > nowMs) {
    return "getUp";
  }

  if (skater.activeCheckUntilMs > nowMs || localHints?.check) {
    return "check";
  }

  if (puck.carrierSlotId === skater.id && localHints?.pass) {
    return "pass";
  }

  if (puck.carrierSlotId === skater.id && skater.gesture.phase === "windup") {
    return "chargeShot";
  }

  if (recentEvent(events, nowMs, "shot", skater.id)) {
    return "wristShot";
  }

  const speed = Math.hypot(skater.velocity.x, skater.velocity.y);
  if (localHints?.turbo || speed > 520) {
    return "turbo";
  }

  if (speed > 180) {
    return Math.abs(skater.velocity.x) > Math.abs(skater.velocity.y) * 1.8
      ? "hardTurn"
      : "skate";
  }

  return "idle";
}

function recentEvent(
  events: readonly WorldEvent[],
  nowMs: number,
  type: string,
  slotId: string
): boolean {
  return events.some(
    (event) =>
      event.type === type &&
      nowMs - event.atMs <= 900 &&
      (event.sourceSlotId === slotId || event.targetSlotId === slotId)
  );
}
