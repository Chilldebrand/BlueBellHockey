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
  _inputs: readonly InputFrame[],
  dtMs: number
): WorldState {
  if (world.phase !== "playing") {
    return world;
  }

  world.time = {
    ...world.time,
    nowMs: world.time.nowMs + dtMs,
    tick: world.time.tick + 1
  };

  return world;
}
