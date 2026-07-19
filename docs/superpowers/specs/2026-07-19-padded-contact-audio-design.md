# Padded Contact Audio Design

## Status

Approved design for implementation planning.

## Context

The arcade client currently generates several gameplay effects with short synthetic noise bursts. The same 60 ms burst is used for `poke`, `jostle`, and `bounceBack` events. Those events can occur repeatedly while a puck is contested, so rapid bursts are heard as clicking or firecrackers rather than hockey contact. Hard `hit` and `knockdown` events use related synthetic bursts, which do not communicate padded hockey contact.

The continuous skating loop is also synthesized from random noise plus a repeating 230 Hz tone. That pitched, looping source creates the spaceship or sci-fi-gun character instead of the variable blade-on-ice scrape of actual skating.

Power-up announcer cues currently concatenate a player-name clip with a descriptive sentence, for example, "Zara Crush made the goalie tiny!". They should instead announce only the pickup's concise label.

## Goals

1. Remove the click/firecracker sound from puck pokes, loose-puck jostles, and bounce-backs.
2. Keep normal skater bumps silent.
3. Add a short, low-frequency padded-contact effect for hard hits.
4. Add a heavier padded-contact effect for knockdowns.
5. Source both effects from a library that does not require the player to create an account.
6. Preserve unrelated gameplay effects, including shots, posts, and goalie saves.
7. Replace the synthetic skating loop with a real blade-on-ice skating texture.
8. Make each supported power-up announcer call say only its power-up label, without the collecting character name or a descriptive quip.

## Non-goals

- No new audio settings or controls.
- No change to simulation events, collision physics, or network protocol.
- No change to goal announcements and no new announcer recordings.
- The earlier removal of the `Hard Shot` announcer remains in force; it is not reintroduced by the label-only power-up calls.
- No sound for ordinary puck pokes, jostles, bounce-backs, or routine skater contact.

## Asset selection and licensing

Use two short effects from Mixkit's no-sign-up sound-effect library:

- A compact body-contact clip, initially evaluated from the "Body punch quick hit" listing, becomes the hard-hit effect.
- A fuller, lower padded-impact clip, initially evaluated from the "Strong punches to the body" listing, becomes the knockdown effect.

The chosen takes must be auditioned before inclusion. A clip is rejected if it has a sharp click, metallic ring, obvious punch/whoosh character, or a tail longer than the event needs. The final assets are trimmed to the useful impact, normalized conservatively, and stored in both `.ogg` and `.mp3` formats under `public/audio/gameplay/hits/`. The project records the source URL and license alongside the files.

For skating, source a real, continuous ice-scrape texture from a no-sign-up library such as SoundDino's free ice collection. Select a clean blade-on-ice or curling-style slide with no wind bed, crowd ambience, thin-ice cracks, music, or pronounced tonal whine. Trim a seamless one-to-three-second loop and store it in both formats under `public/audio/gameplay/skating/`. The source record documents the exact listing and license.

## Architecture and event mapping

`gameplayCueForEvent` remains the single event-to-cue boundary.

| World event | Result |
| --- | --- |
| `hit` | Play the authored hard-hit body-pad asset with gain scaled from event force. |
| `knockdown` | Play the authored heavier knockdown body-pad asset. |
| `poke` | Return no cue; silent. |
| `jostle` | Return no cue; silent. |
| `bounceBack` | Return no cue; silent. |
| Existing shot, save, post, block events | No behavioral change. |

For power-up pickup events, the announcer resolver emits exactly one `announcer.powerup.<type>` clip and label text for supported types. It does not resolve a skater or include an `announcer.name.*` clip. The existing exclusion for `hard-shot` remains unchanged.

`AudioManager` loads the authored impact buffers after the audio context starts, using the existing public-asset candidate pattern. It plays them through the existing Gameplay bus, so the current Gameplay volume control remains authoritative. If an asset fails to load or decode, that event is silent and the match continues; it must never fall back to the synthetic click/noise burst.

Hard-hit playback uses a small force-based gain range with a cap below the gameplay bus ceiling. Knockdowns use the heavier file at a fixed, conservative gain. The audio manager may allow overlapping hard-hit and knockdown instances when distinct events occur, but no muted puck-contact event can create a source node.

The skating source changes from a generated buffer to the looped authored ice texture. It continues to use the existing speed-driven gain and playback-rate mix, but its rate range is narrowed so the recording remains believable across gameplay speeds. The authored skating asset is decoded and looped only after it is available; if it fails to load, skating is silent rather than reverting to the synthetic tone.

## Data flow

1. The simulation emits world events as it does today.
2. `gameplayCueForEvent` discards repeated puck-contact event types and maps only hard hits/knockdowns to authored-contact cues.
3. `AudioManager.consumeWorld` deduplicates event IDs as it does today.
4. `AudioManager` plays loaded body-pad buffers through `gameplayGain` or does nothing when an asset is unavailable.
5. `announcerCueForEvent` maps a supported power-up pickup directly to its label clip, while goals retain their existing player-name-plus-goal-line presentation.
6. `AudioManager` loops the loaded blade-on-ice texture for the locally controlled skater and applies the existing speed-derived mix.
7. Existing user Gameplay-volume preference controls all three gameplay assets.

## Error handling

- Missing, failed, or unsupported `.ogg` candidates fall through to `.mp3`.
- If neither format loads or decodes, the affected hard-hit, knockdown, or skating playback is silent and diagnostics record the unavailable asset.
- A rejected source clip is not committed to the repository.
- The removal of `poke`, `jostle`, and `bounceBack` cues is independent of asset availability, so the clicking cannot return through a fallback path.

## Verification

Automated tests must demonstrate that:

- `poke`, `jostle`, and `bounceBack` map to `null`.
- `hit` and `knockdown` still map to distinct authored-contact cues.
- Consuming muted puck-contact events creates no gameplay one-shot source.
- Hit force affects hard-hit gain within the documented cap.
- Missing or undecodable authored assets leave the event silent without throwing.
- Each supported power-up resolves to one label-only clip and label-only fallback text, without a character-name clip.
- `hard-shot` remains without an announcer cue.
- The loaded skating recording is used as the loop source; it is silent if unavailable and never falls back to `createSkatingBuffer`.
- Existing mappings for shots, saves, posts, and blocks remain unchanged.

Manual browser QA must confirm that contested-puck scrums are silent, ordinary skater bumps are silent, hard hits sound like padded body contact without a sharp click, and knockdowns sound heavier without being too loud. It must also confirm that skating reads as blade-on-ice scrape without a tonal spaceship character, and that power-up announcements name the pickup only. Test both `.ogg`-capable and `.mp3` fallback playback where practical.

## Scope boundary

This work is limited to three curated gameplay assets, their attribution/source record, event and announcer mapping, authored-buffer playback, focused tests, and manual audio verification. It intentionally does not alter the broader audio mix or generate new announcer recordings.
