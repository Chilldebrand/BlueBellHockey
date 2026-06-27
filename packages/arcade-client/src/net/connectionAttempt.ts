import type { ArcadeConnectionResult } from "./client.js";

export interface ConnectionAttemptRef {
  current: number;
}

export function startConnectionAttempt(ref: ConnectionAttemptRef): number {
  ref.current += 1;
  return ref.current;
}

export function isCurrentConnectionAttempt(
  ref: ConnectionAttemptRef,
  attempt: number
): boolean {
  return ref.current === attempt;
}

export function disposeStaleConnection(result: ArcadeConnectionResult): void {
  result.room.removeAllListeners?.();
  void result.connection.leave();
}
