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
