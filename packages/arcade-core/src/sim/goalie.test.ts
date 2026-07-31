import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GIANT_GOALIE_SIZE,
  GOALIE_CONFIG,
  MINI_GOALIE_SIZE,
  PUCK_CONFIG,
  RINK_CONFIG,
  bladeWorldPosition,
  createWorld,
  dekeBiteFactor,
  goalLineX,
  goalieHoldPosition,
  goalieSizeMultiplier,
  saveMissChance,
  saveMissRoll,
  stepWorld,
  TUNING,
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
    // Continuous-collision test: the subject is whether the sweep catches the
    // puck at all, not whether he then muffs it, so take the roll out.
    TUNING.goalie.missChanceCap = 0;
    TUNING.goalie.missChanceFloor = 0;
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

    TUNING.goalie.missChanceCap = GOALIE_CONFIG.missChanceCap;
    TUNING.goalie.missChanceFloor = GOALIE_CONFIG.missChanceFloor;
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

describe("goalie momentum", () => {
  it("cannot hit top speed from a cold start in one tick", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    // Puck right at his plane, far to one side: the lateral target is far
    // but his velocity may only grow by lateralAccel per second.
    world.puck.position = {
      x: goalie.position.x + 10,
      y: goalie.position.y + 200
    };

    stepWorld(world, [], 16);

    const maxStep = GOALIE_CONFIG.lateralAccel * 0.016;
    expect(homeGoalieOf(world).velocity.y).toBeGreaterThan(0);
    expect(homeGoalieOf(world).velocity.y).toBeLessThanOrEqual(maxStep + 1e-6);
  });

  it("keeps sliding the wrong way briefly when the puck reverses (deke window)", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    // Mid-slide toward +y at full speed when the puck is suddenly on the
    // other side: he must brake through his momentum before reversing.
    goalie.velocity = { x: 0, y: GOALIE_CONFIG.lateralSpeed };
    world.puck.position = {
      x: goalie.position.x + 10,
      y: goalie.position.y - 200
    };
    const startY = goalie.position.y;

    stepWorld(world, [], 16);

    expect(homeGoalieOf(world).position.y).toBeGreaterThan(startY);
    expect(homeGoalieOf(world).velocity.y).toBeGreaterThan(
      GOALIE_CONFIG.lateralSpeed - GOALIE_CONFIG.lateralAccel * 0.016 - 1e-6
    );
  });
});

