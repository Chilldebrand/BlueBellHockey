# Four-Sided Arena Crowd Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-21-four-sided-arena-crowd-design.md` (approved 2026-07-21). The spec is authoritative on product behavior; this plan is authoritative on sequencing and file-level mechanics.

**Goal:** Surround the existing arcade rink with a neutral four-sided procedural arena bowl and a deterministic instanced crowd that reacts (visually and audibly) to goals and knockdowns only. Client-side presentation only — no sim, server, network, rink, or camera changes.

**Architecture:** Pure, WebGL-free helper modules (`arenaLayout.ts`, `crowdGeneration.ts`, `crowdReaction.ts`) carry all logic and all unit tests. Thin react-three-fiber components (`ArenaShell.tsx`, `Crowd.tsx`) render their output with `InstancedMesh` groups, mounted as a sibling of `<Rink />` in `Scene.tsx`. `AudioManager` gains a crowd sub-gain on the existing gameplay bus and synthesizes cheers from the same world events through its existing event-ID cursor.

**Tech Stack:** TypeScript, Vitest, React, react-three-fiber/Three.js, Web Audio, `@bbh/arcade-core` (read-only consumer of `RINK_CONFIG` and `WorldState`).

## Global Constraints (from the approved spec)

- Do not modify `Rink.tsx`, `RINK_CONFIG`, `CameraRig.tsx`, any sim/server/network code, or gameplay rules.
- No school branding, banners, signs, ads, team-coordinated sections, or physical scoreboard.
- No ambient crowd bed; silent except one-shot goal/knockdown cheers.
- No new scene lights (light banks are emissive meshes only) and no graphics-settings UI.
- No `Math.random()` anywhere in generation — deterministic seeded assignment only.
- No GLB assets; procedural geometry only.
- Caps: ≤2,000 fans full detail, ≤1,000 reduced; ≤32 added render calls full, ≤20 reduced.
- Reduced detail keeps all four stands, concourses, walls, and rails.
- Events that trigger reactions: `goal` (full, ~2.5 s) and `knockdown` (short, ~0.8 s) ONLY; goal overrides knockdown; retained/replayed event backlogs never fire reactions.

## File Structure

- Create: `packages/arcade-client/src/render/arenaLayout.ts` — pure stand/concourse/wall layout math from a `RinkConfig`.
- Create: `packages/arcade-client/src/render/arenaLayout.test.ts`
- Create: `packages/arcade-client/src/render/crowdGeneration.ts` — pure seeded spectator generation.
- Create: `packages/arcade-client/src/render/crowdGeneration.test.ts`
- Create: `packages/arcade-client/src/render/crowdReaction.ts` — pure reaction state machine.
- Create: `packages/arcade-client/src/render/crowdReaction.test.ts`
- Create: `packages/arcade-client/src/render/ArenaShell.tsx` — static venue meshes; mounts `Crowd`.
- Create: `packages/arcade-client/src/render/Crowd.tsx` — instanced fans + section animation.
- Modify: `packages/arcade-client/src/audio/AudioManager.ts` — crowd sub-gain + synthesized cheers.
- Modify: `packages/arcade-client/src/audio/AudioManager.test.ts`
- Modify: `packages/arcade-client/src/audio/synth.ts` — cheer synthesis helper (noise swell).
- Modify: `packages/arcade-client/src/render/Scene.tsx` — mount `ArenaShell` beside `<Rink />`.

### Task 1: Pure arena stand layout

**Files:**
- Create: `packages/arcade-client/src/render/arenaLayout.ts`
- Create: `packages/arcade-client/src/render/arenaLayout.test.ts`

**Interfaces:**

