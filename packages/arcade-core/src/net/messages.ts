import type { InputFrame, WorldState } from "../sim/types.js";

export interface ClientInputMessage {
  readonly type: "client.input";
  readonly frame: InputFrame;
}

export interface ServerWorldSnapshotMessage {
  readonly type: "server.worldSnapshot";
  readonly world: WorldState;
  /**
   * Last input sequence the simulation has applied, per skater slot. The
   * client re-simulates its buffered unacknowledged frames on top of the
   * snapshot so local movement and stickhandling stay latency-free.
   */
  readonly inputAcks?: Readonly<Record<string, number>>;
}

export type ArcadeClientMessage = ClientInputMessage;

export type ArcadeServerMessage = ServerWorldSnapshotMessage;

/**
 * Websocket close code the server uses when the room creator kicks a player.
 * Shared so the client can distinguish "removed by host" from a generic drop
 * (and clear its reconnect ticket instead of trying to rejoin).
 */
export const KICKED_CLOSE_CODE = 4102;
