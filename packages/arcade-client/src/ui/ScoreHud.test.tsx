import { createWorld } from "@bbh/arcade-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createInitialArcadeClientState } from "../store.js";
import { ScoreHud } from "./ScoreHud.js";

describe("ScoreHud", () => {
  it("shows the regular playing clock outside overtime", () => {
    const world = createWorld(1, "arcade3v3");
    world.remainingMs = 125_000;
    const html = renderToStaticMarkup(
      <ScoreHud state={{ ...createInitialArcadeClientState(), phase: "playing", currentWorld: world }} />
    );

    expect(html).toContain("2:05");
    expect(html).not.toContain("NEXT GOAL");
    expect(html).not.toContain(">OT<");
  });

  it("replaces the clock with NEXT GOAL and an OT badge during sudden death", () => {
    const world = createWorld(1, "arcade3v3");
    world.phase = "playing";
    world.isOvertime = true;
    world.remainingMs = 0;
    const html = renderToStaticMarkup(
      <ScoreHud state={{ ...createInitialArcadeClientState(), phase: "playing", currentWorld: world }} />
    );

    expect(html).toContain("NEXT GOAL");
    expect(html).toContain(">OT<");
    expect(html).not.toContain(">0:00<");
  });
});
