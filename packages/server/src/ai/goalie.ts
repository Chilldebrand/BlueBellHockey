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

/** Goalie bot: hug the goal line, track the puck's Z, clear it when it gets close. */
export function goalieInput(world: WorldState, s: SkaterState): InputState {
  const input = neutralInput();
  const actions = emptyActions();
  const goalX = defendingGoalX(s.team);
  const puck = world.puck;

  const targetZ = Math.max(-RINK.goalWidth / 2 - 0.5, Math.min(RINK.goalWidth / 2 + 0.5, puck.pos.z));
  const target = { x: goalX + (s.team === 0 ? 1.2 : -1.2), z: targetZ };
  input.move = v.norm(v.sub(target, s.pos));

  // aim away from own net
  input.aim = { x: s.team === 0 ? 1 : -1, z: 0 };

  if (puck.carrier === s.id || v.dist(puck.pos, s.pos) < 2) {
    actions.shoot = true; // clear it
  }
  input.actions = actions;
  return input;
}
