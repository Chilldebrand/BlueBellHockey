import { Suspense, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  DoubleSide,
  Euler,
  Quaternion,
  Vector3,
  type Group
} from "three";
import {
  TEAM_PALETTES,
  getCharacterById,
  type CharacterId,
  type TeamId,
  type Vec2
} from "@bbh/arcade-core";
import {
  type CharacterModelManifest,
  validateModelManifest
} from "./modelValidation.js";
import { FIRST_SKATER_MODEL_MANIFEST } from "./skaterManifest.js";
import type { SkaterAnimationState } from "./animation/clipMap.js";
import { GltfSkaterBody } from "./gltf/GltfSkaterBody.js";
import { ModelErrorBoundary } from "./gltf/ModelErrorBoundary.js";
import {
  ACTIVE_SKATER_GLTF_SOURCE,
  LOCOMOTION_STATES,
  type SkaterGltfSource
} from "./gltf/skaterGltfSource.js";
import { getHeadgearColor } from "./headgearColor.js";

// Re-exported for existing importers; the source of truth is skaterManifest.ts.
export { FIRST_SKATER_MODEL_MANIFEST };

export interface CharacterModelProps {
  readonly teamId: TeamId;
  readonly characterId?: CharacterId;
  readonly isLocal?: boolean;
  readonly animationState?: SkaterAnimationState;
  readonly manifest?: CharacterModelManifest;
  /**
   * Real GLB body to load. Defaults to the active project source; pass `null`
   * to force the procedural blockout (used by previews / tests).
   */
  readonly gltfSource?: SkaterGltfSource | null;
  /**
   * Sim blade offset in body space (x forward, y lateral-right, unscaled). The
   * blockout stick's flat head tracks this so the carried puck (drawn by the
   * sim at the same offset) rides on the blade. Defaults to the rest offset.
   */
  readonly bladeOffset?: Vec2;
  /**
   * Sim-plane speed (units/s). Drives the blockout leg-stride cadence so feet
   * churn faster the faster the skater actually moves. Omit for static
   * previews — the legs hold the glide stance.
   */
  readonly speed?: number;
}

