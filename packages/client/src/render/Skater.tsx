import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getCharacter } from '@bbh/shared';
import { frameStore } from './frameStore.js';

const TEAM_TRIM = ['#1b3a8f', '#8f1b27'];

// Cartoony procedural skater: rounded body + head + stick, tinted by jersey.
// Reads its live pose from frameStore each frame (no React re-render per frame).
// Drop-in GLB support lives in clipMap.ts for later.
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
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const carrierRing = useRef<THREE.Mesh>(null);
  const aura = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  const char = safeChar(characterId);
  const jersey = char?.jersey ?? '#cccccc';
  const trim = TEAM_TRIM[team] ?? '#333';

  useFrame((_, dt) => {
    const s = frameStore.skater(id);
    if (!group.current || !s) return;
    group.current.position.x = s.x;
    group.current.position.z = s.z;
    group.current.rotation.y = -s.facing + Math.PI / 2;

    phase.current += dt * (4 + s.speed);
    if (body.current) {
      const lean = Math.min(0.35, s.speed * 0.03);
      body.current.rotation.x = (s.staggered ? 1.2 : lean) + Math.sin(phase.current) * 0.04;
      body.current.position.y = s.staggered ? 0.4 : 0.9 + Math.abs(Math.sin(phase.current)) * 0.05;
    }
    if (ring.current) ring.current.visible = isLocal;
    if (carrierRing.current) carrierRing.current.visible = frameStore.carrier() === id;
    if (glow.current) glow.current.intensity = s.ultActive ? 9 : 0;
    if (aura.current) {
      aura.current.visible = s.ultActive;
      if (s.ultActive) {
        aura.current.rotation.z += dt * 3;
        const pulse = 1 + Math.sin(phase.current * 2) * 0.12;
        aura.current.scale.setScalar(pulse);
      }
    }
  });

  return (
    <group ref={group}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} visible={false}>
        <ringGeometry args={[0.7, 0.9, 24]} />
        <meshBasicMaterial color="#ffd23c" transparent opacity={0.9} />
      </mesh>
      <mesh ref={carrierRing} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} visible={false}>
        <ringGeometry args={[0.92, 1.08, 24]} />
        <meshBasicMaterial color={trim} transparent opacity={0.85} />
      </mesh>
      <mesh ref={aura} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} visible={false}>
        <ringGeometry args={[1.1, 1.45, 6]} />
        <meshBasicMaterial color={jersey} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <pointLight ref={glow} color={jersey} intensity={0} distance={6} position={[0, 1.2, 0]} />
      <group ref={body}>
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
        <group position={[0.35, -0.3, 0.5]} rotation={[0, 0, -0.5]}>
          <mesh>
            <boxGeometry args={[0.06, 1.1, 0.06]} />
            <meshStandardMaterial color="#caa46a" />
          </mesh>
          <mesh position={[0, -0.55, 0.18]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.07, 0.06, 0.45]} />
            <meshStandardMaterial color="#3a2c1a" />
          </mesh>
        </group>
      </group>
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
