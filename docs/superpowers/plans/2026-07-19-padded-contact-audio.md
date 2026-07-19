# Padded Contact Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove repetitive puck-contact clicks, play two curated padded impacts for hard hits/knockdowns, replace the synthetic skating tone with real ice texture, and announce only supported power-up names.

**Architecture:** Keep event selection pure in `gameplay.ts` and `announcer.ts`. Extend the existing manifest loader so it decodes authored gameplay buffers into a dedicated map; all authored playback routes through the existing gameplay bus and fails silently. The skating source is created only after a recorded ice buffer loads, and the old generated skating buffer is removed.

**Tech Stack:** TypeScript, Vitest, Web Audio API, existing Vite public assets, ffmpeg for local format conversion, no-sign-up Mixkit and SoundDino sound-effect libraries.

## Global Constraints

- `poke`, `jostle`, and `bounceBack` are silent; they must never fall back to a synthetic noise burst.
- Only `hit` and `knockdown` use new padded body-contact assets.
- Keep current shot, block, post, and save mappings unchanged.
- Keep `hard-shot` without an announcer cue.
- Supported power-ups announce only the pickup label, without a character-name clip or descriptive sentence.
- Gameplay assets provide `.ogg` first and `.mp3` fallback under `public/audio/gameplay/`.
- Missing, unsupported, or undecodable effects are silent and non-fatal.
- The new skating loop must be real blade-on-ice texture; no oscillator, synthetic tone, or `createSkatingBuffer` fallback remains.
- Every code task follows TDD: focused failing test, test run proving failure, minimal implementation, focused passing test, commit.

---

### Task 1: Make contested-puck events silent and power-up calls label-only

**Files:**
- Modify: `packages/arcade-client/src/audio/gameplay.ts`
- Modify: `packages/arcade-client/src/audio/gameplay.test.ts`
- Modify: `packages/arcade-client/src/audio/announcer.ts`
- Modify: `packages/arcade-client/src/audio/announcer.test.ts`
- Modify: `packages/arcade-client/public/audio/README.md`

**Interfaces:**
- Consumes: `WorldEvent`, `POWERUP_DEFINITIONS`, and current logical announcer IDs.
- Produces: `gameplayCueForEvent(event): GameplayCue | null` with silent repeated-contact types and `announcerCueForEvent(event, world): AnnouncerCue | null` with one label clip for supported power-ups.

- [ ] **Step 1: Write failing silent-contact tests.**

```ts
it.each(["poke", "jostle", "bounceBack"] as const)("mutes %s", (type) => {
  expect(gameplayCueForEvent(event(type))).toBeNull();
});
```

- [ ] **Step 2: Run the focused gameplay test and confirm failure.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/audio/gameplay.test.ts`

Expected: FAIL because the three event types currently return cue IDs.

- [ ] **Step 3: Implement the silence mapping.** Remove `poke`, `jostle`, and `bounce-back` from `GameplayCueId`; make those three switch cases return `null`. Do not alter `hit`, `knockdown`, save, shot, one-timer, post, or block cases.

- [ ] **Step 4: Write the failing label-only power-up test.**

```ts
it("announces a supported power-up with one label clip and no player name", () => {
  expect(announcerCueForEvent(powerupEvent("away-skater-2", "mini-goalie"), worldFixture()))
    .toEqual({
      eventId: "powerup-pickup-10-home-skater-1",
      kind: "powerup",
      priority: 50,
      clipIds: ["announcer.powerup.mini-goalie"],
      characterName: "",
      text: "Tiny Goalie!"
    });
});
```

- [ ] **Step 5: Run the focused announcer test and confirm failure.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/audio/announcer.test.ts`

Expected: FAIL because the existing cue prepends `announcer.name.zara-crush` and uses a descriptive quip.

- [ ] **Step 6: Implement label-only lookup.** Replace the power-up quip table with the exact display-label fallback table `{ "speed-boost": "Super Speed!", freeze: "Freeze!", bulldozer: "Bulldozer!", "mini-goalie": "Tiny Goalie!", "giant-goalie": "Huge Goalie!" }`. Return only `[\`announcer.powerup.${powerupType}\`]`, `characterName: ""`, and the mapped label. Preserve goal resolution and the `hard-shot` `null` result.

- [ ] **Step 7: Update the audio contract.** In `README.md`, replace the five power-up quip descriptions with `Super Speed!`, `Freeze!`, `Bulldozer!`, `Tiny Goalie!`, and `Huge Goalie!`; state that each clip is the full label-only voice line and must not contain a player name or second sentence.

- [ ] **Step 8: Run focused tests and commit.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/audio/gameplay.test.ts src/audio/announcer.test.ts`

Expected: PASS.

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- packages/arcade-client/src/audio/gameplay.ts packages/arcade-client/src/audio/gameplay.test.ts packages/arcade-client/src/audio/announcer.ts packages/arcade-client/src/audio/announcer.test.ts packages/arcade-client/public/audio/README.md
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'feat: simplify puck contact and powerup calls'
```

