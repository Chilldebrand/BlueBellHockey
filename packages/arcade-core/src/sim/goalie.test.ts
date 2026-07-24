import { describe, expect, it } from "vitest";
import {
  GIANT_GOALIE_SIZE,
  GOALIE_CONFIG,
  MINI_GOALIE_SIZE,
  RINK_CONFIG,
  bladeWorldPosition,
  createWorld,
  goalieHoldPosition,
  goalieSizeMultiplier,
  stepWorld,
  type GoalieEntity,
  type InputFrame,
  type WorldState
} from "../index";

function playingWorld(): WorldState {
  const world = createWorld(1, "arcade3v3");
  world.phase = "playing";
  return world;
}

function inputFrame(
  slotId: string,
  sequence: number,
  overrides: Partial<InputFrame> = {}
): InputFrame {
  return {
    playerId: "session-a",
    slotId,
    sequence,
    moveX: 0,
    moveY: 0,
    stickX: 0,
    stickY: 0,
    pass: false,
    check: false,
    turbo: false,
    switchTarget: false,
    ...overrides
  };
}

function homeGoalieOf(world: WorldState): GoalieEntity {
  const goalie = world.goalies.find((candidate) => candidate.teamId === "home");
  if (!goalie) {
    throw new Error("Missing home goalie");
  }
  return goalie;
}

function shotAtHomeGoalie(
  world: WorldState,
  overrides: {
    readonly speed?: number;
    readonly lateral?: number;
    readonly height?: number;
  } = {}
): void {
  const goalie = homeGoalieOf(world);
  world.puck.position = {
    x: goalie.position.x + 24,
    y: goalie.position.y + (overrides.lateral ?? 0)
  };
  world.puck.velocity = { x: -(overrides.speed ?? 900), y: 0 };
  world.puck.height = overrides.height ?? 0;
  world.puck.shotBySlotId = "away-skater-1";
  world.puck.lastTouchSlotId = "away-skater-1";
}

function lastSave(world: WorldState) {
  return [...world.eventQueue].reverse().find((event) => event.type === "save");
}

