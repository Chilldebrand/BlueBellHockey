# Goalie Task 1 Report: Explicit Covered-Save Possession

## Result

Implemented explicit goalie possession for covered saves. Covers retain their save/cover events and statistics, hold the puck at a deterministic up-ice offset, and no longer reset the faceoff or skater positions. Hot-save rebounds remain live.

## RED evidence

Command:

```text
npm.cmd run test --workspace @bbh/arcade-core -- src/sim/goalie.test.ts src/sim/goal.test.ts src/sim/puck.test.ts
```

Before production changes: 6 failures, 37 passing tests. The failures established missing `goalieCarrierId`, missing `goalieHoldPosition`, the old cover-to-faceoff behavior, missing held-puck physics/pickup guard, reset cleanup, and goal-resolution guard. A refined carrier-conflict test then failed specifically because a skater carrier remained set while a goalie holder was present.

## GREEN evidence

- Focused goalie/goal/puck tests: 44/44 passed.
- Determinism: `src/sim/determinism.test.ts` passed 2/2.
- Full arcade-core suite: 26 files, 200/200 tests passed.
- Core build/typecheck: `npm.cmd run build --workspace @bbh/arcade-core` passed.
- `git diff --check` passed.

Root typecheck was run and is currently blocked by an out-of-scope fixture at `packages/arcade-client/src/render/animation/animation.test.ts:43`. That fixture manually constructs `PuckState` and needs the newly required `goalieCarrierId: null`; it was intentionally not edited because this task owns only the brief's files.

## Files

- `packages/arcade-core/src/sim/types.ts`
- `packages/arcade-core/src/sim/puck.ts`
- `packages/arcade-core/src/sim/goalie.ts`
- `packages/arcade-core/src/sim/goal.ts`
- `packages/arcade-core/src/sim/goalie.test.ts`
- `packages/arcade-core/src/sim/goal.test.ts`
- `packages/arcade-core/src/sim/puck.test.ts`
- `.superpowers/sdd/task-goalie-1-report.md`

`packages/arcade-core/src/sim/world.ts` did not require a change: the puck is initialized through `createInitialPuckState`, and existing world ordering already runs goalie tracking after the puck guard.

## Commit

`37a99b7 feat(goalie): hold covered saves`

## Self-review

- `carrierSlotId` remains skater-only; goalie possession uses `goalieCarrierId`, and the puck step repairs a conflicting state in favor of the goalie holder.
- A cover clears shot/pass/loose-puck state, zeros all puck movement/lift, preserves save and shot stats/events, and does not invoke `resetForFaceoff`.
- Held pucks cannot drift, be picked up by skaters, or resolve as goals; after goalie tracking they follow `goalieHoldPosition`.
- No human goalie input, outlet passing, goalie skating, or unrelated systems were added or changed.

## Concern

No concerns identified. This was a mechanical typed-fixture update only; production behavior was not changed.

## Cross-task Fixture Integration

### Commands and Results

- `npm.cmd run test --workspace @bbh/arcade-client -- src/render/animation/animation.test.ts` — passed, 1 file / 3 tests.
- `npm.cmd run test --workspace @bbh/arcade-client` — passed, 26 files / 85 tests.
- `npm.cmd run typecheck` — passed (`tsc -b packages/arcade-core packages/arcade-server packages/arcade-client`).
- `git diff --check` — passed.

### Commit

`fix(goalie): update client puck fixture`

### Files

- `packages/arcade-client/src/render/animation/animation.test.ts`
- `.superpowers/sdd/task-goalie-1-report.md`

### Self-review

- Added only `goalieCarrierId: null` to the manual `PuckState` fixture, in the current core type's field order.
- No production behavior or unrelated files were changed.
