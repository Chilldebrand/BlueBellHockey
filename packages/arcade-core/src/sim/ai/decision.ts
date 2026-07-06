import { POWERUP_PICKUP_RADIUS } from "../../config/powerups.js";
import { RINK_CONFIG, goalLineX } from "../../config/rink.js";
import type { TeamId } from "../../config/teams.js";
import { CHECK_CONFIG } from "../actions.js";
import type { SkaterEntity, Vec2, WorldState } from "../types.js";

/**
 * Positional roles, assigned per TEAM per tick (see computeTeamPlan) so the
 * three skaters spread into hockey shape instead of all swarming the puck:
 * - carrier: has the puck, drives the attacking net (shoot/pass logic keys on
 *   actual possession, so this literal must stay).
 * - chase: closest teammate races a winnable loose puck.
 * - attack-slot: posts up in the high slot in front of the opposing net for a
 *   one-timer outlet.
 * - hold-back: safety between the puck and our net, own half.
 * - pressure: closest defender attacks the opposing carrier (or presumed
 *   winner of a lost loose puck).
 * - cover: shadow an off-puck opponent — near them, goal-side, not on top.
 * - protect-net: park in front of our crease when the assigned mark is far
 *   from our net.
 */
export type PositionalRole =
  | "carrier"
  | "chase"
  | "attack-slot"
  | "hold-back"
  | "pressure"
  | "cover"
  | "protect-net";

export type BotRole = PositionalRole;

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

// Positional-play constants. Code-level for now (the Feel Lab tuning panel
// doesn't cover AI); TODO: fold into TUNING if AI feel iteration starts.
/** Loose puck: if both teams' closest skaters are within this, both race it. */
export const CONTESTED_PUCK_MARGIN = 120;
/** High slot: this far down-ice from the attacking goal line. */
export const SLOT_DEPTH = 420;
/** Slot man nudges off center toward the puck side by this much. */
export const SLOT_LANE_OFFSET = 140;
/** Hold-back safety sits this fraction of the way from our goal to the puck. */
export const HOLD_BACK_LERP = 0.35;
/** ...but never closer to our goal line than this, and never past center. */
export const HOLD_BACK_MIN_DEPTH = 420;
/** Cover: shadow distance between the mark and our net (near, not on top). */
export const COVER_STANDOFF = 140;
/** A mark closer to our net than this gets covered; farther ⇒ protect-net. */
export const COVER_STEP_OUT_RANGE = 980;
/** Net-front post distance off our own goal line. */
export const PROTECT_NET_DEPTH = 180;

