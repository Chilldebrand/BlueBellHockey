import {
  MATCH_CONFIG,
  RINK_CONFIG,
  SKATER_SLOTS,
  createGestureState,
  createWorld,
  resetForFaceoff,
  stepWorld,
  type CharacterId,
  type InputFrame,
  type WorldState
} from "@bbh/arcade-core";
import { cloneWorld } from "./localSim.js";

export const SHOOTOUT_SLOT_ID = "home-skater-1";
export const SHOOTOUT_ATTEMPTS = 5;
/** Once a shot is live it must resolve; this window covers wide misses. */
export const SHOT_RESOLVE_MS = 2500;
/** A deke gone loose gets this long to be regathered before it's a miss. */
export const LOOSE_RESOLVE_MS = 2500;
/** Pause between a result landing and the respawn, so the banner reads. */
export const RESULT_HOLD_MS = 1500;

const SHOOTOUT_SEED = 20260724;
const MAX_FRAME_MS = 250;
/** A shot puck moving slower than this on the ice is dead — attempt over. */
const PUCK_REST_SPEED = 20;

export type ShootoutAttemptResult = "goal" | "miss";

export type ShootoutPhase =
  | "approach"
  | "loose"
  | "shotLive"
  | "resolved"
  | "complete";

export interface ShootoutState {
  readonly attemptIndex: number;
  readonly phase: ShootoutPhase;
  /** Sim time the current phase was entered. */
  readonly phaseSinceMs: number;
  readonly results: readonly ShootoutAttemptResult[];
  /** Home score baseline; a goal is detected as a delta against this. */
  readonly lastHomeScore: number;
  /** The result being held on screen while phase === "resolved". */
  readonly lastResult: ShootoutAttemptResult | null;
}

export function createInitialShootoutState(): ShootoutState {
  return {
    attemptIndex: 0,
    phase: "approach",
    phaseSinceMs: 0,
    results: [],
    lastHomeScore: 0,
    lastResult: null
  };
}

function enterResolved(
  state: ShootoutState,
  world: WorldState,
  result: ShootoutAttemptResult
): ShootoutState {
  return {
    ...state,
    phase: "resolved",
    phaseSinceMs: world.time.nowMs,
    lastResult: result
  };
}

/**
 * One-shot shootout rules, evaluated once per tick AFTER stepWorld.
 * preStepNowMs is world.time.nowMs captured BEFORE the step: events pushed
 * during that step carry exactly that timestamp, so "new this tick" needs no
 * cursor and survives event-queue trimming.
 *
 * Pure with respect to the world (never mutates it) — the sim wrapper watches
 * for the resolved→approach commit and runs respawnForAttempt itself.
 */
export function stepShootoutTransition(
  world: WorldState,
  state: ShootoutState,
  preStepNowMs: number
): ShootoutState {
  if (state.phase === "complete") {
    return state;
  }

  const nowMs = world.time.nowMs;
  const newEvents = world.eventQueue.filter(
    (event) => event.atMs === preStepNowMs
  );
  const scored = world.score.home > state.lastHomeScore;
  const saved = newEvents.some((event) => event.type === "save");
  const hitPost = newEvents.some((event) => event.type === "post");
  const shotLive = world.puck.shotBySlotId === SHOOTOUT_SLOT_ID;
  const playerCarries = world.puck.carrierSlotId === SHOOTOUT_SLOT_ID;

  switch (state.phase) {
    case "approach": {
      if (scored) {
        return enterResolved(state, world, "goal");
      }
      if (shotLive || newEvents.some((event) => event.type === "shot")) {
        // The shot can resolve the very tick it's released (point-blank
        // save / post) — check the terminal outcomes immediately.
        if (saved || hitPost) {
          return enterResolved(state, world, "miss");
        }
        return { ...state, phase: "shotLive", phaseSinceMs: nowMs };
      }
      if (!playerCarries && world.puck.carrierSlotId !== SHOOTOUT_SLOT_ID) {
        // Lost the handle deking (or threw a pass with nobody to catch it).
        // Not an instant miss — dekes must survive — but the clock starts.
        if (world.puck.carrierSlotId === null && !playerCarries) {
          return { ...state, phase: "loose", phaseSinceMs: nowMs };
        }
      }
      return state;
    }
    case "loose": {
      if (scored) {
        return enterResolved(state, world, "goal");
      }
      if (saved) {
        return enterResolved(state, world, "miss");
      }
      if (shotLive) {
        return { ...state, phase: "shotLive", phaseSinceMs: nowMs };
      }
      if (playerCarries) {
        return { ...state, phase: "approach", phaseSinceMs: nowMs };
      }
      if (nowMs - state.phaseSinceMs >= LOOSE_RESOLVE_MS) {
        return enterResolved(state, world, "miss");
      }
      return state;
    }
    case "shotLive": {
      if (scored) {
        return enterResolved(state, world, "goal");
      }
      if (saved || hitPost) {
        return enterResolved(state, world, "miss");
      }
      if (playerCarries) {
        // The rebound came back to the shooter's stick: one shot only.
        return enterResolved(state, world, "miss");
      }
      const speed = Math.hypot(world.puck.velocity.x, world.puck.velocity.y);
      if (world.puck.height === 0 && speed < PUCK_REST_SPEED) {
        return enterResolved(state, world, "miss");
      }
      if (nowMs - state.phaseSinceMs >= SHOT_RESOLVE_MS) {
        return enterResolved(state, world, "miss");
      }
      return state;
    }
    case "resolved": {
      if (nowMs - state.phaseSinceMs < RESULT_HOLD_MS) {
        return state;
      }
      const results = [...state.results, state.lastResult ?? "miss"];
      const attemptIndex = state.attemptIndex + 1;
      // Sync the score baseline at commit so anything the player did during
      // the hold (e.g. banked the loose faceoff puck) can't count twice.
      const lastHomeScore = world.score.home;
      if (attemptIndex >= SHOOTOUT_ATTEMPTS) {
        return {
          ...state,
          results,
          attemptIndex,
          lastHomeScore,
          phase: "complete",
          phaseSinceMs: nowMs
        };
      }
      return {
        ...state,
        results,
        attemptIndex,
        lastHomeScore,
        phase: "approach",
        phaseSinceMs: nowMs
      };
    }
    default:
      return state;
  }
}

