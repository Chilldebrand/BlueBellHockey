# Multiplayer Controls and Gameplay Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make assisted passing, puck collection, stick direction, player identity, and ready-gated lobby play responsive and consistent in multiplayer matches.

**Architecture:** Keep simulation tuning deterministic in `@bbh/arcade-core`. Extend the server roster/schema as the source of truth for names, readiness, creator authority, and shared human color order. The client derives presentation and local input transforms exclusively from replicated state plus persisted preferences.

**Tech Stack:** TypeScript, Vitest, Colyseus, `@colyseus/schema`, React.

## Global Constraints

- Pass assist cosine: `0.42`; base pass speed: `1815`; full-charge bonus: `766`; reception radius: `90`; reception tolerance: `2850`.
- Ordinary loose-puck radius: `75`; defensive and release cooldowns remain unchanged.
- `POWERUP_SPAWN_INTERVAL_MS` is `11250`.
- The server is authoritative for names, ready status, room creator, and player identity order.
- Only the creator can start a waiting room, and only when every human is ready; matches never auto-start.
- Away/red players invert only the vertical stick axis unless Always Up Stick Controls is enabled.
- Bots have no identity ring and never block readiness.

---

## Task 1: Tune deterministic passing, pickup, and power-up cadence

**Files:**
- Modify: `packages/arcade-core/src/sim/passTargeting.ts`
- Modify: `packages/arcade-core/src/sim/passTargeting.test.ts`
- Modify: `packages/arcade-core/src/sim/puck.ts`
- Modify: `packages/arcade-core/src/sim/puck.test.ts`
- Modify: `packages/arcade-core/src/config/powerups.ts`
- Modify: `packages/arcade-core/src/sim/powerups.test.ts`

**Produces:** Existing public APIs with the exact global-constraint tuning.

- [ ] **Step 1: Write failing core tests.** Place a teammate 60 degrees off the aimed direction and assert selection. Assert the new `PUCK_CONFIG` values. Advance a world to `11249` ms and assert no first spawn, then to `11250` ms and assert one.

```ts
expect(findAimedPassRecipient(world, source, aim)).toBe(receiver);
expect(PUCK_CONFIG.pickupRadius).toBe(75);
expect(PUCK_CONFIG.passSpeed + PUCK_CONFIG.passChargeSpeedBonus).toBe(2581);
expect(world.powerupPickups).toHaveLength(1);
```

