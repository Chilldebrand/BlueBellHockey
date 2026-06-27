import type { InputFrame, WorldState } from "../sim/types.js";

export interface ClientInputMessage {
  readonly type: "client.input";
  readonly frame: InputFrame;
}

export interface ServerWorldSnapshotMessage {
  readonly type: "server.worldSnapshot";
  readonly world: WorldState;
}

export type ArcadeClientMessage = ClientInputMessage;

export type ArcadeServerMessage = ServerWorldSnapshotMessage;
