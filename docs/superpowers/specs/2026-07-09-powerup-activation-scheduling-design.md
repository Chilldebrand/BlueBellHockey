# Powerup Activation And Scheduling Design

## Status

Approved by the user's instruction to continue the audit handoff with subagent-driven implementation. This specification covers only the first recommended cluster: powerup activation and deterministic spawn scheduling.

## Goal

Make collected powerups usable by human and bot skaters, show the local player's held powerup in the match HUD, and spawn each scheduled pickup or banana exactly once beginning at the first 9-second cadence boundary.

## Current Failure

The simulation already collects and applies powerups when an `InputFrame` contains `usePowerup: true`, but the live paths discard that signal:

- client input state and frames do not contain `usePowerup`;
- keyboard and gamepad adapters have no activation binding;
- the server input sanitizer drops `usePowerup`;
- bot decisions calculate `usePowerup`, but bot frames omit it;
- `PowerupHud` exists but `HUD` does not mount it.

The scheduler derives `spawnIndex` directly from the current time and treats an object still present in the rink lists as proof that an index was processed. This spawns index 0 on the first nonzero tick, skips the intended first index after large time steps, and repeats an index after its pickup or banana is consumed.

## Approaches Considered

### 1. Keep transient duplicate detection

Add more searches through event history or retained rink objects. This avoids a world-schema change, but correctness would still depend on data whose lifecycle is unrelated to schedule progress. Event queues and objects are intentionally removed, so they cannot be authoritative scheduler state.

### 2. Store a deterministic schedule cursor in `WorldState` (selected)

Add `lastPowerupSpawnIndex`, initialized to `-1`. At each powerup step, compute the latest cadence index that is due, spawn every unprocessed index in ascending order, and advance the cursor. This makes the schedule replayable, supports large deterministic time steps, and stays correct after collection, expiry, or banana consumption.

### 3. Keep the cursor outside the world

Track the next spawn in the server room or simulator wrapper. This would keep `WorldState` smaller, but local simulation, server simulation, snapshots, and replay-like tests could diverge. Scheduling belongs in the shared authoritative world.

## Approved Design

### Scheduling

`WorldState.lastPowerupSpawnIndex` is the sole record of processed cadence slots. Index 0 becomes due when `world.time.nowMs >= POWERUP_SPAWN_INTERVAL_MS`; index N becomes due at `(N + 1) * POWERUP_SPAWN_INTERVAL_MS`. No object appears during the initial interval. When more than one boundary is crossed between steps, the simulation processes missing indices in ascending order so fixed-step and coarse-step simulations reach the same schedule state.

The existing seed/index functions continue to choose powerup type, banana cadence, and rink point. Removing or consuming a spawned object never changes the cursor and cannot repeat that index.

### Human input

`ArcadeInputState` gains a required boolean `usePowerup`. Neutral input initializes it to `false`, merged inputs OR the value, and `createInputFrame` copies it without transformation. Keyboard `Q` and standard-gamepad `Y` (button index 3) activate a held powerup. These bindings do not overlap the current skill-stick, pass, check, poke, dive, or turbo controls.

The server sanitizer accepts only the literal boolean `true`; missing, false, or non-boolean values become `false`, matching the existing action-button sanitation pattern. The existing session/slot ownership enforcement remains unchanged.

### Bot input

`createBotInputFrame` copies `decision.usePowerup` into the shared frame. The decision heuristics remain unchanged; this work only delivers their existing decision to the simulation.

### HUD

`HUD` mounts the existing `PowerupHud` for the locally owned skater and passes `localSkater.heldPowerupType`. It remains hidden when no local skater exists, consistent with the turbo and target HUD elements.

## Testing

- Core scheduler tests prove no early spawn, index 0 at the first boundary, ordered catch-up, and no repeat after pickup or banana removal.
- Bot tests prove an existing true decision produces `usePowerup: true` and a no-powerup decision produces false.
- Server room tests prove a client true value survives sanitation and non-boolean values do not.
- Client pure tests prove neutral, merge, frame, keyboard Q, and gamepad Y behavior.
- HUD rendering tests prove the local held powerup label is mounted.
- Full arcade tests, typecheck, production build, and server smoke run after integration.

## Constraints And Non-Goals

- Modify only `packages/arcade-core`, `packages/arcade-server`, and `packages/arcade-client` plus design/plan documentation.
- Preserve deterministic fixed-step shared simulation.
- Do not change powerup effect balance, pickup radius, spawn interval, spawn points, AI heuristics, specials, or legacy packages.
- Do not add dependencies.
- Use `npm.cmd` on Windows.

## Acceptance Criteria

- Humans can activate a held powerup with Q or gamepad Y.
- Bots can activate a held powerup when their existing decision returns true.
- The server preserves only sanitized `usePowerup` booleans.
- The local HUD displays the held powerup label.
- Nothing spawns before 9 seconds.
- Every due spawn index is processed once, even after its object is removed.
- Coarse and fixed time progression produce the same processed spawn indices.
- Focused regressions and the complete verification suite pass.
