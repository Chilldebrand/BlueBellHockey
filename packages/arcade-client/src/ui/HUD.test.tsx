import { createWorld } from "@bbh/arcade-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createInitialArcadeClientState, type ArcadeClientState } from "../store.js";
import { HUD } from "./HUD.js";

describe("HUD", () => {
  it("retains score and turbo content without powerup or target widgets", () => {
    const world = createWorld(1, "arcade3v3");
    const localSkater = world.skaters.find(
      (skater) => skater.id === "home-skater-1"
    );

    if (!localSkater) {
      throw new Error("Expected home-skater-1 in the initial world");
    }

    const state: ArcadeClientState = {
      ...createInitialArcadeClientState(),
      currentWorld: world,
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
          isOwnedByLocalPlayer: true,
          controlledGoalieId: null
        }
      ]
    };

    const html = renderToStaticMarkup(<HUD state={state} />);

    expect(html).toContain('aria-label="Score"');
    expect(html).toContain('aria-label="Turbo meter"');
    expect(html).not.toContain("Held powerup");
    expect(html).not.toContain("Target:");
    expect(html).not.toContain('aria-label="Assist target"');
  });
});
