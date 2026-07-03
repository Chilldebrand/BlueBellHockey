# Arcade Rebuild Release Checklist

Date: 2026-06-27 (updated 2026-07-03)
Branch: `DalesMajorPLan`

## 2026-07-03 — Physics + skill-stick rewrite ("new heart, existing chassis")

The simulation core was rewritten per the approved restart plan. Summary of
what changed relative to the notes below:

- **Skating**: facing + anisotropic-grip ice model (capped turn rate, edge
  bite vs glide, brake stops, turbo handling tradeoff), rounded-corner boards
  with restitution + tangential slide.
- **Puck**: vertical axis (gravity/lift/ice bounce), posts + crossbar, corner
  rimming; carried puck is a spring **tether to the stick blade** (lags on
  turns, breaks when over-dangled, pokeable).
- **Controls**: NHL-style **skill stick** — raw right-stick samples on the
  wire, deterministic gesture detection in the shared sim (flick = wrist,
  windup + flick = slap, one-timers off passes). Mouse and Space-synth
  fallbacks for KB/M. The shoot button is gone.
- **Prediction**: full input-replay reconciliation (per-slot input acks in
  snapshots, unacked-frame re-simulation, smoothing) — the "shallow
  prediction" limitation below is CLOSED.
- **Contact**: skater-skater collision impulses, goalie body blocking,
  carrier jostle.
- **Goalies**: swept save test (no tunneling), save types by height/side,
  cover→faceoff vs directional rebounds.
- **Scope**: powerups + specials are CUT from the roadmap (grounded-arcade
  decision) — flag-disabled in `TUNING.flags`, HUD elements removed.
- **Feel lab**: Free Skate mode (client-only sim) with a live tuning panel,
  debug overlays, and a deterministic input recorder. Feel tuning happens
  there; lock final values into `DEFAULT_TUNING`.
- **Automated e2e**: `npm run smoke --workspace @bbh/arcade-server` boots the
  real server and drives two websocket clients through a match slice.

Remaining manual gates: real-browser two-tab playthrough (rendering needs
WebGL), gamepad feel pass in Free Skate, rematch flow eyeball, mobile layout.

This checklist is the release-gate evidence log for the parallel arcade rebuild. The rebuild remains a parallel package path (`@bbh/arcade-*`); the root README has not been rewritten to make it the primary app.

## Automated Gates

- `npm run test:arcade`
- `npm run typecheck:arcade`
- `npm run build:arcade`
- Focused server checks:
  - `npm run test --workspace @bbh/arcade-server -- bot`
  - `npm run test --workspace @bbh/arcade-server -- decision`
  - `npm run test --workspace @bbh/arcade-server -- performance`
- Focused client checks:
  - `npm run test --workspace @bbh/arcade-client -- client`
  - `npm run test --workspace @bbh/arcade-client -- latency`

## Hardening Notes

- Reconnect is best effort. The client persists the Colyseus `reconnectionToken` for a short refresh window and attempts `client.reconnect()` before falling back to normal room flows. Expired or invalid tokens are cleared.
- Client prediction remains intentionally shallow for the first playable gate: the local skater is predicted from the latest authoritative world plus the latest input. Full input replay and server acknowledged input sequence are tracked as post-gate work.
- Server ticks use a fixed-step accumulator with a catch-up cap, and a bot-filled room tick smoke covers sustained solo-plus-bots stepping.
- Latency simulation coverage is deterministic and unit-level. Manual network throttling remains required before a public playtest.

## Tuning Notes

- Skating acceleration, max speed, glide drag, and turbo multipliers were nudged toward a faster arcade feel while preserving rink bounds and deterministic simulation.
- Puck friction, pickup reach, pass speed, shot speed, and max charge time were tuned for quicker possessions and livelier shots.
- Checking radius/cooldown/recovery values were adjusted to make checks readable without creating long downtime.
- Goalies gained slightly better lateral speed and save reach, with more lively rebounds.
- Powerups spawn slightly faster, have a larger pickup radius, and use shorter effect windows.
- Specials keep original identities in config but currently resolve through a shared server-authoritative speed-boost effect. Character-specific gameplay effects are a known limitation.

## Manual Smoke Matrix

| Check | Status | Notes |
|---|---|---|
| Two-tab private room | Limited | In-app browser tooling only exposed one active tab during prior checks. Needs local browser confirmation. |
| One-human plus five-bot full match | Partially automated | Bot-filled room tick smoke and room tests pass; full browser match still needs manual playthrough. |
| Rematch flow | Partially automated | Server/client rematch hooks and postgame UI tests pass; full browser flow needs manual confirmation. |
| Powerup and special usage | Partially automated | Core/server tests cover activation paths; visual/manual confirmation still needed. |
| Postgame stats | Partially automated | Postgame component test passes; full match stat readout needs browser confirmation. |
| Six-client smoke | Simulated only | Multi-client Node smoke was used earlier for two clients; six-client browser smoke remains open. |
| Screenshot/storyboard comparison | Partial | Earlier browser visual checks confirmed rink/HUD/model-preview rendering; final pacing comparison remains manual. |
| Client FPS profile | Not captured | Needs browser performance panel or Playwright trace in an environment with stable dev-server/browser control. |
| Server tick profile | Automated smoke | Deterministic 600-tick bot-filled room smoke added; wall-clock profiling remains optional before playtest. |

## Known Issues Before Public Release

- Powerup effects other than speed-oriented immediate effects are not all fully expressed in gameplay yet.
- Character-specific specials are configured and visible but still share a common authoritative effect path.
- Reconnect depends on Colyseus token validity and does not reserve a human roster slot server-side after a hard disconnect.
- Prediction/reconciliation lacks acknowledged input sequence and replay of unacknowledged local inputs.
- The first-screen menu and lobby are functional, but final copy/layout polish should be checked on small mobile screens.

## Release Decision

The rebuild is suitable for continued internal playtesting as a parallel arcade app once the automated gates pass. It should not replace the existing primary app path until the manual smoke matrix is completed and the known gameplay-effect gaps are closed or explicitly accepted.
