import { describe, expect, it } from "vitest";
import { createWorld } from "@bbh/arcade-core";
import {
  buildHighlightColorByEntityId,
  createInitialArcadeClientState,
  mapRoomState,
  PLAYER_HIGHLIGHT_COLORS,
  reduceArcadeClientState,
  type ClientRosterSlot,
  type ServerRosterSlot
} from "./store.js";
import type { ArcadeRoomConnection } from "./net/client.js";

describe("reduceArcadeClientState", () => {
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

  it("always colors the local player first (blue on their own screen)", () => {
    const roster = [
      clientSlot({
        slotId: "home-skater-2",
        sessionId: "session-b",
        isOwnedByLocalPlayer: false
      }),
      clientSlot({ slotId: "home-skater-1", sessionId: "session-a" })
    ];

    const map = buildHighlightColorByEntityId(roster);

    expect(map["home-skater-1"]).toBe(PLAYER_HIGHLIGHT_COLORS[0]);
    expect(map["home-skater-2"]).toBe(PLAYER_HIGHLIGHT_COLORS[1]);
  });
});
