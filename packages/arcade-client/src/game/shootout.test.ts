import { describe, expect, it } from "vitest";
import { MATCH_CONFIG, RINK_CONFIG, type WorldState } from "@bbh/arcade-core";
import {
  LOOSE_RESOLVE_MS,
  RESULT_HOLD_MS,
  SHOOTOUT_ATTEMPTS,
  SHOOTOUT_SLOT_ID,
  SHOT_RESOLVE_MS,
  createInitialShootoutState,
  createShootoutSim,
  respawnForAttempt,
  stepShootoutTransition,
  type ShootoutState
} from "./shootout.js";

const CHARACTER_ID = "rook-rocket";

function createTestWorld(): WorldState {
  return createShootoutSim({ characterId: CHARACTER_ID }).getWorld();
}

/** Advance the sim with neutral (null) input for a number of ticks. */
function coast(sim: ReturnType<typeof createShootoutSim>, ticks: number): void {
  for (let index = 0; index < ticks; index += 1) {
    sim.advance(MATCH_CONFIG.fixedTickMs, () => null);
  }
}

function atTime(world: WorldState, nowMs: number): number {
  // Simulate the post-step clock: events landed at preStep, time moved on.
  const preStepNowMs = nowMs;
  world.time = { ...world.time, nowMs: nowMs + MATCH_CONFIG.fixedTickMs };
  return preStepNowMs;
}

function shotLiveState(sinceMs = 0): ShootoutState {
  return {
    ...createInitialShootoutState(),
    phase: "shotLive",
    phaseSinceMs: sinceMs
  };
}

describe("shootout sim setup", () => {
  it("builds a one-skater world with the shooter at center holding the puck", () => {
    const sim = createShootoutSim({ characterId: CHARACTER_ID });
    const world = sim.getWorld();

    expect(world.skaters).toHaveLength(1);
    expect(world.skaters[0].id).toBe(SHOOTOUT_SLOT_ID);
    expect(world.skaters[0].characterId).toBe(CHARACTER_ID);
    expect(world.goalies).toHaveLength(2);
    expect(world.skaters[0].position).toEqual({
      x: RINK_CONFIG.width / 2,
      y: RINK_CONFIG.height / 2
    });
    expect(world.puck.carrierSlotId).toBe(SHOOTOUT_SLOT_ID);
    expect(sim.getState().phase).toBe("approach");
    expect(sim.getControlledEntityId()).toBe(SHOOTOUT_SLOT_ID);
  });

  it("keeps the session endless and free of powerup litter", () => {
    const sim = createShootoutSim({ characterId: CHARACTER_ID });
    const world = sim.getWorld();
    world.powerupPickups = [
      { id: "test-drop", type: "speed-boost", position: { x: 100, y: 100 }, spawnedAtMs: 0 }
    ];

    coast(sim, 40);

    expect(sim.getWorld().remainingMs).toBe(MATCH_CONFIG.periodMs);
    expect(sim.getWorld().powerupPickups).toEqual([]);
    expect(sim.getWorld().bananaPeels).toEqual([]);
    expect(sim.getWorld().faceoffUntilMs).toBe(0);
  });

  it("reset() restores a fresh five attempts", () => {
    const sim = createShootoutSim({ characterId: CHARACTER_ID });
    coast(sim, 20);
    sim.reset();

    expect(sim.getState()).toEqual(createInitialShootoutState());
    expect(sim.getWorld().puck.carrierSlotId).toBe(SHOOTOUT_SLOT_ID);
  });
});

