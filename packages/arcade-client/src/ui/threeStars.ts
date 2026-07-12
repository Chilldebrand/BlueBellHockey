import type { CharacterId, TeamId, WorldState } from "@bbh/arcade-core";

export interface ThreeStar {
  readonly rank: number;
  readonly slotId: string;
  readonly teamId: TeamId;
  readonly characterId: CharacterId;
  readonly goals: number;
  readonly assists: number;
  readonly hits: number;
  readonly score: number;
}

export function selectThreeStars(world: WorldState): readonly ThreeStar[] {
  return world.skaters
    .map((skater) => {
      const stats = world.stats.players[skater.id] ?? { goals: 0, assists: 0, hits: 0 };
      const score = stats.goals * 5 + stats.assists * 3 + stats.hits;

      return {
        rank: 0,
        slotId: skater.id,
        teamId: skater.teamId,
        characterId: skater.characterId,
        goals: stats.goals,
        assists: stats.assists,
        hits: stats.hits,
        score
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.goals - left.goals ||
        right.assists - left.assists ||
        right.hits - left.hits ||
        left.slotId.localeCompare(right.slotId)
    )
    .slice(0, 3)
    .map((star, index) => ({ ...star, rank: index + 1 }));
}
