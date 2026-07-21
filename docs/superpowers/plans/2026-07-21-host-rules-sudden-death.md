# Host Rules and Unlimited Sudden-Death Overtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the private-room host choose a one-clock time limit and goal limit before a match, and guarantee an untimed next-goal-wins overtime when regulation ends tied.

**Architecture:** Define validated `MatchRules` in `@bbh/arcade-core` and embed the active rules plus an `isOvertime` flag in deterministic `WorldState`. `ArcadeRoom` owns one replicated rules selection, permits only its creator to change it in `waiting`, and creates every waiting/rematch world with those rules. The client hydrates replicated rules, exposes a viewable host-editable Rules panel in the lobby, and renders `NEXT GOAL` while the simulation is in overtime.

**Tech Stack:** TypeScript, Vitest, Colyseus Schema, React, `@bbh/arcade-core`, `@bbh/arcade-server`, `@bbh/arcade-client`.

## Global Constraints

- Time presets are exactly 3, 5, 7, and 10 minutes; `timeLimitMs` is one continuous regulation clock.
- Goal presets are exactly no limit (`0`), 3, 5, 7, and 10.
- The default is 3 minutes with no goal cap.
- A tied regulation clock enters unlimited sudden-death overtime; the next goal wins and overtime never expires into a draw.
- A non-zero goal cap ends the match immediately when reached.
- Rules are replicated and server-authoritative. Only `roomCreatorSessionId` may update them, and only during `waiting`.
- The Rules panel is visible to every pre-game participant; non-host controls are disabled and state that the host controls rules.
- Rule updates never modify readiness and are rejected during countdown, play, overtime, and postgame.
- Selected rules persist through rematch and return-to-lobby world creation.

---

## File Structure

- `packages/arcade-core/src/config/match.ts` — allowed rule presets, default rules, and runtime validation.
- `packages/arcade-core/src/sim/types.ts` — rule and overtime fields on deterministic world state.
- `packages/arcade-core/src/sim/world.ts` — initialize rule-aware worlds and transition a tied zero clock into overtime.
- `packages/arcade-core/src/sim/goal.ts` — end immediately on a non-zero goal cap or overtime goal.
- `packages/arcade-server/src/rooms/schema.ts` — replicated numeric rule state.
- `packages/arcade-server/src/rooms/ArcadeRoom.ts` — host-only message handling, validation, and rule-aware fresh worlds.
- `packages/arcade-client/src/store.ts` — hydrate replicated rules into client state.
- `packages/arcade-client/src/net/client.ts` — typed client request for host rule updates.
- `packages/arcade-client/src/ui/Lobby.tsx` — shared Rules panel and host-only controls.
- `packages/arcade-client/src/ui/ScoreHud.tsx` — replace the overtime clock with `NEXT GOAL`.

### Task 1: Deterministic match rules and unlimited overtime

**Files:**
- Modify: `packages/arcade-core/src/config/match.ts`
- Modify: `packages/arcade-core/src/sim/types.ts`
- Modify: `packages/arcade-core/src/sim/world.ts`
- Modify: `packages/arcade-core/src/sim/goal.ts`
- Modify: `packages/arcade-core/src/sim/world.test.ts`
- Modify: `packages/arcade-core/src/sim/goal.test.ts`
- Test: `packages/arcade-core/src/sim/world.test.ts`
- Test: `packages/arcade-core/src/sim/goal.test.ts`

**Interfaces:**
- Produces `MatchRules`, `DEFAULT_MATCH_RULES`, `TIME_LIMIT_OPTIONS_MS`, `GOAL_LIMIT_OPTIONS`, and `isMatchRules(value)` from `@bbh/arcade-core`.
- Extends `WorldState` with `rules: MatchRules` and `isOvertime: boolean`.
- Changes `createWorld(seed, mode, charactersBySlotId?, rules?)` so callers can create a fresh rule-aware world.

- [ ] **Step 1: Write failing core tests for rules and overtime**

Add tests that construct worlds with explicit rules and prove both terminal paths:

