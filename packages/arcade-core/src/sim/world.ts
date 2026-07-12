import {
  defaultCharacterIdForSlot,
  type CharacterId
} from "../config/characters.js";
import { MATCH_CONFIG, type MatchMode } from "../config/match.js";
import { RINK_CONFIG } from "../config/rink.js";
import { GOALIE_SLOTS, SKATER_SLOTS } from "../config/teams.js";
import { TUNING } from "../config/tuning.js";
import type {
  GoalieEntity,
  InputFrame,
  SkaterEntity,
  Vec2,
  WorldState
} from "./types.js";
import { stepSkater } from "./skater.js";
import { createInitialPuckState, stepPuck } from "./puck.js";
import {
  recoverContactStates,
  resolveChecks,
  resolveDefensiveActions
} from "./actions.js";
import { clearPendingRelease, createGestureState, stepGesture } from "./gestures.js";
import { resolveSkaterCollisions } from "./collision.js";
import { createStickState, updateStick } from "./stick.js";
import { hasActivePowerup, stepPowerups } from "./powerups.js";
import { resolveSpecials } from "./specials.js";
import { createInitialStats } from "./stats.js";
import { resetGoalieOutletState, stepGoalies } from "./goalie.js";
import { stepGoalieOutlet } from "./goalieOutlet.js";
import { resolveGoals } from "./goal.js";
import { goalieSpawn, skaterSpawn, spawnFacing } from "./spawns.js";

function zeroVector(): Vec2 {
  return { x: 0, y: 0 };
}

export function createWorld(
  seed: number,
  mode: MatchMode,
  charactersBySlotId?: Readonly<Record<string, CharacterId>>
): WorldState {
  const skaters: SkaterEntity[] = SKATER_SLOTS.map((slot) => {
    const teamSide = slot.teamId === "home" ? -1 : 1;

    return {
      id: slot.id,
      slot,
      teamId: slot.teamId,
      characterId:
        charactersBySlotId?.[slot.id] ?? defaultCharacterIdForSlot(slot),
      position: skaterSpawn(slot.index, teamSide),
      velocity: zeroVector(),
      facing: spawnFacing(teamSide),
      stick: createStickState(),
      gesture: createGestureState(),
      contactState: "ready",
      contactStateUntilMs: 0,
      checkCooldownUntilMs: 0,
      activeCheckUntilMs: 0,
      activeCheckPower: 0,
      pokeUntilMs: 0,
      pokeCooldownUntilMs: 0,
      diveCooldownUntilMs: 0,
      turboMeter: 1,
      turboCooldownUntilMs: 0,
      oneTimerUntilMs: 0,
      passChargeMs: 0,
      selectedTargetSlotId: null,
      heldPowerupType: null,
      specialCharge: 0,
      specialCooldownUntilMs: 0
    };
  });

  const goalies: GoalieEntity[] = GOALIE_SLOTS.map((slot) => {
    const teamSide = slot.teamId === "home" ? -1 : 1;

    return {
      id: slot.id,
      slot,
      teamId: slot.teamId,
      owner: slot.owner,
      position: goalieSpawn(teamSide),
      velocity: zeroVector(),
      passChargeMs: 0,
      outletAim: { x: slot.teamId === "home" ? 1 : -1, y: 0 },
      possessionStartedAtMs: 0,
      passWasHeld: false
    };
  });

  return {
    seed,
    mode,
    time: {
      nowMs: 0,
      tick: 0,
      fixedTickMs: MATCH_CONFIG.fixedTickMs
    },
    phase: "waiting",
    remainingMs: MATCH_CONFIG.periodMs,
    winnerTeamId: null,
    score: {
      home: 0,
      away: 0
    },
    stats: createInitialStats(skaters.map(({ id }) => id)),
    skaters,
    goalies,
    puck: createInitialPuckState({
      x: RINK_CONFIG.width / 2,
      y: RINK_CONFIG.height / 2
    }),
    powerupPickups: [],
    bananaPeels: [],
    lastPowerupSpawnIndex: -1,
    activePowerups: [],
    eventQueue: []
  };
}

