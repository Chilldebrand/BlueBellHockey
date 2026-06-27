import { MATCH_CONFIG, SKATER_SLOTS } from "@bbh/arcade-core";
import { describe, expect, it, vi } from "vitest";
import {
  ArcadeRoom,
  createPrivateRoomCode,
  normalizeArcadeRoomOptions
} from "./ArcadeRoom.js";

interface FakeClient {
  readonly sessionId: string;
}

function client(sessionId: string): FakeClient {
  return { sessionId };
}

function createTestRoom(options: ConstructorParameters<typeof ArcadeRoom>[0] = {}): ArcadeRoom {
  return new ArcadeRoom({
    ...options,
    startSimulation: false
  });
}

describe("ArcadeRoom", () => {
  it("initializes stable room state from private room options", () => {
    const room = createTestRoom();

    room.onCreate({
      privateCode: "PUCK42",
      quickMatch: false,
      mode: "arcade3v3"
    });

    expect(room.roomOptions).toEqual({
      privateCode: "PUCK42",
      quickMatch: false,
      mode: "arcade3v3"
    });
    expect(room.state.privateCode).toBe("PUCK42");
    expect(room.state.phase).toBe("waiting");
    expect(room.state.score).toMatchObject({ home: 0, away: 0 });
    expect(room.state.clock).toMatchObject({
      nowMs: 0,
      tick: 0,
      fixedTickMs: MATCH_CONFIG.fixedTickMs
    });
    expect(room.state.teams.home.slots).toHaveLength(3);
    expect(room.state.teams.away.slots).toHaveLength(3);
    expect(room.state.teams.home.slots[0]).toMatchObject({
      slotId: "home-skater-1",
      teamId: "home",
      kind: "bot",
      botId: "bot-home-skater-1",
      isBot: true
    });
    expect([
      ...room.state.teams.home.slots,
      ...room.state.teams.away.slots
    ]).toHaveLength(SKATER_SLOTS.length);
  });

  it("keeps quick match on an empty private-code filter when none is supplied", () => {
    const room = createTestRoom();

    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    const createdCode = room.state.privateCode;

    room.onJoin(client("session-a") as never, { playerName: "Ada" });

    expect(createdCode).toBe("");
    expect(room.state.privateCode).toBe(createdCode);
  });

  it("normalizes private room codes before room creation", () => {
    expect(createPrivateRoomCode(() => " puck42 ")).toBe("PUCK42");
    expect(
      normalizeArcadeRoomOptions({
        privateCode: " puck42 ",
        quickMatch: false,
        mode: "arcade3v3"
      })
    ).toEqual({
      privateCode: "PUCK42",
      quickMatch: false,
      mode: "arcade3v3"
    });
    expect(normalizeArcadeRoomOptions({ mode: "arcade3v3" })).toEqual({
      privateCode: "",
      quickMatch: true,
      mode: "arcade3v3"
    });
  });

  it("normalizes matchmaker options during auth before filtering", async () => {
    const quickOptions = { mode: "arcade3v3" as const };
    const privateOptions = {
      privateCode: " puck42 ",
      quickMatch: false,
      mode: "arcade3v3" as const
    };

    await expect(ArcadeRoom.onAuth("", quickOptions)).resolves.toBe(true);
    expect(quickOptions).toEqual({
      privateCode: "",
      quickMatch: true,
      mode: "arcade3v3"
    });

    await expect(ArcadeRoom.onAuth("", privateOptions)).resolves.toBe(true);
    expect(privateOptions).toEqual({
      privateCode: "PUCK42",
      quickMatch: false,
      mode: "arcade3v3"
    });
  });

  it("assigns joined humans to skater slots and fills the rest with bots", () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });

    room.onJoin(client("session-a") as never, { playerName: "Ada" });
    room.onJoin(client("session-b") as never, { playerName: "Grace" });

    const slots = [
      ...room.state.teams.home.slots,
      ...room.state.teams.away.slots
    ];

    expect(slots).toHaveLength(SKATER_SLOTS.length);
    expect(slots.filter((slot) => slot.kind === "human")).toHaveLength(2);
    expect(slots.filter((slot) => slot.kind === "bot")).toHaveLength(4);
    expect(slots[0]).toMatchObject({
      slotId: "home-skater-1",
      sessionId: "session-a",
      playerName: "Ada",
      isBot: false
    });
    expect(slots[2]).toMatchObject({
      kind: "bot",
      isBot: true,
      botId: "bot-home-skater-3"
    });
    expect(room.state.isRosterValid).toBe(true);
  });

  it("moves a joined player to the requested team from a client message", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const sender = vi
      .spyOn(room, "send")
      .mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const handler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.chooseTeam"
    )?.[1];

    expect(handler).toBeTypeOf("function");
    handler?.(clientA as never, { teamId: "away" });

    const slots = [
      ...room.state.teams.home.slots,
      ...room.state.teams.away.slots
    ];
    expect(slots.find((slot) => slot.sessionId === "session-a")).toMatchObject({
      teamId: "away",
      kind: "human",
      playerName: "Ada"
    });
    expect(sender).not.toHaveBeenCalled();
  });

  it("rejects malformed team selection messages without throwing", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const sender = vi
      .spyOn(room, "send")
      .mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const handler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.chooseTeam"
    )?.[1];

    expect(handler).toBeTypeOf("function");
    expect(() => handler?.(clientA as never, null)).not.toThrow();
    expect(sender).toHaveBeenCalledWith(clientA, "server.error", {
      message: "Invalid team."
    });
  });

  it("starts the authoritative room phase from a client start request", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const sender = vi
      .spyOn(room, "send")
      .mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const handler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.requestStart"
    )?.[1];

    expect(handler).toBeTypeOf("function");
    expect(room.state.phase).toBe("waiting");
    handler?.(clientA as never, undefined);

    expect(room.state.phase).toBe("playing");
    expect(sender).not.toHaveBeenCalled();
  });

  it("removes a leaving human without transferring another owned slot", () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ada" });
    room.onJoin(client("session-b") as never, { playerName: "Grace" });

    room.onLeave(client("session-a") as never);

    const slots = [
      ...room.state.teams.home.slots,
      ...room.state.teams.away.slots
    ];

    expect(slots[0]).toMatchObject({
      slotId: "home-skater-1",
      kind: "bot",
      sessionId: null,
      isBot: true
    });
    expect(slots[1]).toMatchObject({
      slotId: "home-skater-2",
      kind: "human",
      sessionId: "session-b",
      isBot: false
    });
  });

  it("rejects a seventh joined human", () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });

    for (let i = 0; i < 6; i += 1) {
      room.onJoin(client(`session-${i}`) as never, {
        playerName: `Player ${i}`
      });
    }

    expect(() =>
      room.onJoin(client("session-7") as never, { playerName: "Too Late" })
    ).toThrow("room is full");
  });

  it("broadcasts authoritative world snapshots on each tick", () => {
    const room = createTestRoom();
    const broadcast = vi
      .spyOn(room, "broadcast")
      .mockImplementation(() => room as never);

    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.tick();

    expect(broadcast).toHaveBeenCalledWith("server.worldSnapshot", {
      type: "server.worldSnapshot",
      world: expect.objectContaining({
        mode: "arcade3v3",
        phase: "waiting",
        score: { home: 0, away: 0 }
      })
    });
  });
});
