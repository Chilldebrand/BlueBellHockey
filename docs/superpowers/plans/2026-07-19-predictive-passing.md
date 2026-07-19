# Predictive Passing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lead aimed skater and goalie passes to a teammate's projected skating path while making quick and charged passes 40 percent faster.

**Architecture:** A new pure `passTargeting` module will own aim-cone recipient selection, bounded velocity lead, and rink-safe predicted targets. Skater passes and goalie outlets consume the same module, leaving the deterministic puck physics and existing control scheme intact.

**Tech Stack:** TypeScript, deterministic arcade-core simulation, Vitest.

## Global Constraints

- Reuse left-stick aim and the current `0.65` assist cone; do not add target-cycle input or network fields.
- Keep manual directional passing when a skater has no teammate in the aim cone.
- Keep defenders able to intercept, and preserve current pass charge duration, catch radius, one-timer window, and goalie hold/timeout behavior.
- Set `passSpeed` to `1512`, `passChargeSpeedBonus` to `638`, and `passCatchMaxRelativeSpeed` to `2400`.

---

### Task 1: Add pure predictive pass targeting

**Files:**
- Create: `packages/arcade-core/src/sim/passTargeting.ts`
- Create: `packages/arcade-core/src/sim/passTargeting.test.ts`
- Modify: `packages/arcade-core/src/index.ts`

**Interfaces:**
- Consumes: `WorldState`, `SkaterEntity`, `TeamId`, `Vec2`, `RINK_CONFIG`, and physics helpers.
- Produces: `findAimedPassRecipient`, `predictPassTarget`, and `passTargetWithAssist` for the skater and goalie release paths.

- [ ] **Step 1: Write the failing targeting tests**

```ts
it("leads an aimed teammate along their skating path", () => {
  const world = createWorld(1, "arcade3v3");
  const passer = world.skaters[0];
  const receiver = world.skaters[1];
  receiver.position = { x: passer.position.x + 400, y: passer.position.y };
  receiver.velocity = { x: 400, y: 0 };

  const target = passTargetWithAssist(
    world,
    { id: passer.id, teamId: passer.teamId, position: passer.position },
    { x: 1, y: 0 },
    1512
  );

  expect(target?.x).toBeGreaterThan(receiver.position.x);
  expect(target?.y).toBe(receiver.position.y);
});

it("does not lead a stationary receiver and returns null without an aimed recipient", () => {
  const world = createWorld(1, "arcade3v3");
  const passer = world.skaters[0];
  const receiver = world.skaters[1];
  receiver.position = { x: passer.position.x + 400, y: passer.position.y };
  receiver.velocity = { x: 0, y: 0 };

  expect(passTargetWithAssist(world, passer, { x: 1, y: 0 }, 1512)).toEqual(
    receiver.position
  );
  expect(passTargetWithAssist(world, passer, { x: -1, y: 0 }, 1512)).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- passTargeting.test.ts`

Expected: FAIL because `passTargetWithAssist` is not exported yet.

- [ ] **Step 3: Implement the targeting module**

```ts
export const PASS_AIM_ASSIST_COSINE = 0.65;
export const PASS_LEAD_MAX_SECONDS = 0.3;
export const PASS_LEAD_MAX_DISTANCE = 220;

export interface PassSource {
  readonly id: string;
  readonly teamId: TeamId;
  readonly position: Vec2;
}

export function passTargetWithAssist(
  world: WorldState,
  source: PassSource,
  aim: Vec2,
  speed: number
): Vec2 | null {
  const recipient = findAimedPassRecipient(world, source, aim);
  return recipient ? predictPassTarget(source.position, recipient, speed) : null;
}
```

`findAimedPassRecipient` must retain the existing dot-product cone selection and return the best same-team skater. `predictPassTarget` must use `min(distance / speed, PASS_LEAD_MAX_SECONDS)`, cap velocity lead with `PASS_LEAD_MAX_DISTANCE`, and clamp the target between a 60-unit rink margin and each opposite wall.

- [ ] **Step 4: Export and re-run the focused test**

Add `export * from "./sim/passTargeting.js";` to `packages/arcade-core/src/index.ts`.

Run: `npm.cmd run test --workspace @bbh/arcade-core -- passTargeting.test.ts`

Expected: PASS.

### Task 2: Use prediction for skater passes and speed tuning

**Files:**
- Modify: `packages/arcade-core/src/sim/actions.ts`
- Modify: `packages/arcade-core/src/sim/puck.ts`
- Modify: `packages/arcade-core/src/sim/actions.test.ts`

**Interfaces:**
- Consumes: `passTargetWithAssist(world, source, aim, speed): Vec2 | null`.
- Produces: a release direction that leads an aimed receiver, and the specified faster speed constants.

- [ ] **Step 1: Write the failing action tests**

