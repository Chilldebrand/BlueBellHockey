import { PUCK_RADIUS, RINK } from '../config/rink.js';
import type { Team, Vec2 } from './types.js';

export const v = {
  add: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z }),
  sub: (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z }),
  scale: (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s }),
  len: (a: Vec2): number => Math.hypot(a.x, a.z),
  len2: (a: Vec2): number => a.x * a.x + a.z * a.z,
  dist: (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z),
  norm: (a: Vec2): Vec2 => {
    const l = Math.hypot(a.x, a.z);
    return l > 1e-6 ? { x: a.x / l, z: a.z / l } : { x: 0, z: 0 };
  },
  dot: (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z,
  angle: (a: Vec2): number => Math.atan2(a.z, a.x),
  fromAngle: (r: number, m = 1): Vec2 => ({ x: Math.cos(r) * m, z: Math.sin(r) * m }),
};

function clampToBox(p: Vec2, hx: number, hz: number): Vec2 {
  return {
    x: Math.max(-hx, Math.min(hx, p.x)),
    z: Math.max(-hz, Math.min(hz, p.z)),
  };
}

export interface NetVolume {
  team: Team;
  sign: 1 | -1;
  goalLineX: number;
  backX: number;
  xLo: number;
  xHi: number;
  halfWidth: number;
  mouthHalfWidthForPuck: number;
}

export function netVolumeForTeam(team: Team, puckRadius = PUCK_RADIUS): NetVolume {
  const sign = team === 0 ? 1 : -1;
  const goalLineX = sign * RINK.goalLineX;
  const backX = goalLineX + sign * RINK.goalDepth;
  return {
    team,
    sign,
    goalLineX,
    backX,
    xLo: Math.min(goalLineX, backX),
    xHi: Math.max(goalLineX, backX),
    halfWidth: RINK.goalWidth / 2,
    mouthHalfWidthForPuck: RINK.goalWidth / 2 - puckRadius,
  };
}

export function isPuckFullyAcrossGoalLine(
  team: Team,
  pos: Vec2,
  puckRadius = PUCK_RADIUS,
): boolean {
  const net = netVolumeForTeam(team, puckRadius);
  return net.sign * (pos.x - net.goalLineX) >= puckRadius;
}

export function isPuckCenterInNetVolume(
  team: Team,
  pos: Vec2,
  puckRadius = PUCK_RADIUS,
): boolean {
  const net = netVolumeForTeam(team, puckRadius);
  return (
    pos.x >= net.xLo + puckRadius &&
    pos.x <= net.xHi - puckRadius &&
    Math.abs(pos.z) <= net.mouthHalfWidthForPuck
  );
}

export function sweptFrontMouthEntry(
  team: Team,
  prev: Vec2,
  next: Vec2,
  puckRadius = PUCK_RADIUS,
): boolean {
  const net = netVolumeForTeam(team, puckRadius);
  const scoringX = net.goalLineX + net.sign * puckRadius;
  const prevSide = net.sign * (prev.x - scoringX);
  const nextSide = net.sign * (next.x - scoringX);
  if (prevSide >= 0 || nextSide < 0) return false;
  const dx = next.x - prev.x;
  if (Math.abs(dx) < 1e-6) return false;
  const t = (scoringX - prev.x) / dx;
  if (t < 0 || t > 1) return false;
  const zAtScoringPlane = prev.z + (next.z - prev.z) * t;
  return Math.abs(zAtScoringPlane) <= net.mouthHalfWidthForPuck;
}

export function sweptGoalLineMouthEntry(
  team: Team,
  prev: Vec2,
  next: Vec2,
  puckRadius = PUCK_RADIUS,
): boolean {
  const net = netVolumeForTeam(team, puckRadius);
  const prevSide = net.sign * (prev.x - net.goalLineX);
  const nextSide = net.sign * (next.x - net.goalLineX);
  if (prevSide >= 0 || nextSide < 0) return false;
  const dx = next.x - prev.x;
  if (Math.abs(dx) < 1e-6) return false;
  const t = (net.goalLineX - prev.x) / dx;
  if (t < 0 || t > 1) return false;
  const zAtGoalLine = prev.z + (next.z - prev.z) * t;
  return Math.abs(zAtGoalLine) <= net.mouthHalfWidthForPuck;
}

