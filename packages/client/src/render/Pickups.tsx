import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUi } from '../store.js';

// Ice pickups (WO-16): render the synced tokens as glowing, bobbing, spinning
// orbs on the rink — green for a speed boost, gold for instant ult charge. The
// emissive color is tuned bright so it catches the bloom pass.
const COLORS: Record<string, string> = { boost: '#27ff7a', charge: '#ffd23c' };

export function Pickups() {
  const pickups = useUi((s) => s.pickups);
  return (
    <>
      {pickups.map((p) => (
        <Token key={p.id} x={p.px} z={p.pz} color={COLORS[p.kind] ?? '#ffffff'} />
      ))}
    </>
  );
}

function Token({ x, z, color }: { x: number; z: number; color: string }) {
  const group = useRef<THREE.Group>(null);
  const t0 = useRef(Math.random() * Math.PI * 2); // desync the bob between tokens
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime + t0.current;
    group.current.position.y = 0.7 + Math.sin(t * 2.2) * 0.18;
    group.current.rotation.y = t * 1.6;
  });
  return (
    <group ref={group} position={[x, 0.7, z]}>
      <mesh castShadow>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} roughness={0.3} metalness={0.2} />
      </mesh>
      {/* a faint ground ring marking the spot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.68, 0]}>
        <ringGeometry args={[0.5, 0.66, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <pointLight color={color} intensity={3} distance={4} />
    </group>
  );
}
