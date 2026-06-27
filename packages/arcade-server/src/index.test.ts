import { describe, expect, it } from "vitest";
import { getArcadeServerInfo } from "./index";

describe("arcade server", () => {
  it("exports package metadata with core version", () => {
    expect(getArcadeServerInfo()).toEqual({
      name: "@bbh/arcade-server",
      coreVersion: "0.1.0"
    });
  });
});
