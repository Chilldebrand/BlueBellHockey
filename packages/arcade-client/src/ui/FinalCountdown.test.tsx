import { createWorld } from "@bbh/arcade-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  FinalCountdown,
  selectFinalCountdownSecond
} from "./FinalCountdown.js";

function playingWorld() {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  return world;
}

describe("selectFinalCountdownSecond", () => {
  it("counts 10..1 through the last ten seconds of regulation", () => {
    const world = playingWorld();
    world.remainingMs = 10_000;
    expect(selectFinalCountdownSecond(world)).toBe(10);
    world.remainingMs = 400;
    expect(selectFinalCountdownSecond(world)).toBe(1);
  });

  it("stays hidden outside the window, in OT, during holds, and at zero", () => {
    expect(selectFinalCountdownSecond(null)).toBeNull();

    const early = playingWorld();
    early.remainingMs = 10_001;
    expect(selectFinalCountdownSecond(early)).toBeNull();

    const done = playingWorld();
    done.remainingMs = 0;
    expect(selectFinalCountdownSecond(done)).toBeNull();

    const overtime = playingWorld();
    overtime.remainingMs = 5000;
    overtime.isOvertime = true;
    expect(selectFinalCountdownSecond(overtime)).toBeNull();

    const held = playingWorld();
    held.remainingMs = 5000;
    held.faceoffUntilMs = held.time.nowMs + 3000;
    expect(selectFinalCountdownSecond(held)).toBeNull();

    const waiting = playingWorld();
    waiting.remainingMs = 5000;
    waiting.phase = "waiting";
    expect(selectFinalCountdownSecond(waiting)).toBeNull();
  });
});

describe("FinalCountdown", () => {
  it("renders urgent digits with a timer role inside the window", () => {
    const world = playingWorld();
    world.remainingMs = 2_600;

    const html = renderToStaticMarkup(<FinalCountdown world={world} />);
    expect(html).toContain("role=\"timer\"");
    expect(html).toContain(">3<");
  });

  it("renders nothing outside the window", () => {
    const world = playingWorld();
    world.remainingMs = 60_000;

    expect(renderToStaticMarkup(<FinalCountdown world={world} />)).toBe("");
  });
});
