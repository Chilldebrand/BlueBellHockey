# Four-Sided Arena Crowd Design

## Status

Approved on 2026-07-21.

## Goal

Add a neutral four-sided arena bowl with visible cheering fans around the existing arcade rink. The arena is decorative client-side presentation only: the rink, boards, glass, markings, goals, center logo, camera, simulation, server, and network contracts remain unchanged.

## Product Direction

The venue should make a match feel populated and energetic without changing the established rink presentation or introducing a school theme. The selected direction is a procedural modular arena rather than a port of the legacy arena or a prebuilt 3D asset.

The first release includes:

- four raked stand sections outside the existing glass;
- dark corner concourses and an enclosing arena wall that join the four stands into one bowl;
- a neutral mixed crowd with richer apparel variation;
- simple visual idle movement;
- synchronized visual and audio reactions for goals and major hits; and
- a default full-detail crowd with an internal reduced-detail configuration that retains the stadium.

The physical freestanding scoreboard is deferred. The high-school reference applies only to that possible future scoreboard and must not influence the arena, stands, crowd, apparel, or decoration in this release.

## Global Constraints

- Do not change `packages/arcade-client/src/render/Rink.tsx` geometry or materials as part of this feature.
- Do not change `RINK_CONFIG`, collision geometry, gameplay rules, simulation state, server state, or network messages.
- Do not change `CameraRig.tsx` behavior, camera height, follow distance, field of view, or clamping.
- Do not add school branding, banners, student sections, school-color coordination, signs, ads, or a physical scoreboard.
- Do not add ambient crowd sound.
- Do not add a graphics-settings UI in this release.
- Use procedural Three.js/react-three-fiber geometry; do not add a new GLB arena dependency.
- Use deterministic seeded fan placement and apparel assignment; do not call `Math.random()` while generating the crowd.
- Keep the stadium visible in both full and reduced crowd-detail configurations.

## Architecture

The arena mounts as a sibling of `<Rink />` inside `packages/arcade-client/src/render/Scene.tsx`. `Scene` passes the current world event queue and simulation time into the arena. Nothing in the arena participates in collision or writes to world state.

### `ArenaShell.tsx`

`packages/arcade-client/src/render/ArenaShell.tsx` owns the static venue structure:

- four raked stand sections positioned from `RINK_CONFIG`;
- corner concourses that visually connect the separate stands;
- aluminum-colored rails and stair aisles;
- a dim outer floor/concourse ring;
- a dark enclosing arena wall; and
- decorative emissive overhead light-bank meshes.

The light banks are visible fixtures only. They must not add new scene lights or alter the current illumination of the rink and players.

`ArenaShell` also owns or exports pure stand-layout helpers so geometry placement can be tested without mounting a WebGL canvas.

### `Crowd.tsx`

`packages/arcade-client/src/render/Crowd.tsx` owns deterministic spectator generation and rendering. It receives the stand specifications, a fixed visual seed, crowd detail, current event queue, and current simulation time.

The crowd uses `InstancedMesh` groups rather than one React element per spectator. Fans are divided into stand sections. Each section contains shared instanced meshes for heads, apparel bodies, and optional accessories. Section groups animate as units, avoiding per-frame matrix updates for every fan.

Pure generation helpers must be exportable for tests. Given the same rink configuration, detail, and seed, they must return the same spectator positions, scales, skin tones, apparel types, apparel colors, and accessories.

### `crowdReaction.ts`

`packages/arcade-client/src/render/crowdReaction.ts` owns the pure reaction state machine and event classification. It recognizes only:

- `goal` as a full celebration; and
- `knockdown` as a major-hit celebration.

Generic `hit`, `stumble`, `save`, `shot`, `post`, `powerupPickup`, and all other events do not trigger the crowd.

The reaction controller seeds its seen-event set from the first event queue it observes. It reacts only to later unseen event IDs so retained event history cannot replay when the scene mounts or a client reconnects.

### Audio

`packages/arcade-client/src/audio/AudioManager.ts` consumes the same existing world events. Crowd cheers use a dedicated sub-gain connected to the existing gameplay audio bus, so the current Gameplay volume control governs crowd volume and no new preference or settings UI is required.

