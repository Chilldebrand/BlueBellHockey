# Postgame Plan Task 2 Report

## Outcome

Implemented deterministic primary-assist tracking and committed it as:

`69474da feat(stats): award primary assists`

The worktree is clean after the commit. The commit contains exactly the nine Task 2 files listed below.

## TDD evidence

### RED

Added lifecycle assertions before production changes, then ran the required focused command:

```text
npm.cmd run test --workspace @bbh/arcade-core -- src/sim/puck.test.ts src/sim/goal.test.ts src/sim/goalie.test.ts
```

Observed the expected RED result:

- 3 test files ran.
- 33 existing tests passed.
- 5 new lifecycle assertions failed because `assistCandidateSlotId` was undefined or remained set, and the primary assist remained `0`.
- Failures covered teammate reception, opponent possession clearing, faceoff clearing, assist credit, and self-assist prevention.

### GREEN

After the minimal production implementation, the focused command passed:

- 3 test files passed.
- 38 tests passed.

The full core suite passed:

```text
npm.cmd run test --workspace @bbh/arcade-core
```

- 26 test files passed.
- 194 tests passed.

The TypeScript build also passed:

```text
npm.cmd run build --workspace @bbh/arcade-core
```

## Implementation

- Added and initialized `PuckState.assistCandidateSlotId: string | null`.
- Same-team completed pass receptions record the passer.
- Opponent possession/interception, opponent poke, check strip, goalie save, banana/freeze possession loss, and faceoff reset clear the candidate.
- Goal resolution awards one assist only when candidate and scorer are distinct skaters on the scoring team.
- Added lifecycle coverage for reception, goal credit, no self-assist, opponent possession, goalie save, and faceoff reset.

## Changed files

- `packages/arcade-core/src/sim/types.ts`
- `packages/arcade-core/src/sim/puck.ts`
- `packages/arcade-core/src/sim/actions.ts`
- `packages/arcade-core/src/sim/goalie.ts`
- `packages/arcade-core/src/sim/powerups.ts`
- `packages/arcade-core/src/sim/goal.ts`
- `packages/arcade-core/src/sim/puck.test.ts`
- `packages/arcade-core/src/sim/goal.test.ts`
- `packages/arcade-core/src/sim/goalie.test.ts`

## Self-review

- Confirmed no unrelated files were staged or committed.
- Confirmed `git diff --check` reported no whitespace errors.
- Confirmed goal credit validates both team identity and distinct player identity.
- Confirmed reset paths remove stale candidate state before the next faceoff.

Concern: the brief restricts production edits to the named Task 2 files. The existing generic skater-collision jostle path lives in `collision.ts`, which is outside that allowed list and does not assign a new `lastTouchSlotId`; it was therefore intentionally left untouched. Explicit opponent poke/check, goalie, powerup, interception, and faceoff paths in the allowed files clear the candidate.

## Task 2 follow-up fix

### TDD evidence

Added a focused regression test for an opponent diving block, then ran the required RED command:

```text
npm.cmd run test --workspace @bbh/arcade-core -- src/sim/puck.test.ts src/sim/goal.test.ts src/sim/goalie.test.ts
```

Observed RED:

- 2 test files passed and 1 test file failed.
- 38 tests passed and 1 test failed.
- The failing test was `clears the primary-assist candidate when an opponent diving block is the last touch`.
- Failure: expected `null`, received `"home-skater-1"`; `lastTouchSlotId` was the opponent blocker.

Added the minimal candidate clear at the opponent diving-block touch, then reran the focused command.

Observed GREEN:

- 3 test files passed.
- 39 tests passed.

Full suite evidence:

```text
npm.cmd run test --workspace @bbh/arcade-core
```

- 26 test files passed.
- 195 tests passed.

### Files and commit

Modified only:

- `packages/arcade-core/src/sim/puck.ts`
- `packages/arcade-core/src/sim/puck.test.ts`
- `.superpowers/sdd/task-pg-2-report.md` (append-only)

Commit:

`fix(stats): clear assists on opponent blocks`

### Self-review

- Confirmed the production change is one line at the exact diving-block touch after `lastTouchSlotId` is assigned.
- Confirmed the regression test uses `stepPuck` to isolate the puck block path from unrelated world collision/possession clearing.
- Confirmed focused and full core suites pass, and `git diff --check` reports no whitespace errors.
- Confirmed no unrelated files are staged or included in the follow-up commit.
