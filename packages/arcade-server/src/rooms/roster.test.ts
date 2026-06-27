import { SKATER_SLOTS } from "@bbh/arcade-core";
import { describe, expect, it } from "vitest";
import {
  assignHumanToOpenSlot,
  createRoster,
  fillRosterWithBots,
  InvalidCharacterSelectionError,
  releaseHuman,
  RosterFullError,
  selectCharacterForSession
} from "./roster.js";

describe("room roster lifecycle", () => {
  it("starts with one unowned entry for every skater slot", () => {
    const roster = createRoster();

    expect(roster).toHaveLength(6);
    expect(roster.map((slot) => slot.slotId)).toEqual(
      SKATER_SLOTS.map((slot) => slot.id)
    );
    expect(roster.every((slot) => slot.kind === "open")).toBe(true);
    expect(roster.every((slot) => slot.characterId)).toBe(true);
  });

  it("assigns humans to the first open skater slots", () => {
    const roster = createRoster();

    const first = assignHumanToOpenSlot(roster, {
      sessionId: "session-a",
      playerName: "Ada"
    });
    const second = assignHumanToOpenSlot(roster, {
      sessionId: "session-b",
      playerName: "Grace"
    });

    expect(first.slotId).toBe("home-skater-1");
    expect(second.slotId).toBe("home-skater-2");
    expect(roster[0]).toMatchObject({
      kind: "human",
      sessionId: "session-a",
      playerName: "Ada",
      botId: null
    });
  });

  it("fills empty skater slots with deterministic bot ids", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, {
      sessionId: "session-a",
      playerName: "Ada"
    });

    fillRosterWithBots(roster);

    expect(roster).toHaveLength(6);
    expect(roster.filter((slot) => slot.kind === "open")).toHaveLength(0);
    expect(roster[0]).toMatchObject({
      kind: "human",
      sessionId: "session-a",
      botId: null
    });
    expect(roster.slice(1).map((slot) => slot.botId)).toEqual([
      "bot-home-skater-2",
      "bot-home-skater-3",
      "bot-away-skater-1",
      "bot-away-skater-2",
      "bot-away-skater-3"
    ]);
  });

  it("rejects a seventh human player", () => {
    const roster = createRoster();

    for (let i = 0; i < 6; i += 1) {
      assignHumanToOpenSlot(roster, {
        sessionId: `session-${i}`,
        playerName: `Player ${i}`
      });
    }

    expect(() =>
      assignHumanToOpenSlot(roster, {
        sessionId: "session-7",
        playerName: "Too Late"
      })
    ).toThrow(RosterFullError);
  });

  it("releases only the slot owned by a leaving session", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, {
      sessionId: "session-a",
      playerName: "Ada"
    });
    assignHumanToOpenSlot(roster, {
      sessionId: "session-b",
      playerName: "Grace"
    });

    releaseHuman(roster, "session-a");

    expect(roster[0]).toMatchObject({
      kind: "open",
      sessionId: null,
      playerName: null,
      botId: null
    });
    expect(roster[1]).toMatchObject({
      kind: "human",
      sessionId: "session-b"
    });
  });

  it("selects valid characters only for the owning human session", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, {
      sessionId: "session-a",
      playerName: "Ada"
    });

    const selected = selectCharacterForSession(
      roster,
      "session-a",
      "milo-ghost"
    );

    expect(selected?.characterId).toBe("milo-ghost");
    expect(selectCharacterForSession(roster, "missing", "rook-rocket")).toBeNull();
    expect(() =>
      selectCharacterForSession(roster, "session-a", "real-player-name")
    ).toThrow(InvalidCharacterSelectionError);
  });
});
