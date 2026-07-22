import { describe, expect, it } from "vitest";
import type { ActivePowerup } from "@bbh/arcade-core";
import { activeBoostTypesForSlot } from "./activeBoosts.js";

function active(
  type: ActivePowerup["type"],
  slotId: string | null
): ActivePowerup {
  return { id: `${type}:${slotId}`, type, slotId, position: null, expiresAtMs: 9999 };
}

describe("activeBoostTypesForSlot", () => {
  it("returns the skater's sustained boosts in stable order", () => {
    const world = {
      activePowerups: [
        active("bulldozer", "home-skater-1"),
        active("speed-boost", "home-skater-1"),
        active("hard-shot", "away-skater-2")
      ]
    };

    expect(activeBoostTypesForSlot(world, "home-skater-1")).toEqual([
      "speed-boost",
      "bulldozer"
    ]);
    expect(activeBoostTypesForSlot(world, "away-skater-2")).toEqual([
      "hard-shot"
    ]);
    expect(activeBoostTypesForSlot(world, "home-skater-3")).toEqual([]);
  });

  it("never badges goalie resizes on the holder's disc", () => {
    const world = {
      activePowerups: [
        active("mini-goalie", "home-skater-1"),
        active("giant-goalie", "home-skater-1")
      ]
    };

    expect(activeBoostTypesForSlot(world, "home-skater-1")).toEqual([]);
  });
});
