import { ARCADE_CHARACTERS, CHARACTER_STAT_KEYS } from "@bbh/arcade-core";
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
  readonly onEdit: (slotId: string) => void;
}

/**
 * One roster slot in a team column: who occupies it (player name or BOT, with
 * captain/You badges) and which character it runs (name, silhouette, stats).
 * Editable cards are buttons that focus the character picker on this slot;
 * non-editable cards are inert.
 */
export function SlotCard({
  slot,
  editable,
  isEditing,
  onEdit
}: SlotCardProps): JSX.Element {
  const character = ARCADE_CHARACTERS.find(
    (candidate) => candidate.id === slot.characterId
  );

  const body = (
    <>
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
      <span className="slot-card-character">
        {character?.displayName ?? slot.characterId}
      </span>
      <small>{character?.silhouette ?? ""}</small>
      {character ? (
        <div className="stat-grid" aria-label={`${character.displayName} stats`}>
          {CHARACTER_STAT_KEYS.map((key) => (
            <span key={key}>
              {key}
              <meter min={0} max={5} value={character.stats[key]} />
            </span>
          ))}
        </div>
      ) : null}
    </>
  );

  if (!editable) {
    return <div className="slot-card">{body}</div>;
  }

  return (
    <button
      type="button"
      className={
        isEditing ? "slot-card editable editing" : "slot-card editable"
      }
      onClick={() => onEdit(slot.slotId)}
    >
      {body}
    </button>
  );
}
