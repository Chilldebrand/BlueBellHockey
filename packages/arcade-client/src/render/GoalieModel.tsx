import { useMemo } from "react";
import { CanvasTexture } from "three";
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
import {
  buildMaskVents,
  maskUvToFace,
  MASK_CHEVRONS,
  MASK_EYES,
  type MaskHole
} from "./goalieMask.js";

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
  const palette = uniform ?? TEAM_PALETTES[teamId].uniform;
  // Above the validation guard: hooks cannot sit behind an early return, or
  // the hook order changes between a valid and an invalid manifest.
  const maskTexture = useGoalieMaskTexture(palette.jersey);

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
      {/* Retro fibreglass mask over the face. The cap opens toward +Z, which
          is down-ice: the +90 deg X rotation aims the pole (the middle of the
          face) at the shooter. */}
      {maskTexture ? (
        <mesh position={[0, 51, 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <sphereGeometry
            args={[16.4, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.46]}
          />
          <meshStandardMaterial map={maskTexture} roughness={0.42} />
        </mesh>
      ) : null}
      {/* Retention straps around the shell edge. */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 15.2, 52, -1]}
          rotation={[0, 0, side * 0.2]}
          castShadow
        >
          <boxGeometry args={[3.4, 7, 5]} />
          <meshStandardMaterial color="#16181d" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[-15, 14, 0]} castShadow>
        <boxGeometry args={[11, 23, 22]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[15, 14, 0]} castShadow>
        <boxGeometry args={[11, 23, 22]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <CatchGlove accent={palette.jersey} />
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

const MASK_SHELL = "#e9e3d1";
const MASK_HOLE = "#241f1a";
const MASK_SIZE = 256;

/** Face space (-1..1, +y up) -> pixel coords on the face-space scratch canvas. */
function facePixel(value: number, axis: "x" | "y"): number {
  const normalized = axis === "x" ? value * 0.5 + 0.5 : 0.5 - value * 0.5;
  return normalized * MASK_SIZE;
}

function paintHole(ctx: CanvasRenderingContext2D, hole: MaskHole): void {
  ctx.beginPath();
  ctx.ellipse(
    facePixel(hole.x, "x"),
    facePixel(hole.y, "y"),
    (hole.r * MASK_SIZE) / 2,
    ((hole.r * hole.stretch) * MASK_SIZE) / 2,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

/**
 * Paints the retro mask, then remaps it onto the polar UVs of a sphere cap.
 *
 * Two canvases on purpose: the mask is authored in ordinary face space (where
 * "a chevron above the eye" is something you can write down), then resampled
 * into the cap's u = angle / v = distance-from-pole layout. Painting straight
 * into polar would mean pre-distorting every shape by hand.
 */
function useGoalieMaskTexture(accent: string): CanvasTexture | null {
  return useMemo(() => {
    if (typeof document === "undefined") {
      return null;
    }

    const face = document.createElement("canvas");
    face.width = MASK_SIZE;
    face.height = MASK_SIZE;
    const fctx = face.getContext("2d");
    if (!fctx) {
      return null;
    }

    fctx.fillStyle = MASK_SHELL;
    fctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);

    fctx.fillStyle = accent;
    for (const chevron of MASK_CHEVRONS) {
      fctx.beginPath();
      chevron.forEach(([x, y], index) => {
        const px = facePixel(x, "x");
        const py = facePixel(y, "y");
        if (index === 0) {
          fctx.moveTo(px, py);
        } else {
          fctx.lineTo(px, py);
        }
      });
      fctx.closePath();
      fctx.fill();
    }

    fctx.fillStyle = MASK_HOLE;
    for (const vent of buildMaskVents()) {
      paintHole(fctx, vent);
    }
    for (const eye of MASK_EYES) {
      paintHole(fctx, eye);
    }

    // Resample into the cap's polar layout. Canvas row 0 is uv.y = 1 (three
    // flips textures by default), which is the pole — i.e. the middle of the
    // face — so the radius grows with the row index.
    const source = fctx.getImageData(0, 0, MASK_SIZE, MASK_SIZE);
    const outWidth = MASK_SIZE * 2;
    const outHeight = MASK_SIZE;
    const out = document.createElement("canvas");
    out.width = outWidth;
    out.height = outHeight;
    const octx = out.getContext("2d");
    if (!octx) {
      return null;
    }
    const target = octx.createImageData(outWidth, outHeight);

    for (let row = 0; row < outHeight; row += 1) {
      const radius = row / (outHeight - 1);
      for (let col = 0; col < outWidth; col += 1) {
        const { x, y } = maskUvToFace(col / (outWidth - 1), radius);
        const sx = Math.min(MASK_SIZE - 1, Math.max(0, Math.round(facePixel(x, "x"))));
        const sy = Math.min(MASK_SIZE - 1, Math.max(0, Math.round(facePixel(y, "y"))));
        const from = (sy * MASK_SIZE + sx) * 4;
        const to = (row * outWidth + col) * 4;
        target.data[to] = source.data[from]!;
        target.data[to + 1] = source.data[from + 1]!;
        target.data[to + 2] = source.data[from + 2]!;
        target.data[to + 3] = 255;
      }
    }

    octx.putImageData(target, 0, 0);
    const texture = new CanvasTexture(out);
    texture.anisotropy = 4;
    return texture;
  }, [accent]);
}

/**
 * Catch glove (trapper) on the non-stick hand — a cupped mitt with a laced
 * pocket, not the cube it used to be. Built to read at gameplay distance:
 * the silhouette is the cup and the dark pocket ring facing the shooter.
 */
function CatchGlove({ accent }: { readonly accent: string }): JSX.Element {
  return (
    <group name="catch-glove" position={[-25, 30, 4]} rotation={[0, 0.35, 0.18]}>
      {/* Cuff around the wrist. */}
      <mesh position={[0, -11, -3]} castShadow>
        <boxGeometry args={[11, 12, 15]} />
        <meshStandardMaterial color="#1b1e24" roughness={0.75} />
      </mesh>
      {/* Backhand: the padded cup, squashed into a mitt rather than a ball. */}
      <mesh scale={[0.72, 1.12, 1]} castShadow>
        <sphereGeometry args={[14, 16, 12]} />
        <meshStandardMaterial color="#23272e" roughness={0.7} />
      </mesh>
      {/* Pocket rim facing the shooter — the ring that reads as a catcher. */}
      <mesh position={[0, 1, 8]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[10.5, 2.6, 8, 20]} />
        <meshStandardMaterial color="#15181d" roughness={0.6} />
      </mesh>
      {/* Webbing sunk inside the rim. */}
      <mesh position={[0, 1, 6.4]}>
        <circleGeometry args={[10, 18]} />
        <meshStandardMaterial color="#0d0f12" roughness={0.95} />
      </mesh>
      {/* Team flash on the cuff so the two goalies still read apart. */}
      <mesh position={[0, -11, 4.6]}>
        <boxGeometry args={[11.4, 3.4, 1.2]} />
        <meshStandardMaterial color={accent} roughness={0.5} />
      </mesh>
      {/* Thumb running up the inside edge. */}
      <mesh position={[-7.5, 4, 3]} rotation={[0.3, 0, 0.5]} castShadow>
        <capsuleGeometry args={[3, 9, 4, 8]} />
        <meshStandardMaterial color="#23272e" roughness={0.7} />
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
