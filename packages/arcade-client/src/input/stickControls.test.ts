import { describe, expect, it } from "vitest";
import { transformStickForTeam } from "./stickControls.js";

describe("transformStickForTeam", () => {
  it("preserves vertical stick input for the home team", () => {
    expect(transformStickForTeam(0.75, "home", false)).toBe(0.75);
  });

  it("inverts vertical stick input for the away team by default", () => {
    expect(transformStickForTeam(0.75, "away", false)).toBe(-0.75);
  });

  it("preserves vertical stick input for the away team with Always Up enabled", () => {
    expect(transformStickForTeam(0.75, "away", true)).toBe(0.75);
  });
});