The cheer is synthesized with the existing Web Audio infrastructure. No external crowd recording is required. Audio event consumption must reuse the manager's existing event-ID deduplication and reconnect-backlog suppression.

## Stadium Layout

The current rink occupies `x = 0..2600` and `z = 0..1560`, with the board ring extending outside that footprint. Arena geometry derives from `RINK_CONFIG` rather than duplicating those numbers.

Each stand begins 80–100 world units beyond the outside face of the board/glass structure. This clearance keeps all seats, spectators, rails, and concourse geometry outside the existing rink presentation.

The bowl consists of:

- two long-side stands running parallel to the rink's x-axis;
- two end stands running parallel to the rink's z-axis;
- dark corner concourses or angled filler sections that visually join adjacent stands;
- 8–12 raked seating rows per side;
- a front seating elevation above the outer floor but below the top of the glass; and
- a back-row height of approximately 350–400 world units.

The existing camera remains at y=940. The bowl profile therefore stays well below the camera and leaves its travel path unobstructed. No roof, hanging structure, or high near-side wall may intersect the view as the puck moves between camera clamp extremes.

The enclosing wall may rise above the back row enough to close the background, but it must remain outside the camera-to-rink sightlines. The implementation must verify the home-end, center-ice, and away-end camera positions before finalizing wall height.

## Crowd Appearance

Full detail targets approximately 1,500–2,000 spectators across all four stands. The exact count is derived from stand length and row spacing, then capped so density changes cannot create an unbounded instance count.

Fans use simple low-poly silhouettes that remain legible at the gameplay camera distance:

- one head shape with varied scale and skin tone;
- apparel body variants representing generic hockey jerseys, hoodies, winter jackets, and neutral streetwear;
- optional beanies, caps, and scarves rendered as sparse instanced accessories; and
- small deterministic height, width, rotation, and seating offsets.

Every stand section must contain a mix of apparel categories. The palette is predominantly muted neutrals and varied winter colors, with restrained blue and red team-apparel accents and occasional gold or bright colors. No section is coordinated around one team or theme, and no apparel contains logos or text.

The default full-detail configuration includes the complete spectator count, apparel variants, accessories, idle movement, and event reactions.

The internal reduced-detail configuration:

- preserves all four stands, concourses, walls, and rails;
- reduces spectator density by approximately half;
- omits small accessories;
- disables continuous idle movement; and
- retains section-level goal and major-hit reactions.

The active arcade client has no graphics-quality setting today. Full detail is the runtime default. The explicit detail input exists so a future quality setting can reduce crowd cost without redesigning or removing the arena.

## Crowd Motion

The normal crowd uses a subtle visual-only idle loop. Different stand sections receive deterministic phase offsets so they do not move as one rigid object. Idle motion must be small enough that it never competes with the puck or skater motion.

### Goal Reaction

- Trigger: a newly observed event with `type === "goal"`.
- Duration: approximately 2.5 seconds.
- Visual: all sections rise and perform a staggered two-pulse celebration using small per-section timing offsets.
- Audio: one full crowd cheer.
- Priority: a goal immediately replaces any active major-hit reaction.

### Major-Hit Reaction

- Trigger: a newly observed event with `type === "knockdown"`.
- Duration: approximately 0.8 seconds.
- Visual: all sections perform one shorter pop or bounce.
- Audio: one shorter crowd cheer.
- Repetition: another unseen knockdown event refreshes the short reaction but must not layer multiple simultaneous cheer sources.

There is no sustained crowd-bed source. In the absence of a goal or knockdown, the crowd audio path remains silent.

## Event and Data Flow

1. The authoritative simulation produces its existing `WorldEvent` records.
2. `Scene` receives the current world snapshot and mounts `ArenaShell` with `world.eventQueue` and `world.time.nowMs`.
3. `crowdReaction.ts` ignores the initial retained queue, classifies only unseen goal/knockdown IDs, and returns the active reaction and its normalized progress.
4. `Crowd.tsx` applies the returned reaction to stand-section groups in `useFrame` without mutating the event queue or simulation state.
5. `AudioManager.consumeWorld` sees the same event IDs through its existing cursor, schedules the appropriate synthesized cheer once, and continues routing through the gameplay bus.

Visual and audio consumers remain independent. Failure or disposal of one does not block the other.

