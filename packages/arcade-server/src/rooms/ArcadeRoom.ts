import {
  createBotInputFrame,
  createWorld,
  DEFAULT_MATCH_RULES,
  isMatchRules,
  MATCH_CONFIG,
  resolveManualSwitchTarget,
  resolveReceptionSwitch,
  resolveTeamPossessionSwitch,
  stepWorld,
  type ArcadeServerMessage,
  type ClientInputMessage,
  type InputFrame,
  type MatchMode,
  type MatchRules,
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
  allHumansReady,
  applyRosterCharactersToWorld,
  assignHumanToOpenSlot,
  clearHumanReadiness,
  createRoster,
  earliestHumanSessionId,
  fillRosterWithBots,
  InvalidCharacterSelectionError,
  moveHumanToTeam,
  releaseHuman,
  selectCharacterForSlot,
  selectGoalieController,
  setHumanPlayerName,
  setHumanReady,
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
  /** Wall-clock source for lobby pacing (force-start grace, rate limits). */
  readonly now?: () => number;
}

/**
 * How long an all-ready start stays blocked before the creator's retry starts
 * the match anyway. Without this, one player who never readies up (or walked
 * away) deadlocks a public quick-match lobby forever — there is no kick.
 * Unready humans keep their seats; they simply enter the match unconfirmed.
 */
export const FORCE_START_GRACE_MS = 20_000;

/**
 * Lobby-mutation token bucket: each of setPlayerName / setReady / chooseTeam /
 * chooseCharacterFor triggers a full roster rebuild broadcast to every client,
 * so a wire-rate flood from one session amplifies room-wide. Human UI flows
 * never approach this budget.
 */
const LOBBY_MUTATION_BURST = 10;
const LOBBY_MUTATION_REFILL_MS = 250;

interface JoinOptions {
  readonly playerName?: string;
}

interface ChooseTeamMessage {
  readonly teamId?: string;
}

interface ChooseCharacterMessage {
  readonly characterId?: string;
}

interface SetPlayerNameMessage {
  readonly playerName?: string;
}

interface SetReadyMessage {
  readonly ready?: boolean;
}

type StoredArcadeRoomOptions = {
  -readonly [Key in keyof NormalizedArcadeRoomOptions]: NormalizedArcadeRoomOptions[Key];
};

const DEFAULT_MODE: MatchMode = "arcade3v3";
const MAX_SIMULATION_STEPS_PER_TICK = 5;
// Outside live play the world is static (the sim clock doesn't advance in
// waiting/ended), so streaming 62.5 full-world snapshots/s to the lobby is
// pure waste — measured as the main client CPU burn. One snapshot every 8th
// tick (~8/s) keeps joins and postgame fresh; "playing" keeps the full rate.
const IDLE_SNAPSHOT_TICK_INTERVAL = 8;
// Room codes and player names are hostile input: they land in replicated
// schema state and room metadata, so both are strictly bounded here.
const PRIVATE_CODE_PATTERN = /^[A-Z0-9]{1,12}$/;
const MAX_PLAYER_NAME_LENGTH = 24;
// Must cover the client's RECONNECT_WINDOW_MS (30s) so a stored ticket is
// still honored server-side after a page reload.
const RECONNECT_GRACE_SECONDS = 30;

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
}

function normalizeRoomCode(code: string): string {
  if (typeof code !== "string") {
    throw new Error("privateCode must be a string");
  }

  const normalized = code.trim().toUpperCase();

  if (!normalized) {
    throw new Error("privateCode must not be empty");
  }

  if (!PRIVATE_CODE_PATTERN.test(normalized)) {
    throw new Error("privateCode must be 1-12 letters or digits");
  }

  return normalized;
}

function isMatchMode(value: unknown): value is MatchMode {
  return value === "arcade3v3";
}

function sanitizePlayerName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_PLAYER_NAME_LENGTH);

  return cleaned || undefined;
}

export class ArcadeRoom extends Room<ArcadeRoomState> {
  maxClients = 6;