/**
 * The rink interior is the set of points within `cornerRadius` of the inner box
 * (half extents halfLength-r, halfWidth-r). Keeps `pos` for a circle of `radius`
 * inside, reflecting `vel` off the boards with `restitution`. Mutates and returns.
 */
export function containCircle(
  pos: Vec2,
  vel: Vec2,
  radius: number,
  restitution: number,
): boolean {
  const r = RINK.cornerRadius;
  const hx = RINK.halfLength - r;
  const hz = RINK.halfWidth - r;
  const c = clampToBox(pos, hx, hz);
  const off = { x: pos.x - c.x, z: pos.z - c.z };
  const d = Math.hypot(off.x, off.z);
  const maxD = r - radius;
  if (d <= maxD) return false;
  const n = d > 1e-6 ? { x: off.x / d, z: off.z / d } : { x: 1, z: 0 };
  // push back to boundary
  pos.x = c.x + n.x * maxD;
  pos.z = c.z + n.z * maxD;
  // reflect velocity component along the inward normal (-n)
  const vn = vel.x * n.x + vel.z * n.z;
  if (vn > 0) {
    vel.x -= (1 + restitution) * vn * n.x;
    vel.z -= (1 + restitution) * vn * n.z;
    return true; // a real board bounce (velocity was reflected)
  }
  return false;
}

// A thin, two-sided reflective wall: a segment perpendicular to `axis` at world
// coordinate `wall`, spanning [lo, hi] along the other axis (`span`). Reflects a
// circle of `radius` that is within the span and *closing* on the plane. Mutates
// pos/vel. Used to build the goal nets out of three barriers.
function thinWall(
  pos: Vec2,
  vel: Vec2,
  radius: number,
  restitution: number,
  axis: 'x' | 'z',
  wall: number,
  span: 'x' | 'z',
  lo: number,
  hi: number,
): void {
  if (pos[span] < lo - radius || pos[span] > hi + radius) return;
  const dist = pos[axis] - wall;
  if (Math.abs(dist) >= radius) return;
  if (dist * vel[axis] >= 0) return; // moving away or parallel — not closing
  pos[axis] = wall + (dist >= 0 ? radius : -radius);
  vel[axis] = -vel[axis] * restitution;
}

function collidePost(
  pos: Vec2,
  vel: Vec2,
  radius: number,
  restitution: number,
  post: Vec2,
  prevPos?: Vec2,
): boolean {
  const postRadius = 0.12;
  const minD = radius + postRadius;
  let hit = false;
  if (prevPos) {
    const sweep = v.sub(pos, prevPos);
    const l2 = v.len2(sweep);
    if (l2 > 1e-9) {
      const t = Math.max(0, Math.min(1, v.dot(v.sub(post, prevPos), sweep) / l2));
      const closest = { x: prevPos.x + sweep.x * t, z: prevPos.z + sweep.z * t };
      hit = v.dist(closest, post) < minD;
    }
  }
  const off = v.sub(pos, post);
  const d = v.len(off);
  if (!hit && d >= minD) return false;
  const postSide = Math.sign(post.z);
  const outsideMouth = postSide !== 0 && postSide * pos.z > RINK.goalWidth / 2 - radius;
  const n = outsideMouth
    ? { x: 0, z: postSide }
    : d > 1e-6
      ? v.scale(off, 1 / d)
      : v.norm(v.sub(pos, prevPos ?? post));
  if (v.len2(n) < 1e-9) return false;
  pos.x = post.x + n.x * minD;
  pos.z = post.z + n.z * minD;
  const vn = v.dot(vel, n);
  vel.x -= (1 + restitution) * vn * n.x;
  vel.z -= (1 + restitution) * vn * n.z;
  return true;
}

/**
 * Net collision (WO-18). Each goal is a solid back wall + two side walls with the
 * mouth left open toward center, so a loose puck can only get inside from the
 * front. Together with world.ts's inward-crossing goal test this is what stops
 * "scoring from behind the net" and keeps a shot rattling in instead of sailing
 * through the twine. Mutates pos/vel for a circle of `radius`.
 */
