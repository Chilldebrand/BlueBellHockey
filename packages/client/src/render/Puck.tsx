import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { frameStore } from './frameStore.js';

export function Puck() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const p = frameStore.puck();
    if (ref.current) {
      ref.current.position.x = p.x;
      ref.current.position.z = p.z;
    }
  });
  return (
    <mesh ref={ref} castShadow position={[0, 0.12, 0]}>
      <cylinderGeometry args={[0.18, 0.18, 0.12, 20]} />
      <meshStandardMaterial color="#0a0a0a" />
    </mesh>
  );
}
