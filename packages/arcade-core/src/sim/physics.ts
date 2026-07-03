import type { Vec2 } from "./types.js";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function magnitude(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

export function normalizeOrZero(vector: Vec2): Vec2 {
  const length = magnitude(vector);

  if (length <= 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

export function clampMagnitude(vector: Vec2, maxLength: number): Vec2 {
  const length = magnitude(vector);

  if (length <= maxLength || length <= 0) {
    return vector;
  }

  const scale = maxLength / length;
  return {
    x: vector.x * scale,
    y: vector.y * scale
  };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function fromAngle(radians: number, length = 1): Vec2 {
  return {
    x: Math.cos(radians) * length,
    y: Math.sin(radians) * length
  };
}

export function angleOf(vector: Vec2): number {
  return Math.atan2(vector.y, vector.x);
}

/** Rotate a vector by the given angle (counter-clockwise in sim plane). */
export function rotate(vector: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: vector.x * cos - vector.y * sin,
    y: vector.x * sin + vector.y * cos
  };
}

/** Signed shortest angular difference from `from` to `to`, in (-π, π]. */
export function angleDifference(from: number, to: number): number {
  const tau = Math.PI * 2;
  let delta = (to - from) % tau;

  if (delta > Math.PI) {
    delta -= tau;
  } else if (delta <= -Math.PI) {
    delta += tau;
  }

  return delta;
}

/** Turn `from` toward `to` along the shortest arc, capped at maxDelta ≥ 0. */
export function turnToward(from: number, to: number, maxDelta: number): number {
  const delta = angleDifference(from, to);

  return from + clamp(delta, -maxDelta, maxDelta);
}

/**
 * Framerate-independent exponential damping factor: multiplying a velocity by
 * expDecay(rate, dt) each step decays it identically no matter how dt is
 * sliced (unlike `1 - rate * dt`, which is dt-dependent and can go negative).
 */
export function expDecay(ratePerSecond: number, dtSeconds: number): number {
  return Math.exp(-ratePerSecond * dtSeconds);
}
