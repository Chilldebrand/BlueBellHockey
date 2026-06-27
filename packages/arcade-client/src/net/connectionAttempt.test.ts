import { describe, expect, it, vi } from "vitest";
import { ArcadeRoomSession, type ArcadeRoomConnection } from "./client.js";
import {
  disposeStaleConnection,
  isCurrentConnectionAttempt,
  startConnectionAttempt
} from "./connectionAttempt.js";

function fakeRoom(): ArcadeRoomConnection {
  return {
    sessionId: "session-a",
    state: {},
    onStateChange: vi.fn(),
    onError: vi.fn(),
    onLeave: vi.fn(),
    removeAllListeners: vi.fn(),
    leave: vi.fn(),
    send: vi.fn()
  };
}

describe("connection attempts", () => {
  it("only treats the most recent attempt as current", () => {
    const ref = { current: 0 };
    const first = startConnectionAttempt(ref);
    const second = startConnectionAttempt(ref);

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(isCurrentConnectionAttempt(ref, first)).toBe(false);
    expect(isCurrentConnectionAttempt(ref, second)).toBe(true);
  });

  it("disposes stale rooms that resolve after a newer attempt starts", () => {
    const room = fakeRoom();

    disposeStaleConnection({
      connection: new ArcadeRoomSession(room),
      room
    });

    expect(room.removeAllListeners).toHaveBeenCalledOnce();
    expect(room.leave).toHaveBeenCalledOnce();
  });
});
