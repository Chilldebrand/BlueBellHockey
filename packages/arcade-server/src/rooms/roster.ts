import {
  defaultCharacterIdForSlot,
  isCharacterId,
  SKATER_SLOTS,
  type CharacterId,
  type SkaterSlot,
  type TeamId,
  type WorldState
} from "@bbh/arcade-core";

export type RosterSlotKind = "open" | "human" | "bot";

export interface RoomRosterSlot {
  readonly slotId: string;
  readonly teamId: TeamId;
  readonly index: number;
  kind: RosterSlotKind;
  sessionId: string | null;
  playerName: string | null;
  ready: boolean;
  botId: string | null;
  characterId: CharacterId;
  /**
   * Monotonic order in which a human landed on their CURRENT team; null for
   * non-humans. Captaincy is derived, never stored: the team's captain is the
   * human slot with the lowest order. Leaving nulls it; switching teams gets a
   * fresh (highest) order on the new team; a mid-match control switch carries
   * it with the session so the badge doesn't strobe.
   */
  teamJoinOrder: number | null;
  /**
   * Temporary goalie-control grant: while the team's goalie covers the puck,
   * this human's input drives the goalie instead of their skater. Skater slot
   * ownership never moves — the grant clears the moment the outlet releases,
   * on leave/team move/control switch, and on every world reset.
   */
  controlledGoalieId: string | null;
  /**
   * Postgame rematch vote. Set when a human clicks Rematch on the ended screen;
   * the match rematches once enough humans have voted (or the host forces it).
   * Only meaningful for human slots; always cleared on any world reset.
   */
  votedRematch: boolean;
}

export interface HumanAssignment {
  readonly sessionId: string;
  readonly playerName?: string;
  /**
   * Seat this slot if it's still available (reconnect flow: put a returning
   * player back in the body they left). Falls back to the normal open/bot
   * search when the slot is gone or another human took it.
   */
  readonly preferredSlotId?: string;
}

export class RosterFullError extends Error {
  constructor() {
    super("room is full");
    this.name = "RosterFullError";
  }
}

export class InvalidCharacterSelectionError extends Error {
  constructor(characterId: string) {
    super(`invalid character selection: ${characterId}`);
    this.name = "InvalidCharacterSelectionError";
  }
}

function createSlot(slot: SkaterSlot): RoomRosterSlot {
  return {
    slotId: slot.id,
    teamId: slot.teamId,
    index: slot.index,
    kind: "open",
    sessionId: null,
    playerName: null,
    ready: false,
    botId: null,
    characterId: characterIdForSlot(slot),
    teamJoinOrder: null,
    controlledGoalieId: null,
    votedRematch: false
  };
}

/** Next monotonic join order, derived from the roster (no room counter). */
function nextTeamJoinOrder(roster: readonly RoomRosterSlot[]): number {
  return (
    roster.reduce(
      (highest, slot) => Math.max(highest, slot.teamJoinOrder ?? 0),
      0
    ) + 1
  );
}

/** The captain of a team: its longest-tenured human, or null if none. */
export function captainSessionId(
  roster: readonly RoomRosterSlot[],
  teamId: TeamId
): string | null {
  let captain: RoomRosterSlot | null = null;

  for (const slot of roster) {
    if (slot.teamId !== teamId || slot.kind !== "human" || !slot.sessionId) {
      continue;
    }

    if (
      !captain ||
      (slot.teamJoinOrder ?? Number.POSITIVE_INFINITY) <
        (captain.teamJoinOrder ?? Number.POSITIVE_INFINITY) ||
      (slot.teamJoinOrder === captain.teamJoinOrder &&
        slot.slotId < captain.slotId)
    ) {
      captain = slot;
    }
  }

  return captain?.sessionId ?? null;
}

export function earliestHumanSessionId(
  roster: readonly RoomRosterSlot[]
): string | null {
  let earliest: RoomRosterSlot | null = null;

  for (const slot of roster) {
    if (slot.kind !== "human" || !slot.sessionId) {
      continue;
    }

    if (
      !earliest ||
      (slot.teamJoinOrder ?? Number.POSITIVE_INFINITY) <
        (earliest.teamJoinOrder ?? Number.POSITIVE_INFINITY) ||
      (slot.teamJoinOrder === earliest.teamJoinOrder &&
        slot.slotId < earliest.slotId)
    ) {
      earliest = slot;
    }
  }

  return earliest?.sessionId ?? null;
}

function botIdForSlot(slotId: string): string {
  return `bot-${slotId}`;
}

export function createRoster(): RoomRosterSlot[] {
  return SKATER_SLOTS.map(createSlot);
}

