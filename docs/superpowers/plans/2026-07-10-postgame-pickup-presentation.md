# Postgame And Pickup Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a centered first-to-five postgame modal with deterministic three stars, remove powerup/target match-HUD widgets, and make pickup models more visible without changing gameplay.

**Architecture:** Add narrowly scoped per-skater stat lines and one primary-assist candidate to the shared deterministic world, then derive three stars with a pure client selector. Consolidate ended-match UI into `Postgame` and keep pickup changes inside the Three.js render layer.

**Tech Stack:** TypeScript, React, Three.js/react-three-fiber, Vitest, server-rendered React test markup, deterministic `@bbh/arcade-core` world snapshots.

## Global Constraints

- Modify only `packages/arcade-core`, `packages/arcade-server`, and `packages/arcade-client` plus this cluster's documentation.
- Preserve deterministic simulation and the existing full-world snapshot path.
- Do not change target score, pickup physics, pickup radius, powerup balance, activation controls, or banana behavior.
- Record one primary assist only; do not add secondary assists, goalie points, persistence, or season statistics.
- Do not modify legacy `packages/shared`, `packages/server`, or `packages/client`.
- Add no dependencies and use `npm.cmd` in PowerShell.
- Use TDD for each behavior change: add a focused failing regression, run it RED, implement the minimum change, and rerun GREEN.

---

## File Map

- Modify `packages/arcade-core/src/sim/types.ts`: define `PlayerStatLine`, `MatchStats.players`, and `PuckState.assistCandidateSlotId`.
- Modify `packages/arcade-core/src/sim/stats.ts`: initialize and safely retrieve per-player lines.
- Modify `packages/arcade-core/src/sim/world.ts`: initialize stats with every skater slot.
- Modify `packages/arcade-core/src/sim/goal.ts`: award scorer and one primary assist; clear assist state on faceoff.
- Modify `packages/arcade-core/src/sim/puck.ts`, `actions.ts`, `goalie.ts`, and `powerups.ts`: maintain or clear the assist candidate at authoritative touch points.
- Modify core tests in `goal.test.ts`, `puck.test.ts`, `hit.test.ts`, and `world.test.ts`.
- Create `packages/arcade-client/src/ui/threeStars.ts` and `threeStars.test.ts`: pure deterministic selection.
- Modify `packages/arcade-client/src/ui/Postgame.tsx` and `Postgame.test.tsx`: unified modal content.
- Modify `packages/arcade-client/src/App.tsx` and create `App.test.tsx`: mount only the unified ended-match surface.
- Modify `packages/arcade-client/src/ui/HUD.tsx` and `HUD.test.tsx`: remove two widgets.
- Modify `packages/arcade-client/src/render/Powerups.tsx` and create `Powerups.test.tsx`: visual scale/marker contract.
- Modify `packages/arcade-client/src/styles/arcadeTheme.css`: backdrop, modal, stars, responsive layout, and pickup-independent HUD cleanup.

### Task 1: Add authoritative per-player goals and hits

**Files:**
- Modify: `packages/arcade-core/src/sim/types.ts`
- Modify: `packages/arcade-core/src/sim/stats.ts`
- Modify: `packages/arcade-core/src/sim/world.ts`
- Modify: `packages/arcade-core/src/sim/goal.ts`
- Modify: `packages/arcade-core/src/sim/actions.ts`
- Test: `packages/arcade-core/src/sim/world.test.ts`
- Test: `packages/arcade-core/src/sim/goal.test.ts`
- Test: `packages/arcade-core/src/sim/hit.test.ts`

**Interfaces:**
- Produces `PlayerStatLine { goals: number; assists: number; hits: number }`.
- Produces `MatchStats.players: Record<string, PlayerStatLine>`.
- Produces `playerStatLine(stats, slotId): PlayerStatLine | null`.

- [ ] **Step 1: Write failing initialization, scorer, and hitter tests.** Assert all six skater IDs have zero lines, a goal credits `home-skater-1`, and a landed hit credits its hitter without changing other player lines.

```ts
expect(world.stats.players["home-skater-1"]).toEqual({ goals: 0, assists: 0, hits: 0 });
resolveGoals(world);
expect(world.stats.players["home-skater-1"]?.goals).toBe(1);
expect(world.stats.players[hitter.id]?.hits).toBe(1);
```

- [ ] **Step 2: Run RED.** Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/world.test.ts src/sim/goal.test.ts src/sim/hit.test.ts`. Expect failures because `players` does not exist.

- [ ] **Step 3: Add the stat types and initializer.** Change `createInitialStats` to consume skater IDs and build the record.

```ts
export interface PlayerStatLine {
  goals: number;
  assists: number;
  hits: number;
}

export function createInitialStats(slotIds: readonly string[]): MatchStats {
  const players = Object.fromEntries(
    slotIds.map((slotId) => [slotId, { goals: 0, assists: 0, hits: 0 }])
  );
  // return existing team totals plus players
}

