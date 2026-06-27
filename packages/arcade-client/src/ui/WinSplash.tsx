import type { TeamId } from "@bbh/arcade-core";

export function WinSplash({
  winnerTeamId
}: {
  readonly winnerTeamId: TeamId | null;
}): JSX.Element {
  return (
    <section className="win-splash" aria-label="Win splash">
      <h1>{winnerTeamId ? `${winnerTeamId.toUpperCase()} wins` : "Draw"}</h1>
    </section>
  );
}
