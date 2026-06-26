# Controller Shooting Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build controller-first shooting where the left stick places shots across the goal mouth, while player facing, movement, and shot location affect power and accuracy.

**Architecture:** Keep shot authority in `@bbh/shared` so server simulation remains deterministic and testable. Add explicit shot placement and shot quality helpers in `packages/shared/src/sim/actions.ts`, and feed controller shot placement from `packages/client/src/input/inputState.ts` through `InputState`. Use seeded `world.rng()` for wide/error rolls instead of `Math.random()`.

**Tech Stack:** TypeScript, Vitest, existing `@bbh/shared` sim helpers, React/Vite client input path.

---

## File Structure

- Modify `packages/shared/src/sim/types.ts`: add optional `shotPlacement` to `InputState`.
- Modify `packages/client/src/input/inputState.ts`: set `input.shotPlacement` from gamepad left-stick horizontal input.
- Modify `packages/shared/src/sim/actions.ts`: add shot placement and shot quality helpers; update `doShoot`.
- Modify `packages/shared/src/sim/world.test.ts`: add regression tests for shot placement, wide chance, facing, movement, and location accuracy.
- Modify `packages/server/src/rooms/input.ts`: sanitize optional `shotPlacement` from network input.
- Modify `packages/server/src/rooms/input.test.ts`: verify invalid `shotPlacement` is ignored/clamped.

---

### Task 1: Add Controller Shot Placement To Input State

**Files:**
- Modify: `packages/shared/src/sim/types.ts`
- Modify: `packages/client/src/input/inputState.ts`
- Modify: `packages/server/src/rooms/input.ts`
- Test: `packages/server/src/rooms/input.test.ts`

- [ ] **Step 1: Write the failing input sanitation test**

Add this test to `packages/server/src/rooms/input.test.ts`:

```ts
it('sanitizes controller shot placement to the left-stick range', () => {
  const over = parseInput({ move: null, aim: null, shotPlacement: 2, actions: {} });
  const under = parseInput({ move: null, aim: null, shotPlacement: -2, actions: {} });
  const bad = parseInput({ move: null, aim: null, shotPlacement: 'wide', actions: {} });

  expect(over.shotPlacement).toBe(1);
  expect(under.shotPlacement).toBe(-1);
  expect(bad.shotPlacement).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm.cmd run test --workspace @bbh/server -- input.test.ts
```

Expected: FAIL because `InputState` has no `shotPlacement` and `parseInput` does not return it.

- [ ] **Step 3: Add the optional input field**

In `packages/shared/src/sim/types.ts`, update `InputState`:

```ts
export interface InputState {
  move: Vec2;
  aim: Vec2;
  shotPlacement?: number; // controller left-stick horizontal shot placement, -1..1
  actions: Actions;
}
```

In `neutralInput()`, leave the field unset:

```ts
export function neutralInput(): InputState {
  return { move: { x: 0, z: 0 }, aim: { x: 0, z: 0 }, actions: emptyActions() };
}
```

- [ ] **Step 4: Sanitize network input**

In `packages/server/src/rooms/input.ts`, add:

```ts
function scalar(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(-1, Math.min(1, value))
    : undefined;
}
```

Then include it in `parseInput`:

```ts
const shotPlacement = scalar(value.shotPlacement);
return {
  move: vec(value.move),
  aim: vec(value.aim),
  ...(shotPlacement === undefined ? {} : { shotPlacement }),
  actions: {
    shoot: value.actions?.shoot === true,
    pass: value.actions?.pass === true,
    hit: value.actions?.hit === true,
    steal: value.actions?.steal === true,
    ult: value.actions?.ult === true,
    deke: value.actions?.deke === true,
    poke: value.actions?.poke === true,
  },
};
```

- [ ] **Step 5: Feed controller placement from the client**

In `packages/client/src/input/inputState.ts`, after gamepad movement is read:

```ts
if (gp.connected) {
  input.shotPlacement = Math.max(-1, Math.min(1, gp.moveX));
}
```

