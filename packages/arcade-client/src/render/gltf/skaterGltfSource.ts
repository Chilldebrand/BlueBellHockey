import type { SkaterAnimationState } from "../animation/clipMap.js";

/**
 * Describes a real GLB skater body and how its raw rig maps onto our manifest
 * contract. Downloaded character packs (Quaternius, Mixamo, CesiumMan, ...)
 * never ship with our bone or clip names, so every source carries an explicit
 * remap. This is the load-time half of the retarget pipeline; the Blender half
 * (re-authoring clips onto a shared skeleton) is still owed for production.
 */
export interface SkaterGltfSource {
  /** Public URL under /arcade/models/ served from the client `public` dir. */
  readonly assetPath: string;
  /** Human label for debugging / attribution. */
  readonly label: string;
  /** Licence + provenance note. Surfaced so we never lose track of it. */
  readonly attribution: string;
  /**
   * Manifest bone name -> the node name actually present in the GLB. Used to
   * resolve attachment points (stick hand, blade, nameplate) to real joints.
   * A partial map is fine; unmapped bones simply have no attachment.
   */
  readonly boneMap: Readonly<Partial<Record<string, string>>>;
  /**
   * Our animation-clip name -> the clip name inside the GLB. `null` means the
   * GLB has no matching clip, so the player should fall back to the base clip.
   */
  readonly clipMap: Readonly<Partial<Record<string, string | null>>>;
  /** Clip played when a requested state has no mapped/authored clip. */
  readonly baseClip: string | null;
  /**
   * Root transform to seat the raw model on our ice: many exports are Z-up or
   * face the wrong way and use metres. These are eyeball-tuned in Free Skate.
   */
  readonly rootRotation: readonly [number, number, number];
  readonly rootScale: number;
  readonly yOffset: number;
}

/**
 * Master switch for the GLB body path. Flip to `false` to force every skater
 * back to the procedural capsule blockout (e.g. if an asset regresses).
 */
export const GLTF_SKATER_BODIES_ENABLED = true;

/**
 * TEMPORARY test asset. CesiumMan is a rigged, walk-animated humanoid used
 * only to prove the loader + remap + fallback wiring and to judge scale/look
 * in Free Skate. It is NOT the shipping character: its rig is a handful of
 * generic joints (`Skeleton_torso_joint_1`, `leg_joint_R_1`, ...) and it has a
 * single unnamed walk clip, so nearly everything maps onto the base clip.
 *
 * Swap `assetPath` for a Quaternius CC0 body and rewrite `boneMap`/`clipMap`
 * to commit to the real roster pipeline.
 */
export const TEST_CESIUM_SOURCE: SkaterGltfSource = {
  assetPath: "/arcade/models/skaters/test-cesium.glb",
  label: "CesiumMan (test)",
  attribution:
    "CesiumMan by Cesium, CC-BY 4.0 (Khronos glTF-Sample-Assets). Placeholder only.",
  boneMap: {
    hips: "Skeleton_torso_joint_1",
    spine: "Skeleton_torso_joint_2",
    chest: "torso_joint_3",
    neck: "Skeleton_neck_joint_1",
    head: "Skeleton_neck_joint_2",
    upper_arm_r: "Skeleton_arm_joint_R",
    lower_arm_r: "Skeleton_arm_joint_R__2_",
    hand_r: "Skeleton_arm_joint_R__3_",
    upper_arm_l: "Skeleton_arm_joint_L__4_",
    lower_arm_l: "Skeleton_arm_joint_L__3_",
    hand_l: "Skeleton_arm_joint_L__2_",
    upper_leg_r: "leg_joint_R_1",
    lower_leg_r: "leg_joint_R_2",
    skate_r: "leg_joint_R_5",
    upper_leg_l: "leg_joint_L_1",
    lower_leg_l: "leg_joint_L_2",
    skate_l: "leg_joint_L_5"
  },
  // CesiumMan ships one walk clip; map skating states to it, leave the rest
  // null so they fall back to the base clip until a richer rig arrives.
  clipMap: {
    skate_forward: null,
    turbo_skate: null,
    idle_ready: null
  },
  baseClip: null,
  // CesiumMan bakes its own Z-up->Y-up correction via the root node, so no
  // extra rotation is needed; it is authored in metres (~1.8u tall) and our
  // blockout body is ~68u, so scale up to match. Tune in Free Skate.
  rootRotation: [0, 0, 0],
  rootScale: 38,
  yOffset: 0
};

/** The source used for in-game skaters today. */
export const ACTIVE_SKATER_GLTF_SOURCE: SkaterGltfSource | null =
  GLTF_SKATER_BODIES_ENABLED ? TEST_CESIUM_SOURCE : null;

/**
 * Resolve which GLB clip name to play for a logical animation state, honouring
 * the source's clip map and base-clip fallback. Pure + deterministic so it can
 * be unit-tested without a WebGL context.
 */
export function resolveGltfClipName(
  source: SkaterGltfSource,
  manifestClip: string
): string | null {
  if (Object.prototype.hasOwnProperty.call(source.clipMap, manifestClip)) {
    const mapped = source.clipMap[manifestClip];
    // Explicit null means "no dedicated clip" -> base clip.
    return mapped ?? source.baseClip;
  }
  return source.baseClip;
}

/**
 * Given the clips a loaded GLB actually exposes, pick the best track name for a
 * requested clip: exact map hit, else base clip, else the first available clip
 * (covers exports whose single clip is unnamed / empty-string keyed).
 */
export function pickPlayableClip(
  source: SkaterGltfSource,
  manifestClip: string,
  availableClipNames: readonly string[]
): string | null {
  const wanted = resolveGltfClipName(source, manifestClip);
  if (wanted !== null && availableClipNames.includes(wanted)) {
    return wanted;
  }
  if (
    source.baseClip !== null &&
    availableClipNames.includes(source.baseClip)
  ) {
    return source.baseClip;
  }
  return availableClipNames.length > 0 ? availableClipNames[0] : null;
}

/** Map a live skater animation-state clip request through to a GLB track. */
export type { SkaterAnimationState };
