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

function createPlayerStatLine(): PlayerStatLine {
  return { goals: 0, assists: 0, hits: 0, shots: 0, saves: 0, powerups: 0 };
}

export function createInitialStats(
  skaterSlotIds: readonly string[],
  goalieSlotIds: readonly string[] = []
): MatchStats {
  const home = createTeamStats();
  const away = createTeamStats();
  const scoreCounters = () => ({ home: 0, away: 0 });
  // Goalies get their own player stat lines too (keyed by goalie id) so the
  // postgame team panels can show a per-goalie SAVES row.
  const players = Object.fromEntries(
    [...skaterSlotIds, ...goalieSlotIds].map((slotId) => [
      slotId,
      createPlayerStatLine()
    ])
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
