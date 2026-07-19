import { useEffect, useMemo, useRef } from "react";
import { useGLTF, useAnimations } from "@react-three/drei";
import { Color, type Group, Mesh, MeshStandardMaterial } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { TEAM_PALETTES, type TeamId } from "@bbh/arcade-core";
import { clipForSkaterState, type SkaterAnimationState } from "../animation/clipMap.js";
import {
  pickPlayableClip,
  shouldAdvanceClip,
  type SkaterGltfSource
} from "./skaterGltfSource.js";
import { applyUniformMaterialColor } from "./uniformMaterials.js";

export interface GltfSkaterBodyProps {
  readonly source: SkaterGltfSource;
  readonly teamId: TeamId;
  readonly isLocal: boolean;
  readonly animationState: SkaterAnimationState;
}

const CROSSFADE_SECONDS = 0.18;

/**
 * Renders a real rigged GLB skater. Each instance gets its own skeleton clone
 * (drei hands back one shared scene) and its own tinted material copies so team
 * colours don't bleed across players. Thrown load/parse errors bubble to the
 * enclosing ModelErrorBoundary, which swaps in the capsule blockout.
 */
export function GltfSkaterBody({
  source,
  teamId,
  isLocal,
  animationState
}: GltfSkaterBodyProps): JSX.Element {
  const gltf = useGLTF(source.assetPath);
  const rootRef = useRef<Group>(null);

  // Deep-clone the scene (skeleton-aware) once per mount so N skaters can share
  // the cached GLTF without fighting over one set of bones.
  const instance = useMemo(() => {
    const cloned = cloneSkeleton(gltf.scene) as Group;
    cloned.traverse((node) => {
      if (node instanceof Mesh) {
        node.castShadow = true;
        node.receiveShadow = false;
        // Clone materials so recolouring this instance is isolated.
        const baseMaterials = Array.isArray(node.material)
          ? node.material
          : [node.material];
        const clonedMaterials = baseMaterials.map((material) => {
          if (!(material instanceof MeshStandardMaterial)) {
            return material;
          }
          const clonedMaterial = material.clone() as MeshStandardMaterial;
          if (isLocal) {
            clonedMaterial.emissive = new Color("#334155");
            clonedMaterial.emissiveIntensity = 0.25;
          }
          return clonedMaterial;
        });
        node.material = Array.isArray(node.material)
          ? clonedMaterials
          : clonedMaterials[0];
      }
    });
    const recolored = applyUniformMaterialColor(cloned, TEAM_PALETTES[teamId].uniform);
    if (!recolored) {
      throw new Error("GLB skater has no named uniform materials");
    }
    return cloned;
  }, [gltf.scene, teamId, isLocal]);

  const { actions, names } = useAnimations(gltf.animations, rootRef);

  useEffect(() => {
    const manifestClip = clipForSkaterState(animationState);
    const clipName = pickPlayableClip(source, manifestClip, names);
    if (clipName === null) {
      return;
    }
    const next = actions[clipName];
    if (!next) {
      return;
    }
    const action = next.reset().fadeIn(CROSSFADE_SECONDS).play();
    // Hold a static pose when the state has no real clip and the skater isn't
    // moving, so a locomotion-only rig doesn't walk in place while idle. Freeze
    // on the configured pose fraction (e.g. a walk's legs-together frame) rather
    // than frame 0's legs-apart contact pose.
    const advance = shouldAdvanceClip(source, manifestClip, animationState, names);
    action.paused = !advance;
    if (!advance) {
      action.time = next.getClip().duration * (source.idlePoseFraction ?? 0);
    }
    return () => {
      next.fadeOut(CROSSFADE_SECONDS);
    };
  }, [actions, names, animationState, source]);

  return (
    <group
      ref={rootRef}
      rotation={source.rootRotation as [number, number, number]}
      scale={source.rootScale}
      position={[0, source.yOffset, 0]}
    >
      <primitive object={instance} />
    </group>
  );
}
