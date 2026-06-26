import { describe, expect, it } from 'vitest';
import {
  GAMEBREAKER_GOAL_VALUE,
  beginCountdown,
  createWorld,
  step,
  type RosterEntry,
} from './world.js';
import { controllerShotTargetZ, doDeke, doHit, doPass, doPoke, doShoot, doSteal, shotQuality, SLAP_FULL_MS } from './actions.js';
import { carryAnchor, DEKE_MS, ONE_TIMER_WINDOW_MS, STICK_REACH } from './puck.js';
import { stepPickups } from './pickups.js';
import { emptyActions, neutralInput, type InputState, type WorldState } from './types.js';
import { attackingGoalX, PUCK_RADIUS, RINK, SKATER_RADIUS } from '../config/rink.js';
import { GAME_MODES } from '../config/modes.js';
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


describe('controller shot placement', () => {
  it('maps neutral stick to center net and full stick to the posts', () => {
    expect(controllerShotTargetZ(0, 0.5)).toBeCloseTo(0, 5);
    expect(controllerShotTargetZ(1, 0.5)).toBeCloseTo(RINK.goalWidth / 2, 5);
    expect(controllerShotTargetZ(-1, 0.5)).toBeCloseTo(-RINK.goalWidth / 2, 5);
    expect(controllerShotTargetZ(0.5, 0.5)).toBeCloseTo(RINK.goalWidth / 4, 5);
  });

  it('only sends max-input shots wide on the wide roll', () => {
    expect(controllerShotTargetZ(1, 0.19)).toBeGreaterThan(RINK.goalWidth / 2);
    expect(controllerShotTargetZ(1, 0.2)).toBeCloseTo(RINK.goalWidth / 2, 5);
    expect(controllerShotTargetZ(0.94, 0.01)).toBeLessThan(RINK.goalWidth / 2);
  });
});

describe('shot quality', () => {
  it('rewards shooters squared up to the selected target', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const a = w.skaters.a;
    const target = { x: attackingGoalX(a.team), z: 0 };
    a.pos = { x: 10, z: 0 };
    a.facing = 0;
    const squared = shotQuality(w, a, target);
    a.facing = Math.PI;
    const backwards = shotQuality(w, a, target);
    expect(squared.powerMult).toBeGreaterThan(backwards.powerMult);
    expect(squared.errorMaxZ).toBeLessThan(backwards.errorMaxZ);
  });

  it('penalizes bad angle shots near the boards compared to slot shots', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const a = w.skaters.a;
    const target = { x: attackingGoalX(a.team), z: 0 };
    a.facing = 0;
    a.vel = { x: 0, z: 0 };
    a.pos = { x: 12, z: 0 };
    const slot = shotQuality(w, a, target);
    a.pos = { x: RINK.goalLineX - 1, z: RINK.halfWidth - 1 };
    const badAngle = shotQuality(w, a, target);
    expect(slot.powerMult).toBeGreaterThan(badAngle.powerMult);
    expect(slot.errorMaxZ).toBeLessThan(badAngle.errorMaxZ);
  });
});