export function CharacterModel({
  teamId,
  characterId,
  isLocal = false,
  animationState = "idle",
  manifest = FIRST_SKATER_MODEL_MANIFEST,
  gltfSource = ACTIVE_SKATER_GLTF_SOURCE,
  bladeOffset,
  speed = 0
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

  const blockout = (
    <BlockoutBody
      teamId={teamId}
      characterId={characterId}
      isLocal={isLocal}
      manifestId={manifest.id}
      animationState={animationState}
      bladeOffset={bladeOffset}
      speed={speed}
    />
  );

  // No GLB configured -> procedural body. With a source, attempt the real
  // model but keep the blockout as both the loading state (Suspense) and the
  // failure state (ModelErrorBoundary) so the rink never blanks out.
  if (!gltfSource) {
    return blockout;
  }

  return (
    <ModelErrorBoundary
      fallback={blockout}
      onError={(error) => {
        console.error(
          `[CharacterModel] GLB body "${gltfSource.assetPath}" failed; using blockout.`,
          error
        );
      }}
    >
      <Suspense fallback={blockout}>
        <GltfSkaterBody
          source={gltfSource}
          teamId={teamId}
          isLocal={isLocal}
          animationState={animationState}
        />
      </Suspense>
    </ModelErrorBoundary>
  );
}

interface BlockoutBodyProps {
  readonly teamId: TeamId;
  readonly characterId?: CharacterId;
  readonly isLocal: boolean;
  readonly manifestId: string;
  readonly animationState: SkaterAnimationState;
  readonly bladeOffset?: Vec2;
  readonly speed: number;
}

// The capsule body was authored facing +Z; skaters travel along local +X, so an
// outer +90 deg turn re-aims it forward (same fix the goalie + GLB needed).
const FORWARD_CORRECTION_Y = Math.PI / 2;

// Must match SkaterDebug.SKATER_MODEL_SCALE: sim offsets are unscaled, the model
// is drawn this much bigger, so convert sim units -> model-local by dividing.
const SKATER_RENDER_SCALE = 1.6;

// Sim rest blade offset (STICK_CONFIG.restOffset / restLateral) as a fallback
// when no live offset is threaded in (e.g. the model preview).
const REST_BLADE_OFFSET: Vec2 = { x: 22, y: 44.5 };

// Root-frame height (pre-1.6 scale) that lands the blade just under the carried
// puck. Puck renders at world y=22; 6 * 1.6 + 10 (group base) = ~20.
const BLADE_LOCAL_Y = 6;

// The torso lean hinges here (top of the thighs) so the body bends forward
// over the planted skates instead of the whole torso sliding off the legs,
// which live outside the pose group.
const HIP_PIVOT_Y = 22;

// Blockout leg-stride cycle. Speed is in sim units/s; everything else is
// root-frame local units / radians. All eyeball-tunable.
const STRIDE_LENGTH = 7; // forward/back scissor per leg
const STRIDE_LIFT = 2.5; // foot lift during the recovery swing
const STRIDE_KICK = 0.25; // leg tilt: push-off kick behind, knee-up in front
const STRIDE_RATE = 0.016; // stride phase rad/s per sim unit of speed
const STRIDE_RATE_MIN = 4; // slowest churn once striding at all
const STRIDE_RATE_MAX = 11; // cap so turbo legs don't blur
const STRIDE_MIN_SPEED = 140; // below this the skater just glides
const STRIDE_EASE = 8; // 1/s blend into/out of the stride

/** Procedural capsule blockout: the pre-GLB body and the universal fallback. */
function BlockoutBody({
  teamId,
  characterId,
  isLocal,
  manifestId,
  animationState,
  bladeOffset,
  speed
}: BlockoutBodyProps): JSX.Element {
  const palette = TEAM_PALETTES[teamId].uniform;
  const pose = skaterPose(animationState);
  const body = bodyScaleForCharacter(characterId);

  const legLeftRef = useRef<Group>(null);
  const legRightRef = useRef<Group>(null);
  // Random start phase so the whole rink doesn't stride in lockstep.
  // Render-only randomness — the sim never sees it.
  const stride = useRef({ phase: Math.random() * Math.PI * 2, weight: 0 });

  useFrame((_state, delta) => {
    const s = stride.current;
    const striding =
      LOCOMOTION_STATES.has(animationState) && speed > STRIDE_MIN_SPEED;
    // Ease in/out so strides blend from and back into the glide stance
    // instead of snapping; phase advances scaled by the weight so feet
    // coast to a stop rather than freezing mid-air.
    s.weight += ((striding ? 1 : 0) - s.weight) * (1 - Math.exp(-delta * STRIDE_EASE));
    const cadence = Math.min(
      STRIDE_RATE_MAX,
      Math.max(STRIDE_RATE_MIN, speed * STRIDE_RATE)
    );
    s.phase += delta * cadence * s.weight;
    applyStride(legLeftRef.current, s.phase, s.weight);
    applyStride(legRightRef.current, s.phase + Math.PI, s.weight);
  });

  // Blade in root-frame local coords (x forward, z lateral-right), tracking the
  // sim blade so the carried puck sits on the flat head as it stickhandles.
  const blade = bladeOffset ?? REST_BLADE_OFFSET;
  const bladeLocal: [number, number, number] = [
    blade.x / SKATER_RENDER_SCALE,
    BLADE_LOCAL_Y,
    blade.y / SKATER_RENDER_SCALE
  ];

  return (
    <group name={`character-model:${characterId ?? manifestId}:${animationState}`}>
      {/* Stat-driven physique: bruisers wider/taller, speedsters smaller.
          Scales the BODY only (grounded at the ice, so skates stay down) —
          the stick lives outside so the blade keeps tracking the sim puck. */}
      <group scale={[body.bulk, body.height, body.bulk]}>
      {/* Body: authored +Z, turned to face +X, then posed. The pose hinges
          at pose.pivotY (the hips for lean poses, the ice for the lying-down
          rolls) so a forward lean bends the torso over the planted skates. */}
      <group rotation={[0, FORWARD_CORRECTION_Y, 0]}>
        <group position={[0, pose.pivotY, 0]}>
        <group
          rotation={[pose.pitch, pose.yaw, pose.roll]}
          scale={[pose.scaleX, pose.scaleY, pose.scaleZ]}
        >
        <group position={[0, -pose.pivotY, 0]}>
          {/* Shorter torso: raised + trimmed from the bottom so the top stays at
              the shoulders but the hips clear the legs (was a long capsule that
              swallowed them). */}
          <mesh position={[0, 30, 0]} castShadow>
            <capsuleGeometry args={[9, 10, 8, 14]} />
            <meshStandardMaterial color={palette.jersey} roughness={0.58} />
          </mesh>
          {characterId ? (
            <JerseyBack
              characterId={characterId}
              textColor={palette.numbers}
            />
          ) : null}
          {/* Head (face looks toward +Z, the authored forward). */}
          <mesh position={[0, 46, 0]} castShadow>
            <sphereGeometry args={[14, 18, 14]} />
            <meshStandardMaterial color="#f2c9a2" roughness={0.62} />
          </mesh>
          {/* Glossy white CCM-style helmet shell coming down over the head. */}
          <mesh position={[0, 52.5, -1]} castShadow>
            <sphereGeometry
              args={[15.6, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62]}
            />
            <meshPhysicalMaterial
              color={getHeadgearColor(palette)}
              roughness={0.14}
              metalness={0.05}
              clearcoat={1}
              clearcoatRoughness={0.08}
            />
          </mesh>
          {/* Ear guards on each side (match the white shell). */}
          <mesh position={[-13.6, 43, 0.5]} castShadow>
            <boxGeometry args={[4, 11, 13]} />
            <meshPhysicalMaterial
              color={getHeadgearColor(palette)}
              roughness={0.18}
              metalness={0.05}
              clearcoat={1}
              clearcoatRoughness={0.12}
            />
          </mesh>
          <mesh position={[13.6, 43, 0.5]} castShadow>
            <boxGeometry args={[4, 11, 13]} />
            <meshPhysicalMaterial
              color={getHeadgearColor(palette)}
              roughness={0.18}
              metalness={0.05}
              clearcoat={1}
              clearcoatRoughness={0.12}
            />
          </mesh>
          {/* Eyes (dark, sitting behind the clear shield). */}
          <mesh position={[-4.6, 48.4, 11.9]}>
            <sphereGeometry args={[1.8, 10, 8]} />
            <meshStandardMaterial color="#15181f" />
          </mesh>
          <mesh position={[4.6, 48.4, 11.9]}>
            <sphereGeometry args={[1.8, 10, 8]} />
            <meshStandardMaterial color="#15181f" />
          </mesh>
          {/* Mouth, on the skin below the shield. */}
          <mesh position={[0, 42, 12.7]}>
            <boxGeometry args={[6.5, 1.8, 1.2]} />
            <meshStandardMaterial color="#5a2f2a" />
          </mesh>
          {/* Black smoked curved visor: a front slice of a sphere hugging the
              face, dark and glossy against the white shell. */}
          <mesh position={[0, 46, 0]}>
            <sphereGeometry
              args={[15.2, 24, 12, Math.PI / 2 - 0.95, 1.9, Math.PI * 0.38, Math.PI * 0.2]}
            />
            <meshPhysicalMaterial
              color="#0a0a0d"
              transparent
              opacity={0.9}
              roughness={0.06}
              metalness={0.1}
              clearcoat={1}
              clearcoatRoughness={0.05}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {/* Arms are drawn by StickAssembly as shoulder->grip segments so they
              reach down to the stick instead of hanging at the sides. */}
        </group>
        </group>
        </group>
      </group>
      {/* Legs + skates live in the root (+X forward, +Z right) frame like the
          stick — NOT inside the authored-forward rotation, which would turn the
          boots sideways. One foot is staggered forward for a skating stance;
          the wrapper groups are driven imperatively by the stride useFrame. */}
      <group ref={legLeftRef}>
        <LowerLimb z={-6.5} forward={-1} pants={palette.pants} socks={palette.jersey} />
      </group>
      <group ref={legRightRef}>
        <LowerLimb z={6.5} forward={2.5} pants={palette.pants} socks={palette.jersey} />
      </group>
      </group>
      {/* Stick lives in the root (+X forward) frame so its flat head can sit on
          the sim-driven puck without fighting the body's pose transforms. */}
      <StickAssembly bladeLocal={bladeLocal} torsoPitch={pose.pitch} />
      {animationState === "frozen" ? <IceBlock /> : null}
    </group>
  );
}

/**
 * The "iceblock" overlay for a frozen skater: a translucent pale-blue slab
 * encasing the body, plus a thin frosty base on the ice. Drawn in the model
 * root frame so it wraps the whole body regardless of pose.
 */
function IceBlock(): JSX.Element {
  return (
    <group name="ice-block">
      <mesh position={[0, 34, 0]}>
        <boxGeometry args={[34, 74, 34]} />
        <meshPhysicalMaterial
          color="#bfe9ff"
          transparent
          opacity={0.42}
          roughness={0.08}
          metalness={0}
          transmission={0.6}
          thickness={12}
          clearcoat={1}
          clearcoatRoughness={0.05}
          depthWrite={false}
        />
      </mesh>
      {/* Frosty base pooled on the ice. */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[40, 4, 40]} />
        <meshStandardMaterial
          color="#e6f6ff"
          transparent
          opacity={0.6}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

/**
 * Drive one leg wrapper through the stride cycle: a forward/back scissor, a
 * foot lift on the recovery swing (front half of the cycle), and a tilt that
 * kicks the push leg out behind. Everything scales with `weight` so the legs
 * settle back into the authored glide stance when it eases to 0.
 */
function applyStride(leg: Group | null, phase: number, weight: number): void {
  if (!leg) {
    return;
  }
  const swing = Math.sin(phase);
  leg.position.x = swing * STRIDE_LENGTH * weight;
  leg.position.y = Math.max(0, Math.cos(phase)) * STRIDE_LIFT * weight;
  leg.rotation.z = swing * STRIDE_KICK * weight;
}

/**
 * Stat-driven physique so a body reads its play style at a glance: bulk
 * (width/depth) grows with power + balance, height rises with power and
 * shrinks with speed. Deliberately subtle — a stat-neutral character is
 * exactly 1.0/1.0. Visual only; physics radii and speeds are untouched.
 */
export function bodyScaleForCharacter(characterId?: CharacterId): {
  readonly bulk: number;
  readonly height: number;
} {
  if (!characterId) {
    return { bulk: 1, height: 1 };
  }

  const stats = getCharacterById(characterId).stats;
  return {
    bulk: 1 + (stats.power + stats.balance - 6) * 0.04,
    height: 1 + (stats.power - 3) * 0.03 - (stats.speed - 3) * 0.02
  };
}

/**
 * Name + number on the jersey back, drawn to an offscreen canvas (same
 * pattern as the center-ice logo — no external assets) and mapped onto a
 * plane hugging the back of the torso. The body is authored facing +Z, so
 * the back is -Z.
 */
function JerseyBack({
  characterId,
  textColor
}: {
  readonly characterId: CharacterId;
  readonly textColor: string;
}): JSX.Element {
  const character = getCharacterById(characterId);
  const surname = character.displayName.split(" ").pop() ?? "";
  const number = character.jerseyNumber;

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 44px Inter, sans-serif";
      ctx.fillText(surname.toUpperCase(), 128, 52, 236);
      ctx.font = "800 150px Inter, sans-serif";
      ctx.fillText(String(number), 128, 160);
    }
    const tex = new CanvasTexture(canvas);
    tex.anisotropy = 8;
    return tex;
  }, [surname, number, textColor]);

  return (
    <mesh position={[0, 31, -9.4]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[17, 17]} />
      <meshStandardMaterial map={texture} transparent roughness={0.6} />
    </mesh>
  );
}

