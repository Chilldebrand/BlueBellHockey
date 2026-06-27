import {
  createWorld,
  MATCH_CONFIG,
  stepWorld,
  type ArcadeServerMessage,
  type MatchMode,
  type ServerWorldSnapshotMessage,
  type WorldState
} from "@bbh/arcade-core";
import { Room, type Client } from "colyseus";
import {
  applyRosterToState,
  createInitialRoomState,
  type ArcadeRoomState
} from "./schema.js";
import {
  assignHumanToOpenSlot,
  createRoster,
  fillRosterWithBots,
  moveHumanToTeam,
  releaseHuman,
  type RoomRosterSlot
} from "./roster.js";

export interface ArcadeRoomOptions {
  readonly privateCode?: string;
  readonly quickMatch?: boolean;
  readonly mode?: MatchMode;
}

export type NormalizedArcadeRoomOptions = Required<ArcadeRoomOptions>;

export interface ArcadeRoomDependencies {
  readonly seedGenerator?: () => number;
  readonly startSimulation?: boolean;
}

interface JoinOptions {
  readonly playerName?: string;
}

interface ChooseTeamMessage {
  readonly teamId?: string;
}

type StoredArcadeRoomOptions = {
  -readonly [Key in keyof NormalizedArcadeRoomOptions]: NormalizedArcadeRoomOptions[Key];
};

const DEFAULT_MODE: MatchMode = "arcade3v3";

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
}

function normalizeRoomCode(code: string): string {
  const normalized = code.trim().toUpperCase();

  if (!normalized) {
    throw new Error("privateCode must not be empty");
  }

  return normalized;
}

export class ArcadeRoom extends Room<ArcadeRoomState> {
  maxClients = 6;

  readonly roomOptions: StoredArcadeRoomOptions;
  private readonly seedGenerator: () => number;
  private readonly startSimulation: boolean;
  private roster: RoomRosterSlot[] = createRoster();
  private world: WorldState | null = null;

  constructor(dependencies: ArcadeRoomDependencies = {}) {
    super();
    this.seedGenerator = dependencies.seedGenerator ?? (() => 1);
    this.startSimulation = dependencies.startSimulation ?? true;
    this.roomOptions = {
      privateCode: "",
      quickMatch: true,
      mode: DEFAULT_MODE
    };
  }

  static override async onAuth(
    _token: string,
    options: ArcadeRoomOptions
  ): Promise<unknown> {
    Object.assign(options, normalizeArcadeRoomOptions(options));
    return true;
  }

  onCreate(options: ArcadeRoomOptions = {}): void {
    const { privateCode, quickMatch, mode } = normalizeArcadeRoomOptions(options);

    this.roomOptions.privateCode = privateCode;
    this.roomOptions.quickMatch = quickMatch;
    this.roomOptions.mode = mode;

    this.roster = fillRosterWithBots(createRoster());
    this.world = createWorld(this.seedGenerator(), mode);
    this.setState(
      createInitialRoomState({
        privateCode,
        mode
      })
    );
    this.syncRoomMetadata();
    this.syncStateFromWorld();
    this.syncRosterState();
    this.onMessage("client.chooseTeam", (client, message: unknown) => {
      this.handleChooseTeam(client, message);
    });
    this.onMessage("client.requestStart", (client) => {
      this.handleRequestStart(client);
    });

    if (this.startSimulation) {
      this.setSimulationInterval(
        (deltaTime) => this.tick(deltaTime),
        MATCH_CONFIG.fixedTickMs
      );
    }
  }

  onJoin(client: Client, options: JoinOptions = {}): void {
    assignHumanToOpenSlot(this.roster, {
      sessionId: client.sessionId,
      playerName: options.playerName
    });
    fillRosterWithBots(this.roster);
    this.syncRosterState();
  }

  onLeave(client: Client): void {
    releaseHuman(this.roster, client.sessionId);
    fillRosterWithBots(this.roster);
    this.syncRosterState();
  }

  tick(dtMs = MATCH_CONFIG.fixedTickMs): void {
    if (!this.world) {
      return;
    }

    this.world = stepWorld(this.world, [], dtMs);
    this.syncStateFromWorld();
    this.broadcastSnapshot();
  }

  private syncStateFromWorld(): void {
    if (!this.world || !this.state) {
      return;
    }

    this.state.phase = this.world.phase;
    this.state.score.home = this.world.score.home;
    this.state.score.away = this.world.score.away;
    this.state.clock.nowMs = this.world.time.nowMs;
    this.state.clock.tick = this.world.time.tick;
    this.state.clock.fixedTickMs = this.world.time.fixedTickMs;
  }

  private syncRoomMetadata(): void {
    if (!this.listing) {
      return;
    }

    void this.setMetadata({
      privateCode: this.roomOptions.privateCode,
      mode: this.roomOptions.mode,
      quickMatch: this.roomOptions.quickMatch
    });
  }

  private syncRosterState(): void {
    if (!this.state) {
      return;
    }

    applyRosterToState(this.state, this.roster);
    this.state.isRosterValid = this.roster.every((slot) => slot.kind !== "open");
  }

  private handleChooseTeam(client: Client, message: unknown): void {
    const teamId = getRequestedTeamId(message);

    if (teamId !== "home" && teamId !== "away") {
      this.send(client, "server.error", { message: "Invalid team." });
      return;
    }

    moveHumanToTeam(this.roster, client.sessionId, teamId);
    fillRosterWithBots(this.roster);
    this.syncRosterState();
  }

  private handleRequestStart(client: Client): void {
    if (!this.world || !this.state.isRosterValid) {
      this.send(client, "server.error", { message: "Roster is not ready." });
      return;
    }

    if (this.world.phase !== "waiting") {
      return;
    }

    this.world.phase = "playing";
    this.syncStateFromWorld();
  }

  private broadcastSnapshot(): void {
    if (!this.world) {
      return;
    }

    const message: ServerWorldSnapshotMessage = {
      type: "server.worldSnapshot",
      world: this.world
    };

    this.broadcast("server.worldSnapshot", message satisfies ArcadeServerMessage);
  }
}

export function createPrivateRoomCode(codeGenerator = generateRoomCode): string {
  return normalizeRoomCode(codeGenerator());
}

export function normalizeArcadeRoomOptions(
  options: ArcadeRoomOptions = {}
): NormalizedArcadeRoomOptions {
  return {
    privateCode:
      options.privateCode === undefined
        ? ""
        : normalizeRoomCode(options.privateCode),
    quickMatch: options.quickMatch ?? true,
    mode: options.mode ?? DEFAULT_MODE
  };
}

function getRequestedTeamId(message: unknown): ChooseTeamMessage["teamId"] {
  if (!message || typeof message !== "object" || !("teamId" in message)) {
    return undefined;
  }

  return (message as ChooseTeamMessage).teamId;
}
