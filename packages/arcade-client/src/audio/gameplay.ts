import type { WorldEvent } from "@bbh/arcade-core";

export type GameplayCueId =
  | "hit"
  | "knockdown"
  | "save-pad"
  | "save-body"
  | "save-glove"
  | "save-blocker"
  | "save-cover"
  | "shot"
  | "one-timer"
  | "post"
  | "block"
  | "poke"
  | "jostle"
  | "bounce-back"
  | "clock-tick";

const HIT_FORCE_CAP = 1200;
const SKATING_SPEED_FLOOR = 30;
const SKATING_SPEED_CEILING = 430;
const SKATING_MIN_PLAYBACK_RATE = 0.85;
const SKATING_MAX_PLAYBACK_RATE = 1.35;
const SKATING_MAX_GAIN = 0.12;

export function gameplayCueForEvent(event: WorldEvent): {
  readonly id: GameplayCueId;
  readonly intensity: number;
} | null {
  switch (event.type) {
    case "hit":
      return {
        id: "hit",
        intensity: clamp01((event.force ?? 0) / HIT_FORCE_CAP)
      };
    case "knockdown":
      return { id: "knockdown", intensity: 1 };
    case "shot":
      return { id: "shot", intensity: 1 };
    case "oneTimer":
      return { id: "one-timer", intensity: 1 };
    case "post":
      return { id: "post", intensity: 1 };
    case "block":
      return { id: "block", intensity: 1 };
    case "poke":
      return { id: "poke", intensity: 1 };
    case "jostle":
      return { id: "jostle", intensity: 1 };
    case "bounceBack":
      return { id: "bounce-back", intensity: 1 };
    case "save":
      return saveCue(event.detail);
    case "clockCountdown":
      // Final-10s pip; the last second pips higher (intensity 1).
      return { id: "clock-tick", intensity: event.detail === "1" ? 1 : 0 };
    default:
      return null;
  }
}

export function skatingMixForSpeed(speed: number): {
  readonly gain: number;
  readonly playbackRate: number;
} {
  if (!Number.isFinite(speed) || speed <= SKATING_SPEED_FLOOR) {
    return {
      gain: 0,
      playbackRate: SKATING_MIN_PLAYBACK_RATE
    };
  }

  const normalized = clamp01(
    (speed - SKATING_SPEED_FLOOR) / (SKATING_SPEED_CEILING - SKATING_SPEED_FLOOR)
  );

  return {
    gain: clamp01(normalized) * SKATING_MAX_GAIN,
    playbackRate:
      SKATING_MIN_PLAYBACK_RATE +
      (SKATING_MAX_PLAYBACK_RATE - SKATING_MIN_PLAYBACK_RATE) * normalized
  };
}

function saveCue(detail: string | undefined): {
  readonly id: GameplayCueId;
  readonly intensity: number;
} | null {
  switch (detail) {
    case "pad":
      return { id: "save-pad", intensity: 1 };
    case "body":
      return { id: "save-body", intensity: 1 };
    case "glove":
      return { id: "save-glove", intensity: 1 };
    case "blocker":
      return { id: "save-blocker", intensity: 1 };
    case "cover":
      return { id: "save-cover", intensity: 1 };
    default:
      return null;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
