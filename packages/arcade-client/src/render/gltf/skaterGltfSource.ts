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
  /**
   * When a state has to hold a static pose (see `shouldAdvanceClip`), freeze the
   * fallback clip at this fraction (0..1) of its duration instead of frame 0.
   * A walk cycle's frame 0 is a legs-apart contact pose; ~0.25 lands on the
   * legs-together passing pose, which reads better as a stand. Defaults to 0.
   */
  readonly idlePoseFraction?: number;
}

/**
 * Master switch for the GLB body path. `false` forces every skater back to the
 * procedural capsule blockout (which matches the goalie blockout style). The
 * CesiumMan test wiring below stays intact — flip to `true` to bring it back.
 */
export const GLTF_SKATER_BODIES_ENABLED = false;

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
  // CesiumMan's mesh faces +Z, but our skaters travel along local +X (the
  // blockout's forward), so it looked like it skated sideways. Turn it 90 deg
  // left about the vertical axis to face the direction of travel. It is
  // authored in metres (~1.8u tall) vs our ~68u blockout, so scale up to match.
  rootRotation: [0, Math.PI / 2, 0],
  rootScale: 38,
  yOffset: 0,
  // Freeze the idle stand on the walk's legs-together passing pose. Tune in
  // Free Skate if the frozen stance still looks mid-stride.
  idlePoseFraction: 0.25
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

/**
 * States that read as "the skater is moving its feet". Only these should loop a
 * generic locomotion clip when a rig lacks a dedicated animation — otherwise a
 * walk-only asset (like the CesiumMan placeholder) marches in place while idle.
 */
export const LOCOMOTION_STATES: ReadonlySet<SkaterAnimationState> = new Set([
  "skate",
  "turbo",
  "hardTurn",
  "juke"
]);

/**
 * True when the GLB has a clip authored specifically for this state (an exact
 * map hit or a real base clip), as opposed to only the first-available
 * fallback. A dedicated clip is always safe to advance.
 */
export function isDedicatedClip(
  source: SkaterGltfSource,
  manifestClip: string,
  availableClipNames: readonly string[]
): boolean {
  const wanted = resolveGltfClipName(source, manifestClip);
  return wanted !== null && availableClipNames.includes(wanted);
}

/**
 * Whether the playing clip's time should advance for this state. Advance when
 * there's a dedicated clip (play it as authored) or the skater is actually
 * moving; otherwise hold a static pose so a locomotion-only rig doesn't walk in
 * place while standing still.
 */
export function shouldAdvanceClip(
  source: SkaterGltfSource,
  manifestClip: string,
  animationState: SkaterAnimationState,
  availableClipNames: readonly string[]
): boolean {
  return (
    isDedicatedClip(source, manifestClip, availableClipNames) ||
    LOCOMOTION_STATES.has(animationState)
  );
}

/** Map a live skater animation-state clip request through to a GLB track. */
export type { SkaterAnimationState };
