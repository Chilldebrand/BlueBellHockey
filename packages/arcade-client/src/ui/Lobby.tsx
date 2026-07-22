import { useEffect, useId, useRef, useState } from "react";
import {
  GOAL_LIMIT_OPTIONS,
  TEAM_PALETTES,
  TIME_LIMIT_OPTIONS_MS,
  type CharacterId,
  type MatchRules,
  type TeamId
} from "@bbh/arcade-core";
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
  readonly onSetPlayerName: (playerName: string) => void;
  readonly onSetReady: (ready: boolean) => void;
  readonly onSetMatchRules: (rules: MatchRules) => void;
  readonly onRequestStart: () => void;
  readonly onKickPlayer?: (sessionId: string) => void;
  readonly onOpenSettings?: () => void;
}

export function Lobby({
  state,
  onQuickMatch,
  onCreatePrivateRoom,
  onJoinPrivateRoom,
  onChooseTeam,
  onChooseCharacterFor,
  onSetPlayerName,
  onSetReady,
  onSetMatchRules,
  onRequestStart,
  onKickPlayer,
  onOpenSettings
}: LobbyProps): JSX.Element {
  const [joinCode, setJoinCode] = useState("");
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesDraft, setRulesDraft] = useState<MatchRules | null>(null);
  const pendingRulesRef = useRef<MatchRules | null>(null);
  const joinInputId = useId();
  const isConnecting = state.connectionStatus === "connecting";
  const isConnected = state.connectionStatus === "connected";
  const roomLabel =
    state.roomCode || (isConnected ? "Quick match room" : "No room joined");

  const localSlot =
    state.roster.find((slot) => slot.isOwnedByLocalPlayer) ?? null;
  const [playerName, setPlayerName] = useState(localSlot?.playerName ?? "");
  const isCreator =
    state.roomCreatorSessionId !== null &&
    state.roomCreatorSessionId === state.playerSessionId;
  const allHumansReady =
    state.roster.some((slot) => slot.kind === "human") &&
    state.roster
      .filter((slot) => slot.kind === "human")
      .every((slot) => slot.ready);
  const canSetReady = Boolean(localSlot?.playerName?.trim());
  const canStart = isConnected && state.isRosterValid && allHumansReady;
  const rulesAvailable = isConnected && state.phase === "waiting";
  const canEditRules = rulesAvailable && isCreator;
  const rulesDraftScope = {
    roomCode: state.roomCode,
    playerSessionId: state.playerSessionId,
    rulesAvailable
  };
  const previousRulesRef = useRef(state.rules);
  const rulesDraftScopeRef = useRef(rulesDraftScope);
  const draftBelongsToCurrentScope = !hasRulesDraftScopeChanged(
    rulesDraftScopeRef.current,
    rulesDraftScope
  );
  const visibleRules = draftBelongsToCurrentScope
    ? rulesDraft ?? state.rules
    : state.rules;

  // Default the picker to your own slot once connected, preserving the old
  // "pick your character immediately" flow.
  useEffect(() => {
    if (localSlot) {
      setEditingSlotId((current) => current ?? localSlot.slotId);
    } else {
      setEditingSlotId(null);
    }
  }, [localSlot?.slotId]);

  useEffect(() => {
    setPlayerName(localSlot?.playerName ?? "");
  }, [localSlot?.playerName]);

  useEffect(() => {
    const nextDraft = reconcileMatchRulesDraft(
      pendingRulesRef.current,
      state.rules,
      {
        previousReplicatedRules: previousRulesRef.current,
        previousScope: rulesDraftScopeRef.current,
        scope: rulesDraftScope
      }
    );
    previousRulesRef.current = state.rules;
    rulesDraftScopeRef.current = rulesDraftScope;

    if (nextDraft !== pendingRulesRef.current) {
      pendingRulesRef.current = nextDraft;
      setRulesDraft(nextDraft);
    }
  }, [rulesAvailable, state.playerSessionId, state.roomCode, state.rules]);

  const selectMatchRules = (update: Partial<MatchRules>) => {
    const nextRules = nextMatchRulesDraft(
      draftBelongsToCurrentScope ? pendingRulesRef.current : null,
      state.rules,
      update
    );

    pendingRulesRef.current = nextRules;
    setRulesDraft(nextRules);
    onSetMatchRules(nextRules);
  };

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

  const clockSeconds = Math.max(
    0,
    Math.ceil((state.currentWorld?.remainingMs ?? 0) / 1000)
  );

  return (
    <main className="arcade-shell">
      <div className="lobby-backdrop" aria-hidden="true" />

      <div className="lobby-content">
        <header className="lobby-scoreboard" aria-label="Score">
          <div className="lobby-scoreboard-side">
            <span className="lobby-scoreboard-team lobby-scoreboard-team--home">
              {TEAM_PALETTES.home.shortName}
            </span>
            <span className="lobby-scoreboard-digits">{state.score.home}</span>
          </div>
          <div className="lobby-scoreboard-center">
            <span className="lobby-scoreboard-clock">
              {formatClock(clockSeconds)}
            </span>
            <span className="lobby-scoreboard-phase">{state.phase}</span>
          </div>
          <div className="lobby-scoreboard-side">
            <span className="lobby-scoreboard-digits">{state.score.away}</span>
            <span className="lobby-scoreboard-team lobby-scoreboard-team--away">
              {TEAM_PALETTES.away.shortName}
            </span>
          </div>
        </header>

        <section className="connection-panel" aria-label="Room connection">
          <div className="connection-actions">
            <button
              type="button"
              className="connection-button connection-button--primary"
              onClick={onQuickMatch}
              disabled={isConnecting}
            >
              Quick Match
            </button>
            <button
              type="button"
              className="connection-button"
              onClick={onCreatePrivateRoom}
              disabled={isConnecting}
            >
              Create Private
            </button>
            <label className="visually-hidden" htmlFor={joinInputId}>
              Code
            </label>
            <input
              id={joinInputId}
              className="connection-code-input"
              placeholder="CODE"
              value={joinCode}
              onChange={(event) => setJoinCode(event.currentTarget.value)}
              disabled={isConnecting}
              maxLength={8}
            />
            <button
              type="button"
              className="connection-button"
              onClick={() => onJoinPrivateRoom(joinCode)}
              disabled={isConnecting || !joinCode.trim()}
            >
              Join
            </button>
          </div>
          <p className="lobby-room-label">
            {state.roomCode ? `Room ${roomLabel}` : roomLabel}
          </p>
          {state.error ? <p role="alert">{state.error}</p> : null}
        </section>

        <section className="lobby-panel" aria-label="Lobby roster">
          <div className="lobby-teams">
            <TeamColumn
              teamId="home"
              slots={slotsForTeam(state, "home")}
              roster={state.roster}
              localSessionId={state.playerSessionId}
              editingSlotId={editingSlot?.slotId ?? null}
              disabled={!isConnected}
              canKick={isCreator && isConnected}
              onJoinTeam={onChooseTeam}
              onEditSlot={setEditingSlotId}
              onKickPlayer={onKickPlayer}
            />
            <div className="lobby-faceoff" aria-hidden="true">
              <div className="lobby-faceoff-medallion">
                <span>VS</span>
              </div>
              <div className="lobby-faceoff-caption">
                Faceoff
                <br />
                pending
              </div>
            </div>
            <TeamColumn
              teamId="away"
              slots={slotsForTeam(state, "away")}
              roster={state.roster}
              localSessionId={state.playerSessionId}
              editingSlotId={editingSlot?.slotId ?? null}
              disabled={!isConnected}
              canKick={isCreator && isConnected}
              onJoinTeam={onChooseTeam}
              onEditSlot={setEditingSlotId}
              onKickPlayer={onKickPlayer}
            />
          </div>

          <div className="lobby-player-controls">
            {localSlot ? (
              <>
                <input
                  name="player-name"
                  className="lobby-name-input"
                  aria-label="Your name"
                  value={playerName}
                  onChange={(event) => {
                    const nextPlayerName = event.currentTarget.value;
                    setPlayerName(nextPlayerName);
                    onSetPlayerName(nextPlayerName);
                  }}
                  disabled={!isConnected}
                  maxLength={24}
                />
                <button
                  type="button"
                  className="lobby-ready-button"
                  aria-pressed={localSlot.ready}
                  onClick={() => onSetReady(!localSlot.ready)}
                  disabled={!isConnected || !canSetReady}
                >
                  {localSlot.ready ? "Unready" : "Ready Up"}
                </button>
              </>
            ) : null}
            {onOpenSettings ? (
              <button
                type="button"
                className="lobby-settings-button"
                onClick={onOpenSettings}
              >
                Settings
              </button>
            ) : null}
            {rulesAvailable ? (
              <button
                type="button"
                className="lobby-rules-button"
                aria-expanded={rulesOpen}
                aria-controls="lobby-match-rules"
                onClick={() => setRulesOpen((open) => !open)}
              >
                Rules
              </button>
            ) : null}
            {isCreator ? (
              <button
                type="button"
                className="lobby-start-button"
                onClick={onRequestStart}
                disabled={!canStart}
              >
                Start Match
              </button>
            ) : null}
          </div>

          {rulesAvailable ? (
            <section
              id="lobby-match-rules"
              className="lobby-rules-panel"
              aria-label="Match rules"
              hidden={!rulesOpen}
            >
              <div className="lobby-rules-group">
                <h3>Time limit</h3>
                <div className="lobby-rules-presets">
                  {TIME_LIMIT_OPTIONS_MS.map((timeLimitMs) => (
                    <button
                      key={timeLimitMs}
                      type="button"
                      className="lobby-rules-preset"
                      aria-pressed={visibleRules.timeLimitMs === timeLimitMs}
                      disabled={!canEditRules}
                      onClick={() => selectMatchRules({ timeLimitMs })}
                    >
                      {timeLimitMs / 60_000} min
                    </button>
                  ))}
                </div>
              </div>
              <div className="lobby-rules-group">
                <h3>Goal limit</h3>
                <div className="lobby-rules-presets">
                  {GOAL_LIMIT_OPTIONS.map((goalLimit) => (
                    <button
                      key={goalLimit}
                      type="button"
                      className="lobby-rules-preset"
                      aria-pressed={visibleRules.goalLimit === goalLimit}
                      disabled={!canEditRules}
                      onClick={() => selectMatchRules({ goalLimit })}
                    >
                      {goalLimit === 0 ? "No limit" : `${goalLimit} goals`}
                    </button>
                  ))}
                </div>
              </div>
              {!canEditRules ? (
                <p className="lobby-rules-help">Host controls rules</p>
              ) : null}
            </section>
          ) : null}

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
      </div>
    </main>
  );
}

