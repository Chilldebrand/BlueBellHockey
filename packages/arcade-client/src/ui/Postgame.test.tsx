import { createWorld } from "@bbh/arcade-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { postgameRows } from "./Postgame.js";
import { Postgame } from "./Postgame.js";

describe("Postgame", () => {
  it("maps authoritative server stats into table rows", () => {
    const world = createWorld(7, "arcade3v3");
    world.stats.home.goals = 3;
    world.stats.away.shots = 9;

    expect(postgameRows(world.stats)).toContainEqual({
      label: "Goals",
      home: 3,
      away: 0
    });
    expect(postgameRows(world.stats)).toContainEqual({
      label: "Shots",
      home: 0,
      away: 9
    });
  });

  it("renders the centered first-to-five result, three stars, totals, and actions", () => {
    const world = createWorld(7, "arcade3v3");
    world.phase = "ended";
    world.winnerTeamId = "home";
    world.score = { home: 5, away: 3 };
    world.stats.home = { goals: 5, shots: 12, saves: 7, hits: 11, takeaways: 4 };
    world.stats.away = { goals: 3, shots: 9, saves: 7, hits: 8, takeaways: 2 };
    world.stats.players["home-skater-1"] = { goals: 2, assists: 1, hits: 4 };
    world.stats.players["away-skater-1"] = { goals: 1, assists: 2, hits: 2 };
    world.stats.players["home-skater-2"] = { goals: 0, assists: 0, hits: 6 };

    const html = renderToStaticMarkup(
      <Postgame
        world={world}
        onRematch={vi.fn()}
        onBackToLobby={vi.fn()}
      />
    );

    expect(html).toContain('class="postgame-backdrop"');
    expect(html).toContain('class="postgame-modal"');
    expect(html).toContain("HOME WINS");
    expect(html).toContain("FIRST TO 5");
    expect(html).toContain("5 - 3");
    expect(html).toContain("First Star");
    expect(html).toContain("Second Star");
    expect(html).toContain("Third Star");
    expect(html).toContain("Rook Rocket");
    expect(html).toContain("Luna Thread");
    expect(html).toContain("Nova Screen");
    expect(html).toContain("G 2 · A 1 · H 4");
    expect(html).toContain("G 1 · A 2 · H 2");
    expect(html).toContain("G 0 · A 0 · H 6");
    expect(html).toContain("TEAM TOTALS");
    expect(html).toContain("Goals");
    expect(html).toContain("Takeaways");
    expect(html).toContain("Rematch");
    expect(html).toContain("Back To Lobby");
  });
});
