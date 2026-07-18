# Arcade Audio and Announcer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local menu music, adjustable announcer/gameplay/music audio buses, event-driven arcade sound effects, character-name announcer callouts, and settings access from menus and live gameplay.

**Architecture:** Build a browser-native Web Audio subsystem in `packages/arcade-client/src/audio/`. A single `AudioManager` owns the context, buses, preferences, menu music state, event-ID deduplication, announcer queue, and gameplay presentation. Pure resolver modules produce announcer/gameplay cues from `WorldState` data so they can be unit-tested without an `AudioContext`; React settings components control persisted local bus gains.

**Tech Stack:** TypeScript, React 18, Vite, Vitest, Web Audio API, `localStorage`, existing `@bbh/arcade-core` world events and character/powerup config. No new runtime dependency.

## Global Constraints

- Work in the active `@bbh/arcade-client` package; do not wire the legacy `packages/client` app.
- Menu music is allowed on main menu, lobby, and postgame screens only; it fades out for matches and Free Skate.
- Announcer names are the fixed character names from `ARCADE_CHARACTERS`, never arbitrary player-display names.
- Announcer, gameplay, and music preferences are independent normalized `0..1` values stored locally per browser/player.
- The in-game Settings overlay is local-only and must never pause or alter the online match.
- Audio presentation must not affect deterministic simulation, prediction, replay state, or server authority.
- A missing or failed audio asset must be silent and non-fatal; it must not throw into the render loop or simulation.
- The Press Start gesture is the initialization point for browser audio autoplay compliance.
- Every code task follows TDD: write the focused failing test, run it to confirm failure, implement the minimum behavior, rerun the focused test, then run the relevant package checks.

---

## File Map

Create:

- `packages/arcade-client/src/audio/preferences.ts` — typed defaults, clamping, and local persistence for the three visible buses.
- `packages/arcade-client/src/audio/preferences.test.ts` — preference behavior tests.
- `packages/arcade-client/src/audio/synth.ts` — reusable Web Audio primitives for tones, noise bursts, gain envelopes, and safe context access.
- `packages/arcade-client/src/audio/music.ts` — menu-only procedural music scheduler with fade-in/fade-out and duplicate-timer protection.
- `packages/arcade-client/src/audio/announcer.ts` — pure event-to-cue mapping, character/powerup resolution, priority, cooldown, and bounded queue logic.
- `packages/arcade-client/src/audio/announcer.test.ts` — announcer resolver and queue tests.
- `packages/arcade-client/src/audio/gameplay.ts` — event-to-effect mapping and speed-driven skating mix calculations.
- `packages/arcade-client/src/audio/gameplay.test.ts` — gameplay cue and skating calculations.
- `packages/arcade-client/src/audio/AudioManager.ts` — runtime mixer, asset loader, event cursor, and public audio API.
- `packages/arcade-client/src/audio/AudioManager.test.ts` — context/bus lifecycle and event-cursor tests using injected fakes.
- `packages/arcade-client/src/ui/AudioSettings.tsx` — controlled accessible range sliders.
- `packages/arcade-client/src/ui/AudioSettings.test.tsx` — slider labels, values, and callbacks.
- `packages/arcade-client/src/ui/SettingsOverlay.tsx` — shared local settings modal and close behavior.
- `packages/arcade-client/src/ui/SettingsOverlay.test.tsx` — overlay open/close and interaction tests.
- `packages/arcade-client/public/audio/manifest.json` — stable logical IDs and public paths for voice/music assets.
- `packages/arcade-client/public/audio/README.md` — asset naming, export format, and voice-pack handoff rules.
- `scripts/verify-arcade-audio.cjs` — Puppeteer smoke verification for the active arcade client.

Modify:

