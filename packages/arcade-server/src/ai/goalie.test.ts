import { describe, expect, it } from "vitest";
import { createWorld } from "@bbh/arcade-core";
import { createServerGoalieIntent } from "./goalie.js";

describe("server goalie AI", () => {
  it("targets puck y while keeping goalie x authoritative", () => {
    const world = createWorld(1, "arcade3v3");
    const goalie = world.goalies[0];
    world.puck.position = { x: 1000, y: 740 };

    expect(createServerGoalieIntent(goalie, world.puck)).toEqual({
      goalieId: goalie.id,
      target: {
        x: goalie.position.x,
        y: 740
      }
    });
  });
});
