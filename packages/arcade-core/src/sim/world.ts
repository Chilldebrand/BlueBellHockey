import { MATCH_CONFIG, type MatchMode } from "../config/match.js";
import { RINK_CONFIG } from "../config/rink.js";
import { GOALIE_SLOTS, SKATER_SLOTS } from "../config/teams.js";
import type {
  GoalieEntity,
  InputFrame,
  SkaterEntity,
  Vec2,
  WorldState
} from "./types.js";
import { stepSkater } from "./skater.js";
import { createInitialPuckState, stepPuck } from "./puck.js";
import { recoverContactStates, resolveChecks } from "./actions.js";
import { stepPowerups } from "./powerups.js";
import { resolveSpecials } from "./specials.js";
import { createInitialStats } from "./stats.js";
import { stepGoalies } from "./goalie.js";
import { resolveGoals } from "./goal.js";

function zeroVector(): Vec2 {
  return { x: 0, y: 0 };
}

function skaterSpawn(index: number, teamSide: -1 | 1): Vec2 {
  return {
    x: RINK_CONFIG.width / 2 + teamSide * 260,
    y: RINK_CONFIG.height / 2 + (index - 1) * 140
  };
}

function goalieSpawn(teamSide: -1 | 1): Vec2 {
  return {
    x: teamSide === -1 ? RINK_CONFIG.goalLineOffset : RINK_CONFIG.width - RINK_CONFIG.goalLineOffset,
    y: RINK_CONFIG.height / 2
  };
}

export function createWorld(seed: number, mode: MatchMode): WorldState {
  const skaters: SkaterEntity[] = SKATER_SLOTS.map((slot) => {
    const teamSide = slot.teamId === "home" ? -1 : 1;

    return {
      id: slot.id,
      slot,
      teamId: slot.teamId,
      position: skaterSpawn(slot.index, teamSide),
      velocity: zeroVector(),
      contactState: "ready",
      contactStateUntilMs: 0,
      checkCooldownUntilMs: 0,
      activeCheckUntilMs: 0,
      turboMeter: 1,
      turboCooldownUntilMs: 0,
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
      velocity: zeroVector()
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
    stats: createInitialStats(),
    skaters,
    goalies,
    puck: createInitialPuckState({
      x: RINK_CONFIG.width / 2,
      y: RINK_CONFIG.height / 2
    }),
    powerupPickups: [],
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

  updateAssistTargets(world, latestInputBySlot);

  for (const skater of world.skaters) {
    stepSkater(skater, latestInputBySlot.get(skater.id), dtMs);
  }

  resolveChecks(world, latestInputBySlot);
  stepPowerups(world, latestInputBySlot);
  resolveSpecials(world, latestInputBySlot);
  stepPuck(world, latestInputBySlot, dtMs);
  stepGoalies(world, dtMs);
  resolveGoals(world);

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
