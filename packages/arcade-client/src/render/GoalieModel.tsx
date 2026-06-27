import { TEAM_PALETTES, type TeamId } from "@bbh/arcade-core";
import {
  REQUIRED_ATTACHMENTS,
  REQUIRED_GEAR_SLOTS,
  REQUIRED_GOALIE_ANIMATION_CLIPS,
  REQUIRED_MODEL_BONES,
  REQUIRED_UNIFORM_SLOTS,
  type CharacterModelManifest,
  validateModelManifest
} from "./modelValidation.js";
import type { GoalieAnimationState } from "./animation/clipMap.js";

export interface GoalieModelProps {
  readonly teamId: TeamId;
  readonly animationState?: GoalieAnimationState;
  readonly manifest?: CharacterModelManifest;
}

export const FIRST_GOALIE_MODEL_MANIFEST: CharacterModelManifest = {
  id: "mira-wall",
  role: "goalie",
  displayName: "Mira Wall",
  assetPath: "/arcade/models/goalies/mira-wall.glb",
  proportions: {
    headScale: 1.55,
    bodyHeight: 74,
    handScale: 1.32,
    footScale: 1.45
  },
  bones: REQUIRED_MODEL_BONES,
  attachments: {
    stick_hand: "hand_r",
    stick_blade: "attach_goalie_stick_blade",
    puck_blade: "attach_goalie_puck_blade",
    nameplate: "attach_nameplate"
  },
  materialSlots: {
    uniform: REQUIRED_UNIFORM_SLOTS,
    characterGear: [...REQUIRED_GEAR_SLOTS, "gear_mask", "gear_pads"]
  },
  animationClips: REQUIRED_GOALIE_ANIMATION_CLIPS
};

export function GoalieModel({
  teamId,
  animationState = "ready",
  manifest = FIRST_GOALIE_MODEL_MANIFEST
}: GoalieModelProps): JSX.Element {
  const validation = validateModelManifest(manifest, "goalie");

  if (!validation.valid) {
    return (
      <group name={`goalie-model-error:${manifest.id}`}>
        <mesh position={[0, 28, 0]}>
          <boxGeometry args={[34, 44, 18]} />
          <meshStandardMaterial color="#ff6b6b" wireframe />
        </mesh>
      </group>
    );
  }

  const palette = TEAM_PALETTES[teamId].uniform;
  const pose = goaliePose(animationState);

  return (
    <group
      name={`goalie-model:${manifest.id}:${animationState}`}
      rotation={[pose.pitch, pose.yaw, pose.roll]}
      scale={[pose.scaleX, pose.scaleY, pose.scaleZ]}
    >
      <mesh position={[0, 28, 0]} castShadow>
        <capsuleGeometry args={[13, 28, 8, 14]} />
        <meshStandardMaterial color={palette.jersey} roughness={0.56} />
      </mesh>
      <mesh position={[0, 52, 0]} castShadow>
        <sphereGeometry args={[15, 18, 14]} />
        <meshStandardMaterial color="#f0c49b" />
      </mesh>
      <mesh position={[0, 54, -2]} castShadow>
        <sphereGeometry args={[16, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[-15, 14, 0]} castShadow>
        <boxGeometry args={[11, 23, 22]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[15, 14, 0]} castShadow>
        <boxGeometry args={[11, 23, 22]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[-23, 30, 0]} rotation={[0, 0, 0.18]} castShadow>
        <boxGeometry args={[12, 16, 18]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[23, 29, 8]} rotation={[0.5, 0.2, -0.42]} castShadow>
        <boxGeometry args={[4, 6, 58]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
    </group>
  );
}

function goaliePose(state: GoalieAnimationState): {
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly scaleZ: number;
} {
  switch (state) {
    case "slide":
      return pose(0, 0, -0.14, 1.08, 0.92, 1.08);
    case "padSave":
      return pose(0.08, 0, 0.22, 1.18, 0.82, 1.12);
    case "gloveSave":
      return pose(-0.08, -0.22, -0.18, 1.06, 1.02, 1);
    case "blockerSave":
      return pose(-0.08, 0.22, 0.18, 1.06, 1.02, 1);
    case "bodySave":
      return pose(-0.2, 0, 0, 1.12, 0.95, 1.05);
    case "cover":
      return pose(0.24, 0, 0, 1.05, 0.78, 1.1);
    case "ready":
    default:
      return pose(0, 0, 0, 1, 1, 1);
  }
}

function pose(
  pitch: number,
  yaw: number,
  roll: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number
) {
  return { pitch, yaw, roll, scaleX, scaleY, scaleZ };
}
