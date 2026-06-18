import { useMemo } from 'react';
import * as THREE from 'three';
import { RINK } from '@bbh/shared';

// Ice-hockey rink. Same RINK dimensions / goal mouth / collision (all gameplay is
// server-side) — this only draws the sheet: polished white ice, standard NHL
// markings, white boards with glass, and red goals. Everything decorative is flat
// at y≈0 (markings) or non-colliding (boards/glass/goals).

const RED = '#c8202b';
const BLUE = '#1f4fb5';
const ICE = '#e9f2fb';

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

// A painted line running across the width of the rink at goal-to-goal position x.
function Line({ x, color, w = 0.4, len = RINK.halfWidth * 2 }: { x: number; color: string; w?: number; len?: number }) {
  return (
    <mesh position={[x, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w, len]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

// Faceoff circle: painted ring + filled center spot.
function Faceoff({ x, z, color, radius = 3 }: { x: number; z: number; color: string; radius?: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius, radius + 0.12, 48]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.021, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// Small neutral-zone faceoff spot.
function Spot({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <mesh position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.45, 32]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

function Goal({ team }: { team: 0 | 1 }) {
  const sign = team === 0 ? -1 : 1;
  const x = sign * RINK.goalLineX;
  const hw = RINK.goalWidth / 2;
  const h = RINK.goalHeight;
  return (
    <group position={[x, 0, 0]}>
      {/* red posts + crossbar */}
      <mesh position={[0, h / 2, hw]} castShadow>
        <boxGeometry args={[0.12, h, 0.12]} />
        <meshStandardMaterial color={RED} roughness={0.5} />
      </mesh>
      <mesh position={[0, h / 2, -hw]} castShadow>
        <boxGeometry args={[0.12, h, 0.12]} />
        <meshStandardMaterial color={RED} roughness={0.5} />
      </mesh>
      <mesh position={[0, h, 0]} castShadow>
        <boxGeometry args={[0.12, 0.12, hw * 2]} />
        <meshStandardMaterial color={RED} roughness={0.5} />
      </mesh>
      {/* blue crease in front of the mouth */}
      <mesh position={[-sign * 1, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, hw * 2]} />
        <meshBasicMaterial color={BLUE} transparent opacity={0.22} />
      </mesh>
      {/* white netting backing */}
      <mesh position={[sign * 0.9, h / 2, 0]}>
        <boxGeometry args={[0.05, h, hw * 2]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

export function Rink() {
  const iceGeo = useMemo(
    () => new THREE.ShapeGeometry(roundedRect(RINK.halfLength, RINK.halfWidth, RINK.cornerRadius)),
    [],
  );
  const boardGeo = useMemo(() => {
    const outer = roundedRect(RINK.halfLength + 0.6, RINK.halfWidth + 0.6, RINK.cornerRadius);
    outer.holes.push(roundedRect(RINK.halfLength, RINK.halfWidth, RINK.cornerRadius));
    return new THREE.ExtrudeGeometry(outer, { depth: 1.0, bevelEnabled: false });
  }, []);
  const glassGeo = useMemo(() => {
    const outer = roundedRect(RINK.halfLength + 0.75, RINK.halfWidth + 0.75, RINK.cornerRadius);
    outer.holes.push(roundedRect(RINK.halfLength + 0.6, RINK.halfWidth + 0.6, RINK.cornerRadius));
    return new THREE.ExtrudeGeometry(outer, { depth: 2.4, bevelEnabled: false });
  }, []);

  return (
    <group>
      {/* polished white ice */}
      <mesh geometry={iceGeo} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color={ICE} roughness={0.16} metalness={0.05} />
      </mesh>
      {/* white boards */}
      <mesh geometry={boardGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f3f6fb" roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* translucent glass above the boards */}
      <mesh geometry={glassGeo} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial
          color="#cfe6f5"
          transparent
          opacity={0.12}
          roughness={0.05}
          metalness={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* lines: red center + red goal lines, two blue lines */}
      <Line x={0} color={RED} w={0.5} />
      <Line x={10} color={BLUE} w={0.45} />
      <Line x={-10} color={BLUE} w={0.45} />
      <Line x={RINK.goalLineX} color={RED} w={0.12} />
      <Line x={-RINK.goalLineX} color={RED} w={0.12} />

      {/* faceoffs: blue center circle, four red end-zone circles, neutral spots */}
      <Faceoff x={0} z={0} color={BLUE} radius={4.6} />
      <Faceoff x={18} z={RINK.faceoffZ} color={RED} />
      <Faceoff x={18} z={-RINK.faceoffZ} color={RED} />
      <Faceoff x={-18} z={RINK.faceoffZ} color={RED} />
      <Faceoff x={-18} z={-RINK.faceoffZ} color={RED} />
      <Spot x={6.5} z={RINK.faceoffZ} color={RED} />
      <Spot x={6.5} z={-RINK.faceoffZ} color={RED} />
      <Spot x={-6.5} z={RINK.faceoffZ} color={RED} />
      <Spot x={-6.5} z={-RINK.faceoffZ} color={RED} />

      <Goal team={0} />
      <Goal team={1} />
    </group>
  );
}