```ts
export interface StandSpec {
  readonly id: "north" | "south" | "east" | "west";
  /** Axis the stand runs along: long sides run x, ends run z. */
  readonly axis: "x" | "z";
  /** World-space center of the stand footprint. */
  readonly center: { x: number; z: number };
  /** Length along the rink edge and depth away from it. */
  readonly length: number;
  readonly depth: number;
  /** Inner edge distance from rink origin along the stand's facing axis. */
  readonly innerEdge: number;
  readonly rowCount: number;
  readonly rowRise: number;
  readonly rowDepth: number;
  /** Front-row seat elevation and computed back-row top height. */
  readonly baseHeight: number;
  readonly topHeight: number;
}

export interface ArenaLayout {
  readonly stands: readonly [StandSpec, StandSpec, StandSpec, StandSpec];
  readonly cornerBlocks: readonly CornerSpec[];
  readonly wall: { readonly innerRadiusX: number; readonly innerRadiusZ: number; readonly height: number };
}

export function computeArenaLayout(rink: {
  width: number; height: number;
}): ArenaLayout;

/** Camera-safe ceiling every stand and the wall must stay under. */
export const ARENA_MAX_STRUCTURE_HEIGHT: number; // < 940 camera height with margin
export const STAND_CLEARANCE = 90; // 80–100 per spec; single source of truth
```

All numbers derive from the passed rink dimensions — the tests pass arbitrary sizes, not just `RINK_CONFIG`.

- [ ] **Step 1: Write failing layout tests**

In `arenaLayout.test.ts`, using both `RINK_CONFIG` from `@bbh/arcade-core` and at least one arbitrary rink (e.g. `{ width: 4000, height: 900 }`), assert:

- `computeArenaLayout` returns exactly four stands with the four distinct IDs, two per axis;
- every stand's `innerEdge` sits at least `STAND_CLEARANCE` outside the rink footprint on its side (long sides beyond `z ∈ [0, height]`, ends beyond `x ∈ [0, width]`), leaving room for the board/glass ring;
- `rowCount` is between 8 and 12 and `topHeight` is within 350–400 for the default rink;
- every stand's `topHeight` and the wall height are `< ARENA_MAX_STRUCTURE_HEIGHT`, and `ARENA_MAX_STRUCTURE_HEIGHT < 940`;
- the wall's inner extents enclose every stand's outer edge;
- the function is pure: two calls with the same input are deeply equal.

- [ ] **Step 2: Run to verify failure**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/render/arenaLayout.test.ts`

Expected: FAIL (module does not exist).

- [ ] **Step 3: Implement `computeArenaLayout`**

Straight math, no Three.js imports. Long-side stands run parallel to x centered on `width / 2`; end stands run parallel to z centered on `height / 2`. Corner blocks are simple angled filler footprints between adjacent stand ends. Derive `rowCount`, `rowRise`, and `rowDepth` so the profile lands in the spec's 350–400 back-row band, and clamp everything under `ARENA_MAX_STRUCTURE_HEIGHT`.

- [ ] **Step 4: Run focused tests, then commit**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/render/arenaLayout.test.ts` — expected PASS.

```bash
git add packages/arcade-client/src/render/arenaLayout.ts packages/arcade-client/src/render/arenaLayout.test.ts
git commit -m "feat: add pure arena stand layout helpers"
```

### Task 2: Deterministic crowd generation

**Files:**
- Create: `packages/arcade-client/src/render/crowdGeneration.ts`
- Create: `packages/arcade-client/src/render/crowdGeneration.test.ts`

**Interfaces:**

```ts
export type CrowdDetail = "full" | "reduced";

export interface SpectatorInstance {
  readonly standId: StandSpec["id"];
  readonly position: { x: number; y: number; z: number };
  readonly rotationY: number;
  readonly scale: { x: number; y: number };
  readonly skinTone: string;      // hex from a fixed tone ramp
  readonly apparel: "jersey" | "hoodie" | "jacket" | "street";
  readonly apparelColor: string;  // hex from the neutral/accent palette
  readonly accessory: "none" | "beanie" | "cap" | "scarf";
}

export interface CrowdSpec {
  readonly spectators: readonly SpectatorInstance[];
  readonly countByStand: Readonly<Record<string, number>>;
}

export const FULL_DETAIL_FAN_CAP = 2000;
export const REDUCED_DETAIL_FAN_CAP = 1000;

export function generateCrowd(
  layout: ArenaLayout,
  seed: number,
  detail: CrowdDetail
): CrowdSpec;
```

Use an integer hash mixer in the style of `mixSpawnHash` in `arcade-core/src/config/powerups.ts` (independent salts per attribute so apparel, tone, and accessory choices are uncorrelated). Never call `Math.random()`.

- [ ] **Step 1: Write failing generation tests**

Assert, for the default layout and seed 1:

