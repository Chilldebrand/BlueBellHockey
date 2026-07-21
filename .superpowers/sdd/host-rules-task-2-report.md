# Task 2 TDD Report: Replicated, Host-Owned Room Rules

## Root Cause and Design

The room did not retain a selected `MatchRules` value, replicate it through
`ArcadeRoomState`, or supply it when creating replacement worlds. The design
adds an `ArcadeMatchRulesState`, a copied room-owned `matchRules` value, and a
single fresh-world factory that applies the stored rules and current roster
characters. `client.setMatchRules` is rate limited, waiting-phase-only,
creator-only, and validated by `isMatchRules`; a valid request resets only the
waiting world and replicated rules, leaving roster readiness untouched.

## Changed Files

- `packages/arcade-server/src/rooms/schema.ts`
- `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- `packages/arcade-server/src/rooms/ArcadeRoom.test.ts`

## TDD Evidence

1. Wrote tests for default replication, creator update, readiness preservation,
   non-creator rejection, invalid-payload rejection, playing/ended rejection,
   and rematch/back-to-lobby persistence.
2. Red run:

   ```powershell
   npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/ArcadeRoom.test.ts
   ```

   Result: failed as expected with 7 Task 2 failures and 57 existing tests
   passing. Failures showed missing replicated `rules`, no `client.setMatchRules`
   update, and default rules in fresh rematch/back-to-lobby worlds.
3. Implemented the minimal schema, message handler, synchronization, and shared
   fresh-world factory changes.
4. Green run:

   ```powershell
   npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/ArcadeRoom.test.ts
   ```

   Result: 64/64 tests passed.

## Verification

```powershell
npm.cmd run test --workspace @bbh/arcade-server
```

Result: 5 test files passed, 95/95 tests passed.

```powershell
npm.cmd run build --workspace @bbh/arcade-server
```

Result: passed (arcade-core build and arcade-server TypeScript compilation).

## Self-Review

- `state.rules` uses numeric schema fields with core defaults.
- The stored rules are copied before use and synchronized after initialization
  and valid replacement.
- The request gate order is rate limit, waiting phase, creator, then payload.
- Rejections do not mutate rules or roster; phase, host, and payload failures
  use `server.error`.
- Fresh-world creation for initial setup, valid updates, rematch, and
  back-to-lobby consumes stored rules and roster characters.
- A valid update does not call readiness or roster mutation helpers.
- Diff scope is limited to the three requested server files; this report is the
  required exception. `git diff --check` reported no whitespace errors.

## Commit

Implementation commit: `0dc86b3ed953c226c35ff6e8576ab10ac4bcb0c3`
