import {
  REQUIRED_GEAR_SLOTS,
  REQUIRED_MODEL_BONES,
  REQUIRED_SKATER_ANIMATION_CLIPS,
  REQUIRED_UNIFORM_SLOTS,
  type CharacterModelManifest
} from "./modelValidation.js";

/**
 * The first-pass skater contract. This is the SPEC a production GLB must
 * satisfy (bones, attachment points, material slots, named clips) — not
 * necessarily the file currently loaded in Free Skate. The live test asset is
 * described separately in `gltf/skaterGltfSource.ts`.
 *
 * Kept in a React-free module so the validation test can import it without
 * pulling the drei / three GLTF loader into the node test runner.
 */
export const FIRST_SKATER_MODEL_MANIFEST: CharacterModelManifest = {
  id: "rook-rocket",
  role: "skater",
  displayName: "Rook Rocket",
  assetPath: "/arcade/models/skaters/rook-rocket.glb",
  proportions: {
    headScale: 1.68,
    bodyHeight: 68,
    handScale: 1.18,
    footScale: 1.22
  },
  bones: REQUIRED_MODEL_BONES,
  attachments: {
    stick_hand: "hand_r",
    stick_blade: "attach_stick_blade",
    puck_blade: "attach_puck_blade",
    nameplate: "attach_nameplate"
  },
  materialSlots: {
    uniform: REQUIRED_UNIFORM_SLOTS,
    characterGear: REQUIRED_GEAR_SLOTS
  },
  animationClips: REQUIRED_SKATER_ANIMATION_CLIPS
};
