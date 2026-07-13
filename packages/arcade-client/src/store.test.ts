import { describe, expect, it } from "vitest";
import { createWorld } from "@bbh/arcade-core";
import {
  createInitialArcadeClientState,
  reduceArcadeClientState
} from "./store.js";

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
