import type { MatchStats, PlayerStatLine, TeamStatTotals } from "./types.js";

function createTeamStats(): TeamStatTotals {
  return {
    goals: 0,
    shots: 0,
    saves: 0,
    hits: 0,
    takeaways: 0
  };
}

export function createInitialStats(slotIds: readonly string[]): MatchStats {
  const home = createTeamStats();
  const away = createTeamStats();
  const scoreCounters = () => ({ home: 0, away: 0 });
  const players = Object.fromEntries(
    slotIds.map((slotId) => [slotId, { goals: 0, assists: 0, hits: 0 }])
  );

  return {
    home,
    away,
    goals: scoreCounters(),
    shots: scoreCounters(),
    saves: scoreCounters(),
    hits: scoreCounters(),
    takeaways: scoreCounters(),
    players
  };
}

export function playerStatLine(
  stats: MatchStats,
  slotId: string
): PlayerStatLine | null {
  return stats.players[slotId] ?? null;
}
