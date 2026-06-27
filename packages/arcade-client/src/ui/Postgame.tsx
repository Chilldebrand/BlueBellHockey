import type { MatchStats, TeamId } from "@bbh/arcade-core";

export interface PostgameRow {
  readonly label: string;
  readonly home: number;
  readonly away: number;
}

export function postgameRows(stats: MatchStats): readonly PostgameRow[] {
  return [
    { label: "Goals", home: stats.home.goals, away: stats.away.goals },
    { label: "Shots", home: stats.home.shots, away: stats.away.shots },
    { label: "Saves", home: stats.home.saves, away: stats.away.saves },
    { label: "Hits", home: stats.home.hits, away: stats.away.hits },
    { label: "Takeaways", home: stats.home.takeaways, away: stats.away.takeaways }
  ];
}

export function Postgame({
  stats,
  winnerTeamId,
  onRematch,
  onBackToLobby
}: {
  readonly stats: MatchStats;
  readonly winnerTeamId: TeamId | null;
  readonly onRematch: () => void;
  readonly onBackToLobby: () => void;
}): JSX.Element {
  return (
    <section className="postgame" aria-label="Postgame">
      <h2>{winnerTeamId ? `${winnerTeamId.toUpperCase()} victory` : "Draw"}</h2>
      <table>
        <tbody>
          {postgameRows(stats).map((row) => (
            <tr key={row.label}>
              <th>{row.label}</th>
              <td>{row.home}</td>
              <td>{row.away}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={onRematch}>
        Rematch
      </button>
      <button type="button" onClick={onBackToLobby}>
        Back To Lobby
      </button>
    </section>
  );
}
