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
| Shoot / **Slap** | J / Left click — *tap = wrist, hold = slap* | A |
| Pass | K / Right click | X |
| Hit | Shift | RB |
| Stick lift | F | LB |
| Poke check | G | LT |
| Deke | Q | B |
| Ultimate | Space / E | RT |

**Shot types.** Tap shoot for a quick, accurate **wrist shot**; *hold* it to wind up a
**slap shot** — power ramps up the longer you hold (release to fire), trading aim assist
for a much faster puck. The wind-up roots you and is telegraphed by a charging ring, so a
body check during it interrupts the shot. **Takeaways:** a **stick lift** (close range)
cleanly steals the puck; a **poke check** (longer reach, must be in front) knocks it loose
without guaranteeing possession; a **hit** bodies the skater.

All bindings above are **defaults** — every keyboard/mouse and gamepad **action**
can be remapped from the **⚙ Controls** panel (on the lobby screen and in the
in-game HUD). Movement stays on WASD/arrows + left stick and aim on mouse + right
stick; the digital actions are fully rebindable. Bindings persist in
`localStorage` (`bbh.controls.v1`).

## Tests

```bash
npm test     # Vitest in packages/shared
```

Covers physics/mechanics, the 38-point + unique-distribution character invariants, and the
charge model (zero-play → 7:30, perfect cadence → ~2:00).

## Art

**Scene & lighting** (`render/Scene.tsx`). Renders with ACES tone mapping and a
post-processing stack (`@react-three/postprocessing`): **bloom** — tuned to catch only
emissive highlights (goal lamps, ult auras, particles) so normal play stays clean — and a
**vignette**. A network-free image-based-lighting rig (drei `<Environment>` +
`<Lightformer>`) gives the ice and models real reflections without any HDR download.
(Gotcha: the `<EffectComposer>` must include a `<ToneMapping>` effect — it applies the final
sRGB output encode; without it the frame washes out.)

**Rink & arena.** `render/Rink.tsx` draws an NHL sheet — **reflective wet ice**
(`MeshReflectorMaterial`), white boards + glass, standard markings, red goals, and **goal
lamps** that flash and bloom when a team scores. `render/Arena.tsx` wraps it in a bowl:
instanced **crowd-filled stands** on all four sides, an enclosing back wall, overhead light
banks, perimeter ad boards, and a center-ice logo. Everything in the arena is decorative —
gameplay collision is server-side against `RINK` only.

**Skaters.** Rigged KayKit GLB models (`packages/client/public/models/chars/*.glb`), cloned
per-instance with `three-stdlib`'s `SkeletonUtils`, tinted with a team-color emissive, and
animated from their built-in clips via `CharacterModel.tsx` + `clipMap.ts`
(`Idle`/`Walking_A`/`Running_A` for skating, `Hit_A` for checks, `1H_Melee_Attack_*` /
`2H_Melee_Attack_*` one-shots on shoot/hit, `Cheer` when their team scores). Each gets
procedural **hockey gear** from `render/gear.ts` — a stick on the right-hand bone, team
gloves on both hands, and striped socks/shin pads on the lower legs — plus a team ground
ring, carrier ring, and ultimate aura. Skaters **lean** forward with speed and **bank** into
turns (`Skater.tsx`). If a model fails to load, a procedural body fallback renders instead
(`ModelBoundary`). (Helmets were tried and dropped — every mascot's signature headwear hides
or clashes with one.)

**FX & camera** (`render/Vfx.tsx`, `render/fx.ts`). A GPU-instanced particle system drives
ice spray behind fast skaters, hit/deke/ult bursts, goal confetti, and a speed-scaled
**puck streak**; the puck also spins with its glide speed (`Puck.tsx`). The broadcast camera
drifts with the puck, **punches in** toward goals/ults, and **shakes** on impacts.

Two visual constants in `CharacterModel.tsx` are easy to tune if needed: `MODEL_SCALE` and
`MODEL_YAW` (set `MODEL_YAW = Math.PI` if a model faces away from its travel direction). The
`sticktest.html?m=<file>.glb&t=<0|1>` harness renders any single model with its gear for
closeup review.

Model source & licensing (CC0 KayKit assets via the upstream repo): see `CREDITS.md`.
