import { MATCH_CONFIG, RINK_CONFIG, SKATER_SLOTS } from "@bbh/arcade-core";
import { describe, expect, it, vi } from "vitest";
import {
  ArcadeRoom,
  createPrivateRoomCode,
  normalizeArcadeRoomOptions
} from "./ArcadeRoom.js";
import type { ServerWorldSnapshotMessage } from "@bbh/arcade-core";

interface FakeClient {
  readonly sessionId: string;
}

function client(sessionId: string): FakeClient {
  return { sessionId };
}

function inputMessage(
  sequence: number,
  overrides: Partial<{
    readonly moveX: number;
    readonly moveY: number;
    readonly stickX: number;
    readonly stickY: number;
  }> = {}
): {
  readonly type: "client.input";
  readonly frame: {
    readonly playerId: string;
    readonly slotId: string;
    readonly sequence: number;
    readonly moveX: number;
    readonly moveY: number;
    readonly stickX: number;
    readonly stickY: number;
    readonly pass: boolean;
    readonly check: boolean;
    readonly turbo: boolean;
    readonly switchTarget: boolean;
  };
} {
  return {
    type: "client.input",
    frame: {
      playerId: "session-a",
      slotId: "home-skater-1",
      sequence,
      moveX: 0,
      moveY: 0,
      stickX: 0,
      stickY: 0,
      pass: false,
      check: false,
      turbo: false,
      switchTarget: false,
      ...overrides
    }
  };
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
    expect(
      normalizeArcadeRoomOptions({
        privateCode: "",
        quickMatch: true,
        mode: "arcade3v3"
      })
    ).toEqual({
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

  it("syncs valid character selections and rejects invalid ones", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const sender = vi
      .spyOn(room, "send")
      .mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const handler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.chooseCharacter"
    )?.[1];

    expect(handler).toBeTypeOf("function");
    handler?.(clientA as never, { characterId: "milo-ghost" });

    expect(room.state.teams.home.slots[0]).toMatchObject({
      sessionId: "session-a",
      characterId: "milo-ghost"
    });

    handler?.(clientA as never, { characterId: "real-player-name" });

    expect(sender).toHaveBeenCalledWith(clientA, "server.error", {
      message: "Invalid character."
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

  it("buffers client input by session and applies it to the assigned skater on tick", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const broadcast = vi
      .spyOn(room, "broadcast")
      .mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const startHandler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.requestStart"
    )?.[1];
    const inputHandler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.input"
    )?.[1];

    startHandler?.(clientA as never, undefined);
    inputHandler?.(clientA as never, {
      type: "client.input",
      frame: {
        playerId: "spoofed-session",
        slotId: "away-skater-1",
        sequence: 1,
        moveX: 1,
        moveY: 0,
        stickX: 0,
        stickY: 0,
        pass: false,
        check: false,
        turbo: false,
        switchTarget: false
      }
    });
    room.tick(100);

    const snapshot = broadcast.mock.calls.find(
      ([messageType]) => messageType === "server.worldSnapshot"
    )?.[1] as ServerWorldSnapshotMessage | undefined;
    const controlled = snapshot?.world.skaters.find(
      (skater) => skater.id === "home-skater-1"
    );
    const spoofed = snapshot?.world.skaters.find(
      (skater) => skater.id === "away-skater-1"
    );

    expect(inputHandler).toBeTypeOf("function");
    // Spawns sit 260 either side of center ice; only the owned skater moves.
    expect(controlled?.position.x).toBeGreaterThan(RINK_CONFIG.width / 2 - 260);
    expect(spoofed?.position.x).toBeLessThan(RINK_CONFIG.width / 2 + 260);
  });

  it("injects bot input frames so a solo player has five active skaters", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const broadcast = vi
      .spyOn(room, "broadcast")
      .mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const startHandler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.requestStart"
    )?.[1];

    startHandler?.(clientA as never, undefined);
    room.tick(MATCH_CONFIG.fixedTickMs * 3);

    const snapshot = broadcast.mock.calls
      .filter(([messageType]) => messageType === "server.worldSnapshot")
      .at(-1)?.[1] as ServerWorldSnapshotMessage | undefined;
    const human = snapshot?.world.skaters.find(
      (skater) => skater.id === "home-skater-1"
    );
    const botSkaters = snapshot?.world.skaters.filter(
      (skater) => skater.id !== "home-skater-1"
    );

    expect(botSkaters).toHaveLength(5);
    expect(human?.velocity.x).toBe(0);
    expect(
      botSkaters?.some((skater) => Math.hypot(skater.velocity.x, skater.velocity.y) > 0)
    ).toBe(true);
  });

  it("rejects non-finite input and stale sequence replays", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const sender = vi
      .spyOn(room, "send")
      .mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const startHandler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.requestStart"
    )?.[1];
    const inputHandler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.input"
    )?.[1];

    startHandler?.(clientA as never, undefined);
    inputHandler?.(clientA as never, inputMessage(1, { moveX: 1 }));
    room.tick(MATCH_CONFIG.fixedTickMs);
    const afterForward = room.state.clock.tick;
    inputHandler?.(clientA as never, inputMessage(1, { moveX: -1 }));
    inputHandler?.(clientA as never, inputMessage(2, { moveX: Number.NaN }));
    room.tick(MATCH_CONFIG.fixedTickMs);

    expect(room.state.clock.tick).toBe(afterForward + 1);
    expect(sender).toHaveBeenCalledWith(clientA, "server.error", {
      message: "Invalid input."
    });
  });

  it("uses fixed simulation ticks and retains held input until superseded", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const broadcast = vi
      .spyOn(room, "broadcast")
      .mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const startHandler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.requestStart"
    )?.[1];
    const inputHandler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.input"
    )?.[1];

    startHandler?.(clientA as never, undefined);
    inputHandler?.(clientA as never, inputMessage(1, { moveX: 1 }));
    room.tick(MATCH_CONFIG.fixedTickMs * 2 + 1);

    const snapshot = broadcast.mock.calls
      .filter(([messageType]) => messageType === "server.worldSnapshot")
      .at(-1)?.[1] as ServerWorldSnapshotMessage | undefined;
    const controlled = snapshot?.world.skaters.find(
      (skater) => skater.id === "home-skater-1"
    );

    expect(snapshot?.world.time.tick).toBe(2);
    expect(snapshot?.world.time.nowMs).toBe(MATCH_CONFIG.fixedTickMs * 2);
    expect(controlled?.velocity.x).toBeGreaterThan(0);
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
      }),
      inputAcks: expect.any(Object)
    });
  });

  it("acknowledges each session's latest input sequence in snapshots", () => {
    const room = createTestRoom();
    const broadcast = vi
      .spyOn(room, "broadcast")
      .mockImplementation(() => room as never);

    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ack" });
    room["handleInput"](client("session-a") as never, inputMessage(41));
    room.tick();

    const snapshotCall = broadcast.mock.calls.find(
      ([messageType]) => messageType === "server.worldSnapshot"
    );
    const message = snapshotCall?.[1] as { inputAcks?: Record<string, number> };
    const ackedSequences = Object.values(message.inputAcks ?? {});

    expect(ackedSequences).toContain(41);
  });
});