describe('controller shot execution', () => {
  it('shoots toward center net when controller placement is neutral', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.rng = () => 0.5;
    const a = w.skaters.a;
    a.pos = { x: 10, z: 4 };
    a.facing = 0;
    w.puck.carrier = 'a';
    w.puck.pos = { ...a.pos };
    doShoot(w, a, { ...neutralInput(), shotPlacement: 0 });
    const dir = v.norm(w.puck.vel);
    const expected = v.norm(v.sub({ x: attackingGoalX(a.team), z: 0 }, a.pos));
    expect(v.dot(dir, expected)).toBeGreaterThan(0.98);
  });

  it('shoots toward the selected goal-mouth placement', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.rng = () => 0.5;
    const a = w.skaters.a;
    a.pos = { x: 10, z: 0 };
    a.facing = 0;
    w.puck.carrier = 'a';
    w.puck.pos = { ...a.pos };
    doShoot(w, a, { ...neutralInput(), shotPlacement: 0.5 });
    const dir = v.norm(w.puck.vel);
    const expected = v.norm(v.sub({ x: attackingGoalX(a.team), z: RINK.goalWidth / 4 }, a.pos));
    expect(v.dot(dir, expected)).toBeGreaterThan(0.999);
    expect(dir.z).toBeGreaterThan(0.05);
  });

  it('reduces shot power when the shooter is facing backwards', () => {
    const front = createWorld(roster());
    front.phase = 'period';
    front.rng = () => 0.5;
    front.puck.carrier = 'a';
    front.skaters.a.pos = { x: 10, z: 0 };
    front.skaters.a.facing = 0;
    front.puck.pos = { ...front.skaters.a.pos };
    doShoot(front, front.skaters.a, { ...neutralInput(), shotPlacement: 0 });

    const back = createWorld(roster());
    back.phase = 'period';
    back.rng = () => 0.5;
    back.puck.carrier = 'a';
    back.skaters.a.pos = { x: 10, z: 0 };
    back.skaters.a.facing = Math.PI;
    back.puck.pos = { ...back.skaters.a.pos };
    doShoot(back, back.skaters.a, { ...neutralInput(), shotPlacement: 0 });

    expect(v.len(front.puck.vel)).toBeGreaterThan(v.len(back.puck.vel));
  });

  it('adds lift to normal shots, more lift to charged shots, and keeps intentional low shots flat', () => {
    const wrist = createWorld(roster());
    wrist.phase = 'period';
    wrist.rng = () => 0.5;
    wrist.puck.carrier = 'a';
    wrist.skaters.a.pos = { x: 10, z: 0 };
    wrist.skaters.a.facing = 0;
    wrist.puck.pos = { ...wrist.skaters.a.pos };
    doShoot(wrist, wrist.skaters.a, { ...neutralInput(), shotPlacement: 0 });

    const slap = createWorld(roster());
    slap.phase = 'period';
    slap.rng = () => 0.5;
    slap.time = 10000;
    slap.puck.carrier = 'a';
    slap.skaters.a.pos = { x: 10, z: 0 };
    slap.skaters.a.facing = 0;
    slap.skaters.a.status.shootChargeStart = slap.time - SLAP_FULL_MS;
    slap.puck.pos = { ...slap.skaters.a.pos };
    doShoot(slap, slap.skaters.a, { ...neutralInput(), shotPlacement: 0 });

    const low = createWorld(roster());
    low.phase = 'period';
    low.rng = () => 0.5;
    low.puck.carrier = 'a';
    low.skaters.a.pos = { x: 10, z: 0 };
    low.skaters.a.facing = 0;
    low.puck.pos = { ...low.skaters.a.pos };
    doShoot(low, low.skaters.a, { ...neutralInput(), shotPlacement: 0, lowShot: true });

    expect(wrist.puck.vy).toBeGreaterThan(1);
    expect(slap.puck.vy).toBeGreaterThan(wrist.puck.vy);
    expect(low.puck.vy).toBe(0);
  });
});
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

  it('a held sprint input raises a skater top speed', () => {
    const normal = createWorld(roster());
    normal.phase = 'period';
    normal.skaters.a.pos = { x: 0, z: 0 };

    const sprint = createWorld(roster());
    sprint.phase = 'period';
    sprint.skaters.a.pos = { x: 0, z: 0 };

    const normalInput: InputState = { ...neutralInput(), move: { x: 1, z: 0 } };
    const sprintInput: InputState = {
      ...neutralInput(),
      move: { x: 1, z: 0 },
      actions: { ...emptyActions(), sprint: true },
    };

    for (let i = 0; i < 20; i++) {
      step(normal, { a: normalInput }, DT);
      step(sprint, { a: sprintInput }, DT);
    }

    expect(v.len(sprint.skaters.a.vel)).toBeGreaterThan(v.len(normal.skaters.a.vel) * 1.12);
  });

  it('a partial puck crossing the goal line does not score', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 0.03, z: 0 };
    w.puck.vel = { x: 2, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    step(w, {}, DT);

    expect(w.puck.pos.x).toBeGreaterThanOrEqual(gx);
    expect(w.puck.pos.x).toBeLessThan(gx + PUCK_RADIUS);
    expect(w.score[0]).toBe(0);
  });

  it('a free puck fully across the goal line through the mouth scores', () => {
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

  it('scores airborne pucks below the crossbar but rejects shots above it', () => {
    const under = createWorld(roster());
    under.phase = 'period';
    const gx = attackingGoalX(0);
    under.puck.carrier = null;
    under.puck.lastTouch = 'a';
    under.puck.pos = { x: gx - 1, z: 0 };
    under.puck.vel = { x: 20, z: 0 };
    under.puck.y = RINK.goalHeight - PUCK_RADIUS * 2;
    under.puck.vy = 0;
    under.puck.pickupCooldownUntil = under.time + 10000;
    for (let i = 0; i < 30 && under.score[0] === 0; i++) step(under, {}, DT);

    const over = createWorld(roster());
    over.phase = 'period';
    over.puck.carrier = null;
    over.puck.lastTouch = 'a';
    over.puck.pos = { x: gx - 1, z: 0 };
    over.puck.vel = { x: 20, z: 0 };
    over.puck.y = RINK.goalHeight + PUCK_RADIUS;
    over.puck.vy = 0;
    over.puck.pickupCooldownUntil = over.time + 10000;
    for (let i = 0; i < 30; i++) step(over, {}, DT);

    expect(under.score[0]).toBe(1);
    expect(over.score[0]).toBe(0);
  });

  it('gravity brings a lifted puck back to the ice with a deadened bounce', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.puck.carrier = null;
    w.puck.pos = { x: 0, z: 0 };
    w.puck.vel = { x: 8, z: 0 };
    w.puck.y = 1;
    w.puck.vy = 0;
    w.puck.pickupCooldownUntil = w.time + 10000;

    step(w, {}, DT);
    expect(w.puck.y).toBeLessThan(1);
    expect(w.puck.vy).toBeLessThan(0);

    for (let i = 0; i < 90; i++) step(w, {}, DT);
    expect(w.puck.y).toBeGreaterThanOrEqual(0);
    expect(w.puck.y).toBeLessThan(0.05);
    expect(Math.abs(w.puck.vy)).toBeLessThan(1);
  });

  it('a puck outside the posts does not score even if it fully crosses the goal line', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 1, z: RINK.goalWidth / 2 - PUCK_RADIUS / 2 };
    w.puck.vel = { x: 30, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    for (let i = 0; i < 30; i++) step(w, {}, DT);

    expect(w.score[0]).toBe(0);
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

  it('a Gamebreaker is worth +2 and does not steal from the opponent (WO-02)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.score = [0, 3];
    w.skaters.a.ultActiveUntil = w.time + 10000; // a's ult is live
    launchTeam0Goal(w, 'a');
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(GAMEBREAKER_GOAL_VALUE); // +2
    expect(w.score[1]).toBe(3); // opponent untouched — no point stolen
    const gb = w.events.find((e) => e.type === 'gamebreaker');
    expect(gb).toBeDefined();
    expect(gb && gb.type === 'gamebreaker' && gb.value).toBe(GAMEBREAKER_GOAL_VALUE);
  });

  it("a leader's Gamebreaker never knocks the trailing team back, so comebacks stay possible (WO-02)", () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.score = [1, 5]; // team 0 trailing badly
    w.skaters.b.ultActiveUntil = w.time + 10000; // the leader (team 1) pops a Gamebreaker
    const gx = attackingGoalX(1); // team 1 attacks -X
    w.puck.carrier = null;
    w.puck.lastTouch = 'b';
    w.puck.assistTouch = null;
    w.puck.pos = { x: gx + 1, z: 0 }; // in front of the net, driving in
    w.puck.vel = { x: -20, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;
    for (let i = 0; i < 30 && w.score[1] === 5; i++) step(w, {}, DT);
    expect(w.score[1]).toBe(5 + GAMEBREAKER_GOAL_VALUE); // leader gains +2
    expect(w.score[0]).toBe(1); // trailing team is NOT dropped a point
  });

  it('a full meter held through the goal celebration is not auto-spent on the faceoff (WO-20)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const a = w.skaters.a;
    a.ultCharge = 1; // Gamebreaker ready
    w.pauseUntil = w.time + 1000; // simulate the goal-celebration freeze
    const holdUlt: InputState = { ...neutralInput(), actions: { ...emptyActions(), ult: true } };
    // hold the Gamebreaker key through the pause and into the resumed faceoff
    for (let i = 0; i < 50; i++) step(w, { a: holdUlt }, DT);
    expect(a.ultCharge).toBe(1); // still full — the held key didn't phantom-fire on resume
    expect(a.ultActiveUntil).toBe(0); // never activated
  });

  it('a loose puck resting behind the goal line does not score (WO-18)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0); // +27
    // sitting inside the net region, already past the line — the old plane test
    // would have counted this instantly.
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx + 1, z: 0 };
    w.puck.vel = { x: 0, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;
    for (let i = 0; i < 30; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(0);
  });

  it('a puck dumped in from behind the net is stopped by the back wall and never scores (WO-18)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0); // +27
    const xBack = gx + RINK.goalDepth; // 28.8
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: xBack + 0.5, z: 0 }; // behind the net, in the corner pocket
    w.puck.vel = { x: -15, z: 0 }; // driving toward the mouth from behind
    w.puck.pickupCooldownUntil = w.time + 10000;
    let minX = w.puck.pos.x;
    for (let i = 0; i < 30; i++) {
      step(w, {}, DT);
      minX = Math.min(minX, w.puck.pos.x);
    }
    expect(w.score[0]).toBe(0);
    // the back wall held — it never reached the mouth / the slot in front
    expect(minX).toBeGreaterThan(gx + 1);
  });

  it('a puck entering from the side netting never scores', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx + RINK.goalDepth / 2, z: RINK.goalWidth / 2 + 0.5 };
    w.puck.vel = { x: 0, z: -12 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    for (let i = 0; i < 30; i++) step(w, {}, DT);

    expect(w.score[0]).toBe(0);
  });

  it('a puck that hits the post rebounds without scoring', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 0.4, z: RINK.goalWidth / 2 + PUCK_RADIUS * 0.4 };
    w.puck.vel = { x: 18, z: -1.5 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    for (let i = 0; i < 10; i++) step(w, {}, DT);

    expect(w.score[0]).toBe(0);
    expect(w.puck.pos.x).toBeLessThan(gx + RINK.goalDepth);
    expect(w.events.map((e) => e.type as string)).toContain('puck_post');
  });

  it('leaves playable room for skaters and the puck behind the net', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    const xBack = gx + RINK.goalDepth;
    const behindNetX = xBack + 2.5;
    const a = w.skaters.a;
    a.pos = { x: behindNetX, z: RINK.goalWidth / 2 + 1 };
    a.vel = { x: 0, z: 0 };
    w.puck.carrier = null;
    w.puck.pos = { x: behindNetX, z: -(RINK.goalWidth / 2 + 1) };
    w.puck.vel = { x: 0, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    step(w, {}, DT);

    expect(a.pos.x).toBeCloseTo(behindNetX, 3);
    expect(w.puck.pos.x).toBeCloseTo(behindNetX, 3);
    expect(w.score[0]).toBe(0);
  });

  it('blocks a skater from skating through the back wall of the net', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    const xBack = gx + RINK.goalDepth;
    const a = w.skaters.a;
    a.pos = { x: xBack + SKATER_RADIUS + 0.05, z: 0 };
    a.vel = { x: 0, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    for (let i = 0; i < 20; i++) {
      step(w, { a: { ...neutralInput(), move: { x: -1, z: 0 } } }, DT);
    }

    expect(a.pos.x).toBeGreaterThanOrEqual(xBack + SKATER_RADIUS - 0.01);
  });

  it('blocks a skater from skating through side netting', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    const a = w.skaters.a;
    a.pos = { x: gx + RINK.goalDepth / 2, z: RINK.goalWidth / 2 + SKATER_RADIUS + 0.05 };
    a.vel = { x: 0, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    for (let i = 0; i < 20; i++) {
      step(w, { a: { ...neutralInput(), move: { x: 0, z: -1 } } }, DT);
    }

    expect(a.pos.z).toBeGreaterThanOrEqual(RINK.goalWidth / 2 + SKATER_RADIUS - 0.01);
  });

  it('lets a skater enter the goal mouth but not pass through the back of the net', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    const xBack = gx + RINK.goalDepth;
    const a = w.skaters.a;
    a.pos = { x: gx - SKATER_RADIUS - 0.05, z: 0 };
    a.vel = { x: 0, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    for (let i = 0; i < 20; i++) {
      step(w, { a: { ...neutralInput(), move: { x: 1, z: 0 } } }, DT);
    }

    expect(a.pos.x).toBeGreaterThan(gx);
    expect(a.pos.x).toBeLessThanOrEqual(xBack - SKATER_RADIUS + 0.01);
  });

  it('lets skaters move behind and around the outside of the net', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    const xBack = gx + RINK.goalDepth;
    const a = w.skaters.a;
    a.pos = { x: xBack + SKATER_RADIUS + 0.5, z: RINK.goalWidth / 2 + SKATER_RADIUS + 0.5 };
    a.vel = { x: 0, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    for (let i = 0; i < 15; i++) {
      step(w, { a: { ...neutralInput(), move: { x: 0, z: 1 } } }, DT);
    }

    expect(a.pos.x).toBeGreaterThan(xBack + SKATER_RADIUS);
    expect(a.pos.z).toBeGreaterThan(RINK.goalWidth / 2 + SKATER_RADIUS + 0.5);
  });

  it('an angled shot through the open mouth still scores (WO-18)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0); // +27
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 3, z: 2.5 };
    w.puck.vel = { x: 30, z: -10 }; // crosses the line at z ~1.5, inside the mouth
    w.puck.pickupCooldownUntil = w.time + 10000;
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(1);
  });

  it('a fast puck tunneling fully through the mouth still scores', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 4, z: 0 };
    w.puck.vel = { x: 180, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;

    step(w, {}, DT);

    expect(w.score[0]).toBe(1);
  });

  it('a defender in the lane blocks a hard shot and is credited (WO-19)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const b = w.skaters.b; // team 1, the defender
    b.pos = { x: 12, z: 0 };
    b.vel = { x: 0, z: 0 };
    const chargeBefore = b.ultCharge;
    w.puck.carrier = null;
    w.puck.lastTouch = 'a'; // shot by team 0
    w.puck.assistTouch = null;
    w.puck.pos = { x: 6, z: 0 };
    w.puck.vel = { x: 30, z: 0 }; // hard, straight at the defender
    w.puck.pickupCooldownUntil = w.time + 10000; // keep it from being gathered
    let blocked = false;
    for (let i = 0; i < 30 && !blocked; i++) {
      step(w, {}, DT);
      blocked = w.events.some((e) => e.type === 'block' && e.by === 'b');
    }
    expect(blocked).toBe(true);
    expect(w.puck.vel.x).toBeLessThan(30); // deflected/deadened, didn't pass through
    expect(b.ultCharge).toBeGreaterThan(chargeBefore); // "sells defense"
  });

  it('two skaters colliding shed their closing velocity instead of grinding (WO-19)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: 0 };
    a.vel = { x: 4, z: 0 };
    b.pos = { x: 0.8, z: 0 };
    b.vel = { x: -4, z: 0 };
    step(w, {}, DT);
    expect(v.dist(a.pos, b.pos)).toBeGreaterThan(SKATER_RADIUS * 2 - 0.1); // not overlapping
    expect(Math.abs(a.vel.x)).toBeLessThan(1); // closing velocity cancelled
    expect(Math.abs(b.vel.x)).toBeLessThan(1);
  });

  it('a skater shoved into the boards is kept on the ice (WO-19)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: RINK.halfWidth - SKATER_RADIUS - 0.1 }; // against the +Z board
    a.vel = { x: 0, z: 0 };
    b.pos = { x: 0, z: RINK.halfWidth - SKATER_RADIUS - 0.9 };
    b.vel = { x: 0, z: 6 }; // driving a outward into the boards
    let maxZ = a.pos.z;
    for (let i = 0; i < 5; i++) {
      step(w, {}, DT);
      maxZ = Math.max(maxZ, a.pos.z);
    }
    expect(maxZ).toBeLessThanOrEqual(RINK.halfWidth - SKATER_RADIUS + 0.05);
  });

  it('a hit does not connect with an already-downed skater (WO-19)', () => {
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
    b.status.staggeredUntil = w.time + 5000; // already down
    doHit(w, a, neutralInput());
    expect(b.vel.x).toBeCloseTo(0, 5); // no knock — the hit found no eligible target
    expect(w.events.some((e) => e.type === 'hit')).toBe(false);
  });

  it('a carried puck pinned to the boards stays on the ice (WO-19)', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const a = w.skaters.a;
    a.pos = { x: 0, z: RINK.halfWidth - SKATER_RADIUS - 0.1 }; // against the +Z board
    a.vel = { x: 0, z: 0 };
    a.facing = Math.PI / 2; // facing +Z, into the board — stick anchor would poke through
    w.puck.carrier = 'a';
    w.puck.pickupCooldownUntil = 0;
    step(w, {}, DT);
    expect(Math.abs(w.puck.pos.z)).toBeLessThan(RINK.halfWidth);
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

describe('box score, goalie saves & one-timers (WO-09)', () => {
  it('a goal credits the scorer and assister in the box score', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'blaze', isBot: false, isGoalie: false },
      { id: 'c', team: 0, characterId: 'sniper', isBot: false, isGoalie: false },
      { id: 'b', team: 1, characterId: 'tank', isBot: false, isGoalie: false },
    ]);
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.assistTouch = 'c';
    w.puck.pos = { x: gx - 1, z: 0 };
    w.puck.vel = { x: 20, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(1);
    expect(w.stats.a.goals).toBe(1);
    expect(w.stats.c.assists).toBe(1);
    expect(w.stats.a.assists).toBe(0);
  });

  it('a goalie robs a hard shot — no goal, a save + rebound, and a tallied save', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'sniper', isBot: false, isGoalie: false },
      { id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true },
    ]);
    w.phase = 'period';
    const g = w.skaters.g; // sits centered in front of its net by default
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.assistTouch = null;
    w.puck.pos = { x: g.pos.x - 1.5, z: g.pos.z };
    w.puck.vel = { x: 20, z: 0 }; // hard, dead at the goalie
    w.puck.pickupCooldownUntil = 0;
    step(w, {}, DT);
    expect(w.score[0]).toBe(0); // robbed
    const save = w.events.find((e) => e.type === 'save');
    expect(save).toBeDefined();
    expect(save && save.type === 'save' && save.rebound).toBe(true);
    expect(w.puck.carrier).toBeNull(); // popped out as a live rebound
    expect(w.stats.g.saves).toBe(1);
  });

  it('a goalie saves a fast shot that crosses the projected save lane between ticks', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'sniper', isBot: false, isGoalie: false },
      { id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true },
    ]);
    w.phase = 'period';
    const g = w.skaters.g;
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: g.pos.x - 4, z: g.pos.z + 0.35 };
    w.puck.vel = { x: 180, z: 0 };
    w.puck.y = 1.2;
    w.puck.vy = 0;
    w.puck.pickupCooldownUntil = w.time + 10000;

    step(w, {}, DT);

    const save = w.events.find((e) => e.type === 'save');
    expect(save).toBeDefined();
    expect(g.status.goalieSaveUntil).toBeGreaterThan(w.time);
    expect(g.status.goalieSaveType).toBe('glove');
    expect(g.status.goalieSaveSide).toBe(1);
  });

  it('a goalie covers a soft, centered shot (becomes the carrier)', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'sniper', isBot: false, isGoalie: false },
      { id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true },
    ]);
    w.phase = 'period';
    const g = w.skaters.g;
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: g.pos.x - 1.5, z: g.pos.z };
    w.puck.vel = { x: 8, z: 0 }; // soft and centered
    w.puck.pickupCooldownUntil = 0;
    step(w, {}, DT);
    const save = w.events.find((e) => e.type === 'save');
    expect(save && save.type === 'save' && save.rebound).toBe(false);
    expect(w.puck.carrier).toBe('g');
    expect(w.stats.g.saves).toBe(1);
  });

  it('a cross-crease shot the goalie has not slid over to still beats him', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'sniper', isBot: false, isGoalie: false },
      { id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true },
    ]);
    w.phase = 'period';
    const g = w.skaters.g; // centered at z = 0
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 1, z: 2.6 }; // wide of the goalie but inside the posts
    w.puck.vel = { x: 22, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 10000;
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(g.pos.z).toBe(0); // goalie never moved (no AI in the pure sim)
    expect(w.score[0]).toBe(1); // beat him clean
  });

  it('shooting right off a pass fires a bonus one-timer', () => {
    const w = createWorld([
      { id: 'p', team: 0, characterId: 'maestro', isBot: false, isGoalie: false },
      { id: 'r', team: 0, characterId: 'sniper', isBot: false, isGoalie: false },
      { id: 'b', team: 1, characterId: 'tank', isBot: false, isGoalie: false },
    ]);
    w.phase = 'period';
    w.time = 10000;
    const r = w.skaters.r;
    r.pos = { x: 0, z: 0 };
    const aim: InputState = { ...neutralInput(), aim: { x: 1, z: 0 } };

    // cold shot baseline (no recent pass)
    w.puck.carrier = 'r';
    r.status.oneTimerUntil = 0;
    doShoot(w, r, aim);
    const cold = v.len(w.puck.vel);

    // one-timer: shoot inside the post-pass window
    w.puck.carrier = 'r';
    r.status.oneTimerUntil = w.time + 200;
    w.events = [];
    doShoot(w, r, aim);
    const oneT = v.len(w.puck.vel);

    expect(w.events.some((e) => e.type === 'one_timer')).toBe(true);
    expect(oneT).toBeGreaterThan(cold);
    expect(r.status.oneTimerUntil).toBe(0); // consumed
  });

  it('collecting a teammate pass arms the one-timer window', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'maestro', isBot: false, isGoalie: false },
      { id: 'c', team: 0, characterId: 'sniper', isBot: false, isGoalie: false },
      { id: 'b', team: 1, characterId: 'tank', isBot: false, isGoalie: false },
    ]);
    w.phase = 'period';
    const a = w.skaters.a;
    a.pos = { x: 0, z: 0 };
    a.facing = 0;
    w.skaters.c.pos = { x: 5, z: 0 }; // teammate ahead in the lane
    w.skaters.b.pos = { x: -20, z: 12 }; // opponent out of it
    w.puck.carrier = 'a';
    doPass(w, a, { ...neutralInput(), aim: { x: 1, z: 0 } });
    for (let i = 0; i < 50 && w.puck.carrier !== 'c'; i++) step(w, {}, DT);
    expect(w.puck.carrier).toBe('c');
    expect(w.skaters.c.status.oneTimerUntil).toBeGreaterThan(w.time);
    expect(w.skaters.c.status.oneTimerUntil).toBeLessThanOrEqual(w.time + ONE_TIMER_WINDOW_MS);
  });
});

