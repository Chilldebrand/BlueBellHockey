# Task 4 Report — gameplay effects and speed-driven skating

Date: 2026-07-17

## Scope

Implemented Task 4 in the active arcade client only, limited to:

- `packages/arcade-client/src/audio/gameplay.ts`
- `packages/arcade-client/src/audio/gameplay.test.ts`
- `packages/arcade-client/src/audio/AudioManager.ts`

Preserved unrelated workspace edits, including `HANDOFF.md` and the untracked plan.

## Requirements read first

Read and followed:

- `.superpowers/sdd/task-4-brief.md`

Also inspected the real shared data contracts before coding:

- `packages/arcade-core/src/sim/types.ts` for `WorldEvent`, `SkaterEntity`, and `WorldState`
- `packages/arcade-core/src/sim/goalie.ts`, `puck.ts`, `actions.ts`, `collision.ts`, and `powerups.ts` for actual emitted event names/details

## TDD log

### RED

1. Added `packages/arcade-client/src/audio/gameplay.test.ts` first.
2. Wrote tests for:
   - every supported gameplay event mapping
   - all save `detail` variants
   - hit force normalization
   - silence for unknown / announcer-only / spawn events
   - zero-speed skating silence
   - monotonic skating gain and playback-rate growth
   - AudioManager no-op safety before audio start
   - AudioManager event-ID deduplication and persistent skating source behavior
   - goalie / missing-local-entity skating mute behavior
3. First focused run in sandbox failed before execution because the local arcade-client Vitest/Vite startup hit the known access-denied environment issue.
4. Per brief allowance, reran focused tests outside sandbox.
5. RED result: suite failed because `src/audio/gameplay.ts` did not exist yet.

### GREEN

Implemented minimal production changes:

- Added pure `gameplayCueForEvent(...)` mapping with:
  - supported cue ids only
  - fixed hit-force normalization cap
  - save-detail mapping for `pad`, `body`, `glove`, `blocker`, `cover`
  - null for unsupported / announcer-only / spawn events
- Added pure `skatingMixForSpeed(...)` with:
  - low-speed silence threshold
  - clamped `0..1` gain
  - bounded playback-rate range
- Wired `AudioManager.consumeWorld(...)` to:
  - no-op safely before audio init
  - dedupe event playback by event id across repeated snapshots
  - keep only live event ids retained
  - synthesize gameplay effects on the gameplay bus
  - create exactly one persistent looping skating source
  - update skating gain/rate from `Math.hypot(skater.velocity.x, skater.velocity.y)`
  - mute skating when the local entity is absent or not a skater
- Wired `resetEventCursor()` to clear dedup state.

Focused GREEN run passed after implementation.

### Post-GREEN fix

Typecheck caught one integration mistake:

- `AudioParam.setTargetAtTime(...)` needed the time-constant argument.

Patched that and reran focused verification successfully.

## Verification run

### Focused tests

Command:

- `npm run test --workspace @bbh/arcade-client -- gameplay.test.ts AudioManager.test.ts`

Result:

- Passed: 2 files, 14 tests

### Focused RED proof

Command:

- `npm run test --workspace @bbh/arcade-client -- gameplay.test.ts`

Initial result:

- Sandbox/local Vitest startup issue (`Access is denied`) blocked execution

Outside-sandbox rerun result:

- Failed because `./gameplay.js` did not exist yet

### Typecheck

Command:

- `npm run typecheck`

Result:

- Passed after the `setTargetAtTime` fix

### Broad suite

Did not wait on `npm run test:arcade` startup after the user's follow-up instruction:

> “once tests and integration are complete, commit/report rather than waiting on broad suite startup.”

## Files changed

### `packages/arcade-client/src/audio/gameplay.ts`

- New pure mapping/mix module for gameplay cues and skating audio mix math.

### `packages/arcade-client/src/audio/gameplay.test.ts`

- New focused tests covering Task 4 mapping, mix behavior, and AudioManager runtime integration.

### `packages/arcade-client/src/audio/AudioManager.ts`

- Runtime integration for event-driven gameplay effects
- Event-id deduplication
- Persistent skating source setup/update
- Reset/cleanup support for the new audio state

## Self-review

- Verified the actual `WorldEvent` shape and sim-emitted event names/details before implementation.
- Kept all behavior client-audio-only; no sim, prediction, replay, or authority logic was touched.
- Used `world.skaters.find(...)` with `localEntityId`, so goalie ids naturally mute skating instead of producing a false local skater match.
- Ensured announcer-only and spawn events do not generate gameplay cues.
- Preserved safety before audio start by returning early when context/gameplay bus is unavailable.
- Preserved repeated-snapshot safety with event-id deduplication, while pruning to currently live queue ids to avoid unbounded growth.

## Concerns / follow-ups

1. Gameplay effect synthesis is intentionally lightweight and procedural for this task; if richer authored arcade SFX are desired later, the cue mapping layer can stay while the playback layer swaps implementations.
2. The local arcade-client Vitest run still needs the outside-sandbox path in this environment because of the known Vite/Vitest startup access issue.
3. I followed the user's instruction not to wait on broad `test:arcade` startup after focused verification and typecheck completed.
