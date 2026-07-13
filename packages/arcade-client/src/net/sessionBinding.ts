import type { ServerWorldSnapshotMessage, WorldState } from "@bbh/arcade-core";
import type { ArcadeConnectionResult, ArcadeRoomSession } from "./client.js";

export interface ActiveRoomSubscription {
  readonly token: symbol;
  readonly session: ArcadeRoomSession;
}

export interface ActiveRoomRef {
  current: ActiveRoomSubscription | null;
}

export interface ArcadeRoomEventHandlers {
  readonly onState: (result: ArcadeConnectionResult) => void;
  readonly onError: (message: string) => void;
  readonly onLeave: (message: string) => void;
  readonly onWorldSnapshot?: (
    world: WorldState,
    inputAcks?: Readonly<Record<string, number>>
  ) => void;
  /**
   * Scheduler used to coalesce snapshot/state deliveries (default:
   * requestAnimationFrame). Injectable for tests.
   */
  readonly scheduleFlush?: (flush: () => void) => void;
}

/**
 * One flush per animation frame, keeping only the LATEST value queued while
 * a flush is pending. The server streams world snapshots per sim tick
 * (62.5/s) and schema patches besides — dispatching each into React forced
 * 120+ full re-renders a second, far past what the display can show, and was
 * measured as the dominant client CPU cost of online play. Rendering only
 * ever wants the freshest snapshot, so the intermediate ones are pure waste.
 */
function coalesced<TValue>(
  schedule: (flush: () => void) => void,
  deliver: (value: TValue) => void
): (value: TValue) => void {
  let pending: { value: TValue } | null = null;

  return (value) => {
    const flushScheduled = pending !== null;
    pending = { value };

    if (flushScheduled) {
      return;
    }

    schedule(() => {
      const latest = pending;
      pending = null;

      if (latest) {
        deliver(latest.value);
      }
    });
  };
}

function scheduleAnimationFrame(flush: () => void): void {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => flush());
  } else {
    flush();
  }
}

export function attachArcadeRoom(
  activeRoomRef: ActiveRoomRef,
  result: ArcadeConnectionResult,
  handlers: ArcadeRoomEventHandlers
): void {
  const token = Symbol("arcade-room");
  activeRoomRef.current?.session.room.removeAllListeners?.();
  void activeRoomRef.current?.session.leave();
  activeRoomRef.current = {
    token,
    session: result.connection
  };

  const isCurrentRoom = () => activeRoomRef.current?.token === token;
  const schedule = handlers.scheduleFlush ?? scheduleAnimationFrame;

  const deliverState = coalesced<ArcadeConnectionResult>(schedule, (latest) => {
    if (isCurrentRoom()) {
      handlers.onState(latest);
    }
  });
  const deliverSnapshot = coalesced<ServerWorldSnapshotMessage>(
    schedule,
    (message) => {
      if (isCurrentRoom()) {
        handlers.onWorldSnapshot?.(message.world, message.inputAcks);
      }
    }
  );

  // The initial state is delivered synchronously: the caller needs the
  // connected UI (lobby) immediately, not a frame later.
  handlers.onState(result);
  result.room.onStateChange(() => {
    if (isCurrentRoom()) {
      deliverState(result);
    }
  });
  result.room.onError((_code, message) => {
    if (isCurrentRoom()) {
      handlers.onError(message || "Connection error");
    }
  });
  result.room.onMessage?.<{ readonly message?: string }>("server.error", (message) => {
    if (isCurrentRoom()) {
      handlers.onError(message.message || "Room error");
    }
  });
  result.room.onMessage?.<ServerWorldSnapshotMessage>(
    "server.worldSnapshot",
    (message) => {
      if (isCurrentRoom()) {
        deliverSnapshot(message);
      }
    }
  );
  result.room.onLeave(() => {
    if (isCurrentRoom()) {
      handlers.onLeave("Disconnected from room");
    }
  });
}