```ts
it("starts unlimited overtime instead of ending a tied regulation clock", () => {
  const world = createWorld(1, "arcade3v3", undefined, {
    timeLimitMs: 3 * 60_000,
    goalLimit: 0
  });
  world.phase = "playing";
  world.remainingMs = MATCH_CONFIG.fixedTickMs;
  world.score = { home: 2, away: 2 };

  stepWorld(world, [], MATCH_CONFIG.fixedTickMs);

  expect(world.phase).toBe("playing");
  expect(world.isOvertime).toBe(true);
  expect(world.remainingMs).toBe(0);
  expect(world.winnerTeamId).toBeNull();
});

it("ends an overtime match on the first goal", () => {
  const world = createWorld(1, "arcade3v3", undefined, {
    timeLimitMs: 3 * 60_000,
    goalLimit: 0
  });
  world.phase = "playing";
  world.isOvertime = true;
  placePuckInsideAwayGoal(world);

  resolveGoals(world);

  expect(world.phase).toBe("ended");
  expect(world.winnerTeamId).toBe("home");
});

it("ends immediately when the configured goal cap is reached", () => {
  const world = createWorld(1, "arcade3v3", undefined, {
    timeLimitMs: 5 * 60_000,
    goalLimit: 3
  });
  world.phase = "playing";
  world.score.home = 2;
  placePuckInsideAwayGoal(world);

  resolveGoals(world);

  expect(world.phase).toBe("ended");
  expect(world.winnerTeamId).toBe("home");
});
```

- [ ] **Step 2: Run the focused tests to verify the new behavior is absent**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/world.test.ts src/sim/goal.test.ts`

Expected: FAIL because `createWorld` does not accept rules, `isOvertime` does not exist, and tied clocks still end as draws.

- [ ] **Step 3: Add the shared rules contract and world fields**

In `config/match.ts`, replace the fixed target-score dependency with this contract while retaining the existing mode and tick configuration:

```ts
export const TIME_LIMIT_OPTIONS_MS = [180_000, 300_000, 420_000, 600_000] as const;
export const GOAL_LIMIT_OPTIONS = [0, 3, 5, 7, 10] as const;
export type TimeLimitMs = (typeof TIME_LIMIT_OPTIONS_MS)[number];
export type GoalLimit = (typeof GOAL_LIMIT_OPTIONS)[number];

export interface MatchRules {
  readonly timeLimitMs: TimeLimitMs;
  readonly goalLimit: GoalLimit;
}

export const DEFAULT_MATCH_RULES: MatchRules = {
  timeLimitMs: 180_000,
  goalLimit: 0
};

export function isMatchRules(value: unknown): value is MatchRules {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MatchRules>;
  return (
    TIME_LIMIT_OPTIONS_MS.includes(candidate.timeLimitMs as TimeLimitMs) &&
    GOAL_LIMIT_OPTIONS.includes(candidate.goalLimit as GoalLimit)
  );
}
```

Add `rules: MatchRules` and `isOvertime: boolean` to `WorldState`. Initialize them in `createWorld` using `rules ?? DEFAULT_MATCH_RULES`, copying the values into a new object, and set `remainingMs` from `world.rules.timeLimitMs`.

- [ ] **Step 4: Implement the terminal-state rules**

Replace the current unconditional zero-clock end in `stepWorld` with:

```ts
if (!world.isOvertime) {
  world.remainingMs = Math.max(0, world.remainingMs - dtMs);
  if (world.remainingMs === 0) {
    if (world.score.home === world.score.away) {
      world.isOvertime = true;
    } else {
      world.phase = "ended";
      world.winnerTeamId = world.score.home > world.score.away ? "home" : "away";
    }
  }
}
```

In `resolveGoals`, replace the `MATCH_CONFIG.targetScore` check with:

```ts
const hitGoalLimit =
  world.rules.goalLimit > 0 && world.score[scoringTeam] >= world.rules.goalLimit;
if (world.isOvertime || hitGoalLimit) {
  world.phase = "ended";
  world.winnerTeamId = scoringTeam;
}
```

Keep faceoff reset and goal/stat events intact before the terminal assignment.

- [ ] **Step 5: Run focused core tests and the core suite**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/world.test.ts src/sim/goal.test.ts`

Expected: PASS, including the new overtime and goal-cap regressions.

