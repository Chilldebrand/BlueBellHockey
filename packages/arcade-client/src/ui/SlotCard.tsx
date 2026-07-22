import { ARCADE_CHARACTERS } from "@bbh/arcade-core";
import type { ClientRosterSlot } from "../store.js";

/** "Ada" for humans, "Bot 2" for bots (index is per-team, 0-based). */
export function slotLabel(slot: ClientRosterSlot): string {
  return slot.isBot ? `Bot ${slot.index + 1}` : slot.displayName;
}

export interface SlotCardProps {
  readonly slot: ClientRosterSlot;
  /** Whether the local player may edit this slot (see canEditSlot). */
  readonly editable: boolean;
  /** Whether the character picker is currently targeting this slot. */
  readonly isEditing: boolean;
  /** Creator-only: show a kick control for this (human, non-local) slot. */
  readonly canKick?: boolean;
  readonly onEdit: (slotId: string) => void;
  readonly onKick?: (sessionId: string) => void;
}

/**
 * One roster slot in a team column, kept COMPACT (who + which character) so
 * the roster doesn't crowd out the character picker below — stat comparison
 * lives in the picker. Editable cards are buttons that focus the picker on
 * this slot; non-editable cards are inert.
 */
export function SlotCard({
  slot,
  editable,
  isEditing,
  canKick = false,
  onEdit,
  onKick
}: SlotCardProps): JSX.Element {
  const character = ARCADE_CHARACTERS.find(
    (candidate) => candidate.id === slot.characterId
  );

  const body = (
    <>
      <div className="slot-card-info">
        <div className="slot-card-head">
          <strong>{slotLabel(slot)}</strong>
          {slot.isCaptain ? (
            <span className="captain-badge" aria-label="Team captain">
              C
            </span>
          ) : null}
          {slot.isOwnedByLocalPlayer ? (
            <span className="you-badge">You</span>
          ) : null}
        </div>
        {!slot.isBot ? (
          <span
            className="slot-card-ready-status"
            data-ready={slot.ready ? "true" : "false"}
          >
            {slot.ready ? "Ready" : "Not ready"}
          </span>
        ) : null}
        <span className="slot-card-character">
          {character?.displayName ?? slot.characterId}
          {character ? <small> · {character.silhouette}</small> : null}
        </span>
      </div>
      <span className="slot-card-number" aria-hidden="true">
        {character?.jerseyNumber ?? ""}
      </span>
    </>
  );

  const highlightClass = slot.isOwnedByLocalPlayer ? " slot-card--local" : "";

  // The editable card is itself a <button>, so the creator's kick control is
  // an overlay sibling, never a nested button.
  const kickButton =
    canKick && onKick && slot.sessionId ? (
      <button
        type="button"
        className="slot-card-kick"
        aria-label={`Kick ${slotLabel(slot)}`}
        title={`Kick ${slotLabel(slot)}`}
        onClick={() => onKick(slot.sessionId!)}
      >
        ✕
      </button>
    ) : null;

  const card = !editable ? (
    <div className={`slot-card${highlightClass}`}>{body}</div>
  ) : (
    <button
      type="button"
      className={
        (isEditing ? "slot-card editable editing" : "slot-card editable") +
        highlightClass
      }
      onClick={() => onEdit(slot.slotId)}
    >
      {body}
    </button>
  );

  if (!kickButton) {
    return card;
  }

  return (
    <div className="slot-card-wrap">
      {card}
      {kickButton}
    </div>
  );
}