- the same layout/seed/detail returns a deeply-equal `CrowdSpec` on repeated calls;
- a different seed changes at least one spectator attribute but keeps the exact same count and keeps every fan inside its stand's footprint bounds;
- full detail is ≤ `FULL_DETAIL_FAN_CAP`; reduced detail is ≤ `REDUCED_DETAIL_FAN_CAP`, roughly half of full, has zero accessories, and still covers all four stand IDs;
- every stand contains at least three of the four apparel categories;
- every apparel color comes from the exported palette, and the palette's team-accent (blue/red) share of generated fans stays a minority (< 40%);
- every spectator's `position.y` stays under `ARENA_MAX_STRUCTURE_HEIGHT`;
- the source file contains no `Math.random` usage (assert via reading the module source or simply rely on lint/review — a direct `expect(generateCrowd.toString()).not.toContain("Math.random")` is acceptable).

- [ ] **Step 2: Run to verify failure**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/render/crowdGeneration.test.ts` — expected FAIL.

- [ ] **Step 3: Implement `generateCrowd`**

Fill each stand row by row using the stand's `rowCount`/`rowDepth`/`rowRise` with deterministic per-seat jitter, skipping seats pseudo-randomly (hash-based) so density looks organic and the count lands under the cap. Reduced detail keeps every other seat and forces `accessory: "none"`.

- [ ] **Step 4: Run focused tests, then commit**

```bash
git add packages/arcade-client/src/render/crowdGeneration.ts packages/arcade-client/src/render/crowdGeneration.test.ts
git commit -m "feat: add deterministic seeded crowd generation"
```

### Task 3: Crowd reaction state machine

**Files:**
- Create: `packages/arcade-client/src/render/crowdReaction.ts`
- Create: `packages/arcade-client/src/render/crowdReaction.test.ts`

**Interfaces:**

```ts
export type CrowdReactionKind = "goal" | "majorHit";

export interface CrowdReactionState {
  readonly seeded: boolean;
  readonly seenEventIds: ReadonlySet<string>;
  readonly active: { readonly kind: CrowdReactionKind; readonly startedAtMs: number } | null;
}

export const GOAL_REACTION_MS = 2500;
export const MAJOR_HIT_REACTION_MS = 800;

export function createCrowdReactionState(): CrowdReactionState;

/** Pure reducer: classify unseen goal/knockdown events, expire finished reactions. */
export function advanceCrowdReaction(
  state: CrowdReactionState,
  events: ReadonlyArray<{ readonly id: string; readonly type: string }>,
  nowMs: number
): CrowdReactionState;

/** 0..1 progress of the active reaction, or null when idle. */
export function reactionProgress(state: CrowdReactionState, nowMs: number): number | null;
```

- [ ] **Step 1: Write failing reaction tests**

Assert:

- the FIRST `advanceCrowdReaction` call marks every event in the queue seen and starts nothing (`active === null`), even when the queue contains goals — reconnect/mount backlog suppression;
- a goal event appearing after seeding starts a `goal` reaction; `reactionProgress` runs 0→1 across `GOAL_REACTION_MS` and returns to `null` after expiry;
- an unseen knockdown starts `majorHit`; a second unseen knockdown mid-reaction refreshes `startedAtMs` (no stacking);
- a goal arriving during an active `majorHit` immediately replaces it;
- a knockdown arriving during an active `goal` does NOT replace it (goal has priority);
- `hit`, `stumble`, `save`, `shot`, `post`, and `powerupPickup` types never start a reaction;
- re-presenting an already-seen event ID never retriggers;
- the reducer never mutates its input state (inputs deep-equal before/after).

- [ ] **Step 2: Run to verify failure**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/render/crowdReaction.test.ts` — expected FAIL.

- [ ] **Step 3: Implement the reducer**

Pure functions returning new state objects; the seen-set may be rebuilt structurally (size stays bounded — the sim trims its retained queue, so also drop seen IDs no longer present in the incoming queue to keep the set from growing forever).

- [ ] **Step 4: Run focused tests, then commit**

```bash
git add packages/arcade-client/src/render/crowdReaction.ts packages/arcade-client/src/render/crowdReaction.test.ts
git commit -m "feat: add crowd reaction state machine"
```

### Task 4: Synthesized crowd cheers in AudioManager

