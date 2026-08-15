import { describe, expect, it } from "vitest";
import { createWorld, DEFAULT_MATCH_RULES } from "@bbh/arcade-core";
import {
  buildHighlightColorByEntityId,
  createInitialArcadeClientState,
  mapRoomState,
  mergeSnapshotEventQueue,
  PLAYER_HIGHLIGHT_COLORS,
  reduceArcadeClientState,
  type ClientRosterSlot,
  type ServerRosterSlot
} from "./store.js";
import type { ArcadeRoomConnection } from "./net/client.js";

describe("reduceArcadeClientState", () => {
  it("hydrates match rules and defaults fields missing from older room state", () => {
    const room = {
      sessionId: "session-a",
      state: {
        rules: { goalLimit: 7 }
      }
    } as unknown as ArcadeRoomConnection;

    const state = mapRoomState(room);

    expect(state.rules).toEqual({
      timeLimitMs: DEFAULT_MATCH_RULES.timeLimitMs,
      goalLimit: 7
    });
  });

  it("resets match state when the connection is lost", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    const midMatch = reduceArcadeClientState(
      createInitialArcadeClientState(),
      { type: "world.snapshot", world }
    );

    expect(midMatch.phase).toBe("playing");
    expect(midMatch.currentWorld).not.toBeNull();

    // Server restart / network drop: the room is gone. The client must fall
    // back to the lobby, not keep rendering the last frozen snapshot.
    const afterLeave = reduceArcadeClientState(midMatch, {
      type: "connection.left",
      message: "Disconnected from room"
    });

    expect(afterLeave.connectionStatus).toBe("idle");
    expect(afterLeave.phase).toBe("waiting");
    expect(afterLeave.currentWorld).toBeNull();
    expect(afterLeave.previousWorld).toBeNull();
    expect(afterLeave.roster).toEqual([]);
    expect(afterLeave.error).toBe("Disconnected from room");
  });
});

function serverSlot(overrides: Partial<ServerRosterSlot>): ServerRosterSlot {
  return {
    slotId: "home-skater-1",
    teamId: "home",
    index: 0,
    kind: "human",
    sessionId: "session-a",
    playerName: "Ada",
    botId: null,
    characterId: "milo-ghost",
    isBot: false,
    isCaptain: true,
    ready: false,
    teamJoinOrder: 1,
    controlledGoalieId: null,
    ...overrides
  } as ServerRosterSlot;
}

function clientSlot(overrides: Partial<ClientRosterSlot>): ClientRosterSlot {
  return {
    ...serverSlot({}),
    displayName: "Ada",
    isOwnedByLocalPlayer: true,
    ...overrides
  } as ClientRosterSlot;
}

describe("goalie-control presentation state", () => {
  it("maps a slot's temporary goalie grant through room state", () => {
    const room = {
      sessionId: "session-a",
      state: {
        phase: "playing",
        teams: {
          home: {
            slots: [serverSlot({ controlledGoalieId: "home-goalie" })]
          },
          away: { slots: [] }
        }
      }
    } as unknown as ArcadeRoomConnection;

    const state = mapRoomState(room);

    expect(state.roster[0]).toMatchObject({
      slotId: "home-skater-1",
      isOwnedByLocalPlayer: true,
      controlledGoalieId: "home-goalie"
    });
  });

  it("keys the identity color under the goalie while a grant is held", () => {
    const roster = [
      clientSlot({ controlledGoalieId: "home-goalie" }),
      clientSlot({
        slotId: "home-skater-2",
        sessionId: "session-b",
        teamJoinOrder: 2,
        isOwnedByLocalPlayer: false
      }),
      clientSlot({
        slotId: "home-skater-3",
        kind: "bot",
        sessionId: null,
        isOwnedByLocalPlayer: false
      })
    ];

    const map = buildHighlightColorByEntityId(roster);

    // The grantee's disc moves to the goalie; their skater slot loses it.
    expect(map["home-goalie"]).toBe(PLAYER_HIGHLIGHT_COLORS[0]);
    expect(map["home-skater-1"]).toBeUndefined();
    // Other humans keep their skater discs; AI slots get nothing.
    expect(map["home-skater-2"]).toBe(PLAYER_HIGHLIGHT_COLORS[1]);
    expect(map["home-skater-3"]).toBeUndefined();
  });

  it("keeps a player's colour through a control switch", () => {
    // A switch rewrites two slots: the old one back to a bot, the new one to
    // the human. Only the slot ID moves — team and join order ride along.
    const before = buildHighlightColorByEntityId([
      clientSlot({ sessionId: "session-a", teamJoinOrder: 1 }),
      clientSlot({
        slotId: "home-skater-2",
        kind: "bot",
        sessionId: null,
        isOwnedByLocalPlayer: false
      })
    ]);
    const after = buildHighlightColorByEntityId([
      clientSlot({
        slotId: "home-skater-1",
        kind: "bot",
        sessionId: null,
        isOwnedByLocalPlayer: false
      }),
      clientSlot({ slotId: "home-skater-2", sessionId: "session-a", teamJoinOrder: 1 })
    ]);

    expect(after["home-skater-2"]).toBe(before["home-skater-1"]);
  });

  it("never repaints other players while a switch is half-applied", () => {
    // The two slot rewrites land as separate 50ms schema patches, so the
    // client really does observe a roster with the switcher missing. Under
    // the old index-based scheme that shifted everyone after them.
    const teammate = clientSlot({
      slotId: "away-skater-1",
      teamId: "away",
      sessionId: "session-b",
      teamJoinOrder: 1,
      isOwnedByLocalPlayer: false
    });
    const settled = buildHighlightColorByEntityId([
      clientSlot({ sessionId: "session-a", teamJoinOrder: 1 }),
      teammate
    ]);
    const midSwitch = buildHighlightColorByEntityId([teammate]);

    expect(midSwitch["away-skater-1"]).toBe(settled["away-skater-1"]);
  });

  it("gives the server's six globally ordered humans distinct colours", () => {
    // The server assigns one room-wide order (1..6), filling home before away.
    // This is deliberately not 1..3 per team: that unrealistic fixture hid the
    // regression where away orders 4, 5, and 6 all clamped to the same colour.
    const roster = Array.from({ length: 6 }, (_, index) => {
      const teamId = index < 3 ? "home" : "away";
      const teamSeat = (index % 3) + 1;

      return clientSlot({
        slotId: `${teamId}-skater-${teamSeat}`,
        teamId,
        sessionId: `session-${index + 1}`,
        teamJoinOrder: index + 1,
        isOwnedByLocalPlayer: false
      });
    });

    const colors = Object.values(buildHighlightColorByEntityId(roster));

    expect(colors).toHaveLength(6);
    expect(new Set(colors).size).toBe(6);
  });

  it("maps ready, join order, and room creator directly from the server", () => {
    const room = {
      sessionId: "session-a",
      state: {
        roomCreatorSessionId: "session-b",
        teams: {
          home: {
            slots: [
              serverSlot({ ready: true, teamJoinOrder: 4 }),
              serverSlot({
                slotId: "home-skater-2",
                sessionId: "session-b",
                ready: false,
                teamJoinOrder: null
              })
            ]
          },
          away: { slots: [] }
        }
      }
    } as unknown as ArcadeRoomConnection;

    const state = mapRoomState(room);

    expect(state.roomCreatorSessionId).toBe("session-b");
    expect(state.roster).toMatchObject([
      { slotId: "home-skater-1", ready: true, teamJoinOrder: 4 },
      { slotId: "home-skater-2", ready: false, teamJoinOrder: null }
    ]);
  });

  it("assigns identical rings across local sessions from shared join order", () => {
    const roster = [
      clientSlot({
        slotId: "home-skater-2",
        sessionId: "session-b",
        teamJoinOrder: 2,
        isOwnedByLocalPlayer: false
      }),
      clientSlot({
        slotId: "home-skater-1",
        sessionId: "session-a",
        teamJoinOrder: 1,
        isOwnedByLocalPlayer: true
      })
    ];

    const otherLocalSession = roster.map((slot) => ({
      ...slot,
      isOwnedByLocalPlayer: slot.sessionId === "session-b"
    }));

    const map = buildHighlightColorByEntityId(roster);

    expect(buildHighlightColorByEntityId(otherLocalSession)).toEqual(map);
    expect(map["home-skater-1"]).toBe(PLAYER_HIGHLIGHT_COLORS[0]);
    expect(map["home-skater-2"]).toBe(PLAYER_HIGHLIGHT_COLORS[1]);
  });
});

