# Task 3 report — announcer resolution, queueing, and asset manifest

Date: 2026-07-17

## Scope completed

- Implemented pure announcer cue resolution in `packages/arcade-client/src/audio/announcer.ts`
- Added focused announcer tests in `packages/arcade-client/src/audio/announcer.test.ts`
- Added stable logical audio manifest in `packages/arcade-client/public/audio/manifest.json`
- Added asset/copy contract in `packages/arcade-client/public/audio/README.md`

## RED

Initial focused test command:

- `npm run test --workspace @bbh/arcade-client -- src/audio/announcer.test.ts`

Observed failures:

1. In the managed sandbox, Vitest hit the known startup access issue from the brief while loading the arcade-client config.
2. Re-running outside the sandbox produced the expected TDD failure:
   - `Failed to load url ./announcer.js ... Does the file exist?`

That established a real missing-implementation RED before production code was added.

## GREEN

Focused announcer tests (outside sandbox due the known startup issue):

- `npm run test --workspace @bbh/arcade-client -- src/audio/announcer.test.ts`
- Result: PASS, `12 passed`

Arcade typecheck (outside sandbox):

- `npm run typecheck`
- Result: PASS

## Tests added

`packages/arcade-client/src/audio/announcer.test.ts` covers:

- goal scorer lookup from `sourceSlotId`
- malformed goal fallback to `Unknown Player`
- powerup collector lookup via `sourceSlotId` plus type via `targetSlotId`
- unrelated event types returning `null`
- deterministic randomized goal-line selection from injected `random`
- powerup logical ID/copy resolution
- queue immediate first cue delivery
- 1.5 second cooldown enforcement
- release of queued cues after cooldown
- bounded queue behavior with one active + two queued survivors
- `interruptWith` dropping lower-priority pending cues
- goal-over-powerup tie breaking
- `clear()` reset behavior

## Files changed

- `packages/arcade-client/src/audio/announcer.ts`
- `packages/arcade-client/src/audio/announcer.test.ts`
- `packages/arcade-client/public/audio/manifest.json`
- `packages/arcade-client/public/audio/README.md`

## Self-review

- Resolver is pure and only depends on `WorldEvent`, `WorldState`, fixed `ARCADE_CHARACTERS`, and `POWERUP_DEFINITIONS`.
- Goal cues use priority `100` and stable logical IDs.
- Powerup cues use stable logical IDs and configured powerup types.
- No binary audio assets were added or required by tests.
- Queue logic is bounded and deterministic, with goals favored on equal priority.
- Manifest includes all 12 name IDs, 8 goal IDs, 6 powerup IDs, and `music.menu.0`.

## Concerns / notes

- The sandboxed arcade-client Vitest startup issue is still present and was not changed in scope; verification used the outside-sandbox runner as allowed by the brief.
- Queue overflow behavior before the first playback start is inferred as “keep the strongest three total candidates”; tests now lock that behavior in.
