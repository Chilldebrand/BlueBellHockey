import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { frameStore } from './frameStore.js';

export function Puck() {
  const group = useRef<THREE.Group>(null);
  const last = useRef({ x: 0, z: 0 });
  const spin = useRef(0);

  useFrame((_, dt) => {
    const p = frameStore.puck();
    const g = group.current;
    if (!g) return;
    g.position.x = p.x;
    g.position.y = 0.12 + p.y;
    g.position.z = p.z;

    // spin about the vertical axis, scaled by glide speed; eased off while carried
    const speed = dt > 0 ? Math.hypot(p.x - last.current.x, p.z - last.current.z) / dt : 0;
    last.current = { x: p.x, z: p.z };
    const carried = frameStore.carrier() !== '';
    const rate = Math.min((carried ? 0.5 : 1.5) * speed, 22); // rad/s, capped to avoid strobe
    spin.current += rate * dt;
    g.rotation.y = spin.current;
  });

  return (
    <group ref={group} position={[0, 0.12, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.12, 20]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.55} />
      </mesh>
      {/* top markings so the spin reads from the broadcast camera */}
      <mesh position={[0, 0.061, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.135, 20]} />
        <meshBasicMaterial color="#3a3a3a" />
      </mesh>
      <mesh position={[0, 0.062, 0]}>
        <boxGeometry args={[0.27, 0.006, 0.035]} />
        <meshBasicMaterial color="#9aa3ad" />
      </mesh>
    </group>
  );
}