// Glossy black boot shell, shared by the boot pieces (matches the CCM helmet).
function BootMaterial(): JSX.Element {
  return (
    <meshPhysicalMaterial
      color="#0b0b0e"
      roughness={0.16}
      metalness={0.1}
      clearcoat={1}
      clearcoatRoughness={0.12}
    />
  );
}

// Bright steel for the runner and light plastic for the holder.
const STEEL_COLOR = "#cbd0d8";
const HOLDER_COLOR = "#eef1f5";

/**
 * A stylized hockey skate in the body root frame (+X forward, +Z lateral-right),
 * origin at the ice: a steel runner with up-swept heel/toe, a white Bauer-style
 * holder (two pillars + a bridge), a glossy black boot that rises from a low toe
 * to a tall ankle, and a white laced tongue.
 */
function Skate({
  position
}: {
  readonly position: [number, number, number];
}): JSX.Element {
  return (
    <group position={position}>
      {/* Steel runner on the ice. */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[16, 1.1, 1]} />
        <meshStandardMaterial color={STEEL_COLOR} metalness={0.9} roughness={0.28} />
      </mesh>
      {/* Up-swept toe and heel tips. */}
      <mesh position={[8, 1.4, 0]} rotation={[0, 0, 0.42]} castShadow>
        <boxGeometry args={[2.6, 1.1, 1]} />
        <meshStandardMaterial color={STEEL_COLOR} metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh position={[-8, 1.4, 0]} rotation={[0, 0, -0.42]} castShadow>
        <boxGeometry args={[2.6, 1.1, 1]} />
        <meshStandardMaterial color={STEEL_COLOR} metalness={0.9} roughness={0.28} />
      </mesh>
      {/* White holder: two pillars bridged under the boot. */}
      <mesh position={[5, 2.7, 0]} castShadow>
        <boxGeometry args={[2.6, 3, 1.7]} />
        <meshStandardMaterial color={HOLDER_COLOR} roughness={0.4} />
      </mesh>
      <mesh position={[-5, 2.7, 0]} castShadow>
        <boxGeometry args={[2.6, 3, 1.7]} />
        <meshStandardMaterial color={HOLDER_COLOR} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4, 0]} castShadow>
        <boxGeometry args={[13.5, 1.4, 2]} />
        <meshStandardMaterial color={HOLDER_COLOR} roughness={0.4} />
      </mesh>
      {/* Glossy black boot: low toe rising to a tall heel/ankle. */}
      <mesh position={[4.5, 6, 0]} castShadow>
        <boxGeometry args={[7.5, 3.8, 5]} />
        <BootMaterial />
      </mesh>
      <mesh position={[-0.5, 6.8, 0]} castShadow>
        <boxGeometry args={[6.5, 5, 5.2]} />
        <BootMaterial />
      </mesh>
      <mesh position={[-4.8, 8.2, 0]} castShadow>
        <boxGeometry args={[5, 7.4, 5]} />
        <BootMaterial />
      </mesh>
      {/* Ankle cuff at the top-back. */}
      <mesh position={[-4.8, 12, 0]} castShadow>
        <boxGeometry args={[4.6, 2.8, 5.3]} />
        <BootMaterial />
      </mesh>
      {/* White laced tongue at the front of the ankle. */}
      <mesh position={[0.6, 9.6, 0]} rotation={[0, 0, -0.22]} castShadow>
        <boxGeometry args={[3, 5.6, 4.2]} />
        <meshStandardMaterial color="#f4f6f9" roughness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * One leg: a padded-pants thigh over a team-sock shin (nudged forward for a bent
 * knee so it reads as a leg, not a tube), ending in a skate. Root frame.
 */