export function nextMatchRulesDraft(
  pendingRules: MatchRules | null,
  replicatedRules: MatchRules,
  update: Partial<MatchRules>
): MatchRules {
  return { ...(pendingRules ?? replicatedRules), ...update };
}

export function reconcileMatchRulesDraft(
  pendingRules: MatchRules | null,
  replicatedRules: MatchRules,
  {
    previousReplicatedRules,
    previousScope,
    scope
  }: MatchRulesDraftReconciliationOptions = {}
): MatchRules | null {
  if (
    !pendingRules ||
    hasRulesDraftScopeChanged(previousScope, scope) ||
    sameMatchRules(pendingRules, replicatedRules)
  ) {
    return null;
  }

  if (
    !previousReplicatedRules ||
    sameMatchRules(previousReplicatedRules, replicatedRules) ||
    isPartialOptimisticRulesAcknowledgement(
      pendingRules,
      previousReplicatedRules,
      replicatedRules
    )
  ) {
    return pendingRules;
  }

  return null;
}

interface MatchRulesDraftReconciliationOptions {
  readonly previousReplicatedRules?: MatchRules;
  readonly previousScope?: RulesDraftScope;
  readonly scope?: RulesDraftScope;
}

interface RulesDraftScope {
  readonly roomCode: string;
  readonly playerSessionId: string | null;
  readonly rulesAvailable: boolean;
}

