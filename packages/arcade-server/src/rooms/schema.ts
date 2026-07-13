import { ArraySchema, Schema, type } from "@colyseus/schema";
import type { MatchMode, TeamId, WorldPhase } from "@bbh/arcade-core";
import { MATCH_CONFIG, TEAM_IDS } from "@bbh/arcade-core";
import { captainSessionId, type RoomRosterSlot, type RosterSlotKind } from "./roster.js";

export class ArcadeScoreState extends Schema {
  @type("number") home = 0;
  @type("number") away = 0;
}

export class ArcadeClockState extends Schema {
  @type("number") nowMs = 0;
  @type("number") tick = 0;
  @type("number") fixedTickMs = MATCH_CONFIG.fixedTickMs;
}

export class ArcadeRoomSlotState extends Schema {
  @type("string") slotId = "";
  @type("string") teamId: TeamId = "home";
  @type("number") index = 0;
  @type("string") kind: RosterSlotKind = "open";
  @type("string") sessionId: string | null = null;
  @type("string") playerName: string | null = null;
  @type("string") botId: string | null = null;
  @type("string") characterId = "";
  @type("boolean") isBot = false;
  @type("boolean") isCaptain = false;
  @type("string") controlledGoalieId: string | null = null;
}

export class ArcadeTeamState extends Schema {
  @type("string") teamId: TeamId = "home";
  @type([ArcadeRoomSlotState]) slots = new ArraySchema<ArcadeRoomSlotState>();
}

export class ArcadeTeamsState extends Schema {
  @type(ArcadeTeamState) home = createTeamState(TEAM_IDS[0]);
  @type(ArcadeTeamState) away = createTeamState(TEAM_IDS[1]);
}

export class ArcadeRoomState extends Schema {
  @type("string") phase: WorldPhase = "waiting";
  @type(ArcadeScoreState) score = new ArcadeScoreState();
  @type(ArcadeClockState) clock = new ArcadeClockState();
  @type("string") privateCode = "";
  @type("string") mode: MatchMode = "arcade3v3";
  @type("boolean") isRosterValid = false;
  @type(ArcadeTeamsState) teams = new ArcadeTeamsState();
}

function createTeamState(teamId: TeamId): ArcadeTeamState {
  const team = new ArcadeTeamState();
  team.teamId = teamId;
  return team;
}

function createSlotState(
  slot: RoomRosterSlot,
  teamCaptainSessionId: string | null
): ArcadeRoomSlotState {
  const state = new ArcadeRoomSlotState();
  state.slotId = slot.slotId;
  state.teamId = slot.teamId;
  state.index = slot.index;
  state.kind = slot.kind;
  state.sessionId = slot.sessionId;
  state.playerName = slot.playerName;
  state.botId = slot.botId;
  state.characterId = slot.characterId;
  state.isBot = slot.kind === "bot";
  state.isCaptain =
    slot.kind === "human" &&
    slot.sessionId !== null &&
    slot.sessionId === teamCaptainSessionId;
  state.controlledGoalieId = slot.controlledGoalieId;
  return state;
}

export function createInitialRoomState(options: {
  readonly privateCode: string;
  readonly mode: MatchMode;
}): ArcadeRoomState {
  const state = new ArcadeRoomState();
  state.privateCode = options.privateCode;
  state.mode = options.mode;
  return state;
}

export function applyRosterToState(
  state: ArcadeRoomState,
  roster: readonly RoomRosterSlot[]
): void {
  const homeCaptain = captainSessionId(roster, "home");
  const awayCaptain = captainSessionId(roster, "away");
  state.teams.home.slots = new ArraySchema(
    ...roster
      .filter((slot) => slot.teamId === "home")
      .map((slot) => createSlotState(slot, homeCaptain))
  );
  state.teams.away.slots = new ArraySchema(
    ...roster
      .filter((slot) => slot.teamId === "away")
      .map((slot) => createSlotState(slot, awayCaptain))
  );
}
