# Arcade AI Positioning And Decision-Making Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make arcade bots understand relative spacing, offensive support, open ice, defensive threats, transitions, and autonomous opportunities while preserving deterministic shared simulation.

**Architecture:** Evolve the existing deterministic `computeTeamPlan` and `selectBotDecision` flow into a tactical-context plus tactical-state system with utility-scored intents and destinations. Keep input generation in `bot.ts`, expose all gameplay knobs through `TUNING`, and share the same core behavior between the authoritative server and local simulation.

**Tech Stack:** TypeScript, `@bbh/arcade-core`, Vitest, existing `TUNING`/Feel Lab configuration, deterministic fixed-tick simulation.

## Global Constraints

- Preserve authoritative server simulation and shared-core determinism.
- Do not add external AI services, machine learning, or nondeterministic randomness.
- Preserve the existing human control, possession, and input-frame contracts.
- Use TDD for every behavior change: failing test, minimal implementation, focused test run, then regression test.
- Keep AI behavior in `packages/arcade-core`; do not create a second server-only planner.
- Keep the first pass limited to positioning, decisions, transitions, and tuning; do not expand character specials.

---

## File Map

- Modify: `packages/arcade-core/src/sim/ai/decision.ts` - preserve public decision exports while delegating to tactical context, state, role tendency, intent, and candidate scoring helpers.
- Modify: `packages/arcade-core/src/sim/ai/bot.ts` - convert selected intents into stable movement, aim, and action input without changing the shared input protocol.
- Create: `packages/arcade-core/src/sim/ai/tactics.ts` - define tactical states, immutable tactical context, bounded-awareness values, and deterministic state selection.
- Create: `packages/arcade-core/src/sim/ai/positions.ts` - generate candidate offensive and defensive destinations and score spacing, lanes, threat, support, and recovery.
- Create: `packages/arcade-core/src/sim/ai/tendencies.ts` - define role-tendency data and deterministic tendency lookup from existing skater/character identity.
- Modify: `packages/arcade-core/src/config/tuning.ts` - add the `ai` tuning group, defaults, reset, snapshot, and override support.
- Modify: `packages/arcade-core/src/sim/ai/decision.test.ts` - add tactical state, role, intent, spacing, pressure, autonomous action, and determinism coverage.
- Modify: `packages/arcade-core/src/sim/ai/bot.test.ts` - verify movement damping and input generation for the new intents.
- Create: `packages/arcade-core/src/sim/ai/tactics.test.ts` - test state and context derivation independently.
- Create: `packages/arcade-core/src/sim/ai/positions.test.ts` - test candidate generation and scoring independently.
- Create: `packages/arcade-core/src/sim/ai/tendencies.test.ts` - test stable tendency assignment and fallback behavior.
- Modify: `packages/arcade-core/src/config/tuning.test.ts` - verify AI tuning defaults, reset, snapshot, and overrides.
- Modify: `HANDOFF.md` - record the new AI architecture, completed milestones, and remaining playtest work after implementation.

## Interfaces

The implementation should introduce these shared-core contracts. Exact field names may be adjusted to match existing local conventions, but callers must not receive mutable world references.

```ts
export type TacticalState =
  | "attack"
  | "defend"
  | "transition"
  | "loose-puck"
  | "reset";

export type BotIntent =
  | "carry"
  | "support"
  | "cut"
  | "screen"
  | "stretch"
  | "trail"
  | "pressure"
  | "cover"
  | "protect-slot"
  | "recover"
  | "challenge-loose-puck"
  | "reset-shape";

export interface TacticalContext {
  readonly teamId: TeamId;
  readonly state: TacticalState;
  readonly carrierId: string | null;
  readonly threatId: string | null;
  readonly puckPosition: Vec2;
  readonly pressureBySlotId: ReadonlyMap<string, number>;
  readonly openLaneScores: ReadonlyMap<string, number>;
  readonly teammateSeparationBySlotId: ReadonlyMap<string, number>;
  readonly hasNumbersAdvantage: boolean;
}

export interface BotIntentChoice {
  readonly intent: BotIntent;
  readonly target: Vec2;
  readonly score: number;
  readonly reason: string;
}
```

