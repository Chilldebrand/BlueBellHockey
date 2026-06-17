# BBellHockey 🏒

Online **3v3 arcade hockey** — browser-based, cartoony 3D, NHL-3v3-Arcade / NBA-Street flavor.

- **10 characters**, each with a unique 5-attribute build (speed / hit / steal / shoot / pass,
  rated 1–10, **38 points total**) and a **unique ultimate**.
- Ultimates charge from a **7:30 floor** (no positive plays) down to a **~2:00 cadence**
  with perfect play.
- Matches are **3 periods × 3:00**, with sudden-death overtime on a tie.
- **Online from the start**: an authoritative [Colyseus](https://colyseus.io) server runs
  the simulation at 30 Hz; clients render with React + [react-three-fiber](https://docs.pmnd.rs/react-three-fiber).
- Mouse + keyboard **and** gamepad. Empty slots are filled by bots, so a full 3v3 runs solo.

## Monorepo layout

| Package | What it is |
|---|---|
| `packages/shared` | Pure-TS deterministic game core (config + simulation). Imported by **both** server (authority) and client (prediction). No deps. |
| `packages/server` | Colyseus `MatchRoom`: 30 Hz tick → `sim.step()`, schema sync, match state machine, bot/goalie AI. |
| `packages/client` | Vite + React + R3F: rink + skaters + puck, input (KB/mouse + gamepad), HUD, lobby, character select. |

The simulation is **2D physics on the ice plane** (X = goal-to-goal, Z = width) rendered in 3D —
no 3D physics engine.

## Run it

```bash
npm install
npm run dev      # builds shared, then runs server (:2567) + client (:5173)
```

Open <http://localhost:5173>, hit **PLAY**, pick a skater, **START MATCH**.
Open a second tab to join the same room as a teammate/opponent.

Colyseus monitor: <http://localhost:2567/colyseus>

### Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move | WASD / arrows | Left stick |
| Aim | Mouse | Right stick |
| Shoot | J / Left click | A |
| Pass | K / Right click | X |
| Hit | Shift | RB |
| Steal | F | LB / B |
| Ultimate | Space / E | RT |

## Tests

```bash
npm test     # Vitest in packages/shared
```

Covers physics/mechanics, the 38-point + unique-distribution character invariants, and the
charge model (zero-play → 7:30, perfect cadence → ~2:00).

## Art

Skaters render as **rigged KayKit GLB models** (`packages/client/public/models/chars/*.glb`),
cloned per-instance with `three-stdlib`'s `SkeletonUtils`, tinted with a team-color emissive,
and animated from their built-in clips via `CharacterModel.tsx` + `clipMap.ts`
(`Idle`/`Walking_A`/`Running_A` for skating, `Hit_A` for checks, `1H_Melee_Attack_*` /
`2H_Melee_Attack_*` one-shots on shoot/hit). Each skater also gets a team-colored ground ring
for readability, a carrier ring, and an ultimate aura. If a model fails to load, a procedural
body fallback renders instead (`ModelBoundary`).

Two visual constants in `CharacterModel.tsx` are easy to tune if needed: `MODEL_SCALE` and
`MODEL_YAW` (set `MODEL_YAW = Math.PI` if a model faces away from its travel direction).

Model source & licensing (CC0 KayKit assets via the upstream repo): see `CREDITS.md`.