export function assignHumanToOpenSlot(
  roster: RoomRosterSlot[],
  assignment: HumanAssignment
): RoomRosterSlot {
  const existing = roster.find(
    (slot) => slot.sessionId === assignment.sessionId
  );

  if (existing) {
    return existing;
  }

  const preferred = assignment.preferredSlotId
    ? roster.find(
        (candidate) =>
          candidate.slotId === assignment.preferredSlotId &&
          candidate.kind !== "human"
      )
    : undefined;
  const slot =
    preferred ??
    roster.find((candidate) => candidate.kind === "open") ??
    roster.find((candidate) => candidate.kind === "bot");

  if (!slot) {
    throw new RosterFullError();
  }

  // Derive everything BEFORE mutating: a throw mid-assignment would strand a
  // half-human slot no session owns (it can never be released via onLeave).
  const playerName = assignment.playerName?.trim() || "Player";
  const teamJoinOrder = nextTeamJoinOrder(roster);

  slot.kind = "human";
  slot.sessionId = assignment.sessionId;
  slot.playerName = playerName;
  slot.ready = false;
  slot.botId = null;
  slot.teamJoinOrder = teamJoinOrder;

  return slot;
}

export function fillRosterWithBots(roster: RoomRosterSlot[]): RoomRosterSlot[] {
  for (const slot of roster) {
    if (slot.kind !== "human") {
      slot.kind = "bot";
      slot.sessionId = null;
      slot.playerName = null;
      slot.ready = false;
      slot.botId = botIdForSlot(slot.slotId);
    }
  }

  return roster;
}

export function releaseHuman(
  roster: RoomRosterSlot[],
  sessionId: string
): RoomRosterSlot | null {
  const slot = roster.find(
    (candidate) =>
      candidate.kind === "human" && candidate.sessionId === sessionId
  );

  if (!slot) {
    return null;
  }

  slot.kind = "open";
  slot.sessionId = null;
  slot.playerName = null;
  slot.ready = false;
  slot.botId = null;
  slot.teamJoinOrder = null;
  slot.controlledGoalieId = null;
  slot.votedRematch = false;

  return slot;
}

export function moveHumanToTeam(
  roster: RoomRosterSlot[],
  sessionId: string,
  teamId: TeamId
): RoomRosterSlot | null {
  const current = roster.find(
    (candidate) =>
      candidate.kind === "human" && candidate.sessionId === sessionId
  );

  if (!current || current.teamId === teamId) {
    return current ?? null;
  }

  const target = roster.find(
    (candidate) => candidate.teamId === teamId && candidate.kind !== "human"
  );

  if (!target) {
    return current;
  }

  const playerName = current.playerName;
  const characterId = current.characterId;
  current.kind = "bot";
  current.sessionId = null;
  current.playerName = null;
  current.ready = false;
  current.botId = botIdForSlot(current.slotId);
  current.characterId = characterIdForSlot(current);
  current.teamJoinOrder = null;
  current.controlledGoalieId = null;

  target.kind = "human";
  target.sessionId = sessionId;
  target.playerName = playerName;
  target.ready = false;
  target.botId = null;
  target.characterId = characterId;
  // Fresh order on the NEW team: a switching captain relinquishes the old
  // team and never usurps the new team's incumbent captain.
  target.teamJoinOrder = nextTeamJoinOrder(roster);
  target.controlledGoalieId = null;

  return target;
}

/**
 * Madden-style control switch: move a human's control to another slot on the
 * SAME team (the slot they just passed to, or the nearest teammate on defense).
 * The vacated slot becomes a bot and the target must currently be a bot — we
 * never steal a second human's skater. Unlike `moveHumanToTeam`, each slot keeps
 * its OWN `characterId`: the human is changing which body they drive, not
 * carrying their skin across.
 */
export function switchHumanControl(
  roster: RoomRosterSlot[],
  sessionId: string,
  newSlotId: string
): RoomRosterSlot | null {
  const current = roster.find(
    (candidate) =>
      candidate.kind === "human" && candidate.sessionId === sessionId
  );

  if (!current || current.slotId === newSlotId) {
    return current ?? null;
  }

  const target = roster.find((candidate) => candidate.slotId === newSlotId);

  if (!target || target.teamId !== current.teamId || target.kind !== "bot") {
    return current;
  }

  const playerName = current.playerName;
  const teamJoinOrder = current.teamJoinOrder;
  const ready = current.ready;
  current.kind = "bot";
  current.sessionId = null;
  current.playerName = null;
  current.ready = false;
  current.botId = botIdForSlot(current.slotId);
  current.teamJoinOrder = null;
  current.controlledGoalieId = null;

  target.kind = "human";
  target.sessionId = sessionId;
  target.playerName = playerName;
  target.ready = ready;
  target.botId = null;
  // Captaincy rides with the session through mid-match control switches.
  target.teamJoinOrder = teamJoinOrder;
  target.controlledGoalieId = null;

  return target;
}

/**
 * Set a character on a specific slot, permission-checked: a human may edit
 * their OWN slot, and the team captain may additionally edit their team's BOT
 * slots. Never another human's slot, never the other team's bots.
 * Returns the mutated slot, or null when the sender has no slot or lacks
 * permission. Throws on an unknown characterId.
 */