describe("shootout attempt transitions", () => {
  it("marks a live shot when the player releases one", () => {
    const world = createTestWorld();
    world.puck.carrierSlotId = null;
    world.puck.shotBySlotId = SHOOTOUT_SLOT_ID;
    world.puck.velocity = { x: 900, y: 0 };
    const preStep = atTime(world, 1000);

    const next = stepShootoutTransition(
      world,
      createInitialShootoutState(),
      preStep
    );

    expect(next.phase).toBe("shotLive");
  });

  it("resolves a goal from the home score delta", () => {
    const world = createTestWorld();
    world.score.home = 1;
    world.puck.velocity = { x: 900, y: 0 };
    const preStep = atTime(world, 1000);

    const next = stepShootoutTransition(world, shotLiveState(500), preStep);

    expect(next.phase).toBe("resolved");
    expect(next.lastResult).toBe("goal");
  });

  it("resolves a miss on a save event", () => {
    const world = createTestWorld();
    world.puck.carrierSlotId = null;
    world.puck.velocity = { x: -300, y: 0 };
    const preStep = atTime(world, 1000);
    world.eventQueue.push({
      id: "save-1",
      type: "save",
      atMs: preStep,
      targetSlotId: "away-goalie",
      detail: "pad"
    });

    const next = stepShootoutTransition(world, shotLiveState(500), preStep);

    expect(next.phase).toBe("resolved");
    expect(next.lastResult).toBe("miss");
  });

  it("resolves a miss on a post hit", () => {
    const world = createTestWorld();
    world.puck.carrierSlotId = null;
    world.puck.velocity = { x: -300, y: 40 };
    const preStep = atTime(world, 1000);
    world.eventQueue.push({ id: "post-1", type: "post", atMs: preStep });

    const next = stepShootoutTransition(world, shotLiveState(500), preStep);

    expect(next.phase).toBe("resolved");
    expect(next.lastResult).toBe("miss");
  });

  it("resolves a miss when the rebound returns to the shooter", () => {
    const world = createTestWorld();
    world.puck.carrierSlotId = SHOOTOUT_SLOT_ID;
    const preStep = atTime(world, 1000);

    const next = stepShootoutTransition(world, shotLiveState(500), preStep);

    expect(next.phase).toBe("resolved");
    expect(next.lastResult).toBe("miss");
  });

  it("resolves a miss when a wide shot times out", () => {
    const world = createTestWorld();
    world.puck.carrierSlotId = null;
    world.puck.velocity = { x: 0, y: 400 };
    const preStep = atTime(world, 5000);

    const next = stepShootoutTransition(
      world,
      shotLiveState(5000 - SHOT_RESOLVE_MS),
      preStep
    );

    expect(next.phase).toBe("resolved");
    expect(next.lastResult).toBe("miss");
  });

  it("lets a deke go loose and be regathered without ending the attempt", () => {
    const world = createTestWorld();
    world.puck.carrierSlotId = null;
    world.puck.velocity = { x: 50, y: 20 };
    let preStep = atTime(world, 1000);

    const loose = stepShootoutTransition(
      world,
      createInitialShootoutState(),
      preStep
    );
    expect(loose.phase).toBe("loose");

    world.puck.carrierSlotId = SHOOTOUT_SLOT_ID;
    preStep = atTime(world, 1400);
    const regathered = stepShootoutTransition(world, loose, preStep);

    expect(regathered.phase).toBe("approach");
    expect(regathered.results).toHaveLength(0);
  });

  it("times a lost loose puck out into a miss", () => {
    const world = createTestWorld();
    world.puck.carrierSlotId = null;
    const preStep = atTime(world, 1000 + LOOSE_RESOLVE_MS);

    const next = stepShootoutTransition(
      world,
      { ...createInitialShootoutState(), phase: "loose", phaseSinceMs: 1000 },
      preStep
    );

    expect(next.phase).toBe("resolved");
    expect(next.lastResult).toBe("miss");
  });

  it("commits the result after the hold and completes after five", () => {
    const world = createTestWorld();
    let state: ShootoutState = {
      ...createInitialShootoutState(),
      attemptIndex: 3,
      results: ["goal", "miss", "goal"],
      phase: "resolved",
      phaseSinceMs: 1000,
      lastResult: "miss"
    };

    // Hold not elapsed: nothing commits.
    let preStep = atTime(world, 1000 + RESULT_HOLD_MS - 100);
    state = stepShootoutTransition(world, state, preStep);
    expect(state.phase).toBe("resolved");
    expect(state.results).toHaveLength(3);

    // Hold elapsed: result 4 commits, back to approach.
    preStep = atTime(world, 1000 + RESULT_HOLD_MS);
    state = stepShootoutTransition(world, state, preStep);
    expect(state.phase).toBe("approach");
    expect(state.results).toEqual(["goal", "miss", "goal", "miss"]);
    expect(state.attemptIndex).toBe(4);

    // Fifth result completes the shootout.
    state = {
      ...state,
      phase: "resolved",
      phaseSinceMs: 8000,
      lastResult: "goal"
    };
    preStep = atTime(world, 8000 + RESULT_HOLD_MS);
    state = stepShootoutTransition(world, state, preStep);
    expect(state.phase).toBe("complete");
    expect(state.results).toEqual(["goal", "miss", "goal", "miss", "goal"]);
    expect(state.attemptIndex).toBe(SHOOTOUT_ATTEMPTS);
  });
});

describe("respawnForAttempt", () => {
  it("re-centers the shooter with possession and clears goalie cover", () => {
    const world = createTestWorld();
    world.puck.goalieCarrierId = "away-goalie";
    world.puck.carrierSlotId = null;
    world.skaters[0].position = { x: 2200, y: 400 };
    world.skaters[0].velocity = { x: 500, y: 0 };

    respawnForAttempt(world);

    expect(world.puck.goalieCarrierId).toBeNull();
    expect(world.puck.carrierSlotId).toBe(SHOOTOUT_SLOT_ID);
    expect(world.skaters[0].position).toEqual({
      x: RINK_CONFIG.width / 2,
      y: RINK_CONFIG.height / 2
    });
    expect(world.skaters[0].velocity).toEqual({ x: 0, y: 0 });
    expect(world.faceoffUntilMs).toBe(0);
  });
});

describe("shootout end-to-end attempt", () => {
  it("records a result and respawns after a real shot at the net", () => {
    const sim = createShootoutSim({ characterId: CHARACTER_ID });
    const world = sim.getWorld();

    // Fire the puck at the away net directly (bypasses gesture input, which
    // needs stick-flick scripting): a live shot the goalie must confront.
    const awayGoalie = world.goalies.find((goalie) => goalie.teamId === "away")!;
    world.puck.carrierSlotId = null;
    world.puck.position = {
      x: awayGoalie.position.x - 400,
      y: awayGoalie.position.y
    };
    world.puck.velocity = { x: 1300, y: 0 };
    world.puck.shotBySlotId = SHOOTOUT_SLOT_ID;
    world.puck.shotAtMs = world.time.nowMs;
    world.puck.lastTouchSlotId = SHOOTOUT_SLOT_ID;

    // Enough sim time for shot resolution + the result hold + respawn:
    // (SHOT_RESOLVE_MS + RESULT_HOLD_MS) / 16 ≈ 250 ticks; pad generously.
    coast(sim, 500);

    const state = sim.getState();
    expect(state.results).toHaveLength(1);
    expect(state.attemptIndex).toBe(1);
    expect(state.phase).toBe("approach");
    // Respawned: shooter back at center with the puck.
    expect(sim.getWorld().puck.carrierSlotId).toBe(SHOOTOUT_SLOT_ID);
    expect(sim.getWorld().skaters[0].position.x).toBeCloseTo(
      RINK_CONFIG.width / 2,
      0
    );
  });
});
