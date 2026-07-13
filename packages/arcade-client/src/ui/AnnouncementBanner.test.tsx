import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WorldEvent } from "@bbh/arcade-core";
import {
  AnnouncementBanner,
  GOAL_BANNER_MS,
  POWERUP_BANNER_MS,
  selectAnnouncement
} from "./AnnouncementBanner.js";

function goalEvent(atMs: number): WorldEvent {
  return { id: `goal-1-home`, type: "goal", atMs, sourceSlotId: "home-skater-1" };
}

function pickupEvent(atMs: number, type = "speed-boost"): WorldEvent {
  return {
    id: `powerup-pickup-1-home-skater-1`,
    type: "powerupPickup",
    atMs,
    sourceSlotId: "home-skater-1",
    targetSlotId: type
  };
}

describe("selectAnnouncement", () => {
  it("announces GOAL!!! while the goal event is fresh, then clears", () => {
    expect(selectAnnouncement([goalEvent(1000)], 1016)).toEqual({
      kind: "goal",
      text: "GOAL!!!"
    });
    expect(
      selectAnnouncement([goalEvent(1000)], 1000 + GOAL_BANNER_MS)
    ).toBeNull();
  });

  it("announces a fresh powerup pickup with its punchy label", () => {
    expect(selectAnnouncement([pickupEvent(500)], 516)).toEqual({
      kind: "powerup",
      text: "Super Speed!"
    });
    expect(selectAnnouncement([pickupEvent(500, "mini-goalie")], 516)).toEqual({
      kind: "powerup",
      text: "Tiny Goalie!"
    });
    expect(
      selectAnnouncement([pickupEvent(500)], 500 + POWERUP_BANNER_MS)
    ).toBeNull();
  });

  it("lets a goal outrank a simultaneous powerup pickup", () => {
    expect(selectAnnouncement([pickupEvent(1000), goalEvent(1000)], 1016)).toEqual(
      { kind: "goal", text: "GOAL!!!" }
    );
  });

  it("ignores unknown powerup types and unrelated events", () => {
    expect(
      selectAnnouncement([pickupEvent(500, "not-a-powerup")], 516)
    ).toBeNull();
    expect(
      selectAnnouncement(
        [{ id: "hit-1", type: "hit", atMs: 500 }],
        516
      )
    ).toBeNull();
  });
});

describe("AnnouncementBanner", () => {
  it("renders the goal banner with the large styling class", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBanner events={[goalEvent(1000)]} nowMs={1016} />
    );

    expect(html).toContain("GOAL!!!");
    expect(html).toContain("announcement-goal");
  });

  it("renders the powerup banner with the medium styling class", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBanner
        events={[pickupEvent(1000, "giant-goalie")]}
        nowMs={1016}
      />
    );

    expect(html).toContain("Huge Goalie!");
    expect(html).toContain("announcement-powerup");
  });

  it("renders nothing once the window has passed", () => {
    const html = renderToStaticMarkup(
      <AnnouncementBanner
        events={[goalEvent(0)]}
        nowMs={GOAL_BANNER_MS + 1}
      />
    );

    expect(html).toBe("");
  });
});