describe('deferred goal reset for replays (WO-10)', () => {
  it('leaves the puck in the net during the celebration, then faces off after the pause', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const gx = attackingGoalX(0);
    w.puck.carrier = null;
    w.puck.lastTouch = 'a';
    w.puck.pos = { x: gx - 1, z: 0 };
    w.puck.vel = { x: 20, z: 0 };
    w.puck.pickupCooldownUntil = w.time + 100000;
    for (let i = 0; i < 30 && w.score[0] === 0; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(1);
    expect(w.goalResetPending).toBe(true);
    // the puck sits across the goal line, not teleported back to center
    expect(w.puck.pos.x).toBeGreaterThan(gx - 1);
    const posAtGoal = { ...w.puck.pos };

    for (let i = 0; i < 5; i++) step(w, {}, DT);
    expect(v.dist(w.puck.pos, posAtGoal)).toBeGreaterThan(0.05);
    expect(w.goalResetPending).toBe(true);

    // run out the celebration pause; the deferred faceoff then drops it at center
    let guard = 0;
    while (w.time < w.pauseUntil + DT && guard++ < 500) step(w, {}, DT);
    expect(w.goalResetPending).toBe(false);
    expect(Math.abs(w.puck.pos.x)).toBeLessThan(0.01);
    expect(Math.abs(w.puck.pos.z)).toBeLessThan(0.01);
  });
});

