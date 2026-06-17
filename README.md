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

Skaters currently render as tinted procedural models so the game runs with **no external
assets**. To use the KayKit-style rigged GLB models, copy humanoid `.glb` files into
`packages/client/public/models/chars/` (see `packages/client/src/render/clipMap.ts` for the
expected animation clip names) and point each character's `glb` field at them.

Model source & licensing for the upstream GLBs: see `CREDITS.md`.
