import { MapSchema, Schema, type } from '@colyseus/schema';
import type { SkaterState, WorldState } from '@bbh/shared';

export class SkaterSchema extends Schema {
  @type('string') id = '';
  @type('uint8') team = 0;
  @type('string') characterId = '';
  @type('boolean') isBot = false;
  @type('boolean') isGoalie = false;
  @type('float32') px = 0;
  @type('float32') pz = 0;
  @type('float32') vx = 0;
  @type('float32') vz = 0;
  @type('float32') facing = 0;
  @type('float32') ultCharge = 0;
  @type('float32') ultActiveUntil = 0;
  @type('uint32') ackSeq = 0;
  @type('float32') frozenUntil = 0;
  @type('float32') staggeredUntil = 0;
  @type('float32') intangibleUntil = 0;
  // Deke (WO-03): synced so the client can run the same carry-anchor math during
  // a dangle (otherwise local-carrier prediction would fight reconciliation).
  @type('float32') dekeUntil = 0;
  @type('float32') dekeDirX = 0;
  @type('float32') dekeDirZ = 0;
}

export class PuckSchema extends Schema {
  @type('float32') px = 0;
  @type('float32') pz = 0;
  @type('float32') vx = 0;
  @type('float32') vz = 0;
  @type('string') carrier = '';
}

export class MatchState extends Schema {
  @type('float32') time = 0;
  @type('string') phase = 'lobby';
  @type('uint8') period = 1;
  @type('float32') clock = 0;
  @type('float32') phaseTimer = 0;
  @type('float32') pauseUntil = 0;
  @type('uint8') score0 = 0;
  @type('uint8') score1 = 0;
  @type({ map: SkaterSchema }) skaters = new MapSchema<SkaterSchema>();
  @type(PuckSchema) puck = new PuckSchema();
}

/** Copy the authoritative plain-object world into the networked schema. */
export function syncState(state: MatchState, world: WorldState): void {
  state.time = world.time;
  state.phase = world.phase;
  state.period = world.period;
  state.clock = world.clock;
  state.phaseTimer = world.phaseTimer;
  state.pauseUntil = world.pauseUntil;
  state.score0 = world.score[0];
  state.score1 = world.score[1];

  for (const s of Object.values(world.skaters) as SkaterState[]) {
    let row = state.skaters.get(s.id);
    if (!row) {
      row = new SkaterSchema();
      row.id = s.id;
      state.skaters.set(s.id, row);
    }
    row.team = s.team;
    row.characterId = s.characterId;
    row.isBot = s.isBot;
    row.isGoalie = s.isGoalie;
    row.px = s.pos.x;
    row.pz = s.pos.z;
    row.vx = s.vel.x;
    row.vz = s.vel.z;
    row.facing = s.facing;
    row.ultCharge = s.ultCharge;
    row.ultActiveUntil = s.ultActiveUntil;
    row.frozenUntil = s.status.frozenUntil;
    row.staggeredUntil = s.status.staggeredUntil;
    row.intangibleUntil = s.status.intangibleUntil;
    row.dekeUntil = s.status.dekeUntil;
    row.dekeDirX = s.status.dekeDirX;
    row.dekeDirZ = s.status.dekeDirZ;
  }

  state.puck.px = world.puck.pos.x;
  state.puck.pz = world.puck.pos.z;
  state.puck.vx = world.puck.vel.x;
  state.puck.vz = world.puck.vel.z;
  state.puck.carrier = world.puck.carrier ?? '';
}