  readonly roomOptions: StoredArcadeRoomOptions;
  private readonly seedGenerator: () => number;
  private readonly startSimulation: boolean;
  private roster: RoomRosterSlot[] = createRoster();
  private readonly latestInputBySession = new Map<string, InputFrame>();
  private readonly lastInputSequenceBySession = new Map<string, number>();
  private readonly lastPassBySession = new Map<string, boolean>();
  private readonly pendingManualSwitchBySession = new Map<string, boolean>();
  private accumulatedTickMs = 0;
  private botInputSequence = 0;
  private idleTickCounter = 0;
  private roomCreatorSessionId: string | null = null;
  private matchRules: MatchRules = { ...DEFAULT_MATCH_RULES };
  private world: WorldState | null = null;
  private readonly now: () => number;
  private readonly lobbyMutationBuckets = new Map<
    string,
    { tokens: number; lastRefillMs: number }
  >();
  /** When the creator's start was first blocked on readiness; null once clear. */
  private startBlockedFirstAtMs: number | null = null;

  constructor(dependencies: ArcadeRoomDependencies = {}) {
    super();
    this.seedGenerator = dependencies.seedGenerator ?? (() => 1);
    this.startSimulation = dependencies.startSimulation ?? true;
    this.now = dependencies.now ?? (() => Date.now());
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
    this.matchRules = { ...DEFAULT_MATCH_RULES };
    this.world = this.createFreshWorld();
    this.setState(
      createInitialRoomState({
        privateCode,
        mode
      })
    );
    this.syncRoomMetadata();
    this.syncMatchRulesState();
    this.syncStateFromWorld();
    this.syncRosterState();
    this.onMessage("client.setPlayerName", (client, message: unknown) => {
      this.handleSetPlayerName(client, message);
    });
    this.onMessage("client.setReady", (client, message: unknown) => {
      this.handleSetReady(client, message);
    });
    this.onMessage("client.setMatchRules", (client, message: unknown) => {
      this.handleSetMatchRules(client, message);
    });
    this.onMessage("client.chooseTeam", (client, message: unknown) => {
      this.handleChooseTeam(client, message);
    });
    this.onMessage("client.chooseCharacterFor", (client, message: unknown) => {
      this.handleChooseCharacterFor(client, message);
    });
    this.onMessage("client.requestStart", (client) => {
      this.handleRequestStart(client);
    });
    this.onMessage("client.rematch", (client) => {
      this.handleRematch(client);
    });
    this.onMessage("client.backToLobby", (client) => {
      this.handleBackToLobby(client);
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
      playerName: sanitizePlayerName(options?.playerName)
    });
    if (this.roomCreatorSessionId === null) {
      this.roomCreatorSessionId = client.sessionId;
    }
    // A newcomer gets the full grace window before a force-start can bypass them.
    this.startBlockedFirstAtMs = null;
    fillRosterWithBots(this.roster);
    this.syncRosterState();
  }

