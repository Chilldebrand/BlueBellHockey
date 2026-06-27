import {
  CHECK_CONFIG,
  POWERUP_PICKUP_RADIUS,
  RINK_CONFIG,
  type SkaterEntity,
  type TeamId,
  type Vec2,
  type WorldState
} from "@bbh/arcade-core";

export type BotRole = "carrier" | "support" | "defender";

export interface BotDifficulty {
  readonly reactionRange: number;
  readonly shotAggression: number;
  readonly passWillingness: number;
  readonly specialFrequency: number;
}

export const BOT_DIFFICULTY = {
  pro: {
    reactionRange: 260,
    shotAggression: 1,
    passWillingness: 1,
    specialFrequency: 45
  }
} as const satisfies Record<string, BotDifficulty>;

export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = BOT_DIFFICULTY.pro;

export interface BotDecision {
  readonly role: BotRole;
  readonly moveTarget: Vec2;
  readonly aimTarget: Vec2;
  readonly pass: boolean;
  readonly shoot: boolean;
  readonly check: boolean;
  readonly turbo: boolean;
  readonly switchTarget: boolean;
  readonly usePowerup: boolean;
  readonly special: boolean;
}

const SLOT_SHOT_RANGE = 430;
const SLOT_Y_RANGE = 190;
const SUPPORT_ADVANCE = 220;
const SUPPORT_WIDE_OFFSET = 180;
const LOOSE_PUCK_RANGE = 520;

export function selectBotDecision(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY
): BotDecision {
  const role = chooseBotRole(bot, world);
  const moveTarget =
    choosePickupTarget(bot, world, difficulty) ??
    botTargetForRole(bot, world, role);
  const pass = shouldPass(bot, world, difficulty);
  const passTarget = pass ? findPassTarget(bot, world, difficulty) : null;
  const shoot = !pass && shouldShoot(bot, world, difficulty);
  const check = shouldCheckCarrier(bot, world, difficulty);
  const usePowerup = shouldUseHeldPowerup(bot, world, difficulty);
  const special = !usePowerup && shouldUseSpecial(bot, world, difficulty);

  return {
    role,
    moveTarget,
    aimTarget: aimTargetForDecision({
      bot,
      world,
      moveTarget,
      passTarget,
      shoot,
      check
    }),
    pass,
    shoot,
    check,
    turbo:
      bot.turboMeter > 0.18 &&
      (isBreakaway(bot, world) || needsRecoveryTurbo(bot, world)),
    switchTarget: pass,
    usePowerup,
    special
  };
}

export const selectBotRole = chooseBotRole;
export const bestPassingTarget = findPassTarget;

export function chooseBotRole(bot: SkaterEntity, world: WorldState): BotRole {
  if (world.puck.carrierSlotId === bot.id) {
    return "carrier";
  }

  const carrier = findCarrier(world);
  if (carrier?.teamId === bot.teamId) {
    return "support";
  }

  if (carrier && carrier.teamId !== bot.teamId) {
    return "defender";
  }

  return isClosestTeammateToPuck(bot, world) ? "carrier" : "defender";
}

export function botTargetForRole(
  bot: SkaterEntity,
  world: WorldState,
  role: BotRole
): Vec2 {
  if (role === "carrier") {
    return attackingGoal(bot.teamId);
  }

  if (role === "defender") {
    return findCarrier(world)?.position ?? world.puck.position;
  }

  return supportLaneTarget(bot, world);
}

export function choosePickupTarget(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty
): Vec2 | null {
  if (bot.heldPowerupType || world.powerupPickups.length === 0) {
    return null;
  }

  const pickup = nearestByDistance(
    world.powerupPickups,
    (candidate) => candidate.position,
    bot.position
  );

  if (!pickup) {
    return null;
  }

  const range = Math.max(difficulty.reactionRange, POWERUP_PICKUP_RADIUS * 2);
  return distance(bot.position, pickup.position) <= range
    ? pickup.position
    : null;
}