describe("mergeSnapshotEventQueue — reassembling the rolling event window", () => {
  function goalEvent(id: string, atMs: number) {
    return { id, type: "goal", atMs, sourceSlotId: "home-skater-1" };
  }

  function worldAt(nowMs: number, events: ReturnType<typeof goalEvent>[]) {
    const world = createWorld(1, "arcade3v3");
    world.time = { ...world.time, nowMs };
    world.eventQueue = events;
    return world;
  }

  it("carries retained events forward alongside newly arrived ones", () => {
    const merged = mergeSnapshotEventQueue(
      [goalEvent("older", 1_000)],
      worldAt(2_000, [goalEvent("newer", 2_000)])
    );

    expect(merged.map((event) => event.id)).toEqual(["older", "newer"]);
  });

  it("returns the incoming queue by reference when there is nothing to carry", () => {
    const world = worldAt(2_000, [goalEvent("only", 2_000)]);

    expect(mergeSnapshotEventQueue([], world)).toBe(world.eventQueue);
    expect(mergeSnapshotEventQueue(undefined, world)).toBe(world.eventQueue);
  });

  it("drops retained events once they age past the sim's retention window", () => {
    const merged = mergeSnapshotEventQueue(
      [goalEvent("ancient", 1_000)],
      worldAt(10_000, [])
    );

    expect(merged).toEqual([]);
  });

  it("dedupes by id so a redelivered event cannot fire its cues twice", () => {
    const merged = mergeSnapshotEventQueue(
      [goalEvent("goal-1", 1_900)],
      worldAt(2_000, [goalEvent("goal-1", 1_900)])
    );

    expect(merged.map((event) => event.id)).toEqual(["goal-1"]);
  });

  it("drops events from before a rematch reset the sim clock", () => {
    // Old match: event at 150s. Rematch: fresh world whose clock is back near zero. Carrying that
    // event forward would replay last match's goal horn into the new one.
    const merged = mergeSnapshotEventQueue(
      [goalEvent("stale-goal", 150_000)],
      worldAt(32, [])
    );

    expect(merged).toEqual([]);
  });

  it("the world.snapshot reducer accumulates events across snapshots", () => {
    const first = reduceArcadeClientState(createInitialArcadeClientState(), {
      type: "world.snapshot",
      world: worldAt(1_000, [goalEvent("goal-1", 1_000)])
    });
    const second = reduceArcadeClientState(first, {
      type: "world.snapshot",
      world: worldAt(1_032, [goalEvent("hit-1", 1_032)])
    });

    expect(second.currentWorld?.eventQueue.map((event) => event.id)).toEqual([
      "goal-1",
      "hit-1"
    ]);
    // previousWorld keeps ITS OWN merged queue from when it was current.
    expect(second.previousWorld?.eventQueue.map((event) => event.id)).toEqual([
      "goal-1"
    ]);
  });
});
