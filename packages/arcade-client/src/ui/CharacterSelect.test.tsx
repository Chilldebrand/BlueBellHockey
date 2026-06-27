import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ClientRosterSlot } from "../store.js";
import { CharacterSelect } from "./CharacterSelect.js";

const localSlot: ClientRosterSlot = {
  slotId: "home-skater-1",
  teamId: "home",
  index: 0,
  kind: "human",
  sessionId: "session-a",
  playerName: "Ada",
  botId: null,
  characterId: "rook-rocket",
  isBot: false,
  displayName: "Ada",
  isOwnedByLocalPlayer: true
};

describe("CharacterSelect", () => {
  it("renders original characters, stats, specials, and selected state", () => {
    const html = renderToStaticMarkup(
      <CharacterSelect
        roster={[localSlot]}
        localSessionId="session-a"
        disabled={false}
        onChooseCharacter={vi.fn()}
      />
    );

    expect(html).toContain("Rook Rocket");
    expect(html).toContain("Rocket Burst");
    expect(html).toContain("speed");
    expect(html).toContain("Selected");
    expect(html).not.toMatch(/\b(nhl|gretzky|crosby|ovechkin)\b/i);
  });
});
