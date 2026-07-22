import { describe, expect, it } from "vitest";
import { windupStickTransform } from "./CharacterModel.js";

describe("windupStickTransform", () => {
  it("is the identity at depth 0", () => {
    expect(windupStickTransform(0)).toEqual([0, 0, 0]);
  });

  it("draws the stick monotonically up and back with depth, clamped to 0..1", () => {
    const [halfYaw, halfRoll, halfLift] = windupStickTransform(0.5);
    const [fullYaw, fullRoll, fullLift] = windupStickTransform(1);

    expect(Math.abs(fullYaw)).toBeGreaterThan(Math.abs(halfYaw));
    expect(fullRoll).toBeGreaterThan(halfRoll);
    expect(fullLift).toBeGreaterThan(halfLift);
    expect(windupStickTransform(4)).toEqual(windupStickTransform(1));
    expect(windupStickTransform(-2)).toEqual(windupStickTransform(0));
  });
});
