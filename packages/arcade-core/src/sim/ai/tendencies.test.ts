import { describe, expect, it } from "vitest";
import { createWorld } from "../../index";
import { tendencyForSkater } from "./tendencies.js";

describe("bot tendencies", () => {
  it("maps character identity to a stable role tendency", () => {
    const world = createWorld(1, "arcade3v3");
    const skater = world.skaters[0];

    if (!skater) {
      throw new Error("Missing skater");
    }

    skater.characterId = "axel-laser";

    expect(tendencyForSkater(skater)).toBe("shooter");
    expect(tendencyForSkater(skater)).toBe("shooter");
  });

  it("uses neutral support for an unknown character identity", () => {
    const world = createWorld(1, "arcade3v3");
    const skater = world.skaters[0];

    if (!skater) {
      throw new Error("Missing skater");
    }

    skater.characterId = "unknown" as typeof skater.characterId;

    expect(tendencyForSkater(skater)).toBe("support");
  });
});
