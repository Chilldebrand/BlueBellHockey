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
        botId: null,
        characterId: "rook-rocket",
        displayName: "Ada",
        isBot: false,
        isCaptain: true,
        isOwnedByLocalPlayer: true
      },
      {
        slotId: "home-skater-2",
        teamId: "home",
        index: 1,
        kind: "bot",
        sessionId: null,
        playerName: null,
        botId: "bot-home-skater-2",
        characterId: "nova-screen",
        displayName: "Bot",
        isBot: true,
        isCaptain: false,
        isOwnedByLocalPlayer: false
      },
      {
        slotId: "away-skater-1",
        teamId: "away",
        index: 0,
        kind: "bot",
        sessionId: null,
        playerName: null,
        botId: "bot-away-skater-1",
        characterId: "dash-iron",
        displayName: "Bot",
        isBot: true,
        isCaptain: false,
        isOwnedByLocalPlayer: false
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
    expect(html.match(/>Join</g)).toHaveLength(1);
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

  it("renders the start button only when the authoritative roster is valid", () => {
    const invalidHtml = renderLobby(lobbyState({ isRosterValid: false }));
    const validHtml = renderLobby(lobbyState({ isRosterValid: true }));

    expect(invalidHtml).not.toContain("Start Match");
    expect(validHtml).toContain("Start Match");
  });
});