Run: `npm.cmd run test --workspace @bbh/arcade-core`

Expected: PASS; update stale fixed-target-score expectations to use explicit `MatchRules` where required.

- [ ] **Step 6: Commit the deterministic rules task**

```bash
git add packages/arcade-core/src/config/match.ts packages/arcade-core/src/sim/types.ts packages/arcade-core/src/sim/world.ts packages/arcade-core/src/sim/goal.ts packages/arcade-core/src/sim/world.test.ts packages/arcade-core/src/sim/goal.test.ts
git commit -m "feat: add match rules and sudden-death overtime"
```

### Task 2: Replicate and enforce host-owned room rules

**Files:**
- Modify: `packages/arcade-server/src/rooms/schema.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.test.ts`
- Test: `packages/arcade-server/src/rooms/ArcadeRoom.test.ts`

**Interfaces:**
- Consumes `DEFAULT_MATCH_RULES`, `MatchRules`, and `isMatchRules` from Task 1.
- Produces replicated `state.rules.timeLimitMs` and `state.rules.goalLimit`.
- Registers `client.setMatchRules` with payload `{ timeLimitMs: number; goalLimit: number }`.

- [ ] **Step 1: Write failing server tests for authority, lifecycle, and persistence**

Add a room fixture with two joined humans, then add tests with these assertions:

```ts
room.receive("client.setMatchRules", hostClient, {
  timeLimitMs: 420_000,
  goalLimit: 7
});
expect(room.state.rules.timeLimitMs).toBe(420_000);
expect(room.state.rules.goalLimit).toBe(7);
expect(hostSlot.ready).toBe(true);
expect(guestSlot.ready).toBe(true);

room.receive("client.setMatchRules", guestClient, {
  timeLimitMs: 600_000,
  goalLimit: 10
});
expect(room.state.rules.timeLimitMs).toBe(420_000);
expect(room.state.rules.goalLimit).toBe(7);

room["world"]!.phase = "playing";
room.receive("client.setMatchRules", hostClient, {
  timeLimitMs: 180_000,
  goalLimit: 0
});
expect(room.state.rules.timeLimitMs).toBe(420_000);
```

Add a rematch assertion that the fresh `room["world"]!.rules` equals the stored state rules after an ended world is rematched.

- [ ] **Step 2: Run the room tests to verify failure**

Run: `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/ArcadeRoom.test.ts`

Expected: FAIL because schema state has no rules and the room has no `client.setMatchRules` handler.

- [ ] **Step 3: Add replicated schema state and a room-local rules selection**

Add this schema class and field:

```ts
export class ArcadeMatchRulesState extends Schema {
  @type("number") timeLimitMs = DEFAULT_MATCH_RULES.timeLimitMs;
  @type("number") goalLimit = DEFAULT_MATCH_RULES.goalLimit;
}

export class ArcadeRoomState extends Schema {
  // existing fields
  @type(ArcadeMatchRulesState) rules = new ArcadeMatchRulesState();
}
```

In `ArcadeRoom`, add `private matchRules: MatchRules = { ...DEFAULT_MATCH_RULES };` and a `syncRulesState()` helper that assigns both numeric fields to `this.state.rules`. Add a `createConfiguredWorld()` helper that calls `createWorld(this.seedGenerator(), this.roomOptions.mode, undefined, this.matchRules)`, applies roster characters, and returns it. Use this helper for `onCreate`, `handleRematch`, and `handleBackToLobby`.

- [ ] **Step 4: Implement validated host-only mutation**

Register the message in `onCreate`:

```ts
this.onMessage("client.setMatchRules", (client, message: unknown) => {
  this.handleSetMatchRules(client, message);
});
```

Implement the handler with all gates before mutation:

```ts
private handleSetMatchRules(client: Client, message: unknown): void {
  if (!this.allowLobbyMutation(client.sessionId)) return;
  if (this.world?.phase !== "waiting") {
    this.send(client, "server.error", { message: "Can't change rules mid-match." });
    return;
  }
  if (this.roomCreatorSessionId !== client.sessionId) {
    this.send(client, "server.error", { message: "Only the room creator can change rules." });
    return;
  }
  if (!isMatchRules(message)) {
    this.send(client, "server.error", { message: "Invalid match rules." });
    return;
  }

  this.matchRules = { ...message };
  this.world = this.createConfiguredWorld();
  this.syncRulesState();
  this.syncStateFromWorld();
}
```

