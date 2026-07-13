import { createWorld, SKATER_SLOTS } from "@bbh/arcade-core";
import { describe, expect, it } from "vitest";
import {
  assignHumanToOpenSlot,
  captainSessionId,
  createRoster,
  fillRosterWithBots,
  InvalidCharacterSelectionError,
  moveHumanToTeam,
  releaseHuman,
  RosterFullError,
  selectCharacterForSlot,
  selectGoalieController,
  switchHumanControl
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

  it("honors a preferred slot on assignment unless a human holds it", () => {
    const roster = createRoster();

    const reseated = assignHumanToOpenSlot(roster, {
      sessionId: "session-a",
      playerName: "Ada",
      preferredSlotId: "away-skater-2"
    });
    expect(reseated.slotId).toBe("away-skater-2");

    // Preferred slot occupied by another human → normal open-slot search.
    const fallback = assignHumanToOpenSlot(roster, {
      sessionId: "session-b",
      playerName: "Bo",
      preferredSlotId: "away-skater-2"
    });
    expect(fallback.slotId).toBe("home-skater-1");
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

  it("switches a human's control to a same-team bot slot, keeping each skin", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    fillRosterWithBots(roster);

    const from = roster.find((slot) => slot.slotId === "home-skater-1")!;
    const to = roster.find((slot) => slot.slotId === "home-skater-2")!;
    const fromCharacter = from.characterId;
    const toCharacter = to.characterId;

    const moved = switchHumanControl(roster, "session-a", "home-skater-2");

    expect(moved?.slotId).toBe("home-skater-2");
    expect(to).toMatchObject({
      kind: "human",
      sessionId: "session-a",
      playerName: "Ada",
      botId: null,
      characterId: toCharacter // keeps its own skin — no character carried over
    });
    expect(from).toMatchObject({
      kind: "bot",
      sessionId: null,
      playerName: null,
      botId: "bot-home-skater-1",
      characterId: fromCharacter
    });
  });

  it("refuses to switch control onto another human or the other team", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });
    fillRosterWithBots(roster);

    // Target occupied by another human — no-op, session-a keeps its slot.
    switchHumanControl(roster, "session-a", "home-skater-2");
    expect(roster.find((slot) => slot.slotId === "home-skater-1")).toMatchObject({
      kind: "human",
      sessionId: "session-a"
    });
    expect(roster.find((slot) => slot.slotId === "home-skater-2")).toMatchObject({
      kind: "human",
      sessionId: "session-b"
    });

    // Target on the other team — no-op as well (home player can't grab away bot).
    switchHumanControl(roster, "session-a", "away-skater-1");
    expect(roster.find((slot) => slot.slotId === "home-skater-1")).toMatchObject({
      kind: "human",
      sessionId: "session-a"
    });
    expect(roster.find((slot) => slot.slotId === "away-skater-1")?.kind).toBe(
      "bot"
    );
  });

  it("selects valid characters only for the owning human session", () => {
    const roster = createRoster();
    const slot = assignHumanToOpenSlot(roster, {
      sessionId: "session-a",
      playerName: "Ada"
    });

    const selected = selectCharacterForSlot(
      roster,
      "session-a",
      slot.slotId,
      "milo-ghost"
    );

    expect(selected?.characterId).toBe("milo-ghost");
    expect(
      selectCharacterForSlot(roster, "missing", slot.slotId, "rook-rocket")
    ).toBeNull();
    expect(() =>
      selectCharacterForSlot(roster, "session-a", slot.slotId, "real-player-name")
    ).toThrow(InvalidCharacterSelectionError);
  });
});

describe("team captaincy", () => {
  it("makes the first human on a team its captain, not later joiners", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });

    expect(captainSessionId(roster, "home")).toBe("session-a");
    expect(captainSessionId(roster, "away")).toBeNull();
  });

  it("passes captaincy to the next-tenured human when the captain leaves", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });

    releaseHuman(roster, "session-a");
    expect(captainSessionId(roster, "home")).toBe("session-b");

    releaseHuman(roster, "session-b");
    expect(captainSessionId(roster, "home")).toBeNull();
  });

  it("hands the old team to the next human when the captain switches teams", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });
    fillRosterWithBots(roster);

    moveHumanToTeam(roster, "session-a", "away");

    expect(captainSessionId(roster, "home")).toBe("session-b");
    expect(captainSessionId(roster, "away")).toBe("session-a");
  });

  it("does not let a team switcher usurp the new team's incumbent captain", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });
    fillRosterWithBots(roster);
    moveHumanToTeam(roster, "session-b", "away"); // Bo becomes away captain

    moveHumanToTeam(roster, "session-a", "away"); // Ada arrives later

    expect(captainSessionId(roster, "away")).toBe("session-b");
  });

  it("keeps captaincy with the session through a mid-match control switch", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });
    fillRosterWithBots(roster);

    switchHumanControl(roster, "session-a", "home-skater-3");

    expect(captainSessionId(roster, "home")).toBe("session-a");
  });

  it("sends a rejoining ex-captain to the back of the line", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });

    releaseHuman(roster, "session-a");
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });

    expect(captainSessionId(roster, "home")).toBe("session-b");
  });
});

