import { RINK_CONFIG, goalLineX } from "../config/rink.js";
import type { InputFrame, PuckState, SkaterEntity, Vec2, WorldState } from "./types.js";
import { containCircleInRink } from "./boards.js";
import { collidePuckWithNets, NET_BOXES } from "./net.js";
import { expDecay, magnitude, normalizeOrZero } from "./physics.js";
import { passDirectionWithAssist } from "./actions.js";
import { clearPendingRelease } from "./gestures.js";
import { bladeWorldPosition, bladeWorldVelocity } from "./stick.js";

export interface PuckConfig {
  readonly radius: number;
  /** Blade-to-puck distance inside which a loose puck is gathered. */
  readonly pickupRadius: number;
  /** A loose puck faster than this (relative to the blade) can't be gathered. */
  readonly pickupMaxRelativeSpeed: number;
  /** Per-second exponential decay of planar speed while scraping the ice. */
  readonly frictionPerSecond: number;
  /** Per-second decay while airborne — much lighter than ice scrape. */
  readonly airDragPerSecond: number;
  /** Downward acceleration on the vertical axis (units/s²). */
  readonly gravity: number;
  /** Vertical restitution when a falling puck hits the ice. */
  readonly iceRestitution: number;
  /** Planar speed kept on each ice bounce (landing scrubs a little pace). */
  readonly bounceRetention: number;
  /** Below this vertical speed a landing puck settles flat instead of bouncing. */
  readonly settleVerticalSpeed: number;
  readonly boardRestitution: number;
  /** Tangential speed kept on board contact — pucks rim, they don't stick. */
  readonly boardTangentRetention: number;
  /** Goal post radius (posts sit at the goal-mouth edges on the goal line). */
  readonly postRadius: number;
  readonly postRestitution: number;
  /**
   * Tether carry: the puck is pulled toward the blade by a spring instead of
   * being pinned, so it lags on turns, swings on dangles, and can be poked.
   */
  readonly carryStiffness: number;
  /** Cap on the tether's per-second velocity correction. */
  readonly carryMaxAccel: number;
  /** Blade-to-puck distance beyond which possession breaks (over-dangled). */
  readonly carryBreakDistance: number;
  /** Opponent blade within this of a carried puck pokes it loose. */
  readonly pokeRadius: number;
  /** Speed given to a poked-loose puck along the poking blade's motion. */
  readonly pokeImpulse: number;
  readonly passSpeed: number;
  readonly wristShotSpeed: number;
  readonly maxChargedShotSpeed: number;
  /** Shooting within this of gathering a teammate's pass is a one-timer. */
  readonly oneTimerWindowMs: number;
  /** Power multiplier a one-timer adds to the shot. */
  readonly oneTimerPowerMultiplier: number;
  /** Vertical launch speed of a full-power wrist shot. */
  readonly wristLiftSpeed: number;
  /** Vertical launch speed a full-power slap adds (rising slapper). */
  readonly slapLiftSpeed: number;
  /** Aim placement keeps this far inside the posts at full stick deflection. */
  readonly shotPlacementMargin: number;
  readonly releasePickupCooldownMs: number;
}

export const PUCK_CONFIG: PuckConfig = {
  radius: 18,
  pickupRadius: 48,
  pickupMaxRelativeSpeed: 760,
  frictionPerSecond: 0.55,
  airDragPerSecond: 0.12,
  gravity: 2300,
  iceRestitution: 0.38,
  bounceRetention: 0.88,
  settleVerticalSpeed: 70,
  boardRestitution: 0.62,
  boardTangentRetention: 0.94,
  postRadius: 10,
  postRestitution: 0.82,
  // NHL-25 fluidity pass: tighter tether so the puck answers the stick
  // almost one-to-one through dangles without losing the physical lag.
  carryStiffness: 19,
  carryMaxAccel: 34000,
  carryBreakDistance: 96,
  pokeRadius: 34,
  pokeImpulse: 480,
  passSpeed: 820,
  wristShotSpeed: 1040,
  maxChargedShotSpeed: 1460,
  oneTimerWindowMs: 550,
  oneTimerPowerMultiplier: 1.22,
  wristLiftSpeed: 170,
  slapLiftSpeed: 330,
  shotPlacementMargin: 30,
  releasePickupCooldownMs: 220
};

/** Height of the goal frame — a puck at or above this hits the crossbar. */
export const GOAL_HEIGHT = 95;

