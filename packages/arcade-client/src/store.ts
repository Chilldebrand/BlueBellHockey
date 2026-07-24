import type {
  CharacterId,
  MatchRules,
  TeamId,
  WorldPhase,
  WorldState
} from "@bbh/arcade-core";
import { DEFAULT_MATCH_RULES } from "@bbh/arcade-core";
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
  readonly isCaptain: boolean;
  readonly ready: boolean;
  readonly teamJoinOrder: number | null;
  /**
   * Temporary goalie-control grant: while this human's team goalie covers the
   * puck, their input drives that goalie. Null for everyone else. The local
   * client derives its active entity as `controlledGoalieId ?? slotId`.
   * Optional on the wire for tolerance; mapRosterSlot normalizes to null.
   */
  readonly controlledGoalieId?: string | null;
  /**
   * Postgame rematch vote for this slot. Optional on the wire for tolerance;
   * mapRosterSlot normalizes to false.
   */
  readonly votedRematch?: boolean;
}

export interface ClientRosterSlot extends ServerRosterSlot {
  readonly displayName: string;
  readonly isOwnedByLocalPlayer: boolean;
  readonly controlledGoalieId: string | null;
  readonly votedRematch: boolean;
}

export interface ArcadeClientState {
  readonly connectionStatus: ConnectionStatus;
  readonly roomCode: string;
  readonly playerSessionId: string | null;
  readonly roomCreatorSessionId: string | null;
  readonly rules: MatchRules;
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
  readonly roomCreatorSessionId?: string | null;
  readonly rules?: Partial<MatchRules>;
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
    roomCreatorSessionId: null,
    rules: { ...DEFAULT_MATCH_RULES },
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
      // The room is gone (server restart, network drop, dispose) — reset
      // everything, not just the status flag. Keeping the last world/phase
      // left the client rendering a frozen match with no way back.
      return {
        ...createInitialArcadeClientState(),
        error: action.message ?? state.error
      };
    default:
      return state;
  }
}

export function mapRoomState(room: ArcadeRoomConnection): ArcadeClientState {
  const serverState = room.state;
  const score = serverState.score ?? INITIAL_SCORE;
  const rules = {
    timeLimitMs:
      serverState.rules?.timeLimitMs ?? DEFAULT_MATCH_RULES.timeLimitMs,
    goalLimit: serverState.rules?.goalLimit ?? DEFAULT_MATCH_RULES.goalLimit
  };
  const roster = [
    ...Array.from(serverState.teams?.home?.slots ?? []),
    ...Array.from(serverState.teams?.away?.slots ?? [])
  ].map((slot) => mapRosterSlot(slot, room.sessionId));

  return {
    connectionStatus: "connected",
    roomCode: serverState.privateCode ?? "",
    playerSessionId: room.sessionId,
    roomCreatorSessionId: serverState.roomCreatorSessionId ?? null,
    rules,
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
    controlledGoalieId: slot.controlledGoalieId ?? null,
    votedRematch: slot.votedRematch ?? false,
    displayName:
      slot.kind === "human" ? slot.playerName?.trim() || "Player" : "Bot",
    isOwnedByLocalPlayer:
      slot.kind === "human" && slot.sessionId === localSessionId
  };
}

/**
 * Identity colors for humans, assigned by the server's shared join order.
 */
export const PLAYER_HIGHLIGHT_COLORS = [
  "#1f8fff", // blue — first shared human roster position
  "#ff4f5e", // red
  "#3dfc9d", // green
  "#ffdf6e", // yellow
  "#ff9e3d", // orange
  "#c479ff" // purple
];

/**
 * Human identity color per CURRENTLY-controlled entity. Keys are slot IDs —
 * so a Madden control switch moves the disc with the human automatically —
 * except while a human holds a temporary goalie grant, when their color keys
 * under the goalie ID instead (disc and camera follow the goalie). AI slots
 * aren't in the map = no disc.
 */
export function buildHighlightColorByEntityId(
  roster: readonly ClientRosterSlot[]
): Record<string, string> {
  const humans = roster.filter(
    (slot) => slot.kind === "human" && slot.sessionId
  );
  const ordered = [...humans].sort((a, b) => {
    const byJoinOrder =
      (a.teamJoinOrder ?? Number.POSITIVE_INFINITY) -
      (b.teamJoinOrder ?? Number.POSITIVE_INFINITY);
    return byJoinOrder || a.slotId.localeCompare(b.slotId);
  });
  const map: Record<string, string> = {};
  ordered.forEach((slot, index) => {
    const color = PLAYER_HIGHLIGHT_COLORS[index % PLAYER_HIGHLIGHT_COLORS.length];
    if (color) {
      map[slot.controlledGoalieId ?? slot.slotId] = color;
    }
  });
  return map;
}
