import {
  REQUIRED_GOALIE_ANIMATION_CLIPS,
  REQUIRED_SKATER_ANIMATION_CLIPS
} from "../modelValidation.js";

export type SkaterAnimationState =
  | "idle"
  | "skate"
  | "hardTurn"
  | "turbo"
  | "pass"
  | "wristShot"
  | "chargeShot"
  | "check"
  | "stumble"
  | "down"
  | "getUp"
  | "juke"
  | "celebrate";

export type GoalieAnimationState =
  | "ready"
  | "slide"
  | "padSave"
  | "gloveSave"
  | "blockerSave"
  | "bodySave"
  | "cover";

export const SKATER_CLIP_MAP: Record<SkaterAnimationState, string> = {
  idle: "idle_ready",
  skate: "skate_forward",
  hardTurn: "hard_turn",
  turbo: "turbo_skate",
  pass: "pass",
  wristShot: "wrist_shot",
  chargeShot: "charged_shot",
  check: "check",
  stumble: "stumble",
  down: "knockdown",
  getUp: "get_up",
  juke: "juke",
  celebrate: "celebrate_goal"
};

export const GOALIE_CLIP_MAP: Record<GoalieAnimationState, string> = {
  ready: "goalie_ready",
  slide: "goalie_slide",
  padSave: "pad_save",
  gloveSave: "glove_save",
  blockerSave: "blocker_save",
  bodySave: "body_save",
  cover: "cover"
};

const SKATER_FALLBACKS: Partial<Record<SkaterAnimationState, SkaterAnimationState>> = {
  hardTurn: "skate",
  turbo: "skate",
  chargeShot: "wristShot",
  getUp: "idle",
  juke: "skate",
  celebrate: "idle"
};

const GOALIE_FALLBACKS: Partial<Record<GoalieAnimationState, GoalieAnimationState>> = {
  padSave: "bodySave",
  gloveSave: "bodySave",
  blockerSave: "bodySave",
  cover: "ready",
  slide: "ready"
};

export function clipForSkaterState(
  state: SkaterAnimationState,
  availableClips: readonly string[] = REQUIRED_SKATER_ANIMATION_CLIPS
): string {
  return resolveClip(state, SKATER_CLIP_MAP, SKATER_FALLBACKS, availableClips);
}

export function clipForGoalieState(
  state: GoalieAnimationState,
  availableClips: readonly string[] = REQUIRED_GOALIE_ANIMATION_CLIPS
): string {
  return resolveClip(state, GOALIE_CLIP_MAP, GOALIE_FALLBACKS, availableClips);
}

export function validateSkaterClipCoverage(
  availableClips: readonly string[]
): readonly string[] {
  return validateCoverage(SKATER_CLIP_MAP, SKATER_FALLBACKS, availableClips);
}

export function validateGoalieClipCoverage(
  availableClips: readonly string[]
): readonly string[] {
  return validateCoverage(GOALIE_CLIP_MAP, GOALIE_FALLBACKS, availableClips);
}

function resolveClip<TState extends string>(
  state: TState,
  clipMap: Record<TState, string>,
  fallbacks: Partial<Record<TState, TState>>,
  availableClips: readonly string[]
): string {
  const clip = clipMap[state];
  if (availableClips.includes(clip)) {
    return clip;
  }

  const fallbackState = fallbacks[state];
  if (fallbackState) {
    const fallbackClip = clipMap[fallbackState];
    if (availableClips.includes(fallbackClip)) {
      return fallbackClip;
    }
  }

  if ("idle" in clipMap) {
    return clipMap["idle" as TState];
  }

  if ("ready" in clipMap) {
    return clipMap["ready" as TState];
  }

  return clip;
}

function validateCoverage<TState extends string>(
  clipMap: Record<TState, string>,
  fallbacks: Partial<Record<TState, TState>>,
  availableClips: readonly string[]
): readonly string[] {
  const errors: string[] = [];

  for (const [state, clip] of Object.entries(clipMap) as [TState, string][]) {
    const fallbackState = fallbacks[state];
    const fallbackClip = fallbackState ? clipMap[fallbackState] : null;
    if (
      !availableClips.includes(clip) &&
      (!fallbackClip || !availableClips.includes(fallbackClip))
    ) {
      errors.push(`missing ${state} clip without approved fallback: ${clip}`);
    }
  }

  return errors;
}