export function collideNets(
  pos: Vec2,
  vel: Vec2,
  radius: number,
  restitution: number,
  prevPos?: Vec2,
): boolean {
  let postHit = false;
  const hw = RINK.goalWidth / 2;
  for (const sign of [1, -1] as const) {
    const gx = sign * RINK.goalLineX; // mouth plane (front of the net)
    const xBack = gx + sign * RINK.goalDepth; // back wall, outward toward the end boards
    const xLo = Math.min(gx, xBack);
    const xHi = Math.max(gx, xBack);
    // back wall, across the mouth width
    thinWall(pos, vel, radius, restitution, 'x', xBack, 'z', -hw, hw);
    // side walls, from the mouth back to the back wall
    thinWall(pos, vel, radius, restitution, 'z', hw, 'x', xLo, xHi);
    thinWall(pos, vel, radius, restitution, 'z', -hw, 'x', xLo, xHi);
    postHit = collidePost(pos, vel, radius, restitution, { x: gx, z: hw }, prevPos) || postHit;
    postHit = collidePost(pos, vel, radius, restitution, { x: gx, z: -hw }, prevPos) || postHit;
  }
  return postHit;
}

function sweptWall(
  pos: Vec2,
  vel: Vec2,
  radius: number,
  restitution: number,
  axis: 'x' | 'z',
  wall: number,
  span: 'x' | 'z',
  lo: number,
  hi: number,
  prevPos?: Vec2,
): boolean {
  const prev = prevPos ?? pos;
  const prevDist = prev[axis] - wall;
  const dist = pos[axis] - wall;
  const crossed = prevDist * dist <= 0 && Math.abs(prevDist - dist) > 1e-6;
  if (Math.abs(dist) >= radius && !crossed) return false;

  let spanAtWall = pos[span];
  if (crossed) {
    const t = Math.max(0, Math.min(1, prevDist / (prevDist - dist)));
    spanAtWall = prev[span] + (pos[span] - prev[span]) * t;
  }
  if (spanAtWall < lo - radius || spanAtWall > hi + radius) return false;

  const side = Math.sign(prevDist) || Math.sign(dist) || 1;
  pos[axis] = wall + side * radius;
  const vn = vel[axis] * side;
  if (vn < 0) vel[axis] -= (1 + restitution) * vn * side;
  return true;
}

/**
 * Skaters can enter the open mouth, but the back wall, side netting, and posts
 * are solid so they cannot pass through the physical net.
 */
export function collideSkaterWithNets(
  pos: Vec2,
  vel: Vec2,
  radius: number,
  restitution: number,
  prevPos?: Vec2,
): boolean {
  let hit = false;
  const hw = RINK.goalWidth / 2;
  for (const sign of [1, -1] as const) {
    const gx = sign * RINK.goalLineX;
    const xBack = gx + sign * RINK.goalDepth;
    const xLo = Math.min(gx, xBack);
    const xHi = Math.max(gx, xBack);
    hit = sweptWall(pos, vel, radius, restitution, 'x', xBack, 'z', -hw, hw, prevPos) || hit;
    hit = sweptWall(pos, vel, radius, restitution, 'z', hw, 'x', xLo, xHi, prevPos) || hit;
    hit = sweptWall(pos, vel, radius, restitution, 'z', -hw, 'x', xLo, xHi, prevPos) || hit;
    hit = collidePost(pos, vel, radius, restitution, { x: gx, z: hw }, prevPos) || hit;
    hit = collidePost(pos, vel, radius, restitution, { x: gx, z: -hw }, prevPos) || hit;
  }
  return hit;
}

/** Resolve overlap between two circles by pushing them apart equally. */
export function resolveCircles(
  a: Vec2,
  b: Vec2,
  ra: number,
  rb: number,
): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = ra + rb;
  if (d >= min || d < 1e-6) return d < min;
  const overlap = (min - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  a.x -= nx * overlap;
  a.z -= nz * overlap;
  b.x += nx * overlap;
  b.z += nz * overlap;
  return true;
}
