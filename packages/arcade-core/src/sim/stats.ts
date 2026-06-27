import type { MatchStats, TeamStatTotals } from "./types.js";

function createTeamStats(): TeamStatTotals {
  return {
    goals: 0,
    shots: 0,
    saves: 0,
    hits: 0,
    takeaways: 0
  };
}

export function createInitialStats(): MatchStats {
  const home = createTeamStats();
  const away = createTeamStats();
  const scoreCounters = () => ({ home: 0, away: 0 });

  return {
    home,
    away,
    goals: scoreCounters(),
    shots: scoreCounters(),
    saves: scoreCounters(),
    hits: scoreCounters(),
    takeaways: scoreCounters()
  };
}
