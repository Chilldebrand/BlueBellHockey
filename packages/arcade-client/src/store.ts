import type {
  CharacterId,
  TeamId,
  WorldPhase,
  WorldState
} from "@bbh/arcade-core";
import type { ArcadeRoomConnection } from "./net/client.js";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";
export type RosterSlotKind = "open" | "human" | "bot";

export interface ArcadeScore {
  readonly home: number;
  readonly away: number;
}

export interface ServerRosterSlot {
  readonly slotId: string;
  readonly teamId: TeamId;
  readonly index: number;
  readonly kind: RosterSlotKind;
  readonly sessionId: string | null;
  readonly playerName: string | null;
  readonly botId: string | null;
  readonly characterId: CharacterId;
  readonly isBot: boolean;
}

export interface ClientRosterSlot extends ServerRosterSlot {
  readonly displayName: string;
  readonly isOwnedByLocalPlayer: boolean;
}

export interface ArcadeClientState {
  readonly connectionStatus: ConnectionStatus;
  readonly roomCode: string;
  readonly playerSessionId: string | null;
  readonly roster: readonly ClientRosterSlot[];
  readonly score: ArcadeScore;
  readonly phase: WorldPhase;
  readonly isRosterValid: boolean;
  readonly currentWorld: WorldState | null;
  readonly previousWorld: WorldState | null;
  /** Per-slot last input sequence the server sim has applied (prediction). */
  readonly inputAcks: Readonly<Record<string, number>>;
  readonly error: string | null;
}

export interface ServerRoomState {
  readonly phase?: WorldPhase;
  readonly privateCode?: string;
  readonly score?: Partial<ArcadeScore>;
  readonly isRosterValid?: boolean;
  readonly teams?: {
    readonly home?: { readonly slots?: Iterable<ServerRosterSlot> };
    readonly away?: { readonly slots?: Iterable<ServerRosterSlot> };
  };
}

export type ArcadeClientAction =
  | { readonly type: "connection.start" }
  | { readonly type: "room.state"; readonly room: ArcadeRoomConnection }
  | {
      readonly type: "world.snapshot";
      readonly world: WorldState;
      readonly inputAcks?: Readonly<Record<string, number>>;
    }
  | { readonly type: "connection.error"; readonly message: string }
  | { readonly type: "connection.left"; readonly message?: string };

const INITIAL_SCORE: ArcadeScore = { home: 0, away: 0 };

export function createInitialArcadeClientState(): ArcadeClientState {
  return {
    connectionStatus: "idle",
    roomCode: "",
    playerSessionId: null,
    roster: [],
    score: INITIAL_SCORE,
    phase: "waiting",
    isRosterValid: false,
    currentWorld: null,
    previousWorld: null,
    inputAcks: {},
    error: null
  };
}

export function reduceArcadeClientState(
  state: ArcadeClientState,
  action: ArcadeClientAction
): ArcadeClientState {
  switch (action.type) {
    case "connection.start":
      return { ...state, connectionStatus: "connecting", error: null };
    case "room.state":
      return {
        ...mapRoomState(action.room),
        currentWorld: state.currentWorld,
        previousWorld: state.previousWorld,
        inputAcks: state.inputAcks
      };
    case "world.snapshot":
      return {
        ...state,
        phase: action.world.phase,
        score: action.world.score,
        previousWorld: state.currentWorld,
        currentWorld: action.world,
        inputAcks: action.inputAcks ?? state.inputAcks
      };
    case "connection.error":
      return { ...state, connectionStatus: "error", error: action.message };
    case "connection.left":
      return {
        ...state,
        connectionStatus: "idle",
        error: action.message ?? state.error
      };
    default:
      return state;
  }
}

export function mapRoomState(room: ArcadeRoomConnection): ArcadeClientState {
  const serverState = room.state;
  const score = serverState.score ?? INITIAL_SCORE;
  const roster = [
    ...Array.from(serverState.teams?.home?.slots ?? []),
    ...Array.from(serverState.teams?.away?.slots ?? [])
  ].map((slot) => mapRosterSlot(slot, room.sessionId));

  return {
    connectionStatus: "connected",
    roomCode: serverState.privateCode ?? "",
    playerSessionId: room.sessionId,
    roster,
    score: {
      home: score.home ?? 0,
      away: score.away ?? 0
    },
    phase: serverState.phase ?? "waiting",
    isRosterValid: serverState.isRosterValid ?? false,
    currentWorld: null,
    previousWorld: null,
    inputAcks: {},
    error: null
  };
}

function mapRosterSlot(
  slot: ServerRosterSlot,
  localSessionId: string | null
): ClientRosterSlot {
  return {
    ...slot,
    displayName:
      slot.kind === "human" ? slot.playerName?.trim() || "Player" : "Bot",
    isOwnedByLocalPlayer:
      slot.kind === "human" && slot.sessionId === localSessionId
  };
}
