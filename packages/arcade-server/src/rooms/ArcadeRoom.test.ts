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
    readonly usePowerup: boolean;
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
    readonly usePowerup: boolean;
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
      usePowerup: false,
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

  it("lets the captain pick bot-slot characters but not another human's", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const sender = vi
      .spyOn(room, "send")
      .mockImplementation(() => room as never);
    const captain = client("session-a");
    const friend = client("session-b");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(captain as never, { playerName: "Ada" });
    room.onJoin(friend as never, { playerName: "Bo" });
    const handler = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.chooseCharacterFor"
    )?.[1];

    expect(handler).toBeTypeOf("function");

    // Captain sets a same-team bot slot.
    handler?.(captain as never, {
      slotId: "home-skater-3",
      characterId: "tess-flash"
    });
    expect(
      [...room.state.teams.home.slots].find(
        (slot) => slot.slotId === "home-skater-3"
      )
    ).toMatchObject({ isBot: true, characterId: "tess-flash" });
    expect(sender).not.toHaveBeenCalled();

    // Captain may NOT edit another human's slot.
    handler?.(captain as never, {
      slotId: "home-skater-2",
      characterId: "tess-flash"
    });
    expect(sender).toHaveBeenCalledWith(captain, "server.error", {
      message: "You can't edit that slot."
    });

    // Non-captain may NOT edit a bot slot.
    handler?.(friend as never, {
      slotId: "home-skater-3",
      characterId: "milo-ghost"
    });
    expect(sender).toHaveBeenCalledWith(friend, "server.error", {
      message: "You can't edit that slot."
    });
    expect(
      [...room.state.teams.home.slots].find(
        (slot) => slot.slotId === "home-skater-3"
      )?.characterId
    ).toBe("tess-flash");
  });

  it("syncs isCaptain through joins, leaves, and team switches", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    vi.spyOn(room, "send").mockImplementation(() => room as never);
    const first = client("session-a");
    const second = client("session-b");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(first as never, { playerName: "Ada" });
    room.onJoin(second as never, { playerName: "Bo" });

    const captainFlags = () =>
      [...room.state.teams.home.slots, ...room.state.teams.away.slots]
        .filter((slot) => slot.isCaptain)
        .map((slot) => slot.sessionId);

    // First joiner captains home; second is not captain.
    expect(captainFlags()).toEqual(["session-a"]);

    // First moves to away: home passes to second, away gets first.
    const chooseTeam = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.chooseTeam"
    )?.[1];
    chooseTeam?.(first as never, { teamId: "away" });
    expect(captainFlags().sort()).toEqual(["session-a", "session-b"]);
    expect(
      [...room.state.teams.away.slots].find((slot) => slot.isCaptain)?.sessionId
    ).toBe("session-a");

    // Away captain leaves: away has no captain left.
    room.onLeave(first as never);
    expect(captainFlags()).toEqual(["session-b"]);
  });

  it("stamps lobby character picks into the world at match start", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    vi.spyOn(room, "send").mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });

    const chooseCharacter = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.chooseCharacter"
    )?.[1];
    const requestStart = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.requestStart"
    )?.[1];

    // Pick in the lobby (mutates only the roster), then start the match —
    // the waiting world must pick the character up at that moment.
    chooseCharacter?.(clientA as never, { characterId: "zara-crush" });
    requestStart?.(clientA as never, undefined);

    const world = (room as unknown as { world: { skaters: { id: string; characterId: string }[] } }).world;
    expect(
      world.skaters.find((skater) => skater.id === "home-skater-1")?.characterId
    ).toBe("zara-crush");
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

  it("preserves only literal true powerup activation from client input", () => {
    const room = createTestRoom();
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });

    room["handleInput"](
      clientA as never,
      inputMessage(1, { usePowerup: true })
    );

    expect(
      room["latestInputBySession"].get("session-a")?.usePowerup
    ).toBe(true);

    room["handleInput"](
      clientA as never,
      inputMessage(2, {
        usePowerup: "true" as unknown as boolean
      })
    );

    expect(
      room["latestInputBySession"].get("session-a")?.usePowerup
    ).toBe(false);
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

  it("snaps control to the teammate who gathers the human's pass (once)", () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ada" });

    // Post-step state: the human (home-skater-1) passed and a bot teammate
    // (home-skater-2) just gathered it. Switching only runs mid-match.
    room["world"]!.phase = "playing";
    room["world"]!.puck.carrierSlotId = "home-skater-2";
    room["applyControlSwitches"]("home-skater-1");

    const slotsAfter = () => [
      ...room.state.teams.home.slots,
      ...room.state.teams.away.slots
    ];
    expect(
      slotsAfter().find((slot) => slot.slotId === "home-skater-2")
    ).toMatchObject({ kind: "human", sessionId: "session-a" });
    expect(
      slotsAfter().find((slot) => slot.slotId === "home-skater-1")
    ).toMatchObject({ kind: "bot", sessionId: null });

    // A second sub-step in the same tick must NOT ping the control back —
    // prevCarrier is now the receiver and matches the controlled slot.
    room["applyControlSwitches"]("home-skater-2");
    expect(
      slotsAfter().find((slot) => slot.slotId === "home-skater-2")
    ).toMatchObject({ kind: "human", sessionId: "session-a" });
    expect(
      slotsAfter().filter((slot) => slot.kind === "human")
    ).toHaveLength(1);
  });

  it("does not switch control on an opponent interception", () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ada" });

    room["world"]!.phase = "playing";
    room["world"]!.puck.carrierSlotId = "away-skater-1";
    room["applyControlSwitches"]("home-skater-1");

    expect(room.state.teams.home.slots[0]).toMatchObject({
      slotId: "home-skater-1",
      kind: "human",
      sessionId: "session-a"
    });
  });

  it("uses the pass button as a manual switch to the nearest teammate on defense", () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ada" });

    const world = room["world"]!;
    world.phase = "playing";
    world.puck.carrierSlotId = null;
    world.puck.position = { x: 1000, y: 500 };
    world.skaters.find((s) => s.id === "home-skater-2")!.position = {
      x: 1010,
      y: 505
    };
    world.skaters.find((s) => s.id === "home-skater-3")!.position = {
      x: 200,
      y: 200
    };

    // A fresh pass-button press while not carrying arms the manual switch.
    room["handleInput"](client("session-a") as never, {
      type: "client.input",
      frame: {
        playerId: "session-a",
        slotId: "home-skater-1",
        sequence: 1,
        moveX: 0,
        moveY: 0,
        stickX: 0,
        stickY: 0,
        pass: true,
        check: false,
        turbo: false,
        switchTarget: false
      }
    });
    room["applyControlSwitches"](null);

    expect(
      room.state.teams.home.slots.find((slot) => slot.kind === "human")?.slotId
    ).toBe("home-skater-2");
  });

  it("survives a non-string playerName without stranding a zombie human slot", () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });

    expect(() =>
      room.onJoin(client("session-a") as never, {
        playerName: 12345 as unknown as string
      })
    ).not.toThrow();

    const slot = room.state.teams.home.slots[0];
    expect(slot).toMatchObject({
      kind: "human",
      sessionId: "session-a",
      playerName: "Player"
    });
  });

  it("caps player names and strips control characters", () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });

    room.onJoin(client("session-a") as never, {
      playerName: `  Ada${String.fromCharCode(0)}${String.fromCharCode(27)} Lovelace ${"x".repeat(100)}`
    });

    const name = room.state.teams.home.slots[0]?.playerName ?? "";
    expect(name.startsWith("Ada Lovelace")).toBe(true);
    expect(name.length).toBeLessThanOrEqual(24);
  });

  it("coerces unknown modes and non-boolean quickMatch to safe defaults", () => {
    expect(
      normalizeArcadeRoomOptions({
        mode: "hax-mode" as never,
        quickMatch: "yes" as never
      })
    ).toEqual({ privateCode: "", quickMatch: true, mode: "arcade3v3" });
  });

  it("rejects oversized or non-alphanumeric private codes", () => {
    expect(() =>
      normalizeArcadeRoomOptions({
        privateCode: "A".repeat(4096),
        quickMatch: false,
        mode: "arcade3v3"
      })
    ).toThrow();
    expect(() =>
      normalizeArcadeRoomOptions({
        privateCode: "<script>",
        quickMatch: false,
        mode: "arcade3v3"
      })
    ).toThrow();
    expect(() =>
      normalizeArcadeRoomOptions({
        privateCode: { evil: true } as never,
        quickMatch: false,
        mode: "arcade3v3"
      })
    ).toThrow();
  });

  it("ignores rematch requests unless the match has ended", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    vi.spyOn(room, "broadcast").mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const rematch = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.rematch"
    )?.[1];

    // Mid-match rematch spam must not reset the live world.
    room["world"]!.phase = "playing";
    room["world"]!.score.home = 3;
    rematch?.(clientA as never, undefined);
    expect(room["world"]!.score.home).toBe(3);
    expect(room["world"]!.phase).toBe("playing");

    // After the match ends it works and produces a fresh playing world.
    room["world"]!.phase = "ended";
    rematch?.(clientA as never, undefined);
    expect(room["world"]!.phase).toBe("playing");
    expect(room["world"]!.score).toEqual({ home: 0, away: 0 });
  });

  it("returns to the lobby with a fresh world instead of a phase flip", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    vi.spyOn(room, "broadcast").mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const backToLobby = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.backToLobby"
    )?.[1];

    // Mid-match back-to-lobby must not freeze the live world.
    room["world"]!.phase = "playing";
    backToLobby?.(clientA as never, undefined);
    expect(room["world"]!.phase).toBe("playing");

    // Postgame back-to-lobby resets score AND clock for the next start.
    room["world"]!.phase = "ended";
    room["world"]!.score.away = 5;
    backToLobby?.(clientA as never, undefined);
    expect(room["world"]!.phase).toBe("waiting");
    expect(room["world"]!.score).toEqual({ home: 0, away: 0 });
    expect(room["world"]!.time.nowMs).toBe(0);
  });

  it("rejects team switches while a match is being played", () => {
    const room = createTestRoom();
    const onMessage = vi.spyOn(room, "onMessage");
    const sender = vi
      .spyOn(room, "send")
      .mockImplementation(() => room as never);
    const clientA = client("session-a");
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(clientA as never, { playerName: "Ada" });
    const chooseTeam = onMessage.mock.calls.find(
      ([messageType]) => messageType === "client.chooseTeam"
    )?.[1];

    room["world"]!.phase = "playing";
    chooseTeam?.(clientA as never, { teamId: "away" });

    expect(sender).toHaveBeenCalledWith(clientA, "server.error", {
      message: "Can't switch teams mid-match."
    });
    expect(
      [...room.state.teams.home.slots].find(
        (slot) => slot.sessionId === "session-a"
      )
    ).toBeTruthy();
  });

  it("does not apply control switches outside of play", () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ada" });

    // Same setup as the pass-reception switch, but the world is still waiting.
    room["world"]!.puck.carrierSlotId = "home-skater-2";
    room["applyControlSwitches"]("home-skater-1");

    expect(
      [...room.state.teams.home.slots].find((slot) => slot.kind === "human")
        ?.slotId
    ).toBe("home-skater-1");
  });

  it("re-seats an uncleanly dropped player in their old slot on reconnect", async () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ada" });

    let grantReconnect: (value: unknown) => void = () => undefined;
    room["allowReconnection"] = vi.fn(
      () =>
        new Promise((resolve) => {
          grantReconnect = resolve;
        })
    ) as never;

    const leavePromise = room.onLeave(client("session-a") as never, false);

    // The body is a bot for the whole grace window — no AFK statue.
    expect(room.state.teams.home.slots[0]).toMatchObject({
      slotId: "home-skater-1",
      kind: "bot"
    });

    grantReconnect(client("session-a"));
    await leavePromise;

    expect(room.state.teams.home.slots[0]).toMatchObject({
      slotId: "home-skater-1",
      kind: "human",
      sessionId: "session-a",
      playerName: "Ada"
    });
  });

  it("keeps the slot released when the reconnect grace expires", async () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ada" });

    room["allowReconnection"] = vi.fn(() =>
      Promise.reject(new Error("grace expired"))
    ) as never;

    await room.onLeave(client("session-a") as never, false);

    expect(room.state.teams.home.slots[0]).toMatchObject({
      slotId: "home-skater-1",
      kind: "bot",
      sessionId: null
    });
  });

  it("releases a consented leave immediately without holding a seat", async () => {
    const room = createTestRoom();
    room.onCreate({ quickMatch: true, mode: "arcade3v3" });
    room.onJoin(client("session-a") as never, { playerName: "Ada" });
    const allowReconnection = vi.fn();
    room["allowReconnection"] = allowReconnection as never;

    await room.onLeave(client("session-a") as never, true);

    expect(allowReconnection).not.toHaveBeenCalled();
    expect(room.state.teams.home.slots[0]).toMatchObject({
      kind: "bot",
      sessionId: null
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