This uses the controller left stick horizontal value. Neutral left stick produces `0`, which means dead center.

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
npm.cmd run test --workspace @bbh/server -- input.test.ts
```

Expected: PASS.

---

### Task 2: Add Shot Placement Targeting

**Files:**
- Modify: `packages/shared/src/sim/actions.ts`
- Test: `packages/shared/src/sim/world.test.ts`

- [ ] **Step 1: Write failing placement helper tests**

Add tests to `packages/shared/src/sim/world.test.ts`:

```ts
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
```

Import `controllerShotTargetZ` from `./actions.js`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm.cmd run test --workspace @bbh/shared -- world.test.ts -t "controller shot placement"
```

Expected: FAIL because `controllerShotTargetZ` does not exist.

- [ ] **Step 3: Add placement constants and helper**

In `packages/shared/src/sim/actions.ts`, import `RINK`:

```ts
import { attackingGoalX, RINK, SKATER_RADIUS } from '../config/rink.js';
```

Add near the other shooting constants:

```ts
export const SHOT_PLACEMENT_DEADZONE = 0.15;
export const WIDE_INPUT_THRESHOLD = 0.95;
export const WIDE_CHANCE = 0.2;
export const WIDE_MARGIN = 0.65;
```

Add:

```ts
export function controllerShotTargetZ(stickX: number, wideRoll: number): number {
  const clamped = Math.max(-1, Math.min(1, stickX));
  const placed = Math.abs(clamped) < SHOT_PLACEMENT_DEADZONE ? 0 : clamped;
  const postZ = RINK.goalWidth / 2;
  const base = placed * postZ;
  const atMax = Math.abs(placed) >= WIDE_INPUT_THRESHOLD;
  if (atMax && wideRoll < WIDE_CHANCE) {
    return Math.sign(placed || 1) * (postZ + WIDE_MARGIN);
  }
  return base;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm.cmd run test --workspace @bbh/shared -- world.test.ts -t "controller shot placement"
```

Expected: PASS.

---

### Task 3: Add Shot Quality From Facing, Movement, And Location

**Files:**
- Modify: `packages/shared/src/sim/actions.ts`
- Test: `packages/shared/src/sim/world.test.ts`

- [ ] **Step 1: Write failing shot quality tests**

Add tests:

```ts
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
```

Import `shotQuality` from `./actions.js`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm.cmd run test --workspace @bbh/shared -- world.test.ts -t "shot quality"
```

Expected: FAIL because `shotQuality` does not exist.

- [ ] **Step 3: Add shot quality helper**

In `packages/shared/src/sim/actions.ts`, add:

```ts
export interface ShotQuality {
  powerMult: number;
  errorMaxZ: number;
}

