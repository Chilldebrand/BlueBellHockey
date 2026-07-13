import { describe, expect, it, vi } from "vitest";
import type { ServerWorldSnapshotMessage } from "@bbh/arcade-core";
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
  onWorldSnapshot?: (message: ServerWorldSnapshotMessage) => void;
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
        if (type === "server.worldSnapshot") {
          callbacks.onWorldSnapshot = callback as (
            message: ServerWorldSnapshotMessage
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

/** Old synchronous delivery semantics for the non-coalescing behaviors. */
const flushImmediately = (flush: () => void) => flush();

describe("attachArcadeRoom", () => {
  it("cleans up the previous room and ignores stale callbacks", () => {
    const activeRoomRef: ActiveRoomRef = { current: null };
    const first = fakeConnectionResult("session-a");
    const second = fakeConnectionResult("session-b");
    const handlers = {
      onState: vi.fn(),
      onError: vi.fn(),
      onLeave: vi.fn(),
      scheduleFlush: flushImmediately
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
      onLeave: vi.fn(),
      scheduleFlush: flushImmediately
    };

    attachArcadeRoom(activeRoomRef, current.result, handlers);
    current.callbacks.onServerError?.({ message: "room not ready" });

    expect(current.room.onMessage).toHaveBeenCalledWith(
      "server.error",
      expect.any(Function)
    );
    expect(handlers.onError).toHaveBeenCalledWith("room not ready");
  });

  it("coalesces a snapshot burst into one delivery of the latest world", () => {
    const activeRoomRef: ActiveRoomRef = { current: null };
    const current = fakeConnectionResult("session-a");
    const flushes: (() => void)[] = [];
    const handlers = {
      onState: vi.fn(),
      onError: vi.fn(),
      onLeave: vi.fn(),
      onWorldSnapshot: vi.fn(),
      scheduleFlush: (flush: () => void) => {
        flushes.push(flush);
      }
    };

    attachArcadeRoom(activeRoomRef, current.result, handlers);

    // Three snapshots arrive before the next frame: only ONE flush is
    // scheduled and only the FRESHEST world is delivered.
    const snapshot = (tick: number) =>
      ({
        type: "server.worldSnapshot",
        world: { time: { tick } },
        inputAcks: { "home-skater-1": tick }
      }) as unknown as ServerWorldSnapshotMessage;
    current.callbacks.onWorldSnapshot?.(snapshot(1));
    current.callbacks.onWorldSnapshot?.(snapshot(2));
    current.callbacks.onWorldSnapshot?.(snapshot(3));

    expect(flushes).toHaveLength(1);
    expect(handlers.onWorldSnapshot).not.toHaveBeenCalled();

    flushes[0]();

    expect(handlers.onWorldSnapshot).toHaveBeenCalledTimes(1);
    expect(handlers.onWorldSnapshot).toHaveBeenCalledWith(
      { time: { tick: 3 } },
      { "home-skater-1": 3 }
    );

    // The next snapshot after a flush schedules a fresh one.
    current.callbacks.onWorldSnapshot?.(snapshot(4));
    expect(flushes).toHaveLength(2);
  });

  it("coalesces state patch bursts into one onState per flush", () => {
    const activeRoomRef: ActiveRoomRef = { current: null };
    const current = fakeConnectionResult("session-a");
    const flushes: (() => void)[] = [];
    const handlers = {
      onState: vi.fn(),
      onError: vi.fn(),
      onLeave: vi.fn(),
      scheduleFlush: (flush: () => void) => {
        flushes.push(flush);
      }
    };

    attachArcadeRoom(activeRoomRef, current.result, handlers);
    expect(handlers.onState).toHaveBeenCalledTimes(1); // initial sync delivery

    current.callbacks.onStateChange?.();
    current.callbacks.onStateChange?.();
    current.callbacks.onStateChange?.();

    expect(flushes).toHaveLength(1);
    expect(handlers.onState).toHaveBeenCalledTimes(1);

    flushes[0]();

    expect(handlers.onState).toHaveBeenCalledTimes(2);
  });

  it("drops a pending coalesced snapshot when the room is switched", () => {
    const activeRoomRef: ActiveRoomRef = { current: null };
    const first = fakeConnectionResult("session-a");
    const second = fakeConnectionResult("session-b");
    const flushes: (() => void)[] = [];
    const handlers = {
      onState: vi.fn(),
      onError: vi.fn(),
      onLeave: vi.fn(),
      onWorldSnapshot: vi.fn(),
      scheduleFlush: (flush: () => void) => {
        flushes.push(flush);
      }
    };

    attachArcadeRoom(activeRoomRef, first.result, handlers);
    first.callbacks.onWorldSnapshot?.({
      type: "server.worldSnapshot",
      world: { time: { tick: 1 } }
    } as unknown as ServerWorldSnapshotMessage);

    // The room is replaced before the frame fires: the stale flush must not
    // deliver the old room's world.
    attachArcadeRoom(activeRoomRef, second.result, handlers);
    flushes[0]();

    expect(handlers.onWorldSnapshot).not.toHaveBeenCalled();
  });
});
