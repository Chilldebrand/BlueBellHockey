import { RINK_CONFIG, type RinkConfig } from "../config/rink.js";
import type { Vec2 } from "./types.js";
import { dot } from "./physics.js";

export interface BoardContact {
  /** Unit normal pointing back into the rink at the contact point. */
  readonly normal: Vec2;
}

/**
 * Contain a circle of the given radius inside the rounded-rect rink boards,
 * mutating position and velocity in place. On contact the circle is pushed
 * back inside and its outward velocity component reflects with `restitution`
 * while the tangential component keeps `tangentialRetention` of its speed —
 * so pucks rim around corners instead of dying in a square pocket, and a
 * skater grinding the wall keeps sliding along it.
 *
 * Returns the contact (with its board normal) or null when no contact.
 */
export function containCircleInRink(
  position: Vec2,
  velocity: Vec2,
  radius: number,
  restitution: number,
  tangentialRetention = 1,
  rink: RinkConfig = RINK_CONFIG
): BoardContact | null {
  const corner = Math.max(radius, Math.min(rink.cornerRadius, rink.width / 2, rink.height / 2));
  const minX = radius;
  const maxX = rink.width - radius;
  const minY = radius;
  const maxY = rink.height - radius;

  // Corner circle centers sit `corner` in from each wall pair.
  const cornerX = position.x < corner ? corner : position.x > rink.width - corner ? rink.width - corner : null;
  const cornerY = position.y < corner ? corner : position.y > rink.height - corner ? rink.height - corner : null;

  if (cornerX !== null && cornerY !== null) {
    // Inside a corner quadrant: constrain to the corner arc.
    const allowed = corner - radius;
    const offsetX = position.x - cornerX;
    const offsetY = position.y - cornerY;
    const distance = Math.hypot(offsetX, offsetY);

    if (distance <= allowed || distance === 0) {
      return null;
    }

    const normal = { x: -offsetX / distance, y: -offsetY / distance };
    position.x = cornerX - normal.x * allowed;
    position.y = cornerY - normal.y * allowed;
    return reflect(velocity, normal, restitution, tangentialRetention);
  }

  // Straight walls. A double violation (x and y at once) always falls in a
  // corner quadrant and was handled above, so at most one axis clamps here.
  if (position.x < minX) {
    position.x = minX;
    return reflect(velocity, { x: 1, y: 0 }, restitution, tangentialRetention);
  }

  if (position.x > maxX) {
    position.x = maxX;
    return reflect(velocity, { x: -1, y: 0 }, restitution, tangentialRetention);
  }

  if (position.y < minY) {
    position.y = minY;
    return reflect(velocity, { x: 0, y: 1 }, restitution, tangentialRetention);
  }

  if (position.y > maxY) {
    position.y = maxY;
    return reflect(velocity, { x: 0, y: -1 }, restitution, tangentialRetention);
  }

  return null;
}

function reflect(
  velocity: Vec2,
  normal: Vec2,
  restitution: number,
  tangentialRetention: number
): BoardContact {
  const outward = dot(velocity, normal);

  // Decompose into normal + tangential components; only reflect when moving
  // into the wall (outward component negative along the inward normal).
  const normalVelX = normal.x * outward;
  const normalVelY = normal.y * outward;
  const tangentVelX = velocity.x - normalVelX;
  const tangentVelY = velocity.y - normalVelY;

  if (outward < 0) {
    velocity.x = -normalVelX * restitution + tangentVelX * tangentialRetention;
    velocity.y = -normalVelY * restitution + tangentVelY * tangentialRetention;
  } else {
    velocity.x = normalVelX + tangentVelX * tangentialRetention;
    velocity.y = normalVelY + tangentVelY * tangentialRetention;
  }

  return { normal };
}
