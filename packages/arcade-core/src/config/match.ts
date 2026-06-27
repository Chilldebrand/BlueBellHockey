export type MatchMode = "arcade3v3";

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
