import { RINK_CONFIG, goalLineX, netBackX } from "../config/rink.js";
import type { TeamId } from "../config/teams.js";
import type { PuckState, SkaterEntity, Vec2, WorldState } from "./types.js";

/** Netting deadens; nothing springs out of the twine. */
const NET_RESTITUTION = 0.25;
/** The cage is solid up to the crossbar; higher pucks sail over it. */
export const NET_TOP_HEIGHT = 95;
/** Posts sit at the goal-mouth edges on the goal line. */
const POST_MARGIN = 10;

export interface NetBox {
  readonly teamId: TeamId;
  /** X extent of the cage footprint (min..max regardless of side). */
  readonly minX: number;
  readonly maxX: number;
  /** Y extent including the posts. */
  readonly minY: number;
  readonly maxY: number;
  /** X of the goal line (the open mouth plane). */
  readonly lineX: number;
  /** X of the back of the cage. */
  readonly backX: number;
  /** +1 when the mouth faces +x (home's net), -1 when it faces -x. */
  readonly mouthDirection: 1 | -1;
}

export function netBoxFor(teamId: TeamId): NetBox {
  const lineX = goalLineX(teamId);
  const backX = netBackX(teamId);
  const halfMouth = RINK_CONFIG.goalWidth / 2 + POST_MARGIN;

  return {
    teamId,
    minX: Math.min(lineX, backX),
    maxX: Math.max(lineX, backX),
    minY: RINK_CONFIG.height / 2 - halfMouth,
    maxY: RINK_CONFIG.height / 2 + halfMouth,
    lineX,
    backX,
    mouthDirection: teamId === "home" ? 1 : -1
  };
}

export const NET_BOXES: readonly NetBox[] = [netBoxFor("home"), netBoxFor("away")];

/**
 * Puck vs the net cage from OUTSIDE: the back and the two sides are solid
 * twine below the crossbar. The mouth plane is intentionally open — a puck
 * crossing it inside the posts is a goal (resolved by goal.ts) before any
 * in-cage physics could matter. High pucks fly clean over the whole cage.
 */
export function collidePuckWithNets(puck: PuckState, radius: number): boolean {
  if (puck.height >= NET_TOP_HEIGHT) {
    return false;
  }

  for (const net of NET_BOXES) {
    const withinMouthBand =
      puck.position.y > net.minY - radius && puck.position.y < net.maxY + radius;
    const withinCageX =
      puck.position.x > net.minX - radius && puck.position.x < net.maxX + radius;
    const cageMiddleX = (net.minX + net.maxX) / 2;

    // Back wall, hit from the behind-the-net corridor. Mouth-side entries are
    // goals, not collisions, so only the corridor half of the cage is solid.
    if (withinMouthBand) {
      if (net.mouthDirection > 0) {
        // Home net: mouth faces +x, corridor is at lower x.
        if (
          puck.position.x > net.backX - radius &&
          puck.position.x < cageMiddleX &&
          puck.velocity.x > 0
        ) {
          puck.position.x = net.backX - radius;
          puck.velocity.x = -puck.velocity.x * NET_RESTITUTION;
          return true;
        }
      } else if (
        puck.position.x < net.backX + radius &&
        puck.position.x > cageMiddleX &&
        puck.velocity.x < 0
      ) {
        // Away net: mouth faces -x, corridor is at higher x.
        puck.position.x = net.backX + radius;
        puck.velocity.x = -puck.velocity.x * NET_RESTITUTION;
        return true;
      }
    }

    // Side walls: approached from above/below the cage.
    if (withinCageX) {
      if (
        puck.position.y >= net.minY - radius &&
        puck.position.y < net.minY &&
        puck.velocity.y > 0
      ) {
        puck.position.y = net.minY - radius;
        puck.velocity.y = -puck.velocity.y * NET_RESTITUTION;
        return true;
      }

      if (
        puck.position.y <= net.maxY + radius &&
        puck.position.y > net.maxY &&
        puck.velocity.y < 0
      ) {
        puck.position.y = net.maxY + radius;
        puck.velocity.y = -puck.velocity.y * NET_RESTITUTION;
        return true;
      }
    }
  }

  return false;
}

/**
 * Skaters treat the whole cage as solid — no skating through the net from
 * any side (including the mouth; the crease belongs to the goalie). Standard
 * circle-vs-AABB push-out along the shallowest axis.
 */
export function pushSkaterOutOfNets(skater: SkaterEntity, radius: number): void {
  for (const net of NET_BOXES) {
    const closest: Vec2 = {
      x: clamp(skater.position.x, net.minX, net.maxX),
      y: clamp(skater.position.y, net.minY, net.maxY)
    };
    const offsetX = skater.position.x - closest.x;
    const offsetY = skater.position.y - closest.y;
    const distance = Math.hypot(offsetX, offsetY);

    if (distance >= radius) {
      continue;
    }

    if (distance > 1e-6) {
      // Outside the box but overlapping: push along the contact normal.
      const push = (radius - distance) / distance;
      skater.position.x += offsetX * push;
      skater.position.y += offsetY * push;
      killInwardVelocity(skater, offsetX / distance, offsetY / distance);
    } else {
      // Center inside the box: eject along the shallowest face.
      const exits: [number, number, number][] = [
        [skater.position.x - (net.minX - radius), -1, 0],
        [net.maxX + radius - skater.position.x, 1, 0],
        [skater.position.y - (net.minY - radius), 0, -1],
        [net.maxY + radius - skater.position.y, 0, 1]
      ];
      exits.sort((a, b) => a[0] - b[0]);
      const [depth, nx, ny] = exits[0];
      skater.position.x += nx * depth;
      skater.position.y += ny * depth;
      killInwardVelocity(skater, nx, ny);
    }
  }
}

function killInwardVelocity(skater: SkaterEntity, nx: number, ny: number): void {
  const into = skater.velocity.x * nx + skater.velocity.y * ny;

  if (into < 0) {
    skater.velocity.x -= nx * into;
    skater.velocity.y -= ny * into;
  }
}

/** True when the puck sits inside a cage's scoring volume (crossed the line). */
export function puckInsideGoal(world: WorldState): TeamId | null {
  const puck = world.puck;

  if (puck.height >= NET_TOP_HEIGHT) {
    return null;
  }

  const halfMouth = RINK_CONFIG.goalWidth / 2;

  if (Math.abs(puck.position.y - RINK_CONFIG.height / 2) > halfMouth) {
    return null;
  }

  for (const net of NET_BOXES) {
    if (puck.position.x >= net.minX && puck.position.x <= net.maxX) {
      // Scoring team is the ATTACKER of this net: home attacks away's net.
      return net.teamId === "home" ? "away" : "home";
    }
  }

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