**Files:**
- Modify: `packages/arcade-client/src/audio/synth.ts`
- Modify: `packages/arcade-client/src/audio/AudioManager.ts`
- Modify: `packages/arcade-client/src/audio/AudioManager.test.ts`

**Interfaces:**
- `synth.ts` adds `scheduleCrowdCheer(context, destination, kind: "goal" | "majorHit"): { stop(): void }` — band-passed noise swell (reuse `createNoiseBuffer`), ~2.5 s envelope for goals, ~0.8 s for major hits.
- `AudioManager` adds a private `crowdGain` connected to the existing `gameplayGain` (so the Gameplay slider governs it — no new preference), and classifies `goal`/`knockdown` inside its existing `consumeEvents` path.

- [ ] **Step 1: Write failing audio tests**

Follow the existing mock-context patterns in `AudioManager.test.ts`. Assert:

- a world containing one unseen `goal` event schedules exactly one crowd cheer routed through the gameplay bus; consuming the same world again schedules none (existing `consumedEventIds` dedup);
- an unseen `knockdown` schedules the short cheer; a second unseen knockdown while one is active stops the previous source before starting the new one (never two concurrent crowd sources);
- a `goal` arriving while a knockdown cheer is active stops it and plays the full cheer;
- `hit`/`stumble`/`save`/`shot` events schedule no crowd audio;
- `resetEventCursor()` stops any active crowd source and the next consume swallows the backlog (existing `suppressBacklogOnNextConsume` covers this — assert crowd audio participates);
- `dispose()` stops and nulls the crowd source and sub-gain;
- with no audio context (`createAudioContext` returning null), consuming goal events is a safe no-op.

- [ ] **Step 2: Run to verify failure**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/audio/AudioManager.test.ts` — expected FAIL.

- [ ] **Step 3: Implement cheer synthesis and wiring**

Create `crowdGain` in `start()` next to the other gains; connect to `gameplayGain`, not `masterGain`. Track a single `activeCrowdSource` handle; starting a new cheer always stops the old one. Hook classification into the existing per-event consumption so ID dedup and backlog suppression are inherited, not reimplemented.

- [ ] **Step 4: Run the audio suite, then commit**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/audio` — expected PASS.

```bash
git add packages/arcade-client/src/audio/synth.ts packages/arcade-client/src/audio/AudioManager.ts packages/arcade-client/src/audio/AudioManager.test.ts
git commit -m "feat: add synthesized crowd cheers on the gameplay bus"
```

### Task 5: ArenaShell + Crowd components and Scene mount

**Files:**
- Create: `packages/arcade-client/src/render/ArenaShell.tsx`
- Create: `packages/arcade-client/src/render/Crowd.tsx`
- Modify: `packages/arcade-client/src/render/Scene.tsx`

**Interfaces:**

```tsx
export function ArenaShell(props: {
  readonly events: WorldState["eventQueue"];
  readonly nowMs: number;
  readonly detail?: CrowdDetail; // defaults to "full"; no UI exposes it yet
}): JSX.Element;
```

`ArenaShell` computes `computeArenaLayout(RINK_CONFIG)` and `generateCrowd(layout, ARENA_CROWD_SEED, detail)` in `useMemo`, renders the static venue, and mounts `<Crowd />` with the crowd spec, events, and time.

- [ ] **Step 1: Build the static venue in `ArenaShell.tsx`**

Stands (merged/instanced box rows for bleacher steps), corner concourse blocks, aluminum rails and stair aisles (instanced), dim outer floor ring, dark enclosing wall, and emissive light-bank meshes (`meshStandardMaterial` with `emissive`, NO new `<pointLight>`/`<spotLight>`/`<directionalLight>` elements anywhere in the arena tree). Budget the static shell at ≤ 8 render calls: one instanced mesh per repeated element type, merged geometry for the wall/floor.

- [ ] **Step 2: Build `Crowd.tsx` with per-stand instanced meshes**

One `<group>` per stand section. Within each: one `InstancedMesh` for heads (per-instance color = skin tone), one per apparel body shape with per-instance apparel color (`instanceColor`), and — full detail only — one or two accessory `InstancedMesh`es. Instance matrices are written ONCE from the generated spec (in an effect/memo), never per frame. Budget: 4 sections × (1 head + up to 4 body shapes + ≤ 1 accessory) ≤ 24 calls full detail; reduced detail drops accessories (≤ 16), keeping the combined arena+crowd increase inside the 32/20 spec caps.

