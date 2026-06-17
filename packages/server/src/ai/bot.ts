import {
  attackingGoalX,
  emptyActions,
  neutralInput,
  v,
  type InputState,
  type SkaterState,
  type WorldState,
} from '@bbh/shared';

/** Simple field-player bot: chase the puck, attack the net, defend the carrier. */
export function botInput(world: WorldState, s: SkaterState): InputState {
  const input = neutralInput();
  const actions = emptyActions();
  const puck = world.puck;
  const netX = attackingGoalX(s.team);
  const net = { x: netX, z: 0 };

  if (puck.carrier === s.id) {
    // carry toward the net, shoot when close, pass if pressured
    const toNet = v.sub(net, s.pos);
    input.move = v.norm(toNet);
    input.aim = v.norm(toNet);
    const dist = v.len(toNet);
    if (dist < 12) actions.shoot = true;
    const opp = nearestOpponent(world, s);
    if (opp && v.dist(opp.pos, s.pos) < 2.5 && Math.random() < 0.5) actions.pass = true;
  } else if (puck.carrier && world.skaters[puck.carrier]?.team !== s.team) {
    // defend: skate at carrier, steal/hit when close
    const carrier = world.skaters[puck.carrier];
    input.move = v.norm(v.sub(carrier.pos, s.pos));
    input.aim = input.move;
    const d = v.dist(carrier.pos, s.pos);
    if (d < 2.2) {
      actions.steal = true;
      if (Math.random() < 0.4) actions.hit = true;
    }
  } else {
    // loose puck: go get it
    input.move = v.norm(v.sub(puck.pos, s.pos));
    input.aim = input.move;
  }

  input.actions = actions;
  return input;
}

function nearestOpponent(world: WorldState, s: SkaterState): SkaterState | null {
  let best: SkaterState | null = null;
  let bestD = Infinity;
  for (const o of Object.values(world.skaters)) {
    if (o.team === s.team) continue;
    const d = v.dist(o.pos, s.pos);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}
