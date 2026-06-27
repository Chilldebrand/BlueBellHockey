import type { SkaterEntity, Vec2, WorldState } from "@bbh/arcade-core";

export interface InterpolatedSkater {
  readonly id: string;
  readonly teamId: SkaterEntity["teamId"];
  readonly position: Vec2;
  readonly velocity: Vec2;
}

export function interpolateVector(from: Vec2, to: Vec2, alpha: number): Vec2 {
  const t = Math.min(1, Math.max(0, alpha));

  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t
  };
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
      position: interpolateVector(previousSkater.position, skater.position, alpha),
      velocity: interpolateVector(previousSkater.velocity, skater.velocity, alpha)
    };
  });
}

function skaterFromCurrent(skater: SkaterEntity): InterpolatedSkater {
  return {
    id: skater.id,
    teamId: skater.teamId,
    position: skater.position,
    velocity: skater.velocity
  };
}
