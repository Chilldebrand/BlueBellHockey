import { describe, expect, it } from "vitest";
import { bodyScaleForCharacter } from "./CharacterModel.js";

describe("bodyScaleForCharacter", () => {
  it("keeps a stat-neutral character at exactly 1.0", () => {
    // kip-hook: power 3, balance 3, speed 4 → bulk 1.0, slightly low height
    expect(bodyScaleForCharacter("kip-hook").bulk).toBeCloseTo(1, 5);
    // mira-wall: power 3, balance 5, speed 3 → taller-neutral height
    expect(bodyScaleForCharacter("mira-wall").height).toBeCloseTo(1, 5);
  });

  it("makes bruisers wider and taller, speedsters smaller", () => {
    const bruiser = bodyScaleForCharacter("zara-crush"); // power 5, balance 4, speed 2
    const speedster = bodyScaleForCharacter("rook-rocket"); // power 2, balance 2, speed 5

    expect(bruiser.bulk).toBeGreaterThan(1.08);
    expect(bruiser.height).toBeGreaterThan(1.05);
    expect(speedster.bulk).toBeLessThan(0.95);
    expect(speedster.height).toBeLessThan(0.98);
    expect(bruiser.bulk).toBeGreaterThan(speedster.bulk);
  });

  it("defaults to neutral when no character is known", () => {
    expect(bodyScaleForCharacter(undefined)).toEqual({ bulk: 1, height: 1 });
  });
});
