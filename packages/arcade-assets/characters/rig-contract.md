# Character Rig Contract

## Proportions

- Skater head scale: `1.45` to `1.85` relative to realistic hockey proportions.
- Goalie head scale: `1.45` to `1.7`, with oversized mask, glove, blocker, and pads.
- Body height target: `60` to `80` render units above the ice.
- Hands and skates may be exaggerated, but stick blade and puck attachment points must remain accurate.

## Required Bones

Every skater and goalie rig must expose these named bones:

- `root`
- `hips`
- `spine`
- `chest`
- `neck`
- `head`
- `upper_arm_l`
- `lower_arm_l`
- `hand_l`
- `upper_arm_r`
- `lower_arm_r`
- `hand_r`
- `upper_leg_l`
- `lower_leg_l`
- `skate_l`
- `upper_leg_r`
- `lower_leg_r`
- `skate_r`

## Required Attachments

- `stick_hand`: stick grip parented to the dominant hand.
- `stick_blade`: blade tip used by visuals and effects.
- `puck_blade`: puck carry anchor near the blade.
- `nameplate`: floating nameplate/HUD anchor.

Goalies may add `pad_l`, `pad_r`, `glove_face`, `blocker_face`, and `mask_front`, but the common attachments remain required.
