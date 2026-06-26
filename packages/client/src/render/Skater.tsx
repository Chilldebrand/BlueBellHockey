import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONTROLLER_RING_COLORS, UNIFORM_SCHEMES, getCharacter, type UniformSchemeId } from '@bbh/shared';
import { frameStore } from './frameStore.js';
import { CharacterModel } from './CharacterModel.js';
import { ModelBoundary } from './ModelBoundary.js';

const TEAM_TRIM = ['#1b3a8f', '#8f1b27'];

export function Skater({
  id,
  team,
  characterId,
  isLocal,
  controllerIndex,
  uniformId,
}: {
  id: string;
  team: number;
  characterId: string;
  isLocal: boolean;
  controllerIndex: number;
  uniformId: UniformSchemeId;
}) {
  const group = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const carrierRing = useRef<THREE.Mesh>(null);
  const windupRing = useRef<THREE.Mesh>(null);
  const aura = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const auraPhase = useRef(0);
  const prevFacing = useRef(0);
  const pitch = useRef(0);
  const roll = useRef(0);

  const char = safeChar(characterId);
  const uniform = UNIFORM_SCHEMES[uniformId] ?? UNIFORM_SCHEMES[team === 0 ? 'blue' : 'red'];
  const jersey = uniform.jersey;
  const trim = uniform.pants ?? TEAM_TRIM[team] ?? '#333';
  const ringColor = CONTROLLER_RING_COLORS[controllerIndex] ?? '#ffffff';
  const glb = char?.glb ?? 'models/chars/knight.glb';

  useFrame((_, dt) => {
    const s = frameStore.skater(id);
    if (!group.current || !s) return;
    group.current.position.x = s.x;
    group.current.position.z = s.z;
    group.current.rotation.y = -s.facing + Math.PI / 2;

    // Skating dynamics: lean forward with speed, bank into turns. Applied to the
    // model wrapper only so the ground rings stay flat on the ice.
    if (tilt.current) {
      tilt.current.position.y = s.downed ? -0.42 : 0;
      let turn = s.facing - prevFacing.current;
      if (turn > Math.PI) turn -= Math.PI * 2;
      else if (turn < -Math.PI) turn += Math.PI * 2;
      prevFacing.current = s.facing;
      const turnRate = dt > 0 ? turn / dt : 0;
      let targetPitch = THREE.MathUtils.clamp(s.speed * 0.018, 0, 0.22);
      let targetRoll = THREE.MathUtils.clamp(turnRate * 0.05, -0.3, 0.3);
      if (s.downed) {
        targetPitch = 1.18;
        targetRoll = 0.65;
      } else if (s.goalieSaving) {
        const side = s.goalieSaveSide || 1;
        if (s.goalieSaveType === 'pad') {
          targetPitch = 0.34;
          targetRoll += side * 0.42;
        } else if (s.goalieSaveType === 'glove') {
          targetPitch = -0.08;
          targetRoll += side * 0.55;
        } else {
          targetPitch = 0.12;
          targetRoll += side * 0.25;
        }
      }
      const k = 1 - Math.pow(0.0001, dt); // frame-rate-independent smoothing
      pitch.current += (targetPitch - pitch.current) * k;
      roll.current += (targetRoll - roll.current) * k;
      tilt.current.rotation.x = -pitch.current; // lean forward into travel (+Z local)
      tilt.current.rotation.z = roll.current; // bank around the forward axis
    }

    if (ring.current) {
      ring.current.visible = controllerIndex >= 0;
      const mat = ring.current.material as THREE.MeshBasicMaterial;
      mat.color.set(ringColor);
      mat.opacity = isLocal ? 0.95 : 0.72;
      const pulse = isLocal ? 1 + Math.sin(performance.now() * 0.008) * 0.06 : 1;
      ring.current.scale.setScalar(pulse);
    }
    if (carrierRing.current) carrierRing.current.visible = frameStore.carrier() === id;
    // Slap-shot wind-up telegraph: a ring that grows and brightens as the charge fills.
    if (windupRing.current) {
      const w = s.windup;
      windupRing.current.visible = w > 0;
      if (w > 0) {
        windupRing.current.scale.setScalar(0.6 + w * 0.9);
        const mat = windupRing.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.3 + w * 0.55;
        mat.color.setRGB(0.5 + w * 0.5, 0.77, 1); // blue -> white as it fills
      }
    }
    if (glow.current) glow.current.intensity = s.ultActive ? 9 : 0;
    if (aura.current) {
      aura.current.visible = s.ultActive;
      if (s.ultActive) {
        auraPhase.current += dt * 3;
        aura.current.rotation.z += dt * 3;
        aura.current.scale.setScalar(1 + Math.sin(auraPhase.current * 2) * 0.12);
      }
    }
  });

  return (
    <group ref={group}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} visible={false}>
        <ringGeometry args={[0.76, 1.03, 32]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={carrierRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} visible={false}>
        <ringGeometry args={[1.0, 1.16, 24]} />
        <meshBasicMaterial color={trim} transparent opacity={0.85} />
      </mesh>
      <mesh ref={windupRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]} visible={false}>
        <ringGeometry args={[0.5, 0.64, 24]} />
        <meshBasicMaterial color="#7fc4ff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={aura} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} visible={false}>
        <ringGeometry args={[1.1, 1.5, 6]} />
        <meshBasicMaterial color={jersey} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight ref={glow} color={jersey} intensity={0} distance={6} position={[0, 1.2, 0]} />

      <group ref={tilt}>
        <Suspense fallback={<ProceduralBody jersey={jersey} trim={trim} />}>
          <ModelBoundary fallback={<ProceduralBody jersey={jersey} trim={trim} />}>
            <CharacterModel id={id} glb={glb} team={team} visuals={char?.visuals} uniform={uniform} />
          </ModelBoundary>
        </Suspense>
      </group>
    </group>
  );
}

// Fallback cartoony body used while the GLB loads or if it fails to load.
function ProceduralBody({ jersey, trim }: { jersey: string; trim: string }) {
  return (
    <group position={[0, 0.9, 0]}>
      <mesh castShadow>
        <capsuleGeometry args={[0.42, 0.7, 6, 12]} />
        <meshStandardMaterial color={jersey} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.46, 0.46, 0.18, 12]} />
        <meshStandardMaterial color={trim} />
      </mesh>
      <mesh castShadow position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial color="#f1c79b" />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.34, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={trim} />
      </mesh>
    </group>
  );
}

function safeChar(id: string) {
  try {
    return getCharacter(id);
  } catch {
    return null;
  }
}
