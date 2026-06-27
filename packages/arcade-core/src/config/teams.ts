export const TEAM_IDS = ["home", "away"] as const;

export type TeamId = (typeof TEAM_IDS)[number];

export interface SkaterSlot {
  readonly id: string;
  readonly teamId: TeamId;
  readonly index: number;
}

export interface GoalieSlot {
  readonly id: string;
  readonly teamId: TeamId;
  readonly owner: "server";
}

export const SKATER_SLOTS = [
  { id: "home-skater-1", teamId: "home", index: 0 },
  { id: "home-skater-2", teamId: "home", index: 1 },
  { id: "home-skater-3", teamId: "home", index: 2 },
  { id: "away-skater-1", teamId: "away", index: 0 },
  { id: "away-skater-2", teamId: "away", index: 1 },
  { id: "away-skater-3", teamId: "away", index: 2 }
] as const satisfies readonly SkaterSlot[];

export const GOALIE_SLOTS = [
  { id: "home-goalie", teamId: "home", owner: "server" },
  { id: "away-goalie", teamId: "away", owner: "server" }
] as const satisfies readonly GoalieSlot[];
