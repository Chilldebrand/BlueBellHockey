import type { CSSProperties } from "react";
import {
  TEAM_IDENTITIES,
  TEAM_IDENTITY_IDS,
  teamIdentityFor,
  type TeamId,
  type TeamIdentityId
} from "@bbh/arcade-core";
import type { ClientRosterSlot } from "../store.js";
import { canEditSlot, canEditTeamIdentity } from "./lobbyPermissions.js";
import { SlotCard } from "./SlotCard.js";

export interface TeamColumnProps {
  readonly teamId: TeamId;
  /** This team's slots, index-sorted. */
  readonly slots: readonly ClientRosterSlot[];
  readonly roster: readonly ClientRosterSlot[];
  readonly localSessionId: string | null;
  readonly editingSlotId: string | null;
  readonly disabled: boolean;
  /** Whether the local player (room creator) may kick humans from slots. */
  readonly canKick?: boolean;
  /** The identity this side currently wears. */
  readonly identityId?: TeamIdentityId;
  /** The OTHER side's identity — rendered as taken in the picker. */
  readonly opposingIdentityId?: TeamIdentityId;
  readonly onJoinTeam: (teamId: TeamId) => void;
  readonly onEditSlot: (slotId: string) => void;
  readonly onKickPlayer?: (sessionId: string) => void;
  /** Captain-only identity pick; omit to hide the swatch row. */
  readonly onSetTeamIdentity?: (identityId: TeamIdentityId) => void;
}

/** One team's panel: header (name + join) over its three slot cards. */
export function TeamColumn({
  teamId,
  slots,
  roster,
  localSessionId,
  editingSlotId,
  disabled,
  canKick = false,
  identityId,
  opposingIdentityId,
  onJoinTeam,
  onEditSlot,
  onKickPlayer,
  onSetTeamIdentity
}: TeamColumnProps): JSX.Element {
  const identity = teamIdentityFor(teamId, identityId);
  const localIsOnTeam = slots.some((slot) => slot.isOwnedByLocalPlayer);
  const isCaptainOfTeam = canEditTeamIdentity(teamId, roster, localSessionId);
  const canPick = Boolean(onSetTeamIdentity) && isCaptainOfTeam && !disabled;

  return (
    <section
      className={`team-column team-column--${teamId}`}
      aria-label={`${identity.displayName} team`}
      style={
        {
          "--team-color": identity.iconColor,
          "--team-jersey": identity.uniform.jersey
        } as CSSProperties
      }
    >
      <header className="team-column-header">
        <h2>{identity.displayName}</h2>
        {localIsOnTeam ? null : (
          <button
            type="button"
            className="team-join-button"
            onClick={() => onJoinTeam(teamId)}
            disabled={disabled}
          >
            Join
          </button>
        )}
      </header>
      {onSetTeamIdentity ? (
        <div
          className="team-identity-picker"
          role="group"
          aria-label={`${identity.displayName} identity`}
        >
          {TEAM_IDENTITY_IDS.map((candidateId) => {
            const candidate = TEAM_IDENTITIES[candidateId];
            const isActive = candidateId === identity.id;
            const isTaken = candidateId === opposingIdentityId;

            return (
              <button
                key={candidateId}
                type="button"
                className={[
                  "team-identity-swatch",
                  isActive ? "is-active" : "",
                  isTaken ? "is-taken" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ background: candidate.uniform.jersey }}
                title={
                  isTaken
                    ? `${candidate.displayName} (taken)`
                    : candidate.displayName
                }
                aria-label={candidate.displayName}
                aria-pressed={isActive}
                disabled={!canPick || isTaken || isActive}
                onClick={() => onSetTeamIdentity(candidateId)}
              >
                <span className="team-identity-swatch-short">
                  {candidate.shortName}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="team-column-slots">
        {slots.map((slot) => (
          <SlotCard
            key={slot.slotId}
            slot={slot}
            editable={!disabled && canEditSlot(slot, roster, localSessionId)}
            isEditing={slot.slotId === editingSlotId}
            canKick={
              canKick &&
              slot.kind === "human" &&
              !slot.isOwnedByLocalPlayer &&
              slot.sessionId !== null
            }
            onEdit={onEditSlot}
            onKick={onKickPlayer}
          />
        ))}
      </div>
    </section>
  );
}