### Task 1: Add AI tuning and stable tendency data

**Files:**
- Modify: `packages/arcade-core/src/config/tuning.ts`
- Create: `packages/arcade-core/src/sim/ai/tendencies.ts`
- Create: `packages/arcade-core/src/sim/ai/tendencies.test.ts`
- Modify: `packages/arcade-core/src/config/tuning.test.ts`

**Interfaces:**
- Produces `Tuning.ai` with all AI values needed by later tasks.
- Produces `BotTendency` and `tendencyForSkater(skater)` with deterministic fallback behavior.

- [ ] **Step 1: Write failing tests** for an AI tuning group containing spacing, awareness, pressure, role, transition, and action thresholds; test that a known character/slot returns the same tendency on repeated calls and unknown data returns the neutral support tendency.
- [ ] **Step 2: Run focused tests** with `npm.cmd run test --workspace @bbh/arcade-core -- src/config/tuning.test.ts src/sim/ai/tendencies.test.ts`; expect failures because `Tuning.ai` and tendency helpers do not exist.
- [ ] **Step 3: Add the minimal `AiTuning` interface and defaults** in `tuning.ts`, and include the group in `MutableTuning`, `buildDefaults`, `resetTuning`, `snapshotTuning`, and `applyTuning`.
- [ ] **Step 4: Add deterministic tendency lookup** in `tendencies.ts`, using existing character/slot information and a neutral fallback without randomness.
- [ ] **Step 5: Run the focused tests again** and expect all tuning and tendency tests to pass.
- [ ] **Step 6: Commit** with `git add packages/arcade-core/src/config/tuning.ts packages/arcade-core/src/config/tuning.test.ts packages/arcade-core/src/sim/ai/tendencies.ts packages/arcade-core/src/sim/ai/tendencies.test.ts && git commit -m "feat(ai): add arcade tuning and role tendencies"`.

### Task 2: Derive tactical context and bounded-awareness state

**Files:**
- Create: `packages/arcade-core/src/sim/ai/tactics.ts`
- Create: `packages/arcade-core/src/sim/ai/tactics.test.ts`

**Interfaces:**
- Consumes `WorldState`, `TeamId`, and `TUNING.ai`.
- Produces `buildTacticalContext(world, teamId): TacticalContext` and `selectTacticalState(context): TacticalState`.

- [ ] **Step 1: Write failing tests** for attack with a friendly carrier, defend with an opponent carrier, loose-puck contest, transition after a recent possession change, and reset when no useful tactical signal exists.
- [ ] **Step 2: Add tests** proving pressure values increase near opponents, open-lane scores are deterministic, and bounded awareness does not change the world or depend on wall-clock time.
- [ ] **Step 3: Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/tactics.test.ts`** and verify the new tests fail for missing context functions.
- [ ] **Step 4: Implement immutable context derivation** from the existing world snapshot, using deterministic sorting and `TUNING.ai` reaction/awareness thresholds.
- [ ] **Step 5: Implement tactical-state selection** with explicit precedence: active possession, recent transition, loose puck, defensive threat, then reset.
- [ ] **Step 6: Run the focused tests and the existing AI tests** with `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/tactics.test.ts src/sim/ai/decision.test.ts`; expect PASS.
- [ ] **Step 7: Commit** with `git add packages/arcade-core/src/sim/ai/tactics.ts packages/arcade-core/src/sim/ai/tactics.test.ts && git commit -m "feat(ai): derive deterministic tactical context"`.

### Task 3: Generate and score relative movement destinations

**Files:**
- Create: `packages/arcade-core/src/sim/ai/positions.ts`
- Create: `packages/arcade-core/src/sim/ai/positions.test.ts`

**Interfaces:**
- Consumes `TacticalContext`, `SkaterEntity`, `WorldState`, `BotTendency`, and `TUNING.ai`.
- Produces `chooseBotIntent(bot, world, context): BotIntentChoice` and exported pure helpers for candidate generation used by tests.

- [ ] **Step 1: Write failing tests** for distinct support, cut, stretch/trail, pressure, cover, protect-slot, recover, and loose-puck targets in representative 3v3 layouts.
- [ ] **Step 2: Add failure cases** proving a candidate inside teammate separation is penalized, an opponent-occupied passing lane is penalized, an open slot lane is rewarded, and defensive slot protection beats a wide puck chase when pressure is unsafe.
- [ ] **Step 3: Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/positions.test.ts`** and verify failures.
- [ ] **Step 4: Implement candidate generation** from puck, goal, teammate, opponent, and rink geometry. Keep candidates bounded to the rink and deterministically ordered.
- [ ] **Step 5: Implement utility scoring** for spacing, open ice, passing angle, shot lane, slot danger, defensive threat, role tendency, human-carrier support, and recovery.
- [ ] **Step 6: Add intent-switch hysteresis** using the AI tuning group so a bot does not change targets every tick for tiny score differences.
- [ ] **Step 7: Run focused position tests and `decision.test.ts`** and expect PASS before integrating the new chooser.
- [ ] **Step 8: Commit** with `git add packages/arcade-core/src/sim/ai/positions.ts packages/arcade-core/src/sim/ai/positions.test.ts && git commit -m "feat(ai): score relative hockey movement"`.

