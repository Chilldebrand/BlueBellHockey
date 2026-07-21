import { TEAM_PALETTES } from "@bbh/arcade-core";
import type { ArcadeClientState } from "../store.js";

export interface ScoreHudProps {
  readonly state: ArcadeClientState;
}

/**
 * Broadcast-style scoreboard, fixed top-left:
 * [BLU] 2  12:34  1 [RED] — big tabular digits, team chips in team colors,
 * phase shown only when not actively playing.
 */
export function ScoreHud({ state }: ScoreHudProps): JSX.Element {
  const isOvertime = state.phase === "playing" && state.currentWorld?.isOvertime;
  const remainingSeconds = Math.max(
    0,
    Math.ceil((state.currentWorld?.remainingMs ?? 0) / 1000)
  );

  return (
    <aside className="score-hud" aria-label="Score">
      <span
        className="score-hud-team"
        style={{ borderLeftColor: TEAM_PALETTES.home.iconColor }}
      >
        {TEAM_PALETTES.home.shortName}
      </span>
      <strong className="score-hud-digits">{state.score.home}</strong>
      <div className="score-hud-center">
        <span className="score-hud-clock">
          {isOvertime ? "NEXT GOAL" : formatClock(remainingSeconds)}
        </span>
        {isOvertime ? <span className="score-hud-overtime">OT</span> : null}
        {state.phase === "playing" ? null : (
          <span className="score-hud-phase">{state.phase}</span>
        )}
      </div>
      <strong className="score-hud-digits">{state.score.away}</strong>
      <span
        className="score-hud-team"
        style={{ borderLeftColor: TEAM_PALETTES.away.iconColor }}
      >
        {TEAM_PALETTES.away.shortName}
      </span>
    </aside>
  );
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
