# Goalie Outlet Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn covered saves into temporary human-controlled goalie possession with aimable charged outlet passes and automatic return to the prior skater.

**Architecture:** Keep `carrierSlotId` skater-only and add explicit `goalieCarrierId` plus goalie outlet state in the shared world. Server and Free Skate wrappers grant temporary goalie input without moving skater roster ownership; the client derives an active entity for input, camera, highlight, and prediction suppression.

**Tech Stack:** TypeScript, deterministic arcade-core simulation, Colyseus schema/room authorization, React/react-three-fiber client, Vitest, two-client websocket smoke.

## Global Constraints

- Modify only active arcade packages and documentation; legacy packages remain untouched.
- Preserve deterministic shared simulation and authoritative server validation.
- Goalie control is temporary and crease-bound; movement axes aim but never skate the goalie.
- Pass uses hold-to-charge and release; automatic safe outlet occurs at exactly 2500 ms.
- Do not add goalie shooting, checking, deking, powerup use, manual selection, or persistent control.
- Add no dependencies and use `npm.cmd` in PowerShell.
- Add focused failing regressions before each production change.

---

## File Map

- Modify core `types.ts`, `puck.ts`, `goalie.ts`, `world.ts`, `goal.ts`, and tests for explicit possession and outlet mechanics.
- Create `packages/arcade-core/src/sim/goalieOutlet.ts` and `goalieOutlet.test.ts` for aim, charge, release, and deterministic fallback selection.
- Modify server `roster.ts`, `schema.ts`, `ArcadeRoom.ts`, and tests for temporary grants and authorization.
- Modify client `store.ts`, `App.tsx`, `Scene.tsx`, `CameraRig.tsx`, `GoalieModel.tsx`, and tests for active-entity presentation.
- Modify `game/localSim.ts`, `localSim.test.ts`, `ui/FreeSkate.tsx`, and tests for offline parity.

### Task 1: Replace cover faceoffs with explicit goalie possession

**Files:**
- Modify: `packages/arcade-core/src/sim/types.ts`
- Modify: `packages/arcade-core/src/sim/puck.ts`
- Modify: `packages/arcade-core/src/sim/goalie.ts`
- Modify: `packages/arcade-core/src/sim/goal.ts`
- Modify: `packages/arcade-core/src/sim/world.ts`
- Test: `packages/arcade-core/src/sim/goalie.test.ts`
- Test: `packages/arcade-core/src/sim/goal.test.ts`
- Test: `packages/arcade-core/src/sim/puck.test.ts`

**Interfaces:**
- Produces `PuckState.goalieCarrierId: string | null`.
- Invariant: `carrierSlotId` and `goalieCarrierId` are never both non-null.
- Produces `goalieHoldPosition(goalie: GoalieEntity): Vec2`.

- [ ] **Step 1: Write failing cover tests.** Arrange a slow centered shot and assert score/phase/skater positions remain unchanged, `goalieCarrierId === "home-goalie"`, `carrierSlotId === null`, and save/cover events still emit.

- [ ] **Step 2: Run RED.** Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/goalie.test.ts src/sim/goal.test.ts src/sim/puck.test.ts`. Expect missing field and center-reset failures.

- [ ] **Step 3: Add and initialize goalie carrier state.** Set `goalieCarrierId: null` in `createInitialPuckState`; clear it in true faceoff/reset paths.

- [ ] **Step 4: Convert cover to possession.** Replace `resetForFaceoff(world)` with a helper that clears velocity/shot/pass state, sets the goalie carrier, and places the puck at a deterministic up-ice hold offset.

```ts
puck.carrierSlotId = null;
puck.goalieCarrierId = goalie.id;
puck.velocity = { x: 0, y: 0 };
puck.position = goalieHoldPosition(goalie);
```

- [ ] **Step 5: Guard skater/goal systems.** Return early from loose pickup and goal resolution while `goalieCarrierId` is non-null; keep the puck attached after goalie tracking.

- [ ] **Step 6: Run GREEN and determinism tests.** Repeat focused tests, then run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/determinism.test.ts`. Expect PASS.

- [ ] **Step 7: Commit.** Commit `feat(goalie): hold covered saves`.

### Task 2: Add aimable goalie outlet passes and deterministic timeout

**Files:**
- Create: `packages/arcade-core/src/sim/goalieOutlet.ts`
- Create: `packages/arcade-core/src/sim/goalieOutlet.test.ts`
- Modify: `packages/arcade-core/src/sim/types.ts`
- Modify: `packages/arcade-core/src/sim/world.ts`
- Modify: `packages/arcade-core/src/sim/goalie.ts`
- Modify: `packages/arcade-core/src/index.ts`

