import { describe, expect, it } from "vitest";
import {
  GOALIE_SLOTS,
  MATCH_START_COUNTDOWN_MS,
  SKATER_SLOTS,
  beginPlay,
  createWorld,
  startFaceoffCountdown,
  stepWorld,
  type GoalLimit,
  type InputFrame,
  type TimeLimitMs
} from "../index";

function moveFrame(slotId: string, sequence: number): InputFrame {
  return {
    playerId: "test",
    slotId,
    sequence,
    moveX: 1,
    moveY: 0,
    stickX: 0,
    stickY: 0,
    pass: false,
    check: false,
    turbo: true,
    switchTarget: false
  };
}

describe("world lifecycle", () => {
  it("creates a deterministic initial world for the same seed and mode", () => {
    const first = createWorld(12345, "arcade3v3");
    const second = createWorld(12345, "arcade3v3");

    expect(second).toEqual(first);
  });

  it("creates six skater slots and two server-owned goalie slots", () => {
    const world = createWorld(12345, "arcade3v3");

    expect(SKATER_SLOTS).toHaveLength(6);
    expect(world.skaters).toHaveLength(6);
    expect(SKATER_SLOTS.filter((slot) => slot.teamId === "home")).toHaveLength(3);
    expect(SKATER_SLOTS.filter((slot) => slot.teamId === "away")).toHaveLength(3);

    expect(GOALIE_SLOTS).toHaveLength(2);
    expect(world.goalies).toHaveLength(2);
    expect(world.goalies.every((goalie) => goalie.owner === "server")).toBe(true);
  });

  it("initializes score to zero for both teams", () => {
    const world = createWorld(12345, "arcade3v3");

    expect(world.score).toEqual({
      home: 0,
      away: 0
    });
  });

  it("initializes zero player stat lines for all skaters", () => {
    const world = createWorld(12345, "arcade3v3");

    for (const slot of SKATER_SLOTS) {
      expect(world.stats.players[slot.id]).toEqual({
        goals: 0,
        assists: 0,
        hits: 0
      });
    }
  });

  it("advances the clock only while playing", () => {
    const waitingWorld = createWorld(12345, "arcade3v3");

    const waitingResult = stepWorld(waitingWorld, [], 16);
    expect(waitingResult).toBe(waitingWorld);
    expect(waitingWorld.time.nowMs).toBe(0);

    const playingWorld = createWorld(12345, "arcade3v3");
    playingWorld.phase = "playing";

    const playingResult = stepWorld(playingWorld, [], 16);
    expect(playingResult).toBe(playingWorld);
    expect(playingWorld.time.nowMs).toBe(16);
    expect(playingWorld.time.tick).toBe(1);
  });

  it("enters unlimited overtime when tied regulation reaches zero", () => {
    const world = createWorld(12345, "arcade3v3", undefined, {
      timeLimitMs: 180_000,
      goalLimit: 0
    });
    world.phase = "playing";
    world.remainingMs = 16;
    world.score = { home: 2, away: 2 };

    stepWorld(world, [], 16);

    expect(world.phase).toBe("playing");
    expect(world.isOvertime).toBe(true);
    expect(world.remainingMs).toBe(0);
    expect(world.winnerTeamId).toBeNull();
  });

  it("snapshots caller-provided rules when creating a world", () => {
    const rules: { timeLimitMs: TimeLimitMs; goalLimit: GoalLimit } = {
      timeLimitMs: 180_000,
      goalLimit: 3
    };
    const world = createWorld(12345, "arcade3v3", undefined, rules);

    rules.timeLimitMs = 600_000;
    rules.goalLimit = 10;

    expect(world.rules).toEqual({ timeLimitMs: 180_000, goalLimit: 3 });
    expect(world.remainingMs).toBe(180_000);
  });

  it("creates independent mutable vectors for simulation entities", () => {
    const world = createWorld(12345, "arcade3v3");

    expect(world.skaters[0].velocity).not.toBe(world.skaters[1].velocity);
    expect(world.skaters[0].velocity).not.toBe(world.goalies[0].velocity);
    expect(world.skaters[0].velocity).not.toBe(world.puck.velocity);
  });

  it("holds play during the match-start countdown and resumes after it", () => {
    const world = createWorld(12345, "arcade3v3");
    beginPlay(world);

    expect(world.phase).toBe("playing");
    expect(world.faceoffUntilMs).toBe(MATCH_START_COUNTDOWN_MS);

    const spawnX = world.skaters[0].position.x;
    const startingRemainingMs = world.remainingMs;

    // Full-throttle input during the hold: time flows, nothing moves.
    let sequence = 0;
    while (world.time.nowMs < MATCH_START_COUNTDOWN_MS) {
      stepWorld(world, [moveFrame("home-skater-1", (sequence += 1))], 16);
    }
    expect(world.skaters[0].position.x).toBe(spawnX);
    expect(world.remainingMs).toBe(startingRemainingMs);
    expect(world.time.tick).toBeGreaterThan(0);

    // First live tick: physics and the clock resume.
    stepWorld(world, [moveFrame("home-skater-1", (sequence += 1))], 16);
    expect(world.skaters[0].position.x).toBeGreaterThan(spawnX);
    expect(world.remainingMs).toBe(startingRemainingMs - 16);
  });

  it("does not latch a phantom shot from stick motion during the hold", () => {
    const world = createWorld(12345, "arcade3v3");
    beginPlay(world);

    // Stick held fully back throughout the countdown...
    let sequence = 0;
    while (world.time.nowMs < MATCH_START_COUNTDOWN_MS) {
      stepWorld(
        world,
        [{ ...moveFrame("home-skater-1", (sequence += 1)), stickY: -1 }],
        16
      );
    }

    // ...then forward on the first live tick: the flick delta is one tick's
    // worth, not five seconds' worth, so no wrist shot fires from stale state.
    stepWorld(
      world,
      [{ ...moveFrame("home-skater-1", (sequence += 1)), stickY: 0.2 }],
      16
    );
    expect(world.skaters[0].gesture.pendingReleaseType).toBe("none");
  });

  it("shifts active powerup and banana windows across a countdown", () => {
    const world = createWorld(12345, "arcade3v3");
    world.phase = "playing";
    world.activePowerups.push({
      id: "active-test",
      type: "speed-boost",
      slotId: "home-skater-1",
      position: null,
      expiresAtMs: 2000
    });
    world.bananaPeels.push({
      id: "banana-test",
      position: { x: 100, y: 100 },
      spawnedAtMs: 0
    });

    startFaceoffCountdown(world, 3000);

    expect(world.activePowerups[0].expiresAtMs).toBe(5000);
    expect(world.bananaPeels[0].spawnedAtMs).toBe(3000);
  });

  it("emits one clockCountdown event per second across the final ten", () => {
    const world = createWorld(12345, "arcade3v3");
    world.phase = "playing";
    world.remainingMs = 10_500;

    while (world.remainingMs > 0) {
      stepWorld(world, [], 16);
    }

    const ticks = world.eventQueue.filter(
      (event) => event.type === "clockCountdown"
    );
    // Retention trims events older than 5s; the queue holds the recent tail,
    // and every retained id is a unique second from 10..1.
    expect(ticks.length).toBeGreaterThan(0);
    const seconds = ticks.map((event) => event.detail);
    expect(new Set(seconds).size).toBe(seconds.length);
    expect(seconds).toContain("1");
  });

  it("emits no clockCountdown events once overtime pins the clock", () => {
    const world = createWorld(12345, "arcade3v3");
    world.phase = "playing";
    world.remainingMs = 16;
    world.score = { home: 1, away: 1 };

    stepWorld(world, [], 16);
    expect(world.isOvertime).toBe(true);
    world.eventQueue = [];

    for (let index = 0; index < 20; index += 1) {
      stepWorld(world, [], 16);
    }
    expect(
      world.eventQueue.some((event) => event.type === "clockCountdown")
    ).toBe(false);
  });

  it("stays byte-identical across a scripted countdown for the same seed", () => {
    const run = () => {
      const world = createWorld(777, "arcade3v3");
      beginPlay(world);
      for (let sequence = 1; sequence <= 400; sequence += 1) {
        stepWorld(
          world,
          [{ ...moveFrame("home-skater-1", sequence), stickY: sequence % 2 }],
          16
        );
      }
      return JSON.stringify(world);
    };

    expect(run()).toBe(run());
  });
});
