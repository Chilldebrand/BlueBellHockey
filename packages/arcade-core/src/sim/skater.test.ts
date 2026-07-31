import { describe, expect, it } from "vitest";
import {
  ARCADE_CHARACTERS,
  RINK_CONFIG,
  SKATER_MOVEMENT_CONFIG,
  SPEED_STAT_SPREAD,
  createWorld,
  stepWorld,
  type InputFrame,
  type WorldState
} from "../index";

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

function playingWorld(seed = 1): WorldState {
  const world = createWorld(seed, "arcade3v3");
  world.phase = "playing";
  return world;
}

function speedOf(world: WorldState, slotId: string): number {
  const skater = world.skaters.find((candidate) => candidate.id === slotId);
  if (!skater) {
    throw new Error(`Missing skater ${slotId}`);
  }

  return Math.hypot(skater.velocity.x, skater.velocity.y);
}

describe("skater movement", () => {
  it("accelerates along its facing and respects the speed cap", () => {
    const world = playingWorld();
    const skater = world.skaters[0]; // home: spawns facing +x
    const startX = skater.position.x;

    // 1.2s of full-forward input: enough to reach the cap, short enough to
    // stay off the far boards.
    for (let tick = 0; tick < 12; tick += 1) {
      stepWorld(world, [inputFrame(skater.id, tick + 1, { moveX: 1 })], 100);
    }

    expect(skater.position.x).toBeGreaterThan(startX);
    expect(skater.velocity.x).toBeGreaterThan(0);
    expect(speedOf(world, skater.id)).toBeLessThanOrEqual(
      SKATER_MOVEMENT_CONFIG.maxSpeed + 1e-6
    );
  });

  it("gives higher speed stats a real but small edge on the ice", () => {
    const bySpeed = [...ARCADE_CHARACTERS].sort(
      (a, b) => a.stats.speed - b.stats.speed
    );
    const slowest = bySpeed[0];
    const fastest = bySpeed[bySpeed.length - 1];
    expect(fastest.stats.speed).toBeGreaterThan(slowest.stats.speed);

    const world = playingWorld();
    const fastSkater = world.skaters[0];
    const slowSkater = world.skaters[2];
    fastSkater.characterId = fastest.id;
    slowSkater.characterId = slowest.id;

    // 3s of parallel full-throttle skating.
    for (let tick = 0; tick < 30; tick += 1) {
      stepWorld(
        world,
        [
          inputFrame(fastSkater.id, tick + 1, { moveX: 1 }),
          inputFrame(slowSkater.id, tick + 1, { moveX: 1 })
        ],
        100
      );
    }

    const fastSpeed = speedOf(world, fastSkater.id);
    const slowSpeed = speedOf(world, slowSkater.id);
    expect(fastSpeed).toBeGreaterThan(slowSpeed);
    // The whole roster spread stays within the tight stat band (~6%).
    expect(fastSpeed / slowSpeed).toBeLessThanOrEqual(
      1 + SPEED_STAT_SPREAD + 0.01
    );
  });

  it("backskates the way the stick pushes while the body faces the other way", () => {
    const world = playingWorld();
    const skater = world.skaters[0]; // home: spawns facing +x
    const startX = skater.position.x;

    // Push toward -x (retreating down ice) with backskate held.
    for (let tick = 0; tick < 12; tick += 1) {
      stepWorld(
        world,
        [inputFrame(skater.id, tick + 1, { moveX: -1, skateBackward: true })],
        100
      );
    }

    // Travelling -x…
    expect(skater.position.x).toBeLessThan(startX);
    expect(skater.velocity.x).toBeLessThan(0);
    // …while still squared up the way he came from, which is the whole point:
    // his stick and any check stay pointed at the play.
    expect(Math.cos(skater.facing)).toBeGreaterThan(0.9);
  });

  it("costs top speed to backskate, and hustle is unavailable", () => {
    // All three start at centre ice driving +x, already squared the way that
    // input implies (backskating +x means facing -x), so no one burns the
    // window on the 180° pivot and no one reaches the boards. The character's
    // speed stat then cancels out of the ratio.
    const run = (overrides: Partial<InputFrame>) => {
      const world = playingWorld();
      const skater = world.skaters[0];
      skater.position = { x: RINK_CONFIG.width / 2, y: RINK_CONFIG.height / 2 };
      skater.facing = overrides.skateBackward === true ? Math.PI : 0;
      // Clear the lane: nobody to bump into and no puck to pick up, so the
      // only thing shaping the run is the movement model.
      for (const other of world.skaters) {
        if (other.id !== skater.id) {
          other.position = { x: 200, y: 200 };
        }
      }
      world.puck.position = { x: 200, y: 1400 };
      for (let tick = 0; tick < 12; tick += 1) {
        stepWorld(world, [inputFrame(skater.id, tick + 1, { moveX: 1, ...overrides })], 100);
      }
      return world;
    };

    const cruise = run({});
    const back = run({ skateBackward: true });
    const turboBack = run({ skateBackward: true, turbo: true });
    const id = cruise.skaters[0].id;

    expect(speedOf(back, id) / speedOf(cruise, id)).toBeCloseTo(
      SKATER_MOVEMENT_CONFIG.backwardSpeedMultiplier,
      2
    );
    // Holding turbo while backskating changes nothing — and because turbo
    // never engaged, the meter is full rather than drained.
    expect(speedOf(turboBack, id)).toBeCloseTo(speedOf(back, id), 6);
    expect(turboBack.skaters[0].turboMeter).toBe(1);
  });

  it("leaves forward skating untouched when the flag is absent", () => {
    const withFlag = playingWorld();
    const without = playingWorld();
    const id = withFlag.skaters[0].id;

    for (let tick = 0; tick < 20; tick += 1) {
      stepWorld(
        withFlag,
        [inputFrame(id, tick + 1, { moveX: 1, moveY: 0.4, skateBackward: false })],
        100
      );
      stepWorld(without, [inputFrame(id, tick + 1, { moveX: 1, moveY: 0.4 })], 100);
    }

    expect(withFlag.skaters[0].position).toEqual(without.skaters[0].position);
    expect(withFlag.skaters[0].facing).toBe(without.skaters[0].facing);
  });

  it("glides on after input is released, decaying gradually", () => {
    const world = playingWorld();
    const skater = world.skaters[0];

    stepWorld(world, [inputFrame(skater.id, 1, { moveX: 1 })], 300);
    const acceleratedSpeed = speedOf(world, skater.id);
    const acceleratedX = skater.position.x;

    stepWorld(world, [], 100);

    expect(skater.position.x).toBeGreaterThan(acceleratedX);
    expect(speedOf(world, skater.id)).toBeGreaterThan(acceleratedSpeed * 0.5);
    expect(speedOf(world, skater.id)).toBeLessThan(acceleratedSpeed);
  });

  it("caps how fast facing can turn toward the stick", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    expect(skater.facing).toBe(0);

    // Full-reverse stick asks for a π turn, which is more than one 100ms step
    // can cover even with the standstill boost — so the cap is what lands.
    stepWorld(world, [inputFrame(skater.id, 1, { moveX: -1 })], 100);

    expect(skater.facing).toBeCloseTo(
      SKATER_MOVEMENT_CONFIG.turnRate *
        SKATER_MOVEMENT_CONFIG.lowSpeedTurnBoost *
        0.1,
      5
    );
    expect(Math.abs(skater.facing)).toBeLessThan(Math.PI);
  });

  it("boosts the standstill pivot but leaves turning at pace alone", () => {
    // The dead beat before thrust engages (alignment must exceed 0) is what
    // made a standing direction change feel slow.
    const standing = playingWorld();
    const stander = standing.skaters[0];
    stepWorld(standing, [inputFrame(stander.id, 1, { moveX: -1 })], 100);

    const rolling = playingWorld();
    const roller = rolling.skaters[0];
    // Comfortably over any stat-scaled max so speedFactor clamps to exactly 1.
    roller.velocity = { x: 700, y: 0 };
    stepWorld(rolling, [inputFrame(roller.id, 1, { moveX: -1 })], 100);

    expect(Math.abs(stander.facing)).toBeGreaterThan(Math.abs(roller.facing));
    // At full speed the boost is fully faded, so the arc is the old one.
    expect(Math.abs(roller.facing)).toBeCloseTo(
      SKATER_MOVEMENT_CONFIG.turnRate *
        SKATER_MOVEMENT_CONFIG.highSpeedTurnRetention *
        0.1,
      5
    );
  });

  it("turns slower at speed than at a standstill", () => {
    const atRest = playingWorld();
    const atSpeed = playingWorld();
    const restSkater = atRest.skaters[0];
    const fastSkater = atSpeed.skaters[0];
    fastSkater.velocity = { x: SKATER_MOVEMENT_CONFIG.maxSpeed, y: 0 };

    stepWorld(atRest, [inputFrame(restSkater.id, 1, { moveY: 1 })], 50);
    stepWorld(atSpeed, [inputFrame(fastSkater.id, 1, { moveY: 1 })], 50);

    expect(Math.abs(fastSkater.facing)).toBeLessThan(
      Math.abs(restSkater.facing) *
        (SKATER_MOVEMENT_CONFIG.highSpeedTurnRetention + 0.1)
    );
  });

  it("bleeds sideways velocity much faster than forward velocity", () => {
    const forward = playingWorld();
    const sideways = playingWorld();
    forward.skaters[0].velocity = { x: 400, y: 0 }; // along facing (0 rad)
    sideways.skaters[0].velocity = { x: 0, y: 400 }; // fully lateral

    stepWorld(forward, [], 200);
    stepWorld(sideways, [], 200);

    const forwardSpeed = speedOf(forward, forward.skaters[0].id);
    const lateralSpeed = speedOf(sideways, sideways.skaters[0].id);

    expect(lateralSpeed).toBeLessThan(forwardSpeed * 0.5);
  });

  it("stops much faster when the stick is pulled against travel", () => {
    const braking = playingWorld();
    const coasting = playingWorld();
    braking.skaters[0].velocity = { x: 500, y: 0 };
    coasting.skaters[0].velocity = { x: 500, y: 0 };

    stepWorld(braking, [inputFrame(braking.skaters[0].id, 1, { moveX: -1 })], 200);
    stepWorld(coasting, [], 200);

    expect(speedOf(braking, braking.skaters[0].id)).toBeLessThan(
      speedOf(coasting, coasting.skaters[0].id) * 0.6
    );
  });

  it("integrates near-identically across different tick slicing", () => {
    const coarse = playingWorld();
    const fine = playingWorld();
    const slotId = coarse.skaters[0].id;

    for (let tick = 0; tick < 30; tick += 1) {
      const move = { moveX: 0.7, moveY: 0.4 };
      stepWorld(coarse, [inputFrame(slotId, tick + 1, move)], 32);
      stepWorld(fine, [inputFrame(slotId, tick * 2 + 1, move)], 16);
      stepWorld(fine, [inputFrame(slotId, tick * 2 + 2, move)], 16);
    }

    const coarseSkater = coarse.skaters[0];
    const fineSkater = fine.skaters[0];
    const positionError = Math.hypot(
      coarseSkater.position.x - fineSkater.position.x,
      coarseSkater.position.y - fineSkater.position.y
    );

    expect(positionError).toBeLessThan(12); // < 1/3 skater radius over ~1s
    expect(speedOf(coarse, slotId)).toBeCloseTo(speedOf(fine, slotId), -1);
  });

  it("rebounds off the boards keeping most tangential speed", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    skater.position = {
      x: RINK_CONFIG.width / 2, // mid-rink: straight wall, not a corner
      y: RINK_CONFIG.height - SKATER_MOVEMENT_CONFIG.radius - 4
    };
    skater.facing = Math.atan2(1, 1);
    skater.velocity = { x: 300, y: 300 };

    stepWorld(world, [], 32);

    expect(skater.position.y).toBeLessThanOrEqual(
      RINK_CONFIG.height - SKATER_MOVEMENT_CONFIG.radius
    );
    expect(skater.velocity.y).toBeLessThanOrEqual(0); // bounced back
    expect(Math.abs(skater.velocity.y)).toBeLessThan(300 * 0.5); // deadened
    expect(skater.velocity.x).toBeGreaterThan(100); // still sliding along
  });

  it("produces deterministic results for repeated input sequences", () => {
    const first = playingWorld();
    const second = playingWorld();
    const inputs = [
      inputFrame("home-skater-1", 1, { moveX: 1, moveY: 0.25 }),
      inputFrame("home-skater-1", 2, { moveX: 0.5, moveY: 1 }),
      inputFrame("home-skater-1", 3)
    ];

    for (const input of inputs) {
      stepWorld(first, [input], 100);
      stepWorld(second, [input], 100);
    }

    expect(second.skaters[0]).toEqual(first.skaters[0]);
    expect(second.time).toEqual(first.time);
  });
});

