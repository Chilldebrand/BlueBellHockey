import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { CharacterModel } from './CharacterModel.js';
import { ModelBoundary } from './ModelBoundary.js';

// Character-select idle preview (WO-12): a small standalone canvas that renders the
// shown character's rigged model slowly turning on the spot. CharacterModel falls
// back to its idle clip when its id isn't in the live frame store, so passing a
// sentinel id gives us a clean idle loop with no match wiring.

function Turntable({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.6;
  });
  // offset down so the model's torso sits near the origin the camera looks at
  return (
    <group position={[0, -0.95, 0]}>
      <group ref={ref}>{children}</group>
    </group>
  );
}

function Fallback({ jersey }: { jersey: string }) {
  return (
    <group position={[0, 0.9, 0]}>
      <mesh>
        <capsuleGeometry args={[0.42, 0.7, 6, 12]} />
        <meshStandardMaterial color={jersey} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial color="#f1c79b" />
      </mesh>
    </group>
  );
}

export function CharacterPreview({
  glb,
  team,
  jersey,
}: {
  glb: string;
  team: number;
  jersey: string;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0.15, 3.3], fov: 40 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0a0e20']} />
      <hemisphereLight intensity={0.7} color="#ffffff" groundColor="#26304f" />
      <directionalLight position={[3, 6, 4]} intensity={2.2} color="#ffffff" />
      <directionalLight position={[-4, 3, -2]} intensity={0.6} color="#9fc4ff" />
      <Environment resolution={128} frames={1}>
        <Lightformer intensity={1.2} color="#ffffff" position={[0, 6, 2]} scale={[10, 10, 1]} />
        <Lightformer intensity={0.7} color="#bcd4ff" position={[-6, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 6, 1]} />
      </Environment>
      <Suspense fallback={<Fallback jersey={jersey} />}>
        <Turntable>
          <ModelBoundary fallback={<Fallback jersey={jersey} />}>
            {/* key by glb so switching characters cleanly swaps the rig */}
            <CharacterModel key={glb} id="__preview" glb={glb} team={team} />
          </ModelBoundary>
        </Turntable>
      </Suspense>
    </Canvas>
  );
}
