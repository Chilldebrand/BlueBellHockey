import {
  SHOOTOUT_ATTEMPTS,
  type ShootoutAttemptResult,
  type ShootoutPhase
} from "../game/shootout.js";

export interface ShootoutHudProps {
  readonly results: readonly ShootoutAttemptResult[];
  readonly attemptIndex: number;
  readonly phase: ShootoutPhase;
}

/**
 * Broadcast-style shootout tracker: one box per attempt — ✓ for a goal,
 * ✗ for a miss, empty while pending, the in-progress attempt highlighted.
 */
export function ShootoutHud({
  results,
  attemptIndex,
  phase
}: ShootoutHudProps): JSX.Element {
  const shotNumber = Math.min(attemptIndex + 1, SHOOTOUT_ATTEMPTS);

  return (
    <aside className="shootout-hud" aria-label="Shootout scoreboard">
      <span className="shootout-hud-label">
        {phase === "complete" ? "FINAL" : `SHOT ${shotNumber}/${SHOOTOUT_ATTEMPTS}`}
      </span>
      <div className="shootout-track">
        {Array.from({ length: SHOOTOUT_ATTEMPTS }, (_, index) => {
          const result = results[index];
          const isCurrent = phase !== "complete" && index === attemptIndex;
          const className = [
            "shootout-box",
            result === "goal" ? "is-goal" : "",
            result === "miss" ? "is-miss" : "",
            isCurrent ? "is-current" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              key={index}
              className={className}
              aria-label={`Shot ${index + 1}: ${result ?? "pending"}`}
            >
              {result === "goal" ? "✓" : result === "miss" ? "✗" : ""}
            </span>
          );
        })}
      </div>
    </aside>
  );
}