export function stepWorld(
  world: WorldState,
  inputs: readonly InputFrame[],
  dtMs: number
): WorldState {
  if (world.phase !== "playing") {
    return world;
  }

  const latestInputBySlot = latestInputsForSlots(inputs);
  const dtSeconds = dtMs / 1000;

  updateAssistTargets(world, latestInputBySlot);

  for (const skater of world.skaters) {
    const input = latestInputBySlot.get(skater.id);
    // Gestures first (windup slows skating), then the body, then the stick
    // follows from the new pose so the puck step reads a current blade.
    stepGesture(skater, input, world.time.nowMs, dtSeconds, TUNING.gestures);
    stepSkater(
      skater,
      input,
      dtMs,
      TUNING.skater,
      hasActivePowerup(world, skater.id, "speed-boost")
    );
    updateStick(skater, input, dtSeconds, TUNING.stick);
  }

  // Deliberate checks read full closing speed, THEN body contact separates —
  // otherwise the collision impulse bleeds the force out of a big hit.
  resolveDefensiveActions(world, latestInputBySlot, TUNING.check);
  resolveChecks(world, latestInputBySlot, TUNING.check);
  resolveSkaterCollisions(world, TUNING.collision);
  if (TUNING.flags.powerupsEnabled) {
    stepPowerups(world, latestInputBySlot);
  }
  if (TUNING.flags.specialsEnabled) {
    resolveSpecials(world, latestInputBySlot);
  }
  stepPuck(world, latestInputBySlot, dtMs, TUNING.puck);
  const activeGoalie = world.puck.goalieCarrierId
    ? world.goalies.find((goalie) => goalie.id === world.puck.goalieCarrierId)
    : undefined;
  if (activeGoalie) {
    stepGoalieOutlet(
      world,
      activeGoalie,
      latestInputBySlot.get(activeGoalie.id),
      dtMs
    );
  }
  stepGoalies(world, dtMs, TUNING.goalie);
  resolveGoals(world);
  // Goal resolution can perform a faceoff reset after goalie tracking. Clear
  // outlet state here as well so that reset leaves no stale charge or aim.
  for (const goalie of world.goalies) {
    if (world.puck.goalieCarrierId !== goalie.id) {
      resetGoalieOutletState(goalie);
    }
  }
  // A release only fires on the tick it was latched (non-carriers just whiff).
  for (const skater of world.skaters) {
    clearPendingRelease(skater.gesture);
  }
  trimEventQueue(world);

  world.time = {
    ...world.time,
    nowMs: world.time.nowMs + dtMs,
    tick: world.time.tick + 1
  };
  if ((world.phase as WorldState["phase"]) !== "ended") {
    world.remainingMs = Math.max(0, world.remainingMs - dtMs);
    if (world.remainingMs === 0) {
      world.phase = "ended";
      world.winnerTeamId =
        world.score.home === world.score.away
          ? null
          : world.score.home > world.score.away
            ? "home"
            : "away";
    }
  }
  recoverContactStates(world);

  return world;
}

// Events are one-shot cues for VFX/HUD; anything older than this is no longer
// renderable, so drop it. Without a cap the queue grows for the whole match
// (and forever in an endless local free-skate world).
const EVENT_RETENTION_MS = 5000;

function trimEventQueue(world: WorldState): void {
  const cutoff = world.time.nowMs - EVENT_RETENTION_MS;

  if (world.eventQueue.length > 0 && world.eventQueue[0].atMs < cutoff) {
    world.eventQueue = world.eventQueue.filter((event) => event.atMs >= cutoff);
  }
}

function updateAssistTargets(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>
): void {
  for (const skater of world.skaters) {
    const input = inputsBySlot.get(skater.id);
    if (!input?.switchTarget) {
      continue;
    }

    const candidates = world.skaters.filter((candidate) =>
      world.puck.carrierSlotId === skater.id
        ? candidate.teamId === skater.teamId && candidate.id !== skater.id
        : candidate.teamId !== skater.teamId
    );

    if (candidates.length === 0) {
      skater.selectedTargetSlotId = null;
      continue;
    }

    const currentIndex = candidates.findIndex(
      (candidate) => candidate.id === skater.selectedTargetSlotId
    );
    skater.selectedTargetSlotId =
      candidates[(currentIndex + 1) % candidates.length]?.id ?? null;
  }
}

function latestInputsForSlots(
  inputs: readonly InputFrame[]
): ReadonlyMap<string, InputFrame> {
  const latest = new Map<string, InputFrame>();

  for (const input of inputs) {
    const current = latest.get(input.slotId);

    if (!current || input.sequence >= current.sequence) {
      latest.set(input.slotId, input);
    }
  }

  return latest;
}