describe('game modes (WO-15)', () => {
  it('first-to-5 ends the moment a team reaches the goal target', () => {
    const w = createWorld(roster(), GAME_MODES.first5);
    expect(w.targetGoals).toBe(5);
    expect(w.periods).toBe(1);
    w.phase = 'period';
    w.score = [4, 0];
    launchTeam0Goal(w, 'a'); // the 5th
    for (let i = 0; i < 30 && w.phase !== 'ended'; i++) step(w, {}, DT);
    expect(w.score[0]).toBe(5);
    expect(w.phase).toBe('ended');
  });

  it('blitz is a single period — time expiring with a lead ends the match (no intermission)', () => {
    const w = createWorld(roster(), GAME_MODES.blitz);
    expect(w.periods).toBe(1);
    w.phase = 'period';
    w.score = [1, 0];
    w.clock = DT; // about to run out
    for (let i = 0; i < 4 && w.phase === 'period'; i++) step(w, {}, DT);
    expect(w.phase).toBe('ended');
  });

  it('a tie in a single-period mode goes to sudden-death overtime', () => {
    const w = createWorld(roster(), GAME_MODES.blitz);
    w.phase = 'period';
    w.score = [2, 2];
    w.clock = DT;
    // clock expires -> pre-OT countdown -> overtime
    for (let i = 0; i < 200 && w.phase !== 'overtime' && w.phase !== 'ended'; i++) {
      step(w, {}, DT);
    }
    expect(w.phase).toBe('overtime');
  });
});

