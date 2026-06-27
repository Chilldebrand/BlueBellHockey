import { describe, expect, it } from "vitest";
import { getArcadeCoreInfo } from "./index";

describe("arcade core", () => {
  it("exports package metadata", () => {
    expect(getArcadeCoreInfo()).toEqual({
      name: "@bbh/arcade-core",
      version: "0.1.0"
    });
  });
});