function LowerLimb({
  z,
  forward,
  pants,
  socks
}: {
  readonly z: number;
  readonly forward: number;
  readonly pants: string;
  readonly socks: string;
}): JSX.Element {
  return (
    <group position={[forward, 0, z]}>
      {/* Thigh — bulky hockey pants. */}
      <mesh position={[-1.5, 17, 0]} castShadow>
        <boxGeometry args={[8.5, 12, 6.5]} />
        <meshStandardMaterial color={pants} roughness={0.7} />
      </mesh>
      {/* Shin in team socks, forward of the thigh for a knee bend. */}
      <mesh position={[1.5, 8.5, 0]} castShadow>
        <boxGeometry args={[6, 11, 5.2]} />
        <meshStandardMaterial color={socks} roughness={0.75} />
      </mesh>
      <Skate position={[1, 0, 0]} />
    </group>
  );
}

// Root frame: +X forward, +Y up, +Z lateral-right (so -Z is left). The butt sits
// near the chest, slightly left; the shaft crosses down-forward to the blade, so
// the blade end reads to the right of the butt. Shoulders anchor the arms.
const STICK_BUTT: [number, number, number] = [2, 22, -3];
const SHOULDER_L: [number, number, number] = [0, 34, -8];
const SHOULDER_R: [number, number, number] = [0, 34, 8];
// Where the two hands grip the shaft, as fractions from butt to blade.
const TOP_HAND_T = 0.16;
const LOW_HAND_T = 0.42;

