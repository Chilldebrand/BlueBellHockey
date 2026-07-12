import {
  getCharacterById,
  type MatchStats,
  type WorldState
} from "@bbh/arcade-core";
import { selectThreeStars } from "./threeStars.js";

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
  world,
  onRematch,
  onBackToLobby
}: {
  readonly world: WorldState;
  readonly onRematch: () => void;
  readonly onBackToLobby: () => void;
}): JSX.Element {
  const stars = selectThreeStars(world);

  return (
    <section className="postgame-backdrop" aria-label="Postgame">
      <div className="postgame-modal" role="dialog" aria-modal="true">
        <header className="postgame-result">
          <h1>
            {world.winnerTeamId ? `${world.winnerTeamId.toUpperCase()} WINS` : "DRAW"}
          </h1>
          <p>FIRST TO 5</p>
          <p className="postgame-score">
            {world.score.home} - {world.score.away}
          </p>
        </header>

        <section aria-labelledby="three-stars-heading">
          <h2 id="three-stars-heading">THREE STARS</h2>
          <div className="postgame-stars">
            {stars.map((star) => (
              <article
                className={`postgame-star postgame-star--${star.teamId}`}
                key={star.slotId}
              >
                <h3>{starLabel(star.rank)}</h3>
                <p>{getCharacterById(star.characterId).displayName}</p>
                <p className="postgame-star-stats">
                  G {star.goals} · A {star.assists} · H {star.hits}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="team-totals-heading">
          <h2 id="team-totals-heading">TEAM TOTALS</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Stat</th>
                <th scope="col">Home</th>
                <th scope="col">Away</th>
              </tr>
            </thead>
            <tbody>
              {postgameRows(world.stats).map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.home}</td>
                  <td>{row.away}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="postgame-actions">
          <button type="button" onClick={onRematch}>
            Rematch
          </button>
          <button type="button" onClick={onBackToLobby}>
            Back To Lobby
          </button>
        </div>
      </div>
    </section>
  );
}

function starLabel(rank: number): string {
  return ["First Star", "Second Star", "Third Star"][rank - 1] ?? "Star";
}
