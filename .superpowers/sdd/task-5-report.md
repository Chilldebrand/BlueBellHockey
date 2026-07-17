# Task 5 Report — 2026-07-17

## Summary

Implemented Task 5 audio/settings integration in the active arcade client surfaces without touching unrelated edits, prior audio commits, `HANDOFF.md`, or the untracked plan. Added a shared `SettingsOverlay`, threaded launchers through main menu/lobby/postgame/HUD/Free Skate, initialized audio from the Press Start user gesture, synced local audio preferences through `App`, gated menu music by screen/phase, and consumed both online and local world updates without introducing any pause behavior.

## RED / GREEN

### RED

- Added `packages/arcade-client/src/ui/SettingsOverlay.test.tsx` first.
- Verified the initial focused failure with:
  - `npm.cmd exec vitest --workspace @bbh/arcade-client -- run src/ui/SettingsOverlay.test.tsx`
- Exact RED result:
  - suite failed because `./SettingsOverlay.js` did not exist yet.

### GREEN

- Added `packages/arcade-client/src/ui/SettingsOverlay.tsx` with:
  - closed = render nothing
  - open = modal dialog + close button + shared `AudioSettings`
  - Escape listener only while open
  - backdrop click close + propagation stop on the panel
  - opener focus restoration on close via ref capture
- Tightened the test tree walker so nested `AudioSettings` inputs were actually traversed.
- Re-ran:
  - `npm.cmd exec vitest --workspace @bbh/arcade-client -- run src/ui/SettingsOverlay.test.tsx`
- Exact GREEN result:
  - `1 file passed, 3 tests passed`

## Files

### Created

- `packages/arcade-client/src/ui/SettingsOverlay.tsx`
- `packages/arcade-client/src/ui/SettingsOverlay.test.tsx`

### Modified

- `packages/arcade-client/src/App.tsx`
- `packages/arcade-client/src/ui/MainMenu.tsx`
- `packages/arcade-client/src/ui/Lobby.tsx`
- `packages/arcade-client/src/ui/Postgame.tsx`
- `packages/arcade-client/src/ui/HUD.tsx`
- `packages/arcade-client/src/ui/FreeSkate.tsx`
- `packages/arcade-client/src/styles/arcadeTheme.css`

## What changed

- `App.tsx`
  - holds `settingsOpen`
  - initializes `audioPreferences` from `loadAudioPreferences()`
  - keeps the injected/default `audioManager` identity stable via ref
  - calls `audioManager.setPreferences()` on changes
  - starts audio on Boot Splash “Press Start” before switching to menu
  - gates menu music to menu/lobby/postgame only
  - consumes authoritative room world updates keyed by world tick + local controlled entity
  - resets audio event cursor on new connection / disconnect / room mode changes
  - passes settings launchers and overlay props through menu, lobby, postgame, HUD, and Free Skate

- `FreeSkate.tsx`
  - exposes a visible Settings launcher
  - emits local world updates to App for audio consumption
  - renders the shared settings overlay without pausing the sim loop

- UI surfaces
  - added visible Settings launchers to:
    - main menu
    - lobby
    - postgame
    - HUD
    - Free Skate

- `arcadeTheme.css`
  - added overlay/backdrop/panel/header styling
  - preserved HUD interaction by removing the container-wide pointer lock and keeping non-interactive HUD elements pointer-transparent

## Verification run

### Focused UI tests

Ran successfully:

- `npm.cmd exec vitest --workspace @bbh/arcade-client -- run src/ui/SettingsOverlay.test.tsx src/ui/MainMenu.test.tsx src/ui/Lobby.test.tsx src/ui/Postgame.test.tsx src/ui/HUD.test.tsx src/App.test.tsx`

Result:

- `6 files passed`
- `14 tests passed`

### Typecheck

Ran successfully:

- `npm.cmd run typecheck`

Result:

- completed without TypeScript errors

### Broader checks

- Did not continue broad `test:arcade`/full client Vitest startup verification.
- Reason:
  - the task brief already calls out the known sandboxed arcade-client Vitest startup issue
  - current instruction was to stop broad verification and finish with focused UI/typecheck
  - no Vite/Vitest config was modified

## Self-review

- Confirmed Task 5 changes stayed inside the allowed arcade-client target files plus this required report.
- Confirmed unrelated `HANDOFF.md` and the untracked plan were left alone.
- Confirmed Settings overlay does not call any room pause API or local sim pause behavior.
- Confirmed Press Start now owns audio initialization from the user gesture path in `App`.
- Confirmed menu music is disabled for active match and Free Skate, and allowed for menu/lobby/postgame.
- Confirmed local Free Skate audio consumption uses the live controlled entity, including goalie-control transitions.

## Concerns / follow-up

- Focused UI coverage is good for the new overlay and existing surfaces, but there is still no direct automated assertion for:
  - menu-music gating transitions across every screen/phase combination
  - the exact online/local world-audio consumption sequence across reconnects
