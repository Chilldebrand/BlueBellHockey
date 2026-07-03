import { RINK_CONFIG } from "../config/rink.js";
import type { InputFrame, PuckState, SkaterEntity, Vec2, WorldState } from "./types.js";
import { containCircleInRink } from "./boards.js";
import { expDecay, magnitude, normalizeOrZero, rotate } from "./physics.js";
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
  /** Vertical launch speed of a full-power wrist shot. */
  readonly wristLiftSpeed: number;
  /** Vertical launch speed a full-power slap adds (rising slapper). */
  readonly slapLiftSpeed: number;
  /** How much the lateral stick position bends a shot off the facing line. */
  readonly shotSideBlend: number;
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
  carryStiffness: 14,
  carryMaxAccel: 26000,
  carryBreakDistance: 96,
  pokeRadius: 34,
  pokeImpulse: 480,
  passSpeed: 820,
  wristShotSpeed: 1040,
  maxChargedShotSpeed: 1460,
  wristLiftSpeed: 170,
  slapLiftSpeed: 330,
  shotSideBlend: 0.55,
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
    releaseGestureShot(world, carrier, config);
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

function releaseGestureShot(
  world: WorldState,
  carrier: SkaterEntity,
  config: PuckConfig
): void {
  const gesture = carrier.gesture;
  const isSlap = gesture.pendingReleaseType === "slap";
  const power = gesture.pendingReleasePower;
  const speed = isSlap
    ? config.wristShotSpeed +
      (config.maxChargedShotSpeed - config.wristShotSpeed) * power
    : config.wristShotSpeed * (0.78 + 0.22 * power);
  const lift = (isSlap ? config.slapLiftSpeed : config.wristLiftSpeed) * power;
  const direction = rotate(
    normalizeOrZero({
      x: 1,
      y: gesture.pendingReleaseSide * config.shotSideBlend
    }),
    carrier.facing
  );

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
    force: speed
  });
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

    const blade = bladeWorldPosition(opponent);
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

  collideWithPosts(world, config);

  if (isInGoalMouth(puck, config)) {
    if (puck.height + config.radius >= GOAL_HEIGHT) {
      collideWithCrossbar(world, config);
    }
    // Below the bar in the mouth: let it cross the line — resolveGoals scores it.
    return;
  }

  containCircleInRink(
    puck.position,
    puck.velocity,
    config.radius,
    config.boardRestitution,
    config.boardTangentRetention
  );
}

/** In front of either goal mouth: inside the mouth band and at/near the goal line. */
function isInGoalMouth(puck: PuckState, config: PuckConfig): boolean {
  const inBand =
    Math.abs(puck.position.y - RINK_CONFIG.height / 2) <=
    RINK_CONFIG.goalWidth / 2 - config.radius * 0.5;

  if (!inBand) {
    return false;
  }

  return (
    puck.position.x <= config.radius ||
    puck.position.x >= RINK_CONFIG.width - config.radius
  );
}

/** A high puck in the mouth clangs off the bar and stays in play. */
function collideWithCrossbar(world: WorldState, config: PuckConfig): void {
  const puck = world.puck;
  const intoLeftGoal = puck.position.x <= config.radius;
  const inward = intoLeftGoal ? 1 : -1;

  puck.position.x = intoLeftGoal
    ? config.radius
    : RINK_CONFIG.width - config.radius;

  if (Math.sign(puck.velocity.x) === -inward) {
    puck.velocity.x = -puck.velocity.x * config.postRestitution;
  }

  // The bar knocks it down out of the air.
  puck.verticalVelocity = Math.min(puck.verticalVelocity, -60);
  world.eventQueue.push({
    id: `post-${world.time.tick}-bar`,
    type: "post",
    atMs: world.time.nowMs
  });
}

function collideWithPosts(world: WorldState, config: PuckConfig): void {
  const puck = world.puck;

  // Only pucks below the bar can hit a post.
  if (puck.height + config.radius >= GOAL_HEIGHT) {
    return;
  }

  for (const goalX of [0, RINK_CONFIG.width]) {
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

    const blade = bladeWorldPosition(skater);
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

