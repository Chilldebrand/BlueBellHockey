# Powerup Activation And Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make human and bot powerups usable end-to-end and make the deterministic spawn cadence process each scheduled index exactly once beginning at 9 seconds.

**Architecture:** Keep powerup effects in the existing shared simulation. Add one authoritative schedule cursor to `WorldState`; pass one `usePowerup` action bit through bot, client, and server input paths; mount the existing local HUD component.

**Tech Stack:** TypeScript, React, Vitest, `@bbh/arcade-core`, Colyseus room tests, deterministic fixed-step simulation.

## Global Constraints

- Modify only `packages/arcade-core`, `packages/arcade-server`, and `packages/arcade-client` plus this cluster's documentation.
- Preserve deterministic fixed-step shared simulation.
- Keep `POWERUP_SPAWN_INTERVAL_MS` at 9000 and retain the existing seed/index spawn selection.
- Keyboard powerup activation is `KeyQ`; standard-gamepad activation is Y at button index 3.
- The server accepts only literal boolean `true` for `usePowerup`; all other values sanitize to false.
- Do not change powerup balance, AI decision heuristics, specials, or legacy packages.
- Add no dependencies and use `npm.cmd` for Windows commands.
- Use TDD for every behavior change: add a focused failing test, confirm the expected failure, implement the minimum fix, then rerun focused regressions.

---

## File Map

- Modify `packages/arcade-core/src/sim/types.ts`: add the world schedule cursor and describe the active `usePowerup` frame bit.
- Modify `packages/arcade-core/src/sim/world.ts`: initialize the cursor to `-1`.
- Modify `packages/arcade-core/src/sim/powerups.ts`: schedule from the cursor instead of rink-object presence.
- Modify `packages/arcade-core/src/sim/powerups.test.ts`: lock cadence and one-time processing.
- Modify `packages/arcade-core/src/sim/ai/bot.ts` and `bot.test.ts`: deliver the existing AI decision bit.
- Modify `packages/arcade-server/src/rooms/ArcadeRoom.ts` and `ArcadeRoom.test.ts`: preserve a sanitized client action bit.
- Modify `packages/arcade-client/src/input/inputState.ts`, `keyboard.ts`, and `gamepad.ts`: define and bind the action.
- Create `packages/arcade-client/src/input/inputState.test.ts`, `keyboard.test.ts`, and `gamepad.test.ts`: cover the pure input adapters.
- Modify `packages/arcade-client/src/ui/HUD.tsx` and create `HUD.test.tsx`: mount and verify `PowerupHud`.

### Task 1: Make spawn scheduling persistent and deterministic

**Files:**
- Modify: `packages/arcade-core/src/sim/types.ts`
- Modify: `packages/arcade-core/src/sim/world.ts`
- Modify: `packages/arcade-core/src/sim/powerups.ts`
- Modify: `packages/arcade-core/src/sim/powerups.test.ts`

**Interfaces:**
- Produces `WorldState.lastPowerupSpawnIndex: number`.
- Index `n` is due at `(n + 1) * POWERUP_SPAWN_INTERVAL_MS`.
- `spawnPowerups(world)` processes every integer from `lastPowerupSpawnIndex + 1` through the latest due index in ascending order.

- [ ] **Step 1: Replace the cadence regression with failing boundary tests.** Add tests equivalent to:

```ts
it("does not spawn before the first cadence boundary", () => {
  const world = playingWorld();
  world.time.nowMs = POWERUP_SPAWN_INTERVAL_MS - 1;
  stepWorld(world, [], 1);
  expect(world.powerupPickups).toHaveLength(0);
  expect(world.bananaPeels).toHaveLength(0);
  expect(world.lastPowerupSpawnIndex).toBe(-1);
});

it("processes every due spawn index once even after objects are removed", () => {
  const world = playingWorld();
  world.time.nowMs = POWERUP_SPAWN_INTERVAL_MS * 3;
  stepWorld(world, [], 16);
  expect(world.lastPowerupSpawnIndex).toBe(2);
  expect(world.eventQueue.filter((event) =>
    event.type === "powerupSpawn" || event.type === "bananaSpawn"
  )).toHaveLength(3);
  world.powerupPickups = [];
  world.bananaPeels = [];
  stepWorld(world, [], 16);
  expect(world.eventQueue.filter((event) =>
    event.type === "powerupSpawn" || event.type === "bananaSpawn"
  )).toHaveLength(3);
});
```