- Those behaviors are typechecked and code-reviewed here, but would benefit from dedicated integration tests later if this area keeps expanding.

## Task 5 review-fix addendum â€” 2026-07-17

### RED

- Added focused regressions for the three review findings in:
  - `packages/arcade-client/src/ui/runtimeGuards.test.ts`
  - `packages/arcade-client/src/input/keyboard.test.ts`
  - `packages/arcade-client/src/ui/SettingsOverlay.test.tsx`
- Re-ran only that focused subset outside the sandbox after the known arcade-client startup access issue blocked the sandboxed run.
- Exact RED findings from that focused run:
  - `src/ui/runtimeGuards.test.ts`: failed because `./runtimeGuards.js` did not exist yet
  - `src/input/keyboard.test.ts`: failed because `tracker.clear` did not exist
  - `src/ui/SettingsOverlay.test.tsx`: failed because overlay key handling did not stop gameplay-key propagation/default behavior

### GREEN

- Applied the minimal production fixes in:
  - `packages/arcade-client/src/App.tsx`
  - `packages/arcade-client/src/ui/FreeSkate.tsx`
  - `packages/arcade-client/src/ui/SettingsOverlay.tsx`
  - `packages/arcade-client/src/input/keyboard.ts`
  - `packages/arcade-client/src/ui/runtimeGuards.ts`
- Fix details:
  - menu music now keys off main menu / non-playing lobby / ended-postgame only
  - mount-time reconnect waits until the Boot Splash `Press Start` gesture has called `audioManager.start()`
  - opening settings clears held keyboard state and sends neutral live input in both App play and local Free Skate without pausing the sim loop
  - overlay keyboard listeners now swallow gameplay keys while preserving arrow-key slider defaults

### Final

- Ran only the requested focused verification after the SettingsOverlay handler follow-up fix:
  - `.\node_modules\.bin\vitest.cmd run packages/arcade-client/src/ui/runtimeGuards.test.ts packages/arcade-client/src/input/keyboard.test.ts packages/arcade-client/src/ui/SettingsOverlay.test.tsx packages/arcade-client/src/App.test.tsx`
  - `.\node_modules\.bin\tsc.cmd -p packages/arcade-client/tsconfig.json --noEmit`
- Exact final results:
  - Vitest: `4 files passed, 11 tests passed`
  - TypeScript: passed with exit code `0`
- SettingsOverlay review-fix detail:
  - preserved real close behavior on `keydown` only
  - made the shared handler fixture-safe by treating omitted `event.type` as `keydown` and optional-calling `stopPropagation` / `preventDefault`
- Remaining concern:
  - the known broad sandboxed arcade-client runner/startup issue still exists outside this focused scope, so broader suite status should not be inferred from this targeted GREEN run.
- Commit handoff status: `DONE`

## Task 5 reconnect dependency correction — 2026-07-17

### RED

- Ran exactly:
  - `.\node_modules\.bin\vitest.cmd run packages/arcade-client/src/App.test.tsx packages/arcade-client/src/ui/runtimeGuards.test.ts`
- Actual RED result:
  - `packages/arcade-client/src/ui/runtimeGuards.test.ts`: passed
  - `packages/arcade-client/src/App.test.tsx`: failed with `expected "spy" to be called 1 times, but got 0 times`
- Root cause confirmed:
  - the auto-reconnect `useEffect` still depended on `[connectionApi, runConnection]`, so flipping `audioReady` did not re-run the reconnect guard/effect
  - `handleCreatePrivateRoom` had an unrelated extra `audioReady` dependency even though the callback does not read it

### GREEN

- Applied the minimal production correction in `packages/arcade-client/src/App.tsx`:
  - added `audioReady` to the reconnect `useEffect` dependency array
  - removed `audioReady` from `handleCreatePrivateRoom` dependencies
- Kept the pending `App.test.tsx` callback-memoization regression and only fixed fixture typing drift needed for compile/runtime correctness:
  - `roomCode` now matches the current `ArcadeClientState` type
  - mocked `audio` now includes `getPreferences` and `consumeWorld` to satisfy `AudioManagerApi`

### Final verification

- Re-ran exactly:
  - `.\node_modules\.bin\vitest.cmd run packages/arcade-client/src/App.test.tsx packages/arcade-client/src/ui/runtimeGuards.test.ts`
  - `.\node_modules\.bin\tsc.cmd -p packages/arcade-client/tsconfig.json --noEmit`
- Actual final results:
  - Vitest: `2 files passed, 3 tests passed`
  - TypeScript: passed with exit code `0`

### Concerns

- `handleQuickMatch` still carries an unused `audioReady` dependency in the current diff; I left it untouched because this correction was scoped to the precise Task 5 reconnect fix you requested.

## Task 5 reconnect dependency cleanup follow-up — 2026-07-17

