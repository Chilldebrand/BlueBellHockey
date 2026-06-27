# Arcade Character Pipeline

This directory defines the production contract for original arcade skaters and goalies. It intentionally avoids real teams, player names, likeness references, copied uniforms, and copied UI or art.

## Required Deliverables

Each character package contains:

- concept sheet with front, side, back, and high-camera readability thumbnail
- GLB model exported under `/arcade/models/<role>/<character-id>.glb`
- JSON metadata matching `roster.schema.json`
- rig using the names in `rig-contract.md`
- materials following `material-rules.md`
- clips following `animation-contract.md`

## Style Target

Characters are compact, big-headed, and hockey-first. Heads, pads, gloves, sticks, skates, and silhouettes should read clearly from the high diagonal camera. Team uniform slots recolor cleanly; character-owned gear remains recognizable across home and away palettes.

## First Production Targets

- Skater: `rook-rocket`, a fast blue-line skater with a rounded helmet fin and bright lace accents.
- Goalie: `mira-wall`, a square-stance goalie with oversized pads, mask ridge, and broad blocker silhouette.

Temporary blockout geometry is allowed in the client only while these GLB assets are not yet exported. The blockouts must still validate against the same manifest contract.
