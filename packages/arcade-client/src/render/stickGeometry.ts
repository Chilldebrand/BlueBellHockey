/**
 * Shared blockout-stick math. Both the skater stick and the goalie stick are
 * built from the same primitives (shaft segment, rounded heel, swept flat
 * blade) so a goalie stick reads as the same object, only heavier.
 *
 * Pure module — no JSX, no React — so the geometry is unit-testable without a
 * WebGL canvas.
 */

import { Euler, Quaternion, Vector3 } from "three";

export type Point3 = readonly [number, number, number];

/** Box geometry is authored along +Y, so segments rotate that axis onto the run. */
const SEGMENT_UP = new Vector3(0, 1, 0);

export interface Segment {
  readonly position: [number, number, number];
  readonly rotation: [number, number, number];
  readonly length: number;
}

/**
 * Position/rotation/length for a box spanning `from` to `to`. Length is
 * returned rather than baked in so the caller can size the box's cross
 * section independently.
 */
export function segmentBetween(from: Point3, to: Point3): Segment {
  const a = new Vector3(from[0], from[1], from[2]);
  const b = new Vector3(to[0], to[1], to[2]);
  const dir = new Vector3().subVectors(b, a);
  const length = dir.length() || 0.0001;
  const mid = new Vector3().addVectors(a, b).multiplyScalar(0.5);
  const quat = new Quaternion().setFromUnitVectors(
    SEGMENT_UP,
    dir.clone().normalize()
  );
  const euler = new Euler().setFromQuaternion(quat);

  return {
    position: [mid.x, mid.y, mid.z],
    rotation: [euler.x, euler.y, euler.z],
    length
  };
}

export function lerp3(a: Point3, b: Point3, t: number): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

/**
 * Clamp a grip's position ALONG THE SHAFT so the hand never slides behind the
 * chest, keeping the arms reaching forward.
 *
 * Hands ride the butt->blade line, so when the blade is drawn back the raw
 * fractions drag both hands behind the shoulders and the arms read as swinging
 * backwards. Clamping the fraction (rather than the resulting point) keeps
 * butt, hands and blade collinear: the hands simply choke up toward the butt
 * as the blade goes back, which is what a player does anyway.
 *
 * `minForward` is in the same frame as the coordinates, with the shoulders at
 * 0, so any positive value puts the hands in front of the chest.
 */
export function frontGripT(
  buttForward: number,
  bladeForward: number,
  t: number,
  minForward: number
): number {
  if (bladeForward >= minForward) {
    // The whole shaft is already in front; nothing to clamp.
    return t;
  }

  const span = bladeForward - buttForward;
  if (span === 0) {
    return 0;
  }

  return Math.max(0, Math.min(t, (minForward - buttForward) / span));
}