export function selectBotDecision(
  bot: SkaterEntity,
  world: WorldState,
  difficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY
): BotDecision {
  const plan = computeTeamPlan(world, bot.teamId);
  const role = plan.roles.get(bot.id) ?? "hold-back";
  const moveTarget =
    choosePickupTarget(bot, world, difficulty) ??
    targetForPlannedRole(bot, world, role, plan);
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

/**
 * Roles + cover-mark assignments for one team, computed together so role
 * assignment and target computation can never disagree on who covers whom.
 * Pure function of the world (no state, no randomness): ranking is by distance
 * with slotId as the deterministic tiebreak, so Free Skate replays stay
 * byte-identical. All three teammates are ranked with no knowledge of who is
 * human — bots look up only their own slot, so a human chasing the puck simply
 * leaves chase unclaimed-by-bots and the bots fill the remaining shape.
 */
interface TeamPlan {
  readonly roles: ReadonlyMap<string, PositionalRole>;
  readonly markBySlotId: ReadonlyMap<string, Vec2>;
}

function computeTeamPlan(world: WorldState, teamId: TeamId): TeamPlan {
  const roles = new Map<string, PositionalRole>();
  const markBySlotId = new Map<string, Vec2>();
  const mates = world.skaters.filter((skater) => skater.teamId === teamId);
  const opponents = world.skaters.filter((skater) => skater.teamId !== teamId);
  const carrier = findCarrier(world);

  if (carrier && carrier.teamId === teamId) {
    // OFFENSE: carrier attacks; closer remaining mate posts up in the slot,
    // the other stays home as the safety.
    roles.set(carrier.id, "carrier");
    const goal = attackingGoal(teamId);
    const others = rankByDistance(
      mates.filter((mate) => mate.id !== carrier.id),
      goal
    );
    if (others[0]) {
      roles.set(others[0].id, "attack-slot");
    }
    if (others[1]) {
      roles.set(others[1].id, "hold-back");
    }
    return { roles, markBySlotId };
  }

  if (carrier) {
    // DEFENSE: opponent carries.
    applyDefensiveShape(roles, markBySlotId, mates, opponents, carrier, teamId);
    return { roles, markBySlotId };
  }

  // LOOSE PUCK: the closer team attacks; within the contested margin BOTH
  // teams' checks pass, so both send their closest skater racing.
  const puck = world.puck.position;
  const myRanked = rankByDistance(mates, puck);
  const myBest = myRanked[0]
    ? distance(myRanked[0].position, puck)
    : Number.POSITIVE_INFINITY;
  const oppBest = opponents.reduce(
    (best, opponent) => Math.min(best, distance(opponent.position, puck)),
    Number.POSITIVE_INFINITY
  );

  if (myBest <= oppBest + CONTESTED_PUCK_MARGIN) {
    const chaseMan = myRanked[0];
    if (chaseMan) {
      roles.set(chaseMan.id, "chase");
    }
    const others = rankByDistance(myRanked.slice(1), attackingGoal(teamId));
    if (others[0]) {
      roles.set(others[0].id, "attack-slot");
    }
    if (others[1]) {
      roles.set(others[1].id, "hold-back");
    }
    return { roles, markBySlotId };
  }

  // Clearly losing the race: fall into defensive shape against the opponent
  // who is about to win the puck.
  const threat = nearestByDistance(
    opponents,
    (opponent) => opponent.position,
    puck
  );
  if (threat) {
    applyDefensiveShape(roles, markBySlotId, mates, opponents, threat, teamId);
  }
  return { roles, markBySlotId };
}

/**
 * Defensive shape vs. a threat (the carrier, or the presumed loose-puck
 * winner): closest mate pressures the threat; the other two pair off against
 * the remaining opponents — covering a mark that is inside the step-out range
 * of our net, otherwise parking net-front.
 */
function applyDefensiveShape(
  roles: Map<string, PositionalRole>,
  markBySlotId: Map<string, Vec2>,
  mates: readonly SkaterEntity[],
  opponents: readonly SkaterEntity[],
  threat: SkaterEntity,
  teamId: TeamId
): void {
  const ownGoal = defendingGoal(teamId);
  const pressureMan = rankByDistance(mates, threat.position)[0];
  if (pressureMan) {
    roles.set(pressureMan.id, "pressure");
  }

  const marks = rankByDistance(
    opponents.filter((opponent) => opponent.id !== threat.id),
    ownGoal
  );
  const defenders = marks[0]
    ? rankByDistance(
        mates.filter((mate) => mate.id !== pressureMan?.id),
        marks[0].position
      )
    : mates.filter((mate) => mate.id !== pressureMan?.id);

  defenders.forEach((defender, index) => {
    const mark = marks[index] ?? marks[marks.length - 1];
    if (mark && distance(mark.position, ownGoal) <= COVER_STEP_OUT_RANGE) {
      roles.set(defender.id, "cover");
      markBySlotId.set(defender.id, mark.position);
    } else {
      roles.set(defender.id, "protect-net");
    }
  });
}

/** Public view of the per-team role assignment (used by tests/telemetry). */
export function assignTeamRoles(
  world: WorldState,
  teamId: TeamId
): ReadonlyMap<string, PositionalRole> {
  return computeTeamPlan(world, teamId).roles;
}

export function chooseBotRole(
  bot: SkaterEntity,
  world: WorldState
): PositionalRole {
  return computeTeamPlan(world, bot.teamId).roles.get(bot.id) ?? "hold-back";
}

export function botTargetForRole(
  bot: SkaterEntity,
  world: WorldState,
  role: PositionalRole
): Vec2 {
  return targetForPlannedRole(bot, world, role, computeTeamPlan(world, bot.teamId));
}

function targetForPlannedRole(
  bot: SkaterEntity,
  world: WorldState,
  role: PositionalRole,
  plan: TeamPlan
): Vec2 {
  switch (role) {
    case "carrier":
      return attackingGoal(bot.teamId);
    case "chase":
      return world.puck.position;
    case "pressure":
      return presumedThreat(world, bot.teamId)?.position ?? world.puck.position;
    case "attack-slot":
      return slotPositionTarget(bot.teamId, world);
    case "hold-back":
      return holdBackTarget(bot.teamId, world);
    case "cover": {
      const mark = plan.markBySlotId.get(bot.id);
      return mark ? coverTarget(mark, bot.teamId) : protectNetTarget(bot.teamId);
    }
    case "protect-net":
      return protectNetTarget(bot.teamId);
  }
}

/** The opponent we defend against: their carrier, else their loose-puck racer. */
function presumedThreat(
  world: WorldState,
  teamId: TeamId
): SkaterEntity | null {
  const carrier = findCarrier(world);
  if (carrier && carrier.teamId !== teamId) {
    return carrier;
  }
  return nearestByDistance(
    world.skaters.filter((skater) => skater.teamId !== teamId),
    (skater) => skater.position,
    world.puck.position
  );
}

/** High slot in front of the attacking net, nudged toward the puck side. */
export function slotPositionTarget(teamId: TeamId, world: WorldState): Vec2 {
  const goal = attackingGoal(teamId);
  const centerY = RINK_CONFIG.height / 2;
  return clampToRink({
    x: goal.x - teamDirection(teamId) * SLOT_DEPTH,
    y:
      centerY +
      Math.sign(world.puck.position.y - centerY) * SLOT_LANE_OFFSET
  });
}

/** Safety spot between the puck and our net, kept in our half. */
export function holdBackTarget(teamId: TeamId, world: WorldState): Vec2 {
  const ownGoal = defendingGoal(teamId);
  const puck = world.puck.position;
  const direction = teamDirection(teamId);
  const rawX = ownGoal.x + (puck.x - ownGoal.x) * HOLD_BACK_LERP;
  const minX = ownGoal.x + direction * HOLD_BACK_MIN_DEPTH;
  const centerX = RINK_CONFIG.width / 2;
  const x =
    direction > 0
      ? Math.min(Math.max(rawX, minX), centerX)
      : Math.max(Math.min(rawX, minX), centerX);

  return clampToRink({
    x,
    y: ownGoal.y + (puck.y - ownGoal.y) * HOLD_BACK_LERP
  });
}

/** Shadow spot: on the mark→our-net line, a standoff short of the mark. */
export function coverTarget(mark: Vec2, teamId: TeamId): Vec2 {
  const toGoal = directionToTarget(mark, defendingGoal(teamId));
  return clampToRink({
    x: mark.x + toGoal.x * COVER_STANDOFF,
    y: mark.y + toGoal.y * COVER_STANDOFF
  });
}

/** Net-front post just off our own goal line. */
export function protectNetTarget(teamId: TeamId): Vec2 {
  return {
    x: goalLineX(teamId) + teamDirection(teamId) * PROTECT_NET_DEPTH,
    y: RINK_CONFIG.height / 2
  };
}

function defendingGoal(teamId: TeamId): Vec2 {
  return { x: goalLineX(teamId), y: RINK_CONFIG.height / 2 };
}

/** Distance-ascending sort with slotId tiebreak — the determinism anchor. */
function rankByDistance(
  skaters: readonly SkaterEntity[],
  origin: Vec2
): SkaterEntity[] {
  return [...skaters].sort((a, b) => {
    const byDistance =
      distance(a.position, origin) - distance(b.position, origin);
    if (byDistance !== 0) {
      return byDistance;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
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
  // Aim at the goal line (nets are interior cages now), not the end wall.
  return {
    x:
      teamId === "home"
        ? RINK_CONFIG.width - RINK_CONFIG.goalLineInset
        : RINK_CONFIG.goalLineInset,
    y: RINK_CONFIG.height / 2
  };
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