/**
 * Two-handed stick: shoulders reach down to hands gripping a shaft that crosses
 * the body to a flat blade. The blade sits at `bladeLocal` (tracking the sim
 * blade) so the carried puck rides on it.
 */
function StickAssembly({
  bladeLocal,
  torsoPitch = 0
}: {
  readonly bladeLocal: [number, number, number];
  /** Forward-lean pitch of the torso; the shoulder anchors follow it. */
  readonly torsoPitch?: number;
}): JSX.Element {
  const topHand = lerp3(STICK_BUTT, bladeLocal, TOP_HAND_T);
  const lowHand = lerp3(STICK_BUTT, bladeLocal, LOW_HAND_T);
  const shaft = segmentBetween(STICK_BUTT, bladeLocal);
  const leftArm = segmentBetween(pitchShoulder(SHOULDER_L, torsoPitch), topHand);
  const rightArm = segmentBetween(pitchShoulder(SHOULDER_R, torsoPitch), lowHand);
  // Blade sweeps out to ONE side from the heel (where the shaft lands) and lies
  // flat — long axis lateral so it reads horizontal. A rounded heel blends the
  // shaft into the blade so they read as one continuous piece.
  const heel = bladeLocal;
  const toe: [number, number, number] = [heel[0] + 2, heel[1], heel[2] + 16];
  const blade = segmentBetween(heel, toe);

  return (
    <group name="stick">
      {/* Arms angling down from the shoulders to the two hands */}
      <mesh position={leftArm.position} rotation={leftArm.rotation} castShadow>
        <boxGeometry args={[5, leftArm.length, 5]} />
        <meshStandardMaterial color="#f2c9a2" />
      </mesh>
      <mesh position={rightArm.position} rotation={rightArm.rotation} castShadow>
        <boxGeometry args={[5, rightArm.length, 5]} />
        <meshStandardMaterial color="#f2c9a2" />
      </mesh>
      {/* Shaft */}
      <mesh position={shaft.position} rotation={shaft.rotation} castShadow>
        <boxGeometry args={[2.6, shaft.length, 2.6]} />
        <meshStandardMaterial color="#3a3f47" roughness={0.5} />
      </mesh>
      {/* Gloves at both grips */}
      <mesh position={topHand} castShadow>
        <sphereGeometry args={[4.6, 10, 8]} />
        <meshStandardMaterial color="#20242b" />
      </mesh>
      <mesh position={lowHand} castShadow>
        <sphereGeometry args={[4.4, 10, 8]} />
        <meshStandardMaterial color="#20242b" />
      </mesh>
      {/* Rounded heel where the shaft becomes the blade — smooths the corner. */}
      <mesh position={heel} castShadow>
        <sphereGeometry args={[2.8, 10, 8]} />
        <meshStandardMaterial color="#6b7280" roughness={0.45} />
      </mesh>
      {/* Flat blade swept to one side from the heel: thin front-to-back, its
          long axis lateral (horizontal). The puck rides at the heel end. */}
      <mesh position={blade.position} rotation={blade.rotation} castShadow>
        <boxGeometry args={[1.75, blade.length, 3.4]} />
        <meshStandardMaterial color="#6b7280" roughness={0.45} />
      </mesh>
    </group>
  );
}