export function playerStatLine(stats: MatchStats, slotId: string): PlayerStatLine | null {
  return stats.players[slotId] ?? null;
}
```

- [ ] **Step 4: Wire authoritative increments.** Call `createInitialStats(skaters.map(({ id }) => id))`; increment the scorer in `resolveGoals` and the hitter beside the existing team hit increments. Ignore non-skater IDs safely.

- [ ] **Step 5: Run GREEN.** Repeat the focused command, then run `npm.cmd run test --workspace @bbh/arcade-core`. Expect PASS.

- [ ] **Step 6: Commit.** Commit `feat(stats): track player goals and hits` with only Task 1 files.

### Task 2: Track one deterministic primary assist

**Files:**
- Modify: `packages/arcade-core/src/sim/types.ts`
- Modify: `packages/arcade-core/src/sim/puck.ts`
- Modify: `packages/arcade-core/src/sim/actions.ts`
- Modify: `packages/arcade-core/src/sim/goalie.ts`
- Modify: `packages/arcade-core/src/sim/powerups.ts`
- Modify: `packages/arcade-core/src/sim/goal.ts`
- Test: `packages/arcade-core/src/sim/puck.test.ts`
- Test: `packages/arcade-core/src/sim/goal.test.ts`

**Interfaces:**
- Produces `PuckState.assistCandidateSlotId: string | null`.
- Same-team completed reception sets the passer; opponent touch/possession, goalie save, and faceoff clear it.

- [ ] **Step 1: Write failing assist lifecycle tests.** Cover same-team pass reception, goal credit, no self-assist, opponent interception clearing, goalie save clearing, and faceoff clearing.

```ts
expect(world.puck.assistCandidateSlotId).toBe("home-skater-1");
resolveGoals(world);
expect(world.stats.players["home-skater-1"]?.assists).toBe(1);
expect(world.stats.players["home-skater-2"]?.assists).toBe(0);
```

- [ ] **Step 2: Run RED.** Run `npm.cmd run test --workspace @bbh/arcade-core -- src/sim/puck.test.ts src/sim/goal.test.ts src/sim/goalie.test.ts`. Expect missing-field failures.

- [ ] **Step 3: Add and initialize `assistCandidateSlotId`.** Add it to `PuckState`, set it to `null` in `createInitialPuckState`, and clear it in `resetForFaceoff`.

- [ ] **Step 4: Maintain the candidate at touch boundaries.** In `tryPickupLoosePuck`, set the passer on a same-team reception; clear when the new possessor is an opponent of the candidate. Clear it when a defender's poke/check/block becomes the last touch, when a goalie saves, and when an opposing powerup touch changes possession.

```ts
if (isPassReception && passer) {
  puck.assistCandidateSlotId = passer.id;
} else if (candidate && candidate.teamId !== skater.teamId) {
  puck.assistCandidateSlotId = null;
}
```

- [ ] **Step 5: Award the assist during goal resolution.** Validate candidate and scorer are distinct skaters on the scoring team before incrementing `assists`.

- [ ] **Step 6: Run GREEN.** Repeat focused tests, then run the full core suite. Expect PASS.

- [ ] **Step 7: Commit.** Commit `feat(stats): award primary assists`.

### Task 3: Build deterministic three-star selection

**Files:**
- Create: `packages/arcade-client/src/ui/threeStars.ts`
- Create: `packages/arcade-client/src/ui/threeStars.test.ts`

**Interfaces:**
- Produces `selectThreeStars(world: WorldState): readonly ThreeStar[]`.
- `ThreeStar` contains `rank`, `slotId`, `teamId`, `characterId`, `goals`, `assists`, `hits`, and `score`.

- [ ] **Step 1: Write failing selector tests.** Assert score weights `5/3/1`, tie-breaks goals/assists/hits/slot ID, mixed-team eligibility, and exactly three results when six skaters exist.

```ts
const stars = selectThreeStars(world);
expect(stars.map((star) => star.slotId)).toEqual([
  "home-skater-1",
  "away-skater-2",
  "home-skater-3"
]);
```

- [ ] **Step 2: Run RED.** Run `npm.cmd run test --workspace @bbh/arcade-client -- src/ui/threeStars.test.ts`. Expect module-not-found.

- [ ] **Step 3: Implement the pure selector.** Map world skaters to stat lines, compute `goals * 5 + assists * 3 + hits`, sort using every documented tie-break, slice three, and assign ranks 1-3.

- [ ] **Step 4: Run GREEN.** Repeat the focused command. Expect PASS.

- [ ] **Step 5: Commit.** Commit `feat(postgame): select three stars`.

### Task 4: Replace overlapping result panels with one modal

**Files:**
- Modify: `packages/arcade-client/src/ui/Postgame.tsx`
- Modify: `packages/arcade-client/src/ui/Postgame.test.tsx`
- Modify: `packages/arcade-client/src/App.tsx`
- Create: `packages/arcade-client/src/App.test.tsx`
- Modify: `packages/arcade-client/src/styles/arcadeTheme.css`
- Delete if unused: `packages/arcade-client/src/ui/WinSplash.tsx`

**Interfaces:**
- `Postgame` consumes `world: WorldState`, `onRematch`, and `onBackToLobby`.
- It renders one `.postgame-backdrop` containing one `.postgame-modal`.

- [ ] **Step 1: Write failing markup tests.** Assert winner, `FIRST TO 5`, `5 - N`, First/Second/Third Star, each G/A/H line, team totals, and both buttons. Assert ended `App` markup has one `aria-label="Postgame"` and no `aria-label="Win splash"`.

- [ ] **Step 2: Run RED.** Run `npm.cmd run test --workspace @bbh/arcade-client -- src/ui/Postgame.test.tsx src/App.test.tsx`. Expect missing copy/stars and duplicate-surface failures.

- [ ] **Step 3: Consolidate the component.** Call `selectThreeStars(world)`, resolve character display names through the core character catalog, and render the approved hierarchy inside backdrop/modal elements.

- [ ] **Step 4: Update the ended-match App path.** Remove the `WinSplash` import/mount and pass `state.currentWorld` to `Postgame`.

- [ ] **Step 5: Add responsive CSS.** Center with `inset: 0; display: grid; place-items: center`, dim with an opaque backdrop, bound modal height with `max-height: calc(100vh - 32px); overflow-y: auto`, and use a responsive three-column stars grid that stacks on narrow screens.

- [ ] **Step 6: Run GREEN.** Repeat focused tests, then run the client suite. Expect PASS.

- [ ] **Step 7: Commit.** Commit `feat(postgame): center results and add three stars`.

### Task 5: Remove HUD widgets and enlarge pickup presentation

**Files:**
- Modify: `packages/arcade-client/src/ui/HUD.tsx`
- Modify: `packages/arcade-client/src/ui/HUD.test.tsx`
- Modify: `packages/arcade-client/src/render/Powerups.tsx`
- Create: `packages/arcade-client/src/render/Powerups.test.tsx`

**Interfaces:**
- HUD retains `ScoreHud`, `TurboMeter`, and `Callouts` only.
- `FloatingIcon` renders a named visual root at scale `1.55` and a named emissive pickup ring; simulation coordinates remain unchanged.

- [ ] **Step 1: Write failing HUD and pickup structure tests.** Assert HUD markup omits `Held powerup` and `Target:` while retaining score/turbo content. Render the R3F element tree and assert `name="powerup-visual"`, `scale={1.55}`, and `name="powerup-halo"`.

- [ ] **Step 2: Run RED.** Run `npm.cmd run test --workspace @bbh/arcade-client -- src/ui/HUD.test.tsx src/render/Powerups.test.tsx`.

- [ ] **Step 3: Remove widget imports and mounts.** Delete only `PowerupHud` and `TargetIndicator` usage from `HUD.tsx`; leave state fields and activation behavior unchanged.

- [ ] **Step 4: Add the visual-only pickup wrapper and halo.** Scale the icon group to `1.55`, increase bob amplitude from `3` to `6`, and add a pulsing emissive ring close to the ice. Keep the outer pickup position and all core constants untouched.

- [ ] **Step 5: Run GREEN.** Repeat focused tests and the full client suite. Expect PASS.

- [ ] **Step 6: Commit.** Commit `feat(ui): simplify HUD and emphasize pickups`.

### Task 6: Integrated verification

**Files:** Review only unless verification exposes a regression in Tasks 1-5.

- [ ] Run `npm.cmd test`; expect all arcade suites PASS.
- [ ] Run `npm.cmd run typecheck`; expect exit code 0.
- [ ] Run `npm.cmd run build:arcade`; expect exit code 0, allowing the existing Vite chunk-size warning.
- [ ] Run `npm.cmd run smoke --workspace @bbh/arcade-server`; expect all seven checks PASS.
- [ ] Inspect `git status --short` and `git diff --stat`; confirm no legacy-package files changed.
- [ ] Manually verify at `http://localhost:5173`: modal centering at five goals, stars readability, button access at laptop height, no powerup/target HUD chips, and visible pickup halo/scale.

## Self-Review

- Spec coverage: Tasks 1-2 provide authoritative G/A/H; Task 3 ranks stars; Task 4 unifies the result surface; Task 5 handles HUD and pickup presentation; Task 6 covers integration and visual QA.
- Type consistency: `MatchStats.players`, `assistCandidateSlotId`, `selectThreeStars`, and `Postgame(world)` are defined before consumers.
- Scope: no gameplay radius, target score, powerup effect, or legacy-package change is included.
