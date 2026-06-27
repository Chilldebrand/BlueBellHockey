# Work Orders - NHL Arcade Rebuild

This file turns the approved rebuild spec into actionable work orders.

Source spec: `docs/superpowers/specs/2026-06-27-nhl-arcade-rebuild-design.md`

## Direction

Build a new multiplayer-first, browser-based 3v3 arcade hockey game that closely matches the feel, camera language, character proportions, menu flow, and presentation of the reference video:

`3 on 3 NHL Arcade Longplay (Xbox 360 Version) - Difficulty: Hard`

This is a full rebuild. The existing game can be used as reference, but the new implementation should not preserve existing Street/Gamebreaker/combo systems as core gameplay. The new work should use original teams, logos, characters, uniforms, names, and specials.

## Package Strategy

Build the new game in parallel packages so the current app remains intact until the rebuild is playable:

| Package | Responsibility |
|---|---|
| `packages/arcade-core` | Pure TypeScript deterministic game rules, types, config, and tests. |
| `packages/arcade-server` | Authoritative Colyseus rooms, matchmaking, bot fill, snapshots, and room tests. |
| `packages/arcade-client` | Vite/React/R3F client, menus, rendering, input, prediction, interpolation, and UI tests. |
| `packages/arcade-assets` | Data files, character specs, animation contracts, team palettes, and asset validation. |

Root scripts should keep the current app available while adding rebuild scripts such as `dev:arcade`, `test:arcade`, and `typecheck:arcade`.

## Phases