describe('ice pickups (WO-16)', () => {
  it('skating over a boost token grants a speed boost and emits a pickup event', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    const a = w.skaters.a;
    a.pos = { x: 2, z: 3 };
    w.pickupTimer = 999999; // suppress the periodic spawn so we test just this token
    w.pickups = [{ id: 'pk0', kind: 'boost', pos: { x: 2, z: 3 }, spawnedAt: w.time }];
    w.events = [];
    stepPickups(w, DT);
    expect(w.pickups.find((p) => p.id === 'pk0')).toBeUndefined(); // collected
    expect(a.status.speedMult).toBeGreaterThan(1);
    expect(a.status.speedMultUntil).toBeGreaterThan(w.time);
    expect(w.events.some((e) => e.type === 'pickup' && e.kind === 'boost')).toBe(true);
  });

  it('a charge token adds ult charge, and goalies ignore tokens', () => {
    const w = createWorld([
      { id: 'a', team: 0, characterId: 'blaze', isBot: false, isGoalie: false },
      { id: 'g', team: 1, characterId: 'tank', isBot: true, isGoalie: true },
    ]);
    w.phase = 'period';
    const a = w.skaters.a;
    const g = w.skaters.g;
    a.pos = { x: 0, z: 0 };
    a.ultCharge = 0.1;
    g.pos = { x: 5, z: 5 };
    w.pickupTimer = 999999; // suppress the periodic spawn
    w.pickups = [
      { id: 'pk1', kind: 'charge', pos: { x: 0, z: 0 }, spawnedAt: w.time },
      { id: 'pk2', kind: 'charge', pos: { x: 5, z: 5 }, spawnedAt: w.time }, // under the goalie
    ];
    w.events = [];
    stepPickups(w, DT);
    expect(a.ultCharge).toBeGreaterThan(0.1);
    // the goalie's token is untouched
    expect(w.pickups.some((p) => p.id === 'pk2')).toBe(true);
  });

  it('stale tokens despawn and at most PICKUP_MAX sit on the ice', () => {
    const w = createWorld(roster());
    w.phase = 'period';
    w.skaters.a.pos = { x: -25, z: 15 }; // keep skaters away from spawns
    w.skaters.b.pos = { x: 25, z: -15 };
    // run a couple minutes of empty play; spawns happen but never exceed the cap
    let maxSeen = 0;
    for (let i = 0; i < 60 * 30; i++) {
      stepPickups(w, DT);
      w.time += DT;
      maxSeen = Math.max(maxSeen, w.pickups.length);
    }
    expect(maxSeen).toBeLessThanOrEqual(2);
  });
});

