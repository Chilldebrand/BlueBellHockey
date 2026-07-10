# Goalie Outlet Control Design

## Status

Approved in conversation on 2026-07-10. Goalie control is temporary: a human directs the outlet after a covered save, then automatically returns to their previously controlled skater when the goalie releases the puck.

## Goal

Replace center-ice resets after covered saves with live goalie possession and a controllable outlet pass while preserving deterministic shared simulation, authoritative server ownership, Free Skate parity, and existing skater control switching.

## Current Failure

`resolveGoalieSave` classifies a slow centered stop as `cover`, emits save/cover events, and calls `resetForFaceoff(world)`. Goalies are server-owned `GoalieEntity` objects, while input frames, roster ownership, prediction, highlighting, camera follow, passing, and control switching all assume a skater slot. Removing the faceoff call alone would leave no valid puck carrier or input path.

## Approaches Considered

### 1. Explicit goalie possession and a temporary control grant (selected)

Keep skater carriers and roster slots intact, add a goalie-specific puck possession state, and expose a separate temporary goalie-control grant. This preserves existing skater invariants and makes each new boundary testable.

### 2. Put goalie IDs in `carrierSlotId`

This would minimize the puck schema change, but every skater-only consumer of `carrierSlotId` would need special cases. Passing, pickup, gestures, prediction, and control switching would become less safe.

### 3. Model goalies as skaters

This could reuse more action code, but it conflicts with goalie save logic, server ownership, crease constraints, and rendering. It is a larger architectural rewrite than the requested outlet interaction.

## Approved Design

### Explicit goalie possession

`PuckState` gains `goalieCarrierId: string | null`; `carrierSlotId` remains exclusively a skater slot. At most one carrier field may be non-null. Covered saves set `goalieCarrierId`, clear loose-shot/pass state, place the puck at a deterministic goalie hold offset, and emit the existing `save` and `cover` events without changing match phase, score, clock, or skater positions.

While held, the puck follows the goalie's authoritative position. Goal detection, loose-puck pickup, poke/check stripping, and skater shot/pass actions ignore the puck until goalie possession ends. Hot saves continue to produce existing live rebounds.

### Goalie outlet state and input

`GoalieEntity` gains the minimum mutable outlet state: pass charge, remembered aim, possession start time, and whether a pass button was previously held. The shared step routes an owned `InputFrame` whose `slotId` equals the active goalie ID to goalie outlet handling.

The goalie remains AI-positioned and crease-bound. Movement axes do not move the goalie; a nonzero left stick updates the outlet aim. The existing pass button charges while held and releases on the falling edge. Release speed uses the existing pass charge limits and receiver-assist geometry where reusable, but starts from a goalie-safe point outside the pads and applies a short self-repickup lockout.

No shot, check, poke, dive, turbo, skill-stick, powerup, or manual-switch action is available during goalie possession.

### Temporary human control grant

The simulation records possession, not human ownership. Server and Free Skate wrappers decide who supplies goalie input.

On a new covered save, the authoritative room selects one human on the defending team. In solo play this is the only human. In co-op, select the human-controlled skater nearest the goalie at the moment of cover, with slot ID ascending as the deterministic tie-break. That human retains ownership of their skater roster slot, and the room exposes `controlledGoalieId` as a separate temporary control field for that roster entry.

The client computes its active controlled entity as `controlledGoalieId ?? slotId`. Input frames target that entity. Server sanitation accepts a goalie-targeted frame only when the sender currently owns that exact temporary grant. Skater prediction buffers are flushed when the active entity changes; goalie control renders authoritative snapshots without local movement prediction.

When the goalie releases the puck, the room clears `controlledGoalieId`, so input and camera return immediately to the previously owned skater. Existing reception switching may then move skater control to the teammate who receives the outlet. The skater roster ownership itself never moves to the goalie.

### AI and failure fallback

If the defending team has no human, or the granted human disconnects, the shared deterministic goalie outlet chooses an eligible teammate and releases after a bounded hold. A human-controlled goalie uses the same bounded timeout to prevent a dead puck; if no pass is released within 2500 ms, the goalie sends the deterministic safe outlet.

The fallback target is the nearest eligible teammate in the up-ice half-plane with an unblocked lane, then nearest eligible teammate overall, with slot ID as the final tie-break. If no teammate is eligible, the goalie clears the puck up the middle. No randomness or wall-clock time is used.

### Client presentation

During temporary control:

- the local identity highlight moves from the skater to the goalie;
- the camera follows the goalie;
- the puck renders at the goalie hold point;
- the pass charge UI may reuse the existing local action feedback if already available, but no new permanent HUD panel is required;
- the skater highlight and skater prediction are suppressed until control returns.

Remote players see the correct controlled-goalie highlight through the roster control field, using the existing stable human identity colors.

### Reset and lifecycle behavior

Goals, rematches, back-to-lobby transitions, room disposal, and any true faceoff reset clear goalie possession, goalie outlet state, and temporary control grants. A non-cover save does not create or alter a grant. Repeated cover processing is idempotent while the same goalie already holds the puck.

## Data Flow

1. Shared goalie save logic turns a qualifying cover into `puck.goalieCarrierId` possession.
2. Server/Free Skate detects the new carrier and assigns the temporary human grant or AI fallback.
3. Client sends normal input fields tagged with the granted goalie ID.
4. Server validates the grant and shared simulation charges/releases the outlet.
5. Puck possession clears; wrapper clears the grant; control and camera return to the owned skater.
6. Existing skater reception switching handles the receiving teammate.

## Testing

- Core tests cover cover possession, no faceoff reset, puck attachment, pass charge/release, aim, timeout fallback, deterministic teammate selection, lifecycle clearing, and unchanged rebound behavior.
- Determinism tests compare identical cover/outlet sequences and coarse/fixed timing boundaries.
- Server room tests cover grant selection, goalie frame authorization, spoof rejection, disconnect fallback, clearing after release, and coexistence with skater reception switching.
- Client state/input tests cover active entity selection, prediction flush, goalie-targeted frames, camera/highlight selection, and return to skater.
- Free Skate tests cover the same temporary control and outlet lifecycle without server schema.
- Full arcade tests, typecheck, production build, and two-client smoke run after integration.

## Constraints And Non-Goals

- Modify only active arcade packages and documentation; legacy packages remain untouched.
- Preserve deterministic shared simulation and authoritative server validation.
- Goalies do not skate under human control and cannot leave the crease.
- Do not add goalie shooting, checking, deking, powerup use, manual goalie selection, or persistent goalie control.
- Do not redesign general skater possession switching or prediction.
- Add no dependencies and use `npm.cmd` in PowerShell.

## Acceptance Criteria

- A covered save never resets the puck or players to center ice.
- The goalie visibly and authoritatively possesses the puck after the cover.
- An eligible human temporarily controls the goalie and can aim, charge, and release an outlet pass.
- Control returns automatically to the human's prior skater immediately after release.
- AI/no-input fallback releases a deterministic outlet within 2500 ms.
- Unauthorized clients cannot send goalie input.
- Hot-save rebounds and true goal faceoffs retain existing behavior.
- Server play and Free Skate follow the same shared-core outlet rules.