### Scope

- Removed the unnecessary `audioReady` dependency from both:
  - `handleQuickMatch`
  - `handleCreatePrivateRoom`
- Kept `audioReady` only on the reconnect `useEffect`

### Verification

- Ran exactly:
  - `.\node_modules\.bin\vitest.cmd run packages/arcade-client/src/App.test.tsx packages/arcade-client/src/ui/runtimeGuards.test.ts`
  - `.\node_modules\.bin\tsc.cmd -p packages/arcade-client/tsconfig.json --noEmit`
- Actual final results:
  - Vitest: `2 files passed, 3 tests passed`
  - TypeScript: passed with exit code `0`

### Notes

- One intermediate rerun failed because the reconnect effect accidentally lost `audioReady` while removing the callback dependencies; that was corrected immediately, and the final focused rerun above is the authoritative result.

## Task 5 final reconnect state â€” 2026-07-17

- Confirmed the intended dependency shape in `packages/arcade-client/src/App.tsx`:
  - reconnect-after-audio-init effect: `[audioReady, connectionApi, runConnection]`
  - `handleQuickMatch` / `handleCreatePrivateRoom`: `[connectionApi, runConnection]`
- Preserved the pending `App.test.tsx` reconnect regression and the existing settings/input/runtimeGuard changes.
- Final focused verification:
  - `.\node_modules\.bin\vitest.cmd run packages/arcade-client/src/App.test.tsx` â†’ `1 file passed, 1 test passed`
  - `.\node_modules\.bin\tsc.cmd -p packages/arcade-client/tsconfig.json --noEmit` â†’ passed

## Task 5 music guard Free Skate edge â€” 2026-07-17

### RED

- Added the focused impossible-but-testable regression in `packages/arcade-client/src/ui/runtimeGuards.test.ts` for `isMenuMusicAllowed("freeskate", "ended")`.
- Ran exactly:
  - `.\node_modules\.bin\vitest.cmd run packages/arcade-client/src/ui/runtimeGuards.test.ts`
- Actual RED result:
  - Vitest failed with `expected true to be false` at `isMenuMusicAllowed("freeskate", "ended")`

### GREEN

- Applied the minimal production fix in `packages/arcade-client/src/ui/runtimeGuards.ts`:
  - return `false` for every `freeskate` screen before the phase-based fallback

### Final verification

- Re-ran exactly:
  - `.\node_modules\.bin\vitest.cmd run packages/arcade-client/src/ui/runtimeGuards.test.ts`
  - `.\node_modules\.bin\tsc.cmd -p packages/arcade-client/tsconfig.json --noEmit`
- Actual final results:
  - Vitest: `1 file passed, 2 tests passed`
  - TypeScript: passed with exit code `0`

### Concerns

- No additional concerns beyond the already-documented broader suite caveats; this change is intentionally scoped to the shared runtime guard and its focused regression.

## Task 5 final review findings â€” 2026-07-17

### RED

- Restored the ended-match `App.test.tsx` coverage from `c9cdf12` and kept the reconnect lifecycle regression in the same focused file.
- Tightened `packages/arcade-client/src/ui/runtimeGuards.test.ts` so boot never enables menu music, even when the phase is `ended`, while lobby-ended remains allowed and Free Skate remains blocked.
- Ran exactly:
  - `.\node_modules\.bin\vitest.cmd run packages/arcade-client/src/App.test.tsx packages/arcade-client/src/ui/runtimeGuards.test.ts`
- Actual RED result after fixing the React test harness to exercise the real ended-match path:
  - `packages/arcade-client/src/App.test.tsx`: passed (`2 tests`)
  - `packages/arcade-client/src/ui/runtimeGuards.test.ts`: failed on `expected true to be false` for `isMenuMusicAllowed("boot", "ended")`

### GREEN

- Applied the minimal production fix in `packages/arcade-client/src/ui/runtimeGuards.ts`:
  - `boot` and `freeskate` now always return `false`
  - `menu` still returns `true`
  - `lobby` still returns `phase !== "playing"`, including ended postgame
- Kept the restored App postgame assertion and the reconnect regression intact.

### Final verification

- Re-ran exactly:
  - `.\node_modules\.bin\vitest.cmd run packages/arcade-client/src/App.test.tsx packages/arcade-client/src/ui/runtimeGuards.test.ts`
  - `.\node_modules\.bin\tsc.cmd -p packages/arcade-client/tsconfig.json --noEmit`
- Actual final results:
  - Vitest: `2 files passed, 4 tests passed`
  - TypeScript: passed with exit code `0`

### Scope

- Intentionally staged only:
  - `packages/arcade-client/src/App.test.tsx`
  - `packages/arcade-client/src/ui/runtimeGuards.ts`
  - `packages/arcade-client/src/ui/runtimeGuards.test.ts`
  - `.superpowers/sdd/task-5-report.md`
