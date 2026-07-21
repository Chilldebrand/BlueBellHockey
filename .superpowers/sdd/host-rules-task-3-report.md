# Task 3: Rules Panel and Overtime HUD Report

## Delivered

- Added `rules: MatchRules` to arcade client state. Room-state hydration now
  reads server rules and applies `DEFAULT_MATCH_RULES` to each missing field.
- Added `ArcadeRoomSession.setMatchRules(rules)`, which sends the exact
  `client.setMatchRules` message payload.
- Added a pre-game Lobby Rules button and compact expandable rule panel. It
  presents the core 3/5/7/10-minute and no-limit/3/5/7/10-goal presets, shows
  selected values to every participant, and permits changes only for the
  connected room creator. Other participants see disabled presets and the
  `Host controls rules` message.
- Wired the Lobby callback through `App` to the active room session without
  changing ready state behavior.
- Updated ScoreHud to show `NEXT GOAL` and an `OT` badge whenever a playing
  world reports overtime.

## TDD Evidence

New tests were added before production implementation for:

- Room-rule hydration and defaults.
- Exact session message payload.
- Host and non-host Lobby rules presentation.
- App-to-session rule delegation.
- Regular-clock and overtime ScoreHud rendering.

The initial focused red run failed with the expected absent behavior:

- `state.rules` was undefined during hydration.
- `ArcadeRoomSession.setMatchRules` did not exist.
- Lobby output lacked Rules controls and presets.
- ScoreHud still rendered `0:00` during overtime.
- App did not supply the Lobby rule callback.

After minimal implementation, the focused green run passed all five targeted
test files.

## Verification

- Focused client tests:
  `npm.cmd run test --workspace @bbh/arcade-client -- src/store.test.ts src/net/client.test.ts src/ui/Lobby.test.tsx src/App.test.tsx src/ui/ScoreHud.test.tsx`
  - 5 files passed, 29 tests passed.
- Full client suite:
  `npm.cmd run test --workspace @bbh/arcade-client`
  - 41 files passed, 192 tests passed.
- Typecheck:
  `npm.cmd run typecheck`
  - Passed for arcade core, server, and client project references.
- Patch hygiene:
  `git diff --check` passed with no whitespace errors.

## Self-Review

- Verified that the Lobby derives host authority from the connected local and
  room-creator session IDs; disabled controls never invoke callbacks.
- Verified preset values come directly from `TIME_LIMIT_OPTIONS_MS` and
  `GOAL_LIMIT_OPTIONS` and selection callbacks spread existing rules, so only
  the selected rule changes.
- Verified overtime UI is limited to `phase === "playing"` and
  `currentWorld.isOvertime`.
- Verified changed files are confined to the Task 3 brief plus this required
  report.

## Concerns

None.