export function shotQuality(world: WorldState, s: SkaterState, target: { x: number; z: number }): ShotQuality {
  const toTarget = v.norm(v.sub(target, s.pos));
  const facing = v.fromAngle(s.facing);
  const alignment = v.dot(facing, toTarget);
  const alignment01 = Math.max(0, Math.min(1, (alignment + 1) / 2));

  const movementSpeed = v.len(s.vel);
  const movingIntoShot = movementSpeed > 0.1 ? Math.max(-1, Math.min(1, v.dot(v.norm(s.vel), toTarget))) : 0;
  const movementBonus = movingIntoShot > 0 ? movingIntoShot * 0.08 : movingIntoShot * 0.1;

  const lateral = Math.abs(s.pos.z) / RINK.halfWidth;
  const behindOrSharp = s.team === 0 ? s.pos.x > RINK.goalLineX - 2 : s.pos.x < -RINK.goalLineX + 2;
  const locationPenalty = Math.min(0.25, lateral * 0.18 + (behindOrSharp ? 0.12 : 0));

  const powerMult = Math.max(0.52, Math.min(1.08, 0.58 + alignment01 * 0.42 + movementBonus - locationPenalty));
  const errorMaxZ = Math.max(0.05, 1.25 - alignment01 * 0.85 + locationPenalty * 1.8 - movementBonus);

  return { powerMult, errorMaxZ };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm.cmd run test --workspace @bbh/shared -- world.test.ts -t "shot quality"
```

Expected: PASS.

---

### Task 4: Apply Placement And Quality In `doShoot`

**Files:**
- Modify: `packages/shared/src/sim/actions.ts`
- Test: `packages/shared/src/sim/world.test.ts`

- [ ] **Step 1: Write failing shot execution tests**

Add tests:

```ts
describe('controller shot execution', () => {
  it('shoots toward center net when controller placement is neutral', () => {
    const w = createWorld(roster());
    w.phase = 'period';
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

  it('reduces shot power when the shooter is facing backwards', () => {
    const front = createWorld(roster());
    front.phase = 'period';
    front.puck.carrier = 'a';
    front.skaters.a.pos = { x: 10, z: 0 };
    front.skaters.a.facing = 0;
    front.puck.pos = { ...front.skaters.a.pos };
    doShoot(front, front.skaters.a, { ...neutralInput(), shotPlacement: 0 });

    const back = createWorld(roster());
    back.phase = 'period';
    back.puck.carrier = 'a';
    back.skaters.a.pos = { x: 10, z: 0 };
    back.skaters.a.facing = Math.PI;
    back.puck.pos = { ...back.skaters.a.pos };
    doShoot(back, back.skaters.a, { ...neutralInput(), shotPlacement: 0 });

    expect(v.len(front.puck.vel)).toBeGreaterThan(v.len(back.puck.vel));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm.cmd run test --workspace @bbh/shared -- world.test.ts -t "controller shot execution"
```

Expected: FAIL because `doShoot` ignores `shotPlacement` and shot quality.

- [ ] **Step 3: Update `doShoot` target calculation**

In `doShoot`, replace the current `let dir = aimDir(s, input);` through aim-assist section with:

```ts
const usingControllerPlacement = typeof input.shotPlacement === 'number';
const wideRoll = world.rng();
const target = usingControllerPlacement
  ? { x: attackingGoalX(s.team), z: controllerShotTargetZ(input.shotPlacement, wideRoll) }
  : netCenter(s.team);

let dir = usingControllerPlacement ? v.norm(v.sub(target, puck.pos)) : aimDir(s, input);
const toNet = v.norm(v.sub(netCenter(s.team), puck.pos));

if (!usingControllerPlacement) {
  let assist = (0.15 + (shoot / 10) * 0.35) * (1 - 0.5 * charge);
  if (oneTimer) assist = Math.min(0.9, assist + ONE_TIMER_ASSIST_BONUS);
  dir = v.norm({ x: dir.x * (1 - assist) + toNet.x * assist, z: dir.z * (1 - assist) + toNet.z * assist });
}

const quality = shotQuality(world, s, target);
if (usingControllerPlacement) {
  const errorRoll = world.rng() * 2 - 1;
  const adjustedTarget = { x: target.x, z: target.z + errorRoll * quality.errorMaxZ };
  dir = v.norm(v.sub(adjustedTarget, puck.pos));
}

if (s.status.guaranteedGoal) {
  dir = toNet;
}
```

Then update power:

```ts
let power = (wrist + (slap - wrist) * charge) * s.status.shootPowerMult * quality.powerMult;
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm.cmd run test --workspace @bbh/shared -- world.test.ts -t "controller shot execution"
```

Expected: PASS.

---

### Task 5: Verify Full System

**Files:**
- No new file changes.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm.cmd run typecheck
```

Expected: exit code 0.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm.cmd test
```

Expected: all shared, server, and client tests pass.

- [ ] **Step 3: Manually test controller behavior**

With the dev server already running at `http://localhost:5173`:

1. Enter a match with a controller.
2. Carry the puck and release a shot with left stick neutral.
3. Confirm the shot goes toward center net.
4. Release shots with left stick full left and full right.
5. Confirm shots target posts, with occasional misses wide at max input.
6. Face away from the net and shoot.
7. Confirm backwards shots are weaker and less accurate.
8. Shoot squared up from the slot.
9. Confirm slot shots feel stronger and cleaner.

---

## Self-Review

- Spec coverage: The plan covers neutral center aim, left-stick goal-mouth placement, 20% max-input wide chance, player facing accuracy, player position accuracy, movement into/away from shot, network input sanitation, and verification.
- Placeholder scan: No placeholder steps remain.
- Type consistency: `InputState.shotPlacement`, `controllerShotTargetZ`, `shotQuality`, and `ShotQuality` are named consistently across tasks.
