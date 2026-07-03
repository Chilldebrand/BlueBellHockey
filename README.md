# BBellHockey 🏒

Online **3v3 arcade hockey** — browser-based, grounded and hockey-first (think NHL Threes):
fast skating, big hits, rebounds, goalie scrambles, and **NHL-style skill-stick controls**
where the **right stick is puck control** — stickhandle with stick sweeps, flick forward for
a wrist shot, pull back then flick for a slap shot.

An authoritative [Colyseus](https://colyseus.io) server runs a deterministic simulation;
clients render with React + [react-three-fiber](https://docs.pmnd.rs/react-three-fiber) and
predict locally. Quick Play matchmaking, private room codes, and bot fill so a full 3v3 runs solo.

## The game lives in `packages/arcade-*`

| Package | What it is |
|---|---|
| `packages/arcade-core` | Pure-TS deterministic game core (physics + rules). Imported by **both** server (authority) and client (prediction). |
| `packages/arcade-server` | Colyseus room server: fixed-tick sim, roster/team/character slots, quick match, private codes, bot fill. |
| `packages/arcade-client` | Vite + React + R3F client: rink/skaters/puck rendering, input (gamepad + KB/M), menus, HUD, postgame. |
| `packages/arcade-assets` | Art and data assets. |

The simulation core (skating, puck, contact, goalies) and the control model are being
**rewritten** per the approved plan — grounded arcade physics + skill-stick controls.
Design history lives in `docs/`.

### Legacy packages (read-only reference — do not build here)

`packages/shared`, `packages/server`, `packages/client` are the original prototype from the
"NHL Street" era (style meter, ultimates, fantasy characters). They are kept only as a
**reference quarry**: the goalie save logic, puck vertical-axis physics, and shared-prediction
patterns in `packages/shared/src/sim/` are the porting source for the new sim. Run with the
`*:legacy` scripts. Art/model credits: `CREDITS.md`.

## Run it

```bash
npm install
npm run dev        # arcade server + client (the game)
```

Open the client URL, create a private room in one tab, join with the code in a second tab
for a multiplayer smoke test.

```bash
npm test               # arcade test suites (core, server, client)
npm run typecheck      # arcade typecheck
npm run build:arcade   # production build

npm run dev:legacy / test:legacy / typecheck:legacy   # original prototype
```
