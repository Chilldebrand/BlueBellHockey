import { getCharacterById } from "../config/characters.js";
import type { InputFrame, SkaterEntity, Vec2, WorldState } from "./types.js";
import { clearPendingRelease } from "./gestures.js";
import { fromAngle, magnitude, normalizeOrZero } from "./physics.js";
import { hasActivePowerup } from "./powerups.js";
import { playerStatLine } from "./stats.js";

/** Check-force multiplier while the bulldozer (Big Hit) powerup is active. */
export const BULLDOZER_FORCE_MULTIPLIER = 2.5;

export interface CheckConfig {
  readonly radius: number;
  readonly cooldownMs: number;
  readonly activeMs: number;
  readonly stumbleMs: number;
  readonly knockdownMs: number;
  /** Force needed (vs a stat-3 target) to stagger them into a stumble. */
  readonly stumbleForce: number;
  /** Force needed (vs a stat-3, moving target) to flatten them. */
  readonly knockdownForce: number;
  /** Force needed to strip a carried puck loose. */
  readonly puckStripForce: number;
  readonly slideSpeed: number;
  /** Flat body-contact force so a standstill press still shoves (never fells). */
  readonly baseCheckForce: number;
  /** Force multiplier per point of checker `power` above/below 3. */
  readonly powerStatScale: number;
  /** Threshold multiplier per point of target `balance` above/below 3. */
  readonly balanceStatScale: number;
  /** Targets moving slower than this are braced/anchored. */
  readonly anchorSpeed: number;
  /** Knockdown-threshold multiplier for anchored targets. */
  readonly anchorResistMultiplier: number;
  /** Shove speed added to a bumped (sub-stumble) target at full force ratio. */
  readonly bumpImpulse: number;
  /** Forward lunge applied when a check attempt doesn't connect instantly. */
  readonly checkLungeBoost: number;
  /** Vulnerable recovery after a check that never lands. */
  readonly whiffRecoveryMs: number;
  /** Bounce off an anchored target when force < stumbleThreshold * ratio. */
  readonly bounceBackRatio: number;
  readonly bounceBackImpulse: number;
  readonly bounceBackMs: number;
  /** How much a soft stick-flick reduces the attempt vs the button (1 = off). */
  readonly flickPowerFloor: number;
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
  // NHL-style hitting: calibrated against cruise 560 / turbo 840 so a
  // standstill press only bumps, an aligned cruise hit stumbles, and
  // knockdowns need turbo or a power edge (see hit.test.ts table).
  stumbleForce: 520,
  knockdownForce: 1000,
  puckStripForce: 600,
  slideSpeed: 380,
  baseCheckForce: 130,
  powerStatScale: 0.12,
  balanceStatScale: 0.1,
  anchorSpeed: 140,
  anchorResistMultiplier: 1.2,
  bumpImpulse: 300,
  checkLungeBoost: 230,
  whiffRecoveryMs: 500,
  bounceBackRatio: 0.5,
  bounceBackImpulse: 320,
  bounceBackMs: 480,
  flickPowerFloor: 0.85,
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

/**
 * NHL-style body checking. An attempt (B button, or a right-stick up-flick
 * while not carrying) opens the existing `activeMs` window: contact inside the
 * window resolves a graded hit — bump / stumble / knockdown — from the
 * checker's speed and `power` stat against the target's `balance` stat (and a
 * braced bonus when the target is barely moving). Attempts that never connect
 * whiff into a vulnerable recovery stumble, and weak hits on anchored, stronger
 * targets bounce the CHECKER off instead.
 */
export function resolveChecks(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>,
  config: CheckConfig = CHECK_CONFIG
): void {
  recoverContactStates(world);
  const now = world.time.nowMs;

  for (const hitter of world.skaters) {
    const input = inputsBySlot.get(hitter.id);

    // Right-stick up-flick doubles as a hit attempt when NOT carrying (when
    // carrying it stays the wrist shot, consumed later by the puck step).
    // Consume the latch here even if the attempt is gated, so gaining the puck
    // later this tick can't turn the same flick into a shot.
    const isCarrier = world.puck.carrierSlotId === hitter.id;
    const flickCheck =
      !isCarrier && hitter.gesture.pendingReleaseType === "wrist";
    const flickPower = hitter.gesture.pendingReleasePower;
    if (flickCheck) {
      clearPendingRelease(hitter.gesture);
    }

    const wantsCheck = input?.check === true || flickCheck;
    let startedThisTick = false;

    if (
      wantsCheck &&
      hitter.contactState === "ready" &&
      now >= hitter.checkCooldownUntilMs
    ) {
      hitter.checkCooldownUntilMs = now + config.cooldownMs;
      hitter.activeCheckUntilMs = now + config.activeMs;
      hitter.activeCheckPower = flickCheck && !input?.check ? flickPower : 1;
      startedThisTick = true;
    }

    if (hitter.activeCheckPower <= 0) {
      continue;
    }

    // Getting hit (or diving) cancels a pending attempt.
    if (hitter.contactState !== "ready") {
      hitter.activeCheckPower = 0;
      continue;
    }

    const target = findCheckTarget(world, hitter, config);

    if (!target) {
      if (now >= hitter.activeCheckUntilMs && !startedThisTick) {
        // Window expired with no contact: whiff into a vulnerable recovery.
        hitter.activeCheckPower = 0;
        hitter.contactState = "stumbling";
        hitter.contactStateUntilMs = now + config.whiffRecoveryMs;
        world.eventQueue.push({
          id: `checkwhiff-${world.time.tick}-${hitter.id}`,
          type: "checkWhiff",
          atMs: now,
          sourceSlotId: hitter.id
        });
      } else if (startedThisTick) {
        // Lunge toward the play — may carry the checker into contact on a
        // later window tick. Only on a miss, so landed hits keep the
        // calibration table honest (baseCheckForce is the standstill term).
        const lunge = facingDirection(hitter);
        hitter.velocity.x += lunge.x * config.checkLungeBoost;
        hitter.velocity.y += lunge.y * config.checkLungeBoost;
      }
      continue;
    }

    resolveHit(world, hitter, target, hitter.activeCheckPower, config);
    hitter.activeCheckPower = 0;
  }
}

/** Graded hit resolution — see resolveChecks. */
function resolveHit(
  world: WorldState,
  hitter: SkaterEntity,
  target: SkaterEntity,
  attemptPower: number,
  config: CheckConfig
): void {
  const now = world.time.nowMs;

  // A frozen target is an ice block: it absorbs the check without being
  // shoved or knocked around. The checker's attempt is simply spent.
  if (target.contactState === "frozen") {
    return;
  }

  const hitterStats = getCharacterById(hitter.characterId).stats;
  const targetStats = getCharacterById(target.characterId).stats;

  const direction = facingDirection(hitter);
  const toTarget = normalizeOrZero({
    x: target.position.x - hitter.position.x,
    y: target.position.y - hitter.position.y
  });
  const hitDir = magnitude(toTarget) > 0 ? toTarget : direction;
  const alignment = Math.max(
    0,
    direction.x * toTarget.x + direction.y * toTarget.y
  );

  const bulldozing = hasActivePowerup(world, hitter.id, "bulldozer");
  const powerScale = 1 + (hitterStats.power - 3) * config.powerStatScale;
  const flickScale =
    config.flickPowerFloor + (1 - config.flickPowerFloor) * attemptPower;
  const force =
    (magnitude(hitter.velocity) * (0.75 + alignment * 0.5) +
      config.baseCheckForce) *
    powerScale *
    flickScale *
    (bulldozing ? BULLDOZER_FORCE_MULTIPLIER : 1);

  const resistScale = 1 + (targetStats.balance - 3) * config.balanceStatScale;
  const anchored = magnitude(target.velocity) < config.anchorSpeed;
  const stumbleThreshold = config.stumbleForce * resistScale;
  const stripThreshold = config.puckStripForce * resistScale;
  const knockdownThreshold =
    config.knockdownForce *
    resistScale *
    (anchored ? config.anchorResistMultiplier : 1);

  world.eventQueue.push({
    id: `hit-${world.time.tick}-${hitter.id}-${target.id}`,
    type: "hit",
    atMs: now,
    sourceSlotId: hitter.id,
    targetSlotId: target.id,
    force
  });
  world.stats[hitter.teamId].hits += 1;
  world.stats.hits[hitter.teamId] += 1;
  const hitterStatsLine = playerStatLine(world.stats, hitter.id);
  if (hitterStatsLine) {
    hitterStatsLine.hits += 1;
  }

  // Bulldozer flattens on any contact — force the knockdown branch (the
  // amplified force also clears the strip threshold below, taking the puck).
  if (force >= knockdownThreshold || bulldozing) {
    target.contactState = "knockedDown";
    target.contactStateUntilMs = now + config.knockdownMs;
    const slide = facingDirection(hitter);
    target.velocity = {
      x: slide.x * config.slideSpeed,
      y: slide.y * config.slideSpeed
    };
    world.eventQueue.push({
      id: `knockdown-${world.time.tick}-${target.id}`,
      type: "knockdown",
      atMs: now,
      sourceSlotId: hitter.id,
      targetSlotId: target.id,
      force
    });
  } else if (force >= stumbleThreshold) {
    target.contactState = "stumbling";
    target.contactStateUntilMs = now + config.stumbleMs;
    target.velocity.x += hitDir.x * config.bumpImpulse;
    target.velocity.y += hitDir.y * config.bumpImpulse;
    world.eventQueue.push({
      id: `stumble-${world.time.tick}-${target.id}`,
      type: "stumble",
      atMs: now,
      sourceSlotId: hitter.id,
      targetSlotId: target.id,
      force
    });
  } else if (anchored && force < stumbleThreshold * config.bounceBackRatio) {
    // Braced, stronger target: the CHECKER caroms off and staggers.
    hitter.contactState = "stumbling";
    hitter.contactStateUntilMs = now + config.bounceBackMs;
    hitter.velocity = {
      x: -hitDir.x * config.bounceBackImpulse,
      y: -hitDir.y * config.bounceBackImpulse
    };
    target.velocity.x += hitDir.x * config.bumpImpulse * 0.35;
    target.velocity.y += hitDir.y * config.bumpImpulse * 0.35;
    world.eventQueue.push({
      id: `bounceback-${world.time.tick}-${hitter.id}`,
      type: "bounceBack",
      atMs: now,
      sourceSlotId: hitter.id,
      targetSlotId: target.id,
      force
    });
  } else if (target.contactState !== "knockedDown") {
    // Weak contact: a physical shove, no state change.
    const shove =
      config.bumpImpulse *
      Math.min(1, Math.max(0.35, force / stumbleThreshold));
    target.velocity.x += hitDir.x * shove;
    target.velocity.y += hitDir.y * shove;
  }

  if (world.puck.carrierSlotId === target.id && force >= stripThreshold) {
    world.puck.carrierSlotId = null;
    world.puck.lastTouchSlotId = hitter.id;
    world.puck.assistCandidateSlotId = null;
    world.puck.pickupDisabledForSlotId = target.id;
    world.puck.pickupDisabledUntilMs = now + 250;
    world.puck.velocity = {
      x: direction.x * Math.max(config.puckStripForce, force),
      y: direction.y * Math.max(config.puckStripForce, force)
    };
    world.stats[hitter.teamId].takeaways += 1;
    world.stats.takeaways[hitter.teamId] += 1;
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

/**
 * Pass aim, like shot aiming: the LEFT stick's world-space direction when it's
 * pushed, otherwise the carrier's facing so a coasting pass still goes forward.
 */
export function passAimDirection(
  input: InputFrame | undefined,
  carrier: SkaterEntity
): Vec2 {
  const aim = { x: input?.moveX ?? 0, y: input?.moveY ?? 0 };
  if (magnitude(aim) > 0.3) {
    return normalizeOrZero(aim);
  }
  return facingDirection(carrier);
}

/**
 * Given an aim direction (see passAimDirection), pass to the best-aligned
 * teammate within the assist cone, or straight along the aim if none is there.
 */
export function passDirectionWithAssist(
  world: WorldState,
  carrier: SkaterEntity,
  aim: Vec2,
  assistCosine = 0.65
): Vec2 {
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
