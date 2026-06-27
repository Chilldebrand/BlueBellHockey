import { useId, useState } from "react";
import type { CharacterId, TeamId } from "@bbh/arcade-core";
import type { ArcadeClientState, ClientRosterSlot } from "../store.js";
import { CharacterSelect } from "./CharacterSelect.js";
import { TeamSelect } from "./TeamSelect.js";

export interface LobbyProps {
  readonly state: ArcadeClientState;
  readonly onQuickMatch: () => void;
  readonly onCreatePrivateRoom: () => void;
  readonly onJoinPrivateRoom: (code: string) => void;
  readonly onChooseTeam: (teamId: TeamId) => void;
  readonly onChooseCharacter: (characterId: CharacterId) => void;
  readonly onRequestStart: () => void;
}

export function Lobby({
  state,
  onQuickMatch,
  onCreatePrivateRoom,
  onJoinPrivateRoom,
  onChooseTeam,
  onChooseCharacter,
  onRequestStart
}: LobbyProps): JSX.Element {
  const [joinCode, setJoinCode] = useState("");
  const joinInputId = useId();
  const isConnecting = state.connectionStatus === "connecting";
  const isConnected = state.connectionStatus === "connected";
  const roomLabel =
    state.roomCode || (isConnected ? "Quick match room" : "No room joined");

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
            <p>
              Score {state.score.home}-{state.score.away}
            </p>
          </div>
          {state.isRosterValid ? (
            <button type="button" onClick={onRequestStart}>
              Start Match
            </button>
          ) : null}
        </header>
        <TeamSelect disabled={!isConnected} onChooseTeam={onChooseTeam} />
        <CharacterSelect
          roster={state.roster}
          localSessionId={state.playerSessionId}
          disabled={!isConnected}
          onChooseCharacter={onChooseCharacter}
        />
        <div className="teams">
          <TeamRoster teamName="Home" slots={slotsForTeam(state, "home")} />
          <TeamRoster teamName="Away" slots={slotsForTeam(state, "away")} />
        </div>
      </section>
    </main>
  );
}

function TeamRoster({
  teamName,
  slots
}: {
  readonly teamName: string;
  readonly slots: readonly ClientRosterSlot[];
}): JSX.Element {
  return (
    <section aria-label={`${teamName} team`}>
      <h2>{teamName}</h2>
      <ol>
        {slots.map((slot) => (
          <li key={slot.slotId}>
            <span>{slot.slotId}</span>
            <strong>{slot.displayName}</strong>
            <small>{slot.characterId}</small>
            {slot.isOwnedByLocalPlayer ? <em>You</em> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function slotsForTeam(
  state: ArcadeClientState,
  teamId: TeamId
): readonly ClientRosterSlot[] {
  return state.roster.filter((slot) => slot.teamId === teamId);
}
