import { describe, expect, it } from "vitest";
import {
  advanceCrowdReaction,
  createCrowdReactionState,
  GOAL_REACTION_MS,
  MAJOR_HIT_REACTION_MS,
  reactionProgress
} from "./crowdReaction.js";

function event(id: string, type: string): { id: string; type: string } {
  return { id, type };
}

describe("crowd reaction state machine", () => {
  it("seeds the first observed queue without reacting, even to goals", () => {
    const state = advanceCrowdReaction(
      createCrowdReactionState(),
      [event("goal-1", "goal"), event("knockdown-1", "knockdown")],
      1000
    );

    expect(state.seeded).toBe(true);
    expect(state.active).toBeNull();
    expect(state.seenEventIds.has("goal-1")).toBe(true);
    expect(state.seenEventIds.has("knockdown-1")).toBe(true);
  });

  it("starts a full goal reaction for an unseen goal and runs it to expiry", () => {
    let state = advanceCrowdReaction(createCrowdReactionState(), [], 0);
    state = advanceCrowdReaction(state, [event("goal-1", "goal")], 1000);

    expect(state.active).toEqual({ kind: "goal", startedAtMs: 1000 });
    expect(reactionProgress(state, 1000)).toBe(0);
    expect(reactionProgress(state, 1000 + GOAL_REACTION_MS / 2)).toBeCloseTo(0.5);
    expect(reactionProgress(state, 1000 + GOAL_REACTION_MS)).toBeNull();

    state = advanceCrowdReaction(
      state,
      [event("goal-1", "goal")],
      1000 + GOAL_REACTION_MS + 16
    );
    expect(state.active).toBeNull();
  });

  it("starts and refreshes the short reaction on unseen knockdowns", () => {
    let state = advanceCrowdReaction(createCrowdReactionState(), [], 0);
    state = advanceCrowdReaction(state, [event("kd-1", "knockdown")], 1000);
    expect(state.active).toEqual({ kind: "majorHit", startedAtMs: 1000 });

    state = advanceCrowdReaction(
      state,
      [event("kd-1", "knockdown"), event("kd-2", "knockdown")],
      1400
    );
    expect(state.active).toEqual({ kind: "majorHit", startedAtMs: 1400 });
  });

  it("lets a goal replace an active knockdown reaction immediately", () => {
    let state = advanceCrowdReaction(createCrowdReactionState(), [], 0);
    state = advanceCrowdReaction(state, [event("kd-1", "knockdown")], 1000);
    state = advanceCrowdReaction(
      state,
      [event("kd-1", "knockdown"), event("goal-1", "goal")],
      1200
    );

    expect(state.active).toEqual({ kind: "goal", startedAtMs: 1200 });
  });

  it("never lets a knockdown displace an active goal celebration", () => {
    let state = advanceCrowdReaction(createCrowdReactionState(), [], 0);
    state = advanceCrowdReaction(state, [event("goal-1", "goal")], 1000);
    state = advanceCrowdReaction(
      state,
      [event("goal-1", "goal"), event("kd-1", "knockdown")],
      1500
    );

    expect(state.active).toEqual({ kind: "goal", startedAtMs: 1000 });
    // Once the goal expires, a fresh knockdown may start the short reaction.
    state = advanceCrowdReaction(
      state,
      [event("kd-2", "knockdown")],
      1000 + GOAL_REACTION_MS + 100
    );
    expect(state.active).toEqual({
      kind: "majorHit",
      startedAtMs: 1000 + GOAL_REACTION_MS + 100
    });
    expect(
      reactionProgress(state, 1000 + GOAL_REACTION_MS + 100 + MAJOR_HIT_REACTION_MS)
    ).toBeNull();
  });

  it("ignores routine gameplay events entirely", () => {
    let state = advanceCrowdReaction(createCrowdReactionState(), [], 0);
    state = advanceCrowdReaction(
      state,
      [
        event("hit-1", "hit"),
        event("stumble-1", "stumble"),
        event("save-1", "save"),
        event("shot-1", "shot"),
        event("post-1", "post"),
        event("powerup-1", "powerupPickup")
      ],
      1000
    );

    expect(state.active).toBeNull();
  });

  it("never retriggers on an already-seen event ID", () => {
    let state = advanceCrowdReaction(createCrowdReactionState(), [], 0);
    state = advanceCrowdReaction(state, [event("goal-1", "goal")], 1000);
    state = advanceCrowdReaction(
      state,
      [event("goal-1", "goal")],
      1000 + GOAL_REACTION_MS + 50
    );

    expect(state.active).toBeNull();
  });

  it("prunes seen IDs no longer retained by the sim's trimmed queue", () => {
    let state = advanceCrowdReaction(createCrowdReactionState(), [], 0);
    state = advanceCrowdReaction(state, [event("goal-1", "goal")], 1000);
    state = advanceCrowdReaction(state, [event("kd-9", "knockdown")], 9000);

    expect(state.seenEventIds.has("goal-1")).toBe(false);
    expect(state.seenEventIds.has("kd-9")).toBe(true);
  });

  it("does not mutate its input state", () => {
    const initial = advanceCrowdReaction(createCrowdReactionState(), [], 0);
    const seenBefore = new Set(initial.seenEventIds);
    const events = [event("goal-1", "goal")];

    advanceCrowdReaction(initial, events, 1000);

    expect(initial.active).toBeNull();
    expect(new Set(initial.seenEventIds)).toEqual(seenBefore);
    expect(events).toEqual([event("goal-1", "goal")]);
  });
});