### Task 2: Curate and package the three authored effects

**Files:**
- Create: `packages/arcade-client/public/audio/gameplay/hits/hard-hit.ogg`
- Create: `packages/arcade-client/public/audio/gameplay/hits/hard-hit.mp3`
- Create: `packages/arcade-client/public/audio/gameplay/hits/knockdown.ogg`
- Create: `packages/arcade-client/public/audio/gameplay/hits/knockdown.mp3`
- Create: `packages/arcade-client/public/audio/gameplay/skating/ice-scrape-loop.ogg`
- Create: `packages/arcade-client/public/audio/gameplay/skating/ice-scrape-loop.mp3`
- Create: `packages/arcade-client/public/audio/gameplay/SOURCES.md`
- Replace: `packages/arcade-client/public/audio/announcer/powerups/{speed-boost,freeze,bulldozer,mini-goalie,giant-goalie}.{ogg,mp3}`
- Modify: `packages/arcade-client/public/audio/manifest.json`

**Interfaces:**
- Produces manifest IDs `gameplay.hit`, `gameplay.knockdown`, and `gameplay.skating`, each with OGG then MP3 candidate paths.
- Produces the existing five `announcer.powerup.*` IDs with label-only recordings from the previously configured announcer voice.

- [ ] **Step 1: Audition the exact no-sign-up source candidates before downloading.** Use Mixkit’s punch page to audition `Body punch quick hit` for `hard-hit` and `Strong punches to the body` for `knockdown`. Use SoundDino’s ice collection to audition a clean skating/curling slide for `ice-scrape-loop`. Reject a candidate that contains a sharp click, metallic ring, wind bed, crowd, music, thin-ice crack, obvious punch whoosh, or a long tail.

- [ ] **Step 2: Download the selected source files and edit them to the approved envelopes.** Trim `hard-hit` to 120–220 ms, `knockdown` to 180–320 ms, and create a seamless 1–3 second skating loop. Normalize each peak to -6 dB and add a 5 ms fade in/out to the two impacts. Keep only the blade scrape in the skating loop; no synthetic layer is added.

- [ ] **Step 3: Generate the five label-only power-up lines with the existing announcer voice.** Render exactly `Super Speed!`, `Freeze!`, `Bulldozer!`, `Tiny Goalie!`, and `Huge Goalie!`, one line per existing power-up filename. Export mono 48 kHz audio. Do not generate a `hard-shot` clip.

- [ ] **Step 4: Produce browser formats and verify them locally.**

```powershell
ffmpeg -i hard-hit-source.wav -ac 1 -ar 48000 -c:a libvorbis hard-hit.ogg
ffmpeg -i hard-hit-source.wav -ac 1 -ar 48000 -c:a libmp3lame -q:a 4 hard-hit.mp3
```

Apply the same mono/48 kHz commands to `knockdown`, `ice-scrape-loop`, and each regenerated power-up line. Run `ffprobe` for every output and confirm `codec_name` is `vorbis` or `mp3`, `sample_rate` is `48000`, and `channels` is `1`.

- [ ] **Step 5: Record origin and license.** Write `SOURCES.md` with the direct Mixkit punch category URL, direct SoundDino ice category URL, each selected clip title, download date, final path, and the rule that Mixkit/SoundDino source effects are no-sign-up assets. List the existing announcer provider as the source of the five replacement label clips.

- [ ] **Step 6: Add exact manifest entries.**

```json
"gameplay.hit": ["/audio/gameplay/hits/hard-hit.ogg", "/audio/gameplay/hits/hard-hit.mp3"],
"gameplay.knockdown": ["/audio/gameplay/hits/knockdown.ogg", "/audio/gameplay/hits/knockdown.mp3"],
"gameplay.skating": ["/audio/gameplay/skating/ice-scrape-loop.ogg", "/audio/gameplay/skating/ice-scrape-loop.mp3"]
```

- [ ] **Step 7: Commit the asset package.**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- packages/arcade-client/public/audio
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'feat: add padded contact and ice skating audio'
```

### Task 3: Decode and play authored gameplay buffers

**Files:**
- Modify: `packages/arcade-client/src/audio/AudioManager.ts`
- Modify: `packages/arcade-client/src/audio/AudioManager.test.ts`
- Modify: `packages/arcade-client/src/audio/gameplay.test.ts`
- Modify: `packages/arcade-client/src/audio/synth.ts`

**Interfaces:**
- Produces `playLoadedGameplayCue(id: "hit" | "knockdown", intensity: number): boolean` and a single looped skating source from `gameplay.skating`.
- Consumes manifest IDs `gameplay.hit`, `gameplay.knockdown`, and `gameplay.skating` decoded to `AudioBuffer` values.

- [ ] **Step 1: Write failing runtime tests.**

```ts
it("creates no source for repeated puck-contact events", () => {
  manager.start();
  world.eventQueue = [event("poke"), event("jostle"), event("bounceBack")];
  manager.consumeWorld(world, "home-skater-1");
  expect(context.bufferSources).toHaveLength(0);
});

