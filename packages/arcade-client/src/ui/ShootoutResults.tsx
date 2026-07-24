import {
  SHOOTOUT_ATTEMPTS,
  type ShootoutAttemptResult
} from "../game/shootout.js";

export interface ShootoutResultsProps {
  readonly results: readonly ShootoutAttemptResult[];
  readonly onRetry: () => void;
  readonly onExit: () => void;
}

/** End-of-shootout overlay: final tally, per-shot boxes, Retry / Exit. */
export function ShootoutResults({
  results,
  onRetry,
  onExit
}: ShootoutResultsProps): JSX.Element {
  const goals = results.filter((result) => result === "goal").length;

  return (
    <section className="shootout-results" aria-label="Shootout results">
      <div className="shootout-results-panel">
        <h1>SHOOTOUT COMPLETE</h1>
        <p className="shootout-results-score">
          {goals} / {SHOOTOUT_ATTEMPTS}
        </p>
        <div className="shootout-track shootout-track--results">
          {Array.from({ length: SHOOTOUT_ATTEMPTS }, (_, index) => {
            const result = results[index];
            return (
              <span
                key={index}
                className={`shootout-box ${
                  result === "goal" ? "is-goal" : "is-miss"
                }`}
              >
                {result === "goal" ? "✓" : "✗"}
              </span>
            );
          })}
        </div>
        <div className="shootout-results-actions">
          <button type="button" onClick={onRetry}>
            Retry
          </button>
          <button type="button" onClick={onExit}>
            Exit To Menu
          </button>
        </div>
      </div>
    </section>
  );
}
