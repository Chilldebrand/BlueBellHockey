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
        isOwnedByLocalPlayer: false
      }
    ],
    ...overrides
  };
}

describe("Lobby", () => {
  it("renders humans and server-provided bots in skater slots", () => {
    const html = renderToStaticMarkup(
      <Lobby
        state={lobbyState()}
        onChooseTeam={vi.fn()}
        onCreatePrivateRoom={vi.fn()}
        onJoinPrivateRoom={vi.fn()}
        onChooseCharacter={vi.fn()}
        onQuickMatch={vi.fn()}
        onRequestStart={vi.fn()}
      />
    );

    expect(html).toContain("Room PUCK42");
    expect(html).toContain("Ada");
    expect(html.match(/>Bot</g)).toHaveLength(2);
    expect(html).toContain("home-skater-2");
    expect(html).toContain("away-skater-1");
  });

  it("shows connection errors and disables connection actions while connecting", () => {
    const html = renderToStaticMarkup(
      <Lobby
        state={lobbyState({
          connectionStatus: "connecting",
          error: "room not found"
        })}
        onChooseTeam={vi.fn()}
        onCreatePrivateRoom={vi.fn()}
        onJoinPrivateRoom={vi.fn()}
        onChooseCharacter={vi.fn()}
        onQuickMatch={vi.fn()}
        onRequestStart={vi.fn()}
      />
    );

    expect(html).toContain("room not found");
    expect(html).toContain("disabled=\"\"");
  });

  it("renders the start button only when the authoritative roster is valid", () => {
    const invalidHtml = renderToStaticMarkup(
      <Lobby
        state={lobbyState({ isRosterValid: false })}
        onChooseTeam={vi.fn()}
        onCreatePrivateRoom={vi.fn()}
        onJoinPrivateRoom={vi.fn()}
        onChooseCharacter={vi.fn()}
        onQuickMatch={vi.fn()}
        onRequestStart={vi.fn()}
      />
    );
    const validHtml = renderToStaticMarkup(
      <Lobby
        state={lobbyState({ isRosterValid: true })}
        onChooseTeam={vi.fn()}
        onCreatePrivateRoom={vi.fn()}
        onJoinPrivateRoom={vi.fn()}
        onChooseCharacter={vi.fn()}
        onQuickMatch={vi.fn()}
        onRequestStart={vi.fn()}
      />
    );

    expect(invalidHtml).not.toContain("Start Match");
    expect(validHtml).toContain("Start Match");
  });
});
