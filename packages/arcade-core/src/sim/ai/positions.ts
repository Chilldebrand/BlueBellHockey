import { RINK_CONFIG, goalLineX } from "../../config/rink.js";
import { TUNING } from "../../config/tuning.js";
import type { SkaterEntity, Vec2, WorldState } from "../types.js";
import type { BotIntent } from "./decision.js";
import type { TacticalContext } from "./tactics.js";
import { tendencyForSkater } from "./tendencies.js";

export interface BotIntentChoice {
  readonly intent: BotIntent;
  readonly target: Vec2;
  readonly score: number;
  readonly reason: string;
}

/** Chooses a deterministic relative destination without writing to simulation state. */
export function chooseBotIntent(
  bot: SkaterEntity,
  world: WorldState,
  context: TacticalContext
): BotIntentChoice {
  const intent = chooseIntent(bot, world, context);
  const target = candidateForIntent(bot, world, context, intent);

  return {
    intent,
    target,
    score: scorePositionCandidate(bot, target, world, context),
    reason: `${context.state}:${intent}:${tendencyForSkater(bot)}`
  };
}

export function candidateForIntent(
  bot: SkaterEntity,
  world: WorldState,
  context: TacticalContext,
  intent: BotIntent
): Vec2 {
  const direction = attackDirection(bot);
  const puck = context.puckPosition;
  const carrier = context.carrierId
    ? world.skaters.find((skater) => skater.id === context.carrierId) ?? null
    : null;
  const anchor = carrier?.position ?? puck;
  const lateral = bot.slot.index % 2 === 0 ? 1 : -1;

  switch (intent) {
    case "carry":
      return attackingGoal(bot);
    case "support":
      return clampToRink({
        x: anchor.x + direction * 300,
        y: anchor.y + lateral * 420
      });
    case "cut":
      return clampToRink({
        x: attackingGoal(bot).x - direction * 240,
        y: RINK_CONFIG.height / 2 + lateral * 220
      });
    case "stretch":
      return clampToRink({
        x: attackingGoal(bot).x - direction * 480,
        y: RINK_CONFIG.height / 2 + lateral * 320
      });
    case "trail":
      return clampToRink({
        x: puck.x - direction * 500,
        y: puck.y - lateral * 190
      });
    case "pressure":
      return context.threatId
        ? world.skaters.find((skater) => skater.id === context.threatId)?.position ?? puck
        : puck;
    case "cover":
      return clampToRink({
        x: puck.x - direction * 180,
        y: puck.y + lateral * 280
      });
    case "protect-slot":
      return clampToRink({
        x: goalLineX(bot.teamId) + direction * 300,
        y: RINK_CONFIG.height / 2 + lateral * 120
      });
    case "recover":
      return clampToRink({
        x: puck.x - direction * 360,
        y: RINK_CONFIG.height / 2 + lateral * 220
      });
    case "challenge-loose-puck":
      return { ...puck };
    case "reset-shape":
      return clampToRink({
        x: goalLineX(bot.teamId) + direction * (360 + bot.slot.index * 110),
        y: RINK_CONFIG.height / 2 + lateral * 260
      });
    case "screen":
      return clampToRink({
        x: attackingGoal(bot).x - direction * 150,
        y: RINK_CONFIG.height / 2 + lateral * 60
      });
  }
}

export function scorePositionCandidate(
  bot: SkaterEntity,
  target: Vec2,
  world: WorldState,
  context: TacticalContext
): number {
  const teammates = world.skaters.filter(
    (skater) => skater.teamId === bot.teamId && skater.id !== bot.id
  );
  const opponents = world.skaters.filter(
    (skater) => skater.teamId !== bot.teamId
  );
  const nearestTeammateDistance = teammates.reduce(
    (nearest, teammate) => Math.min(nearest, distance(target, teammate.position)),
    Number.POSITIVE_INFINITY
  );
  const nearestLaneBlock = opponents.reduce(
    (nearest, opponent) =>
      Math.min(
        nearest,
        distanceToSegment(opponent.position, context.puckPosition, target)
      ),
    Number.POSITIVE_INFINITY
  );
  const separationScore = Math.min(1, nearestTeammateDistance / 360);
  const laneScore = Math.min(1, nearestLaneBlock / TUNING.ai.openLaneBlockRadius);
  const pressurePenalty = context.pressureBySlotId.get(bot.id) ?? 0;

  return separationScore * 0.65 + laneScore * 0.45 - pressurePenalty * 0.1;
}