export function isPressured(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty
): boolean {
  return world.skaters.some(
    (candidate) =>
      candidate.teamId !== bot.teamId &&
      distance(candidate.position, bot.position) <= difficulty.reactionRange
  );
}

export function shouldShoot(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty
): boolean {
  if (world.puck.carrierSlotId !== bot.id) {
    return false;
  }

  const goal = attackingGoal(bot.teamId);
  const shotRange = SLOT_SHOT_RANGE * difficulty.shotAggression;
  return (
    distance(bot.position, goal) <= shotRange &&
    Math.abs(bot.position.y - goal.y) <= SLOT_Y_RANGE
  );
}

export function shouldPass(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty
): boolean {
  if (
    world.puck.carrierSlotId !== bot.id ||
    !isPressured(bot, world, difficulty)
  ) {
    return false;
  }

  return Boolean(findPassTarget(bot, world, difficulty));
}

export function shouldCheckCarrier(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty
): boolean {
  const carrier = findCarrier(world);
  if (!carrier || carrier.teamId === bot.teamId) {
    return false;
  }

  return (
    bot.contactState === "ready" &&
    world.time.nowMs >= bot.checkCooldownUntilMs &&
    distance(bot.position, carrier.position) <=
      Math.min(difficulty.reactionRange, CHECK_CONFIG.radius)
  );
}

export function isBreakaway(bot: SkaterEntity, world: WorldState): boolean {
  if (world.puck.carrierSlotId !== bot.id) {
    return false;
  }

  const direction = teamDirection(bot.teamId);
  const attackingZone =
    bot.teamId === "home"
      ? bot.position.x >= RINK_CONFIG.width * 0.62
      : bot.position.x <= RINK_CONFIG.width * 0.38;
  if (!attackingZone) {
    return false;
  }

  return !world.skaters.some((candidate) => {
    if (candidate.teamId === bot.teamId) {
      return false;
    }

    const aheadOfBot =
      direction > 0
        ? candidate.position.x > bot.position.x
        : candidate.position.x < bot.position.x;
    return (
      aheadOfBot &&
      Math.abs(candidate.position.y - bot.position.y) <= 170 &&
      distance(candidate.position, bot.position) <= 360
    );
  });
}

export function shouldUseHeldPowerup(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty = BOT_DIFFICULTY.pro
): boolean {
  if (!bot.heldPowerupType) {
    return false;
  }

  if (bot.heldPowerupType === "instant-special") {
    return true;
  }

  if (bot.heldPowerupType === "hard-shot") {
    return shouldShoot(bot, world, difficulty);
  }

  if (bot.heldPowerupType === "speed-boost") {
    return isBreakaway(bot, world) || needsRecoveryTurbo(bot, world);
  }

  if (bot.heldPowerupType === "shield") {
    return (
      world.puck.carrierSlotId === bot.id &&
      isPressured(bot, world, difficulty)
    );
  }

  if (bot.heldPowerupType === "puck-magnet") {
    return (
      !world.puck.carrierSlotId &&
      distance(bot.position, world.puck.position) <= difficulty.reactionRange
    );
  }

  return isAttackingZone(bot);
}

export function shouldUseSpecial(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty
): boolean {
  if (
    bot.specialCharge < 1 ||
    world.time.nowMs < bot.specialCooldownUntilMs ||
    world.time.tick % difficulty.specialFrequency !== 0
  ) {
    return false;
  }

  return (
    isBreakaway(bot, world) ||
    (world.puck.carrierSlotId === bot.id && isAttackingZone(bot)) ||
    shouldCheckCarrier(bot, world, difficulty)
  );
}

