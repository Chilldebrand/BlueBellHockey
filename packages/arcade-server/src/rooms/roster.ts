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
    botId: null,
    characterId: characterIdForSlot(slot),
    teamJoinOrder: null
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
  slot.botId = null;
  slot.teamJoinOrder = null;

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
  current.botId = botIdForSlot(current.slotId);
  current.characterId = characterIdForSlot(current);
  current.teamJoinOrder = null;

  target.kind = "human";
  target.sessionId = sessionId;
  target.playerName = playerName;
  target.botId = null;
  target.characterId = characterId;
  // Fresh order on the NEW team: a switching captain relinquishes the old
  // team and never usurps the new team's incumbent captain.
  target.teamJoinOrder = nextTeamJoinOrder(roster);

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
  current.kind = "bot";
  current.sessionId = null;
  current.playerName = null;
  current.botId = botIdForSlot(current.slotId);
  current.teamJoinOrder = null;

  target.kind = "human";
  target.sessionId = sessionId;
  target.playerName = playerName;
  target.botId = null;
  // Captaincy rides with the session through mid-match control switches.
  target.teamJoinOrder = teamJoinOrder;

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

  target.characterId = characterId;
  return target;
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
