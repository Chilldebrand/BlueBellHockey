# Animation Contract

Animations must be short, readable from the high diagonal camera, and authored to loop or end cleanly on fixed simulation states.

## Skater Clips

- `idle_ready`
- `skate_forward`
- `hard_turn`
- `turbo_skate`
- `pass`
- `wrist_shot`
- `charged_shot`
- `check`
- `stumble`
- `knockdown`
- `get_up`
- `juke`
- `celebrate_goal`

## Goalie Clips

- `goalie_ready`
- `goalie_slide`
- `pad_save`
- `glove_save`
- `blocker_save`
- `body_save`
- `cover`
- `reset_ready`

## Export Rules

- Clip names are exact and case-sensitive.
- Clips should start from a stable pose and avoid baked world translation unless explicitly required.
- Contact and shot poses should reach their readable silhouette within the first third of the clip.