`useFrame` animates only the four section `group` transforms:
- idle: tiny y-bob/sway with deterministic per-section phase offsets (derived from stand ID hash, not `Math.random()`), amplitude small enough never to compete with gameplay;
- reactions: drive from `advanceCrowdReaction` state held in a ref (state advanced inside `useFrame` from the `events`/`nowMs` props) — goal = staggered two-pulse rise over 2.5 s, majorHit = single 0.8 s pop, per-section stagger from the same phase offsets;
- reduced detail: skip the idle branch entirely, keep the reaction branch.

No per-fan allocation inside `useFrame` — preallocate any scratch objects.

- [ ] **Step 3: Mount in `Scene.tsx`**

Add beside `<Rink />`:

```tsx
<ArenaShell events={currentWorld.eventQueue} nowMs={currentWorld.time.nowMs} />
```

No other `Scene.tsx` changes — except, if and only if manual QA in Task 6 shows the far arena wall clipping, raise the `Canvas` `far` plane (currently 3000) just enough to cover the wall's worst-case camera distance. That is a `Scene.tsx` `Canvas` prop, not a `CameraRig.tsx` change, so it stays inside the spec's constraints; note the measured distance in the commit message if changed.

- [ ] **Step 4: Typecheck and full client suite**

Run: `npm.cmd run typecheck` — expected PASS.
Run: `npm.cmd run test --workspace @bbh/arcade-client` — expected PASS (pure-module tests carry the logic; components stay thin and untested-by-unit per the existing render-component convention).

- [ ] **Step 5: Commit**

```bash
git add packages/arcade-client/src/render/ArenaShell.tsx packages/arcade-client/src/render/Crowd.tsx packages/arcade-client/src/render/Scene.tsx
git commit -m "feat: mount procedural arena bowl and instanced crowd"
```

### Task 6: Cross-package verification, performance, and manual QA

**Files:**
- Modify: `docs/superpowers/plans/2026-07-21-four-sided-arena-crowd.md`
- Modify: `HANDOFF.md`

- [ ] **Step 1: Automated verification**

Run each; all must PASS:

```powershell
npm.cmd run test --workspace @bbh/arcade-client
npm.cmd run typecheck
npm.cmd run build:arcade
```

Also run `npm.cmd run test` (full suite) to prove core/server are untouched.

- [ ] **Step 2: Performance comparison (assistant-runnable portion)**

Free Skate with the PerfHud overlay (dev mode), pre-feature vs post-feature: fps, jank, renders. Record both readings here. NOTE: the assistant cannot render WebGL headlessly — this step and everything below needs the user's browser; prepare the dev server (`npm run dev`, localhost:5173) and hand the checklist over.

- [ ] **Step 3: Manual QA (user eyeballs — from the spec's Manual Verification section)**

At home-goal, center-ice, and away-goal camera clamp positions, in a match AND Free Skate:

1. All four stands sit clearly beyond the glass; nothing covers rink, goals, players, puck, or HUD.
2. Camera never clips arena geometry; far wall never disappears (far-plane check).
3. Crowd reads as mixed neutral spectators; no school/team theming, no scoreboard.
4. Normal play: crowd silent; routine hits/stumbles silent.
5. Goal → full 2.5 s animation + one cheer, exactly once; knockdown → short pop + short cheer, exactly once; goal interrupts an active knockdown reaction.
6. Reload/reconnect mid-match → no replayed cheers or reactions.
7. Temporarily flip the internal detail input to `"reduced"` (code-level) and confirm the full stadium remains with a sparser, stiller crowd; flip back to `"full"` before commit.
8. PerfHud render-call increase ≤ 32 (full) / ≤ 20 (reduced) vs the pre-feature baseline.

- [ ] **Step 4: Check boxes, update HANDOFF, commit and push**

Mark this plan's checkboxes, add the shipped-feature entry to `HANDOFF.md`, then:

```bash
git add docs/superpowers/plans/2026-07-21-four-sided-arena-crowd.md HANDOFF.md
git commit -m "docs: verify four-sided arena crowd"
git push
```
