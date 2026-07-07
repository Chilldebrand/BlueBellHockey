import {
  createBotInputFrame,
  createWorld,
  MATCH_CONFIG,
  resolveManualSwitchTarget,
  resolveReceptionSwitch,
  resolveTeamPossessionSwitch,
  stepWorld,
  type ArcadeServerMessage,
  type ClientInputMessage,
  type InputFrame,
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
  applyRosterCharactersToWorld,
  assignHumanToOpenSlot,
  createRoster,
  fillRosterWithBots,
  moveHumanToTeam,
  InvalidCharacterSelectionError,
  releaseHuman,
  selectCharacterForSession,
  selectCharacterForSlot,
  switchHumanControl,
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

interface ChooseCharacterMessage {
  readonly characterId?: string;
}

type StoredArcadeRoomOptions = {
  -readonly [Key in keyof NormalizedArcadeRoomOptions]: NormalizedArcadeRoomOptions[Key];
};

const DEFAULT_MODE: MatchMode = "arcade3v3";
const MAX_SIMULATION_STEPS_PER_TICK = 5;

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
  private readonly latestInputBySession = new Map<string, InputFrame>();
  private readonly lastInputSequenceBySession = new Map<string, number>();
  private readonly lastSwitchTargetBySession = new Map<string, boolean>();
  private readonly lastPassBySession = new Map<string, boolean>();
  private readonly pendingManualSwitchBySession = new Map<string, boolean>();
  private accumulatedTickMs = 0;
  private botInputSequence = 0;
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
    applyRosterCharactersToWorld(this.world, this.roster);
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
    this.onMessage("client.chooseCharacter", (client, message: unknown) => {
      this.handleChooseCharacter(client, message);
    });
    this.onMessage("client.chooseCharacterFor", (client, message: unknown) => {
      this.handleChooseCharacterFor(client, message);
    });
    this.onMessage("client.requestStart", (client) => {
      this.handleRequestStart(client);
    });
    this.onMessage("client.rematch", () => {
      this.handleRematch();
    });
    this.onMessage("client.backToLobby", () => {
      this.handleBackToLobby();
    });
    this.onMessage("client.input", (client, message: unknown) => {
      this.handleInput(client, message);
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
    this.latestInputBySession.delete(client.sessionId);
    this.lastInputSequenceBySession.delete(client.sessionId);
    this.lastSwitchTargetBySession.delete(client.sessionId);
    this.lastPassBySession.delete(client.sessionId);
    this.pendingManualSwitchBySession.delete(client.sessionId);
    fillRosterWithBots(this.roster);
    this.syncRosterState();
  }

  tick(dtMs = MATCH_CONFIG.fixedTickMs): void {
    if (!this.world) {
      return;
    }

    this.accumulatedTickMs += dtMs;

    let steps = 0;
    while (
      this.accumulatedTickMs >= MATCH_CONFIG.fixedTickMs &&
      steps < MAX_SIMULATION_STEPS_PER_TICK
    ) {
      const prevCarrierSlotId = this.world.puck.carrierSlotId;
      this.world = stepWorld(
        this.world,
        [
          ...this.latestInputBySession.values(),
          ...this.createBotInputFrames(this.world)
        ],
        MATCH_CONFIG.fixedTickMs
      );
      this.applyControlSwitches(prevCarrierSlotId);
      this.accumulatedTickMs -= MATCH_CONFIG.fixedTickMs;
      steps += 1;
    }

    if (steps === MAX_SIMULATION_STEPS_PER_TICK) {
      this.accumulatedTickMs = Math.min(
        this.accumulatedTickMs,
        MATCH_CONFIG.fixedTickMs
      );
    }

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

  private handleChooseCharacter(client: Client, message: unknown): void {
    const characterId = getRequestedCharacterId(message);

    if (!characterId) {
      this.send(client, "server.error", { message: "Invalid character." });
      return;
    }

    try {
      const slot = selectCharacterForSession(
        this.roster,
        client.sessionId,
        characterId
      );

      if (!slot) {
        this.send(client, "server.error", { message: "Join a slot first." });
        return;
      }

      this.syncRosterState();
    } catch (error) {
      if (error instanceof InvalidCharacterSelectionError) {
        this.send(client, "server.error", { message: "Invalid character." });
        return;
      }

      throw error;
    }
  }

  /**
   * Slot-targeted character selection: a human edits their own slot, and the
   * team captain can additionally edit their team's bot slots. Permission is
   * enforced in selectCharacterForSlot.
   */
  private handleChooseCharacterFor(client: Client, message: unknown): void {
    const characterId = getRequestedCharacterId(message);
    const slotId = getRequestedSlotId(message);

    if (!characterId || !slotId) {
      this.send(client, "server.error", { message: "Invalid selection." });
      return;
    }

    try {
      const slot = selectCharacterForSlot(
        this.roster,
        client.sessionId,
        slotId,
        characterId
      );

      if (!slot) {
        const sender = this.roster.find(
          (candidate) =>
            candidate.kind === "human" &&
            candidate.sessionId === client.sessionId
        );
        this.send(client, "server.error", {
          message: sender ? "You can't edit that slot." : "Join a slot first."
        });
        return;
      }

      this.syncRosterState();
    } catch (error) {
      if (error instanceof InvalidCharacterSelectionError) {
        this.send(client, "server.error", { message: "Invalid character." });
        return;
      }

      throw error;
    }
  }

  private handleRequestStart(client: Client): void {
    if (!this.world || !this.state.isRosterValid) {
      this.send(client, "server.error", { message: "Roster is not ready." });
      return;
    }

    if (this.world.phase !== "waiting") {
      return;
    }

    // Lobby character picks only mutate the roster — stamp them into the
    // waiting world before play begins.
    applyRosterCharactersToWorld(this.world, this.roster);
    this.world.phase = "playing";
    this.syncStateFromWorld();
  }

  private handleRematch(): void {
    this.world = createWorld(this.seedGenerator(), this.roomOptions.mode);
    applyRosterCharactersToWorld(this.world, this.roster);
    this.world.phase = "playing";
    this.botInputSequence = 0;
    this.syncStateFromWorld();
    this.broadcastSnapshot();
  }

  private handleBackToLobby(): void {
    if (!this.world) {
      return;
    }

    this.world.phase = "waiting";
    this.syncStateFromWorld();
    this.broadcastSnapshot();
  }

  private handleInput(client: Client, message: unknown): void {
    const frame = getClientInputFrame(message);
    const slot = this.roster.find(
      (candidate) =>
        candidate.kind === "human" && candidate.sessionId === client.sessionId
    );

    if (!frame || !slot) {
      this.send(client, "server.error", { message: "Invalid input." });
      return;
    }

    const lastSequence =
      this.lastInputSequenceBySession.get(client.sessionId) ?? -1;

    if (frame.sequence <= lastSequence) {
      return;
    }

    const previousSwitch =
      this.lastSwitchTargetBySession.get(client.sessionId) ?? false;
    const switchTarget = frame.switchTarget && !previousSwitch;
    this.lastSwitchTargetBySession.set(client.sessionId, frame.switchTarget);

    // The pass button doubles as the manual "switch to nearest teammate" control
    // when the player isn't carrying. Latch a fresh press (rising edge) here and
    // consume it once inside the tick loop — the wire `pass` field is left
    // untouched so charge-and-release passing still reads it every tick.
    const previousPass = this.lastPassBySession.get(client.sessionId) ?? false;
    if (frame.pass && !previousPass) {
      this.pendingManualSwitchBySession.set(client.sessionId, true);
    }
    this.lastPassBySession.set(client.sessionId, frame.pass);

    this.lastInputSequenceBySession.set(client.sessionId, frame.sequence);
    this.latestInputBySession.set(client.sessionId, {
      ...frame,
      playerId: client.sessionId,
      slotId: slot.slotId,
      switchTarget
    });
  }

  private broadcastSnapshot(): void {
    if (!this.world) {
      return;
    }

    const inputAcks: Record<string, number> = {};

    for (const slot of this.roster) {
      if (slot.kind === "human" && slot.sessionId) {
        const sequence = this.lastInputSequenceBySession.get(slot.sessionId);

        if (sequence !== undefined) {
          inputAcks[slot.slotId] = sequence;
        }
      }
    }

    const message: ServerWorldSnapshotMessage = {
      type: "server.worldSnapshot",
      world: this.world,
      inputAcks
    };

    this.broadcast("server.worldSnapshot", message satisfies ArcadeServerMessage);
  }

  /**
   * Madden-style control switching. Run after each sim sub-step: if a human's
   * skater passed to a teammate who just gathered it, control snaps to that
   * teammate; if a human pressed the pass button while not carrying, control
   * snaps to the same-team skater nearest the puck. The abandoned slot becomes a
   * bot (handled by `switchHumanControl`) so `createBotInputFrames` drives it on
   * the very next sub-step.
   */
  private applyControlSwitches(prevCarrierSlotId: string | null): void {
    if (!this.world) {
      return;
    }

    let rosterChanged = false;

    // Snapshot the sessions up front so a switch (which flips roster `kind`s)
    // can't cause a session to be processed twice in one pass.
    const humanSessions = this.roster
      .filter((slot) => slot.kind === "human" && slot.sessionId)
      .map((slot) => slot.sessionId as string);

    for (const sessionId of humanSessions) {
      const slot = this.roster.find(
        (candidate) =>
          candidate.kind === "human" && candidate.sessionId === sessionId
      );
      if (!slot) {
        continue;
      }

      let target: string | null = null;

      // Manual switch (pass pressed while not carrying) — consume the latch once
      // so a single press can't fire across every sub-step of this tick.
      if (this.pendingManualSwitchBySession.get(sessionId)) {
        this.pendingManualSwitchBySession.set(sessionId, false);
        target = resolveManualSwitchTarget(this.world, slot.slotId);
      }

      // A solo player (only human on their team) gets "control follows the
      // puck" on any teammate pickup; a shared team keeps the pass-only rule so
      // a pickup can't yank a body from a co-op teammate.
      const teamIsSolo =
        this.roster.filter(
          (candidate) =>
            candidate.kind === "human" && candidate.teamId === slot.teamId
        ).length <= 1;
      const possession = teamIsSolo
        ? resolveTeamPossessionSwitch(this.world, slot.slotId, prevCarrierSlotId)
        : resolveReceptionSwitch(this.world, slot.slotId, prevCarrierSlotId);
      if (possession) {
        target = possession;
      }

      if (!target || target === slot.slotId) {
        continue;
      }

      const targetSlot = this.roster.find(
        (candidate) => candidate.slotId === target
      );
      // Never steal a second human's skater on the same team.
      if (!targetSlot || targetSlot.kind !== "bot") {
        continue;
      }

      const moved = switchHumanControl(this.roster, sessionId, target);
      if (moved && moved.slotId === target) {
        // Re-point the buffered input so the rest of this tick (and any ticks
        // before the next input message) drives the new body, and so
        // createBotInputFrames stops generating for it.
        const stored = this.latestInputBySession.get(sessionId);
        if (stored) {
          this.latestInputBySession.set(sessionId, {
            ...stored,
            slotId: target
          });
        }
        rosterChanged = true;
      }
    }

    if (rosterChanged) {
      this.syncRosterState();
    }
  }

  private createBotInputFrames(world: WorldState): InputFrame[] {
    this.botInputSequence += 1;

    return this.roster
      .filter((slot) => slot.kind === "bot")
      .map((slot) => world.skaters.find((skater) => skater.id === slot.slotId))
      .filter((skater): skater is NonNullable<typeof skater> => Boolean(skater))
      .map((skater) =>
        createBotInputFrame(skater, world, this.botInputSequence)
      );
  }
}

export function createPrivateRoomCode(codeGenerator = generateRoomCode): string {
  return normalizeRoomCode(codeGenerator());
}

export function normalizeArcadeRoomOptions(
  options: ArcadeRoomOptions = {}
): NormalizedArcadeRoomOptions {
  const quickMatch = options.quickMatch ?? true;

  return {
    privateCode:
      options.privateCode === undefined || quickMatch
        ? ""
        : normalizeRoomCode(options.privateCode),
    quickMatch,
    mode: options.mode ?? DEFAULT_MODE
  };
}

function getRequestedTeamId(message: unknown): ChooseTeamMessage["teamId"] {
  if (!message || typeof message !== "object" || !("teamId" in message)) {
    return undefined;
  }

  return (message as ChooseTeamMessage).teamId;
}

function getRequestedCharacterId(
  message: unknown
): ChooseCharacterMessage["characterId"] {
  if (!message || typeof message !== "object" || !("characterId" in message)) {
    return undefined;
  }

  return (message as ChooseCharacterMessage).characterId;
}

function getRequestedSlotId(message: unknown): string | undefined {
  if (!message || typeof message !== "object" || !("slotId" in message)) {
    return undefined;
  }

  const slotId = (message as { slotId?: unknown }).slotId;
  return typeof slotId === "string" && slotId ? slotId : undefined;
}

function getClientInputFrame(message: unknown): InputFrame | null {
  if (!message || typeof message !== "object" || !("frame" in message)) {
    return null;
  }

  const candidate = (message as Partial<ClientInputMessage>).frame;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const numericFields = [
    candidate.sequence,
    candidate.moveX,
    candidate.moveY,
    candidate.stickX,
    candidate.stickY
  ];

  if (numericFields.some((value) => !Number.isFinite(value))) {
    return null;
  }

  if (!Number.isSafeInteger(candidate.sequence) || candidate.sequence < 0) {
    return null;
  }

  const axis = (value: number) => Math.max(-1, Math.min(1, value));

  return {
    playerId: String(candidate.playerId ?? ""),
    slotId: String(candidate.slotId ?? ""),
    sequence: candidate.sequence,
    moveX: axis(candidate.moveX ?? 0),
    moveY: axis(candidate.moveY ?? 0),
    stickX: axis(candidate.stickX ?? 0),
    stickY: axis(candidate.stickY ?? 0),
    pass: candidate.pass === true,
    check: candidate.check === true,
    turbo: candidate.turbo === true,
    switchTarget: candidate.switchTarget === true,
    poke: candidate.poke === true,
    dive: candidate.dive === true
  };
}
