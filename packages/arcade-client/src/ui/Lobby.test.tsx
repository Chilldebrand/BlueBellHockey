import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createInitialArcadeClientState, type ArcadeClientState } from "../store.js";
import { Lobby } from "./Lobby.js";

function lobbyState(overrides: Partial<ArcadeClientState> = {}): ArcadeClientState {
  return {
    ...createInitialArcadeClientState(),
    connectionStatus: "connected",
    roomCode: "PUCK42",
    playerSessionId: "session-a",
    phase: "waiting",
    roster: [
      {
        slotId: "home-skater-1",
        teamId: "home",
        index: 0,
        kind: "human",
        sessionId: "session-a",
        playerName: "Ada",
        ready: false,
        botId: null,
        characterId: "rook-rocket",
        displayName: "Ada",
        isBot: false,
        isCaptain: true,
        teamJoinOrder: 1,
        isOwnedByLocalPlayer: true,
        controlledGoalieId: null
      },
      {
        slotId: "home-skater-2",
        teamId: "home",
        index: 1,
        kind: "bot",
        sessionId: null,
        playerName: null,
        ready: false,
        botId: "bot-home-skater-2",
        characterId: "nova-screen",
        displayName: "Bot",
        isBot: true,
        isCaptain: false,
        teamJoinOrder: null,
        isOwnedByLocalPlayer: false,
        controlledGoalieId: null
      },
      {
        slotId: "away-skater-1",
        teamId: "away",
        index: 0,
        kind: "bot",
        sessionId: null,
        playerName: null,
        ready: false,
        botId: "bot-away-skater-1",
        characterId: "dash-iron",
        displayName: "Bot",
        isBot: true,
        isCaptain: false,
        teamJoinOrder: null,
        isOwnedByLocalPlayer: false,
        controlledGoalieId: null
      }
    ],
    ...overrides
  };
}

function renderLobby(state: ArcadeClientState): string {
  return renderToStaticMarkup(
    <Lobby
      state={state}
      onChooseTeam={vi.fn()}
      onCreatePrivateRoom={vi.fn()}
      onJoinPrivateRoom={vi.fn()}
      onChooseCharacterFor={vi.fn()}
      onQuickMatch={vi.fn()}
      onRequestStart={vi.fn()}
      onSetPlayerName={vi.fn()}
      onSetReady={vi.fn()}
      onSetMatchRules={vi.fn()}
    />
  );
}

describe("Lobby", () => {
  it("renders team columns with player names and bot character cards", () => {
    const html = renderLobby(lobbyState());

    expect(html).toContain("Room PUCK42");
    expect(html).toContain("Blue Blades");
    expect(html).toContain("Red Rockets");
    expect(html).toContain("Ada");
    // Bots are labeled by slot number and show their character's name.
    expect(html).toContain("Bot 2");
    expect(html).toContain("Nova Screen");
    expect(html).toContain("Dash Iron");
  });

  it("marks the captain and the local player, and offers joining the other team", () => {
    const html = renderLobby(lobbyState());

    // Exactly one captain badge (Ada) and one You badge.
    expect(html.match(/captain-badge/g)).toHaveLength(1);
    expect(html.match(/you-badge/g)).toHaveLength(1);
    // Local player is on home: away column offers Join, home does not.
    expect(html.match(/team-join-button/g)).toHaveLength(1);
  });

  it("defaults the character picker to the local player's own slot", () => {
    const html = renderLobby(lobbyState());

    expect(html).toContain("Pick for Ada");
    expect(html).toContain("Rook Rocket");
  });

  it("shows connection errors and disables connection actions while connecting", () => {
    const html = renderLobby(
      lobbyState({
        connectionStatus: "connecting",
        error: "room not found"
      })
    );

    expect(html).toContain("room not found");
    expect(html).toContain("disabled=\"\"");
  });

  it("renders the local name and readiness while limiting start to a ready creator", () => {
    const local = lobbyState().roster[0];
    const teammate = {
      ...local,
      slotId: "home-skater-2",
      index: 1,
      sessionId: "session-b",
      playerName: "Bo",
      displayName: "Bo",
      isCaptain: false,
      isOwnedByLocalPlayer: false,
      ready: false,
      teamJoinOrder: 2
    };
    const waitingHtml = renderLobby(
      lobbyState({
        isRosterValid: true,
        roomCreatorSessionId: "session-a",
        roster: [{ ...local, ready: true }, teammate]
      })
    );
    const readyHtml = renderLobby(
      lobbyState({
        isRosterValid: true,
        roomCreatorSessionId: "session-a",
        roster: [{ ...local, ready: true }, { ...teammate, ready: true }]
      })
    );
    const nonCreatorHtml = renderLobby(
      lobbyState({
        isRosterValid: true,
        roomCreatorSessionId: "session-b",
        roster: [{ ...local, ready: true }, { ...teammate, ready: true }]
      })
    );

    expect(waitingHtml).toContain('name="player-name"');
    expect(waitingHtml).toContain('value="Ada"');
    expect(waitingHtml).toContain("Ready");
    expect(waitingHtml).toContain("Not ready");
    expect(waitingHtml).toMatch(/<button[^>]*disabled=""[^>]*>Start Match<\/button>/);
    expect(readyHtml).toContain(">Start Match</button>");
    expect(readyHtml).not.toMatch(/<button[^>]*disabled=""[^>]*>Start Match<\/button>/);
    expect(nonCreatorHtml).not.toContain("Start Match");
  });

  it("shows the host every core rule preset", () => {
    const html = renderLobby(
      lobbyState({ roomCreatorSessionId: "session-a" })
    );

    expect(html).toContain("Rules");
    expect(html).toContain("3 min");
    expect(html).toContain("5 min");
    expect(html).toContain("7 min");
    expect(html).toContain("10 min");
    expect(html).toContain("No limit");
    expect(html).toContain("3 goals");
    expect(html).toContain("5 goals");
    expect(html).toContain("7 goals");
    expect(html).toContain("10 goals");
    expect(html).not.toContain("Host controls rules");
  });

  it("shows non-host participants the current rules but disables their presets", () => {
    const html = renderLobby(
      lobbyState({
        roomCreatorSessionId: "session-b",
        rules: { timeLimitMs: 420_000, goalLimit: 7 }
      })
    );

    expect(html).toContain("7 min");
    expect(html).toContain("7 goals");
    expect(html).toContain("Host controls rules");
    expect(html.match(/lobby-rules-preset[^>]*disabled=""/g)).toHaveLength(9);
  });
});
