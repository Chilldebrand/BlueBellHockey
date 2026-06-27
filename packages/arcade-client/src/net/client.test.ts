import { describe, expect, it, vi } from "vitest";
import { createInitialArcadeClientState, reduceArcadeClientState } from "../store.js";
import {
  ArcadeRoomConnection,
  connectQuickMatch,
  createPrivateRoom,
  joinPrivateRoom
} from "./client.js";

function serverState(): ArcadeRoomConnection["state"] {
  return {
    phase: "waiting",
    privateCode: "PUCK42",
    score: { home: 1, away: 2 },
    teams: {
      home: {
        slots: [
          {
            slotId: "home-skater-1",
            teamId: "home",
            index: 0,
            kind: "human",
            sessionId: "session-a",
            playerName: "Ada",
            botId: null,
            characterId: "rook-rocket",
            isBot: false
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
            isBot: true
          }
        ]
      },
      away: {
        slots: [
          {
            slotId: "away-skater-1",
            teamId: "away",
            index: 0,
            kind: "bot",
            sessionId: null,
            playerName: null,
            botId: "bot-away-skater-1",
            characterId: "dash-iron",
            isBot: true
          }
        ]
      }
    }
  };
}

function fakeRoom(state = serverState()): ArcadeRoomConnection {
  return {
    sessionId: "session-a",
    state,
    onStateChange: vi.fn(),
    onError: vi.fn(),
    onLeave: vi.fn(),
    send: vi.fn()
  };
}

describe("arcade client state mapping", () => {
  it("maps authoritative room state without inventing missing match fields", () => {
    const next = reduceArcadeClientState(createInitialArcadeClientState(), {
      type: "room.state",
      room: fakeRoom()
    });

    expect(next).toMatchObject({
      connectionStatus: "connected",
      roomCode: "PUCK42",
      playerSessionId: "session-a",
      score: { home: 1, away: 2 },
      phase: "waiting",
      error: null
    });
    expect(next.roster.map((slot) => slot.slotId)).toEqual([
      "home-skater-1",
      "home-skater-2",
      "away-skater-1"
    ]);
    expect(next.roster[0]).toMatchObject({
      kind: "human",
      displayName: "Ada",
      isOwnedByLocalPlayer: true
    });
    expect(next.roster[1]).toMatchObject({
      kind: "bot",
      displayName: "Bot",
      isOwnedByLocalPlayer: false
    });
  });

  it("records connection errors in UI state", () => {
    const next = reduceArcadeClientState(
      { ...createInitialArcadeClientState(), connectionStatus: "connecting" },
      { type: "connection.error", message: "room not found" }
    );

    expect(next.connectionStatus).toBe("error");
    expect(next.error).toBe("room not found");
  });
});

describe("arcade room connection", () => {
  it("joins quick match with the arcade room filter expected by the server", async () => {
    const room = fakeRoom();
    const matchmaker = { joinOrCreate: vi.fn().mockResolvedValue(room) };

    await connectQuickMatch({ matchmaker });

    expect(matchmaker.joinOrCreate).toHaveBeenCalledWith("arcade", {
      mode: "arcade3v3",
      privateCode: "",
      quickMatch: true
    });
  });

  it("creates and joins private rooms with normalized client-generated codes", async () => {
    const room = fakeRoom();
    const matchmaker = { create: vi.fn().mockResolvedValue(room) };

    const result = await createPrivateRoom({
      matchmaker,
      codeGenerator: () => " puck42 "
    });

    expect(result.code).toBe("PUCK42");
    expect(matchmaker.create).toHaveBeenCalledWith("arcade", {
      mode: "arcade3v3",
      privateCode: "PUCK42",
      quickMatch: false
    });
  });

  it("joins private rooms by normalized code and sends team choices to the room", async () => {
    const room = fakeRoom();
    const matchmaker = { join: vi.fn().mockResolvedValue(room) };

    const result = await joinPrivateRoom(" puck42 ", { matchmaker });
    result.connection.chooseTeam("away");
    result.connection.chooseCharacter("milo-ghost");
    result.connection.requestStart();
    result.connection.sendInput({
      playerId: "session-a",
      slotId: "home-skater-1",
      sequence: 1,
      moveX: 1,
      moveY: 0,
      aimX: 0,
      aimY: 0,
      pass: false,
      shoot: false,
      check: false,
      turbo: false,
      switchTarget: false,
      usePowerup: false,
      special: false
    });

    expect(matchmaker.join).toHaveBeenCalledWith("arcade", {
      mode: "arcade3v3",
      privateCode: "PUCK42",
      quickMatch: false
    });
    expect(room.send).toHaveBeenCalledWith("client.chooseTeam", {
      teamId: "away"
    });
    expect(room.send).toHaveBeenCalledWith("client.chooseCharacter", {
      characterId: "milo-ghost"
    });
    expect(room.send).toHaveBeenCalledWith("client.requestStart");
    expect(room.send).toHaveBeenCalledWith("client.input", {
      type: "client.input",
      frame: expect.objectContaining({
        slotId: "home-skater-1",
        moveX: 1
      })
    });
  });
});
