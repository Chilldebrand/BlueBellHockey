# Postgame And Pickup Presentation Design

## Status

Approved in conversation on 2026-07-10. This specification covers the end-of-match presentation, three stars, match HUD cleanup, and more visible on-ice powerup pickups.

## Goal

Make a first-to-five victory unmistakable, present three stars with authoritative player statistics, remove unwanted match-HUD clutter, and make powerup pickups easier to see without changing their gameplay radius or behavior.

## Current Failure

- `App.tsx` renders `WinSplash` and `Postgame` together after the match ends.
- `.win-splash` and `.postgame` occupy the same fixed top-right area, so they overlap and the result is easy to miss.
- `HUD.tsx` mounts `PowerupHud` and `TargetIndicator`, although the user wants neither shown during a match.
- Powerup pickup icons are small procedural models with modest bobbing and no strong ice-level marker.
- `MatchStats` contains only team totals. A real three-stars panel therefore needs narrowly scoped per-player goals, assists, and hits in the authoritative shared simulation.

## Approaches Considered

### 1. One centered postgame modal over the frozen rink (selected)

Replace the two competing end panels with one modal and backdrop. This creates one clear visual hierarchy, keeps the final rink visible, and provides a natural home for the winner, score, three stars, team totals, and actions.

### 2. Reposition the existing panels

Keeping `WinSplash` and `Postgame` separate would reduce component changes, but it would retain two competing result surfaces and remain harder to read on smaller screens.

### 3. Full-screen replacement scoreboard

A full-screen results scene could be dramatic, but it would hide the rink and expand the art/layout scope beyond the request.

## Approved Design

### Centered postgame presentation

When `world.phase === "ended"`, the client continues rendering the final rink snapshot and mounts one full-viewport postgame backdrop. The backdrop dims the rink and centers a responsive result modal.

The modal owns, in order:

1. the winning team headline;
2. a clear `FIRST TO 5` completion label;
3. the final home/away score;
4. the three stars;
5. the existing team totals table;
6. `Rematch` and `Back To Lobby` actions.

`WinSplash` is no longer mounted on the ended-match path. It may be deleted if no other caller remains. The modal must fit a laptop-height viewport by using bounded height and internal scrolling rather than placing controls off-screen.

### Authoritative player stat lines

`MatchStats` gains a `players` record keyed by skater slot ID. Each `PlayerStatLine` contains `goals`, `assists`, and `hits`. Initial world creation produces a zeroed line for every skater slot so server, Free Skate, snapshots, replays, and postgame selection use identical data.

Goal attribution uses the existing scorer source (`shotBySlotId`, falling back to `lastTouchSlotId`) when that source identifies a skater on the scoring team. A hit increments the hitter's line at the same authoritative point that team hit totals increment.

This first pass records one primary assist per goal. The puck carries an `assistCandidateSlotId`. A completed same-team pass sets the passer as the candidate. Opponent possession or an opponent touch clears it. A goal awards the assist only when the candidate is on the scoring team and differs from the scorer. Faceoffs clear the candidate. Secondary assists and goalie points are out of scope.

### Three-stars selection

The postgame client selects up to three skaters from the authoritative player lines and current world skaters. All human and AI skaters are eligible. Ranking is deterministic:

- performance score: `goals * 5 + assists * 3 + hits`;
- then goals descending;
- then assists descending;
- then hits descending;
- then slot ID ascending.

The modal labels the results First Star, Second Star, and Third Star. Each card shows the skater's character display name, team treatment, and goals, assists, and hits. Zero-stat skaters remain eligible so a completed match always presents three stars when three skaters exist.

### Match HUD cleanup

`HUD.tsx` keeps the broadcast score, local turbo meter, and callouts. It no longer imports or renders `PowerupHud` or `TargetIndicator`. Powerup possession, Q/gamepad-Y activation, selected target state, and all gameplay behavior remain intact; only these two HUD surfaces are removed.

### Pickup visibility

`FloatingIcon` gains a larger visual-only parent scale, stronger vertical bob, and a shared marker beneath each icon. The marker is a bright emissive ring/halo close to the ice with a subtle pulse, giving every pickup a readable footprint even when its procedural icon is edge-on.

The pickup simulation position, collection radius, spawn cadence, type, and effects do not change. Banana peels are hazards rather than pickups and are not enlarged by this work.

## Data Flow

1. Shared simulation initializes and updates per-player stat lines and assist ownership.
2. The authoritative `WorldState` snapshot already delivered to server and client includes those lines.
3. The ended-match client derives three stars with a pure deterministic selector.
4. One postgame component renders winner information, stars, team totals, and actions.

No separate network message or client-only stat accumulator is introduced.

## Testing

- Core tests cover zeroed player lines, goal credit, same-team primary assists, assist clearing on opponent possession, no self-assist, and hit credit.
- Client pure tests cover three-star scoring and all tie-break levels.
- Postgame rendering tests cover winner text, `FIRST TO 5`, final score, three star cards, player stat values, team totals, and both actions.
- App rendering tests prove only the unified postgame surface is mounted after match end.
- HUD tests prove powerup and target labels are absent while score, turbo, and callouts remain available.
- Pickup component tests verify the visual marker and scale contract without asserting WebGL pixels.
- Full arcade tests, typecheck, production build, and two-client smoke run after the cluster.

## Constraints And Non-Goals

- Modify only `packages/arcade-core`, `packages/arcade-server`, and `packages/arcade-client` plus documentation.
- Preserve deterministic simulation and the existing full-world snapshot path.
- Do not change target score, pickup physics, pickup radius, powerup balance, activation controls, or banana behavior.
- Do not add secondary assists, goalie points, season statistics, persistence, or a general analytics system.
- Do not modify legacy `packages/shared`, `packages/server`, or `packages/client`.
- Add no dependencies and use `npm.cmd` in PowerShell.

## Acceptance Criteria

- Reaching five produces one centered, unmistakable postgame modal over a dimmed rink.
- The modal shows winner, first-to-five completion, final score, three stars, team totals, Rematch, and Back To Lobby.
- Each star shows authoritative goals, assists, and hits for the selected skater.
- Three-star ordering is deterministic and follows the documented score and tie-breaks.
- Powerup and target widgets are absent from the match HUD without changing gameplay.
- Pickups are materially larger and have a visible pulsing ice marker.
- Pickup collision and all existing gameplay rules remain unchanged.

