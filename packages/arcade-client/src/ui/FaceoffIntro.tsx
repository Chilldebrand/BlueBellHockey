export interface FaceoffIntroProps {
  readonly phase: string;
  /** Sim time the faceoff hold ends (world.faceoffUntilMs; 0 = none). */
  readonly faceoffUntilMs: number;
  /** Current sim time (world.time.nowMs). */
  readonly nowMs: number;
}

/**
 * Center-ice countdown shown only while the sim holds play at a faceoff:
 * 5-4-3-2-1 at match start, 3-2-1 after each goal. Driven entirely by sim
 * time from snapshots — no local timers, so it can never get stuck.
 */
export function FaceoffIntro({
  phase,
  faceoffUntilMs,
  nowMs
}: FaceoffIntroProps): JSX.Element | null {
  if (phase !== "playing" || faceoffUntilMs <= nowMs) {
    return null;
  }

  const seconds = Math.ceil((faceoffUntilMs - nowMs) / 1000);

  return (
    <div
      className="faceoff-intro"
      key={seconds}
      role="timer"
      aria-label="Faceoff countdown"
    >
      <span className="faceoff-intro-label">Faceoff</span>
      <span className="faceoff-intro-digit">{seconds}</span>
    </div>
  );
}
