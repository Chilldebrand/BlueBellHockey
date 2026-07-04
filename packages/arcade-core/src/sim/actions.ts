import type { InputFrame, SkaterEntity, Vec2, WorldState } from "./types.js";
import { fromAngle, magnitude, normalizeOrZero } from "./physics.js";

export interface CheckConfig {
  readonly radius: number;
  readonly cooldownMs: number;
  readonly activeMs: number;
  readonly stumbleMs: number;
  readonly knockdownMs: number;
  readonly stumbleSpeed: number;
  readonly knockdownSpeed: number;
  readonly puckStripSpeed: number;
  readonly slideSpeed: number;
  /** Poke check: how long the blade lunge lasts and how often it can fire. */
  readonly pokeDurationMs: number;
  readonly pokeCooldownMs: number;
  /** Extra forward blade reach at full poke lunge. */
  readonly pokeReachBonus: number;
  /** Block shot (dive): slide time, lockout, and the forward lunge speed. */
  readonly diveDurationMs: number;
  readonly diveCooldownMs: number;
  readonly diveBoost: number;
  /** Body radius a diving skater blocks the puck with. */
  readonly diveBlockRadius: number;
}

export const CHECK_CONFIG: CheckConfig = {
  radius: 96,
  cooldownMs: 500,
  activeMs: 150,
  stumbleMs: 390,
  knockdownMs: 960,
  stumbleSpeed: 290,
  knockdownSpeed: 650,
  puckStripSpeed: 430,
  slideSpeed: 380,
  pokeDurationMs: 200,
  pokeCooldownMs: 650,
  pokeReachBonus: 58,
  diveDurationMs: 850,
  diveCooldownMs: 1500,
  diveBoost: 430,
  diveBlockRadius: 46
};

/** Body-facing unit direction — checks, passes, and pokes act along it. */
export function facingDirection(skater: SkaterEntity): Vec2 {
  return fromAngle(skater.facing);
}

/**
 * NHL-style defensive tools for skaters without the puck:
 * - Poke check (RB) / stick lift (A off-puck): lunge the blade forward for a
 *   beat — the blade-on-puck strip in the puck step does the rest.
 * - Block shot (LB): dive in the facing direction, sliding prone; the body
 *   deflects pucks while down, then a lockout before the next dive.
 */
export function resolveDefensiveActions(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>,
  config: CheckConfig = CHECK_CONFIG
): void {
  const now = world.time.nowMs;

  for (const skater of world.skaters) {
    const input = inputsBySlot.get(skater.id);

    if (!input || skater.contactState !== "ready") {
      continue;
    }

    const isCarrier = world.puck.carrierSlotId === skater.id;
    const wantsPoke = input.poke === true || (!isCarrier && input.pass);

    if (wantsPoke && !isCarrier && now >= skater.pokeCooldownUntilMs) {
      skater.pokeUntilMs = now + config.pokeDurationMs;
      skater.pokeCooldownUntilMs = now + config.pokeCooldownMs;
    }

    if (input.dive === true && !isCarrier && now >= skater.diveCooldownUntilMs) {
      const lunge = facingDirection(skater);
      skater.contactState = "diving";
      skater.contactStateUntilMs = now + config.diveDurationMs;
      skater.diveCooldownUntilMs = now + config.diveCooldownMs;
      skater.velocity.x += lunge.x * config.diveBoost;
      skater.velocity.y += lunge.y * config.diveBoost;
      world.eventQueue.push({
        id: `dive-${world.time.tick}-${skater.id}`,
        type: "dive",
        atMs: now,
        sourceSlotId: skater.id
      });
    }
  }
}

