import type { InputFrame, SkaterEntity, Vec2, WorldState } from "./types.js";
import { magnitude, normalizeOrZero } from "./physics.js";

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
}

export const CHECK_CONFIG: CheckConfig = {
  radius: 92,
  cooldownMs: 520,
  activeMs: 140,
  stumbleMs: 420,
  knockdownMs: 1050,
  stumbleSpeed: 300,
  knockdownSpeed: 620,
  puckStripSpeed: 420,
  slideSpeed: 360
};

export function inputAimOrFacing(
  input: InputFrame | undefined,
  skater: SkaterEntity
): Vec2 {
  const aim = normalizeOrZero({
    x: input?.aimX ?? 0,
    y: input?.aimY ?? 0
  });

  if (magnitude(aim) > 0) {
    return aim;
  }

  const velocityDirection = normalizeOrZero(skater.velocity);
  if (magnitude(velocityDirection) > 0) {
    return velocityDirection;
  }

  return {
    x: skater.teamId === "home" ? 1 : -1,
    y: 0
  };
}

export function resolveChecks(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>,
  config: CheckConfig = CHECK_CONFIG
): void {
  recoverContactStates(world);

  for (const hitter of world.skaters) {
    const input = inputsBySlot.get(hitter.id);

    if (!input?.check || world.time.nowMs < hitter.checkCooldownUntilMs) {
      continue;
    }

    hitter.checkCooldownUntilMs = world.time.nowMs + config.cooldownMs;
    hitter.activeCheckUntilMs = world.time.nowMs + config.activeMs;

    const target = findCheckTarget(world, hitter, input, config);
    if (!target) {
      continue;
    }

    const force = checkForce(hitter, input, target);
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
      target.velocity = {
        x: inputAimOrFacing(input, hitter).x * config.slideSpeed,
        y: inputAimOrFacing(input, hitter).y * config.slideSpeed
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
      const direction = inputAimOrFacing(input, hitter);
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
  input: InputFrame,
  config: CheckConfig
): SkaterEntity | null {
  const direction = inputAimOrFacing(input, hitter);
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

function checkForce(
  hitter: SkaterEntity,
  input: InputFrame,
  target: SkaterEntity
): number {
  const direction = inputAimOrFacing(input, hitter);
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
  input: InputFrame | undefined,
  assistCosine = 0.65
): Vec2 {
  const aim = inputAimOrFacing(input, carrier);
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
