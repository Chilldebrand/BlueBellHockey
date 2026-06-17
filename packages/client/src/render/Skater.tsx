import { Suspense, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCharacter } from '@bbh/shared';
import { frameStore } from './frameStore.js';
import { CharacterModel } from './CharacterModel.js';
import { ModelBoundary } from './ModelBoundary.js';

const TEAM_TRIM = ['#1b3a8f', '#8f1b27'];
const TEAM_RING = ['#3c6bff', '#ff5a3c'];

export function Skater({
  id,
  team,
  characterId,
  isLocal,
}: {
  id: string;
  team: number;
  characterId: string;
  isLocal: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const carrierRing = useRef<THREE.Mesh>(null);
  const aura = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const auraPhase = useRef(0);

  const char = safeChar(characterId);
  const jersey = char?.jersey ?? '#cccccc';
  const trim = TEAM_TRIM[team] ?? '#333';
  const glb = char?.glb ?? 'models/chars/knight.glb';

  useFrame((_, dt) => {
    const s = frameStore.skater(id);
    if (!group.current || !s) return;
    group.current.position.x = s.x;
    group.current.position.z = s.z;
    group.current.rotation.y = -s.facing + Math.PI / 2;

    if (ring.current) ring.current.visible = isLocal;
    if (carrierRing.current) carrierRing.current.visible = frameStore.carrier() === id;
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
      {/* always-on team ring for readability */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[0.62, 0.78, 24]} />
        <meshBasicMaterial color={TEAM_RING[team] ?? '#888'} transparent opacity={0.55} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} visible={false}>
        <ringGeometry args={[0.8, 0.98, 24]} />
        <meshBasicMaterial color="#ffd23c" transparent opacity={0.9} />
      </mesh>
      <mesh ref={carrierRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} visible={false}>
        <ringGeometry args={[1.0, 1.16, 24]} />
        <meshBasicMaterial color={trim} transparent opacity={0.85} />
      </mesh>
      <mesh ref={aura} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} visible={false}>
        <ringGeometry args={[1.1, 1.5, 6]} />
        <meshBasicMaterial color={jersey} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight ref={glow} color={jersey} intensity={0} distance={6} position={[0, 1.2, 0]} />

      <Suspense fallback={<ProceduralBody jersey={jersey} trim={trim} />}>
        <ModelBoundary fallback={<ProceduralBody jersey={jersey} trim={trim} />}>
          <CharacterModel id={id} glb={glb} team={team} />
        </ModelBoundary>
      </Suspense>
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
