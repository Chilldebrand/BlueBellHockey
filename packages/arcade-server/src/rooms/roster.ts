import { SKATER_SLOTS, type SkaterSlot, type TeamId } from "@bbh/arcade-core";

export type RosterSlotKind = "open" | "human" | "bot";

export interface RoomRosterSlot {
  readonly slotId: string;
  readonly teamId: TeamId;
  readonly index: number;
  kind: RosterSlotKind;
  sessionId: string | null;
  playerName: string | null;
  botId: string | null;
}

export interface HumanAssignment {
  readonly sessionId: string;
  readonly playerName?: string;
}

export class RosterFullError extends Error {
  constructor() {
    super("room is full");
    this.name = "RosterFullError";
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
    botId: null
  };
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

  const slot =
    roster.find((candidate) => candidate.kind === "open") ??
    roster.find((candidate) => candidate.kind === "bot");

  if (!slot) {
    throw new RosterFullError();
  }

  slot.kind = "human";
  slot.sessionId = assignment.sessionId;
  slot.playerName = assignment.playerName?.trim() || "Player";
  slot.botId = null;

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
  current.kind = "bot";
  current.sessionId = null;
  current.playerName = null;
  current.botId = botIdForSlot(current.slotId);

  target.kind = "human";
  target.sessionId = sessionId;
  target.playerName = playerName;
  target.botId = null;

  return target;
}
