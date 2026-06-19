import { describe, expect, it } from 'vitest';
import {
  GAMEBREAKER_GOAL_VALUE,
  beginCountdown,
  createWorld,
  step,
  type RosterEntry,
} from './world.js';
import { doDeke, doHit, doPass, doPoke, doShoot, doSteal, SLAP_FULL_MS } from './actions.js';
import { carryAnchor, DEKE_MS, STICK_REACH } from './puck.js';
import { emptyActions, neutralInput, type InputState, type WorldState } from './types.js';
import { attackingGoalX } from '../config/rink.js';
import { v } from './physics.js';

/** Launch a loose puck across team 0's attacking line, credited to `scorer`. */
function launchTeam0Goal(w: WorldState, scorer: string): void {
  const gx = attackingGoalX(0);
  w.puck.carrier = null;
  w.puck.lastTouch = scorer;
  w.puck.assistTouch = null;
  w.puck.pos = { x: gx - 1, z: 0 };
  w.puck.vel = { x: 20, z: 0 };
  w.puck.pickupCooldownUntil = w.time + 10000;
}

function roster(): RosterEntry[] {
  return [
    { id: 'a', team: 0, characterId: 'blaze', isBot: false, isGoalie: false },
    { id: 'b', team: 1, characterId: 'tank', isBot: false, isGoalie: false },
  ];
}

const DT = 1000 / 30;

describe('world simulation', () => {
  it('starts in lobby and counts down into a period', () => {
    const w = createWorld(roster());
    expect(w.phase).toBe('lobby');
    beginCountdown(w);
    expect(w.phase).toBe('countdown');
    for (let i = 0; i < 200; i++) step(w, {}, DT);
    expect(w.phase).toBe('period');
  });

  it('a skater can pick up the puck and skate', () => {
    const w = createWorld(roster());
    beginCountdown(w);
    for (let i = 0; i < 200; i++) step(w, {}, DT); // into period
    const a = w.skaters.a;
    const input: InputState = { ...neutralInput(), move: v.norm(v.sub(w.puck.pos, a.pos)) };
    for (let i = 0; i < 120; i++) step(w, { a: input }, DT);
    expect(w.puck.carrier).toBe('a');
  });

  it('a free puck across the goal line scores', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 1, z: 0 };
    w.puck.vel = { x: 20, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;
    const before = w.score[0];
    for (let i = 0; i < 30; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(before + 1);
  });

  it('a check knocks the target back and staggers them (WO-00 feel)', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'tank', isBot: false, isGoalie: false },
      { id: 'b', team: 1, characterId: 'blaze', isBot: false, isGoalie: false },
    ]);
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: 0 };
    a.facing = 0; // facing +X, toward b
    b.pos = { x: 1.4, z: 0 };
    b.vel = { x: 0, z: 0 };
    doHit(w, a, neutralInput());
    expect(b.status.staggeredUntil).toBeGreaterThan(w.time);
    // tank hit=10 → arcade knock magnitude 6 + 10*0.9 = 15 along +X
    expect(b.vel.x).toBeCloseTo(15, 1);
  });

  it('a normal goal scores exactly 1 and leaves the opponent unchanged (WO-02)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.score = [0, 2];
    launchTeam0Goal(w, 'a'); // a is team 0, no active ult
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(1);
    expect(w.score[1]).toBe(2);
  });

  it('a goal with the scorer ult active is a Gamebreaker worth more + steals a point (WO-02)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.score = [0, 3];
    w.skaters.a.ultActiveUntil = w.time + 10000; // a's ult is live
    launchTeam0Goal(w, 'a');
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(GAMEBREAKER_GOAL_VALUE); // +2
    expect(w.score[1]).toBe(2); // 3 - 1 stolen
    const gb = w.events.find((e) => e.type === 'gamebreaker');
    expect(gb).toBeDefined();
    expect(gb && gb.type === 'gamebreaker' && gb.value).toBe(GAMEBREAKER_GOAL_VALUE);
  });

  it('a Gamebreaker never drops the opponent below 0 (uint8 underflow guard, WO-02)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.score = [0, 0]; // opponent already at 0
    w.skaters.a.ultActiveUntil = w.time + 10000;
    launchTeam0Goal(w, 'a');
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(GAMEBREAKER_GOAL_VALUE);
    expect(w.score[1]).toBe(0); // stayed clamped at 0
  });

  it('a Gamebreaker in sudden-death overtime ends the match (WO-02)', () => {
    const w = createWorld(roster());
    w.phase = 'overtime';
    w.period = 4;
    w.clock = 100000;
    w.score = [0, 0];
    w.skaters.a.ultActiveUntil = w.time + 10000;
    launchTeam0Goal(w, 'a');
    for (let i = 0; i < 30 && w.phase === 'overtime'; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(GAMEBREAKER_GOAL_VALUE);
    expect(w.phase).toBe('ended');
  });

  it('freezes the clock during the goal celebration pause', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 1, z: 0 };
    w.puck.vel = { x: 20, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(1);
    expect(w.pauseUntil).toBeGreaterThan(w.time);
    const clockAtGoal = w.clock;
    for (let i = 0; i < 10; i++) step(w, {}, DT); // still within the pause window
    expect(w.clock).toBe(clockAtGoal); // clock did not tick while paused
  });
});