Do not call `clearHumanReadiness`; rule updates must leave the roster unchanged.

- [ ] **Step 5: Run server verification**

Run: `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/ArcadeRoom.test.ts`

Expected: PASS, covering valid host updates, rejected guest/invalid/live updates, unchanged readiness, and rematch persistence.

Run: `npm.cmd run test --workspace @bbh/arcade-server`

Expected: PASS.

- [ ] **Step 6: Commit the server authority task**

```bash
git add packages/arcade-server/src/rooms/schema.ts packages/arcade-server/src/rooms/ArcadeRoom.ts packages/arcade-server/src/rooms/ArcadeRoom.test.ts
git commit -m "feat: add host-controlled match rules"
```

### Task 3: Display replicated rules and overtime state in the client

**Files:**
- Modify: `packages/arcade-client/src/store.ts`
- Modify: `packages/arcade-client/src/store.test.ts`
- Modify: `packages/arcade-client/src/net/client.ts`
- Modify: `packages/arcade-client/src/net/client.test.ts`
- Modify: `packages/arcade-client/src/App.tsx`
- Modify: `packages/arcade-client/src/App.test.tsx`
- Modify: `packages/arcade-client/src/ui/Lobby.tsx`
- Modify: `packages/arcade-client/src/ui/Lobby.test.tsx`
- Modify: `packages/arcade-client/src/ui/ScoreHud.tsx`
- Create: `packages/arcade-client/src/ui/ScoreHud.test.tsx`
- Modify: `packages/arcade-client/src/styles/arcadeTheme.css`
- Test: `packages/arcade-client/src/store.test.ts`
- Test: `packages/arcade-client/src/net/client.test.ts`
- Test: `packages/arcade-client/src/ui/Lobby.test.tsx`
- Test: `packages/arcade-client/src/ui/ScoreHud.test.tsx`

**Interfaces:**
- Consumes `MatchRules` and `DEFAULT_MATCH_RULES` from Task 1 and `state.rules` from Task 2.
- Adds `ArcadeRoomSession.setMatchRules(rules: MatchRules): void`.
- Adds `rules: MatchRules` to `ArcadeClientState` and `rules?: Partial<MatchRules>` to `ServerRoomState`.
- Adds `onSetMatchRules(rules: MatchRules): void` to `LobbyProps` and passes it from `App`.

- [ ] **Step 1: Write failing client hydration and send tests**

Add a store test that maps server state with `{ rules: { timeLimitMs: 600_000, goalLimit: 10 } }` and expects exactly those values in `ArcadeClientState.rules`. Add a client-session test:

```ts
session.setMatchRules({ timeLimitMs: 300_000, goalLimit: 5 });
expect(room.send).toHaveBeenCalledWith("client.setMatchRules", {
  timeLimitMs: 300_000,
  goalLimit: 5
});
```

