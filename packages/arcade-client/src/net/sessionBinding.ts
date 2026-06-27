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

  handlers.onState(result);
  result.room.onStateChange(() => {
    if (isCurrentRoom()) {
      handlers.onState(result);
    }
  });
  result.room.onError((_code, message) => {
    if (isCurrentRoom()) {
      handlers.onError(message || "Connection error");
    }
  });
  result.room.onMessage?.("server.error", (message) => {
    if (isCurrentRoom()) {
      handlers.onError(message.message || "Room error");
    }
  });
  result.room.onLeave(() => {
    if (isCurrentRoom()) {
      handlers.onLeave("Disconnected from room");
    }
  });
}