describe("goalie simulation", () => {
  it("keeps goalies inside their creases while tracking the puck laterally", () => {
    const world = playingWorld();
    world.puck.position = { x: RINK_CONFIG.width / 2, y: RINK_CONFIG.height - 40 };

    stepWorld(world, [], 100);

    const homeGoalie = homeGoalieOf(world);
    expect(homeGoalie.position.x).toBe(GOALIE_CONFIG.homeX);
    expect(homeGoalie.position.y).toBeGreaterThan(RINK_CONFIG.height / 2);
    expect(homeGoalie.position.y).toBeLessThanOrEqual(
      RINK_CONFIG.height / 2 + GOALIE_CONFIG.creaseHalfHeight
    );
  });

  it("stops a friendly pass drifting into its own net without crediting a save", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    // A home skater's errant backward pass heading at the home net.
    world.puck.position = {
      x: goalie.position.x + 24,
      y: goalie.position.y
    };
    world.puck.velocity = { x: -900, y: 0 };
    world.puck.lastTouchSlotId = "home-skater-1";

    stepWorld(world, [], 16);

    // Not an own goal, the goalie touched it away...
    expect(world.score.away).toBe(0);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(world.puck.lastTouchSlotId).toBe("home-goalie");
    // ...but no save stat, save event, or shot credited for smothering it.
    expect(world.stats.saves.home).toBe(0);
    expect(world.stats.shots.away).toBe(0);
    expect(lastSave(world)).toBeUndefined();
  });

  it("kicks out an up-ice rebound with save stats for hot shots", () => {
    const world = playingWorld();
    shotAtHomeGoalie(world, { speed: 900 });

    stepWorld(world, [], 16);

    expect(world.score.away).toBe(0);
    expect(world.stats.saves.home).toBe(1);
    expect(world.stats.shots.away).toBe(1);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(world.puck.lastTouchSlotId).toBe("home-goalie");
    expect(world.puck.goalieCarrierId).toBeNull();
    expect(lastSave(world)).toMatchObject({ targetSlotId: "home-goalie" });
  });

  it("picks the save type from puck height and side", () => {
    const padWorld = playingWorld();
    shotAtHomeGoalie(padWorld, { height: 0 });
    stepWorld(padWorld, [], 16);
    expect(lastSave(padWorld)?.detail).toBe("pad");

    const gloveWorld = playingWorld();
    shotAtHomeGoalie(gloveWorld, { height: 70, lateral: 30 });
    stepWorld(gloveWorld, [], 16);
    expect(lastSave(gloveWorld)?.detail).toBe("glove");

    const blockerWorld = playingWorld();
    shotAtHomeGoalie(blockerWorld, { height: 70, lateral: -30 });
    stepWorld(blockerWorld, [], 16);
    expect(lastSave(blockerWorld)?.detail).toBe("blocker");
  });

  it("covers a slow centered shot without a faceoff reset while preserving save events and stats", () => {
    const world = playingWorld();
    const skater = world.skaters[0]!;
    skater.position = { x: 321, y: 456 };
    const beforeRemainingMs = world.remainingMs;
    shotAtHomeGoalie(world, { speed: 300, lateral: 5 });

    stepWorld(world, [], 16);

    expect(lastSave(world)?.detail).toBe("cover");
    expect(world.eventQueue.some((event) => event.type === "cover")).toBe(true);
    expect(world.eventQueue).toContainEqual(
      expect.objectContaining({ type: "save", targetSlotId: "home-goalie" })
    );
    expect(world.stats.saves.home).toBe(1);
    expect(world.stats.shots.away).toBe(1);
    expect(world.puck.goalieCarrierId).toBe("home-goalie");
    expect(world.puck.carrierSlotId).toBeNull();
    expect(world.puck.position).toEqual(goalieHoldPosition(homeGoalieOf(world)));
    expect(world.puck.velocity).toEqual({ x: 0, y: 0 });
    expect(world.puck.height).toBe(0);
    expect(world.puck.verticalVelocity).toBe(0);
    expect(world.score).toEqual({ home: 0, away: 0 });
    expect(world.phase).toBe("playing");
    expect(world.remainingMs).toBe(beforeRemainingMs - 16);
    expect(skater.position).toEqual({ x: 321, y: 456 });
  });

  it("attaches a held puck to its goalie after goalie tracking", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    world.puck.goalieCarrierId = goalie.id;
    world.puck.position = { x: RINK_CONFIG.width / 2, y: RINK_CONFIG.height - 80 };
    world.puck.velocity = { x: 900, y: 500 };
    world.puck.height = 20;
    world.puck.verticalVelocity = 300;

    stepWorld(world, [], 100);

    expect(world.puck.position).toEqual(goalieHoldPosition(goalie));
    expect(world.puck.velocity).toEqual({ x: 0, y: 0 });
    expect(world.puck.height).toBe(0);
    expect(world.puck.verticalVelocity).toBe(0);
  });

  it("sweeps the puck path so a rocket cannot tunnel through the goalie", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    // The puck already ended up BEHIND the goalie this tick — its path
    // crossed the crease between ticks at extreme speed.
    world.puck.position = { x: goalie.position.x - 40, y: goalie.position.y };
    world.puck.velocity = { x: -3200, y: 0 };
    world.puck.shotBySlotId = "away-skater-1";
    world.puck.lastTouchSlotId = "away-skater-1";
    world.puck.assistCandidateSlotId = "away-skater-2";

    stepWorld(world, [], 16);

    expect(world.score.away).toBe(0);
    expect(world.stats.saves.home).toBe(1);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
    expect(world.puck.assistCandidateSlotId).toBeNull();
  });

  it("cuts the angle on a wide carrier instead of parking on the near post", () => {
    const world = playingWorld();
    const shooter = world.skaters.find((s) => s.id === "away-skater-1")!;
    shooter.position = { x: 730, y: RINK_CONFIG.height / 2 + 320 };
    shooter.facing = Math.PI; // bearing down on the home net from the wing
    world.puck.carrierSlotId = shooter.id;
    world.puck.position = { ...bladeWorldPosition(shooter) };

    for (let tick = 1; tick <= 15; tick += 1) {
      stepWorld(world, [inputFrame(shooter.id, tick)], 16);
    }

    const goalie = homeGoalieOf(world);
    // Angle line from a +y-wing carrier crosses the goalie plane just above
    // center — nowhere near the +y crease edge the old tracker slid to.
    expect(goalie.position.y).toBeGreaterThan(RINK_CONFIG.height / 2);
    expect(goalie.position.y).toBeLessThan(
      RINK_CONFIG.height / 2 + GOALIE_CONFIG.creaseHalfHeight - 40
    );
  });

  it("saves the cross-corner snap that used to be automatic from the wing", () => {
    const world = playingWorld();
    const shooter = world.skaters.find((s) => s.id === "away-skater-1")!;
    shooter.position = { x: 730, y: RINK_CONFIG.height / 2 + 320 };
    shooter.facing = Math.PI;
    world.puck.carrierSlotId = shooter.id;
    world.puck.position = { ...bladeWorldPosition(shooter) };
    // Everyone else far up-ice, chasing from behind the shot line, so the
    // save (or goal) is purely goalie-vs-shooter.
    for (const skater of world.skaters) {
      if (skater.id !== shooter.id) {
        skater.position = { x: 1600 + Math.abs(skater.position.y % 400), y: skater.position.y };
      }
    }

    // Let the goalie settle onto his angle while the carrier holds the wing.
    for (let tick = 1; tick <= 15; tick += 1) {
      stepWorld(world, [inputFrame(shooter.id, tick)], 16);
    }

    // Full-corner snap at the far (-y) post — the reported exploit.
    shooter.gesture.pendingReleaseType = "snap";
    shooter.gesture.pendingReleasePower = 0.9;
    stepWorld(world, [inputFrame(shooter.id, 16, { moveY: -1 })], 16);
    expect(world.puck.carrierSlotId).toBeNull();

    for (let tick = 0; tick < 45; tick += 1) {
      stepWorld(world, [], 16);
    }

    expect(world.score.away).toBe(0);
    expect(world.stats.saves.home).toBe(1);
  });

  it("reacts with latency so a fast cross-crease puck opens the far side", () => {
    const world = playingWorld();
    // Puck level with the goalie but ripping laterally toward the +y post.
    world.puck.position = {
      x: homeGoalieOf(world).position.x + 260,
      y: RINK_CONFIG.height / 2
    };
    world.puck.velocity = { x: -120, y: 800 };
    world.puck.shotBySlotId = "away-skater-1";
    world.puck.lastTouchSlotId = "away-skater-1";

    stepWorld(world, [], 16);

    // With reaction lag the goalie aims where the puck *was* (back toward center
    // / -y), so he trails the +y motion instead of pinning the puck the way the
    // old frame-perfect tracker did.
    expect(homeGoalieOf(world).position.y).toBeLessThan(RINK_CONFIG.height / 2);
  });

  it("ignores a teammate's dump-in (no phantom saves)", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    world.puck.position = { x: goalie.position.x + 24, y: goalie.position.y };
    world.puck.velocity = { x: -400, y: 0 };
    world.puck.lastTouchSlotId = "home-skater-2";
    world.puck.shotBySlotId = null;

    stepWorld(world, [], 16);

    expect(world.stats.saves.home).toBe(0);
  });
});

