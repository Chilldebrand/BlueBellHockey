# Character Material Rules

## Uniform Recolor Slots

These slots are owned by team palette data and must be neutral in source textures:

- `uniform_jersey`
- `uniform_pants`
- `uniform_socks`
- `uniform_numbers`
- `uniform_trim`

## Character-Owned Gear Slots

These slots stay tied to the character identity and are not overwritten by team palettes:

- `gear_helmet`
- `gear_gloves`
- `gear_skates`
- `gear_stick`

Goalies also use:

- `gear_mask`
- `gear_pads`

## Rules

- Uniform slots cannot duplicate character gear slots.
- Character gear must remain readable against both home and away uniforms.
- Avoid real team palettes, marks, striping patterns, and player likeness cues.
- Use simple roughness-first materials; reflective/gloss effects should not obscure silhouette from the high camera.