- [ ] **Step 2: Run RED.**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/passTargeting.test.ts src/sim/puck.test.ts src/sim/powerups.test.ts`

Expected: failure on the existing `0.65`, `60`, `1512`, `638`, and 9,000 ms values.

- [ ] **Step 3: Implement the constants.** Set `PASS_AIM_ASSIST_COSINE = 0.42`; set `pickupRadius`, `passSpeed`, `passChargeSpeedBonus`, `passCatchRadius`, and `passCatchMaxRelativeSpeed` to the global values; set `POWERUP_SPAWN_INTERVAL_MS = 11250`. Do not alter cooldown, interception, spawn-point, or banana-selection logic.

- [ ] **Step 4: Run GREEN.**

Run: `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/passTargeting.test.ts src/sim/puck.test.ts src/sim/powerups.test.ts`

Expected: all selected tests pass.

- [ ] **Step 5: Commit.**

```bash
git add packages/arcade-core/src/sim/passTargeting.ts packages/arcade-core/src/sim/passTargeting.test.ts packages/arcade-core/src/sim/puck.ts packages/arcade-core/src/sim/puck.test.ts packages/arcade-core/src/config/powerups.ts packages/arcade-core/src/sim/powerups.test.ts
git commit -m "feat: tighten passing and pickup tuning"
```

## Task 2: Add authoritative names, readiness, and creator start gating

**Files:**
- Modify: `packages/arcade-server/src/rooms/roster.ts`
- Modify: `packages/arcade-server/src/rooms/roster.test.ts`
- Modify: `packages/arcade-server/src/rooms/schema.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.test.ts`

**Produces:** `RoomRosterSlot.ready`, `setHumanPlayerName`, `setHumanReady`, `allHumansReady`, `earliestHumanSessionId`, replicated `ArcadeRoomSlotState.ready`, `ArcadeRoomSlotState.teamJoinOrder`, and `ArcadeRoomState.roomCreatorSessionId`.

- [ ] **Step 1: Write failing roster and room tests.** Cover: a new human is unready; name/team/self-character changes clear ready; bots do not affect `allHumansReady`; a non-creator cannot start; a creator cannot start before all humans ready; a deliberate creator leave transfers authority to the lowest `teamJoinOrder`, then slot ID.

```ts
expect(setHumanReady(roster, "session-a", true)?.ready).toBe(true);
expect(allHumansReady(roster)).toBe(true);
expect(room.state.roomCreatorSessionId).toBe("session-a");
expect(room.state.phase).toBe("waiting");
```

- [ ] **Step 2: Run RED.**

Run: `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/roster.test.ts src/rooms/ArcadeRoom.test.ts`

Expected: missing fields/helpers and unguarded start behavior fail.

- [ ] **Step 3: Implement roster mutation and validation.** Initialize `ready: false`; preserve it only across same-session reconnect; clear it in `releaseHuman`, `moveHumanToTeam`, and a successful own-slot character selection. Add lobby-only sanitized name and ready handlers. Set creator at first join. On deliberate creator departure, transfer to `earliestHumanSessionId` after release. In `handleRequestStart`, require creator session and `allHumansReady`.

- [ ] **Step 4: Replicate state.** Copy `slot.ready` and `slot.teamJoinOrder` into the slot schema and store `roomCreatorSessionId` in room schema. Update creator replication whenever authority changes. Keep `isRosterValid` unchanged as the filled-seat check.

- [ ] **Step 5: Run GREEN and commit.**

Run: `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/roster.test.ts src/rooms/ArcadeRoom.test.ts`

Expected: selected tests pass; no non-creator or unready room enters `playing`.

```bash
git add packages/arcade-server/src/rooms/roster.ts packages/arcade-server/src/rooms/roster.test.ts packages/arcade-server/src/rooms/schema.ts packages/arcade-server/src/rooms/ArcadeRoom.ts packages/arcade-server/src/rooms/ArcadeRoom.test.ts
git commit -m "feat: gate room start on player readiness"
```

## Task 3: Wire client names, ready status, creator controls, and stable rings

**Files:**
- Modify: `packages/arcade-client/src/net/client.ts`
- Modify: `packages/arcade-client/src/net/client.test.ts`
- Modify: `packages/arcade-client/src/store.ts`
- Modify: `packages/arcade-client/src/store.test.ts`
- Modify: `packages/arcade-client/src/ui/Lobby.tsx`
- Modify: `packages/arcade-client/src/ui/Lobby.test.tsx`
- Modify: `packages/arcade-client/src/ui/SlotCard.tsx`

**Produces:** `ArcadeRoomSession.setPlayerName`, `ArcadeRoomSession.setReady`, `ClientRosterSlot.ready`, `ClientRosterSlot.teamJoinOrder`, `ArcadeClientState.roomCreatorSessionId`, and local name key `bbh.arcade.player-name.v1`.

- [ ] **Step 1: Write failing tests.** Verify join options use a persisted name, session messages send `client.setPlayerName` and `client.setReady`, store mapping exposes ready/creator values, and the same roster produces an equal identity-ring map for different local sessions. Verify Lobby renders name input, Ready labels, and Start only for the ready-room creator.

```ts
expect(buildHighlightColorByEntityId(roster, "session-a")).toEqual(
  buildHighlightColorByEntityId(roster, "session-b")
);
expect(screen.getByRole("button", { name: "Ready" })).toBeEnabled();
expect(screen.queryByRole("button", { name: "Start Match" })).toBeNull();
```

- [ ] **Step 2: Run RED.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/net/client.test.ts src/store.test.ts src/ui/Lobby.test.tsx`

Expected: missing methods/fields and local-first ring behavior fail.

- [ ] **Step 3: Implement network/store/UI.** Add `playerName` to create/join room options with safe local storage helpers; send set-name and set-ready messages; map the replicated fields. Assign human ring colors by `teamJoinOrder ?? Infinity`, then slot ID, never local session. Render editable local name and Ready in waiting; render Ready/Not ready cards; show enabled Start only when every human is ready and the local session is creator.

