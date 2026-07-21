export type MatchMode = "arcade3v3";

export const TIME_LIMIT_OPTIONS_MS = [180_000, 300_000, 420_000, 600_000] as const;
export const GOAL_LIMIT_OPTIONS = [0, 3, 5, 7, 10] as const;

export type TimeLimitMs = (typeof TIME_LIMIT_OPTIONS_MS)[number];
export type GoalLimit = (typeof GOAL_LIMIT_OPTIONS)[number];

export interface MatchRules {
  readonly timeLimitMs: TimeLimitMs;
  readonly goalLimit: GoalLimit;
}

export const DEFAULT_MATCH_RULES: MatchRules = {
  timeLimitMs: 180_000,
  goalLimit: 0
};

export function isMatchRules(value: unknown): value is MatchRules {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    TIME_LIMIT_OPTIONS_MS.some((option) => option === candidate.timeLimitMs) &&
    GOAL_LIMIT_OPTIONS.some((option) => option === candidate.goalLimit)
  );
}

export interface MatchConfig {
  readonly mode: MatchMode;
  readonly fixedTickMs: number;
  readonly periodMs: number;
  readonly skatersPerTeam: number;
}

export const MATCH_CONFIG: MatchConfig = {
  mode: "arcade3v3",
  fixedTickMs: 16,
  periodMs: 180_000,
  skatersPerTeam: 3
};
