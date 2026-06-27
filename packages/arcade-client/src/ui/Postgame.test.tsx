import { describe, expect, it } from "vitest";
import { createInitialStats } from "@bbh/arcade-core";
import { postgameRows } from "./Postgame.js";

describe("Postgame", () => {
  it("maps authoritative server stats into table rows", () => {
    const stats = createInitialStats();
    stats.home.goals = 3;
    stats.away.shots = 9;

    expect(postgameRows(stats)).toContainEqual({
      label: "Goals",
      home: 3,
      away: 0
    });
    expect(postgameRows(stats)).toContainEqual({
      label: "Shots",
      home: 0,
      away: 9
    });
  });
});