- [ ] **Step 4: Run GREEN and commit.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/net/client.test.ts src/store.test.ts src/ui/Lobby.test.tsx`

Expected: selected tests pass, including equal cross-client ring maps.

```bash
git add packages/arcade-client/src/net/client.ts packages/arcade-client/src/net/client.test.ts packages/arcade-client/src/store.ts packages/arcade-client/src/store.test.ts packages/arcade-client/src/ui/Lobby.tsx packages/arcade-client/src/ui/Lobby.test.tsx packages/arcade-client/src/ui/SlotCard.tsx
git commit -m "feat: add lobby names readiness and stable rings"
```

## Task 4: Add red stick inversion and Always Up preference

**Files:**
- Create: `packages/arcade-client/src/input/stickControls.ts`
- Create: `packages/arcade-client/src/input/stickControls.test.ts`
- Create: `packages/arcade-client/src/input/controlPreferences.ts`
- Create: `packages/arcade-client/src/input/controlPreferences.test.ts`
- Modify: `packages/arcade-client/src/App.tsx`
- Modify: `packages/arcade-client/src/ui/SettingsOverlay.tsx`
- Modify: `packages/arcade-client/src/ui/SettingsOverlay.test.tsx`

**Produces:** `transformStickForTeam(stickY, teamId, alwaysUp)`, persisted `ControlPreferences`, and an Always Up checkbox.

- [ ] **Step 1: Write failing pure and UI tests.** Assert home preserves `stickY`, away negates it by default, Always Up preserves away `stickY`, invalid storage returns false, and Settings exposes a checkbox labeled Always Up Stick Controls.

```ts
expect(transformStickForTeam(0.75, "home", false)).toBe(0.75);
expect(transformStickForTeam(0.75, "away", false)).toBe(-0.75);
expect(transformStickForTeam(0.75, "away", true)).toBe(0.75);
```

- [ ] **Step 2: Run RED.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/input/stickControls.test.ts src/input/controlPreferences.test.ts src/ui/SettingsOverlay.test.tsx`

Expected: missing modules and checkbox fail.

- [ ] **Step 3: Implement and wire the transform.** Persist `{ alwaysUpStickControls: false }` under `bbh.arcade.controls.v1`. Transform only `stickY`. In the one App input-frame path, derive authoritative local team, transform before both prediction and `sendInput`, then render/save the checkbox in Settings.

- [ ] **Step 4: Run GREEN and commit.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/input/stickControls.test.ts src/input/controlPreferences.test.ts src/ui/SettingsOverlay.test.tsx`

Expected: selected tests pass.

```bash
git add packages/arcade-client/src/input/stickControls.ts packages/arcade-client/src/input/stickControls.test.ts packages/arcade-client/src/input/controlPreferences.ts packages/arcade-client/src/input/controlPreferences.test.ts packages/arcade-client/src/App.tsx packages/arcade-client/src/ui/SettingsOverlay.tsx packages/arcade-client/src/ui/SettingsOverlay.test.tsx
git commit -m "feat: add team-aware stick controls"
```

## Task 5: Cross-package verification and shipment

**Files:**
- Modify: `docs/superpowers/plans/2026-07-19-multiplayer-controls-tuning.md` (check completed boxes only)

- [ ] **Step 1: Run complete affected suites.**

Run: `npm.cmd run test --workspace @bbh/arcade-core && npm.cmd run test --workspace @bbh/arcade-server && npm.cmd run test --workspace @bbh/arcade-client`

Expected: all suites exit 0.

- [ ] **Step 2: Validate a two-browser private room.** Use two names and character picks; verify both screens show equal rings, non-creator cannot start, creator can start after both ready, and red/default plus Always Up stick behavior is correct.

- [ ] **Step 3: Commit verification ledger and push.**

```bash
git add docs/superpowers/plans/2026-07-19-multiplayer-controls-tuning.md
git commit -m "docs: verify multiplayer controls tuning"
git push origin main
```

## Plan Self-Review

- Task 1 covers exact game-feel values and preserves cooldown/interception behavior.
- Tasks 2 and 3 cover server-authoritative name/ready/creator state and cross-client color consistency.
- Task 4 covers automatic red inversion and the persisted Always Up override.
- The plan excludes auto-start, custom colors, unrelated uniforms, and removal of charged passes or defensive windows.
