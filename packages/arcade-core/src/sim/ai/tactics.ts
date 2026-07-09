import type { TeamId } from "../../config/teams.js";
import { RINK_CONFIG, goalLineX } from "../../config/rink.js";
import { TUNING } from "../../config/tuning.js";
import type { SkaterEntity, Vec2, WorldState } from "../types.js";

export type TacticalState =
  | "attack"
  | "defend"
  | "transition"
  | "loose-puck"
  | "reset";

/** Deterministic, read-only team view used by later AI intent selection. */
export interface TacticalContext {
  readonly teamId: TeamId;
  readonly state: TacticalState;
  readonly carrierId: string | null;
  readonly threatId: string | null;
  readonly puckPosition: Vec2;
  readonly pressureBySlotId: ReadonlyMap<string, number>;
  readonly openLaneScores: ReadonlyMap<string, number>;
  readonly teammateSeparationBySlotId: ReadonlyMap<string, number>;
  readonly hasNumbersAdvantage: boolean;
}

export function buildTacticalContext(
  world: WorldState,
  teamId: TeamId
): TacticalContext {
  const teammates = teamSkaters(world, teamId);
  const opponents = teamSkaters(world, otherTeam(teamId));
  const carrier = world.puck.carrierSlotId
    ? world.skaters.find((skater) => skater.id === world.puck.carrierSlotId) ?? null
    : null;
  const recentPossessionTeamId = recentPossessionTeam(world);
  const defensiveThreats = rankDefensiveThreats(world, teamId);
  const state = tacticalState({
    teamId,
    teammates,
    opponents,
    carrier,
    recentPossessionTeamId,
    puckPosition: world.puck.position
  });

  return {
    teamId,
    state,
    carrierId: carrier?.id ?? null,
    threatId:
      carrier?.teamId === teamId ? null : defensiveThreats[0]?.id ?? null,
    puckPosition: { ...world.puck.position },
    pressureBySlotId: pressureBySlotId(teammates, opponents),
    openLaneScores: openLaneScores(teammates, opponents, world.puck.position),
    teammateSeparationBySlotId: teammateSeparationBySlotId(teammates),
    hasNumbersAdvantage: hasNumbersAdvantage(
      teammates,
      opponents,
      world.puck.position
    )
  };
}

/** Most dangerous opponents first, with slot danger outranking a wide carrier. */
export function rankDefensiveThreats(
  world: WorldState,
  defendingTeamId: TeamId
): SkaterEntity[] {
  const ownGoal = { x: goalLineX(defendingTeamId), y: RINK_CONFIG.height / 2 };
  const maxGoalDistance = Math.hypot(RINK_CONFIG.width, RINK_CONFIG.height);

  return world.skaters
    .filter((skater) => skater.teamId !== defendingTeamId)
    .sort((left, right) => {
      const scoreDifference =
        defensiveThreatScore(right, world, ownGoal, maxGoalDistance) -
        defensiveThreatScore(left, world, ownGoal, maxGoalDistance);
      return scoreDifference === 0 ? compareIds(left.id, right.id) : scoreDifference;
    });
}

/** Context state is already precedence-resolved during snapshot derivation. */
export function selectTacticalState(context: TacticalContext): TacticalState {
  return context.state;
}

function tacticalState(options: {
  readonly teamId: TeamId;
  readonly teammates: readonly SkaterEntity[];
  readonly opponents: readonly SkaterEntity[];
  readonly carrier: SkaterEntity | null;
  readonly recentPossessionTeamId: TeamId | null;
  readonly puckPosition: Vec2;
}): TacticalState {
  const {
    teamId,
    teammates,
    opponents,
    carrier,
    recentPossessionTeamId,
    puckPosition
  } = options;

  if (carrier) {
    return carrier.teamId === teamId ? "attack" : "defend";
  }

  if (recentPossessionTeamId === teamId) {
    return "transition";
  }

  if (teammates.length === 0 || opponents.length === 0) {
    return "reset";
  }

  const nearestTeammate = nearestTo(teammates, puckPosition);
  const nearestOpponent = nearestTo(opponents, puckPosition);

  if (!nearestTeammate || !nearestOpponent) {
    return "reset";
  }

  const teammateDistance = distance(nearestTeammate.position, puckPosition);
  const opponentDistance = distance(nearestOpponent.position, puckPosition);

  if (
    teammateDistance <=
    opponentDistance + TUNING.ai.loosePuckContestMargin
  ) {
    return "loose-puck";
  }

  return "defend";
}

