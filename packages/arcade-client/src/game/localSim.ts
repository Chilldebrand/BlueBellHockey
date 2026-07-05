import {
  MATCH_CONFIG,
  createBotInputFrame,
  createWorld,
  resolveManualSwitchTarget,
  resolveReceptionSwitch,
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
  /**
   * Practice: kept for API compatibility. Free Skate now always runs a full 3v3
   * of AI teammates and opponents so Madden-style control switching (pass →
   * take over the receiver) can be felt without a server.
   */
  readonly practice?: boolean;
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
   * captured and replayed tick-accurately. The returned frame drives whichever
   * skater is CURRENTLY controlled (see getControlledSlotId) — the caller's
   * baked slotId is overridden each tick so a mid-advance switch takes effect
   * immediately. Every other non-goalie skater is driven by the deterministic
   * bot AI.
   */
  advance(
    elapsedMs: number,
    inputForTick: (tick: number) => InputFrame | null
  ): LocalSimFrame;
  /** Rebuild the world from the seed (also clears the accumulator + control). */
  reset(): void;
  getWorld(): WorldState;
  getTick(): number;
  /** The slot the human is currently controlling (moves on pass/switch). */
  getControlledSlotId(): string;
}

function createFreeSkateWorld(seed: number): WorldState {
  // A full 3v3: the human drives one skater, the AI drives the other five, and
  // both goalies tend net. Control-switching moves the human between teammates.
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
  let controlledSlotId = slotId;
  // Rising-edge latch for the pass-as-switch control (defense / loose pucks).
  let lastHumanPass = false;
  let pendingManualSwitch = false;

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

        const humanFrame = inputForTick(world.time.tick);
        // Drive the currently controlled body, whatever the caller tagged.
        const controlledFrame = humanFrame
          ? { ...humanFrame, slotId: controlledSlotId }
          : null;

        // Latch a fresh pass press (only meaningful as a switch when not
        // carrying; the sim still reads `pass` for charge-and-release passing).
        if (controlledFrame) {
          if (controlledFrame.pass && !lastHumanPass) {
            pendingManualSwitch = true;
          }
          lastHumanPass = controlledFrame.pass;
        } else {
          lastHumanPass = false;
        }

        // Bot AI for every non-controlled, non-goalie skater. Sequence keyed on
        // the tick so replays stay byte-identical.
        const botFrames = world.skaters
          .filter((skater) => skater.id !== controlledSlotId)
          .map((skater) =>
            createBotInputFrame(skater, world, world.time.tick)
          );
        const inputs = controlledFrame
          ? [controlledFrame, ...botFrames]
          : botFrames;

        const prevCarrierSlotId = world.puck.carrierSlotId;
        stepWorld(world, inputs, MATCH_CONFIG.fixedTickMs);

        // Manual switch (consume the latch once), then let a completed pass win.
        if (pendingManualSwitch) {
          pendingManualSwitch = false;
          const manual = resolveManualSwitchTarget(world, controlledSlotId);
          if (manual) {
            controlledSlotId = manual;
          }
        }
        const reception = resolveReceptionSwitch(
          world,
          controlledSlotId,
          prevCarrierSlotId
        );
        if (reception) {
          controlledSlotId = reception;
        }

        world.remainingMs = MATCH_CONFIG.periodMs; // endless session
        accumulatorMs -= MATCH_CONFIG.fixedTickMs;
        ticksAdvanced += 1;
      }

      return { currentWorld: world, previousWorld, ticksAdvanced };
    },
    reset() {
      world = createFreeSkateWorld(seed);
      accumulatorMs = 0;
      controlledSlotId = slotId;
      lastHumanPass = false;
      pendingManualSwitch = false;
    },
    getWorld() {
      return world;
    },
    getTick() {
      return world.time.tick;
    },
    getControlledSlotId() {
      return controlledSlotId;
    }
  };
}

export function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}
