import { describe, expect, it } from "vitest";
import {
  MATCH_CONFIG,
  SKATER_SLOTS,
  createWorld,
  stepWorld,
  type InputFrame,
  type WorldState
} from "../index";

const SCRIPT_TICKS = 600;

/**
 * Deterministic pseudo-random input script: varied movement, aim, and action
 * presses for every skater slot across SCRIPT_TICKS ticks. Pure function of the
 * tick index, so both worlds receive byte-identical inputs.
 */
function scriptedInputs(tick: number): InputFrame[] {
  return SKATER_SLOTS.map((slot, slotIndex) => {
    const phase = tick * 0.13 + slotIndex * 1.7;

    return {
      playerId: `script-${slot.id}`,
      slotId: slot.id,
      sequence: tick,
      moveX: Math.sin(phase),
      moveY: Math.cos(phase * 0.8),
      aimX: Math.cos(phase * 1.3),
      aimY: Math.sin(phase * 0.6),
      pass: (tick + slotIndex) % 47 === 0,
      shoot: (tick + slotIndex) % 61 === 0,
      check: (tick + slotIndex) % 53 === 0,
      turbo: Math.floor(tick / 40 + slotIndex) % 3 === 0,
      switchTarget: (tick + slotIndex) % 97 === 0,
      usePowerup: (tick + slotIndex) % 71 === 0,
      special: (tick + slotIndex) % 83 === 0
    };
  });
}

function runScriptedMatch(seed: number): WorldState {
  const world = createWorld(seed, "arcade3v3");
  world.phase = "playing";

  for (let tick = 0; tick < SCRIPT_TICKS; tick += 1) {
    stepWorld(world, scriptedInputs(tick), MATCH_CONFIG.fixedTickMs);
  }

  return world;
}

describe("simulation determinism", () => {
  it("produces an identical world from the same seed and input script", () => {
    const first = runScriptedMatch(20260703);
    const second = runScriptedMatch(20260703);

    expect(second).toEqual(first);
    // toEqual treats undefined and missing keys as equal; the serialized form
    // is the contract that ships over the network, so pin it byte-for-byte.
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("keeps the event queue bounded during long play", () => {
    const world = runScriptedMatch(7);

    for (const event of world.eventQueue) {
      expect(world.time.nowMs - event.atMs).toBeLessThanOrEqual(5000);
    }
  });
});