export function createInitialPuckState(position: Vec2): PuckState {
  return {
    position,
    velocity: { x: 0, y: 0 },
    height: 0,
    verticalVelocity: 0,
    carrierSlotId: null,
    lastTouchSlotId: null,
    shotBySlotId: null,
    shotPower: 0,
    isChargedShot: false,
    passedFromSlotId: null,
    passedAtMs: 0,
    pickupDisabledForSlotId: null,
    pickupDisabledUntilMs: 0
  };
}

export function stepPuck(
  world: WorldState,
  inputsBySlot: ReadonlyMap<string, InputFrame>,
  dtMs: number,
  config: PuckConfig = PUCK_CONFIG
): void {
  const carrier = world.puck.carrierSlotId
    ? world.skaters.find((skater) => skater.id === world.puck.carrierSlotId)
    : undefined;

  if (carrier) {
    stepCarriedPuck(world, carrier, inputsBySlot.get(carrier.id), dtMs, config);
    return;
  }

  stepLoosePuck(world, dtMs, config);
  tryPickupLoosePuck(world, dtMs, config);
}

function stepCarriedPuck(
  world: WorldState,
  carrier: SkaterEntity,
  input: InputFrame | undefined,
  dtMs: number,
  config: PuckConfig
): void {
  const puck = world.puck;
  const dt = dtMs / 1000;
  puck.height = 0;
  puck.verticalVelocity = 0;
  puck.lastTouchSlotId = carrier.id;

  // Releases decided this tick beat the tether: shot gesture, then pass.
  if (carrier.gesture.pendingReleaseType !== "none") {
    releaseGestureShot(world, carrier, input, config);
    return;
  }

  if (input?.pass) {
    releasePuck(world, carrier, passDirectionWithAssist(world, carrier), {
      speed: config.passSpeed,
      lift: 0,
      shotPower: 0,
      isChargedShot: false,
      shotBySlotId: null,
      pickupCooldownMs: config.releasePickupCooldownMs
    });
    // A teammate gathering this in-flight pass gets a one-timer window.
    puck.passedFromSlotId = carrier.id;
    puck.passedAtMs = world.time.nowMs;
    return;
  }

  // Opponent blade on the puck: poked loose.
  const poker = findPokingOpponent(world, carrier, config);

  if (poker) {
    const pokeDirection = normalizeOrZero(bladeWorldVelocity(poker, dt));
    const direction =
      magnitude(pokeDirection) > 0
        ? pokeDirection
        : normalizeOrZero({
            x: puck.position.x - poker.position.x,
            y: puck.position.y - poker.position.y
          });

    puck.carrierSlotId = null;
    puck.lastTouchSlotId = poker.id;
    puck.pickupDisabledForSlotId = carrier.id;
    puck.pickupDisabledUntilMs = world.time.nowMs + 250;
    puck.velocity = {
      x: carrier.velocity.x * 0.35 + direction.x * config.pokeImpulse,
      y: carrier.velocity.y * 0.35 + direction.y * config.pokeImpulse
    };
    world.stats[poker.teamId].takeaways += 1;
    world.stats.takeaways[poker.teamId] += 1;
    world.eventQueue.push({
      id: `poke-${world.time.tick}-${poker.id}`,
      type: "poke",
      atMs: world.time.nowMs,
      sourceSlotId: poker.id,
      targetSlotId: carrier.id
    });
    return;
  }

  // Tether: spring the puck's velocity toward tracking the blade point.
  const blade = bladeWorldPosition(carrier);
  const toBladeX = blade.x - puck.position.x;
  const toBladeY = blade.y - puck.position.y;
  const separation = Math.hypot(toBladeX, toBladeY);

  if (separation > config.carryBreakDistance) {
    // Over-dangled: the puck slips off the blade and rolls loose.
    puck.carrierSlotId = null;
    puck.pickupDisabledForSlotId = carrier.id;
    puck.pickupDisabledUntilMs = world.time.nowMs + 180;
    return;
  }

  const desiredVelX = carrier.velocity.x + toBladeX * config.carryStiffness;
  const desiredVelY = carrier.velocity.y + toBladeY * config.carryStiffness;
  let correctionX = desiredVelX - puck.velocity.x;
  let correctionY = desiredVelY - puck.velocity.y;
  const correction = Math.hypot(correctionX, correctionY);
  const maxCorrection = config.carryMaxAccel * dt;

  if (correction > maxCorrection && correction > 0) {
    const scale = maxCorrection / correction;
    correctionX *= scale;
    correctionY *= scale;
  }

  puck.velocity.x += correctionX;
  puck.velocity.y += correctionY;
  puck.position.x += puck.velocity.x * dt;
  puck.position.y += puck.velocity.y * dt;
  containCircleInRink(
    puck.position,
    puck.velocity,
    config.radius,
    0,
    config.boardTangentRetention
  );
}

