import type { WorldState } from "@bbh/arcade-core";

export const FINAL_COUNTDOWN_WINDOW_MS = 10_000;

/**
 * 10..1 during the last ten seconds of regulation, else null. Pure selector
 * for tests. Never fires in overtime (clock pinned at 0), during a faceoff
 * hold (clock frozen), or in Free Skate (remainingMs re-pinned each step).
 */
export function selectFinalCountdownSecond(
  world: WorldState | null
): number | null {
  if (!world || world.phase !== "playing" || world.isOvertime) {
    return null;
  }

  if ((world.faceoffUntilMs ?? 0) > world.time.nowMs) {
    return null;
  }

  if (world.remainingMs <= 0 || world.remainingMs > FINAL_COUNTDOWN_WINDOW_MS) {
    return null;
  }

  return Math.ceil(world.remainingMs / 1000);
}

/** Big center-low digits for the dying seconds of regulation. */
export function FinalCountdown({
  world
}: {
  readonly world: WorldState | null;
}): JSX.Element | null {
  const second = selectFinalCountdownSecond(world);

  if (second === null) {
    return null;
  }

  return (
    <div
      className="final-countdown"
      key={second}
      role="timer"
      aria-label={`${second} seconds left`}
    >
      {second}
    </div>
  );
}