describe("goalie-resize powerups", () => {
  it("scopes the resize to the right goalie by owner team", () => {
    const world = playingWorld();
    // A HOME skater holding both: giant buffs the HOME goalie, mini shrinks
    // the goalie he's attacking (AWAY).
    world.activePowerups.push({
      id: "gg",
      type: "giant-goalie",
      slotId: "home-skater-1",
      position: null,
      expiresAtMs: 999_999
    });
    world.activePowerups.push({
      id: "mg",
      type: "mini-goalie",
      slotId: "home-skater-1",
      position: null,
      expiresAtMs: 999_999
    });

    expect(goalieSizeMultiplier(world, "home")).toBeCloseTo(GIANT_GOALIE_SIZE);
    expect(goalieSizeMultiplier(world, "away")).toBeCloseTo(MINI_GOALIE_SIZE);
    // No powerups → neutral size.
    expect(goalieSizeMultiplier(playingWorld(), "home")).toBe(1);
  });

  it("giant goalie stops a shot that beats a normal-size goalie", () => {
    // Lateral 105 is inside the net but past the normal 84 reach → normally in.
    const normal = playingWorld();
    shotAtHomeGoalie(normal, { speed: 900, lateral: 105 });
    stepWorld(normal, [], 16);
    expect(normal.stats.saves.home).toBe(0);

    const giant = playingWorld();
    giant.activePowerups.push({
      id: "gg",
      type: "giant-goalie",
      slotId: "home-skater-1",
      position: null,
      expiresAtMs: 999_999
    });
    shotAtHomeGoalie(giant, { speed: 900, lateral: 105 });
    stepWorld(giant, [], 16);
    expect(giant.stats.saves.home).toBe(1);
  });

  it("mini goalie lets through a shot a normal-size goalie stops", () => {
    // Lateral 60 is inside the normal 84 reach but past the shrunk ~38 reach.
    const normal = playingWorld();
    shotAtHomeGoalie(normal, { speed: 900, lateral: 60 });
    stepWorld(normal, [], 16);
    expect(normal.stats.saves.home).toBe(1);

    const mini = playingWorld();
    // Owned by an AWAY skater (the team attacking the home goalie).
    mini.activePowerups.push({
      id: "mg",
      type: "mini-goalie",
      slotId: "away-skater-1",
      position: null,
      expiresAtMs: 999_999
    });
    shotAtHomeGoalie(mini, { speed: 900, lateral: 60 });
    stepWorld(mini, [], 16);
    expect(mini.stats.saves.home).toBe(0);
  });
});