describe('deke / trick system (WO-03)', () => {
  function dekeRoster(): RosterEntry[] {
    return [
      { id: 'a', team: 0, characterId: 'trickster', isBot: false, isGoalie: false }, // steal 9
      { id: 'b', team: 1, characterId: 'sniper', isBot: false, isGoalie: false }, // steal 6
    ];
  }

  it('carryAnchor bends the puck laterally mid-deke and restores it after', () => {
    const start = 1000;
    const dekeUntil = start + DEKE_MS;
    // no deke → puck dead-ahead at stick reach
    const dead = carryAnchor({ x: 0, z: 0 }, 0, { dekeUntil: 0, dekeDirX: 0, dekeDirZ: 0 }, start);
    expect(dead.x).toBeCloseTo(STICK_REACH, 5);
    expect(dead.z).toBeCloseTo(0, 5);
    // peak of the window (facing +X, juke +Z) → bent to the side
    const mid = carryAnchor({ x: 0, z: 0 }, 0, { dekeUntil, dekeDirX: 0, dekeDirZ: 1 }, start + DEKE_MS / 2);
    expect(mid.z).toBeGreaterThan(0.5);
    expect(mid.x).toBeCloseTo(STICK_REACH, 5);
    // after the window → restored dead-ahead
    const after = carryAnchor({ x: 0, z: 0 }, 0, { dekeUntil, dekeDirX: 0, dekeDirZ: 1 }, dekeUntil + 1);
    expect(after.z).toBeCloseTo(0, 5);
  });

  it('deking past a close front defender breaks ankles and pops style', () => {
    const w = createWorld(dekeRoster());
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: 0 };
    a.facing = 0; // facing +X
    b.pos = { x: 1.5, z: 0.2 }; // close, in front
    w.puck.carrier = 'a';
    const before = a.ultCharge;
    doDeke(w, a, { ...neutralInput(), aim: { x: 0, z: 1 } });
    expect(a.status.dekeUntil).toBeGreaterThan(w.time);
    expect(b.status.staggeredUntil).toBeGreaterThan(w.time);
    expect(w.events.some((e) => e.type === 'ankle_break')).toBe(true);
    expect(a.ultCharge).toBeGreaterThan(before);
  });

  it('a deke with no defender in range still dangles and awards a small deke', () => {
    const w = createWorld(dekeRoster());
    w.phase = 'period';
    const a = w.skaters.a;
    a.pos = { x: 0, z: 0 };
    a.facing = 0;
    w.skaters.b.pos = { x: 20, z: 0 }; // far away
    w.puck.carrier = 'a';
    const before = a.ultCharge;
    doDeke(w, a, { ...neutralInput(), aim: { x: 0, z: 1 } });
    expect(w.events.some((e) => e.type === 'deke')).toBe(true);
    expect(w.events.some((e) => e.type === 'ankle_break')).toBe(false);
    expect(a.status.dekeUntil).toBeGreaterThan(w.time);
    expect(a.ultCharge).toBeGreaterThan(before);
  });

  it('a deke on cooldown is a no-op', () => {
    const w = createWorld(dekeRoster());
    w.phase = 'period';
    const a = w.skaters.a;
    w.skaters.b.pos = { x: 20, z: 0 };
    w.puck.carrier = 'a';
    doDeke(w, a, neutralInput()); // arms the cooldown
    w.events = [];
    doDeke(w, a, neutralInput()); // same sim-time → blocked
    expect(w.events.length).toBe(0);
  });

  it('a non-carrier deke is a no-op', () => {
    const w = createWorld(dekeRoster());
    w.phase = 'period';
    const a = w.skaters.a;
    w.puck.carrier = 'b'; // a is not the carrier
    doDeke(w, a, neutralInput());
    expect(a.status.dekeUntil).toBe(0);
    expect(w.events.length).toBe(0);
  });

  it('a stronger defender does not bite (ankle-break is a contest)', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'frost', isBot: false, isGoalie: false }, // steal 5
      { id: 'b', team: 1, characterId: 'pickpocket', isBot: false, isGoalie: false }, // steal 10
    ]);
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: 0 };
    a.facing = 0;
    b.pos = { x: 1.5, z: 0.2 };
    w.puck.carrier = 'a';
    doDeke(w, a, { ...neutralInput(), aim: { x: 0, z: 1 } });
    expect(b.status.staggeredUntil).toBe(0); // out-handled, no break
    expect(w.events.some((e) => e.type === 'ankle_break')).toBe(false);
    expect(w.events.some((e) => e.type === 'deke')).toBe(true);
  });

  it('doDeke is deterministic — identical inputs produce identical outcomes', () => {
    const build = (): WorldState => {
      const w = createWorld(dekeRoster());
      w.phase = 'period';
      w.skaters.a.pos = { x: 0, z: 0 };
      w.skaters.a.facing = 0;
      w.skaters.b.pos = { x: 1.5, z: 0.2 };
      w.puck.carrier = 'a';
      return w;
    };
    const input = { ...neutralInput(), aim: { x: 0, z: 1 } };
    const w1 = build();
    const w2 = build();
    doDeke(w1, w1.skaters.a, input);
    doDeke(w2, w2.skaters.a, input);
    expect(w1.skaters.b.status.staggeredUntil).toBe(w2.skaters.b.status.staggeredUntil);
    expect(w1.skaters.a.status.dekeDirX).toBe(w2.skaters.a.status.dekeDirX);
    expect(w1.skaters.a.status.dekeDirZ).toBe(w2.skaters.a.status.dekeDirZ);
    expect(w1.events.map((e) => e.type)).toEqual(w2.events.map((e) => e.type));
  });
});

