# Task 2 Report — Web Audio runtime and menu music

## Status

DONE

## Files

- `packages/arcade-client/src/audio/AudioManager.test.ts`
- `packages/arcade-client/src/audio/AudioManager.ts`
- `packages/arcade-client/src/audio/music.ts`
- `packages/arcade-client/src/audio/synth.ts`

## RED evidence

Focused test command required the known outside-sandbox runner because the sandboxed run failed at Vite startup resolving `packages/arcade-client/vite.config.ts`.

Outside-sandbox focused RED run:

```text
Command: npm test -- src/audio/AudioManager.test.ts
Result: FAIL
Reason: Failed to load url ./AudioManager.js in src/audio/AudioManager.test.ts. Does the file exist?
```

That verified the new lifecycle test was failing for the expected missing-runtime reason before implementation.

## GREEN evidence

Focused lifecycle test:

```text
Command: npm test -- src/audio/AudioManager.test.ts
Result: PASS
Tests: 4 passed
```

Arcade client TypeScript check:

```text
Command: npx tsc -p tsconfig.json --noEmit
Result: PASS
```

## What changed

- Added lifecycle tests with injected Web Audio/window fakes covering:
  - idempotent `start()`
  - one context and one gain stage per manager bus setup
  - loaded preference application
  - deferred menu music start until `start()`
  - menu fade-out and timer cleanup on disable
  - safe `dispose()` before/after initialization
  - safe no-op behavior without Web Audio support
- Added `synth.ts` helpers for:
  - safe AudioContext construction with `AudioContext` / `webkitAudioContext`
  - cached noise-buffer creation
  - tone/noise envelope scheduling
  - rejected `resume()` swallowing via `safeResume()`
- Added `music.ts` `MenuMusic` scheduler:
  - legacy menu progression adaptation
  - 25ms lookahead timer
  - single active timer guarantee
  - fade-to-silence disable behavior
  - timer cleanup on `dispose()`
- Added `AudioManager.ts` runtime:
  - loads Task 1 audio preferences on construction
  - creates master/announcer/gameplay/music gain buses
  - persists and reapplies preferences
  - gates menu music on `start()` and allow flag
  - keeps world/event methods present as no-ops for later slices
  - safely handles unavailable Web Audio

## Self-review

- Stayed within the four files named by the brief.
- Reused Task 1 `AudioPreferences`, `loadAudioPreferences`, and `saveAudioPreferences`.
- Did not touch legacy packages, Vite config, or unrelated local edits.
- Kept simulation-facing methods inert so audio does not affect authority/prediction/replay.
- Chose a minimal pointerdown resume listener so lifecycle cleanup includes listener removal and `start()` idempotency remains testable.

## Concerns

- `scheduleNoiseBurst()` is present to satisfy the synth-helper requirement but is not exercised by Task 2 lifecycle tests yet.
- `consumeWorld()` and `resetEventCursor()` are intentional placeholders for later event-audio slices, as required by the brief.

---

## Task 2 review fixes — July 17, 2026

### Findings addressed

- `AudioManager.setPreferences()` now normalizes each bus independently to finite `0..1` values, using the existing per-bus defaults for non-finite inputs, before storing, persisting, and applying live gains.
- `createAudioContext()` now catches constructor failures and returns `null`, so `AudioManager.start()` stays silent and non-fatal when browser audio context construction fails.

### RED evidence

```text
Command: .\node_modules\.bin\vitest.cmd run packages/arcade-client/src/audio/AudioManager.test.ts
Result: FAIL
Failures:
- normalizes each bus in setPreferences before storing and applying runtime gains
- stays safe when AudioContext construction throws during start
```

### GREEN evidence

```text
Command: .\node_modules\.bin\vitest.cmd run packages/arcade-client/src/audio/AudioManager.test.ts
Result: PASS
Tests: 6 passed
```

### Final verification

```text
Command: .\node_modules\.bin\tsc.cmd -p packages/arcade-client/tsconfig.json --noEmit
Result: PASS
```
