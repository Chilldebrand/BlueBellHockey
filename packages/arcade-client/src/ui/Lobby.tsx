import { useEffect, useId, useState } from "react";
import type { CharacterId, TeamId } from "@bbh/arcade-core";
import type { ArcadeClientState, ClientRosterSlot } from "../store.js";
import { CharacterSelect } from "./CharacterSelect.js";
import { canEditSlot } from "./lobbyPermissions.js";
import { slotLabel } from "./SlotCard.js";
import { TeamColumn } from "./TeamColumn.js";

export interface LobbyProps {
  readonly state: ArcadeClientState;
  readonly onQuickMatch: () => void;
  readonly onCreatePrivateRoom: () => void;
  readonly onJoinPrivateRoom: (code: string) => void;
  readonly onChooseTeam: (teamId: TeamId) => void;
  readonly onChooseCharacterFor: (
    slotId: string,
    characterId: CharacterId
  ) => void;
  readonly onRequestStart: () => void;
  readonly onOpenSettings?: () => void;
}

export function Lobby({
  state,
  onQuickMatch,
  onCreatePrivateRoom,
  onJoinPrivateRoom,
  onChooseTeam,
  onChooseCharacterFor,
  onRequestStart,
  onOpenSettings
}: LobbyProps): JSX.Element {
  const [joinCode, setJoinCode] = useState("");
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const joinInputId = useId();
  const isConnecting = state.connectionStatus === "connecting";
  const isConnected = state.connectionStatus === "connected";
  const roomLabel =
    state.roomCode || (isConnected ? "Quick match room" : "No room joined");

  const localSlot =
    state.roster.find((slot) => slot.isOwnedByLocalPlayer) ?? null;

  // Default the picker to your own slot once connected, preserving the old
  // "pick your character immediately" flow.
  useEffect(() => {
    if (localSlot) {
      setEditingSlotId((current) => current ?? localSlot.slotId);
    } else {
      setEditingSlotId(null);
    }
  }, [localSlot?.slotId]);

  // Guard stale targets at RENDER time (lost captaincy, team switch, slot
  // became human): fall back to the local player's own slot, never a
  // forbidden-UI frame.
  const requestedSlot = editingSlotId
    ? state.roster.find((slot) => slot.slotId === editingSlotId) ?? null
    : null;
  const editingSlot =
    requestedSlot &&
    canEditSlot(requestedSlot, state.roster, state.playerSessionId)
      ? requestedSlot
      : localSlot;

  return (
    <main className="arcade-shell">
      <section className="connection-panel" aria-label="Room connection">
        <div>
          <h1>BBH Arcade</h1>
          <p>{state.roomCode ? `Room ${roomLabel}` : roomLabel}</p>
        </div>
        <div className="connection-actions">
          <button type="button" onClick={onQuickMatch} disabled={isConnecting}>
            Quick Match
          </button>
          <button
            type="button"
            onClick={onCreatePrivateRoom}
            disabled={isConnecting}
          >
            Create Private
          </button>
          <label htmlFor={joinInputId}>Code</label>
          <input
            id={joinInputId}
            value={joinCode}
            onChange={(event) => setJoinCode(event.currentTarget.value)}
            disabled={isConnecting}
            maxLength={8}
          />
          <button
            type="button"
            onClick={() => onJoinPrivateRoom(joinCode)}
            disabled={isConnecting || !joinCode.trim()}
          >
            Join Private
          </button>
        </div>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </section>

      <section className="lobby-panel" aria-label="Lobby roster">
        <header>
          <div>
            <p>Phase {state.phase}</p>
          </div>
          <div className="lobby-panel-actions">
            {onOpenSettings ? (
              <button type="button" onClick={onOpenSettings}>
                Settings
              </button>
            ) : null}
            {state.isRosterValid ? (
              <button type="button" onClick={onRequestStart}>
                Start Match
              </button>
            ) : null}
          </div>
        </header>
        <div className="lobby-teams">
          {(["home", "away"] as const).map((teamId) => (
            <TeamColumn
              key={teamId}
              teamId={teamId}
              slots={slotsForTeam(state, teamId)}
              roster={state.roster}
              localSessionId={state.playerSessionId}
              editingSlotId={editingSlot?.slotId ?? null}
              disabled={!isConnected}
              onJoinTeam={onChooseTeam}
              onEditSlot={setEditingSlotId}
            />
          ))}
        </div>
        {editingSlot ? (
          <CharacterSelect
            selectedCharacterId={editingSlot.characterId}
            headline={`Pick for ${slotLabel(editingSlot)}`}
            disabled={!isConnected}
            onChooseCharacter={(characterId) =>
              onChooseCharacterFor(editingSlot.slotId, characterId)
            }
            onClose={() => setEditingSlotId(localSlot?.slotId ?? null)}
          />
        ) : null}
      </section>
    </main>
  );
}

function slotsForTeam(
  state: ArcadeClientState,
  teamId: TeamId
): readonly ClientRosterSlot[] {
  return [...state.roster]
    .filter((slot) => slot.teamId === teamId)
    .sort((a, b) => a.index - b.index);
}