### Task 4: Integrate tactical choices into bot decisions

**Files:**
- Modify: `packages/arcade-core/src/sim/ai/decision.ts`
- Modify: `packages/arcade-core/src/sim/ai/decision.test.ts`

**Interfaces:**
- Preserves `selectBotDecision`, `assignTeamRoles`, `chooseBotRole`, `botTargetForRole`, `shouldPass`, `shouldShoot`, and existing public types where compatibility is required.
- Extends `BotDecision` with `state`, `intent`, `reason`, and `decisionScore` without removing current action fields.

- [ ] **Step 1: Write failing integration tests** for human-carrier support, autonomous bot shot selection, autonomous pass selection, defensive situational pressure, and turnover recovery.
- [ ] **Step 2: Add deterministic replay assertions** that the same world and tick produce byte-equivalent decisions for every bot.
- [ ] **Step 3: Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/decision.test.ts`** and verify failures for the new fields and behaviors.
- [ ] **Step 4: Integrate `buildTacticalContext` and `chooseBotIntent`** into `selectBotDecision`, preserving powerup and special decisions while making movement and aim follow the selected intent.
- [ ] **Step 5: Keep compatibility role exports** by mapping the new intent/state to the current positional role vocabulary until callers are migrated.
- [ ] **Step 6: Update pass and shot decisions** to compare the best autonomous opportunity against the human-support and carry alternatives using `TUNING.ai` thresholds.
- [ ] **Step 7: Run all arcade-core tests** with `npm.cmd run test --workspace @bbh/arcade-core`; expect PASS.
- [ ] **Step 8: Commit** with `git add packages/arcade-core/src/sim/ai/decision.ts packages/arcade-core/src/sim/ai/decision.test.ts && git commit -m "feat(ai): integrate tactical bot decisions"`.

### Task 5: Update input generation and movement settling

**Files:**
- Modify: `packages/arcade-core/src/sim/ai/bot.ts`
- Modify: `packages/arcade-core/src/sim/ai/bot.test.ts`

**Interfaces:**
- Consumes the extended `BotDecision` from Task 4.
- Produces the same `InputFrame` shape already consumed by the deterministic simulation.

- [ ] **Step 1: Write failing tests** for full-speed carry/pressure movement, eased station movement, braking near a support target, and stable movement when the intent target has not changed.
- [ ] **Step 2: Add tests** proving movement does not cause station-role overshoot, cross-team control ownership, or stale shooting/passing input after a state change.
- [ ] **Step 3: Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/bot.test.ts`** and verify failures where the new intent-specific movement is expected.
- [ ] **Step 4: Implement intent-aware throttle and steering** while preserving the current input protocol, shot flick behavior, check behavior, turbo behavior, and deterministic sequence numbers.
- [ ] **Step 5: Run bot tests plus the full arcade-core suite** and expect PASS.
- [ ] **Step 6: Commit** with `git add packages/arcade-core/src/sim/ai/bot.ts packages/arcade-core/src/sim/ai/bot.test.ts && git commit -m "feat(ai): settle bot movement by intent"`.

### Task 6: Add deterministic scenario coverage and tuning verification

