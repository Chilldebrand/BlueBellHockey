import type { WorldEvent } from "@bbh/arcade-core";

export interface CalloutsProps {
  readonly events: readonly WorldEvent[];
}

const COPY: Record<string, string> = {
  goal: "GOAL",
  save: "SAVE",
  hit: "HIT",
  knockdown: "DOWN"
};

export function Callouts({ events }: CalloutsProps): JSX.Element | null {
  const event = [...events].reverse().find((candidate) => COPY[candidate.type]);

  if (!event) {
    return null;
  }

  return (
    <div className="arcade-callout" aria-live="polite">
      {COPY[event.type]}
    </div>
  );
}
