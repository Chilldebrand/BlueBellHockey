import { RINK } from '../config/rink.js';
import type { Vec2 } from './types.js';

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