describe("goalie deke bite", () => {
  /**
   * Park an away carrier square in front of the home net with everyone else
   * chased far up ice, so what happens next is purely deker vs goalie.
   */
  function dekeSetup(world: WorldState, carrierX: number) {
    const shooter = world.skaters.find((s) => s.id === "away-skater-1")!;
    shooter.position = { x: carrierX, y: RINK_CONFIG.height / 2 };
    shooter.facing = Math.PI;
    world.puck.carrierSlotId = shooter.id;
    world.puck.position = { ...bladeWorldPosition(shooter) };
    for (const skater of world.skaters) {
      if (skater.id !== shooter.id) {
        skater.position = { x: 2200, y: skater.position.y };
      }
    }
    return shooter;
  }

  /**
   * One attempt on the home goalie from `carrierX`.
   *
   * `deke` walks the puck hard to one side, holds it there `dangleTicks`, then
   * snaps it back and shoots the side he vacated. `slow` eases the puck to that
   * SAME final spot and shoots the SAME corner, just gently enough for any
   * goalie to stay with it — so the pair isolates "beaten by the move" from
   * "the shot simply came from somewhere else".
   */
  function attempt(options: {
    readonly carrierX: number;
    readonly dangleTicks?: number;
    readonly slow?: boolean;
  }): WorldState {
    const world = playingWorld();
    const shooter = dekeSetup(world, options.carrierX);
    let sequence = 0;
    const step = (overrides: Partial<InputFrame>) => {
      sequence += 1;
      stepWorld(world, [inputFrame(shooter.id, sequence, overrides)], 16);
    };

    for (let i = 0; i < 20; i += 1) step({ stickX: 0 });
    if (options.slow) {
      for (let i = 0; i < 40; i += 1) step({ stickX: (0.5 * (i + 1)) / 40 });
      for (let i = 0; i < 25; i += 1) step({ stickX: 0.5 });
    } else {
      for (let i = 0; i < (options.dangleTicks ?? 18); i += 1) step({ stickX: -1 });
      for (let i = 0; i < 4; i += 1) step({ stickX: 0.5 });
    }

    shooter.gesture.pendingReleaseType = "wrist";
    shooter.gesture.pendingReleasePower = 0.9;
    step({ stickX: 0.5, moveY: -1 });
    for (let i = 0; i < 45; i += 1) stepWorld(world, [], 16);

    return world;
  }

  it("only bites for an attacking carrier in tight", () => {
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    const shooter = dekeSetup(world, 320);

    // Carried by an attacker at the goal mouth → full bite.
    world.puck.position = { x: goalLineX("home"), y: RINK_CONFIG.height / 2 };
    expect(dekeBiteFactor(world, goalie)).toBeCloseTo(1, 6);

    // Ramped down with depth, and gone at the zone edge.
    world.puck.position = {
      x: goalLineX("home") + GOALIE_CONFIG.biteZoneDepth / 2,
      y: RINK_CONFIG.height / 2
    };
    expect(dekeBiteFactor(world, goalie)).toBeCloseTo(0.5, 6);
    world.puck.position = {
      x: goalLineX("home") + GOALIE_CONFIG.biteZoneDepth + 10,
      y: RINK_CONFIG.height / 2
    };
    expect(dekeBiteFactor(world, goalie)).toBe(0);

    // A loose puck in tight is a scramble, not a deke: no bite.
    world.puck.position = { x: goalLineX("home"), y: RINK_CONFIG.height / 2 };
    world.puck.carrierSlotId = null;
    expect(dekeBiteFactor(world, goalie)).toBe(0);

    // Nor does his own defenceman cycling in tight pull him off his angle.
    const defender = world.skaters.find((s) => s.teamId === "home")!;
    defender.position = { ...shooter.position };
    world.puck.carrierSlotId = defender.id;
    expect(dekeBiteFactor(world, goalie)).toBe(0);
  });

  it("gets deked out in front of the net, but stays with the same shot moved slowly", () => {
    // Identical shot, identical spot: only the speed of the move differs.
    expect(attempt({ carrierX: 380, dangleTicks: 18 }).score.away).toBe(1);
    expect(attempt({ carrierX: 380, slow: true }).score.away).toBe(0);
  });

  it("cannot be deked from out at the top of the zone", () => {
    // Same move from beyond the bite zone: he plays the angle and stops it.
    expect(attempt({ carrierX: 520, dangleTicks: 18 }).score.away).toBe(0);
    expect(attempt({ carrierX: 520, dangleTicks: 32 }).score.away).toBe(0);
  });

  it("squares back up on a puck parked out to one side", () => {
    // The bite reads MOVEMENT, so holding the puck wide is not a free goal:
    // once it stops moving he settles right back onto the angle line, which is
    // the whole reason there is no stand-still position that beats him.
    const world = playingWorld();
    const shooter = dekeSetup(world, 380);
    for (let tick = 1; tick <= 80; tick += 1) {
      stepWorld(world, [inputFrame(shooter.id, tick, { stickX: -1 })], 16);
    }

    const goalie = homeGoalieOf(world);
    const netCenter = { x: goalLineX("home"), y: RINK_CONFIG.height / 2 };
    const span = netCenter.x - world.puck.position.x;
    const angleY =
      world.puck.position.y +
      (netCenter.y - world.puck.position.y) *
        ((goalie.position.x - world.puck.position.x) / span);

    expect(goalie.position.y).toBeCloseTo(angleY, 0);
  });

  it("leaves tracking outside the bite zone exactly as it was", () => {
    const world = playingWorld();
    const shooter = dekeSetup(world, 900);
    const baseline = homeGoalieOf(world).position.y;

    for (let tick = 1; tick <= 20; tick += 1) {
      stepWorld(world, [inputFrame(shooter.id, tick, { stickX: -1 })], 16);
    }

    // From out here the goalie plays the pure angle: a full stick dangle moves
    // him barely at all, and never at lunge acceleration.
    expect(dekeBiteFactor(world, homeGoalieOf(world))).toBe(0);
    expect(Math.abs(homeGoalieOf(world).position.y - baseline)).toBeLessThan(40);
  });
});