/**
 * Rotate a shoulder anchor about the hip hinge by the torso's forward-lean
 * pitch (root frame: forward is +X) so the arms stay glued to the leaned
 * chest instead of floating behind it. Pitch-only on purpose — yaw/roll poses
 * are brief and the arms already read as loose.
 */
function pitchShoulder(
  base: readonly [number, number, number],
  pitch: number
): [number, number, number] {
  const dy = base[1] - HIP_PIVOT_Y;
  return [
    base[0] + dy * Math.sin(pitch),
    HIP_PIVOT_Y + dy * Math.cos(pitch),
    base[2]
  ];
}

const SEGMENT_UP = new Vector3(0, 1, 0);

/**
 * Transform for a box that spans `from`->`to`: box height axis (Y) is rotated
 * onto the segment direction and centred at the midpoint. Returns the length so
 * the caller can size the box.
 */
function segmentBetween(
  from: readonly [number, number, number],
  to: readonly [number, number, number]
): {
  readonly position: [number, number, number];
  readonly rotation: [number, number, number];
  readonly length: number;
} {
  const a = new Vector3(from[0], from[1], from[2]);
  const b = new Vector3(to[0], to[1], to[2]);
  const dir = new Vector3().subVectors(b, a);
  const length = dir.length() || 0.0001;
  const mid = new Vector3().addVectors(a, b).multiplyScalar(0.5);
  const quat = new Quaternion().setFromUnitVectors(
    SEGMENT_UP,
    dir.clone().normalize()
  );
  const euler = new Euler().setFromQuaternion(quat);
  return {
    position: [mid.x, mid.y, mid.z],
    rotation: [euler.x, euler.y, euler.z],
    length
  };
}

