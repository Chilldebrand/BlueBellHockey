import type { ArcadeClientState } from "../store.js";

export interface ScoreHudProps {
  readonly state: ArcadeClientState;
}

export function ScoreHud({ state }: ScoreHudProps): JSX.Element {
  const remainingSeconds = Math.max(
    0,
    Math.ceil((state.currentWorld?.remainingMs ?? 0) / 1000)
  );

  return (
    <aside className="score-hud" aria-label="Score">
      <strong>
        {state.score.home}-{state.score.away}
      </strong>
      <span>{formatClock(remainingSeconds)}</span>
      <span>{state.phase}</span>
    </aside>
  );
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