/**
 * NHL-style shot aiming: shots always drive at the attacking net, and the
 * LEFT stick at release places them inside it — neutral = dead center,
 * screen-left/right picks the side, screen-up lifts it toward the bar,
 * screen-down keeps it along the ice. (Movement input arrives in world
 * space: screen-right = +y across the mouth, screen-up = +x.)
 */
function releaseGestureShot(
  world: WorldState,
  carrier: SkaterEntity,
  input: InputFrame | undefined,
  config: PuckConfig
): void {
  const gesture = carrier.gesture;
  const isSlap = gesture.pendingReleaseType === "slap";
  const power = gesture.pendingReleasePower;
  const isOneTimer = world.time.nowMs < carrier.oneTimerUntilMs;
  const oneTimerBoost = isOneTimer ? config.oneTimerPowerMultiplier : 1;
  const speed =
    (isSlap
      ? config.wristShotSpeed +
        (config.maxChargedShotSpeed - config.wristShotSpeed) * power
      : config.wristShotSpeed * (0.78 + 0.22 * power)) * oneTimerBoost;

  // Placement from the left stick at release (world space, clamped).
  const lateralAim = Math.max(-1, Math.min(1, input?.moveY ?? 0));
  const heightAim = Math.max(-1, Math.min(1, input?.moveX ?? 0));
  const attackedNet = carrier.teamId === "home" ? "away" : "home";
  const target = {
    x: goalLineX(attackedNet),
    y:
      RINK_CONFIG.height / 2 +
      lateralAim * (RINK_CONFIG.goalWidth / 2 - config.shotPlacementMargin)
  };
  const blade = bladeWorldPosition(carrier, undefined, world.time.nowMs);
  const direction = normalizeOrZero({
    x: target.x - blade.x,
    y: target.y - blade.y
  });

  // Height: base lift by shot type/power, pushed up or held down by aim.
  const heightScale = 0.55 + 0.45 * heightAim; // -1 → along the ice, +1 → top shelf
  const lift =
    (isSlap ? config.slapLiftSpeed : config.wristLiftSpeed) *
    power *
    Math.max(0.1, heightScale) *
    (isOneTimer ? 1.15 : 1);

  releasePuck(world, carrier, direction, {
    speed,
    lift,
    shotPower: speed,
    isChargedShot: isSlap && power > 0.5,
    shotBySlotId: carrier.id,
    pickupCooldownMs: config.releasePickupCooldownMs
  });
  world.eventQueue.push({
    id: `shot-${world.time.tick}-${carrier.id}`,
    type: "shot",
    atMs: world.time.nowMs,
    sourceSlotId: carrier.id,
    force: speed,
    detail: isOneTimer ? "oneTimer" : isSlap ? "slap" : "wrist"
  });

  if (isOneTimer) {
    carrier.oneTimerUntilMs = 0;
    world.eventQueue.push({
      id: `onetimer-${world.time.tick}-${carrier.id}`,
      type: "oneTimer",
      atMs: world.time.nowMs,
      sourceSlotId: carrier.id
    });
  }

  clearPendingRelease(gesture);
}

function findPokingOpponent(
  world: WorldState,
  carrier: SkaterEntity,
  config: PuckConfig
): SkaterEntity | null {
  for (const opponent of world.skaters) {
    if (opponent.teamId === carrier.teamId || opponent.contactState !== "ready") {
      continue;
    }

    // Poke lunges extend the blade — pass sim time so the reach counts.
    const blade = bladeWorldPosition(opponent, undefined, world.time.nowMs);
    const distance = Math.hypot(
      world.puck.position.x - blade.x,
      world.puck.position.y - blade.y
    );

    if (distance <= config.pokeRadius + config.radius) {
      return opponent;
    }
  }

  return null;
}

