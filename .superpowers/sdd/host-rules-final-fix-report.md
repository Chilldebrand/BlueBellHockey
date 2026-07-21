# Host Rules Final-Review Fix Report

## Delivered

- Added an optimistic Lobby match-rules draft. Each host preset callback now
  composes its complete payload from the pending draft when present, rather
  than from a stale replicated snapshot.
- Kept the draft while an older replicated update is observed and cleared it
  only once replication matches the complete pending selection.
- Restricted the Rules button, panel, and editable presets to a connected
  room in the `waiting` phase. Non-host participants in that state can still
  view the panel but cannot edit it.

## TDD Evidence

Regression tests were added before the implementation. The initial focused
run failed as expected because the draft helpers were absent and the Rules
button was rendered outside an active waiting room.

The new rapid-selection regression verifies the exact outbound sequence:

1. Selecting seven minutes sends `{ timeLimitMs: 420000, goalLimit: 0 }`.
2. Immediately selecting seven goals sends
   `{ timeLimitMs: 420000, goalLimit: 7 }`.

It also verifies that an intermediate replicated first payload does not erase
the complete optimistic draft.

## Verification

- Focused Lobby tests: 1 file, 10 tests passed.
- Full arcade-client suite: 41 files, 195 tests passed.
- Client typecheck: `npx.cmd tsc --noEmit --project packages\\arcade-client\\tsconfig.json` passed.
- `git diff --check` passed with no whitespace errors before the report was
  added; final diff hygiene is re-run before commit.

## Scope

Changed only `packages/arcade-client/src/ui/Lobby.tsx`, its focused test, and
this final-review report. No server behavior or unrelated client flow changed.
