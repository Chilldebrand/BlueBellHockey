import {
  TEAM_PALETTES,
  type TeamId,
  type UniformPalette
} from "@bbh/arcade-core";
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
import { getHeadgearColor } from "./headgearColor.js";
import { lerp3, segmentBetween, type Point3 } from "./stickGeometry.js";

export interface GoalieModelProps {
  readonly teamId: TeamId;
  /** Identity uniform override; omitted uses the side's default palette. */
  readonly uniform?: UniformPalette;
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
  uniform,
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

  const palette = uniform ?? TEAM_PALETTES[teamId].uniform;
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
        <meshStandardMaterial color={getHeadgearColor(palette)} />
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
      <GoalieStick />
    </group>
  );
}

// Goalie local frame: +X lateral (the blocker side is +X), +Y up, +Z down-ice
// toward the shooter. The butt sits at the blocker hand; the shaft drops
// forward to a heel on the ice, and the blade sweeps back across the crease.
const GOALIE_STICK_BUTT: Point3 = [25, 36, -2];
const GOALIE_STICK_HEEL: Point3 = [19, 5, 22];
// Toe end of the blade, swept toward the middle of the crease.
const GOALIE_BLADE_TOE: Point3 = [-9, 5, 25];
// The paddle is the widened lower stretch of shaft, from here down to the heel.
const GOALIE_PADDLE_T = 0.46;

/**
 * The goalie stick, built from the same pieces as the skater stick
 * (StickAssembly in CharacterModel) — shaft, rounded heel, swept flat blade —
 * only heavier, plus the wide paddle a goalie stick has where a skater's shaft
 * stays thin. It used to be a single 4x6x58 box, which read as a plain rod.
 *
 * Cross sections are quoted against the skater's so the family resemblance is
 * deliberate: shaft 2.6 -> 4.4, blade 1.75x3.4 -> 3.2x5.6, heel r2.8 -> r4.4.
 */
function GoalieStick(): JSX.Element {
  const paddleTop = lerp3(GOALIE_STICK_BUTT, GOALIE_STICK_HEEL, GOALIE_PADDLE_T);
  const shaft = segmentBetween(GOALIE_STICK_BUTT, paddleTop);
  const paddle = segmentBetween(paddleTop, GOALIE_STICK_HEEL);
  const blade = segmentBetween(GOALIE_STICK_HEEL, GOALIE_BLADE_TOE);

  return (
    <group name="goalie-stick">
      {/* Upper shaft — the part the blocker hand holds. */}
      <mesh position={shaft.position} rotation={shaft.rotation} castShadow>
        <boxGeometry args={[4.4, shaft.length, 4.4]} />
        <meshStandardMaterial color="#3a3f47" roughness={0.5} />
      </mesh>
      {/* Paddle: wide across the lateral axis so it presents a blocking face
          down-ice, thin front-to-back like the real thing. */}
      <mesh position={paddle.position} rotation={paddle.rotation} castShadow>
        <boxGeometry args={[11.5, paddle.length, 4.2]} />
        <meshStandardMaterial color="#6b7280" roughness={0.45} />
      </mesh>
      {/* Rounded heel blending paddle into blade, as on the skater stick. */}
      <mesh position={[...GOALIE_STICK_HEEL]} castShadow>
        <sphereGeometry args={[4.4, 10, 8]} />
        <meshStandardMaterial color="#6b7280" roughness={0.45} />
      </mesh>
      {/* Flat blade lying on the ice, swept out to one side from the heel. */}
      <mesh position={blade.position} rotation={blade.rotation} castShadow>
        <boxGeometry args={[3.2, blade.length, 5.6]} />
        <meshStandardMaterial color="#6b7280" roughness={0.45} />
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