function stepLoosePuck(
  world: WorldState,
  dtMs: number,
  config: PuckConfig
): void {
  const puck = world.puck;
  const dt = dtMs / 1000;

  // Vertical axis: gravity, ice bounce, settle.
  const airborne = puck.height > 0.5 || Math.abs(puck.verticalVelocity) > 1;
  puck.verticalVelocity -= config.gravity * dt;
  puck.height += puck.verticalVelocity * dt;

  if (puck.height <= 0) {
    puck.height = 0;

    if (puck.verticalVelocity < -config.settleVerticalSpeed) {
      puck.verticalVelocity = -puck.verticalVelocity * config.iceRestitution;
      puck.velocity.x *= config.bounceRetention;
      puck.velocity.y *= config.bounceRetention;
    } else {
      puck.verticalVelocity = 0;
    }
  }

  // Planar motion: light drag in the air, ice scrape on the deck.
  const drag = expDecay(
    airborne ? config.airDragPerSecond : config.frictionPerSecond,
    dt
  );
  puck.velocity.x *= drag;
  puck.velocity.y *= drag;
  puck.position.x += puck.velocity.x * dt;
  puck.position.y += puck.velocity.y * dt;

  deflectOffDivingBodies(world, config);
  collideWithPosts(world, config);
  collideWithCrossbars(world, config);
  collidePuckWithNets(puck, config.radius);

  // Goals are interior cages now, so the boards always contain the puck.
  containCircleInRink(
    puck.position,
    puck.velocity,
    config.radius,
    config.boardRestitution,
    config.boardTangentRetention
  );
}

/**
 * Shot blocking: a skater laid out on the ice (diving) is a body in the lane —
 * a low puck running into them deflects off, deadened, and pops loose.
 */
function deflectOffDivingBodies(world: WorldState, config: PuckConfig): void {
  const puck = world.puck;

  if (puck.height > 42) {
    return; // sailed over the sprawled body
  }

  for (const skater of world.skaters) {
    if (skater.contactState !== "diving") {
      continue;
    }

    const blockRadius = 46 + config.radius;
    const offsetX = puck.position.x - skater.position.x;
    const offsetY = puck.position.y - skater.position.y;
    const distance = Math.hypot(offsetX, offsetY);

    if (distance >= blockRadius || distance === 0) {
      continue;
    }

    const normal = { x: offsetX / distance, y: offsetY / distance };
    const into = puck.velocity.x * normal.x + puck.velocity.y * normal.y;

    puck.position.x = skater.position.x + normal.x * blockRadius;
    puck.position.y = skater.position.y + normal.y * blockRadius;

    if (into < 0) {
      // Shin-pad restitution: the block deadens the shot, no springboard.
      puck.velocity.x -= 1.35 * into * normal.x;
      puck.velocity.y -= 1.35 * into * normal.y;
    }

    puck.lastTouchSlotId = skater.id;
    puck.shotBySlotId = null;
    puck.pickupDisabledForSlotId = null;
    puck.pickupDisabledUntilMs = world.time.nowMs + 120;
    world.eventQueue.push({
      id: `block-${world.time.tick}-${skater.id}`,
      type: "block",
      atMs: world.time.nowMs,
      sourceSlotId: skater.id
    });
    return;
  }
}

/**
 * A puck arriving at a goal mouth at bar height clangs off the crossbar and
 * stays out; clearly higher sails over the whole cage into behind-net space.
 */
function collideWithCrossbars(world: WorldState, config: PuckConfig): void {
  const puck = world.puck;
  const atBarHeight =
    puck.height + config.radius >= GOAL_HEIGHT &&
    puck.height < GOAL_HEIGHT + 32;

  if (!atBarHeight) {
    return;
  }

  const inBand =
    Math.abs(puck.position.y - RINK_CONFIG.height / 2) <=
    RINK_CONFIG.goalWidth / 2;

  if (!inBand) {
    return;
  }

  for (const net of NET_BOXES) {
    const nearLine = Math.abs(puck.position.x - net.lineX) <= config.radius + 8;
    const movingIn = Math.sign(puck.velocity.x) === -net.mouthDirection;

    if (nearLine && movingIn) {
      puck.position.x = net.lineX + net.mouthDirection * (config.radius + 8);
      puck.velocity.x = -puck.velocity.x * config.postRestitution;
      puck.verticalVelocity = Math.min(puck.verticalVelocity, -60);
      world.eventQueue.push({
        id: `post-${world.time.tick}-bar`,
        type: "post",
        atMs: world.time.nowMs
      });
      return;
    }
  }
}