export function findPassTarget(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY
): SkaterEntity | null {
  let best: SkaterEntity | null = null;
  let bestScore = 0;
  const direction = teamDirection(bot.teamId);

  for (const teammate of world.skaters) {
    if (teammate.id === bot.id || teammate.teamId !== bot.teamId) {
      continue;
    }

    const forward = (teammate.position.x - bot.position.x) * direction;
    const separation = distance(teammate.position, bot.position);
    const laneWidth = Math.abs(teammate.position.y - bot.position.y);
    const score = forward * 1.25 + laneWidth * 0.8 - separation * 0.2;

    if (
      forward >= 80 * difficulty.passWillingness &&
      laneWidth >= 70 &&
      separation <= 520 &&
      score > bestScore
    ) {
      best = teammate;
      bestScore = score;
    }
  }

  return best;
}

export function needsRecoveryTurbo(
  bot: SkaterEntity,
  world: WorldState
): boolean {
  const carrier = findCarrier(world);
  if (!carrier || carrier.teamId === bot.teamId) {
    return false;
  }

  const directionToDefensiveGoal = -teamDirection(bot.teamId);
  const botBehindCarrier =
    directionToDefensiveGoal > 0
      ? bot.position.x < carrier.position.x
      : bot.position.x > carrier.position.x;

  return botBehindCarrier && distance(bot.position, carrier.position) >= 300;
}

export function directionToTarget(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);

  if (length <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: dx / length,
    y: dy / length
  };
}

export function attackingGoal(teamId: TeamId): Vec2 {
  return {
    x: teamId === "home" ? RINK_CONFIG.width : 0,
    y: RINK_CONFIG.height / 2
  };
}

function supportLaneTarget(bot: SkaterEntity, world: WorldState): Vec2 {
  const carrier = findCarrier(world);
  const anchor =
    carrier?.teamId === bot.teamId ? carrier.position : world.puck.position;
  const direction = teamDirection(bot.teamId);
  const laneSign = bot.slot.index % 2 === 0 ? -1 : 1;

  return clampToRink({
    x: anchor.x + direction * SUPPORT_ADVANCE,
    y: anchor.y + laneSign * SUPPORT_WIDE_OFFSET
  });
}

function isClosestTeammateToPuck(bot: SkaterEntity, world: WorldState): boolean {
  const closest = nearestByDistance(
    world.skaters.filter((candidate) => candidate.teamId === bot.teamId),
    (candidate) => candidate.position,
    world.puck.position
  );

  return (
    closest?.id === bot.id &&
    distance(bot.position, world.puck.position) <= LOOSE_PUCK_RANGE
  );
}

function findCarrier(world: WorldState): SkaterEntity | null {
  return (
    world.skaters.find((skater) => skater.id === world.puck.carrierSlotId) ??
    null
  );
}

function nearestByDistance<T>(
  candidates: readonly T[],
  positionFor: (candidate: T) => Vec2,
  origin: Vec2
): T | null {
  let best: T | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const candidateDistance = distance(origin, positionFor(candidate));
    if (candidateDistance < bestDistance) {
      best = candidate;
      bestDistance = candidateDistance;
    }
  }

  return best;
}

function aimTargetForDecision(options: {
  readonly bot: SkaterEntity;
  readonly world: WorldState;
  readonly moveTarget: Vec2;
  readonly passTarget: SkaterEntity | null;
  readonly shoot: boolean;
  readonly check: boolean;
}): Vec2 {
  if (options.passTarget) {
    return options.passTarget.position;
  }

  if (options.shoot) {
    return attackingGoal(options.bot.teamId);
  }

  if (options.check) {
    return findCarrier(options.world)?.position ?? options.moveTarget;
  }

  return options.moveTarget;
}

function isAttackingZone(bot: SkaterEntity): boolean {
  return bot.teamId === "home"
    ? bot.position.x >= RINK_CONFIG.width * 0.6
    : bot.position.x <= RINK_CONFIG.width * 0.4;
}

function teamDirection(teamId: TeamId): -1 | 1 {
  return teamId === "home" ? 1 : -1;
}

function clampToRink(position: Vec2): Vec2 {
  return {
    x: Math.min(RINK_CONFIG.width - 80, Math.max(80, position.x)),
    y: Math.min(RINK_CONFIG.height - 80, Math.max(80, position.y))
  };
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