/** Retain the current choice unless the challenger clears the tuning margin. */
export function shouldKeepCurrentIntent(
  currentScore: number,
  nextScore: number
): boolean {
  return nextScore <= currentScore + TUNING.ai.intentSwitchHysteresis;
}

function chooseIntent(
  bot: SkaterEntity,
  world: WorldState,
  context: TacticalContext
): BotIntent {
  const tendency = tendencyForSkater(bot);

  switch (context.state) {
    case "attack":
      if (context.carrierId === bot.id) {
        return "carry";
      }
      if (tendency === "safety") {
        return "trail";
      }
      if (tendency === "shooter") {
        return "stretch";
      }
      if (tendency === "net-drive" && carrierIsDeepInAttack(bot, world, context)) {
        return "screen";
      }
      if (tendency === "attack" || tendency === "net-drive") {
        return "cut";
      }
      return "support";
    case "defend":
      if (isClosestToThreat(bot, world, context)) {
        return "pressure";
      }
      return distanceToThreat(bot, world, context) > TUNING.ai.pressureRange * 2
        ? "protect-slot"
        : "cover";
    case "transition":
      return tendency === "safety" || tendency === "checker" ? "recover" : "stretch";
    case "loose-puck":
      return isClosestToPuck(bot, world, context)
        ? "challenge-loose-puck"
        : "recover";
    case "reset":
      return "reset-shape";
  }
}

function isClosestToThreat(
  bot: SkaterEntity,
  world: WorldState,
  context: TacticalContext
): boolean {
  const threat = context.threatId
    ? world.skaters.find((skater) => skater.id === context.threatId) ?? null
    : null;

  return threat ? isClosest(bot, teamSkaters(world, bot), threat.position) : false;
}

function carrierIsDeepInAttack(
  bot: SkaterEntity,
  world: WorldState,
  context: TacticalContext
): boolean {
  const carrier = context.carrierId
    ? world.skaters.find((skater) => skater.id === context.carrierId) ?? null
    : null;

  if (!carrier || carrier.teamId !== bot.teamId) {
    return false;
  }

  return carrier.teamId === "home"
    ? carrier.position.x >= RINK_CONFIG.width * 0.72
    : carrier.position.x <= RINK_CONFIG.width * 0.28;
}

function distanceToThreat(
  bot: SkaterEntity,
  world: WorldState,
  context: TacticalContext
): number {
  const threat = context.threatId
    ? world.skaters.find((skater) => skater.id === context.threatId) ?? null
    : null;
  return threat ? distance(bot.position, threat.position) : Number.POSITIVE_INFINITY;
}

function isClosestToPuck(
  bot: SkaterEntity,
  world: WorldState,
  context: TacticalContext
): boolean {
  return isClosest(bot, teamSkaters(world, bot), context.puckPosition);
}

function isClosest(
  bot: SkaterEntity,
  skaters: readonly SkaterEntity[],
  target: Vec2
): boolean {
  const closest = [...skaters].sort((left, right) => {
    const difference = distance(left.position, target) - distance(right.position, target);
    return difference === 0 ? compareIds(left.id, right.id) : difference;
  })[0];
  return closest?.id === bot.id;
}

function teamSkaters(world: WorldState, bot: SkaterEntity): SkaterEntity[] {
  return world.skaters.filter((skater) => skater.teamId === bot.teamId);
}

function attackingGoal(bot: SkaterEntity): Vec2 {
  return {
    x: goalLineX(bot.teamId === "home" ? "away" : "home"),
    y: RINK_CONFIG.height / 2
  };
}

function attackDirection(bot: SkaterEntity): -1 | 1 {
  return bot.teamId === "home" ? 1 : -1;
}

function clampToRink(position: Vec2): Vec2 {
  return {
    x: Math.min(RINK_CONFIG.width - 80, Math.max(80, position.x)),
    y: Math.min(RINK_CONFIG.height - 80, Math.max(80, position.y))
  };
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