export function resolveChecks(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>,
  config: CheckConfig = CHECK_CONFIG
): void {
  recoverContactStates(world);

  for (const hitter of world.skaters) {
    const input = inputsBySlot.get(hitter.id);

    if (
      !input?.check ||
      hitter.contactState !== "ready" ||
      world.time.nowMs < hitter.checkCooldownUntilMs
    ) {
      continue;
    }

    hitter.checkCooldownUntilMs = world.time.nowMs + config.cooldownMs;
    hitter.activeCheckUntilMs = world.time.nowMs + config.activeMs;

    const target = findCheckTarget(world, hitter, config);
    if (!target) {
      continue;
    }

    const force = checkForce(hitter, target);
    world.eventQueue.push({
      id: `hit-${world.time.tick}-${hitter.id}-${target.id}`,
      type: "hit",
      atMs: world.time.nowMs,
      sourceSlotId: hitter.id,
      targetSlotId: target.id,
      force
    });
    world.stats[hitter.teamId].hits += 1;
    world.stats.hits[hitter.teamId] += 1;

    if (force >= config.stumbleSpeed) {
      target.contactState = "stumbling";
      target.contactStateUntilMs = world.time.nowMs + config.stumbleMs;
      world.eventQueue.push({
        id: `stumble-${world.time.tick}-${target.id}`,
        type: "stumble",
        atMs: world.time.nowMs,
        sourceSlotId: hitter.id,
        targetSlotId: target.id,
        force
      });
    }

    if (force >= config.knockdownSpeed) {
      target.contactState = "knockedDown";
      target.contactStateUntilMs = world.time.nowMs + config.knockdownMs;
      const slide = facingDirection(hitter);
      target.velocity = {
        x: slide.x * config.slideSpeed,
        y: slide.y * config.slideSpeed
      };
      world.eventQueue.push({
        id: `knockdown-${world.time.tick}-${target.id}`,
        type: "knockdown",
        atMs: world.time.nowMs,
        sourceSlotId: hitter.id,
        targetSlotId: target.id,
        force
      });
    }

    if (
      world.puck.carrierSlotId === target.id &&
      force >= config.puckStripSpeed
    ) {
      const direction = facingDirection(hitter);
      world.puck.carrierSlotId = null;
      world.puck.lastTouchSlotId = hitter.id;
      world.puck.pickupDisabledForSlotId = target.id;
      world.puck.pickupDisabledUntilMs = world.time.nowMs + 250;
      world.puck.velocity = {
        x: direction.x * Math.max(config.puckStripSpeed, force),
        y: direction.y * Math.max(config.puckStripSpeed, force)
      };
      world.stats[hitter.teamId].takeaways += 1;
      world.stats.takeaways[hitter.teamId] += 1;
    }
  }
}

export function recoverContactStates(world: WorldState): void {
  for (const skater of world.skaters) {
    if (
      skater.contactState !== "ready" &&
      world.time.nowMs >= skater.contactStateUntilMs
    ) {
      skater.contactState = "ready";
      skater.contactStateUntilMs = 0;
    }
  }
}

function findCheckTarget(
  world: WorldState,
  hitter: SkaterEntity,
  config: CheckConfig
): SkaterEntity | null {
  const direction = facingDirection(hitter);
  let best: SkaterEntity | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of world.skaters) {
    if (target.id === hitter.id || target.teamId === hitter.teamId) {
      continue;
    }

    const toTarget = {
      x: target.position.x - hitter.position.x,
      y: target.position.y - hitter.position.y
    };
    const distance = magnitude(toTarget);
    const alignment = direction.x * normalizeOrZero(toTarget).x +
      direction.y * normalizeOrZero(toTarget).y;

    if (distance <= config.radius && alignment >= 0.25 && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }

  return best;
}

function checkForce(hitter: SkaterEntity, target: SkaterEntity): number {
  const direction = facingDirection(hitter);
  const toTarget = normalizeOrZero({
    x: target.position.x - hitter.position.x,
    y: target.position.y - hitter.position.y
  });
  const alignment = Math.max(0, direction.x * toTarget.x + direction.y * toTarget.y);

  return magnitude(hitter.velocity) * (0.75 + alignment * 0.5);
}

export function passDirectionWithAssist(
  world: WorldState,
  carrier: SkaterEntity,
  assistCosine = 0.65
): Vec2 {
  const aim = facingDirection(carrier);
  const selectedTarget = world.skaters.find(
    (skater) =>
      skater.id === carrier.selectedTargetSlotId &&
      skater.teamId === carrier.teamId &&
      skater.id !== carrier.id
  );

  if (selectedTarget) {
    const selectedDirection = normalizeOrZero({
      x: selectedTarget.position.x - carrier.position.x,
      y: selectedTarget.position.y - carrier.position.y
    });
    const selectedScore =
      aim.x * selectedDirection.x + aim.y * selectedDirection.y;

    if (selectedScore >= 0.15) {
      return selectedDirection;
    }
  }

  let bestTeammate: SkaterEntity | null = null;
  let bestScore = assistCosine;

  for (const teammate of world.skaters) {
    if (teammate.id === carrier.id || teammate.teamId !== carrier.teamId) {
      continue;
    }

    const toTeammate = normalizeOrZero({
      x: teammate.position.x - carrier.position.x,
      y: teammate.position.y - carrier.position.y
    });
    const score = aim.x * toTeammate.x + aim.y * toTeammate.y;

    if (score > bestScore) {
      bestScore = score;
      bestTeammate = teammate;
    }
  }

  if (!bestTeammate) {
    return aim;
  }

  return normalizeOrZero({
    x: bestTeammate.position.x - carrier.position.x,
    y: bestTeammate.position.y - carrier.position.y
  });
}