  async onLeave(client: Client, consented?: boolean): Promise<void> {
    const slot = this.roster.find(
      (candidate) =>
        candidate.kind === "human" && candidate.sessionId === client.sessionId
    );
    const playerName = slot?.playerName ?? undefined;
    const ready = slot?.ready ?? false;
    const previousSlotId = slot?.slotId;
    const isCreator = this.roomCreatorSessionId === client.sessionId;

    // Release immediately either way: a bot takes the body over so the match
    // never carries an input-starved statue while we wait out the grace.
    releaseHuman(this.roster, client.sessionId);
    this.latestInputBySession.delete(client.sessionId);
    this.lastInputSequenceBySession.delete(client.sessionId);
    this.lastPassBySession.delete(client.sessionId);
    this.pendingManualSwitchBySession.delete(client.sessionId);
    this.lobbyMutationBuckets.delete(client.sessionId);
    fillRosterWithBots(this.roster);
    this.syncRosterState();

    if (consented || !previousSlotId) {
      if (isCreator) {
        this.transferRoomCreator();
      }
      return;
    }

    // Unclean drop (reload, network blip): hold a reconnection seat so the
    // client's stored ticket can bring them back — this also keeps a solo
    // player's room alive across a refresh instead of disposing it.
    try {
      await this.allowReconnection(client, RECONNECT_GRACE_SECONDS);
    } catch {
      if (isCreator) {
        this.transferRoomCreator();
      }
      return;
    }

    try {
      assignHumanToOpenSlot(this.roster, {
        sessionId: client.sessionId,
        playerName,
        preferredSlotId: previousSlotId
      });
      setHumanReady(this.roster, client.sessionId, ready);
      fillRosterWithBots(this.roster);
      this.syncRosterState();
    } catch {
      // Roster filled up during the grace window — nothing to re-seat.
      if (isCreator) {
        this.transferRoomCreator();
      }
    }
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
      const prevGoalieCarrierId = this.world.puck.goalieCarrierId;
      this.world = stepWorld(
        this.world,
        [
          ...this.latestInputBySession.values(),
          ...this.createBotInputFrames(this.world)
        ],
        MATCH_CONFIG.fixedTickMs
      );
      this.applyGoalieControlGrants(prevGoalieCarrierId);
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

    // Full-rate snapshots only while the sim is actually moving; an idle
    // lobby/postgame world only needs an occasional refresh for new joins.
    if (this.world.phase === "playing") {
      this.idleTickCounter = 0;
      this.broadcastSnapshot();
    } else {
      if (this.idleTickCounter % IDLE_SNAPSHOT_TICK_INTERVAL === 0) {
        this.broadcastSnapshot();
      }
      this.idleTickCounter += 1;
    }
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

  private syncMatchRulesState(): void {
    if (!this.state) {
      return;
    }

    this.state.rules.timeLimitMs = this.matchRules.timeLimitMs;
    this.state.rules.goalLimit = this.matchRules.goalLimit;
  }

  private createFreshWorld(): WorldState {
    const world = createWorld(
      this.seedGenerator(),
      this.roomOptions.mode,
      undefined,
      this.matchRules
    );
    applyRosterCharactersToWorld(world, this.roster);
    return world;
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

    applyRosterToState(this.state, this.roster, this.roomCreatorSessionId);
    this.state.isRosterValid = this.roster.every((slot) => slot.kind !== "open");
  }

  private transferRoomCreator(): void {
    this.roomCreatorSessionId = earliestHumanSessionId(this.roster);
    this.syncRosterState();
  }

  /**
   * Token-bucket check for the lobby mutation messages. Exhausted budgets drop
   * the message silently — an error reply would itself be flood amplification.
   */
  private allowLobbyMutation(sessionId: string): boolean {
    const now = this.now();
    const bucket = this.lobbyMutationBuckets.get(sessionId) ?? {
      tokens: LOBBY_MUTATION_BURST,
      lastRefillMs: now
    };

    const refilled = Math.floor(
      (now - bucket.lastRefillMs) / LOBBY_MUTATION_REFILL_MS
    );
    if (refilled > 0) {
      bucket.tokens = Math.min(LOBBY_MUTATION_BURST, bucket.tokens + refilled);
      bucket.lastRefillMs = now;
    }

    const allowed = bucket.tokens > 0;
    if (allowed) {
      bucket.tokens -= 1;
    }

    this.lobbyMutationBuckets.set(sessionId, bucket);
    return allowed;
  }

  private handleSetPlayerName(client: Client, message: unknown): void {
    if (!this.allowLobbyMutation(client.sessionId)) {
      return;
    }

    if (this.world?.phase !== "waiting") {
      this.send(client, "server.error", {
        message: "Can't change name mid-match."
      });
      return;
    }

    const slot = setHumanPlayerName(
      this.roster,
      client.sessionId,
      sanitizePlayerName(getRequestedPlayerName(message)) ?? "Player"
    );

    if (!slot) {
      this.send(client, "server.error", { message: "Join a slot first." });
      return;
    }

    this.syncRosterState();
  }

  private handleSetReady(client: Client, message: unknown): void {
    if (!this.allowLobbyMutation(client.sessionId)) {
      return;
    }

    if (this.world?.phase !== "waiting") {
      this.send(client, "server.error", {
        message: "Can't change readiness mid-match."
      });
      return;
    }

    const ready = getRequestedReady(message);

    if (ready === undefined) {
      this.send(client, "server.error", { message: "Invalid readiness." });
      return;
    }

    const slot = setHumanReady(this.roster, client.sessionId, ready);

    if (!slot) {
      this.send(client, "server.error", { message: "Join a slot first." });
      return;
    }

    this.syncRosterState();
  }

  private handleSetMatchRules(client: Client, message: unknown): void {
    if (!this.allowLobbyMutation(client.sessionId)) {
      return;
    }

    if (this.world?.phase !== "waiting") {
      this.send(client, "server.error", {
        message: "Can't change rules mid-match."
      });
      return;
    }

    if (this.roomCreatorSessionId !== client.sessionId) {
      this.send(client, "server.error", {
        message: "Only the room creator can change rules."
      });
      return;
    }

    if (!isMatchRules(message)) {
      this.send(client, "server.error", { message: "Invalid match rules." });
      return;
    }

    this.matchRules = { ...message };
    this.world = this.createFreshWorld();
    this.syncMatchRulesState();
    this.syncStateFromWorld();
  }

  private handleChooseTeam(client: Client, message: unknown): void {
    if (!this.allowLobbyMutation(client.sessionId)) {
      return;
    }

    if (this.world?.phase !== "waiting") {
      this.send(client, "server.error", {
        message: "Can't switch teams mid-match."
      });
      return;
    }

    const teamId = getRequestedTeamId(message);

    if (teamId !== "home" && teamId !== "away") {
      this.send(client, "server.error", { message: "Invalid team." });
      return;
    }

    moveHumanToTeam(this.roster, client.sessionId, teamId);
    fillRosterWithBots(this.roster);
    this.syncRosterState();
  }

  /**
   * Slot-targeted character selection: a human edits their own slot, and the
   * team captain can additionally edit their team's bot slots. Permission is
   * enforced in selectCharacterForSlot.
   */
  private handleChooseCharacterFor(client: Client, message: unknown): void {
    if (!this.allowLobbyMutation(client.sessionId)) {
      return;
    }

    if (this.world?.phase !== "waiting") {
      this.send(client, "server.error", {
        message: "Can't change character mid-match."
      });
      return;
    }

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

    if (this.roomCreatorSessionId !== client.sessionId) {
      this.send(client, "server.error", {
        message: "Only the room creator can start."
      });
      return;
    }

    if (!allHumansReady(this.roster)) {
      // One player who never readies must not deadlock the room forever: the
      // first blocked attempt starts a grace window, and once it elapses the
      // creator's retry starts the match anyway (unready humans keep their
      // seats — they just enter unconfirmed).
      const now = this.now();
      if (this.startBlockedFirstAtMs === null) {
        this.startBlockedFirstAtMs = now;
      }

      if (now - this.startBlockedFirstAtMs < FORCE_START_GRACE_MS) {
        this.send(client, "server.error", {
          message: "All human players must be ready."
        });
        return;
      }
    }

    this.startBlockedFirstAtMs = null;
    // Lobby character picks only mutate the roster — stamp them into the
    // waiting world before play begins.
    applyRosterCharactersToWorld(this.world, this.roster);
    this.world.phase = "playing";
    this.syncStateFromWorld();
  }

  /**
   * Rematch and back-to-lobby are postgame-only actions. The client only
   * offers them on the postgame screen; gating here keeps a hostile client
   * from resetting or freezing a live match for everyone else.
   */
  private canRequestPostgameAction(client: Client): boolean {
    if (!this.world || this.world.phase !== "ended") {
      return false;
    }

    return this.roster.some(
      (slot) => slot.kind === "human" && slot.sessionId === client.sessionId
    );
  }

  private handleRematch(client: Client): void {
    if (!this.canRequestPostgameAction(client)) {
      return;
    }

    this.world = this.createFreshWorld();
    this.world.phase = "playing";
    this.botInputSequence = 0;
    this.clearAllGoalieGrants();
    this.syncStateFromWorld();
    this.broadcastSnapshot();
  }

  private handleBackToLobby(client: Client): void {
    if (!this.canRequestPostgameAction(client)) {
      return;
    }

    // A fresh waiting world, not a phase flip on the ended one — otherwise
    // the next start would resume an expired clock and a finished score.
    this.world = this.createFreshWorld();
    this.botInputSequence = 0;
    this.clearAllGoalieGrants();
    // Everyone was necessarily ready when the finished match started; stale
    // flags would let the creator relaunch before anyone re-picks.
    clearHumanReadiness(this.roster);
    this.startBlockedFirstAtMs = null;
    this.syncRosterState();
    this.syncStateFromWorld();
    this.broadcastSnapshot();
  }

  /** Fresh worlds hold no covered puck — no grant may survive one. */
  private clearAllGoalieGrants(): void {
    let rosterChanged = false;

    for (const slot of this.roster) {
      if (slot.controlledGoalieId !== null) {
        slot.controlledGoalieId = null;
        this.repointBufferedInput(slot);
        rosterChanged = true;
      }
    }

    if (rosterChanged) {
      this.syncRosterState();
    }
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

    // The pass button doubles as the manual "switch to nearest teammate" control
    // when the player isn't carrying. Latch a fresh press (rising edge) here and
    // consume it once inside the tick loop — the wire `pass` field is left
    // untouched so charge-and-release passing still reads it every tick.
    // While a goalie grant is active the press charges the outlet instead, so
    // no switch is latched.
    const previousPass = this.lastPassBySession.get(client.sessionId) ?? false;
    if (frame.pass && !previousPass && slot.controlledGoalieId === null) {
      this.pendingManualSwitchBySession.set(client.sessionId, true);
    }
    this.lastPassBySession.set(client.sessionId, frame.pass);

    this.lastInputSequenceBySession.set(client.sessionId, frame.sequence);
    // The wire slot ID is never trusted: input always drives the sender's own
    // skater, or their goalie while they hold that temporary grant.
    this.latestInputBySession.set(client.sessionId, {
      ...frame,
      playerId: client.sessionId,
      slotId: slot.controlledGoalieId ?? slot.slotId
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
          // Acked under the ACTIVE entity: the goalie while a grant is held.
          inputAcks[slot.controlledGoalieId ?? slot.slotId] = sequence;
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
   * Temporary goalie-control grants, run after each sim sub-step. A new
   * covered save (goalieCarrierId null→goalie) grants the nearest defending
   * human that goalie's input; a release (goalie→null) returns it. The grant
   * is a separate roster field — skater slot ownership never moves — and every
   * change re-points the session's buffered input frame so the rest of this
   * tick already drives the right entity.
   */
  private applyGoalieControlGrants(prevGoalieCarrierId: string | null): void {
    if (!this.world) {
      return;
    }

    const goalieCarrierId = this.world.puck.goalieCarrierId;

    if (goalieCarrierId === prevGoalieCarrierId) {
      return;
    }

    let rosterChanged = false;

    // Any grant not matching the current carrier is stale: release, faceoff,
    // or (in principle) a different goalie covering.
    for (const slot of this.roster) {
      if (
        slot.controlledGoalieId !== null &&
        slot.controlledGoalieId !== goalieCarrierId
      ) {
        slot.controlledGoalieId = null;
        this.repointBufferedInput(slot);
        rosterChanged = true;
      }
    }

    if (goalieCarrierId !== null && this.world.phase === "playing") {
      const alreadyGranted = this.roster.some(
        (slot) => slot.controlledGoalieId === goalieCarrierId
      );

      if (!alreadyGranted) {
        const controller = selectGoalieController(
          this.roster,
          this.world,
          goalieCarrierId
        );

        if (controller) {
          controller.controlledGoalieId = goalieCarrierId;
          this.repointBufferedInput(controller);
          rosterChanged = true;
        }
      }
    }

    if (rosterChanged) {
      this.syncRosterState();
    }
  }

  /** Re-target a session's buffered frame at its current active entity. */
  private repointBufferedInput(slot: RoomRosterSlot): void {
    if (!slot.sessionId) {
      return;
    }

    const stored = this.latestInputBySession.get(slot.sessionId);

    if (stored) {
      this.latestInputBySession.set(slot.sessionId, {
        ...stored,
        slotId: slot.controlledGoalieId ?? slot.slotId
      });
    }
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
    if (!this.world || this.world.phase !== "playing") {
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

      // A goalie-controlling human is aiming an outlet: no body switching
      // until the grant clears (their pass press is a charge, not a switch).
      if (slot.controlledGoalieId !== null) {
        this.pendingManualSwitchBySession.set(sessionId, false);
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
  // Join options come straight off the wire: coerce quickMatch to a literal
  // boolean and refuse to store any mode the sim doesn't know — both land in
  // replicated state, room metadata, and createWorld.
  const quickMatch = options?.quickMatch !== false;

  return {
    privateCode:
      options?.privateCode === undefined || quickMatch
        ? ""
        : normalizeRoomCode(options.privateCode),
    quickMatch,
    mode: isMatchMode(options?.mode) ? options.mode : DEFAULT_MODE
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

function getRequestedPlayerName(
  message: unknown
): SetPlayerNameMessage["playerName"] {
  if (!message || typeof message !== "object" || !("playerName" in message)) {
    return undefined;
  }

  return (message as SetPlayerNameMessage).playerName;
}

function getRequestedReady(message: unknown): SetReadyMessage["ready"] {
  if (!message || typeof message !== "object" || !("ready" in message)) {
    return undefined;
  }

  const ready = (message as SetReadyMessage).ready;
  return typeof ready === "boolean" ? ready : undefined;
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
    poke: candidate.poke === true,
    dive: candidate.dive === true,
    usePowerup: candidate.usePowerup === true
  };
}
