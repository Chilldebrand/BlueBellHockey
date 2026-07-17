import {
  POWERUP_DEFINITIONS,
  createWorld,
  type WorldEvent,
  type WorldState
} from "@bbh/arcade-core";
import { describe, expect, it } from "vitest";
import {
  AnnouncerQueue,
  announcerCueForEvent,
  type AnnouncerCue
} from "./announcer.js";

function worldFixture(): WorldState {
  return createWorld(7, "arcade3v3", {
    "away-skater-2": "zara-crush"
  });
}

function goalEvent(
  sourceSlotId?: string,
  overrides: Partial<WorldEvent> = {}
): WorldEvent {
  return {
    id: "goal-10-home",
    type: "goal",
    atMs: 1000,
    sourceSlotId,
    ...overrides
  };
}

function powerupEvent(
  sourceSlotId = "home-skater-1",
  targetSlotId = "speed-boost",
  overrides: Partial<WorldEvent> = {}
): WorldEvent {
  return {
    id: "powerup-pickup-10-home-skater-1",
    type: "powerupPickup",
    atMs: 1000,
    sourceSlotId,
    targetSlotId,
    ...overrides
  };
}

function cue(
  eventId: string,
  kind: "goal" | "powerup",
  priority: number
): AnnouncerCue {
  return {
    eventId,
    kind,
    priority,
    clipIds: [`clip-${eventId}`],
    characterName: eventId,
    text: eventId
  };
}

describe("announcerCueForEvent", () => {
  it("resolves a goal to the scorer character and stable clip ids", () => {
    const world = worldFixture();

    const resolved = announcerCueForEvent(goalEvent("home-skater-1"), world, () => 0);

    expect(resolved).toEqual({
      eventId: "goal-10-home",
      kind: "goal",
      priority: 100,
      clipIds: ["announcer.name.rook-rocket", "announcer.goal.0"],
      characterName: "Rook Rocket",
      text: "Rook Rocket finds the twine!"
    });
  });

  it("falls back to Unknown Player only when a goal event is malformed", () => {
    const resolved = announcerCueForEvent(goalEvent(undefined), worldFixture(), () => 0);

    expect(resolved).toEqual({
      eventId: "goal-10-home",
      kind: "goal",
      priority: 100,
      clipIds: ["announcer.goal.0"],
      characterName: "Unknown Player",
      text: "Unknown Player finds the twine!"
    });
  });

  it("resolves a powerup pickup through sourceSlotId and targetSlotId", () => {
    const resolved = announcerCueForEvent(
      powerupEvent("away-skater-2", "mini-goalie"),
      worldFixture(),
      () => 0.25
    );

    expect(resolved).toEqual({
      eventId: "powerup-pickup-10-home-skater-1",
      kind: "powerup",
      priority: 50,
      clipIds: ["announcer.name.zara-crush", "announcer.powerup.mini-goalie"],
      characterName: "Zara Crush",
      text: "Zara Crush made the goalie tiny!"
    });
  });

  it("returns null for unrelated event types", () => {
    expect(
      announcerCueForEvent(
        { id: "hit-1", type: "hit", atMs: 1000, sourceSlotId: "home-skater-1" },
        worldFixture(),
        () => 0
      )
    ).toBeNull();
  });

  it("uses the supplied random function for deterministic line selection", () => {
    const resolved = announcerCueForEvent(goalEvent("home-skater-1"), worldFixture(), () => 0.99);

    expect(resolved?.clipIds).toEqual([
      "announcer.name.rook-rocket",
      "announcer.goal.7"
    ]);
    expect(resolved?.text).toBe("Rook Rocket that was rude!");
  });

  it("uses the configured powerup definition ids", () => {
    const type = "hard-shot";
    expect(POWERUP_DEFINITIONS[type].label).toBe("Hard Shot");

    const resolved = announcerCueForEvent(
      powerupEvent("home-skater-2", type),
      worldFixture(),
      () => 0
    );

    expect(resolved?.clipIds).toEqual([
      "announcer.name.nova-screen",
      "announcer.powerup.hard-shot"
    ]);
    expect(resolved?.text).toBe("Nova Screen loaded the big stick!");
  });
});

describe("AnnouncerQueue", () => {
  it("returns the first enqueued cue immediately, then enforces the 1.5 second cooldown", () => {
    const queue = new AnnouncerQueue();
    const first = cue("goal-1", "goal", 100);

    queue.enqueue(first);

    expect(queue.next(1000)).toEqual(first);
    expect(queue.next(2000)).toBeNull();
    expect(queue.next(2500)).toBeNull();
  });

  it("releases the next queued cue once the cooldown expires", () => {
    const queue = new AnnouncerQueue();
    const first = cue("goal-1", "goal", 100);
    const second = cue("powerup-1", "powerup", 50);

    queue.enqueue(first);
    queue.enqueue(second);

    expect(queue.next(1000)).toEqual(first);
    expect(queue.next(2501)).toEqual(second);
  });

  it("keeps only one active cue and two queued cues, preserving higher priority cues", () => {
    const queue = new AnnouncerQueue();
    const first = cue("powerup-1", "powerup", 50);
    const second = cue("powerup-2", "powerup", 50);
    const third = cue("goal-1", "goal", 100);
    const dropped = cue("powerup-3", "powerup", 50);

    queue.enqueue(first);
    queue.enqueue(second);
    queue.enqueue(third);
    queue.enqueue(dropped);

    expect(queue.next(1000)).toEqual(third);
    expect(queue.next(2501)).toEqual(first);
    expect(queue.next(4002)).toEqual(second);
    expect(queue.next(5503)).toBeNull();
  });

  it("interrupts with a higher-priority cue and clears lower-priority pending cues", () => {
    const queue = new AnnouncerQueue();
    const powerup = cue("powerup-1", "powerup", 50);
    const sparePowerup = cue("powerup-2", "powerup", 50);
    const goal = cue("goal-1", "goal", 100);

    queue.enqueue(powerup);
    queue.enqueue(sparePowerup);
    expect(queue.next(1000)).toEqual(powerup);

    queue.interruptWith(goal);

    expect(queue.next(1100)).toEqual(goal);
    expect(queue.next(2601)).toBeNull();
  });

  it("breaks same-priority ties in favor of goals", () => {
    const queue = new AnnouncerQueue();
    const powerup = cue("same-time-powerup", "powerup", 100);
    const goal = cue("same-time-goal", "goal", 100);

    queue.enqueue(powerup);
    queue.enqueue(goal);

    expect(queue.next(1000)).toEqual(goal);
    expect(queue.next(2501)).toEqual(powerup);
  });

  it("clears all active and queued cues", () => {
    const queue = new AnnouncerQueue();

    queue.enqueue(cue("goal-1", "goal", 100));
    queue.enqueue(cue("powerup-1", "powerup", 50));
    queue.clear();

    expect(queue.next(1000)).toBeNull();
  });
});