it("uses the loaded ice asset as its one looped skating source", async () => {
  stubManifestAndAudio({ "gameplay.skating": ["/audio/gameplay/skating/ice-scrape-loop.ogg"] });
  manager.start();
  await flushAssetLoad();
  manager.consumeWorld(worldWithMovingLocalSkater(), "home-skater-1");
  expect(context.bufferSources[0]).toMatchObject({ loop: true });
  expect(context.bufferSources[0]?.buffer).toBe(decodedBuffers.get("gameplay.skating"));
});
```

- [ ] **Step 2: Run focused tests and confirm failure.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/audio/gameplay.test.ts src/audio/AudioManager.test.ts`

Expected: FAIL because repeated-contact events still create synthetic bursts and skating uses `createSkatingBuffer`.

- [ ] **Step 3: Load all manifest clips into an authored buffer map.** Replace the announcer-only storage condition in `loadAudioCandidates` with `decodedBuffers.set(clipId, decoded)` for every successful audio candidate. Keep `announcerBuffers` as a read-only alias or replace its reads with the shared authored map. Preserve missing-asset diagnostics and OGG-to-MP3 candidate fallback.

- [ ] **Step 4: Replace synthetic hit and knockdown playback.** In `playGameplayCue`, route `hit` to `gameplay.hit` and `knockdown` to `gameplay.knockdown`; create a fresh buffer source, connect it to `gameplayGain`, start at `currentTime`, and set source-local gain to `0.28 + intensity * 0.22` for hits and `0.48` for knockdowns. Return without calling `scheduleNoiseBurst` when the authored buffer is absent.

- [ ] **Step 5: Replace the skating synthesizer.** Remove `createSkatingBuffer` and `SKATING_BUFFERS` from `synth.ts`. In `ensureSkatingSource`, read `gameplay.skating` from the authored buffer map; if unavailable, return without creating a source. Connect the decoded source through the existing low-pass filter and `skatingGain`, set `loop = true`, and preserve a narrower speed mix range of `0.92..1.12` in `skatingMixForSpeed` so the real recording does not become tonal at turbo speed.

- [ ] **Step 6: Run focused and complete checks.**

Run: `npm.cmd run test --workspace @bbh/arcade-client -- src/audio/gameplay.test.ts src/audio/AudioManager.test.ts src/audio/announcer.test.ts`

Expected: PASS.

Run: `npm.cmd run test:arcade`

Expected: PASS.

Run: `npm.cmd run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit the playback slice.**

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- packages/arcade-client/src/audio/AudioManager.ts packages/arcade-client/src/audio/AudioManager.test.ts packages/arcade-client/src/audio/gameplay.test.ts packages/arcade-client/src/audio/synth.ts
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'feat: play authored arcade contact audio'
```

### Task 4: Verify the mix in browser and finish

**Files:**
- Verify: `packages/arcade-client/public/audio/manifest.json`
- Verify: `packages/arcade-client/src/audio/AudioManager.ts`
- Verify: `packages/arcade-client/src/audio/gameplay.ts`
- Verify: `packages/arcade-client/src/audio/announcer.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a buildable client with silent puck scrums, padded hard hits only, real ice-skate texture, and label-only power-up calls.

- [ ] **Step 1: Start the arcade client.**

Run: `npm.cmd run dev:arcade-client`

Expected: Vite prints a local URL and serves `/audio/gameplay/` assets.

- [ ] **Step 2: Browser mix check.** Start a Free Skate or match. Verify: puck pokes, loose-puck jostles, and bounce-backs make no click; routine bumps are silent; a hard hit has a short padded thump; a knockdown is heavier but not louder than the gameplay bus; moving skaters have a subtle blade-on-ice scrape without a pitchy spaceship sound; each supported pickup announces only its label; Hard Shot stays silent.

- [ ] **Step 3: Test fallback behavior.** Temporarily block one OGG request in browser dev tools and confirm its MP3 candidate plays. Temporarily block both candidates for one gameplay clip and confirm the event is silent with no console exception.

- [ ] **Step 4: Run final release checks.**

Run: `npm.cmd run test:arcade`

Expected: PASS.

Run: `npm.cmd run typecheck`

Expected: PASS.

Run: `npm.cmd run build:arcade`

Expected: PASS.

- [ ] **Step 5: Review and commit completion.**

Run: `& 'C:\Program Files\Git\cmd\git.exe' diff --check`

Expected: no whitespace errors.

```powershell
& 'C:\Program Files\Git\cmd\git.exe' add -- docs/superpowers/plans/2026-07-19-padded-contact-audio.md
& 'C:\Program Files\Git\cmd\git.exe' commit -m 'docs: record padded contact audio plan'
```
