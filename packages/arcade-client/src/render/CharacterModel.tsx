import { TEAM_PALETTES, type CharacterId, type TeamId } from "@bbh/arcade-core";
import {
  REQUIRED_ATTACHMENTS,
  REQUIRED_GEAR_SLOTS,
  REQUIRED_MODEL_BONES,
  REQUIRED_SKATER_ANIMATION_CLIPS,
  REQUIRED_UNIFORM_SLOTS,
  type CharacterModelManifest,
  validateModelManifest
} from "./modelValidation.js";
import type { SkaterAnimationState } from "./animation/clipMap.js";

export interface CharacterModelProps {
  readonly teamId: TeamId;
  readonly characterId?: CharacterId;
  readonly isLocal?: boolean;
  readonly animationState?: SkaterAnimationState;
  readonly manifest?: CharacterModelManifest;
}

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

export function CharacterModel({
  teamId,
  characterId,
  isLocal = false,
  animationState = "idle",
  manifest = FIRST_SKATER_MODEL_MANIFEST
}: CharacterModelProps): JSX.Element {
  const validation = validateModelManifest(manifest, "skater");

  if (!validation.valid) {
    return (
      <InvalidModelFallback
        name={`character-model-error:${manifest.id}`}
        color="#ff6b6b"
      />
    );
  }

  const palette = TEAM_PALETTES[teamId].uniform;
  const pose = skaterPose(animationState);

  return (
    <group
      name={`character-model:${characterId ?? manifest.id}:${animationState}`}
      rotation={[pose.pitch, pose.yaw, pose.roll]}
      scale={[pose.scaleX, pose.scaleY, pose.scaleZ]}
    >
      <mesh position={[0, 24, 0]} castShadow>
        <capsuleGeometry args={[9, 24, 8, 14]} />
        <meshStandardMaterial color={palette.jersey} roughness={0.58} />
      </mesh>
      <mesh position={[0, 46, 0]} castShadow>
        <sphereGeometry args={[14, 18, 14]} />
        <meshStandardMaterial color="#f2c9a2" roughness={0.62} />
      </mesh>
      <mesh position={[0, 54, -1]} castShadow>
        <sphereGeometry args={[15, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial color={isLocal ? "#ffffff" : "#111827"} />
      </mesh>
      <mesh position={[-13, 26, 0]} castShadow>
        <capsuleGeometry args={[3, 22, 5, 8]} />
        <meshStandardMaterial color="#f2c9a2" />
      </mesh>
      <mesh position={[13, 26, 0]} castShadow>
        <capsuleGeometry args={[3, 22, 5, 8]} />
        <meshStandardMaterial color="#f2c9a2" />
      </mesh>
      <mesh position={[16, 20, 12]} rotation={[0.4, 0.2, -0.45]} castShadow>
        <boxGeometry args={[4, 5, 48]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <mesh position={[-6, 7, 0]} castShadow>
        <boxGeometry args={[8, 7, 18]} />
        <meshStandardMaterial color={palette.pants} />
      </mesh>
      <mesh position={[8, 7, 0]} castShadow>
        <boxGeometry args={[8, 7, 18]} />
        <meshStandardMaterial color={palette.pants} />
      </mesh>
    </group>
  );
}

function skaterPose(state: SkaterAnimationState): {
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly scaleZ: number;
} {
  switch (state) {
    case "hardTurn":
      return pose(0, 0, -0.26, 1, 1, 1);
    case "turbo":
      return pose(-0.22, 0, 0, 0.94, 1.06, 1.04);
    case "pass":
      return pose(0, 0.22, 0, 1, 1, 1);
    case "wristShot":
    case "chargeShot":
      return pose(-0.34, -0.16, 0, 1.02, 1, 1);
    case "check":
      return pose(-0.18, 0, 0.34, 1.08, 0.96, 1);
    case "stumble":
      return pose(0.16, 0, 0.42, 1, 0.92, 1);
    case "down":
      return pose(0, 0, Math.PI / 2, 1.1, 0.72, 1);
    case "getUp":
      return pose(0, 0, 0.62, 1, 0.86, 1);
    case "juke":
      return pose(0, -0.34, -0.16, 1, 1, 1);
    case "celebrate":
      return pose(0, 0, 0, 1.08, 1.12, 1.08);
    case "skate":
    case "idle":
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

function InvalidModelFallback({
  name,
  color
}: {
  readonly name: string;
  readonly color: string;
}): JSX.Element {
  return (
    <group name={name}>
      <mesh position={[0, 24, 0]}>
        <boxGeometry args={[22, 38, 14]} />
        <meshStandardMaterial color={color} wireframe />
      </mesh>
    </group>
  );
}