function collideWithPosts(world: WorldState, config: PuckConfig): void {
  const puck = world.puck;

  // Only pucks below the bar can hit a post.
  if (puck.height + config.radius >= GOAL_HEIGHT) {
    return;
  }

  for (const goalX of [goalLineX("home"), goalLineX("away")]) {
    for (const side of [-1, 1]) {
      const postY =
        RINK_CONFIG.height / 2 + side * (RINK_CONFIG.goalWidth / 2 + config.postRadius);
      const offsetX = puck.position.x - goalX;
      const offsetY = puck.position.y - postY;
      const distance = Math.hypot(offsetX, offsetY);
      const minDistance = config.postRadius + config.radius;

      if (distance >= minDistance || distance === 0) {
        continue;
      }

      const normal = { x: offsetX / distance, y: offsetY / distance };
      const into = puck.velocity.x * normal.x + puck.velocity.y * normal.y;

      puck.position.x = goalX + normal.x * minDistance;
      puck.position.y = postY + normal.y * minDistance;

      if (into < 0) {
        puck.velocity.x -= (1 + config.postRestitution) * into * normal.x;
        puck.velocity.y -= (1 + config.postRestitution) * into * normal.y;
      }

      world.eventQueue.push({
        id: `post-${world.time.tick}-${goalX}-${side}`,
        type: "post",
        atMs: world.time.nowMs
      });
      return;
    }
  }
}

function tryPickupLoosePuck(
  world: WorldState,
  dtMs: number,
  config: PuckConfig
): void {
  const puck = world.puck;

  // A puck sailing overhead can't be gathered off the stick.
  if (puck.height > 40) {
    return;
  }

  const dt = dtMs / 1000;

  for (const skater of world.skaters) {
    if (
      puck.pickupDisabledForSlotId === skater.id &&
      world.time.nowMs < puck.pickupDisabledUntilMs
    ) {
      continue;
    }

    if (skater.contactState !== "ready") {
      continue;
    }

    const blade = bladeWorldPosition(skater, undefined, world.time.nowMs);
    const distance = Math.hypot(
      puck.position.x - blade.x,
      puck.position.y - blade.y
    );

    if (distance > config.pickupRadius) {
      continue;
    }

    // A rocket off the blade deflects rather than sticking.
    const bladeVelocity = bladeWorldVelocity(skater, dt);
    const relativeSpeed = Math.hypot(
      puck.velocity.x - bladeVelocity.x,
      puck.velocity.y - bladeVelocity.y
    );

    if (relativeSpeed > config.pickupMaxRelativeSpeed) {
      continue;
    }

    // Gather: possession starts, the tether reels the puck in from where it
    // lies (no teleport onto the blade).
    puck.carrierSlotId = skater.id;
    puck.lastTouchSlotId = skater.id;
    puck.shotBySlotId = null;
    puck.shotPower = 0;
    puck.isChargedShot = false;
    puck.pickupDisabledForSlotId = null;
    puck.pickupDisabledUntilMs = 0;
    puck.height = 0;
    puck.verticalVelocity = 0;

    // Catch-and-release: taking a teammate's fresh pass arms a one-timer.
    if (
      puck.passedFromSlotId &&
      puck.passedFromSlotId !== skater.id &&
      world.time.nowMs - puck.passedAtMs <= config.oneTimerWindowMs &&
      world.skaters.find((mate) => mate.id === puck.passedFromSlotId)?.teamId ===
        skater.teamId
    ) {
      skater.oneTimerUntilMs = world.time.nowMs + config.oneTimerWindowMs;
    }

    puck.passedFromSlotId = null;
    puck.passedAtMs = 0;
    return;
  }
}

function releasePuck(
  world: WorldState,
  carrier: SkaterEntity,
  direction: Vec2,
  release: {
    readonly speed: number;
    readonly lift: number;
    readonly shotPower: number;
    readonly isChargedShot: boolean;
    readonly shotBySlotId: string | null;
    readonly pickupCooldownMs: number;
  }
): void {
  const normalized = normalizeOrZero(direction);
  const blade = bladeWorldPosition(carrier);

  world.puck.carrierSlotId = null;
  world.puck.lastTouchSlotId = carrier.id;
  world.puck.shotBySlotId = release.shotBySlotId;
  world.puck.shotPower = release.shotPower;
  world.puck.isChargedShot = release.isChargedShot;
  world.puck.passedFromSlotId = null;
  world.puck.passedAtMs = 0;
  world.puck.pickupDisabledForSlotId = carrier.id;
  world.puck.pickupDisabledUntilMs = world.time.nowMs + release.pickupCooldownMs;
  world.puck.position = { ...blade };
  containCircleInRink(world.puck.position, { x: 0, y: 0 }, PUCK_CONFIG.radius, 0);
  world.puck.velocity = {
    x: normalized.x * release.speed,
    y: normalized.y * release.speed
  };
  world.puck.height = 0;
  world.puck.verticalVelocity = release.lift;
}