describe('penalties / power play (WO-17)', () => {
  function pair() {
    return [
      { id: 'a', team: 0, characterId: 'tank', isBot: false, isGoalie: false },
      { id: 'b', team: 1, characterId: 'blaze', isBot: false, isGoalie: false },
    ] as RosterEntry[];
  }

  it('a check on a player away from the puck is a penalty — the hitter is boxed', () => {
    const w = createWorld(pair());
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: 0 };
    a.facing = 0; // facing +X toward b
    b.pos = { x: 1.4, z: 0 };
    w.puck.carrier = null;
    w.puck.pos = { x: 20, z: 0 }; // puck far from b → interference
    doHit(w, a, neutralInput());
    expect(a.status.penaltyUntil).toBeGreaterThan(w.time);
    expect(
      w.events.some((e) => e.type === 'penalty' && e.on === 'a' && e.team === 0),
    ).toBe(true);
  });

  it('a clean check on the puck carrier is not a penalty', () => {
    const w = createWorld(pair());
    w.phase = 'period';
    const a = w.skaters.a;
    const b = w.skaters.b;
    a.pos = { x: 0, z: 0 };
    a.facing = 0;
    b.pos = { x: 1.4, z: 0 };
    w.puck.carrier = 'b';
    w.puck.pos = { ...b.pos };
    doHit(w, a, neutralInput());
    expect(a.status.penaltyUntil).toBe(0);
    expect(w.events.some((e) => e.type === 'penalty')).toBe(false);
    expect(w.puck.carrier).toBeNull(); // the clean hit still stripped the puck
  });

  it('a boxed skater is held off-ice and inert while the penalty runs', () => {
    const w = createWorld(pair());
    w.phase = 'period';
    const a = w.skaters.a;
    a.status.penaltyUntil = w.time + 5000;
    a.pos = { x: 0, z: 0 };
    step(w, { a: { ...neutralInput(), move: { x: 1, z: 0 } } }, DT);
    // forced to the bench-side box, not moved by input
    expect(Math.abs(a.pos.z)).toBeGreaterThan(18);
  });
});
