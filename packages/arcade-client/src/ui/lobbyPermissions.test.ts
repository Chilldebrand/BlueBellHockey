import { describe, expect, it } from "vitest";
import type { ClientRosterSlot } from "../store.js";
import { canEditSlot } from "./lobbyPermissions.js";

function slot(overrides: Partial<ClientRosterSlot>): ClientRosterSlot {
  return {
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
    isCaptain: false,
    isOwnedByLocalPlayer: false,
    ...overrides
  };
}

const captainSlot = slot({ isCaptain: true, isOwnedByLocalPlayer: true });
const friendSlot = slot({
  slotId: "home-skater-2",
  index: 1,
  sessionId: "session-b",
  playerName: "Bo",
  displayName: "Bo"
});
const homeBot = slot({
  slotId: "home-skater-3",
  index: 2,
  kind: "bot",
  sessionId: null,
  playerName: null,
  botId: "bot-home-skater-3",
  displayName: "Bot",
  isBot: true
});
const awayBot = slot({
  slotId: "away-skater-1",
  teamId: "away",
  kind: "bot",
  sessionId: null,
  playerName: null,
  botId: "bot-away-skater-1",
  displayName: "Bot",
  isBot: true
});
const roster = [captainSlot, friendSlot, homeBot, awayBot];

describe("canEditSlot", () => {
  it("always allows the local player's own slot", () => {
    expect(canEditSlot(captainSlot, roster, "session-a")).toBe(true);
  });

  it("lets the captain edit same-team bot slots but not the other team's", () => {
    expect(canEditSlot(homeBot, roster, "session-a")).toBe(true);
    expect(canEditSlot(awayBot, roster, "session-a")).toBe(false);
  });

  it("blocks non-captains from bots and everyone from other humans", () => {
    expect(canEditSlot(homeBot, roster, "session-b")).toBe(false);
    expect(canEditSlot(friendSlot, roster, "session-a")).toBe(false);
    expect(canEditSlot(homeBot, roster, null)).toBe(false);
  });
});