## Failure and Lifecycle Behavior

- If Web Audio is unavailable or suspended, visual crowd reactions still run.
- If an instanced accessory fails to render, head and torso instances remain sufficient for the crowd to read.
- If the event queue is empty, the crowd stays in its allowed idle/static state and audio stays silent.
- On first mount, remount, or reconnect, retained event IDs are seeded as already seen rather than replayed.
- `AudioManager.resetEventCursor()` clears active crowd cheer state along with its other event-driven sources.
- `AudioManager.dispose()` stops and disconnects any active crowd sources and sub-gains.
- Arena resources created with `useMemo` are disposed through normal react-three-fiber lifecycle handling; no intervals or unmanaged animation loops are introduced.

## Performance Guardrails

- Use instancing for repeated spectators, apparel variants, accessories, seats, and repeated rails where practical.
- Do not create one React component per fan.
- Do not allocate new per-fan objects inside `useFrame`.
- Animate stand-section groups, not every instance matrix, during normal frames.
- Cap full-detail spectators at 2,000 and reduced-detail spectators at 1,000.
- Keep the arena/crowd render-call increase at or below 32 calls in full detail and at or below 20 calls in reduced detail.
- Keep all decorative meshes non-colliding and client-only.
- Compare a pre-feature and post-feature Free Skate run with the existing performance overlay before completion.

## Automated Verification

Focused client tests must prove:

- four stand specifications are derived from arbitrary rink dimensions;
- every stand's inner edge remains outside the board/glass footprint and clearance;
- stand height stays below the camera-safe ceiling;
- the same seed produces identical spectator assignments;
- different seeds alter appearance without changing count or safety bounds;
- full detail stays at or below 2,000 fans;
- reduced detail stays at or below 1,000 fans and preserves all four stand IDs;
- every stand contains multiple apparel categories and neutral/team-accent colors;
- the initial event queue is suppressed;
- an unseen goal starts the full reaction;
- an unseen knockdown starts or refreshes the short reaction;
- a goal overrides an active knockdown reaction;
- ordinary hit/stumble/save/shot events do nothing;
- duplicate event IDs do not retrigger a reaction or sound;
- audio reset/dispose stops crowd cheer state; and
- failure to create an audio context leaves event consumption safe.

Required verification commands:

```powershell
npm run test --workspace @bbh/arcade-client
npm run typecheck
npm run build:arcade
```

## Manual Verification

Run a local match and Free Skate, then inspect the arena at the home-goal, center-ice, and away-goal camera clamp positions.

Verify that:

- all four stands clearly sit beyond the existing glass;
- no stand, wall, rail, fan, or light fixture covers the rink, glass, goals, players, puck, or HUD;
- the camera never passes through or clips arena geometry;
- the crowd reads as mixed neutral spectators with varied apparel;
- there is no school theme or physical scoreboard;
- normal play is audibly silent from the crowd system;
- routine hits and stumbles stay silent;
- goals produce the full animation and cheer exactly once;
- knockdowns produce the short animation and cheer exactly once;
- reconnecting does not replay retained cheers;
- full detail stays within the render-call budget; and
- reduced detail keeps the complete stadium while reducing crowd cost.

## Acceptance Criteria

- A gameplay screenshot reads as the existing rink inside a populated four-sided arena bowl.
- The existing rink and camera look and behave as they did before the feature.
- The crowd is neutral, varied, and apparel-rich without school or team-section theming.
- The crowd is silent during normal play.
- Goals and knockdowns produce distinct, one-shot synchronized visual/audio reactions.
- Stadium geometry remains present when crowd detail is reduced.
- All automated tests, typechecking, and the arcade production build pass.
- Manual camera and performance checks satisfy the visibility and render-call guardrails.

## Out of Scope

- physical or UI scoreboard redesign;
- school branding, banners, student sections, school colors, signs, or ads;
- rink, board, glass, goal, marking, center-logo, or ice-material changes;
- camera changes;
- gameplay, physics, AI, server, or networking changes;
- ambient crowd murmur;
- reactions to routine hits, stumbles, saves, shots, posts, or powerups;
- a new graphics-settings interface;
- imported arena or crowd GLB assets; and
- final bespoke crowd character models.