- [ ] **Step 2: Run hydration and client-send tests to verify failure**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/store.test.ts src/net/client.test.ts`

Expected: FAIL because rules are not represented in state and the session method does not exist.

- [ ] **Step 3: Implement replicated rules hydration and request API**

Use the core default whenever an older room snapshot lacks either field:

```ts
const rules: MatchRules = {
  timeLimitMs: serverState.rules?.timeLimitMs ?? DEFAULT_MATCH_RULES.timeLimitMs,
  goalLimit: serverState.rules?.goalLimit ?? DEFAULT_MATCH_RULES.goalLimit
};
```

Store it in both `createInitialArcadeClientState()` and `mapRoomState()`. Add `setMatchRules(rules: MatchRules)` to `ArcadeRoomSession` and send `client.setMatchRules` with that exact object.

- [ ] **Step 4: Write failing Rules-panel and overtime-HUD tests**

Add lobby render assertions for all participants:

```ts
expect(html).toContain(">Rules<");
expect(html).toContain("Host controls rules");
expect(html).toMatch(/<button[^>]*disabled=""[^>]*>5:00<\/button>/);
```

Render as the creator and invoke the 7-minute button callback; assert it sends `{ timeLimitMs: 420_000, goalLimit: currentGoalLimit }`. Add `ScoreHud` tests asserting a regulation world shows `3:00` and an `isOvertime: true` world shows `NEXT GOAL` without `0:00`.

- [ ] **Step 5: Implement Rules panel, host-only controls, and overtime HUD**

In `Lobby`, add local `rulesOpen` state and a visible Rules button next to the existing Settings button. When open, render preset buttons from core exports. The panel must use this host guard:

```ts
const canEditRules = isConnected && isCreator && state.phase === "waiting";
```

Each time button calls:

```ts
onSetMatchRules({ ...state.rules, timeLimitMs });
```

Each goal button calls:

```ts
onSetMatchRules({ ...state.rules, goalLimit });
```

Disable every preset button when `!canEditRules`, retain the selected visual state for all participants, and render `Host controls rules` for non-creators. Do not call `onSetReady` anywhere in the rules flow. Add compact CSS for the panel and its selected/disabled states using the existing arcade theme tokens.

In `App`, add `handleSetMatchRules` that delegates to `activeRoomRef.current?.session.setMatchRules(rules)` and pass it into `Lobby`.

In `ScoreHud`, render the center label as:

```tsx
<span className="score-hud-clock">
  {state.currentWorld?.isOvertime ? "NEXT GOAL" : formatClock(remainingSeconds)}
</span>
```

Render an `OT` phase badge whenever `state.currentWorld?.isOvertime` is true, even though the authoritative world phase remains `playing`.

- [ ] **Step 6: Run focused client tests and then the client suite**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/store.test.ts src/net/client.test.ts src/ui/Lobby.test.tsx src/ui/ScoreHud.test.tsx src/App.test.tsx`

Expected: PASS, including host/non-host Rules UI, exact outbound message, state hydration, and `NEXT GOAL` overtime HUD.

Run: `npm.cmd run test --workspace @bbh/arcade-client`

Expected: PASS.

- [ ] **Step 7: Commit the client experience task**

```bash
git add packages/arcade-client/src/store.ts packages/arcade-client/src/store.test.ts packages/arcade-client/src/net/client.ts packages/arcade-client/src/net/client.test.ts packages/arcade-client/src/App.tsx packages/arcade-client/src/App.test.tsx packages/arcade-client/src/ui/Lobby.tsx packages/arcade-client/src/ui/Lobby.test.tsx packages/arcade-client/src/ui/ScoreHud.tsx packages/arcade-client/src/ui/ScoreHud.test.tsx packages/arcade-client/src/styles/arcadeTheme.css
git commit -m "feat: add lobby rules panel and overtime HUD"
```

### Task 4: Cross-package verification and private-room manual QA

**Files:**
- Modify: `docs/superpowers/plans/2026-07-21-host-rules-sudden-death.md`

**Interfaces:**
- Consumes the complete core/server/client implementation from Tasks 1-3.
- Produces verification evidence for the final review and release.

- [ ] **Step 1: Run the full arcade test suite**

Run: `npm.cmd run test:arcade`

Expected: PASS for core, server, and client workspaces with zero failures.

- [ ] **Step 2: Run the workspace typecheck**

Run: `npm.cmd run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Manually validate one private room with two browser clients**

1. Create a private room in browser A and join it with browser B.
2. Verify both clients open Rules and show the same default `3:00` / `No limit` values.
3. On A, choose `5:00` and `First to 7`; verify B updates immediately and A/B ready indicators remain unchanged.
4. On B, confirm all rule preset controls are disabled and the host-control explanation is visible.
5. Start a tied short-duration match, verify `OT` / `NEXT GOAL` appears at zero, wait beyond the old timeout, and score once.
6. Verify the first overtime goal ends the match and rematch still uses `5:00` / `First to 7`.

- [ ] **Step 4: Mark verification tasks complete and commit plan evidence**

After all checks pass, change the Task 1-4 checkboxes in this plan to checked and commit:

```bash
git add docs/superpowers/plans/2026-07-21-host-rules-sudden-death.md
git commit -m "docs: verify host rules and sudden-death overtime"
```
