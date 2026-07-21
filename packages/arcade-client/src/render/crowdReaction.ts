/**
 * Pure crowd reaction state machine. Classifies only goal and knockdown world
 * events into visual crowd reactions; every other event type is ignored. The
 * first observed queue is seeded as already seen so the sim's retained event
 * history (mount, remount, reconnect backlog) can never replay a celebration.
 */

export type CrowdReactionKind = "goal" | "majorHit";

export interface ActiveCrowdReaction {
  readonly kind: CrowdReactionKind;
  readonly startedAtMs: number;
}

export interface CrowdReactionState {
  readonly seeded: boolean;
  readonly seenEventIds: ReadonlySet<string>;
  readonly active: ActiveCrowdReaction | null;
}

export const GOAL_REACTION_MS = 2500;
export const MAJOR_HIT_REACTION_MS = 800;

export function crowdReactionDurationMs(kind: CrowdReactionKind): number {
  return kind === "goal" ? GOAL_REACTION_MS : MAJOR_HIT_REACTION_MS;
}

export function createCrowdReactionState(): CrowdReactionState {
  return { seeded: false, seenEventIds: new Set(), active: null };
}

interface ReactionEvent {
  readonly id: string;
  readonly type: string;
}

/**
 * Advance the reaction state against the current event queue. Pure: returns a
 * new state and never mutates its inputs.
 */
export function advanceCrowdReaction(
  state: CrowdReactionState,
  events: readonly ReactionEvent[],
  nowMs: number
): CrowdReactionState {
  if (!state.seeded) {
    return {
      seeded: true,
      seenEventIds: new Set(events.map((event) => event.id)),
      active: null
    };
  }

  // The sim trims its retained queue and event IDs are never reused, so
  // pruning to the live queue keeps the seen-set bounded forever.
  const liveIds = new Set(events.map((event) => event.id));
  const seen = new Set(
    Array.from(state.seenEventIds).filter((id) => liveIds.has(id))
  );

  let active = state.active;
  if (active && nowMs - active.startedAtMs >= crowdReactionDurationMs(active.kind)) {
    active = null;
  }

  for (const event of events) {
    if (seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);

    if (event.type === "goal") {
      // A goal celebration replaces anything, including an earlier goal.
      active = { kind: "goal", startedAtMs: nowMs };
    } else if (event.type === "knockdown") {
      // A knockdown refreshes the short reaction but never outranks a goal.
      if (active?.kind !== "goal") {
        active = { kind: "majorHit", startedAtMs: nowMs };
      }
    }
  }

  return { seeded: true, seenEventIds: seen, active };
}

/** Normalized 0..1 progress of the active reaction, or null when idle. */
export function reactionProgress(
  state: CrowdReactionState,
  nowMs: number
): number | null {
  if (!state.active) {
    return null;
  }

  const progress =
    (nowMs - state.active.startedAtMs) /
    crowdReactionDurationMs(state.active.kind);
  if (progress >= 1) {
    return null;
  }
  return Math.max(0, progress);
}