describe("selectCharacterForSlot permissions", () => {
  function rosterWithCaptainAndFriend() {
    const roster = createRoster();
    // session-a: home captain (home-skater-1); session-b: home human
    // (home-skater-2); home-skater-3 + all of away are bots.
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });
    fillRosterWithBots(roster);
    return roster;
  }

  it("lets any human set their own slot", () => {
    const roster = rosterWithCaptainAndFriend();

    const own = selectCharacterForSlot(
      roster,
      "session-b",
      "home-skater-2",
      "milo-ghost"
    );

    expect(own?.characterId).toBe("milo-ghost");
  });

  it("lets the captain set same-team bot slots only", () => {
    const roster = rosterWithCaptainAndFriend();

    const botSlot = selectCharacterForSlot(
      roster,
      "session-a",
      "home-skater-3",
      "tess-flash"
    );
    expect(botSlot?.characterId).toBe("tess-flash");

    // Other team's bot: refused.
    expect(
      selectCharacterForSlot(roster, "session-a", "away-skater-1", "tess-flash")
    ).toBeNull();
  });

  it("refuses non-captains editing bots and anyone editing another human", () => {
    const roster = rosterWithCaptainAndFriend();

    // session-b is not captain: no bot access.
    expect(
      selectCharacterForSlot(roster, "session-b", "home-skater-3", "tess-flash")
    ).toBeNull();
    // Captain cannot edit another human's slot.
    expect(
      selectCharacterForSlot(roster, "session-a", "home-skater-2", "tess-flash")
    ).toBeNull();
    // Unknown sender.
    expect(
      selectCharacterForSlot(roster, "missing", "home-skater-3", "tess-flash")
    ).toBeNull();
  });

  it("throws on an unknown character id", () => {
    const roster = rosterWithCaptainAndFriend();

    expect(() =>
      selectCharacterForSlot(roster, "session-a", "home-skater-3", "not-real")
    ).toThrow(InvalidCharacterSelectionError);
  });
});

describe("goalie control grants", () => {
  it("starts every slot with no goalie control grant", () => {
    const roster = createRoster();

    expect(roster.every((slot) => slot.controlledGoalieId === null)).toBe(true);
  });

  it("clears a grant when the human releases their slot", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    roster[0].controlledGoalieId = "home-goalie";

    releaseHuman(roster, "session-a");

    expect(roster[0].controlledGoalieId).toBeNull();
  });

  it("selects the nearest same-team human skater as goalie controller", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });
    fillRosterWithBots(roster);
    const world = createWorld(1, "arcade3v3");
    const goalie = world.goalies.find((g) => g.id === "home-goalie")!;
    // session-b's skater (home-skater-2) stands closer to the home goalie.
    world.skaters.find((s) => s.id === "home-skater-1")!.position = {
      x: goalie.position.x + 900,
      y: goalie.position.y
    };
    world.skaters.find((s) => s.id === "home-skater-2")!.position = {
      x: goalie.position.x + 120,
      y: goalie.position.y
    };

    const controller = selectGoalieController(roster, world, "home-goalie");

    expect(controller?.slotId).toBe("home-skater-2");
    expect(controller?.sessionId).toBe("session-b");
  });

  it("breaks exact distance ties by ascending slot id", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    assignHumanToOpenSlot(roster, { sessionId: "session-b", playerName: "Bo" });
    fillRosterWithBots(roster);
    const world = createWorld(1, "arcade3v3");
    const goalie = world.goalies.find((g) => g.id === "home-goalie")!;
    world.skaters.find((s) => s.id === "home-skater-1")!.position = {
      x: goalie.position.x + 300,
      y: goalie.position.y
    };
    world.skaters.find((s) => s.id === "home-skater-2")!.position = {
      x: goalie.position.x + 300,
      y: goalie.position.y
    };

    const controller = selectGoalieController(roster, world, "home-goalie");

    expect(controller?.slotId).toBe("home-skater-1");
  });

  it("only considers humans on the goalie's own team", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    fillRosterWithBots(roster);
    moveHumanToTeam(roster, "session-a", "away");
    fillRosterWithBots(roster);
    const world = createWorld(1, "arcade3v3");

    expect(selectGoalieController(roster, world, "home-goalie")).toBeNull();
  });

  it("returns null for an unknown goalie id", () => {
    const roster = createRoster();
    assignHumanToOpenSlot(roster, { sessionId: "session-a", playerName: "Ada" });
    fillRosterWithBots(roster);
    const world = createWorld(1, "arcade3v3");

    expect(selectGoalieController(roster, world, "not-a-goalie")).toBeNull();
  });
});
