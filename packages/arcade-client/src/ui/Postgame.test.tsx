import { createWorld } from "@bbh/arcade-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Postgame } from "./Postgame.js";

function renderPostgame(
  overrides: Partial<Parameters<typeof Postgame>[0]> = {}
): string {
  const world = createWorld(7, "arcade3v3");
  world.phase = "ended";
  world.winnerTeamId = "home";
  world.score = { home: 5, away: 3 };
  world.stats.players["home-skater-1"] = {
    goals: 2,
    assists: 1,
    hits: 4,
    shots: 6,
    saves: 0,
    powerups: 1
  };
  world.stats.players["away-skater-1"] = {
    goals: 1,
    assists: 2,
    hits: 2,
    shots: 4,
    saves: 0,
    powerups: 0
  };
  world.stats.players["home-skater-2"] = {
    goals: 0,
    assists: 0,
    hits: 6,
    shots: 2,
    saves: 0,
    powerups: 2
  };
  world.stats.players["home-goalie"] = {
    goals: 0,
    assists: 0,
    hits: 0,
    shots: 0,
    saves: 8,
    powerups: 0
  };

  return renderToStaticMarkup(
    <Postgame
      world={world}
      rematchVotes={2}
      localHasVoted={false}
      isHost
      onRematch={vi.fn()}
      onForceRematch={vi.fn()}
      onChangeTeams={vi.fn()}
      onExit={vi.fn()}
      {...overrides}
    />
  );
}

describe("Postgame", () => {
  it("labels the overlay and headlines the winning team", () => {
    const html = renderPostgame();
    expect(html).toContain('aria-label="Postgame"');
    expect(html).toContain("BLUE BLADES WIN");
    // Score row shows both short names and the tabular score.
    expect(html).toContain(">BLU<");
    expect(html).toContain(">RED<");
    expect(html).toContain(">5<");
    expect(html).toContain(">3<");
  });

  it("shows DRAW when there is no winner", () => {
    const world = createWorld(7, "arcade3v3");
    world.phase = "ended";
    world.winnerTeamId = null;
    world.score = { home: 4, away: 4 };

    const html = renderToStaticMarkup(
      <Postgame
        world={world}
        rematchVotes={0}
        localHasVoted={false}
        isHost={false}
        onRematch={vi.fn()}
        onForceRematch={vi.fn()}
        onChangeTeams={vi.fn()}
        onExit={vi.fn()}
      />
    );

    expect(html).toContain(">DRAW</h1>");
  });

  it("renders the three stars with rank labels and player names", () => {
    const html = renderPostgame();
    expect(html).toContain("FIRST STAR");
    expect(html).toContain("SECOND STAR");
    expect(html).toContain("THIRD STAR");
    expect(html).toContain("Rook Rocket"); // first star (home-skater-1)
    expect(html).toContain("Luna Thread"); // second star (away-skater-1)
    expect(html).toContain("Nova Screen"); // third star (home-skater-2)
  });

  it("renders both team stat panels with per-player and goalie rows", () => {
    const html = renderPostgame();
    expect(html).toContain("BLUE BLADES");
    expect(html).toContain("RED ROCKETS");
    expect(html).toContain("SHOTS");
    expect(html).toContain("SAVES");
    expect(html).toContain("PWR");
    // Goalie row: "G" number + saves total surfaced from the goalie stat line.
    expect(html).toContain("Goalie");
    expect(html).toContain(">8<");
  });

  it("shows the live vote tally in the rematch button", () => {
    const html = renderPostgame({ rematchVotes: 2 });
    expect(html).toContain("2/6 VOTES · 4 TO START");
    expect(html).toContain("REMATCH ▸");
  });

  it("reflects the local voted state", () => {
    const html = renderPostgame({ localHasVoted: true });
    expect(html).toContain("VOTED ✓");
    expect(html).toContain("disabled");
  });

  it("shows Force Rematch only to the host", () => {
    expect(renderPostgame({ isHost: true })).toContain("Force Rematch");
    expect(renderPostgame({ isHost: false })).not.toContain("Force Rematch");
  });

  it("offers Change Teams and Exit actions", () => {
    const html = renderPostgame();
    expect(html).toContain("Change Teams");
    expect(html).toContain("Exit");
  });
});
