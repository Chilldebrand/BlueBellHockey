import { getCharacter, v, type InputState } from '@bbh/shared';
import type { Snapshot } from '../net/client.js';
import type { SkaterRender } from './interpolation.js';

// Lightweight local prediction: render the controlled skater at the latest
// authoritative position advanced by the current input, then smooth toward the
// server. Avoids the input-lag of pure interpolation without full input replay.
const BASE_SPEED = 6;
const SPEED_PER_POINT = 0.8;

export function predictLocal(
  buffer: Snapshot[],
  localId: string,
  input: InputState,
  dt: number,
  prev: { x: number; z: number; facing: number } | null,
): { x: number; z: number; facing: number } | null {
  if (buffer.length === 0) return prev;
  const latest = buffer[buffer.length - 1];
  const s = latest.skaters[localId];
  if (!s) return prev;

  const maxSpeed = BASE_SPEED + getCharacter(s.characterId).attrs.speed * SPEED_PER_POINT;
  const moveLen = v.len(input.move);

  // start from previous predicted pos (or server pos), reconcile toward server
  const base = prev ?? { x: s.px, z: s.pz, facing: s.facing };
  let x = base.x + (s.px - base.x) * Math.min(1, 8 * dt); // reconcile
  let z = base.z + (s.pz - base.z) * Math.min(1, 8 * dt);
  let facing = base.facing;

  if (moveLen > 0.05) {
    const dir = v.norm(input.move);
    x += dir.x * maxSpeed * dt;
    z += dir.z * maxSpeed * dt;
    facing = Math.atan2(dir.z, dir.x);
  } else if (v.len(input.aim) > 0.1) {
    facing = Math.atan2(input.aim.z, input.aim.x);
  }
  return { x, z, facing };
}

export function applyPrediction(
  skaters: SkaterRender[],
  localId: string,
  predicted: { x: number; z: number; facing: number } | null,
): void {
  if (!predicted) return;
  const me = skaters.find((s) => s.id === localId);
  if (me) {
    me.x = predicted.x;
    me.z = predicted.z;
    me.facing = predicted.facing;
  }
}