describe("goalie miss chance", () => {
  it("scales from the floor on easy saves to the cap on edge rockets", () => {
    const floor = saveMissChance(0, GOALIE_CONFIG.saveReach, 0);
    const cap = saveMissChance(
      GOALIE_CONFIG.saveReach,
      GOALIE_CONFIG.saveReach,
      PUCK_CONFIG.maxChargedShotSpeed
    );

    expect(floor).toBeCloseTo(GOALIE_CONFIG.missChanceFloor, 6);
    expect(cap).toBeCloseTo(GOALIE_CONFIG.missChanceCap, 6);
    // Monotonic in both axes.
    expect(saveMissChance(60, 84, 900)).toBeGreaterThan(saveMissChance(20, 84, 900));
    expect(saveMissChance(60, 84, 1800)).toBeGreaterThan(saveMissChance(60, 84, 900));
  });

  it("rolls deterministically per shot and varies between shots", () => {
    expect(saveMissRoll(1, 512, "home-skater-1")).toBe(
      saveMissRoll(1, 512, "home-skater-1")
    );

    const rolls = Array.from({ length: 200 }, (_, i) =>
      saveMissRoll(1, i * 16, "home-skater-1")
    );
    for (const roll of rolls) {
      expect(roll).toBeGreaterThanOrEqual(0);
      expect(roll).toBeLessThan(1);
    }
    // Spread sanity: a meaningful share lands under a 15% cap.
    const under = rolls.filter((roll) => roll < 0.15).length;
    expect(under).toBeGreaterThan(10);
    expect(under).toBeLessThan(80);
  });

  it("lets a hard edge shot beat the goalie when its roll comes up short", () => {
    // Deterministically pick a shot identity whose roll loses to an
    // edge-rocket's miss chance, then fire exactly that shot.
    const lateral = 80;
    const speed = 1900;
    const chance = saveMissChance(lateral, GOALIE_CONFIG.saveReach, speed);
    let beatenAtMs = -1;
    for (let atMs = 16; atMs < 20_000; atMs += 16) {
      if (saveMissRoll(1, atMs, "away-skater-1") < chance) {
        beatenAtMs = atMs;
        break;
      }
    }
    expect(beatenAtMs).toBeGreaterThan(0);

    const world = playingWorld();
    shotAtHomeGoalie(world, { speed, lateral });
    world.puck.shotAtMs = beatenAtMs;

    for (let tick = 0; tick < 6; tick += 1) {
      stepWorld(world, [], 16);
    }

    expect(world.stats.saves.home).toBe(0);
    expect(world.score.away).toBe(1);
  });

  it("never fumbles a friendly puck drifting toward its own net", () => {
    // Same losing roll, but the puck came off a teammate: must still stop.
    const world = playingWorld();
    const goalie = homeGoalieOf(world);
    world.puck.position = { x: goalie.position.x + 24, y: goalie.position.y + 80 };
    world.puck.velocity = { x: -1900, y: 0 };
    world.puck.lastTouchSlotId = "home-skater-1";
    world.puck.shotBySlotId = null;
    world.puck.shotAtMs = 0;

    stepWorld(world, [], 16);

    expect(world.score.away).toBe(0);
    expect(world.puck.velocity.x).toBeGreaterThan(0);
  });
});

/**
 * Pins the per-shot miss roll out of the way for tests whose subject is REACH
 * or collision geometry. Without it, a change to missChanceCap silently flips
 * fixtures that were only ever meant to measure whether the goalie could get
 * to the puck at all.
 */
function withoutMissRoll(): void {
  beforeEach(() => {
    TUNING.goalie.missChanceCap = 0;
    TUNING.goalie.missChanceFloor = 0;
  });
  afterEach(() => {
    TUNING.goalie.missChanceCap = GOALIE_CONFIG.missChanceCap;
    TUNING.goalie.missChanceFloor = GOALIE_CONFIG.missChanceFloor;
  });
}

describe("goalie-resize powerups", () => {
  withoutMissRoll();

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
