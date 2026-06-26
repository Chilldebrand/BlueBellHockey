import {
  BASE_SPEED,
  SLAP_COMMIT_MS,
  SPEED_PER_POINT,
  SPRINT_MULT,
  carryAnchor,
  getCharacter,
  v,
  type InputState,
} from '@bbh/shared';
import type { Snapshot } from '../net/client.js';
import type { SkaterRender } from './interpolation.js';

// Lightweight local prediction: render the controlled skater at the latest
// authoritative position advanced by the current input, then smooth toward the
// server. Avoids the input-lag of pure interpolation without full input replay.
// Movement constants are imported from shared so prediction tracks the sim's feel.
export interface PredictedPose {
  id: string;
  x: number;
  z: number;
  facing: number;
}

export function predictLocal(
  buffer: Snapshot[],
  localId: string,
  input: InputState,
  dt: number,
  prev: PredictedPose | null,
): PredictedPose | null {
  if (buffer.length === 0) return prev;
  const latest = buffer[buffer.length - 1];
  const s = latest.skaters[localId];
  if (!s) return prev?.id === localId ? prev : null;

  const carrying = latest.puck.carrier === localId;
  const disabled = s.frozenUntil > latest.serverTime || s.staggeredUntil > latest.serverTime;
  const windupGlide =
    s.shootChargeStart > 0 && carrying && !disabled
      ? { x: s.shootGlideDirX, z: s.shootGlideDirZ }
      : null;
  const move = windupGlide && v.len(windupGlide) > 0.05 ? windupGlide : input.move;
  const moveLen = v.len(move);
  let maxSpeed = BASE_SPEED + getCharacter(s.characterId).attrs.speed * SPEED_PER_POINT;
  if (!windupGlide && input.actions.sprint) maxSpeed *= SPRINT_MULT;
  if (carrying) maxSpeed *= 0.92;
  if (s.shootChargeStart > 0 && latest.serverTime - s.shootChargeStart > SLAP_COMMIT_MS) maxSpeed *= 0.6;

  // start from previous predicted pos (or server pos), reconcile toward server
  const base = prev?.id === localId ? prev : { id: localId, x: s.px, z: s.pz, facing: s.facing };
  let x = base.x + (s.px - base.x) * Math.min(1, 8 * dt); // reconcile
  let z = base.z + (s.pz - base.z) * Math.min(1, 8 * dt);
  let facing = base.facing;

  if (moveLen > 0.05) {
    const dir = v.norm(move);
    x += dir.x * maxSpeed * dt;
    z += dir.z * maxSpeed * dt;
    facing = Math.atan2(dir.z, dir.x);
  } else if (v.len(input.aim) > 0.1) {
    facing = Math.atan2(input.aim.z, input.aim.x);
  }
  return { id: localId, x, z, facing };
}

/**
 * When the local player carries the puck, place the puck from the *predicted*
 * carrier pose using the same shared `carryAnchor` the sim runs — including the
 * deke offset (synced via the snapshot). This removes carry/dangle lag and keeps
 * the local puck from snapping during a deke (it never disagrees with the server's
 * own carry math). Returns null when the local player isn't the carrier.
 */
export function predictCarriedPuck(
  buffer: Snapshot[],
  localId: string,
  predicted: PredictedPose | null,
): { x: number; z: number; y: number } | null {
  if (!predicted || buffer.length === 0) return null;
  const latest = buffer[buffer.length - 1];
  if (latest.puck.carrier !== localId) return null;
  const s = latest.skaters[localId];
  if (!s) return null;
  // advance sim-time from the latest snapshot by the real elapsed since we got it,
  // so the deke envelope is evaluated at roughly the current authoritative time.
  const time = latest.serverTime + (performance.now() - latest.t);
  const anchor = carryAnchor(
    { x: predicted.x, z: predicted.z },
    predicted.facing,
    { dekeUntil: s.dekeUntil, dekeDirX: s.dekeDirX, dekeDirZ: s.dekeDirZ },
    time,
  );
  return { ...anchor, y: 0 };
}

export function applyPrediction(
  skaters: SkaterRender[],
  localId: string,
  predicted: PredictedPose | null,
): void {
  if (!predicted || predicted.id !== localId) return;
  const me = skaters.find((s) => s.id === localId);
  if (me) {
    me.x = predicted.x;
    me.z = predicted.z;
    me.facing = predicted.facing;
  }
}
