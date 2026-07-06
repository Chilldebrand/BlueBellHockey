import type { ClientRosterSlot } from "../store.js";

/**
 * Lobby edit rule: a human edits their OWN slot; the team captain (first human
 * on the team) additionally edits their team's BOT slots. Never another
 * human's slot, never the other team. Mirrors the server-side permission in
 * selectCharacterForSlot — the server is still the enforcer.
 */
export function canEditSlot(
  slot: ClientRosterSlot,
  roster: readonly ClientRosterSlot[],
  localSessionId: string | null
): boolean {
  if (slot.isOwnedByLocalPlayer) {
    return true;
  }

  if (!slot.isBot || !localSessionId) {
    return false;
  }

  return roster.some(
    (candidate) =>
      candidate.teamId === slot.teamId &&
      candidate.sessionId === localSessionId &&
      candidate.isCaptain
  );
}