function lerp3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}

/**
 * Pose convention: the body is authored facing +Z inside the +90° Y forward
 * correction, so POSITIVE pitch leans the skater toward the direction of
 * travel. (The original table assumed the opposite, which is why everyone
 * used to lean onto their heels at speed.) Skating states carry a baseline
 * forward crouch that deepens with effort.
 */
function skaterPose(state: SkaterAnimationState): {
  readonly pitch: number;
  readonly yaw: number;
  readonly roll: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly scaleZ: number;
  readonly pivotY: number;
} {
  switch (state) {
    case "hardTurn":
      return pose(0.16, 0, -0.26, 1, 1, 1);
    case "turbo":
      return pose(0.3, 0, 0, 0.94, 1.06, 1.04);
    case "pass":
      return pose(0.14, 0.22, 0, 1, 1, 1);
    case "wristShot":
    case "chargeShot":
      return pose(0.22, -0.16, 0, 1.02, 1, 1);
    case "check":
      return pose(0.2, 0, 0.34, 1.08, 0.96, 1);
    case "stumble":
      return pose(0.34, 0, 0.42, 1, 0.92, 1);
    // Lying poses keep the old ice-level pivot: hinging the big roll at the
    // hips would leave the torso hovering at hip height instead of flat out.
    case "down":
      return pose(0, 0, Math.PI / 2, 1.1, 0.72, 1, 0);
    case "getUp":
      return pose(0, 0, 0.62, 1, 0.86, 1, 0);
    case "juke":
      return pose(0.14, -0.34, -0.16, 1, 1, 1);
    case "celebrate":
      return pose(0, 0, 0, 1.08, 1.12, 1.08);
    // Frozen solid: bolt upright and rigid inside the ice block.
    case "frozen":
      return pose(0, 0, 0, 1, 1, 1);
    case "skate":
      return pose(0.18, 0, 0, 1, 1, 1);
    case "idle":
    default:
      return pose(0.1, 0, 0, 1, 1, 1);
  }
}

function pose(
  pitch: number,
  yaw: number,
  roll: number,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  pivotY: number = HIP_PIVOT_Y
) {
  return { pitch, yaw, roll, scaleX, scaleY, scaleZ, pivotY };
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