**Files:**
- Modify: `packages/arcade-core/src/sim/ai/tactics.test.ts`
- Modify: `packages/arcade-core/src/sim/ai/positions.test.ts`
- Modify: `packages/arcade-core/src/sim/ai/decision.test.ts`
- Modify: `packages/arcade-core/src/sim/ai/bot.test.ts`
- Modify: `packages/arcade-core/src/config/tuning.test.ts`

**Interfaces:**
- Consumes all completed AI interfaces and the existing world test fixtures.
- Produces repeatable scenario tests that serve as regression contracts for future tuning.

- [ ] **Step 1: Add a breakout scenario** asserting one outlet, one attack option, and one safety option instead of three clustered targets.
- [ ] **Step 2: Add a supported-rush scenario** asserting a human carrier gets a useful passing angle and a second bot stretches or trails.
- [ ] **Step 3: Add a 2-on-1 defensive scenario** asserting slot protection and threat coverage outrank an unsafe puck chase.
- [ ] **Step 4: Add a turnover scenario** asserting immediate counterattack support and defensive recovery assignments.
- [ ] **Step 5: Add a loose-puck scenario** asserting a winnable contest sends one racer while the other skaters preserve shape.
- [ ] **Step 6: Add tuning override tests** proving Feel Lab changes spacing, pressure, reaction delay, and action thresholds without changing public contracts.
- [ ] **Step 7: Run `npm.cmd run test --workspace @bbh/arcade-core` and `npm.cmd run typecheck`**; expect PASS.
- [ ] **Step 8: Commit** with `git add packages/arcade-core/src/sim/ai packages/arcade-core/src/config/tuning.test.ts && git commit -m "test(ai): lock arcade positioning scenarios"`.

### Task 7: Integrate, inspect, and update the handoff

**Files:**
- Modify: `HANDOFF.md`
- Review: `packages/arcade-server/src/rooms/ArcadeRoom.test.ts`
- Review: `packages/arcade-client/src/game/localSim.test.ts`

**Interfaces:**
- Consumes the completed shared-core AI behavior.
- Produces verified server and local-simulation integration with an updated handoff.

- [ ] **Step 1: Run the full project tests** with `npm.cmd run test` and record the result.
- [ ] **Step 2: Run `npm.cmd run typecheck`** and record the result.
- [ ] **Step 3: Run `npm.cmd run smoke --workspace @bbh/arcade-server`** to verify the authoritative room still starts and fills bot slots.
- [ ] **Step 4: Start `npm.cmd run dev`** and manually inspect at least one attack, defensive recovery, turnover, and loose-puck sequence in the browser.
- [ ] **Step 5: Use structured decision/debug output** to tune only the new AI values; record any changed defaults in `TUNING` and tests.
- [ ] **Step 6: Update `HANDOFF.md`** with the new architecture, test totals, manual verification notes, and remaining visual-feel follow-up.
- [ ] **Step 7: Commit** with `git add HANDOFF.md packages/arcade-core/src/sim/ai packages/arcade-core/src/config/tuning.ts && git commit -m "feat(ai): ship arcade positioning system"`.

## Verification Commands

Run from the repository root:

```powershell
npm.cmd run test --workspace @bbh/arcade-core
npm.cmd run typecheck
npm.cmd run smoke --workspace @bbh/arcade-server
npm.cmd run test
```

Expected result: all existing tests plus the new AI scenario tests pass; typecheck succeeds; the server smoke test starts successfully; and no client/server contract changes are required for bot input.

## Self-Review

- Spec coverage: tactical states are covered by Tasks 2 and 4; spacing and offense by Task 3; defense by Tasks 2, 3, and 6; transitions by Tasks 2, 4, and 6; autonomous actions by Task 4; tuning by Tasks 1 and 6; deterministic verification by Tasks 2, 4, and 6; integration by Task 7.
- Placeholder scan: no task depends on an unspecified future subsystem; every task names files, interfaces, tests, commands, and commit boundaries.
- Type consistency: `TacticalContext`, `BotIntent`, and `BotIntentChoice` are defined before their consumers; `Tuning.ai` is introduced before tactical and positioning tasks consume it.