**Interfaces:**
- Produces `GOALIE_OUTLET_TIMEOUT_MS = 2500`.
- Produces `stepGoalieOutlet(world, goalie, input, dtMs): boolean`, returning true on release.
- Produces `selectGoalieOutletTarget(world, goalie): SkaterEntity | null`.

- [ ] **Step 1: Write failing outlet tests.** Cover held charge, falling-edge release, remembered nonzero aim, speed increase with charge, cleared goalie possession, safe release offset, self-pickup lockout, timeout at 2500 ms, up-ice target preference, blocked-lane fallback, and slot-ID tie-break.

```ts
stepWorld(world, [frame("home-goalie", 1, { pass: true, moveX: 1 })], 16);
expect(world.puck.goalieCarrierId).toBe("home-goalie");
stepWorld(world, [frame("home-goalie", 2, { pass: false, moveX: 1 })], 16);
expect(world.puck.goalieCarrierId).toBeNull();
expect(world.puck.velocity.x).toBeGreaterThan(0);
```

- [ ] **Step 2: Run RED.** Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/goalieOutlet.test.ts`. Expect module-not-found.

- [ ] **Step 3: Add goalie outlet fields.** Add `passChargeMs`, `outletAim`, `possessionStartedAtMs`, and `passWasHeld` to `GoalieEntity`; initialize/reset all fields in world creation and faceoff lifecycle.

- [ ] **Step 4: Implement human charge/release.** Route the latest goalie-ID frame in `stepWorld`, update aim only above the existing stick deadzone, charge using `TUNING.puck.passChargeMaxMs`, and release with existing base/bonus pass speeds and assist direction.

- [ ] **Step 5: Implement deterministic fallback.** At `nowMs - possessionStartedAtMs >= 2500`, choose unblocked up-ice teammate, then nearest teammate, then clear up the middle. Sort exact ties by slot ID and use no randomness.

- [ ] **Step 6: Run GREEN and full core tests.** Expect PASS.

- [ ] **Step 7: Commit.** Commit `feat(goalie): add charged outlet passes`.

### Task 3: Add authoritative temporary server grants

**Files:**
- Modify: `packages/arcade-server/src/rooms/roster.ts`
- Modify: `packages/arcade-server/src/rooms/roster.test.ts`
- Modify: `packages/arcade-server/src/rooms/schema.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.test.ts`

**Interfaces:**
- `RoomRosterSlot.controlledGoalieId: string | null`.
- `selectGoalieController(roster, world, goalieId): RoomRosterSlot | null` selects nearest human skater, slot-ID tie-break.
- Client input targets the grant only when sender owns that exact goalie ID.

- [ ] **Step 1: Write failing roster/schema tests.** Assert every slot starts with null grant; nearest same-team human is selected; ties use slot ID; `applyRosterToState` exposes the field.

- [ ] **Step 2: Write failing room authorization tests.** Assert a new cover sets one grant, the grantee's input is rewritten to the goalie ID, another client spoof is rejected/rewritten to its skater, release clears the grant, and disconnect leaves fallback active.

- [ ] **Step 3: Run RED.** Run `npm.cmd run test --workspace @bbh/arcade-server -- src/rooms/roster.test.ts src/rooms/ArcadeRoom.test.ts`.

- [ ] **Step 4: Add roster and schema fields.** Initialize `controlledGoalieId: null`, copy it to `ArcadeRoomSlotState`, and clear it on leave/team move/control switch/rematch/lobby reset.

- [ ] **Step 5: Detect possession transitions around each sim sub-step.** Compare previous/current `goalieCarrierId`: assign a grant on null→goalie, and clear all matching grants on goalie→null. Sync roster state only when a grant changes.

- [ ] **Step 6: Authorize input target.** Ignore the wire slot ID. Set the stored frame's slot to `slot.controlledGoalieId ?? slot.slotId`; acknowledge under the active entity ID and suppress manual switch latching while goalie-controlled.

- [ ] **Step 7: Run GREEN and server suite.** Expect PASS.

- [ ] **Step 8: Commit.** Commit `feat(goalie): grant temporary outlet control`.

### Task 4: Add Free Skate temporary control parity

**Files:**
- Modify: `packages/arcade-client/src/game/localSim.ts`
- Modify: `packages/arcade-client/src/game/localSim.test.ts`
- Modify: `packages/arcade-client/src/ui/FreeSkate.tsx`

**Interfaces:**
- Replace/augment `getControlledSlotId()` with `getControlledEntityId(): string` while retaining skater-slot access where needed.
- Local input targets `goalieCarrierId` when the human's team goalie holds the puck, then returns to the remembered skater after release.

- [ ] **Step 1: Write failing local-sim tests.** Force a home cover, assert controlled entity becomes `home-goalie`, input releases an aimed pass, controlled entity returns to the prior skater, and noncontrolled skaters continue receiving bot frames.

- [ ] **Step 2: Run RED.** Run `npm.cmd run test --workspace @bbh/arcade-client -- src/game/localSim.test.ts`.

- [ ] **Step 3: Track `controlledSkaterSlotId` separately from `controlledGoalieId`.** Target the human frame at the goalie during possession, exclude only the controlled skater from skater bot generation, and clear manual-switch latches during goalie control.

- [ ] **Step 4: Expose active entity to Free Skate.** Pass both the controlled skater slot and active goalie ID to `Scene`; preserve skater return/reception switching after release.

- [ ] **Step 5: Run GREEN and client local-sim regressions.** Expect PASS.

- [ ] **Step 6: Commit.** Commit `feat(goalie): support outlets in free skate`.

### Task 5: Route online input, camera, puck, and identity highlight

**Files:**
- Modify: `packages/arcade-client/src/store.ts`
- Create: `packages/arcade-client/src/store.test.ts`
- Modify: `packages/arcade-client/src/App.tsx`
- Modify: `packages/arcade-client/src/App.test.tsx`
- Modify: `packages/arcade-client/src/render/Scene.tsx`
- Modify: `packages/arcade-client/src/render/CameraRig.tsx`
- Create: `packages/arcade-client/src/render/CameraRig.test.ts`
- Modify: `packages/arcade-client/src/render/GoalieModel.tsx`

**Interfaces:**
- `ServerRosterSlot.controlledGoalieId: string | null`.
- App derives `localSkaterSlotId`, `localGoalieId`, and `localControlledEntityId`.
- Scene accepts `localGoalieId` and `highlightColorByEntityId`.

- [ ] **Step 1: Write failing state/App tests.** Assert room state maps the grant, outgoing frames target the goalie, prediction is disabled/flushed while goalie-controlled, and the local identity color maps to the goalie instead of the skater.

- [ ] **Step 2: Write failing render helper tests.** Assert camera follow input selects goalie position while controlled and rendered puck position uses the goalie hold point when `goalieCarrierId` is active.

- [ ] **Step 3: Run RED.** Run focused store/App/CameraRig tests.

- [ ] **Step 4: Map and derive active control.** Add `controlledGoalieId` to store types; in App send frames to `localControlledEntityId`, key input acknowledgements by active entity, and run prediction only when no goalie grant exists.

- [ ] **Step 5: Render goalie possession and highlight.** Have Scene attach the puck to the authoritative goalie hold point, render the identity disc/highlight beneath the controlled goalie, suppress the old skater highlight, and pass the controlled goalie's position to CameraRig.

- [ ] **Step 6: Run GREEN and full client suite.** Expect PASS.

- [ ] **Step 7: Commit.** Commit `feat(goalie): present temporary goalie control`.

### Task 6: Lifecycle and integrated verification

**Files:**
- Modify only files from Tasks 1-5 if a lifecycle regression is exposed.

- [ ] Add/confirm tests that goals, rematch, back-to-lobby, room disposal, and true faceoff reset clear possession, outlet fields, prediction buffers, and grants.
- [ ] Run `npm.cmd test`; expect every arcade test PASS.
- [ ] Run `npm.cmd run typecheck`; expect exit code 0.
- [ ] Run `npm.cmd run build:arcade`; expect exit code 0 with only the known Vite chunk warning.
- [ ] Run `npm.cmd run smoke --workspace @bbh/arcade-server`; expect all seven checks PASS.
- [ ] Verify determinism with repeated cover/outlet sequences and inspect scope for legacy-package changes.
- [ ] Manually verify solo and two-client play: cover stays in crease, correct human gets goalie highlight/camera, held pass charges, aim directs outlet, control returns, reception switching still works, and 2500 ms fallback prevents deadlock.

## Self-Review

- Spec coverage: core possession/outlet is Tasks 1-2; authorization is Task 3; Free Skate parity is Task 4; online client presentation is Task 5; lifecycle and complete verification is Task 6.
- Type consistency: `goalieCarrierId`, outlet fields, `controlledGoalieId`, and active-entity derivation have single names across all layers.
- Scope: goalie movement, shooting, checking, persistent control, and unrelated prediction redesign remain excluded.
