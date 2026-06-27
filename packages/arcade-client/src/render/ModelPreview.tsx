import { Canvas } from "@react-three/fiber";
import { CharacterModel } from "./CharacterModel.js";
import { GoalieModel } from "./GoalieModel.js";

export function ModelPreview(): JSX.Element {
  return (
    <section aria-label="Arcade character model preview">
      <Canvas
        camera={{
          position: [0, 150, 210],
          fov: 38,
          near: 0.1,
          far: 1000
        }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[100, 160, 120]} intensity={1.2} />
        <group position={[-46, 0, 0]}>
          <CharacterModel teamId="home" isLocal />
        </group>
        <group position={[52, 0, 0]}>
          <GoalieModel teamId="away" />
        </group>
      </Canvas>
    </section>
  );
}
