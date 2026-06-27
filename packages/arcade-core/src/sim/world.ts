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
      velocity: zeroVector()
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
    score: {
      home: 0,
      away: 0
    },
    skaters,
    goalies,
    puck: {
      position: {
        x: RINK_CONFIG.width / 2,
        y: RINK_CONFIG.height / 2
      },
      velocity: zeroVector(),
      carrierSlotId: null
    },
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

  for (const skater of world.skaters) {
    stepSkater(skater, latestInputBySlot.get(skater.id), dtMs);
  }

  world.time = {
    ...world.time,
    nowMs: world.time.nowMs + dtMs,
    tick: world.time.tick + 1
  };

  return world;
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