describe("backskate transition", () => {
  function runTransition(): { entry: number; lowest: number; settled: number } {
    const world = playingWorld();
    const skater = world.skaters[0];
    for (const other of world.skaters) {
      if (other.id !== skater.id) {
        other.position = { x: 100, y: 100 };
      }
    }
    world.puck.position = { x: 2000, y: 1400 };
    // Room to run before the end boards, which would otherwise scrub the
    // speed and make the measurement meaningless.
    skater.position = { x: 300, y: 780 };
    skater.velocity = { x: 0, y: 0 };

    let sequence = 0;
    for (let i = 0; i < 120; i += 1) {
      sequence += 1;
      stepWorld(world, [inputFrame(skater.id, sequence, { moveX: 1 })], 16);
    }
    const entry = Math.hypot(skater.velocity.x, skater.velocity.y);

    let lowest = entry;
    for (let i = 0; i < 60; i += 1) {
      sequence += 1;
      stepWorld(
        world,
        [inputFrame(skater.id, sequence, { moveX: 1, skateBackward: true })],
        16
      );
      lowest = Math.min(lowest, Math.hypot(skater.velocity.x, skater.velocity.y));
    }

    return {
      entry,
      lowest,
      settled: Math.hypot(skater.velocity.x, skater.velocity.y)
    };
  }

  it("settles at the backward speed cap rather than crawling", () => {
    const { entry, settled } = runTransition();

    expect(settled / entry).toBeGreaterThan(0.85);
  });

  it("carries speed THROUGH the pivot instead of scrubbing it off", () => {
    // Two bugs used to gut this: the 180 body reversal read as "stick pulled
    // against travel" and slammed the brakes on, and the edge grip scrubbed
    // the velocity while the body was side-on. Measured dip was 21%.
    const { entry, lowest } = runTransition();

    expect(lowest / entry).toBeGreaterThan(0.7);
  });

  it("still brakes hard when pulling against travel WITHOUT backskating", () => {
    const world = playingWorld();
    const skater = world.skaters[0];
    skater.position = { x: 800, y: 780 };
    skater.velocity = { x: 500, y: 0 };
    skater.facing = 0;

    stepWorld(world, [inputFrame(skater.id, 1, { moveX: -1 })], 100);

    expect(Math.hypot(skater.velocity.x, skater.velocity.y)).toBeLessThan(500);
  });
});
