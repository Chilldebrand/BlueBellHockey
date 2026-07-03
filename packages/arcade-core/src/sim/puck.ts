import { RINK_CONFIG } from "../config/rink.js";
import type { InputFrame, PuckState, SkaterEntity, Vec2, WorldState } from "./types.js";
import { containCircleInRink } from "./boards.js";
import { clamp, expDecay, magnitude, normalizeOrZero } from "./physics.js";
import { inputAimOrFacing, passDirectionWithAssist } from "./actions.js";

export interface PuckConfig {
  readonly radius: number;
  readonly carryOffset: number;
  readonly stickReach: number;
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
  readonly passSpeed: number;
  readonly wristShotSpeed: number;
  readonly maxChargedShotSpeed: number;
  readonly maxChargeMs: number;
  /** Vertical launch speed a fully charged shot adds (rising slapper). */
  readonly chargeLiftSpeed: number;
  readonly releasePickupCooldownMs: number;
}

export const PUCK_CONFIG: PuckConfig = {
  radius: 18,
  carryOffset: 58,
  stickReach: 82,
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
  passSpeed: 820,
  wristShotSpeed: 1040,
  maxChargedShotSpeed: 1460,
  maxChargeMs: 600,
  chargeLiftSpeed: 330,
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
    chargeBySlotId: null,
    chargeStartedAtMs: null,
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
    stepCarriedPuck(world, carrier, inputsBySlot.get(carrier.id), config);
    return;
  }

  stepLoosePuck(world, dtMs, config);
  tryPickupLoosePuck(world, inputsBySlot, config);
}

function stepCarriedPuck(
  world: WorldState,
  carrier: SkaterEntity,
  input: InputFrame | undefined,
  config: PuckConfig
): void {
  const direction = inputAimOrFacing(input, carrier);

  world.puck.position = carriedPuckPosition(carrier, direction, config);
  world.puck.velocity = { x: 0, y: 0 };
  world.puck.height = 0;
  world.puck.verticalVelocity = 0;
  world.puck.lastTouchSlotId = carrier.id;

  if (input?.pass) {
    releasePuck(world, carrier, passDirectionWithAssist(world, carrier, input), {
      speed: config.passSpeed,
      lift: 0,
      shotPower: 0,
      isChargedShot: false,
      shotBySlotId: null,
      pickupCooldownMs: config.releasePickupCooldownMs
    });
    return;
  }

  if (input?.shoot) {
    if (world.puck.chargeBySlotId !== carrier.id) {
      world.puck.chargeBySlotId = carrier.id;
      world.puck.chargeStartedAtMs = world.time.nowMs;
    }
    return;
  }

  if (world.puck.chargeBySlotId === carrier.id) {
    const chargeMs = Math.max(
      0,
      world.time.nowMs - (world.puck.chargeStartedAtMs ?? world.time.nowMs)
    );
    const charge = clamp(chargeMs / config.maxChargeMs, 0, 1);
    const speed =
      config.wristShotSpeed +
      (config.maxChargedShotSpeed - config.wristShotSpeed) * charge;

    releasePuck(world, carrier, direction, {
      speed,
      lift: charge * config.chargeLiftSpeed,
      shotPower: speed,
      isChargedShot: charge > 0.15,
      shotBySlotId: carrier.id,
      pickupCooldownMs: config.releasePickupCooldownMs
    });
  }
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
  inputsBySlot: ReadonlyMap<string, InputFrame>,
  config: PuckConfig
): void {
  // A puck sailing overhead can't be gathered off the stick.
  if (world.puck.height > 40) {
    return;
  }

  for (const skater of world.skaters) {
    if (
      world.puck.pickupDisabledForSlotId === skater.id &&
      world.time.nowMs < world.puck.pickupDisabledUntilMs
    ) {
      continue;
    }

    const direction = inputAimOrFacing(inputsBySlot.get(skater.id), skater);
    const stick = carriedPuckPosition(skater, direction, config);
    const distance = magnitude({
      x: world.puck.position.x - stick.x,
      y: world.puck.position.y - stick.y
    });

    if (distance <= config.stickReach) {
      world.puck.carrierSlotId = skater.id;
      world.puck.lastTouchSlotId = skater.id;
      world.puck.shotBySlotId = null;
      world.puck.shotPower = 0;
      world.puck.isChargedShot = false;
      world.puck.chargeBySlotId = null;
      world.puck.chargeStartedAtMs = null;
      world.puck.pickupDisabledForSlotId = null;
      world.puck.pickupDisabledUntilMs = 0;
      world.puck.position = stick;
      world.puck.velocity = { x: 0, y: 0 };
      world.puck.height = 0;
      world.puck.verticalVelocity = 0;
      return;
    }
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

  world.puck.carrierSlotId = null;
  world.puck.lastTouchSlotId = carrier.id;
  world.puck.shotBySlotId = release.shotBySlotId;
  world.puck.shotPower = release.shotPower;
  world.puck.isChargedShot = release.isChargedShot;
  world.puck.chargeBySlotId = null;
  world.puck.chargeStartedAtMs = null;
  world.puck.pickupDisabledForSlotId = carrier.id;
  world.puck.pickupDisabledUntilMs = world.time.nowMs + release.pickupCooldownMs;
  world.puck.velocity = {
    x: normalized.x * release.speed,
    y: normalized.y * release.speed
  };
  world.puck.height = 0;
  world.puck.verticalVelocity = release.lift;
}

function carriedPuckPosition(
  skater: SkaterEntity,
  direction: Vec2,
  config: PuckConfig
): Vec2 {
  return {
    x: skater.position.x + direction.x * config.carryOffset,
    y: skater.position.y + direction.y * config.carryOffset
  };
}
