import { TEAM_PALETTES, type TeamId } from "@bbh/arcade-core";
import type { ClientRosterSlot } from "../store.js";
import { canEditSlot } from "./lobbyPermissions.js";
import { SlotCard } from "./SlotCard.js";

export interface TeamColumnProps {
  readonly teamId: TeamId;
  /** This team's slots, index-sorted. */
  readonly slots: readonly ClientRosterSlot[];
  readonly roster: readonly ClientRosterSlot[];
  readonly localSessionId: string | null;
  readonly editingSlotId: string | null;
  readonly disabled: boolean;
  readonly onJoinTeam: (teamId: TeamId) => void;
  readonly onEditSlot: (slotId: string) => void;
}

/** One team's panel: header (name + join) over its three slot cards. */
export function TeamColumn({
  teamId,
  slots,
  roster,
  localSessionId,
  editingSlotId,
  disabled,
  onJoinTeam,
  onEditSlot
}: TeamColumnProps): JSX.Element {
  const palette = TEAM_PALETTES[teamId];
  const localIsOnTeam = slots.some((slot) => slot.isOwnedByLocalPlayer);

  return (
    <section
      className="team-column"
      aria-label={`${palette.displayName} team`}
      style={{ borderTopColor: palette.iconColor }}
    >
      <header className="team-column-header">
        <span
          className="team-swatch"
          style={{ background: palette.iconColor }}
        />
        <h2>{palette.displayName}</h2>
        {localIsOnTeam ? null : (
          <button
            type="button"
            onClick={() => onJoinTeam(teamId)}
            disabled={disabled}
          >
            Join
          </button>
        )}
      </header>
      {slots.map((slot) => (
        <SlotCard
          key={slot.slotId}
          slot={slot}
          editable={!disabled && canEditSlot(slot, roster, localSessionId)}
          isEditing={slot.slotId === editingSlotId}
          onEdit={onEditSlot}
        />
      ))}
    </section>
  );
}