- [ ] **Step 2: Run the focused test and verify RED.** Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/powerups.test.ts`. Expect the pre-boundary test to find an early object or the new cursor assertions to fail because the field does not exist.

- [ ] **Step 3: Add and initialize the cursor.** Add this mutable field to `WorldState` and its initial world literal:

```ts
lastPowerupSpawnIndex: number;
// createWorld
lastPowerupSpawnIndex: -1,
```

- [ ] **Step 4: Replace transient duplicate detection with cursor processing.** Use this shape, retaining the existing object/event construction in `spawnPowerupAtIndex`:

```ts
function spawnPowerups(world: WorldState): void {
  const latestDueIndex =
    Math.floor(world.time.nowMs / POWERUP_SPAWN_INTERVAL_MS) - 1;
  for (
    let spawnIndex = world.lastPowerupSpawnIndex + 1;
    spawnIndex <= latestDueIndex;
    spawnIndex += 1
  ) {
    spawnPowerupAtIndex(world, spawnIndex);
    world.lastPowerupSpawnIndex = spawnIndex;
  }
}
```

- [ ] **Step 5: Run focused GREEN and core regression.** Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/powerups.test.ts src/sim/determinism.test.ts src/sim/world.test.ts`, then `npm.cmd run test --workspace @bbh/arcade-core`. Expect PASS.

- [ ] **Step 6: Commit.** Stage the four task files and commit `fix(powerups): make spawn cadence persistent`.

### Task 2: Deliver bot powerup decisions to the simulation

**Files:**
- Modify: `packages/arcade-core/src/sim/ai/bot.ts`
- Modify: `packages/arcade-core/src/sim/ai/bot.test.ts`

**Interfaces:**
- Consumes the existing `BotDecision.usePowerup: boolean`.
- Produces `InputFrame.usePowerup` with the exact decision value.

- [ ] **Step 1: Add a failing bot-frame test.** Configure `home-skater-1` to hold `giant-goalie`, give an away skater possession, call `createBotInputFrame`, and assert `frame.usePowerup === true`. Also assert a frame for a bot with no held powerup has `usePowerup === false`.

- [ ] **Step 2: Run focused RED.** Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/bot.test.ts`. Expect `usePowerup` to be undefined.

- [ ] **Step 3: Implement the minimum mapping.** In the returned frame add:

```ts
usePowerup: decision.usePowerup,
```

- [ ] **Step 4: Run focused GREEN and AI regression.** Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/ai/bot.test.ts src/sim/ai/decision.test.ts`. Expect PASS.

- [ ] **Step 5: Commit.** Stage the two task files and commit `fix(powerups): deliver bot activation input`.

### Task 3: Preserve sanitized human activation on the server

