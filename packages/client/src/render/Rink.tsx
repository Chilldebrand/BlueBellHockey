import { useMemo } from 'react';
import * as THREE from 'three';
import { RINK } from '@bbh/shared';

// Street reskin (WO-05): same RINK dimensions / goal mouth / collision — only the
// materials, colors and decorative decals change (all flat at y≈0, no collision).

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
      <meshBasicMaterial color="#ff2fb0" />
    </mesh>
  );
}

// Flat graffiti splash — a filled neon circle, low opacity, sitting on the court.
function Splash({ x, z, r, color, opacity = 0.12 }: { x: number; z: number; r: number; color: string; opacity?: number }) {
  return (
    <mesh position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[r, 48]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

function NeonRing({ x, z, ri, ro, color }: { x: number; z: number; ri: number; ro: number; color: string }) {
  return (
    <mesh position={[x, 0.016, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[ri, ro, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
}

function EndZone({ team }: { team: 0 | 1 }) {
  const sign = team === 0 ? -1 : 1;
  const color = team === 0 ? '#3c6bff' : '#ff5a3c';
  return <Splash x={sign * 19} z={0} r={9} color={color} opacity={0.1} />;
}

function Goal({ team }: { team: 0 | 1 }) {
  const sign = team === 0 ? -1 : 1;
  const x = sign * RINK.goalLineX;
  const hw = RINK.goalWidth / 2;
  const h = RINK.goalHeight;
  const post = team === 0 ? '#3c6bff' : '#ff5a3c';
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, h / 2, hw]}>
        <boxGeometry args={[0.12, h, 0.12]} />
        <meshStandardMaterial color={post} emissive={post} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, h / 2, -hw]}>
        <boxGeometry args={[0.12, h, 0.12]} />
        <meshStandardMaterial color={post} emissive={post} emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0, h, 0]}>
        <boxGeometry args={[0.12, 0.12, hw * 2]} />
        <meshStandardMaterial color={post} emissive={post} emissiveIntensity={0.6} />
      </mesh>
      {/* crease */}
      <mesh position={[-sign * 1, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, hw * 2]} />
        <meshBasicMaterial color={post} transparent opacity={0.32} />
      </mesh>
      {/* netting backing */}
      <mesh position={[sign * 0.9, h / 2, 0]}>
        <boxGeometry args={[0.05, h, hw * 2]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.12} />
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
      {/* street court floor (dark, grungy) */}
      <mesh geometry={iceGeo} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#141a26" roughness={0.92} metalness={0.04} />
      </mesh>
      {/* neon boards */}
      <mesh geometry={wallGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color="#0a0f18"
          emissive="#1cd6ff"
          emissiveIntensity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* graffiti splashes (purely decorative) */}
      <EndZone team={0} />
      <EndZone team={1} />
      <Splash x={0} z={0} r={9} color="#ff2fb0" opacity={0.08} />
      <Splash x={0} z={0} r={5.4} color="#1cd6ff" opacity={0.09} />
      <Splash x={-12} z={-12} r={4} color="#27c93f" opacity={0.08} />
      <Splash x={13} z={12} r={4.5} color="#ffd23c" opacity={0.07} />

      {/* neon markings */}
      <Line x={0} color="#ff2fb0" w={0.5} />
      <Line x={10} color="#1cd6ff" />
      <Line x={-10} color="#1cd6ff" />
      <NeonRing x={0} z={0} ri={4.6} ro={4.9} color="#ff2fb0" />
      <FaceoffDot x={18} z={RINK.faceoffZ} />
      <FaceoffDot x={18} z={-RINK.faceoffZ} />
      <FaceoffDot x={-18} z={RINK.faceoffZ} />
      <FaceoffDot x={-18} z={-RINK.faceoffZ} />
      <Goal team={0} />
      <Goal team={1} />
    </group>
  );
}