/**
 * Park the shooter at center ice with the puck on their blade and the goalie
 * back in the crease. Leans on the core faceoff reset for the full puck-field
 * wipe (goalieCarrierId, shot identity, pickup lockouts, ...) then overrides
 * the placement the shootout wants.
 */
export function respawnForAttempt(world: WorldState): void {
  resetForFaceoff(world);

  const player = world.skaters.find((skater) => skater.id === SHOOTOUT_SLOT_ID);
  if (player) {
    player.position = {
      x: RINK_CONFIG.width / 2,
      y: RINK_CONFIG.height / 2
    };
    player.velocity = { x: 0, y: 0 };
    player.facing = 0; // home attacks +x
    player.gesture = createGestureState();
    player.contactState = "ready";
    player.contactStateUntilMs = 0;
    player.turboMeter = 1;
    player.passChargeMs = 0;

    world.puck.position = { ...player.position };
    world.puck.carrierSlotId = SHOOTOUT_SLOT_ID;
    world.puck.lastTouchSlotId = SHOOTOUT_SLOT_ID;
  }

  world.faceoffUntilMs = 0;
}

export interface ShootoutSimOptions {
  readonly seed?: number;
  readonly characterId: CharacterId;
}

export interface ShootoutSimFrame {
  readonly currentWorld: WorldState;
  readonly previousWorld: WorldState | null;
  readonly ticksAdvanced: number;
}

export interface ShootoutSim {
  advance(
    elapsedMs: number,
    inputForTick: (tick: number) => InputFrame | null
  ): ShootoutSimFrame;
  /** Fresh five attempts (Retry). */
  reset(): void;
  getWorld(): WorldState;
  getState(): ShootoutState;
  /** Always the shooter — no bots, no control switching, no goalie grants. */
  getControlledEntityId(): string;
}

function createShootoutWorld(seed: number, characterId: CharacterId): WorldState {
  const world = createWorld(
    seed,
    MATCH_CONFIG.mode,
    { [SHOOTOUT_SLOT_ID]: characterId },
    undefined,
    {
      skaterSlots: SKATER_SLOTS.filter((slot) => slot.id === SHOOTOUT_SLOT_ID)
    }
  );
  world.phase = "playing";
  respawnForAttempt(world);
  return world;
}

/**
 * Client-only shootout: one human shooter vs the standard AI goalies, five
 * one-shot attempts, respawn at center between attempts. Mirrors the Free
 * Skate localSim shape (fixed-step accumulator, endless clock) minus every
 * team feature: no bot frames, no control switching, no goalie-outlet grant.
 */
export function createShootoutSim({
  seed = SHOOTOUT_SEED,
  characterId
}: ShootoutSimOptions): ShootoutSim {
  let world = createShootoutWorld(seed, characterId);
  let state = createInitialShootoutState();
  let accumulatorMs = 0;

  return {
    advance(elapsedMs, inputForTick) {
      // Nothing left to play: freeze the world under the results overlay.
      if (state.phase === "complete") {
        return { currentWorld: world, previousWorld: null, ticksAdvanced: 0 };
      }

      accumulatorMs += Math.max(0, Math.min(elapsedMs, MAX_FRAME_MS));

      let previousWorld: WorldState | null = null;
      let ticksAdvanced = 0;

      while (accumulatorMs >= MATCH_CONFIG.fixedTickMs) {
        if (ticksAdvanced === 0) {
          previousWorld = cloneWorld(world);
        }

        const preStepNowMs = world.time.nowMs;
        const humanFrame = inputForTick(world.time.tick);
        const inputs = humanFrame
          ? [{ ...humanFrame, slotId: SHOOTOUT_SLOT_ID }]
          : [];

        stepWorld(world, inputs, MATCH_CONFIG.fixedTickMs);

        const previousState = state;
        state = stepShootoutTransition(world, state, preStepNowMs);
        if (
          previousState.phase === "resolved" &&
          state.phase === "approach"
        ) {
          respawnForAttempt(world);
        }

        // Shootout hygiene, applied every tick like localSim's endless-clock
        // trick: the session never expires, faceoff holds never freeze play,
        // and no powerups/bananas litter the runway.
        world.remainingMs = MATCH_CONFIG.periodMs;
        world.faceoffUntilMs = 0;
        world.powerupPickups = [];
        world.bananaPeels = [];
        world.activePowerups = [];

        accumulatorMs -= MATCH_CONFIG.fixedTickMs;
        ticksAdvanced += 1;

        if (state.phase === "complete") {
          break;
        }
      }

      return { currentWorld: world, previousWorld, ticksAdvanced };
    },
    reset() {
      world = createShootoutWorld(seed, characterId);
      state = createInitialShootoutState();
      accumulatorMs = 0;
    },
    getWorld() {
      return world;
    },
    getState() {
      return state;
    },
    getControlledEntityId() {
      return SHOOTOUT_SLOT_ID;
    }
  };
}