export function selectCharacterForSlot(
  roster: RoomRosterSlot[],
  sessionId: string,
  slotId: string,
  characterId: string
): RoomRosterSlot | null {
  if (!isCharacterId(characterId)) {
    throw new InvalidCharacterSelectionError(characterId);
  }

  const sender = roster.find(
    (candidate) =>
      candidate.kind === "human" && candidate.sessionId === sessionId
  );

  if (!sender) {
    return null;
  }

  const target = roster.find((candidate) => candidate.slotId === slotId);

  if (!target) {
    return null;
  }

  const allowed =
    target === sender ||
    (target.kind === "bot" &&
      target.teamId === sender.teamId &&
      captainSessionId(roster, target.teamId) === sessionId);

  if (!allowed) {
    return null;
  }

  const changed = target.characterId !== characterId;
  target.characterId = characterId;
  if (target === sender && changed) {
    target.ready = false;
  }
  return target;
}

export function setHumanPlayerName(
  roster: RoomRosterSlot[],
  sessionId: string,
  playerName: string
): RoomRosterSlot | null {
  const slot = roster.find(
    (candidate) =>
      candidate.kind === "human" && candidate.sessionId === sessionId
  );

  if (!slot) {
    return null;
  }

  if (slot.playerName !== playerName) {
    slot.playerName = playerName;
    slot.ready = false;
  }

  return slot;
}

export function setHumanReady(
  roster: RoomRosterSlot[],
  sessionId: string,
  ready: boolean
): RoomRosterSlot | null {
  const slot = roster.find(
    (candidate) =>
      candidate.kind === "human" && candidate.sessionId === sessionId
  );

  if (!slot) {
    return null;
  }

  slot.ready = ready;
  return slot;
}

export function allHumansReady(roster: readonly RoomRosterSlot[]): boolean {
  return roster.every((slot) => slot.kind !== "human" || slot.ready);
}

/**
 * Clear every human's ready flag. Runs when the room returns to the lobby:
 * everyone was necessarily ready when the finished match started, so without
 * this the ready-gate would be instantly satisfied and the creator could
 * relaunch before anyone re-picks a team or character.
 */
export function clearHumanReadiness(roster: RoomRosterSlot[]): void {
  for (const slot of roster) {
    if (slot.kind === "human") {
      slot.ready = false;
    }
  }
}

/** Rematch votes only live for one postgame; wipe them on every world reset. */
export function clearRematchVotes(roster: RoomRosterSlot[]): void {
  for (const slot of roster) {
    slot.votedRematch = false;
  }
}

/** How many human rematch votes trigger an automatic rematch. */
export const REMATCH_VOTES_TO_START = 4;

/** Count of humans who have voted to rematch on the current postgame screen. */
export function countRematchVotes(roster: readonly RoomRosterSlot[]): number {
  return roster.filter((slot) => slot.kind === "human" && slot.votedRematch)
    .length;
}

/**
 * Picks which human temporarily drives a covering goalie: the human-controlled
 * skater on the goalie's own team nearest the goalie at the moment of cover,
 * with ascending slot ID as the deterministic tie-break. Null when the team
 * has no human (the sim's bounded outlet fallback handles that case).
 */
export function selectGoalieController(
  roster: readonly RoomRosterSlot[],
  world: WorldState,
  goalieId: string
): RoomRosterSlot | null {
  const goalie = world.goalies.find((candidate) => candidate.id === goalieId);

  if (!goalie) {
    return null;
  }

  let nearest: RoomRosterSlot | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const slot of roster) {
    if (slot.kind !== "human" || !slot.sessionId || slot.teamId !== goalie.teamId) {
      continue;
    }

    const skater = world.skaters.find(
      (candidate) => candidate.id === slot.slotId
    );

    if (!skater) {
      continue;
    }

    const distanceSquared =
      (skater.position.x - goalie.position.x) ** 2 +
      (skater.position.y - goalie.position.y) ** 2;

    if (
      distanceSquared < nearestDistanceSquared ||
      (distanceSquared === nearestDistanceSquared &&
        (nearest === null || slot.slotId < nearest.slotId))
    ) {
      nearest = slot;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearest;
}

function characterIdForSlot(slot: Pick<SkaterSlot, "teamId" | "index">): CharacterId {
  return defaultCharacterIdForSlot(slot);
}

/**
 * Sync the roster's character picks into a live world's skaters. The world is
 * created before (or independently of) lobby character selection, so this runs
 * at room create, match start, and rematch.
 */
export function applyRosterCharactersToWorld(
  world: WorldState,
  roster: readonly RoomRosterSlot[]
): void {
  for (const slot of roster) {
    const skater = world.skaters.find(
      (candidate) => candidate.id === slot.slotId
    );

    if (skater) {
      skater.characterId = slot.characterId;
    }
  }
}
