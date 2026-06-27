import type { TeamId } from "@bbh/arcade-core";
import {
  REQUIRED_ATTACHMENTS,
  REQUIRED_GEAR_SLOTS,
  REQUIRED_MODEL_BONES,
  REQUIRED_SKATER_ANIMATION_CLIPS,
  REQUIRED_UNIFORM_SLOTS,
  type CharacterModelManifest,
  validateModelManifest
} from "./modelValidation.js";

export interface CharacterModelProps {
  readonly teamId: TeamId;
  readonly isLocal?: boolean;
  readonly manifest?: CharacterModelManifest;
}

const TEAM_PRIMARY: Record<TeamId, string> = {
  home: "#1f8fff",
  away: "#ff4f5e"
};

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
  isLocal = false,
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

  const primary = TEAM_PRIMARY[teamId];

  return (
    <group name={`character-model:${manifest.id}:contract-ok`}>
      <mesh position={[0, 24, 0]} castShadow>
        <capsuleGeometry args={[9, 24, 8, 14]} />
        <meshStandardMaterial color={primary} roughness={0.58} />
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
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[8, 7, 0]} castShadow>
        <boxGeometry args={[8, 7, 18]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
    </group>
  );
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