```ts
it("leads a moving receiver instead of passing to their old position", () => {
  const world = givePuckToFirstSkater();
  const passer = world.skaters[0];
  const receiver = world.skaters[1];
  receiver.position = { x: passer.position.x + 360, y: passer.position.y };
  receiver.velocity = { x: 0, y: 480 };

  tapPass(world, { moveX: 1, moveY: 0 });

  expect(world.puck.velocity.y).toBeGreaterThan(0);
});

it("uses the 40 percent faster quick and charged pass speeds", () => {
  const tap = givePuckToFirstSkater();
  tapPass(tap, { moveX: 1 });
  expect(magnitude(tap.puck.velocity)).toBeCloseTo(1512, 0);

  const charged = givePuckToFirstSkater();
  for (let sequence = 1; sequence <= 38; sequence += 1) {
    stepWorld(charged, [inputFrame("home-skater-1", sequence, { pass: true })], 16);
  }
  stepWorld(charged, [inputFrame("home-skater-1", 39, { pass: false })], 16);
  expect(magnitude(charged.puck.velocity)).toBeCloseTo(2150, 0);
});
```

- [ ] **Step 2: Run the action test to verify it fails**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- actions.test.ts`

Expected: FAIL because the release still targets the recipient's current position and uses the old speed constants.

- [ ] **Step 3: Wire the helper into the skater release**

Change `passDirectionWithAssist` to accept the release position and pass speed. When `passTargetWithAssist` returns a target, normalize `target - releasePosition`; otherwise return the current manual aim. In `stepCarriedPuck`, compute `speed` once, use the blade as the release position, and pass both values into `passDirectionWithAssist`.

Set these `PUCK_CONFIG` values:

```ts
passSpeed: 1512,
passChargeSpeedBonus: 638,
passCatchMaxRelativeSpeed: 2400
```

- [ ] **Step 4: Run the focused action tests**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- actions.test.ts`

Expected: PASS.

### Task 3: Use prediction for goalie outlets and verify reception

**Files:**
- Modify: `packages/arcade-core/src/sim/goalieOutlet.ts`
- Modify: `packages/arcade-core/src/sim/goalieOutlet.test.ts`
- Modify: `packages/arcade-core/src/sim/puck.ts` only if a reception test needs an exported configuration seam.

**Interfaces:**
- Consumes: `passTargetWithAssist` and `TUNING.puck` pass speeds.
- Produces: goalie outlets that lead aimed teammates and fall back to the existing safe outlet target.

- [ ] **Step 1: Write failing goalie-outlet tests**

```ts
it("leads an aimed outlet receiver and keeps a maximum-speed pass catchable", () => {
  const world = createWorld(1, "arcade3v3");
  const goalie = world.goalies[0];
  const receiver = world.skaters.find((skater) => skater.teamId === goalie.teamId)!;
  receiver.position = { x: goalie.position.x + 420, y: goalie.position.y };
  receiver.velocity = { x: 0, y: 360 };
  world.puck.goalieCarrierId = goalie.id;

  stepGoalieOutlet(world, goalie, goalieInput(goalie, 1, { moveX: 1 }), 16);
  stepGoalieOutlet(world, goalie, goalieInput(goalie, 2, { pass: true, moveX: 1 }), 600);
  stepGoalieOutlet(world, goalie, goalieInput(goalie, 3, { pass: false, moveX: 1 }), 16);

  expect(world.puck.velocity.y).toBeGreaterThan(0);
  expect(magnitude(world.puck.velocity)).toBeCloseTo(2150, 0);
});
```

- [ ] **Step 2: Run the goalie test to verify it fails**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- goalieOutlet.test.ts`

Expected: FAIL because outlets release on the remembered raw aim and do not lead a recipient.

- [ ] **Step 3: Implement predictive outlet release**

In `releaseGoalieOutlet`, compute the release speed before choosing direction. Call `passTargetWithAssist` using the goalie id, team, hold position, remembered aim, and speed. Normalize from the hold position to that target when one exists; otherwise use `fallbackDirection(world, goalie)`. Keep timeout and reset behavior unchanged.

- [ ] **Step 4: Add a reception regression and run focused tests**

Extend `actions.test.ts` or `puck` coverage to place a same-team blade within `passCatchRadius` of a `2150` pass and assert it gathers. Then run:

`npm.cmd run test --workspace @bbh/arcade-core -- actions.test.ts goalieOutlet.test.ts passTargeting.test.ts`

Expected: PASS.

### Task 4: Verify and commit

**Files:**
- Verify: all files changed in Tasks 1–3.
- Create: `docs/superpowers/plans/2026-07-19-predictive-passing.md`.

- [ ] **Step 1: Run the complete suite**

Run: `npm.cmd test`

Expected: all arcade-core, arcade-server, and arcade-client tests pass.

- [ ] **Step 2: Typecheck and build**

Run: `npm.cmd run typecheck`

Run: `npm.cmd run build --workspace @bbh/arcade-client`

Expected: both commands succeed.

- [ ] **Step 3: Review and commit**

Run: `git diff --check; git status --short`

Expected: no whitespace errors and only predictive-passing files are changed.

```bash
git add docs/superpowers/plans/2026-07-19-predictive-passing.md packages/arcade-core/src/index.ts packages/arcade-core/src/sim/actions.ts packages/arcade-core/src/sim/actions.test.ts packages/arcade-core/src/sim/goalieOutlet.ts packages/arcade-core/src/sim/goalieOutlet.test.ts packages/arcade-core/src/sim/passTargeting.ts packages/arcade-core/src/sim/passTargeting.test.ts packages/arcade-core/src/sim/puck.ts
git commit -m "feat: add predictive passing"
```
