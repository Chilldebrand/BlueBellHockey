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

## Approved Fallbacks

Fallbacks are for early production only. A missing clip may use the listed fallback without failing validation:

- skater `hard_turn` -> `skate_forward`
- skater `turbo_skate` -> `skate_forward`
- skater `charged_shot` -> `wrist_shot`
- skater `get_up` -> `idle_ready`
- skater `juke` -> `skate_forward`
- skater `celebrate_goal` -> `idle_ready`
- goalie `pad_save` -> `body_save`
- goalie `glove_save` -> `body_save`
- goalie `blocker_save` -> `body_save`
- goalie `cover` -> `goalie_ready`
- goalie `goalie_slide` -> `goalie_ready`

Skaters must never use goalie save clips. Goalies must never use skater check, pass, or shot clips during saves.
