# Work Orders — "NHL Street" Conversion

A phased plan to convert BBellHockey from a clean 3v3 sim into an arcade,
EA-BIG-style "Street" game: trick-driven offense, a style/Gamebreaker economy,
combos, and over-the-top presentation.

Each work order is independently shippable and testable. They are ordered so the
game gains the *Street identity* as early as possible (Phases 0–2 are mostly
retuning systems that already exist), then adds the deeper trick mechanics
(Phase 3+), then polish.

## Phases

| WO | Title | Theme | Depends on | Est. |
|----|-------|-------|-----------|------|
| [WO-00](WO-00-arcade-feel.md) | Arcade feel pass | Tuning only — make the base game move like an arcade title | — | ~0.5 day |
| [WO-01](WO-01-style-meter.md) | Style Meter | Reframe the charge economy to reward flashy play | WO-00 (soft) | ~0.5–1 day |
| [WO-02](WO-02-gamebreaker-goals.md) | Gamebreaker goals | Ult-active goals worth 2 / steal a point | WO-01 | ~1 day |
| [WO-03](WO-03-trick-deke-system.md) | Trick / deke system | New deke action; ankle-breakers; whiff risk | WO-01 | ~2–4 days |
| [WO-04](WO-04-combo-multiplier.md) | Combo multiplier | Chain tricks for a rising meter multiplier | WO-03 | ~1–2 days |
| [WO-05](WO-05-vibe-layer.md) | Vibe layer | Callouts, juice, graffiti rink, announcer | WO-01..04 | ~2–3 days |
| [WO-06](WO-06-ai-catchup.md) | AI catch-up | Bots use Gamebreakers + dekes | WO-02, WO-03 | ~1–2 days |

Recommended path: **0 → 1 → 2** gives the Street identity fast. **3** is the
real engineering (a new action across the whole input→sim chain). **4–6** layer
depth and polish.

## Architecture cheat-sheet (read before touching code)

The simulation is **deterministic 2D physics on the X/Z ice plane**, shared by
server (authority) and client (prediction). Key flow:

```
client input  → InputManager.gather()  packages/client/src/input/inputState.ts
              → net.sendInput()         packages/client/src/net/client.ts
              → MSG.INPUT message
server tick   → MatchRoom.tick()        packages/server/src/rooms/MatchRoom.ts
              → step(world, inputs, dt) packages/shared/src/sim/world.ts   ← all game rules live here
              → syncState(state, world) packages/server/src/rooms/state.ts ← Colyseus schema
              → broadcast(events)       (one-shot SimEvents for VFX/SFX)
client render → onState() snapshots     packages/client/src/net/client.ts
              → EventBus → HUD / Vfx
```

### Three plumbing patterns you'll reuse across work orders

1. **Add a new player action (e.g. `deke`)** — touch, in order:
   `ActionFlags` + `emptyActions()` (`packages/shared/src/sim/types.ts`) →
   `GamepadReading`/`readGamepad` (`packages/client/src/input/gamepad.ts`) →
   `gather()` actions object (`packages/client/src/input/inputState.ts`) →
   keybind (`inputState.ts` via `KeyboardMouse`) →
   edge-trigger dispatch in `step()` (`world.ts`) →
   handler in `packages/shared/src/sim/actions.ts`.
   *Note:* actions ride the input message; they are **not** in the Colyseus
   schema, so no `state.ts` change is needed for the action itself.

2. **Add networked skater state (e.g. `combo`, `styleMeter`)** — touch:
   `SkaterState`/`emptyStatus` (`types.ts`) →
   `SkaterSchema` + `syncState` (`packages/server/src/rooms/state.ts`) →
   `SkaterSnap` + `onState` (`packages/client/src/net/client.ts`) →
   any store/UI that reads it (`packages/client/src/store.ts`, `ui/*`).

3. **Add a one-shot event/callout (e.g. `gamebreaker`, `style`)** — touch:
   `SimEvent` union (`types.ts`) → `emit(...)` in `actions.ts`/`world.ts` →
   broadcast filter (`MatchRoom.tick`, currently allows
   `goal|hit|ult|shot`) → `room.onMessage` + `GameEvent` type
   (`net/client.ts`) → subscriber in `ui/HUD.tsx` or `render/Vfx.tsx`.

### Tests
`packages/shared` uses Vitest (`npm test`). Existing specs that any rules change
must keep green (or be intentionally updated):
- `sim/world.test.ts` — physics/mechanics/goal detection
- `config/charge.test.ts` — charge cadence (zero-play → 7:30, perfect → ~2:00)
- `config/characters.test.ts` — 38-point sum + unique attribute multiset

### Conventions
- All gameplay rules belong in `packages/shared` so server and client agree.
- Timestamps are absolute sim-time ms (`WorldState.time`); store "until" values,
  compare against `world.time`. Keep logic frame-rate independent (use `dt`).
- Keep determinism: no `Date.now()`, no unl­ogged `Math.random()` in the sim
  (today only `bot.ts` uses `Math.random`, and bots are server-only).
- Each WO has its own acceptance criteria + test notes; update the relevant spec
  in the same change.

## Active track: Arcade AI positioning

The current coding track is the deterministic shared-core AI system. Use these
work orders for the next AI session:

| WO | Title | Depends on |
|----|-------|------------|
| [WO-AI-00](WO-AI-00-tactical-context.md) | Tactical context and observability | - |
| [WO-AI-01](WO-AI-01-role-tendencies-spacing.md) | Role tendencies and spacing | WO-AI-00 |
| [WO-AI-02](WO-AI-02-offensive-movement.md) | Offensive movement | WO-AI-01 |
| [WO-AI-03](WO-AI-03-defensive-positioning.md) | Defensive positioning | WO-AI-01 |
| [WO-AI-04](WO-AI-04-transitions-loose-pucks.md) | Transitions and loose pucks | WO-AI-02, WO-AI-03 |
| [WO-AI-05](WO-AI-05-autonomous-actions.md) | Autonomous passing and shooting | WO-AI-02, WO-AI-03 |
| [WO-AI-06](WO-AI-06-tuning-verification.md) | Tuning and verification | WO-AI-00 through WO-AI-05 |

Design: `docs/superpowers/specs/2026-07-09-arcade-ai-positioning-design.md`.
Implementation plan: `docs/superpowers/plans/2026-07-09-arcade-ai-positioning.md`.

The original `WO-00` through `WO-06` documents above are historical NHL Street
conversion/reference material. They are not active instructions for this AI
track, and their legacy `packages/shared`, `packages/server`, and
`packages/client` paths must not be used for the next coding session. Current
AI work belongs in `packages/arcade-core`.
