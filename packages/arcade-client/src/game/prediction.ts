import {
  MATCH_CONFIG,
  stepWorld,
  type InputFrame,
  type SkaterEntity,
  type WorldState
} from "@bbh/arcade-core";

export function predictControlledSkater(
  world: WorldState | null,
  slotId: string | null,
  input: InputFrame | null,
  dtMs = MATCH_CONFIG.fixedTickMs
): SkaterEntity | null {
  if (!world || !slotId || !input) {
    return null;
  }

  const predictedWorld = cloneWorld(world);
  stepWorld(predictedWorld, [input], dtMs);

  return (
    predictedWorld.skaters.find((skater) => skater.id === slotId) ?? null
  );
}

function cloneWorld(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}
