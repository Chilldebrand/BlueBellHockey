import { useMemo } from 'react';
import * as THREE from 'three';
import { RINK } from '@bbh/shared';

function roundedRect(hl: number, hw: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-hl + r, -hw);
  s.lineTo(hl - r, -hw);
  s.quadraticCurveTo(hl, -hw, hl, -hw + r);
  s.lineTo(hl, hw - r);
  s.quadraticCurveTo(hl, hw, hl - r, hw);
  s.lineTo(-hl + r, hw);
  s.quadraticCurveTo(-hl, hw, -hl, hw - r);
  s.lineTo(-hl, -hw + r);
  s.quadraticCurveTo(-hl, -hw, -hl + r, -hw);
  return s;
}

function Line({ x, color, w = 0.4 }: { x: number; color: string; w?: number }) {
  return (
    <mesh position={[x, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, RINK.halfWidth * 2]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function FaceoffDot({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.6, 1.75, 32]} />
      <meshBasicMaterial color="#c0352f" />
    </mesh>
  );
}

function Goal({ team }: { team: 0 | 1 }) {
  const sign = team === 0 ? -1 : 1;
  const x = sign * RINK.goalLineX;
  const hw = RINK.goalWidth / 2;
  const h = RINK.goalHeight;
  const post = '#d33';
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, h / 2, hw]}>
        <boxGeometry args={[0.12, h, 0.12]} />
        <meshStandardMaterial color={post} />
      </mesh>
      <mesh position={[0, h / 2, -hw]}>
        <boxGeometry args={[0.12, h, 0.12]} />
        <meshStandardMaterial color={post} />
      </mesh>
      <mesh position={[0, h, 0]}>
        <boxGeometry args={[0.12, 0.12, hw * 2]} />
        <meshStandardMaterial color={post} />
      </mesh>
      {/* crease */}
      <mesh position={[-sign * 1, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, hw * 2]} />
        <meshBasicMaterial color="#9ccfff" transparent opacity={0.5} />
      </mesh>
      {/* netting backing */}
      <mesh position={[sign * 0.9, h / 2, 0]}>
        <boxGeometry args={[0.05, h, hw * 2]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

export function Rink() {
  const iceGeo = useMemo(
    () => new THREE.ShapeGeometry(roundedRect(RINK.halfLength, RINK.halfWidth, RINK.cornerRadius)),
    [],
  );
  const wallGeo = useMemo(() => {
    const outer = roundedRect(RINK.halfLength + 0.6, RINK.halfWidth + 0.6, RINK.cornerRadius);
    outer.holes.push(roundedRect(RINK.halfLength, RINK.halfWidth, RINK.cornerRadius));
    return new THREE.ExtrudeGeometry(outer, { depth: 1.1, bevelEnabled: false });
  }, []);

  return (
    <group>
      {/* ice */}
      <mesh geometry={iceGeo} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#eaf4ff" />
      </mesh>
      {/* boards */}
      <mesh geometry={wallGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#f4f4f4" side={THREE.DoubleSide} />
      </mesh>
      {/* markings */}
      <Line x={0} color="#c0352f" w={0.5} />
      <Line x={10} color="#2a5db0" />
      <Line x={-10} color="#2a5db0" />
      <FaceoffDot x={0} z={0} />
      <FaceoffDot x={18} z={RINK.faceoffZ} />
      <FaceoffDot x={18} z={-RINK.faceoffZ} />
      <FaceoffDot x={-18} z={RINK.faceoffZ} />
      <FaceoffDot x={-18} z={-RINK.faceoffZ} />
      <Goal team={0} />
      <Goal team={1} />
    </group>
  );
}