- `packages/arcade-client/src/App.tsx` — initialize audio from Press Start, drive menu music from screen/phase, consume online world updates, and host match settings state.
- `packages/arcade-client/src/ui/BootSplash.tsx` — invoke the audio start callback from the user gesture.
- `packages/arcade-client/src/ui/MainMenu.tsx` — add Settings access.
- `packages/arcade-client/src/ui/Lobby.tsx` — add Settings access without changing lobby permissions.
- `packages/arcade-client/src/ui/Postgame.tsx` — add Settings access.
- `packages/arcade-client/src/ui/HUD.tsx` — add an in-game Settings control.
- `packages/arcade-client/src/ui/FreeSkate.tsx` — consume local-simulation events and expose the same settings overlay.
- `packages/arcade-client/src/styles/arcadeTheme.css` — range slider, overlay, settings button, and focus styles.
- `packages/arcade-client/package.json` — add the active arcade audio verification script if package-local invocation is preferred.
- `package.json` — add `verify:arcade-audio` as `node scripts/verify-arcade-audio.cjs`.

---

## Task 1: Add persisted audio preferences and accessible sliders

**Files:**
- Create: `packages/arcade-client/src/audio/preferences.ts`
- Test: `packages/arcade-client/src/audio/preferences.test.ts`
- Create: `packages/arcade-client/src/ui/AudioSettings.tsx`
- Test: `packages/arcade-client/src/ui/AudioSettings.test.tsx`
- Modify: `packages/arcade-client/src/styles/arcadeTheme.css`

**Interfaces:**

```ts
export type AudioBus = "announcer" | "gameplay" | "music";

export interface AudioPreferences {
  readonly announcer: number;
  readonly gameplay: number;
  readonly music: number;
}

export const DEFAULT_AUDIO_PREFERENCES: AudioPreferences = {
  announcer: 0.8,
  gameplay: 0.8,
  music: 0.55
};

export function clampAudioLevel(value: number): number;
export function loadAudioPreferences(storage?: Storage): AudioPreferences;
export function saveAudioPreferences(
  preferences: AudioPreferences,
  storage?: Storage
): void;
```

```tsx
export interface AudioSettingsProps {
  readonly value: AudioPreferences;
  readonly onChange: (next: AudioPreferences) => void;
}
```

- [ ] **Step 1: Write failing preference tests.** Cover defaults when storage is empty, clamping values below `0` and above `1`, ignoring malformed JSON, preserving valid values, and saving the exact normalized object under a named storage key.

```ts
it("clamps persisted levels and falls back for malformed values", () => {
  const storage = fakeStorage({
    "bbh.audio.preferences": JSON.stringify({ announcer: 2, gameplay: -1 })
  });

  expect(loadAudioPreferences(storage)).toEqual({
    announcer: 1,
    gameplay: 0,
    music: DEFAULT_AUDIO_PREFERENCES.music
  });
});
```

- [ ] **Step 2: Run the focused preference test and confirm failure.**

Run: `npm run test --workspace @bbh/arcade-client -- src/audio/preferences.test.ts`

Expected: FAIL because the preference module does not exist.

- [ ] **Step 3: Implement preferences.** Use the storage key `bbh.audio.preferences`; parse only plain objects; accept finite numbers; clamp each bus with `Math.min(1, Math.max(0, value))`; use defaults for absent/invalid fields; catch storage read/write errors and return without throwing.

- [ ] **Step 4: Add failing `AudioSettings` tests.** Render three labeled range inputs, assert accessible names `Announcer`, `Gameplay`, and `Music`, verify values are displayed as percentages, and verify changing one slider calls `onChange` while preserving the other two values.

```tsx
it("updates only the selected bus", () => {
  const onChange = vi.fn();
  render(
    <AudioSettings
      value={{ announcer: 0.8, gameplay: 0.6, music: 0.4 }}
      onChange={onChange}
    />
  );

  fireEvent.change(screen.getByRole("slider", { name: "Music" }), {
    target: { value: "20" }
  });

  expect(onChange).toHaveBeenCalledWith({
    announcer: 0.8,
    gameplay: 0.6,
    music: 0.2
  });
});
```

