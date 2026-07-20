# Task 2 Completion Report: Authoritative Names, Readiness, and Creator Start Gating

## Scope

Implemented Task 2 in the authoritative arcade-server room and roster layers.
The five files listed in the brief contain the feature implementation and focused
coverage. `performance.test.ts` was additionally updated because its old setup
started a newly joined, now-unready player; it now explicitly marks that player
ready through the new client message before measuring live tick performance.

## Delivered behavior

- Every roster slot has replicated `ready` state. Human assignments start
  unready; bot, open, moved, and released slots are unready as appropriate.
- Added and covered `setHumanPlayerName`, `setHumanReady`, `allHumansReady`, and
  `earliestHumanSessionId`. Name, team, and a changed own-slot character choice
  clear readiness. Bot readiness is ignored when evaluating readiness.
- Added lobby-only `client.setPlayerName` and `client.setReady` handlers. Names
  continue to use the existing 24-character sanitizer; both messages reject
  missing human slots and live-match mutation attempts.
- The first joining human becomes `roomCreatorSessionId`. It is replicated,
  survives reconnect grace, and transfers on deliberate leave (or expired grace)
  to the earliest remaining human by global `teamJoinOrder`, then `slotId`.
- Room slots replicate `ready` and nullable numeric `teamJoinOrder`; room state
  replicates nullable `roomCreatorSessionId`.
- Start now preserves `isRosterValid` as the filled-seat flag and additionally
  requires a waiting world, the room creator, and every human ready.

## Red-green evidence

The initial focused run reproduced the interrupted implementation's missing
start gate: 75 passed and 1 failed. A non-creator changed the phase to `playing`
because `handleRequestStart` had removed the former roster check without adding
creator/readiness validation. After adding the authoritative checks, the focused
suite passed 76/76.

The first full run then found one dependent stale performance setup (79/80): it
requested start before marking its solo player ready. Updating that test to use
`client.setReady` produced a passing focused performance test and full suite.

## Verification

- Focused: `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/roster.test.ts src/rooms/ArcadeRoom.test.ts` — 76 passed, 0 failed.
- Downstream readiness setup: `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/performance.test.ts` — 1 passed, 0 failed.
- Full: `npm.cmd run test --workspace @bbh/arcade-server` — 80 passed, 0 failed across 5 files.
- `git diff --check` reported no whitespace errors (only the repository's
  existing line-ending conversion warnings).

## Self-review

Reviewed the server-side authority boundaries, roster mutation invariants,
creator transfer ordering, reconnect preservation, and schema synchronization.
No unresolved implementation concerns remain. The only scope expansion is the
necessary performance-test readiness setup described above.

## P1 review fix: waiting-only name and readiness updates

The review found that `client.setPlayerName` and `client.setReady` rejected only
the `playing` phase, so an ended room still accepted and replicated both
mutations. Both handlers now reject every phase other than `waiting`.

Added an ended-phase regression that attempts to change the joined player's
name and ready state, then verifies both remain unchanged and server errors are
sent. The regression first failed as expected: the ended handlers changed
`Ada` to `Changed` and `ready` from `false` to `true`.

- Focused: `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/roster.test.ts src/rooms/ArcadeRoom.test.ts` - 77 passed, 0 failed.
- Full: `npm.cmd run test --workspace @bbh/arcade-server` - 81 passed, 0 failed across 5 files.