function recentPossessionTeam(world: WorldState): TeamId | null {
  const { nowMs } = world.time;
  const { reactionDelayMs, transitionWindowMs } = TUNING.ai;
  const elapsedSincePass = nowMs - world.puck.passedAtMs;

  if (
    world.puck.passedFromSlotId &&
    world.puck.passedAtMs > 0 &&
    elapsedSincePass >= reactionDelayMs &&
    elapsedSincePass <= transitionWindowMs
  ) {
    return skaterById(world, world.puck.passedFromSlotId)?.teamId ?? null;
  }

  const possessionEvent = [...world.eventQueue]
    .filter((event) => {
      const elapsed = nowMs - event.atMs;
      return (
        event.sourceSlotId !== undefined &&
        elapsed >= reactionDelayMs &&
        elapsed <= transitionWindowMs &&
        (event.type === "poke" || event.type === "hit" || event.type === "block")
      );
    })
    .sort((left, right) => right.atMs - left.atMs || compareIds(left.id, right.id))[0];

  return possessionEvent?.sourceSlotId
    ? skaterById(world, possessionEvent.sourceSlotId)?.teamId ?? null
    : null;
}

function defensiveThreatScore(
  skater: SkaterEntity,
  world: WorldState,
  ownGoal: Vec2,
  maxGoalDistance: number
): number {
  const goalDanger = 1 - Math.min(1, distance(skater.position, ownGoal) / maxGoalDistance);
  const slotDanger = Math.max(
    0,
    1 - Math.abs(skater.position.y - RINK_CONFIG.height / 2) / (RINK_CONFIG.height / 2)
  );
  const puckAccess = Math.max(
    0,
    1 - distance(skater.position, world.puck.position) / TUNING.ai.awarenessRange
  );
  const carrierBonus = world.puck.carrierSlotId === skater.id ? 0.7 : 0;

  return goalDanger * 1.4 + slotDanger * 1.35 + puckAccess * 0.8 + carrierBonus;
}

function pressureBySlotId(
  teammates: readonly SkaterEntity[],
  opponents: readonly SkaterEntity[]
): ReadonlyMap<string, number> {
  return new Map(
    teammates.map((teammate) => {
      const nearest = nearestTo(opponents, teammate.position);
      const nearestDistance = nearest
        ? distance(teammate.position, nearest.position)
        : Number.POSITIVE_INFINITY;
      const pressure = Math.max(
        0,
        1 - nearestDistance / TUNING.ai.pressureRange
      );
      return [teammate.id, pressure] as const;
    })
  );
}

function openLaneScores(
  teammates: readonly SkaterEntity[],
  opponents: readonly SkaterEntity[],
  puckPosition: Vec2
): ReadonlyMap<string, number> {
  return new Map(
    teammates.map((teammate) => {
      const nearestBlockDistance = opponents.reduce(
        (nearest, opponent) =>
          Math.min(
            nearest,
            distanceToSegment(opponent.position, puckPosition, teammate.position)
          ),
        Number.POSITIVE_INFINITY
      );
      const score = Math.min(
        1,
        nearestBlockDistance / TUNING.ai.openLaneBlockRadius
      );
      return [teammate.id, score] as const;
    })
  );
}

function teammateSeparationBySlotId(
  teammates: readonly SkaterEntity[]
): ReadonlyMap<string, number> {
  return new Map(
    teammates.map((teammate) => {
      const nearestDistance = teammates
        .filter((candidate) => candidate.id !== teammate.id)
        .reduce(
          (nearest, candidate) =>
            Math.min(nearest, distance(teammate.position, candidate.position)),
          Number.POSITIVE_INFINITY
        );
      return [teammate.id, nearestDistance] as const;
    })
  );
}

function hasNumbersAdvantage(
  teammates: readonly SkaterEntity[],
  opponents: readonly SkaterEntity[],
  puckPosition: Vec2
): boolean {
  const inAwarenessRange = (skaters: readonly SkaterEntity[]) =>
    skaters.filter(
      (skater) => distance(skater.position, puckPosition) <= TUNING.ai.awarenessRange
    ).length;

  return inAwarenessRange(teammates) > inAwarenessRange(opponents);
}

function teamSkaters(world: WorldState, teamId: TeamId): SkaterEntity[] {
  return world.skaters
    .filter((skater) => skater.teamId === teamId)
    .sort((left, right) => compareIds(left.id, right.id));
}

function skaterById(world: WorldState, id: string): SkaterEntity | null {
  return world.skaters.find((skater) => skater.id === id) ?? null;
}

function nearestTo(
  skaters: readonly SkaterEntity[],
  position: Vec2
): SkaterEntity | null {
  return [...skaters].sort((left, right) => {
    const distanceDifference =
      distance(left.position, position) - distance(right.position, position);
    return distanceDifference === 0
      ? compareIds(left.id, right.id)
      : distanceDifference;
  })[0] ?? null;
}

function otherTeam(teamId: TeamId): TeamId {
  return teamId === "home" ? "away" : "home";
}

function distanceToSegment(point: Vec2, start: Vec2, end: Vec2): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return distance(point, start);
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
        segmentLengthSquared
    )
  );
  return distance(point, {
    x: start.x + segmentX * projection,
    y: start.y + segmentY * projection
  });
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