function hasRulesDraftScopeChanged(
  previousScope: RulesDraftScope | undefined,
  scope: RulesDraftScope | undefined
): boolean {
  if (!previousScope || !scope) {
    return false;
  }

  return (
    previousScope.roomCode !== scope.roomCode ||
    previousScope.playerSessionId !== scope.playerSessionId ||
    previousScope.rulesAvailable !== scope.rulesAvailable
  );
}

function sameMatchRules(first: MatchRules, second: MatchRules): boolean {
  return (
    first.timeLimitMs === second.timeLimitMs &&
    first.goalLimit === second.goalLimit
  );
}

function isPartialOptimisticRulesAcknowledgement(
  pendingRules: MatchRules,
  previousReplicatedRules: MatchRules,
  replicatedRules: MatchRules
): boolean {
  return (
    (replicatedRules.timeLimitMs === previousReplicatedRules.timeLimitMs ||
      replicatedRules.timeLimitMs === pendingRules.timeLimitMs) &&
    (replicatedRules.goalLimit === previousReplicatedRules.goalLimit ||
      replicatedRules.goalLimit === pendingRules.goalLimit)
  );
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function slotsForTeam(
  state: ArcadeClientState,
  teamId: TeamId
): readonly ClientRosterSlot[] {
  return [...state.roster]
    .filter((slot) => slot.teamId === teamId)
    .sort((a, b) => a.index - b.index);
}