| WO | Title | Theme | Depends on | Est. |
|---|---|---|---|---|
| [WO-A00](#wo-a00-rebuild-shell-and-repo-rails) | Rebuild shell and repo rails | Parallel packages and scripts | - | 0.5-1 day |
| [WO-A01](#wo-a01-shared-game-core-foundation) | Shared game-core foundation | Deterministic world state and config | A00 | 1-2 days |
| [WO-A02](#wo-a02-authoritative-room-lifecycle) | Authoritative room lifecycle | Colyseus room, private codes, roster slots | A00, A01 | 1-2 days |
| [WO-A03](#wo-a03-client-shell-and-connection-flow) | Client shell and connection flow | Vite/R3F client joins rooms | A00, A02 | 1-2 days |
| [WO-A04](#wo-a04-skating-and-input-pipeline) | Skating and input pipeline | Fixed tick movement, prediction-ready input | A01, A02, A03 | 2-3 days |
| [WO-A05](#wo-a05-puck-possession-passing-and-shooting) | Puck, passing, and shooting | Hockey slice begins | A04 | 2-4 days |
| [WO-A06](#wo-a06-checking-knockdowns-and-collisions) | Checking and knockdowns | Arcade contact | A05 | 2-3 days |
| [WO-A07](#wo-a07-goalies-scoring-faceoffs-and-match-end) | Goalies and scoring | Playable match loop | A05, A06 | 3-5 days |
| [WO-A08](#wo-a08-reference-rink-camera-and-hud) | Rink, camera, and HUD | Reference readability | A07 | 2-4 days |
| [WO-A09](#wo-a09-bespoke-character-art-pipeline) | Bespoke character pipeline | Original skater/goalie standards | A03, A08 | 3-6 days |
| [WO-A10](#wo-a10-roster-stats-uniforms-and-character-select) | Roster and character select | 10-12 original characters | A09 | 3-6 days |
| [WO-A11](#wo-a11-animation-system-and-core-clips) | Animation system and core clips | Skater/goalie motion readability | A09, A10 | 4-8 days |
| [WO-A12](#wo-a12-turbo-and-switch-assist-targeting) | Turbo and targeting | Required controls | A07 | 2-4 days |
| [WO-A13](#wo-a13-powerups-and-character-specials) | Powerups and specials | Server-authoritative arcade moments | A12, A10 | 4-7 days |
| [WO-A14](#wo-a14-arcade-menu-flow-and-postgame) | Menus and postgame | Frosty console presentation | A10, A13 | 3-6 days |
| [WO-A15](#wo-a15-bot-fill-ai-and-solo-multiplayer-readiness) | Bot fill and AI | 1-6 humans always playable | A13 | 3-6 days |
| [WO-A16](#wo-a16-online-hardening-tuning-and-release-gate) | Online hardening and tuning | Reliability, balance, smoke checks | A14, A15 | 4-8 days |

## Shared Conventions

- Multiplayer is always first-class. Every playable work order must support a two-tab room smoke test.
- Server owns truth for scoring, powerups, specials, goalie outcomes, and match end.
- `arcade-core` must not use `Date.now()`, unseeded randomness, DOM APIs, browser APIs, or server-only APIs.
- Use fixed simulation ticks and absolute simulation time in milliseconds.
- Prefer simple named constants in config files over scattered magic numbers.
- Add tests before behavior changes.
- Commit after each work order passes its listed checks.
- Do not copy NHL branding, team marks, player likenesses, UI art, or names from the reference video.

## Architecture Cheat Sheet

Target flow:

```text
client input
  -> arcade-client input mapper
  -> compact input frame
  -> arcade-server Colyseus room
  -> arcade-core step(world, inputs, dt)
  -> arcade-server snapshot/event broadcast
  -> arcade-client interpolation/prediction/render/HUD
```

Target package responsibilities:

```text
packages/arcade-core/src/config/*       numbers, teams, roster, powerups, specials
packages/arcade-core/src/sim/*          world, skaters, puck, collisions, scoring
packages/arcade-core/src/net/*          serializable input/snapshot/event contracts
packages/arcade-server/src/rooms/*      room lifecycle, roster, sync, events
packages/arcade-server/src/ai/*         bot skaters and server goalies
packages/arcade-client/src/input/*      keyboard/gamepad mapping
packages/arcade-client/src/net/*        room connection, snapshot/event handling
packages/arcade-client/src/game/*       prediction and interpolation
packages/arcade-client/src/render/*     rink, skaters, puck, camera, VFX
packages/arcade-client/src/ui/*         menus, HUD, team select, character select
packages/arcade-assets/*                character and animation contracts
```

---

## WO-A00: Rebuild Shell And Repo Rails

| | |
|---|---|
| Phase | 0 |
| Depends on | - |
| Blocks | All rebuild work |
| Est. effort | 0.5-1 day |
| Risk | Low |
| Status | Not started |

### Objective

Create parallel rebuild packages and scripts without deleting or destabilizing the current game.

### Scope

In scope:

- add new workspace packages
- add build/test/typecheck scripts for rebuild packages
- add minimal package configs
- add a short README for the rebuild package layout

Out of scope:

- gameplay rules
- client rendering
- Colyseus room behavior
- asset production

### Files

- Modify: `package.json`
- Modify: `tsconfig.base.json`
- Create: `packages/arcade-core/package.json`
- Create: `packages/arcade-core/tsconfig.json`
- Create: `packages/arcade-core/src/index.ts`
- Create: `packages/arcade-server/package.json`
- Create: `packages/arcade-server/tsconfig.json`
- Create: `packages/arcade-server/src/index.ts`
- Create: `packages/arcade-client/package.json`
- Create: `packages/arcade-client/tsconfig.json`
- Create: `packages/arcade-client/index.html`
- Create: `packages/arcade-client/src/main.tsx`
- Create: `packages/arcade-assets/package.json`
- Create: `packages/arcade-assets/README.md`
- Create: `docs/workorders/NHL_ARCADE_REBUILD_WORKORDERS.md` if this file is not already present

### Tasks

1. Add `packages/arcade-core`, `packages/arcade-server`, `packages/arcade-client`, and `packages/arcade-assets` to root workspaces.
2. Add root scripts:
   - `build:arcade-core`
   - `dev:arcade-server`
   - `dev:arcade-client`
   - `dev:arcade`
   - `test:arcade`
   - `typecheck:arcade`
3. Keep current `dev`, `test`, and `typecheck` scripts working.
4. Create minimal package exports so each package can be imported.
5. Add one smoke test per package where the package has a test runner.

### Acceptance Criteria

- `npm install` recognizes all new workspaces.
- `npm run typecheck:arcade` succeeds.
- `npm run test:arcade` succeeds or exits cleanly with no tests where explicitly configured.
- Current root scripts remain available.
- No existing gameplay package is deleted.

### Verification

Run:

```powershell
npm run typecheck:arcade
npm run test:arcade
npm run typecheck
```

Expected:

- typecheck passes for rebuild packages
- existing typecheck still passes

### Commit

```powershell
git add package.json tsconfig.base.json packages/arcade-core packages/arcade-server packages/arcade-client packages/arcade-assets docs/workorders/NHL_ARCADE_REBUILD_WORKORDERS.md
git commit -m "Create NHL Arcade rebuild workspace"
```

---

## WO-A01: Shared Game-Core Foundation

| | |
|---|---|
| Phase | 1 |
| Depends on | A00 |
| Blocks | A02, A04, A05, A07, A12, A13 |
| Est. effort | 1-2 days |
| Risk | Medium |
| Status | Not started |

### Objective

Create the deterministic shared core types, configs, and world lifecycle that all multiplayer gameplay will use.

### Scope

In scope:

- serializable world state
- teams and skater slots
- rink constants
- match clock state
- input frame type
- snapshot and event contracts
- deterministic `createWorld` and `stepWorld`

Out of scope:

- full puck physics
- real skating implementation
- scoring
- powerups
- specials

### Files

- Create: `packages/arcade-core/src/config/rink.ts`
- Create: `packages/arcade-core/src/config/match.ts`
- Create: `packages/arcade-core/src/config/teams.ts`
- Create: `packages/arcade-core/src/net/messages.ts`
- Create: `packages/arcade-core/src/sim/types.ts`
- Create: `packages/arcade-core/src/sim/world.ts`
- Create: `packages/arcade-core/src/sim/world.test.ts`
- Modify: `packages/arcade-core/src/index.ts`

### Tasks

1. Define team ids as `home` and `away`.
2. Define six skater slots, three per team.
3. Define goalie slots as server-owned entities.
4. Define `InputFrame` with movement, aim, pass, shoot, check, turbo, switchTarget, usePowerup, and special flags.
5. Define `WorldState` with time, phase, score, skaters, goalies, puck, active powerups, and event queue.
6. Implement `createWorld(seed, mode)` with deterministic initial state.
7. Implement `stepWorld(world, inputs, dtMs)` as a no-op tick that advances time only when phase is `playing`.
8. Add tests for world creation, slot counts, score initialization, and phase-aware clock ticking.

### Acceptance Criteria

- `arcade-core` exports stable types used by server and client.
- World creation is deterministic for the same seed/mode.
- Clock advances only during active play.
- No browser/server APIs are imported in `arcade-core`.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-core
npm run typecheck:arcade
```

Expected:

- core world tests pass
- no TypeScript errors

### Commit

```powershell
git add packages/arcade-core
git commit -m "Add arcade core world foundation"
```

---

## WO-A02: Authoritative Room Lifecycle

| | |
|---|---|
| Phase | 1 |
| Depends on | A00, A01 |
| Blocks | A03, A04 |
| Est. effort | 1-2 days |
| Risk | Medium |
| Status | Not started |

### Objective

Create the multiplayer room lifecycle for quick match, private room codes, team selection, initial character selection, bot fill, and authoritative snapshots.

### Scope

In scope:

- Colyseus room class
- player session metadata
- team assignment
- skater slot assignment
- private room code generation
- bot-fill slot ownership and default bot ids
- snapshot broadcast

Out of scope:

- real gameplay movement
- matchmaking pools
- reconnect handling
- final character roster

### Files

- Create: `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- Create: `packages/arcade-server/src/rooms/schema.ts`
- Create: `packages/arcade-server/src/rooms/roster.ts`
- Create: `packages/arcade-server/src/rooms/roster.test.ts`
- Create: `packages/arcade-server/src/rooms/ArcadeRoom.test.ts`
- Modify: `packages/arcade-server/src/index.ts`
- Modify: `packages/arcade-server/package.json`

### Tasks

1. Register `ArcadeRoom` in the server entrypoint.
2. Add room options for `privateCode`, `quickMatch`, and `mode`.
3. Track connected humans by Colyseus session id.
4. Assign humans to open skater slots.
5. Fill unassigned slots with bot ids.
6. Reject a seventh human player.
7. Expose room state with phase, score, clock, team slots, player names, and bot markers.
8. Broadcast snapshots at a fixed tick using `arcade-core`.
9. Add tests for room code generation, player join/leave, bot fill, slot limits, and state initialization.

### Acceptance Criteria

- A room always has a valid six-skater roster before match start.
- Bots fill empty skater slots.
- Human sessions own only their assigned slots.
- Private room code is stable for the room.
- Server tests cover roster limits.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-server -- roster
npm run test --workspace @bbh/arcade-server -- ArcadeRoom
npm run typecheck:arcade
```

Expected:

- roster and room tests pass
- no TypeScript errors

### Commit

```powershell
git add packages/arcade-server packages/arcade-core
git commit -m "Add arcade room lifecycle"
```

---

## WO-A03: Client Shell And Connection Flow

| | |
|---|---|
| Phase | 1 |
| Depends on | A00, A02 |
| Blocks | A04, A08, A10, A14 |
| Est. effort | 1-2 days |
| Risk | Medium |
| Status | Not started |

### Objective

Create the new client shell that can join an arcade room, choose a team/slot, and display authoritative room state.

### Scope

In scope:

- Vite/React/R3F app shell
- Colyseus client connection
- quick match button
- private room code join/create controls
- lobby state display
- team selection
- ready/start request

Out of scope:

- final frosty UI styling
- game rendering
- character select
- prediction

### Files

- Create: `packages/arcade-client/src/App.tsx`
- Create: `packages/arcade-client/src/store.ts`
- Create: `packages/arcade-client/src/net/client.ts`
- Create: `packages/arcade-client/src/net/client.test.ts`
- Create: `packages/arcade-client/src/ui/Lobby.tsx`
- Create: `packages/arcade-client/src/ui/Lobby.test.tsx`
- Modify: `packages/arcade-client/src/main.tsx`

### Tasks

1. Build a minimal app state store for connection status, room code, player session, roster, score, phase, and errors.
2. Implement `connectQuickMatch()`.
3. Implement `createPrivateRoom()`.
4. Implement `joinPrivateRoom(code)`.
5. Implement `chooseTeam(teamId)`.
6. Render a minimal lobby showing humans and bots in six skater slots.
7. Render start button only when the server says the roster is valid.
8. Add tests for state mapping and UI enable/disable behavior.

### Acceptance Criteria

- Two browser tabs can join the same private room.
- Each tab sees the same roster.
- Empty slots display as bots.
- Client does not locally invent match state.
- Connection errors appear in the UI.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-client
npm run typecheck:arcade
npm run dev:arcade
```

Manual smoke:

- Open two tabs at the arcade client URL.
- Create a private room in tab 1.
- Join the code in tab 2.
- Confirm both tabs show the same room code and roster.

### Commit

```powershell
git add packages/arcade-client packages/arcade-server
git commit -m "Add arcade client room connection flow"
```

---

## WO-A04: Skating And Input Pipeline

| | |
|---|---|
| Phase | 2 |
| Depends on | A01, A02, A03 |
| Blocks | A05, A06, A07, A12 |
| Est. effort | 2-3 days |
| Risk | Medium |
| Status | Not started |

### Objective

Implement server-authoritative skating movement with client input collection and basic prediction/interpolation.

### Scope

In scope:

- keyboard/gamepad input mapping
- compact input sending
- skater acceleration, glide, turn, and bounds
- server tick consumption of inputs
- snapshot interpolation
- local movement prediction for controlled skater

Out of scope:

- puck possession
- turbo
- checks
- animations beyond simple debug mesh orientation

### Files

- Create: `packages/arcade-core/src/sim/skater.ts`
- Create: `packages/arcade-core/src/sim/physics.ts`
- Modify: `packages/arcade-core/src/sim/world.ts`
- Modify: `packages/arcade-core/src/sim/world.test.ts`
- Modify: `packages/arcade-core/src/net/messages.ts`
- Create: `packages/arcade-client/src/input/keyboard.ts`
- Create: `packages/arcade-client/src/input/gamepad.ts`
- Create: `packages/arcade-client/src/input/inputState.ts`
- Create: `packages/arcade-client/src/game/interpolation.ts`
- Create: `packages/arcade-client/src/game/prediction.ts`
- Create: `packages/arcade-client/src/render/Scene.tsx`
- Create: `packages/arcade-client/src/render/SkaterDebug.tsx`
- Modify: `packages/arcade-client/src/net/client.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`

### Tasks

1. Add `moveX`, `moveY`, `aimX`, `aimY`, and button flags to input frames.
2. Add per-session input buffering on the server.
3. Add skater movement constants in `arcade-core`.
4. Implement acceleration and glide on the ice plane.
5. Clamp skaters to rink bounds.
6. Emit skater positions in snapshots.
7. Render debug skater capsules/discs in the client.
8. Add interpolation for remote skaters.
9. Add local prediction for the controlled skater.
10. Add tests for acceleration, glide decay, bounds, and deterministic repeated input.

### Acceptance Criteria

- Two tabs can move their assigned skaters in one room.
- Remote skater motion is smooth enough for a debug slice.
- Skaters cannot leave the rink.
- Same input sequence produces the same core result.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-core -- skater
npm run test --workspace @bbh/arcade-client -- interpolation
npm run typecheck:arcade
```

Manual smoke:

- Start `npm run dev:arcade`.
- Join two tabs.
- Move each controlled skater.
- Confirm each tab sees both skaters moving.

### Commit

```powershell
git add packages/arcade-core packages/arcade-server packages/arcade-client
git commit -m "Add multiplayer skating input pipeline"
```

---

## WO-A05: Puck, Possession, Passing, And Shooting

| | |
|---|---|
| Phase | 2 |
| Depends on | A04 |
| Blocks | A06, A07, A13 |
| Est. effort | 2-4 days |
| Risk | High |
| Status | Not started |

### Objective

Implement the core hockey loop: loose puck, possession, passing, wrist shots, charged shots, rebounds, and snapshot sync.

### Scope

In scope:

- puck state
- loose-puck pickup
- carried puck anchor
- pass action
- shot action
- charged shot state
- basic puck friction and board rebounds

Out of scope:

- goals and goalie saves
- one-timers
- powerups
- specials

### Files

- Create: `packages/arcade-core/src/sim/puck.ts`
- Create: `packages/arcade-core/src/sim/actions.ts`
- Modify: `packages/arcade-core/src/sim/types.ts`
- Modify: `packages/arcade-core/src/sim/world.ts`
- Modify: `packages/arcade-core/src/sim/world.test.ts`
- Modify: `packages/arcade-client/src/input/inputState.ts`
- Create: `packages/arcade-client/src/render/Puck.tsx`
- Modify: `packages/arcade-client/src/render/Scene.tsx`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`

### Tasks

1. Add puck position, velocity, carrier, lastTouch, and shot metadata to world state.
2. Implement loose-puck friction.
3. Implement board rebounds.
4. Implement pickup by stick reach, not body overlap only.
5. Implement carried puck anchor in front of the skater.
6. Add pass action with aimed teammate assist.
7. Add wrist shot action.
8. Add charged shot start/release/cancel state.
9. Sync puck state to clients.
10. Render puck and carried puck position.
11. Add tests for pickup, pass direction, pass assist, shot speed, charged shot power, and board rebound.

### Acceptance Criteria

- A skater can pick up a loose puck.
- A skater can pass into space or toward a teammate.
- A skater can shoot.
- Charged shot is stronger than wrist shot.
- Puck rebounds from boards and remains playable.
- All clients see the same puck carrier and puck position.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-core -- puck
npm run test --workspace @bbh/arcade-core -- actions
npm run typecheck:arcade
```

Manual smoke:

- Join two tabs.
- Pick up puck in tab 1.
- Pass and shoot.
- Confirm tab 2 sees carrier changes and puck movement.

### Commit

```powershell
git add packages/arcade-core packages/arcade-server packages/arcade-client
git commit -m "Add arcade puck passing and shooting"
```

---

## WO-A06: Checking, Knockdowns, And Collisions

| | |
|---|---|
| Phase | 2 |
| Depends on | A05 |
| Blocks | A07, A13 |
| Est. effort | 2-3 days |
| Risk | Medium |
| Status | Not started |

### Objective

Add legal arcade contact: checks, puck knock-loose, stumbles, knockdowns, sliding recovery, and collision events.

### Scope

In scope:

- check action
- carrier puck strip on hit
- impact force calculation
- stumble state
- knockdown state
- get-up timing
- collision event broadcast

Out of scope:

- penalties
- pileup chains
- special check abilities

### Files

- Modify: `packages/arcade-core/src/sim/actions.ts`
- Modify: `packages/arcade-core/src/sim/skater.ts`
- Modify: `packages/arcade-core/src/sim/physics.ts`
- Modify: `packages/arcade-core/src/sim/types.ts`
- Modify: `packages/arcade-core/src/sim/world.test.ts`
- Modify: `packages/arcade-client/src/input/inputState.ts`
- Modify: `packages/arcade-client/src/net/client.ts`
- Create: `packages/arcade-client/src/render/Vfx.tsx`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`

### Tasks

1. Add check input edge detection.
2. Add check cooldown and active check window.
3. Compute hit force from hitter speed, facing alignment, and character hit rating.
4. Knock puck loose when carrier is hit.
5. Apply stumble for medium force.
6. Apply knockdown and slide for high force.
7. Disable movement briefly while downed.
8. Add get-up timing.
9. Emit `hit`, `stumble`, and `knockdown` events.
10. Add simple client VFX/callout hooks for events.
11. Add tests for legal off-puck hit, carrier strip, cooldown, knockdown threshold, and recovery.

### Acceptance Criteria

- Hits never create penalties.
- Carrier hits knock the puck loose.
- Strong checks knock skaters down.
- Knocked-down skaters recover automatically.
- Events are visible to all clients.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-core -- hit
npm run typecheck:arcade
```

Manual smoke:

- Join two tabs.
- Check the carrier.
- Confirm puck comes loose and both tabs see the hit.

### Commit

```powershell
git add packages/arcade-core packages/arcade-server packages/arcade-client
git commit -m "Add arcade checking and knockdowns"
```

---

## WO-A07: Goalies, Scoring, Faceoffs, And Match End

| | |
|---|---|
| Phase | 2 |
| Depends on | A05, A06 |
| Blocks | A08, A12, A13, A14 |
| Est. effort | 3-5 days |
| Risk | High |
| Status | Not started |

### Objective

Complete the first playable multiplayer match loop with server goalies, goal detection, saves, faceoffs, clock, win condition, and stats.

### Scope

In scope:

- goal mouth detection
- goalie crease movement
- save outcomes
- rebounds and covers
- faceoff reset
- match clock
- win condition
- basic stats

Out of scope:

- final goalie art
- final save animations
- postgame UI
- specials and powerups

### Files

- Create: `packages/arcade-core/src/sim/goal.ts`
- Create: `packages/arcade-core/src/sim/goalie.ts`
- Modify: `packages/arcade-core/src/sim/puck.ts`
- Modify: `packages/arcade-core/src/sim/world.ts`
- Modify: `packages/arcade-core/src/sim/world.test.ts`
- Create: `packages/arcade-core/src/sim/stats.ts`
- Create: `packages/arcade-server/src/ai/goalie.ts`
- Create: `packages/arcade-server/src/ai/bot.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- Modify: `packages/arcade-client/src/net/client.ts`
- Create: `packages/arcade-client/src/ui/ScoreHud.tsx`

### Tasks

1. Add goal geometry constants.
2. Detect valid puck entry through the goal mouth.
3. Reject side/back net clips as non-goals.
4. Add goalie crease positions and lateral tracking.
5. Add save outcome selection: pad, glove, blocker, body, cover.
6. Add rebound behavior for hard saves.
7. Add cover/freeze and server-controlled clear after cover.
8. Add faceoff reset after goals and covers.
9. Add score and match clock.
10. Add match end when time expires or target score is reached.
11. Track goals, assists, shots, saves, hits, and takeaways.
12. Add tests for scoring, non-scoring goal collisions, save outcomes, cover, faceoff reset, and match end.

### Acceptance Criteria

- A full 3v3 match can start, score goals, reset faceoffs, and end.
- Goalies stay in the crease.
- Saves produce readable synced outcomes.
- Post-goal faceoff reset is server-authoritative.
- Basic stats are tracked on the server.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-core -- goal
npm run test --workspace @bbh/arcade-core -- goalie
npm run test --workspace @bbh/arcade-server -- goalie
npm run typecheck:arcade
```

Manual smoke:

- Join two tabs.
- Start a match.
- Score a goal.
- Confirm both tabs see score update and faceoff reset.

### Commit

```powershell
git add packages/arcade-core packages/arcade-server packages/arcade-client
git commit -m "Add arcade goalies and scoring loop"
```

---

## WO-A08: Reference Rink, Camera, And HUD

| | |
|---|---|
| Phase | 3 |
| Depends on | A07 |
| Blocks | A09, A14 |
| Est. effort | 2-4 days |
| Risk | Medium |
| Status | Not started |

### Objective

Make the first playable match visually read like the reference video: compact bright rink, high diagonal camera, top-left score/time, and simple player indicators.

### Scope

In scope:

- bright compact rink
- boards and glass
- center logo using original rebuild branding
- high diagonal puck-follow camera
- top-left score/time panel
- possession/control indicators
- basic callouts

Out of scope:

- final bespoke characters
- full menu skin
- advanced postprocessing

### Files

- Create: `packages/arcade-client/src/render/Rink.tsx`
- Create: `packages/arcade-client/src/render/CameraRig.tsx`
- Modify: `packages/arcade-client/src/render/Scene.tsx`
- Create: `packages/arcade-client/src/ui/HUD.tsx`
- Create: `packages/arcade-client/src/ui/Callouts.tsx`
- Modify: `packages/arcade-client/src/ui/ScoreHud.tsx`
- Create: `packages/arcade-client/src/styles/arcadeTheme.css`
- Create: `packages/arcade-client/src/render/camera.test.ts`

### Tasks

1. Build an original compact rink model with boards, glass, goal areas, center logo, and bright ice.
2. Add high diagonal camera preset.
3. Make camera follow puck with clamped lookahead.
4. Add subtle punch-in near goals, big hits, and special events.
5. Add top-left score/time panel.
6. Add above-player control/possession indicators.
7. Add short callouts for goal, save, and hit.
8. Add camera math tests for bounds and puck-follow target.
9. Run screenshot/manual checks against reference storyboard frames.

### Acceptance Criteria

- A single screenshot reads as arcade hockey from the reference perspective.
- Camera keeps the puck and nearby play visible.
- HUD is minimal and does not cover play.
- Team colors are strongly readable.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-client -- camera
npm run typecheck:arcade
npm run dev:arcade
```

Manual smoke:

- Compare a local match screenshot against the reference storyboard sheets in `.tmp/video-reference/storyboards` if present.
- Confirm score/time is top-left and play remains readable.

### Commit

```powershell
git add packages/arcade-client
git commit -m "Add reference rink camera and HUD"
```

---

## WO-A09: Bespoke Character Art Pipeline

| | |
|---|---|
| Phase | 4 |
| Depends on | A03, A08 |
| Blocks | A10, A11 |
| Est. effort | 3-6 days |
| Risk | High |
| Status | Not started |

### Objective

Define and integrate the bespoke stylized character pipeline from the start: big-head proportions, rig contract, material rules, and first production skater/goalie assets.

### Scope

In scope:

- character design standards
- rig and animation contract
- asset naming
- import harness
- first original skater model
- first original goalie model
- validation scripts

Out of scope:

- full roster
- every animation clip
- final menu character select polish

### Files

- Create: `packages/arcade-assets/characters/README.md`
- Create: `packages/arcade-assets/characters/rig-contract.md`
- Create: `packages/arcade-assets/characters/material-rules.md`
- Create: `packages/arcade-assets/characters/animation-contract.md`
- Create: `packages/arcade-assets/characters/roster.schema.json`
- Create: `packages/arcade-assets/characters/first-skater.spec.md`
- Create: `packages/arcade-assets/characters/first-goalie.spec.md`
- Create: `packages/arcade-client/public/arcade/models/README.md`
- Create: `packages/arcade-client/src/render/CharacterModel.tsx`
- Create: `packages/arcade-client/src/render/GoalieModel.tsx`
- Create: `packages/arcade-client/src/render/ModelPreview.tsx`
- Create: `packages/arcade-client/src/render/modelValidation.test.ts`

### Tasks

1. Define big-head proportion targets.
2. Define skater and goalie skeleton expectations.
3. Define required named bones and attachment points.
4. Define material slots for uniform recolor and character-owned gear.
5. Define required animation clip names.
6. Add first original skater concept/model spec.
7. Add first original goalie concept/model spec.
8. Add import path convention under `public/arcade/models`.
9. Build `CharacterModel` and `GoalieModel` loaders with fallback error UI.
10. Add validation tests that fail when required metadata or clip names are missing.

### Acceptance Criteria

- Character art has a written contract before full roster production.
- At least one bespoke skater and one bespoke goalie path are integrated or stubbed against the contract.
- Uniform recolor slots are separate from character-specific gear.
- Asset validation can reject incomplete character definitions.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-client -- modelValidation
npm run typecheck:arcade
```

Manual smoke:

- Open model preview route.
- Confirm first skater and goalie load or show a clear validation failure.

### Commit

```powershell
git add packages/arcade-assets packages/arcade-client
git commit -m "Define bespoke arcade character pipeline"
```

---

## WO-A10: Roster, Stats, Uniforms, And Character Select

| | |
|---|---|
| Phase | 5 |
| Depends on | A09 |
| Blocks | A11, A13, A14 |
| Est. effort | 3-6 days |
| Risk | High |
| Status | Not started |

### Objective

Create the original 10-12 character roster, team palettes, stat profiles, uniform recolor model, and character select screen.

### Scope

In scope:

- original character roster
- stats
- special ids
- team palette data
- uniform recolor rules
- character select UI
- server validation of selected character

Out of scope:

- final full animation set
- final modeled asset for every character if art production is still in progress
- powerup/special mechanics

### Files

- Create: `packages/arcade-core/src/config/characters.ts`
- Create: `packages/arcade-core/src/config/characters.test.ts`
- Create: `packages/arcade-core/src/config/specials.ts`
- Create: `packages/arcade-core/src/config/teams.ts`
- Create: `packages/arcade-core/src/config/teams.test.ts`
- Modify: `packages/arcade-server/src/rooms/roster.ts`
- Modify: `packages/arcade-server/src/rooms/roster.test.ts`
- Create: `packages/arcade-client/src/ui/CharacterSelect.tsx`
- Create: `packages/arcade-client/src/ui/TeamSelect.tsx`
- Create: `packages/arcade-client/src/ui/CharacterSelect.test.tsx`
- Modify: `packages/arcade-client/src/render/CharacterModel.tsx`

### Tasks

1. Define 10-12 original character ids, names, silhouettes, stat profiles, and special ids.
2. Define stat categories: speed, power, handling, shot, pass, defense.
3. Set a fixed stat budget so no character is strictly better.
4. Define original home/away team palettes.
5. Define uniform color slots for jersey, pants, socks, numbers, and trim.
6. Keep character-owned gear separate from team uniform slots.
7. Add server validation for character selection.
8. Add character select UI with stats and special description.
9. Add tests for roster count, unique ids, stat budget, valid special ids, and team contrast.

### Acceptance Criteria

- Roster contains 10-12 original characters.
- Every character has a valid unique id, stat profile, and special id.
- No real team/player names or copied likeness references are present.
- Team palettes are readable and distinct.
- Character select syncs through the server.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-core -- characters
npm run test --workspace @bbh/arcade-core -- teams
npm run test --workspace @bbh/arcade-client -- CharacterSelect
npm run typecheck:arcade
```

Manual smoke:

- Join two tabs.
- Select different teams and characters.
- Confirm selections sync in both tabs.

### Commit

```powershell
git add packages/arcade-core packages/arcade-server packages/arcade-client packages/arcade-assets
git commit -m "Add original arcade roster and character select"
```

---

## WO-A11: Animation System And Core Clips

| | |
|---|---|
| Phase | 5 |
| Depends on | A09, A10 |
| Blocks | A14, A16 |
| Est. effort | 4-8 days |
| Risk | High |
| Status | Not started |

### Objective

Wire the bespoke character rigs to gameplay states with short, readable arcade animations for skaters and goalies.

### Scope

In scope:

- animation state mapping
- skater animation clip selection
- goalie animation clip selection
- fallback pose handling
- gameplay state to animation state adapter
- validation tests

Out of scope:

- final animation polish for every character
- facial animation
- cinematic cutscenes

### Files

- Create: `packages/arcade-client/src/render/animation/clipMap.ts`
- Create: `packages/arcade-client/src/render/animation/clipMap.test.ts`
- Create: `packages/arcade-client/src/render/animation/skaterAnimation.ts`
- Create: `packages/arcade-client/src/render/animation/goalieAnimation.ts`
- Modify: `packages/arcade-client/src/render/CharacterModel.tsx`
- Modify: `packages/arcade-client/src/render/GoalieModel.tsx`
- Modify: `packages/arcade-assets/characters/animation-contract.md`
- Modify: `packages/arcade-client/src/render/SkaterDebug.tsx`

### Tasks

1. Map gameplay states to skater animation states: idle, skate, hardTurn, turbo, pass, wristShot, chargeShot, check, stumble, down, getUp, juke, celebrate.
2. Map goalie save outcomes to goalie animation states: ready, slide, padSave, gloveSave, blockerSave, bodySave, cover.
3. Add clip lookup with explicit fallback rules.
4. Drive animation state from authoritative snapshot plus local input hints.
5. Keep animation changes visual-only; they must not change server truth.
6. Add tests for every required state mapping.
7. Add validation that each production character references required clips or approved fallbacks.

### Acceptance Criteria

- Skating, shooting, checking, stumble, knockdown, and goalie saves read as distinct states.
- Missing clips fail validation or use an approved fallback.
- Non-goalie skaters never use goalie save clips.
- Goalies never use skater check/shot clips during saves.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-client -- clipMap
npm run test --workspace @bbh/arcade-client -- animation
npm run typecheck:arcade
```

Manual smoke:

- Trigger skate, shoot, check, knockdown, save, and cover in a local match.
- Confirm each state is visually distinct.

### Commit

```powershell
git add packages/arcade-client packages/arcade-assets
git commit -m "Add arcade character animation states"
```

---

## WO-A12: Turbo And Switch/Assist Targeting

| | |
|---|---|
| Phase | 6 |
| Depends on | A07 |
| Blocks | A13, A15 |
| Est. effort | 2-4 days |
| Risk | Medium |
| Status | Not started |

### Objective

Add required arcade controls for turbo/sprint and switch/assist target while preserving server ownership and multiplayer control rules.

### Scope

In scope:

- turbo meter or cooldown
- turbo speed boost and handling tradeoff
- switch target action
- assist target selection
- pass targeting bias
- defensive control switch for solo/undermanned teams

Out of scope:

- powerups
- character specials
- stamina simulation

### Files

- Modify: `packages/arcade-core/src/sim/skater.ts`
- Modify: `packages/arcade-core/src/sim/actions.ts`
- Modify: `packages/arcade-core/src/sim/types.ts`
- Modify: `packages/arcade-core/src/sim/world.test.ts`
- Modify: `packages/arcade-core/src/net/messages.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- Modify: `packages/arcade-server/src/rooms/roster.ts`
- Modify: `packages/arcade-client/src/input/inputState.ts`
- Modify: `packages/arcade-client/src/ui/HUD.tsx`
- Create: `packages/arcade-client/src/ui/TurboMeter.tsx`
- Create: `packages/arcade-client/src/ui/TargetIndicator.tsx`

### Tasks

1. Add turbo input flag and switch target input edge.
2. Add turbo meter/cooldown state to skaters.
3. Apply turbo speed boost with turn/handling penalty.
4. Recharge turbo when not active.
5. Add server-side target selection state.
6. On offense, select a teammate for pass assist.
7. On defense, select a sensible defended target or switchable skater.
8. Enforce that a human cannot take another human's assigned skater.
9. Display turbo and target indicators in HUD.
10. Add tests for turbo depletion/recharge, handling penalty, pass assist bias, and ownership protection.

### Acceptance Criteria

- Turbo creates visible breakaways without infinite spam.
- Turbo state is server-authoritative.
- Selected target biases passing.
- Control switching respects human ownership.
- HUD shows turbo and target state clearly.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-core -- turbo
npm run test --workspace @bbh/arcade-server -- roster
npm run typecheck:arcade
```

Manual smoke:

- Join two tabs.
- Use turbo in both tabs.
- Switch/assist target.
- Confirm no tab can steal the other human's skater.

### Commit

```powershell
git add packages/arcade-core packages/arcade-server packages/arcade-client
git commit -m "Add turbo and assist targeting"
```

---

## WO-A13: Powerups And Character Specials

| | |
|---|---|
| Phase | 6 |
| Depends on | A12, A10 |
| Blocks | A14, A15, A16 |
| Est. effort | 4-7 days |
| Risk | High |
| Status | Not started |

### Objective

Add server-authoritative rink powerups and character specials that create short, readable arcade moments.

### Scope

In scope:

- powerup spawn rules
- pickup and held powerup state
- use powerup action
- special charge/cooldown
- special activation validation
- initial special implementations
- VFX/HUD events

Out of scope:

- long ability chains
- combo economy
- monetized unlocks

### Files

- Create: `packages/arcade-core/src/config/powerups.ts`
- Create: `packages/arcade-core/src/config/powerups.test.ts`
- Modify: `packages/arcade-core/src/config/specials.ts`
- Create: `packages/arcade-core/src/config/specials.test.ts`
- Create: `packages/arcade-core/src/sim/powerups.ts`
- Create: `packages/arcade-core/src/sim/specials.ts`
- Modify: `packages/arcade-core/src/sim/world.ts`
- Modify: `packages/arcade-core/src/sim/world.test.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`
- Create: `packages/arcade-client/src/render/Powerups.tsx`
- Modify: `packages/arcade-client/src/render/Vfx.tsx`
- Create: `packages/arcade-client/src/ui/PowerupHud.tsx`
- Create: `packages/arcade-client/src/ui/SpecialMeter.tsx`

### Tasks

1. Define powerups: speed boost, hard-shot boost, goalie freeze, puck magnet, shield, instant special charge.
2. Add deterministic spawn slots and cadence.
3. Add pickup radius and held powerup state.
4. Add use powerup action.
5. Implement speed boost effect.
6. Implement hard-shot boost effect.
7. Implement goalie freeze effect.
8. Implement puck magnet effect.
9. Implement shield effect against one check.
10. Implement instant special charge.
11. Define character special charge/cooldown rules.
12. Implement first set of specials: super shot, heavy check, speed burst, goalie breaker, magnet stick, team pass boost, defensive wall, rebound storm, net-front screen, precision one-timer.
13. Emit powerup/special events.
14. Render pickup models and HUD indicators.
15. Add tests for spawn cadence, pickup, expiration, ownership, cooldown, and each effect.

### Acceptance Criteria

- Powerups are visible, collectible, usable, and server-authoritative.
- A player can hold or consume only valid powerups.
- Specials validate charge, cooldown, and ownership on the server.
- Each character has a valid special.
- Effects are short and readable.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-core -- powerups
npm run test --workspace @bbh/arcade-core -- specials
npm run typecheck:arcade
```

Manual smoke:

- Trigger every powerup in a local room.
- Trigger at least three different specials.
- Confirm both tabs see the same effects and HUD state.

### Commit

```powershell
git add packages/arcade-core packages/arcade-server packages/arcade-client
git commit -m "Add arcade powerups and character specials"
```

---

## WO-A14: Arcade Menu Flow And Postgame

| | |
|---|---|
| Phase | 7 |
| Depends on | A10, A13 |
| Blocks | A16 |
| Est. effort | 3-6 days |
| Risk | Medium |
| Status | Not started |

### Objective

Build the reference-like console arcade presentation flow: boot splash, frosty main menu, quick/private match, team select, character select, controller prompt, faceoff intro, win splash, postgame stats, and rematch.

### Scope

In scope:

- frosty UI theme
- boot/splash screen
- main menu
- quick match/private room UI
- team select
- character select polish
- controller prompt
- faceoff intro
- win splash
- postgame stats/rankings
- rematch/back to lobby

Out of scope:

- full matchmaking service
- account system
- progression/unlocks

### Files

- Create: `packages/arcade-client/src/ui/BootSplash.tsx`
- Create: `packages/arcade-client/src/ui/MainMenu.tsx`
- Modify: `packages/arcade-client/src/ui/Lobby.tsx`
- Modify: `packages/arcade-client/src/ui/TeamSelect.tsx`
- Modify: `packages/arcade-client/src/ui/CharacterSelect.tsx`
- Create: `packages/arcade-client/src/ui/ControllerPrompt.tsx`
- Create: `packages/arcade-client/src/ui/FaceoffIntro.tsx`
- Create: `packages/arcade-client/src/ui/WinSplash.tsx`
- Create: `packages/arcade-client/src/ui/Postgame.tsx`
- Modify: `packages/arcade-client/src/styles/arcadeTheme.css`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`

### Tasks

1. Define screen/state flow in the client store.
2. Add boot splash.
3. Add frosty main menu.
4. Add quick match and private room controls.
5. Polish team select.
6. Polish character select.
7. Add controller prompt before match start.
8. Add faceoff intro.
9. Add win splash after match end.
10. Add postgame rankings from authoritative stats.
11. Add rematch and back-to-lobby room messages.
12. Add tests for screen transitions and postgame stat mapping.

### Acceptance Criteria

- User can navigate from boot to match to postgame.
- Presentation visually matches frosty console-arcade direction.
- Postgame stats come from server state.
- Rematch does not require refreshing the browser.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-client -- Postgame
npm run test --workspace @bbh/arcade-client -- MainMenu
npm run typecheck:arcade
```

Manual smoke:

- Start from fresh page load.
- Create private room.
- Select team and character.
- Play until match end.
- Confirm win splash, postgame, and rematch work.

### Commit

```powershell
git add packages/arcade-client packages/arcade-server
git commit -m "Add arcade menu and postgame flow"
```

---

## WO-A15: Bot Fill AI And Solo Multiplayer Readiness

| | |
|---|---|
| Phase | 8 |
| Depends on | A13 |
| Blocks | A16 |
| Est. effort | 3-6 days |
| Risk | Medium |
| Status | Not started |

### Objective

Make 1-6 human rooms playable by giving bot-filled skater slots enough hockey intelligence to demonstrate skating, passing, shooting, checking, turbo, powerups, and specials.

### Scope

In scope:

- role-aware bot skater AI
- bot target selection
- bot passing/shooting/checking
- bot turbo use
- bot powerup use
- bot special use
- difficulty constants

Out of scope:

- machine learning
- advanced tactical systems
- manual goalie control

### Files

- Modify: `packages/arcade-server/src/ai/bot.ts`
- Create: `packages/arcade-server/src/ai/bot.test.ts`
- Modify: `packages/arcade-server/src/ai/goalie.ts`
- Create: `packages/arcade-server/src/ai/decision.ts`
- Create: `packages/arcade-server/src/ai/decision.test.ts`
- Modify: `packages/arcade-server/src/rooms/ArcadeRoom.ts`

### Tasks

1. Add bot roles: carrier, support, defender.
2. Make bot carriers skate toward the net.
3. Make support bots find passing lanes.
4. Make defenders pressure the carrier.
5. Make bots shoot from reasonable range.
6. Make bots pass when pressured.
7. Make bots check puck carriers.
8. Make bots use turbo for breakaways and recovery.
9. Make bots pick up and use powerups.
10. Make bots trigger specials in sensible contexts.
11. Add difficulty constants for reaction range, shot aggression, pass willingness, and special frequency.
12. Add tests for deterministic decision helpers.

### Acceptance Criteria

- A solo player plus five bots can complete a match.
- Bots use core mechanics often enough for the game to show its systems.
- Bots do not all chase the puck in a single clump.
- Bot special and powerup use is situational enough to read as intentional.

### Verification

Run:

```powershell
npm run test --workspace @bbh/arcade-server -- bot
npm run test --workspace @bbh/arcade-server -- decision
npm run typecheck:arcade
```

Manual smoke:

- Start a room with one human.
- Confirm five bots fill the match.
- Play a full match and verify bots pass, shoot, check, use turbo, and use at least one powerup or special.

### Commit

```powershell
git add packages/arcade-server
git commit -m "Add arcade bot fill AI"
```

---

## WO-A16: Online Hardening, Tuning, And Release Gate

| | |
|---|---|
| Phase | 8 |
| Depends on | A14, A15 |
| Blocks | Initial rebuild release |
| Est. effort | 4-8 days |
| Risk | High |
| Status | Not started |

### Objective

Tune the rebuilt game against the reference and harden online play enough for a first playable release.

### Scope

In scope:

- prediction/reconciliation polish
- latency handling
- reconnect best effort
- gameplay tuning
- goalie fairness
- powerup balance
- special balance
- performance checks
- full test suite
- two-tab and multi-tab smoke checks

Out of scope:

- ranked matchmaking
- persistent accounts
- monetization
- downloadable assets beyond the app bundle

### Files

- Modify: `packages/arcade-core/src/config/*.ts`
- Modify: `packages/arcade-core/src/sim/*.ts`
- Modify: `packages/arcade-server/src/rooms/*.ts`
- Modify: `packages/arcade-server/src/ai/*.ts`
- Modify: `packages/arcade-client/src/game/*.ts`
- Modify: `packages/arcade-client/src/render/*.tsx`
- Modify: `packages/arcade-client/src/ui/*.tsx`
- Create: `docs/arcade-rebuild-release-checklist.md`
- Modify: `README.md` when the rebuild becomes the primary run path

### Tasks

1. Tune skating speed, acceleration, glide, and turbo.
2. Tune puck friction, pickup reach, pass assist, and shot speed.
3. Tune checking force, knockdown threshold, and recovery time.
4. Tune goalie reaction, save reach, cover threshold, and rebound strength.
5. Tune powerup spawn cadence and effect duration.
6. Tune special charge/cooldown/effect strength.
7. Add reconnect best-effort handling for accidental refresh.
8. Add latency simulation notes and test cases.
9. Profile client frame rate in a six-skater match.
10. Profile server tick time in a bot-filled match.
11. Run complete tests.
12. Run manual two-tab smoke.
13. Run manual six-client or simulated six-player smoke if feasible.
14. Compare screenshots and match pacing against the reference storyboards.
15. Write `docs/arcade-rebuild-release-checklist.md`.
16. Update root README only when the rebuild is ready to become the primary app.

### Acceptance Criteria

- Full tests pass.
- Typecheck passes.
- Two-tab private room is stable for a full match.
- One-human plus five-bot room is stable for a full match.
- HUD/camera/rink read close to the reference.
- Bespoke characters render and animate in match.
- Powerups and specials are visible, short, and server-authoritative.
- Release checklist documents remaining known issues.

### Verification

Run:

```powershell
npm run test:arcade
npm run typecheck:arcade
npm run dev:arcade
```

Manual smoke:

- Two-tab private room.
- One-human plus five-bot full match.
- Rematch flow.
- Powerup and special usage.
- Postgame stats.
- Screenshot comparison to reference storyboard.

### Commit

```powershell
git add packages/arcade-core packages/arcade-server packages/arcade-client packages/arcade-assets docs README.md package.json
git commit -m "Tune NHL Arcade rebuild for first playable release"
```

## Execution Notes

Recommended implementation order:

1. A00-A03 create the multiplayer skeleton.
2. A04-A07 make the first ugly but playable multiplayer hockey match.
3. A08 makes the gameplay read like the reference.
4. A09-A11 bring in bespoke character art and animation as a core requirement.
5. A12-A13 add the required arcade controls, powerups, and specials.
6. A14 completes the reference-like presentation flow.
7. A15-A16 make it playable, stable, and tunable with any human count.

Do not skip the two-tab smoke checks. The rebuild is multiplayer-first; a feature is not complete if it works only in a local single-player path.