- [ ] **Step 5: Run the focused UI test and confirm failure.**

Run: `npm run test --workspace @bbh/arcade-client -- src/ui/AudioSettings.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 6: Implement the controlled slider panel.** Use `<input type="range" min={0} max={100} step={1}>`, convert the event value to `/ 100`, expose visible percentage text, and use `aria-label` values matching the three bus names.

- [ ] **Step 7: Add focused styles and run both test files.** Keep the panel usable over the rink, add visible `:focus-visible` styles, and avoid styling any existing tuning inputs through broad selectors.

Run: `npm run test --workspace @bbh/arcade-client -- src/audio/preferences.test.ts src/ui/AudioSettings.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit the preferences/UI slice.**

```bash
git add packages/arcade-client/src/audio/preferences.ts packages/arcade-client/src/audio/preferences.test.ts packages/arcade-client/src/ui/AudioSettings.tsx packages/arcade-client/src/ui/AudioSettings.test.tsx packages/arcade-client/src/styles/arcadeTheme.css
git commit -m "feat: add local audio preferences and sliders"
```

---

## Task 2: Build the Web Audio runtime and menu music

**Files:**
- Create: `packages/arcade-client/src/audio/synth.ts`
- Create: `packages/arcade-client/src/audio/music.ts`
- Create: `packages/arcade-client/src/audio/AudioManager.ts`
- Test: `packages/arcade-client/src/audio/AudioManager.test.ts`

**Interfaces:**

```ts
export interface AudioManagerApi {
  start(): void;
  setPreferences(preferences: AudioPreferences): void;
  getPreferences(): AudioPreferences;
  setMenuMusicAllowed(allowed: boolean): void;
  consumeWorld(world: WorldState, localEntityId: string | null): void;
  resetEventCursor(): void;
  dispose(): void;
}

export const audioManager: AudioManagerApi;
```

- [ ] **Step 1: Write failing lifecycle tests with injected Web Audio fakes.** Assert `start()` is idempotent, creates one context and one gain node per bus, applies loaded preferences, `setMenuMusicAllowed(true)` starts music only after `start()`, `setMenuMusicAllowed(false)` fades it out, and `dispose()` clears timers/listeners without throwing.

```ts
it("does not create duplicate audio graphs when start is called twice", () => {
  const runtime = createAudioManagerForTest(fakeAudioFactory());
  runtime.start();
  runtime.start();
  expect(runtime.testHooks.contextCreations()).toBe(1);
  expect(runtime.testHooks.busCreations()).toEqual({
    announcer: 1,
    gameplay: 1,
    music: 1
  });
});
```

- [ ] **Step 2: Run the focused manager test and confirm failure.**

Run: `npm run test --workspace @bbh/arcade-client -- src/audio/AudioManager.test.ts`

Expected: FAIL because the manager and test factory do not exist.

- [ ] **Step 3: Implement `synth.ts`.** Add safe `AudioContext` construction using `window.AudioContext ?? window.webkitAudioContext`, a reusable noise buffer, tone/burst envelope helpers, and `safeResume()` that catches rejected resumes. Keep all gain routing explicit so callers choose the bus.

- [ ] **Step 4: Implement menu music.** Adapt the legacy chord progression into a `MenuMusic` class with `setEnabled(boolean)`, a 25ms lookahead scheduler, one timer maximum, a fade target of silence when disabled, and `dispose()` that clears the timer. Do not include a game mood.

- [ ] **Step 5: Implement `AudioManager`.** Load preferences on construction, create `announcer`, `gameplay`, and `music` gain buses below a master gain, expose `setPreferences`, and make all methods no-op safely before initialization or when Web Audio is unavailable. Keep the event-cursor method present but delegate event mapping to later modules.

- [ ] **Step 6: Run the focused manager tests and package typecheck.**