describe('combo multiplier integration (WO-04)', () => {
  function trio(): RosterEntry[] {
    return [
      { id: 'a', team: 0, characterId: 'maestro', isBot: false, isGoalie: false }, // passer
      { id: 'c', team: 0, characterId: 'blaze', isBot: false, isGoalie: false }, // teammate
      { id: 'b', team: 1, characterId: 'tank', isBot: false, isGoalie: false },
    ];
  }

  it('getting checked zeroes the carrier combo', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'trickster', isBot: false, isGoalie: false },
      { id: 'b', team: 1, characterId: 'tank', isBot: false, isGoalie: false },
    ]);
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: 0 };
    a.facing = 0;
    b.pos = { x: 1.4, z: 0 };
    b.facing = Math.PI; // facing -X, toward a
    a.combo = 5;
    a.comboUntil = w.time + 10000;
    w.puck.carrier = 'a';
    w.puck.pickupCooldownUntil = w.time + 10000;
    const hitInput: InputState = { ...neutralInput(), actions: { ...emptyActions(), hit: true } };
    step(w, { a: neutralInput(), b: hitInput }, DT);
    expect(a.combo).toBe(0);
  });

  it('a completed pass to a teammate does not reset the passer combo', () => {
    const w = createWorld(trio());
    w.phase = 'period';
    const a = w.skaters.a;
    a.pos = { x: 0, z: 0 };
    a.facing = 0; // facing +X
    w.skaters.c.pos = { x: 4, z: 0 }; // teammate ahead
    w.skaters.b.pos = { x: -20, z: 10 };
    a.combo = 3;
    a.comboUntil = w.time + 10000;
    w.puck.carrier = 'a';
    doPass(w, a, { ...neutralInput(), aim: { x: 1, z: 0 } });
    expect(a.combo).toBe(3); // a voluntary pass is not a turnover
  });

  it('a pass to a teammate behind the passer registers nolook_pass; ahead does not', () => {
    const behind = createWorld(trio());
    behind.phase = 'period';
    behind.skaters.a.pos = { x: 0, z: 0 };
    behind.skaters.a.facing = 0; // facing +X
    behind.skaters.c.pos = { x: -4, z: 0 }; // teammate behind (-X)
    behind.skaters.b.pos = { x: -20, z: 10 };
    behind.puck.carrier = 'a';
    doPass(behind, behind.skaters.a, { ...neutralInput(), aim: { x: -1, z: 0 } });
    expect(behind.events.some((e) => e.type === 'nolook_pass')).toBe(true);

    const ahead = createWorld(trio());
    ahead.phase = 'period';
    ahead.skaters.a.pos = { x: 0, z: 0 };
    ahead.skaters.a.facing = 0;
    ahead.skaters.c.pos = { x: 4, z: 0 }; // teammate ahead
    ahead.skaters.b.pos = { x: -20, z: 10 };
    ahead.puck.carrier = 'a';
    doPass(ahead, ahead.skaters.a, { ...neutralInput(), aim: { x: 1, z: 0 } });
    expect(ahead.events.some((e) => e.type === 'nolook_pass')).toBe(false);
  });

  it('a puck banked off the boards back to the same team awards bank_play once', () => {
    const w = createWorld(roster()); // a team0, b team1
    w.phase = 'period';
    w.skaters.b.pos = { x: -20, z: -10 }; // keep the opponent out of it
    const a = w.skaters.a;
    a.pos = { x: 0, z: 14 }; // sits in the rebound lane
    a.vel = { x: 0, z: 0 };
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: 0, z: 17 };
    w.puck.vel = { x: 0, z: 30 }; // rocketing into the +Z board
    w.puck.pickupCooldownUntil = 0;
    let banks = 0;
    for (let i = 0; i < 60; i++) {
      step(w, {}, DT);
      banks += w.events.filter((e) => e.type === 'bank_play').length;
      if (w.puck.carrier === 'a') break;
    }
    expect(w.puck.carrier).toBe('a');
    expect(banks).toBe(1); // exactly once, not every frame
  });

  it('an idle combo expires after its window', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const a = w.skaters.a;
    a.combo = 3;
    a.comboUntil = w.time + 50; // expires almost immediately
    for (let i = 0; i < 5; i++) step(w, {}, DT);
    expect(a.combo).toBe(0);
  });

  it('a fully-charged slap shot fires the puck much harder than a quick tap (WO-08)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.time = 10000; // so a (time - SLAP_FULL_MS) charge stamp stays positive
    const a = w.skaters.a;
    a.pos = { x: 0, z: 0 };
    const aim: InputState = { ...neutralInput(), aim: { x: 1, z: 0 } };

    // quick tap: no charge accrued
    w.puck.carrier = 'a';
    a.status.shootChargeStart = 0;
    doShoot(w, a, aim);
    const tap = v.len(w.puck.vel);

    // full hold: a wind-up of SLAP_FULL_MS = charge 1
    w.puck.carrier = 'a';
    a.status.shootChargeStart = w.time - SLAP_FULL_MS;
    doShoot(w, a, aim);
    const slap = v.len(w.puck.vel);

    expect(slap).toBeGreaterThan(tap * 1.3);
    expect(a.status.shootChargeStart).toBe(0); // cleared on fire
  });

  it('hold-to-charge: the shot fires on release, not on press (WO-08)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const a = w.skaters.a;
    a.pos = { x: 0, z: 0 };
    w.puck.carrier = 'a';
    const press: InputState = {
      ...neutralInput(),
      aim: { x: 1, z: 0 },
      actions: { ...emptyActions(), shoot: true },
    };
    const release: InputState = { ...neutralInput(), aim: { x: 1, z: 0 } };

    // press + keep holding: still carrying, winding up
    for (let i = 0; i < 6; i++) step(w, { a: press }, DT);
    expect(w.puck.carrier).toBe('a');
    expect(a.status.shootChargeStart).toBeGreaterThan(0);

    // release fires it loose
    step(w, { a: release }, DT);
    expect(w.puck.carrier).toBeNull();
    expect(a.status.shootChargeStart).toBe(0);
  });

  it('a poke check knocks the puck loose; a stick lift takes possession (WO-08)', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'pickpocket', isBot: false, isGoalie: false }, // high steal
      { id: 'b', team: 1, characterId: 'blaze', isBot: false, isGoalie: false },
    ]);
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: 0 };
    a.facing = 0; // facing +X, toward b

    // poke reach (≈2.3) but beyond stick-lift range (≈1.8): knocks loose, no possession
    w.puck.carrier = 'b';
    b.pos = { x: 2.1, z: 0 };
    doPoke(w, a);
    expect(w.puck.carrier).toBeNull();
    expect(v.len(w.puck.vel)).toBeGreaterThan(0);
    expect(a.status.pokeCooldownUntil).toBeGreaterThan(w.time);

    // a poke on cooldown is a no-op
    w.puck.carrier = 'b';
    doPoke(w, a);
    expect(w.puck.carrier).toBe('b');

    // close range: a stick lift cleanly gains possession
    b.pos = { x: 1.5, z: 0 };
    doSteal(w, a);
    expect(w.puck.carrier).toBe('a');
  });
});
