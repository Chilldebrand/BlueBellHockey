/**
 * Layout for the retro fibreglass goalie mask — the moulded shell with drilled
 * ventilation holes and painted chevrons that goalies wore before cage-and-
 * helmet combos took over.
 *
 * Everything here is in FACE SPACE: origin at the middle of the mask, +x to
 * the mask's right, +y up, and radius 1 at the outer edge. Pure data + pure
 * math, so the layout is testable without a canvas or a WebGL context; the
 * texture itself is painted from it in GoalieModel.
 */

export interface MaskHole {
  readonly x: number;
  readonly y: number;
  /** Radius in face-space units. */
  readonly r: number;
  /** Vertical stretch — real vents are ovals, not circles. */
  readonly stretch: number;
}

/** Painted marking, as a closed polygon in face space. */
export type MaskChevron = readonly (readonly [number, number])[];

/**
 * Deterministic integer mixer, same shape as the crowd's. Keeps the scattered
 * vents identical every run without reaching for Math.random (which the rest
 * of this codebase bans on principle).
 */
function mix(index: number, salt: number): number {
  let h = Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 0x100000000;
}

/** The two eye openings — by far the largest holes, and the ones that read. */
export const MASK_EYES: readonly MaskHole[] = [
  { x: -0.3, y: 0.16, r: 0.135, stretch: 1.05 },
  { x: 0.3, y: 0.16, r: 0.135, stretch: 1.05 }
];

/**
 * Scattered ventilation holes. Laid out in rings so they follow the curve of
 * the shell rather than sitting in a grid, skipping anything that would
 * collide with an eye or run off the edge.
 */
export function buildMaskVents(): MaskHole[] {
  const vents: MaskHole[] = [];

  // Forehead and cheek field: concentric rings of small ovals.
  for (let ring = 0; ring < 5; ring += 1) {
    const radius = 0.36 + ring * 0.14;
    const count = 8 + ring * 4;
    for (let i = 0; i < count; i += 1) {
      const index = ring * 64 + i;
      const angle = (i / count) * Math.PI * 2 + mix(index, 1) * 0.22;
      const jitter = 0.94 + mix(index, 2) * 0.12;
      const x = Math.cos(angle) * radius * jitter;
      const y = Math.sin(angle) * radius * jitter * 1.12;

      const r = 0.028 + mix(index, 3) * 0.022;
      const stretch = 1 + mix(index, 4) * 0.8;

      // Contain the whole OVAL, not just its centre — a tall vent near the
      // rim would otherwise spill off the edge of the shell.
      if (Math.hypot(x, y) + r * stretch > 0.94) {
        continue;
      }
      if (MASK_EYES.some((eye) => Math.hypot(x - eye.x, y - eye.y) < eye.r + 0.07)) {
        continue;
      }
      // Keep the nose ridge and mouth band clear; they get their own holes.
      if (Math.abs(x) < 0.1 && y < 0.05 && y > -0.42) {
        continue;
      }

      vents.push({ x, y, r, stretch });
    }
  }

  // Nostril pair and the mouth band under it.
  vents.push({ x: -0.055, y: -0.2, r: 0.03, stretch: 1.5 });
  vents.push({ x: 0.055, y: -0.2, r: 0.03, stretch: 1.5 });
  for (let i = 0; i < 5; i += 1) {
    vents.push({
      x: -0.24 + i * 0.12,
      y: -0.5 - Math.abs(i - 2) * 0.03,
      r: 0.035,
      stretch: 1.35
    });
  }

  return vents;
}

/**
 * Painted chevrons: the brow "V" over each eye plus a slash down each cheek.
 * Mirrored across the centre line so the mask reads symmetrical.
 */
export const MASK_CHEVRONS: readonly MaskChevron[] = [
  // Brow V, left half then mirrored right half.
  [
    [-0.52, 0.42],
    [-0.06, 0.28],
    [-0.06, 0.19],
    [-0.54, 0.33]
  ],
  [
    [0.52, 0.42],
    [0.06, 0.28],
    [0.06, 0.19],
    [0.54, 0.33]
  ],
  // Cheek slashes running down and out from beside the nose.
  [
    [-0.16, -0.06],
    [-0.44, -0.52],
    [-0.3, -0.56],
    [-0.1, -0.16]
  ],
  [
    [0.16, -0.06],
    [0.44, -0.52],
    [0.3, -0.56],
    [0.1, -0.16]
  ]
];

/**
 * Face space -> the UV layout of a sphere cap.
 *
 * The shell is a spherical cap, so three.js hands it POLAR uvs: u runs around
 * the cap and v runs outward from the pole. Painting a face into that directly
 * would be unreadable, so the texture is authored in ordinary face space and
 * remapped through this.
 *
 * Returns u,v in 0..1. A point at the centre of the face lands on the pole
 * (v = 0) and the outer edge lands at v = 1.
 */
export function faceToMaskUv(
  x: number,
  y: number
): { readonly u: number; readonly v: number } {
  const angle = Math.atan2(y, x);

  return {
    u: (angle / (Math.PI * 2) + 1) % 1,
    v: Math.min(1, Math.hypot(x, y))
  };
}

/** Inverse of `faceToMaskUv`, for painting the texture pixel by pixel. */
export function maskUvToFace(
  u: number,
  v: number
): { readonly x: number; readonly y: number } {
  const angle = u * Math.PI * 2;

  return { x: Math.cos(angle) * v, y: Math.sin(angle) * v };
}
