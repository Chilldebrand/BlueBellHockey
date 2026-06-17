import {
  RINK,
  defendingGoalX,
  emptyActions,
  neutralInput,
  v,
  type InputState,
  type SkaterState,
  type WorldState,
} from '@bbh/shared';

// Goalie bot: hug the goal line tracking the puck's Z, step out to challenge when
// the puck gets close, and clear it only when it's right on the doorstep.
export function goalieInput(world: WorldState, s: SkaterState): InputState {
  const input = neutralInput();
  const actions = emptyActions();
  const goalX = defendingGoalX(s.team);
  const puck = world.puck;
  const inward = s.team === 0 ? 1 : -1;

  const distToPuck = v.dist(puck.pos, s.pos);
  // challenge depth: come out up to ~3 units as the puck approaches
  const challenge = Math.max(0, 3 - Math.abs(puck.pos.x - goalX) * 0.12);
  const targetZ = Math.max(-RINK.goalWidth / 2 - 0.6, Math.min(RINK.goalWidth / 2 + 0.6, puck.pos.z));
  const target = { x: goalX + inward * (1 + challenge), z: targetZ };
  input.move = v.norm(v.sub(target, s.pos));
  input.aim = { x: inward, z: 0 }; // clear up-ice

  if (puck.carrier === s.id || distToPuck < 1.4) actions.shoot = true;
  input.actions = actions;
  return input;
}
