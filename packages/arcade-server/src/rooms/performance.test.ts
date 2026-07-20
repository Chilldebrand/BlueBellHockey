import { MATCH_CONFIG } from "@bbh/arcade-core";
import { describe, expect, it, vi } from "vitest";
import { ArcadeRoom } from "./ArcadeRoom.js";

function client(sessionId: string): { readonly sessionId: string } {
  return { sessionId };
}

describe("arcade room tick budget smoke", () => {
  it("steps a solo-player bot-filled room through sustained fixed ticks", () => {
    const room = new ArcadeRoom({ startSimulation: false });
    const onMessage = vi.spyOn(room, "onMessage");
    vi.spyOn(room, "broadcast").mockImplementation(() => room as never);
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ada" });
    const startHandler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.requestStart"
    )?.[1];
    const setReady = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.setReady"
    )?.[1];

    setReady?.(client("session-a") as never, { ready: true });
    startHandler?.(client("session-a") as never, undefined);
    for (let i = 0; i < 600; i += 1) {
      room.tick(MATCH_CONFIG.fixedTickMs);
    }

    expect(room.state.phase).toBe("playing");
    expect(room.state.clock.tick).toBe(600);
    expect(room.state.clock.nowMs).toBe(600 * MATCH_CONFIG.fixedTickMs);
  });
});
