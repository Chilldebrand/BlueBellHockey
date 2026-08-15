import type { SkaterEntity, Vec2, WorldState } from "@bbh/arcade-core";
import type { SnapshotSample } from "./snapshotBuffer.js";

export interface InterpolatedSkater {
  readonly id: string;
  readonly teamId: SkaterEntity["teamId"];
  readonly characterId: SkaterEntity["characterId"];
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly facing: number;
}

export function interpolateVector(from: Vec2, to: Vec2, alpha: number): Vec2 {
  const t = Math.min(1, Math.max(0, alpha));

  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t
  };
}

/** Interpolate an angle along the shortest arc so facing never spins the long way. */
export function interpolateAngle(from: number, to: number, alpha: number): number {
  const t = Math.min(1, Math.max(0, alpha));
  const tau = Math.PI * 2;
  let delta = (to - from) % tau;

  if (delta > Math.PI) {
    delta -= tau;
  } else if (delta <= -Math.PI) {
    delta += tau;
  }

  return from + delta * t;
}

export function interpolateSkaters(
  previous: WorldState | null,
  current: WorldState,
  alpha: number,
  localSlotId: string | null = null
): readonly InterpolatedSkater[] {
  if (!previous) {
    return current.skaters.map(skaterFromCurrent);
  }

  return current.skaters.map((skater) => {
    const previousSkater = previous.skaters.find(
      (candidate) => candidate.id === skater.id
    );

    if (!previousSkater || skater.id === localSlotId) {
      return skaterFromCurrent(skater);
    }

    return {
      id: skater.id,
      teamId: skater.teamId,
      characterId: skater.characterId,
      position: interpolateVector(previousSkater.position, skater.position, alpha),
      velocity: interpolateVector(previousSkater.velocity, skater.velocity, alpha),
      facing: interpolateAngle(previousSkater.facing, skater.facing, alpha)
    };
  });
}

/**
 * One remote skater's position at the buffered render time (see snapshotBuffer.ts).
 *
 * Split out from interpolateSkaters because the renderer calls this per skater PER FRAME, from
 * inside a useFrame loop, while interpolateSkaters runs once per React render over the whole roster.
 * Returns null when the skater isn't in the sampled world — it left, or hasn't spawned yet — and the
 * caller should leave the object wherever it was rather than snapping it to the origin.
 */
export function interpolateSkaterPosition(
  sample: SnapshotSample | null,
  id: string
): Vec2 | null {
  if (!sample) {
    return null;
  }

  const current = sample.current.skaters.find((skater) => skater.id === id);

  if (!current) {
    return null;
  }

  const previous = sample.previous?.skaters.find((skater) => skater.id === id);

  if (!previous) {
    return current.position;
  }

  return interpolateVector(previous.position, current.position, sample.alpha);
}

function skaterFromCurrent(skater: SkaterEntity): InterpolatedSkater {
  return {
    id: skater.id,
    teamId: skater.teamId,
    characterId: skater.characterId,
    position: skater.position,
    velocity: skater.velocity,
    facing: skater.facing
  };
}
