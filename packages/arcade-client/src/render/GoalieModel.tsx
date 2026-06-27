import type { TeamId } from "@bbh/arcade-core";
import {
  REQUIRED_ATTACHMENTS,
  REQUIRED_GEAR_SLOTS,
  REQUIRED_GOALIE_ANIMATION_CLIPS,
  REQUIRED_MODEL_BONES,
  REQUIRED_UNIFORM_SLOTS,
  type CharacterModelManifest,
  validateModelManifest
} from "./modelValidation.js";

export interface GoalieModelProps {
  readonly teamId: TeamId;
  readonly manifest?: CharacterModelManifest;
}

const TEAM_PRIMARY: Record<TeamId, string> = {
  home: "#1f8fff",
  away: "#ff4f5e"
};

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

  const primary = TEAM_PRIMARY[teamId];

  return (
    <group name={`goalie-model:${manifest.id}:contract-ok`}>
      <mesh position={[0, 28, 0]} castShadow>
        <capsuleGeometry args={[13, 28, 8, 14]} />
        <meshStandardMaterial color={primary} roughness={0.56} />
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
