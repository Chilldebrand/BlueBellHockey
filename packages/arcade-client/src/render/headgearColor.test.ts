import { describe, expect, it } from "vitest";
import { TEAM_PALETTES } from "@bbh/arcade-core";
import { getHeadgearColor } from "./headgearColor.js";

describe("getHeadgearColor", () => {
  it("uses the home jersey color for home headgear", () => {
    expect(getHeadgearColor(TEAM_PALETTES.home.uniform)).toBe(
      TEAM_PALETTES.home.uniform.jersey
    );
  });

  it("uses the away jersey color for away headgear", () => {
    expect(getHeadgearColor(TEAM_PALETTES.away.uniform)).toBe(
      TEAM_PALETTES.away.uniform.jersey
    );
  });
});
