import { createWorld } from "@bbh/arcade-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArcadeClientState } from "./store.js";

let endedState: ArcadeClientState;

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();

  return {
    ...react,
    useReducer: () => [endedState, () => undefined],
    useState: <T,>(initial: T) => [
      initial === "boot" ? ("lobby" as T) : initial,
      () => undefined
    ]
  };
});

vi.mock("./render/Scene.js", () => ({
  Scene: () => <section aria-label="Arcade rink" />
}));

import { App } from "./App.js";

describe("App", () => {
  it("mounts only the unified Postgame surface after a match ends", () => {
    const world = createWorld(13, "arcade3v3");
    world.phase = "ended";
    world.winnerTeamId = "home";
    world.score = { home: 5, away: 2 };

    endedState = {
      connectionStatus: "connected",
      roomCode: "PUCK42",
      playerSessionId: null,
      roster: [],
      score: world.score,
      phase: "ended",
      isRosterValid: true,
      currentWorld: world,
      previousWorld: null,
      inputAcks: {},
      error: null
    };

    const html = renderToStaticMarkup(<App />);

    expect(html.match(/aria-label="Postgame"/g)).toHaveLength(1);
    expect(html).not.toContain('aria-label="Win splash"');
  });
});