Run: `npm run test --workspace @bbh/arcade-client -- src/audio/AudioManager.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the runtime/music slice.**

```bash
git add packages/arcade-client/src/audio/synth.ts packages/arcade-client/src/audio/music.ts packages/arcade-client/src/audio/AudioManager.ts packages/arcade-client/src/audio/AudioManager.test.ts
git commit -m "feat: add arcade audio runtime and menu music"
```

---

## Task 3: Add pure announcer resolution, queueing, and asset manifest

**Files:**
- Create: `packages/arcade-client/src/audio/announcer.ts`
- Test: `packages/arcade-client/src/audio/announcer.test.ts`
- Create: `packages/arcade-client/public/audio/manifest.json`
- Create: `packages/arcade-client/public/audio/README.md`

**Interfaces:**

```ts
export type AnnouncerKind = "goal" | "powerup";

export interface AnnouncerCue {
  readonly eventId: string;
  readonly kind: AnnouncerKind;
  readonly priority: number;
  readonly clipIds: readonly string[];
  readonly characterName: string;
  readonly text: string;
}

export function announcerCueForEvent(
  event: WorldEvent,
  world: WorldState,
  random?: () => number
): AnnouncerCue | null;

export class AnnouncerQueue {
  enqueue(cue: AnnouncerCue): void;
  interruptWith(cue: AnnouncerCue): void;
  next(nowMs: number): AnnouncerCue | null;
  clear(): void;
}
```

- [ ] **Step 1: Write failing resolver tests.** Cover goal scorer lookup by `sourceSlotId`, fallback to `"Unknown Player"` only for malformed events, powerup lookup through `targetSlotId`, unknown event types returning `null`, randomized line selection from a supplied deterministic random function, and goals receiving higher priority than powerups.

```ts
it("resolves a goal to the scorer character and a stable clip list", () => {
  const cue = announcerCueForEvent(goalEvent("home-skater-1"), worldFixture(), () => 0);
  expect(cue).toMatchObject({
    kind: "goal",
    priority: 100,
    characterName: "Rook Rocket"
  });
  expect(cue?.clipIds.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the focused announcer test and confirm failure.**

Run: `npm run test --workspace @bbh/arcade-client -- src/audio/announcer.test.ts`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement character and powerup resolution.** Import `ARCADE_CHARACTERS`, `POWERUP_DEFINITIONS`, and `WorldEvent`; resolve the scorer/collector from `world.skaters`; use `targetSlotId` as the existing powerup-type field; produce logical clip IDs such as `announcer.name.rook-rocket`, `announcer.goal.0`, and `announcer.powerup.speed-boost`.

- [ ] **Step 4: Implement the bounded priority queue.** Keep one active cue and at most two queued cues; `interruptWith` clears lower-priority pending cues; `next` enforces a 1.5-second announcer cooldown; return goals before powerups when timestamps tie.

- [ ] **Step 5: Run focused tests and typecheck.**

Run: `npm run test --workspace @bbh/arcade-client -- src/audio/announcer.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Add the manifest and asset contract.** List these exact logical IDs with paths under `/audio/`: twelve `announcer.name.<character-id>` clips; eight goal suffix clips `announcer.goal.0` through `announcer.goal.7`; six powerup suffix clips `announcer.powerup.speed-boost`, `announcer.powerup.hard-shot`, `announcer.powerup.freeze`, `announcer.powerup.bulldozer`, `announcer.powerup.mini-goalie`, and `announcer.powerup.giant-goalie`; and one `music.menu.0` track. The goal suffix copy slots are “finds the twine!”, “the goalie is requesting a map!”, “the scoreboard is filing a complaint!”, “that puck had a business meeting with the net!”, “the crease has been invaded!”, “top shelf, no ladder required!”, “the goalie saw it in the brochure!”, and “that was rude!”. The powerup suffix copy slots are “just found another gear!”, “loaded the big stick!”, “froze the competition!”, “turned into a wrecking ball!”, “made the goalie tiny!”, and “built a goalie wall!”. Document `.ogg`/`.mp3` support, stable ID naming, mono voice export at 48kHz, and the rule that absent files are non-fatal. The code must not require binary assets for unit tests.

- [ ] **Step 7: Commit the announcer/content-contract slice.**

```bash
git add packages/arcade-client/src/audio/announcer.ts packages/arcade-client/src/audio/announcer.test.ts packages/arcade-client/public/audio/manifest.json packages/arcade-client/public/audio/README.md
git commit -m "feat: add character announcer cue system"
```

---

## Task 4: Add gameplay effects and speed-driven skating

**Files:**
- Create: `packages/arcade-client/src/audio/gameplay.ts`
- Test: `packages/arcade-client/src/audio/gameplay.test.ts`
- Modify: `packages/arcade-client/src/audio/AudioManager.ts`

**Interfaces:**

```ts
export type GameplayCueId =
  | "hit"
  | "knockdown"
  | "save-pad"
  | "save-body"
  | "save-glove"
  | "save-blocker"
  | "save-cover"
  | "shot"
  | "one-timer"
  | "post"
  | "block"
  | "poke"
  | "jostle"
  | "bounce-back";

export function gameplayCueForEvent(event: WorldEvent): {
  readonly id: GameplayCueId;
  readonly intensity: number;
} | null;

export function skatingMixForSpeed(speed: number): {
  readonly gain: number;
  readonly playbackRate: number;
};
```

- [ ] **Step 1: Write failing gameplay tests.** Assert event mapping for every supported event, save `detail` variants, force normalization for hits, unknown event silence, zero-speed silence, and monotonic skating gain/rate as speed rises.

```ts
it("uses the save detail to select the correct effect", () => {
  expect(gameplayCueForEvent({
    id: "save-1",
    type: "save",
    atMs: 10,
    detail: "glove"
  })).toEqual({ id: "save-glove", intensity: 1 });
});
```

- [ ] **Step 2: Run the focused gameplay test and confirm failure.**

Run: `npm run test --workspace @bbh/arcade-client -- src/audio/gameplay.test.ts`

Expected: FAIL because the gameplay module does not exist.

- [ ] **Step 3: Implement pure cue mapping.** Map `hit` force to `0..1` using a fixed normalization cap; map save `detail` to the five save IDs; map `shot`, `oneTimer`, `post`, `block`, `poke`, `jostle`, and `bounceBack`; ignore announcer-only and spawn events.

- [ ] **Step 4: Implement skating mix math.** Use `Math.hypot(skater.velocity.x, skater.velocity.y)`, silence below a low movement threshold, clamp gain to `0..1`, and map speed to a bounded playback-rate range so the loop does not become shrill at turbo speed.

- [ ] **Step 5: Connect gameplay playback to `AudioManager.consumeWorld`.** For each new event, call the gameplay effect once on the gameplay bus; find the local skater by `localEntityId`; update one persistent skating source rather than creating a source per render frame; set its target gain to zero when the local entity is absent or is a goalie.

- [ ] **Step 6: Run focused tests, full arcade tests, and typecheck.**

Run: `npm run test --workspace @bbh/arcade-client -- src/audio/gameplay.test.ts src/audio/AudioManager.test.ts`

Expected: PASS.

Run: `npm run test:arcade`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the gameplay sound slice.**

```bash
git add packages/arcade-client/src/audio/gameplay.ts packages/arcade-client/src/audio/gameplay.test.ts packages/arcade-client/src/audio/AudioManager.ts
git commit -m "feat: add arcade gameplay sound effects"
```

---

## Task 5: Integrate menu music, world events, and settings overlays

**Files:**
- Create: `packages/arcade-client/src/ui/SettingsOverlay.tsx`
- Test: `packages/arcade-client/src/ui/SettingsOverlay.test.tsx`
- Modify: `packages/arcade-client/src/App.tsx`
- Modify: `packages/arcade-client/src/ui/BootSplash.tsx`
- Modify: `packages/arcade-client/src/ui/MainMenu.tsx`
- Modify: `packages/arcade-client/src/ui/Lobby.tsx`
- Modify: `packages/arcade-client/src/ui/Postgame.tsx`
- Modify: `packages/arcade-client/src/ui/HUD.tsx`
- Modify: `packages/arcade-client/src/ui/FreeSkate.tsx`
- Modify: `packages/arcade-client/src/styles/arcadeTheme.css`

**Interfaces:**

```tsx
export interface SettingsOverlayProps {
  readonly open: boolean;
  readonly preferences: AudioPreferences;
  readonly onChange: (next: AudioPreferences) => void;
  readonly onClose: () => void;
}
```

- [ ] **Step 1: Write failing overlay tests.** Assert closed state renders nothing, open state renders the three sliders and a close button, close callback fires from the button and `Escape`, and the overlay uses a modal role with an accessible label.

- [ ] **Step 2: Run the focused overlay test and confirm failure.**

Run: `npm run test --workspace @bbh/arcade-client -- src/ui/SettingsOverlay.test.tsx`

Expected: FAIL because the overlay does not exist.

- [ ] **Step 3: Implement the shared overlay.** Render `AudioSettings`, add a backdrop and panel, stop propagation from the panel, install a keydown listener only while open, and restore focus to the opener through a ref when closed. Keep the overlay local; do not call any room/session pause API.

- [ ] **Step 4: Integrate preferences and audio start in `App.tsx`.** Hold `settingsOpen` and `audioPreferences` state initialized by `loadAudioPreferences`; call `audioManager.setPreferences` on changes; wrap `BootSplash.onContinue` to call `audioManager.start()` before switching to `menu`; add an effect that calls `audioManager.setMenuMusicAllowed(screen === "menu" || screen === "lobby" || state.phase === "ended")`.

- [ ] **Step 5: Integrate online world updates.** Add an effect keyed by `state.currentWorld?.time.tick` and `localControlledEntityId` that calls `audioManager.consumeWorld(state.currentWorld, localControlledEntityId)`; call `audioManager.resetEventCursor()` when the room is left or a new connection begins; retain `AudioManager` identity across React renders.

- [ ] **Step 6: Add settings launchers to all menu surfaces.** Add an `onOpenSettings` callback to `MainMenu`, `Lobby`, and `Postgame`; render a visible Settings button; pass the shared overlay from `App` so every launcher edits the same local preferences.

- [ ] **Step 7: Add match and Free Skate access.** Add `onOpenSettings` to `HUD` and render a compact in-game Settings control. In `FreeSkate`, hold local overlay state, call `audioManager.consumeWorld(world, localEntityId)` from an effect keyed by the local simulation tick, and include Settings beside the existing toolbar controls. Do not pause the simulation loop.

- [ ] **Step 8: Run UI tests, full arcade tests, and typecheck.**

Run: `npm run test --workspace @bbh/arcade-client -- src/ui/SettingsOverlay.test.tsx src/ui/MainMenu.test.tsx src/ui/Lobby.test.tsx src/ui/Postgame.test.tsx src/ui/HUD.test.tsx`

Expected: PASS.

Run: `npm run test:arcade`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 9: Commit the integration slice.**

```bash
git add packages/arcade-client/src/App.tsx packages/arcade-client/src/ui/BootSplash.tsx packages/arcade-client/src/ui/MainMenu.tsx packages/arcade-client/src/ui/Lobby.tsx packages/arcade-client/src/ui/Postgame.tsx packages/arcade-client/src/ui/HUD.tsx packages/arcade-client/src/ui/FreeSkate.tsx packages/arcade-client/src/ui/SettingsOverlay.tsx packages/arcade-client/src/ui/SettingsOverlay.test.tsx packages/arcade-client/src/styles/arcadeTheme.css
git commit -m "feat: integrate audio settings across arcade screens"
```

---

## Task 6: Add browser smoke verification and finish the asset contract

**Files:**
- Create: `scripts/verify-arcade-audio.cjs`
- Modify: `package.json`
- Modify: `packages/arcade-client/src/audio/AudioManager.ts`
- Modify: `packages/arcade-client/src/audio/announcer.ts`

- [ ] **Step 1: Add a development-only audio inspection handle.** Expose `window.__bbhArcadeAudio` only in non-production builds with `start`, `getPreferences`, `getMenuMusicState`, `getBusLevels`, and `getDiagnostics`. Do not expose raw `AudioContext` nodes or mutable simulation state.

- [ ] **Step 2: Write `scripts/verify-arcade-audio.cjs`.** Launch or connect to the active Vite page with Puppeteer, click Press Start, assert the inspection handle reports a running/available context, locate the Settings control, change each slider, assert preferences change, return to menu, assert menu music is enabled, enter a match/free-skate route, assert menu music is disabled, and check that the browser console contains no audio errors.

```js
const slider = await page.$('input[aria-label="Music"]');
await slider.evaluate((node) => {
  node.value = "20";
  node.dispatchEvent(new Event("input", { bubbles: true }));
  node.dispatchEvent(new Event("change", { bubbles: true }));
});
```

- [ ] **Step 3: Add event-cursor smoke coverage.** Use the development inspection handle to feed a deterministic fixture world or trigger the existing local Free Skate simulation; assert one goal and one powerup event increment diagnostics once even when the same world update is delivered twice.

- [ ] **Step 4: Add the root script.** Add exactly:

```json
"verify:arcade-audio": "node scripts/verify-arcade-audio.cjs"
```

- [ ] **Step 5: Run the browser check against a running arcade dev server.**

Run: `npm run dev:arcade`

In a second terminal run: `npm run verify:arcade-audio`

Expected: the script prints passing checks for audio initialization, three sliders, menu-only music, event deduplication, and a clean console.

- [ ] **Step 6: Verify asset loading behavior.** Keep the manifest paths stable, confirm missing voice/music files produce diagnostics but no thrown errors, and add generated/recorded files only under the documented `packages/arcade-client/public/audio/` categories. Confirm the twelve character-name IDs match `CHARACTER_IDS` exactly.

- [ ] **Step 7: Run the complete release checks.**

Run: `npm run test:arcade`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build:arcade`

Expected: PASS.

- [ ] **Step 8: Commit verification and asset-contract changes.**

```bash
git add scripts/verify-arcade-audio.cjs package.json packages/arcade-client/src/audio/AudioManager.ts packages/arcade-client/src/audio/announcer.ts
git commit -m "test: verify arcade audio integration"
```

---

## Final review checklist

- [ ] Announcer slider changes only the announcer bus.
- [ ] Gameplay slider changes hits, skating, saves, and puck effects without changing announcer volume.
- [ ] Music slider changes menu music and does nothing during gameplay because the music bus is silent there.
- [ ] Settings is reachable from main menu, lobby, postgame, match overlay, and Free Skate.
- [ ] Settings never calls a server pause or room mutation.
- [ ] Goals announce the scorer's character name and a randomized funny quip.
- [ ] Powerups announce the character and configured powerup label.
- [ ] Event IDs prevent duplicate sound/voice playback from repeated snapshots.
- [ ] Skating uses one persistent loop per local audio runtime, not one source per render.
- [ ] Menu music starts only after Press Start and stops for gameplay/Free Skate.
- [ ] Audio failures are silent/non-fatal.
- [ ] `npm run test:arcade`, `npm run typecheck`, `npm run build:arcade`, and `npm run verify:arcade-audio` pass.
