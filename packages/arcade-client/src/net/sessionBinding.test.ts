import { describe, expect, it, vi } from "vitest";
import {
  ArcadeRoomSession,
  type ArcadeConnectionResult,
  type ArcadeRoomConnection
} from "./client.js";
import { attachArcadeRoom, type ActiveRoomRef } from "./sessionBinding.js";

interface RoomCallbacks {
  onStateChange?: () => void;
  onError?: (code: number, message?: string) => void;
  onLeave?: (code: number) => void;
  onServerError?: (message: { readonly message?: string }) => void;
}

function fakeConnectionResult(sessionId: string): {
  readonly callbacks: RoomCallbacks;
  readonly result: ArcadeConnectionResult;
  readonly room: ArcadeRoomConnection;
} {
  const callbacks: RoomCallbacks = {};
  const room: ArcadeRoomConnection = {
    sessionId,
    state: {},
    onStateChange: vi.fn((callback: () => void) => {
      callbacks.onStateChange = callback;
    }),
    onError: vi.fn((callback: (code: number, message?: string) => void) => {
      callbacks.onError = callback;
    }),
    onLeave: vi.fn((callback: (code: number) => void) => {
      callbacks.onLeave = callback;
    }),
    onMessage: vi.fn(
      <TMessage,>(
        type: string,
        callback: (message: TMessage) => void
      ) => {
        if (type === "server.error") {
          callbacks.onServerError = callback as (
            message: { readonly message?: string }
          ) => void;
        }
      }
    ),
    removeAllListeners: vi.fn(),
    leave: vi.fn(),
    send: vi.fn()
  };

  return {
    callbacks,
    result: {
      connection: new ArcadeRoomSession(room),
      room
    },
    room
  };
}

describe("attachArcadeRoom", () => {
  it("cleans up the previous room and ignores stale callbacks", () => {
    const activeRoomRef: ActiveRoomRef = { current: null };
    const first = fakeConnectionResult("session-a");
    const second = fakeConnectionResult("session-b");
    const handlers = {
      onState: vi.fn(),
      onError: vi.fn(),
      onLeave: vi.fn()
    };

    attachArcadeRoom(activeRoomRef, first.result, handlers);
    attachArcadeRoom(activeRoomRef, second.result, handlers);

    expect(first.room.removeAllListeners).toHaveBeenCalledOnce();
    expect(first.room.leave).toHaveBeenCalledOnce();
    expect(handlers.onState).toHaveBeenCalledTimes(2);

    first.callbacks.onStateChange?.();
    first.callbacks.onError?.(4000, "stale error");
    first.callbacks.onLeave?.(1000);

    expect(handlers.onState).toHaveBeenCalledTimes(2);
    expect(handlers.onError).not.toHaveBeenCalled();
    expect(handlers.onLeave).not.toHaveBeenCalled();

    second.callbacks.onStateChange?.();

    expect(handlers.onState).toHaveBeenCalledTimes(3);
  });

  it("routes server error messages from the active room", () => {
    const activeRoomRef: ActiveRoomRef = { current: null };
    const current = fakeConnectionResult("session-a");
    const handlers = {
      onState: vi.fn(),
      onError: vi.fn(),
      onLeave: vi.fn()
    };

    attachArcadeRoom(activeRoomRef, current.result, handlers);
    current.callbacks.onServerError?.({ message: "room not ready" });

    expect(current.room.onMessage).toHaveBeenCalledWith(
      "server.error",
      expect.any(Function)
    );
    expect(handlers.onError).toHaveBeenCalledWith("room not ready");
  });
});