**Files:**
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.test.ts`
- Modify: `packages/arcade-core/src/sim/types.ts`

**Interfaces:**
- Consumes unknown `client.input.frame.usePowerup`.
- Produces `InputFrame.usePowerup` where only `candidate.usePowerup === true` becomes true.
- Preserves existing player/session ownership, slot replacement, sequence validation, and axis clamping.

- [ ] **Step 1: Extend the room input helper and add failing sanitation tests.** Include `usePowerup` in the helper frame. Send one frame with true and inspect `room["latestInputBySession"].get("session-a")?.usePowerup`; send a newer frame with a non-boolean value cast through `unknown` and expect false.

- [ ] **Step 2: Run focused RED.** Run `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/ArcadeRoom.test.ts`. Expect the true value to be undefined/false because the sanitizer drops it.

- [ ] **Step 3: Implement the sanitizer mapping and update the frame comment.** Add:

```ts
usePowerup: candidate.usePowerup === true,
```

Replace the combined deferred comment in `InputFrame` with an active powerup-action comment above `usePowerup` and retain a separate deferred-special comment above `special`.

- [ ] **Step 4: Run focused GREEN and server regression.** Run `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/ArcadeRoom.test.ts`, then `npm.cmd run test --workspace @bbh/arcade-server`. Expect PASS.

- [ ] **Step 5: Commit.** Stage the three task files and commit `fix(powerups): accept sanitized client activation`.

### Task 4: Add human controls and show the held powerup

**Files:**
- Modify: `packages/arcade-client/src/input/inputState.ts`
- Modify: `packages/arcade-client/src/input/keyboard.ts`
- Modify: `packages/arcade-client/src/input/gamepad.ts`
- Create: `packages/arcade-client/src/input/inputState.test.ts`
- Create: `packages/arcade-client/src/input/keyboard.test.ts`
- Create: `packages/arcade-client/src/input/gamepad.test.ts`
- Modify: `packages/arcade-client/src/ui/HUD.tsx`
- Create: `packages/arcade-client/src/ui/HUD.test.tsx`

**Interfaces:**
- Produces required `ArcadeInputState.usePowerup: boolean`.
- `createNeutralInputState()` returns false; `mergeInputStates()` ORs both sources; `createInputFrame()` copies the boolean.
- Keyboard `KeyQ` and gamepad button index 3 set true.
- `HUD` passes the locally owned skater's `heldPowerupType` to `PowerupHud`.

- [ ] **Step 1: Add failing pure input tests.** Assert neutral false, merged true when either source is true, frame true when input is true, `keyboardStateFromPressedKeys(new Set(["KeyQ"]))` true, and a `GamepadLike` with button 3 pressed true.

- [ ] **Step 2: Add a failing HUD render test.** Build an initial client state, a `createWorld` snapshot whose locally owned skater holds `hard-shot`, and a one-slot local roster; assert `renderToStaticMarkup(<HUD state={state} />)` contains `Held powerup` and `Hard Shot`.

- [ ] **Step 3: Run client RED.** Run `npm.cmd run test --workspace @bbh/arcade-client -- src/input/inputState.test.ts src/input/keyboard.test.ts src/input/gamepad.test.ts src/ui/HUD.test.tsx`. Expect missing-field and missing-HUD failures.

- [ ] **Step 4: Implement the required state and mappings.** Add `usePowerup` to the interface, neutral literal, frame literal, and merge literal. In adapters add:

```ts
// keyboard.ts
usePowerup: pressed.has("KeyQ"),

// gamepad.ts
usePowerup: gamepad.buttons[3]?.pressed === true, // Y
```

- [ ] **Step 5: Mount the existing HUD component.** Import `PowerupHud` and render it beside `TurboMeter` for `localSkater`:

```tsx
<PowerupHud heldPowerupType={localSkater.heldPowerupType} />
```

- [ ] **Step 6: Run client GREEN and regression.** Run the focused command from Step 3, then `npm.cmd run test --workspace @bbh/arcade-client`. Expect PASS.

- [ ] **Step 7: Commit.** Stage the eight task files and commit `feat(powerups): add human activation controls and HUD`.

### Task 5: Integrated verification

**Files:**
- Review only unless a verification failure exposes a regression in Task 1-4 files.

**Interfaces:**
- Confirms the complete human/bot/server/core path and production packaging without expanding scope.

- [ ] **Step 1: Run all arcade tests.** Run `npm.cmd test`. Expect all existing 301 tests plus new regressions to pass.
- [ ] **Step 2: Run typecheck.** Run `npm.cmd run typecheck`. Expect exit code 0.
- [ ] **Step 3: Run production build.** Run `npm.cmd run build:arcade`. Expect exit code 0; the existing Vite chunk-size warning is nonfatal.
- [ ] **Step 4: Run server smoke.** Run `npm.cmd run smoke --workspace @bbh/arcade-server`. Expect all seven checks to pass.
- [ ] **Step 5: Inspect git scope.** Run `git status --short` and `git diff --stat` against the pre-implementation base. Confirm no files under `packages/shared`, `packages/server`, or `packages/client` changed.

## Self-Review

- Spec coverage: Task 1 covers schedule boundaries and persistent processing; Task 2 covers bot activation; Task 3 covers authoritative sanitation; Task 4 covers human controls and HUD; Task 5 covers integration.
- Placeholder scan: every behavior-changing step names exact fields, bindings, files, commands, and expected failure/pass results.
- Type consistency: `usePowerup` remains optional on the wire-level `InputFrame` for backward compatibility but is required in client-local `ArcadeInputState`; `lastPowerupSpawnIndex` is required and initialized by every `createWorld` call.
