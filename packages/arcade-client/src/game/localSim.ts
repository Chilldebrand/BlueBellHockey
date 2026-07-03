import {
  MATCH_CONFIG,
  createWorld,
  stepWorld,
  type InputFrame,
  type WorldState
} from "@bbh/arcade-core";

export const FREE_SKATE_SLOT_ID = "home-skater-1";

// Cap how much wall-clock time one advance() call may simulate so a
// backgrounded tab doesn't spiral through thousands of catch-up ticks.
const MAX_FRAME_MS = 250;

export interface LocalSimOptions {
  readonly seed?: number;
  readonly slotId?: string;
}

export interface LocalSimFrame {
  readonly currentWorld: WorldState;
  readonly previousWorld: WorldState | null;
  readonly ticksAdvanced: number;
}

export interface LocalSim {
  readonly slotId: string;
  /**
   * Simulate up to elapsedMs of fixed ticks. inputForTick is called once per
   * tick with the world tick index about to be stepped, so recordings can be
   * captured and replayed tick-accurately.
   */
  advance(
    elapsedMs: number,
    inputForTick: (tick: number) => InputFrame | null
  ): LocalSimFrame;
  /** Rebuild the world from the seed (also clears the accumulator). */
  reset(): void;
  getWorld(): WorldState;
  getTick(): number;
}

function createFreeSkateWorld(seed: number): WorldState {
  const world = createWorld(seed, MATCH_CONFIG.mode);
  world.phase = "playing";
  return world;
}

/**
 * Client-only fixed-step world for the feel lab: no server, no netcode — the
 * shared sim runs locally so physics constants can be tuned live while
 * skating. The clock is topped up each tick so the session never ends.
 */
export function createLocalSim({
  seed = 1,
  slotId = FREE_SKATE_SLOT_ID
}: LocalSimOptions = {}): LocalSim {
  let world = createFreeSkateWorld(seed);
  let accumulatorMs = 0;

  return {
    slotId,
    advance(elapsedMs, inputForTick) {
      accumulatorMs += Math.max(0, Math.min(elapsedMs, MAX_FRAME_MS));

      let previousWorld: WorldState | null = null;
      let ticksAdvanced = 0;

      while (accumulatorMs >= MATCH_CONFIG.fixedTickMs) {
        if (ticksAdvanced === 0) {
          previousWorld = cloneWorld(world);
        }

        const input = inputForTick(world.time.tick);
        stepWorld(world, input ? [input] : [], MATCH_CONFIG.fixedTickMs);
        world.remainingMs = MATCH_CONFIG.periodMs; // endless session
        accumulatorMs -= MATCH_CONFIG.fixedTickMs;
        ticksAdvanced += 1;
      }

      return { currentWorld: world, previousWorld, ticksAdvanced };
    },
    reset() {
      world = createFreeSkateWorld(seed);
      accumulatorMs = 0;
    },
    getWorld() {
      return world;
    },
    getTick() {
      return world.time.tick;
    }
  };
}

export function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}
