import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { RINK } from '@bbh/shared';
import { net } from '../net/client.js';

// Ice-hockey rink. Same RINK dimensions / goal mouth / collision (all gameplay is
// server-side) — this only draws the sheet: polished white ice, standard NHL
// markings, white boards with glass, and red goals. Everything decorative is flat
// at y≈0 (markings) or non-colliding (boards/glass/goals).

const RED = '#c8202b';
const BLUE = '#1f4fb5';
// Soft blue-white ice. Kept clearly below pure white so the lit sheet doesn't
// clip into the bloom threshold (only emissive things — lamps/auras — should glow).
const ICE = '#aec6dd';

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

// Painted blue goalie crease: a half-circle in front of each goal mouth, plus a
// stronger outline so it reads through the glossy ice.
function GoalieCrease({ team }: { team: 0 | 1 }) {
  const sign = team === 0 ? -1 : 1;
  const x = sign * RINK.goalLineX;
  const thetaStart = team === 0 ? -Math.PI / 2 : Math.PI / 2;
  const radius = RINK.goalWidth / 2 + 0.9;
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.024, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 48, thetaStart, Math.PI]} />
        <meshBasicMaterial color="#7fc4ff" transparent opacity={0.24} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.08, radius + 0.08, 48, 1, thetaStart, Math.PI]} />
        <meshBasicMaterial color={BLUE} transparent opacity={0.78} side={THREE.DoubleSide} />
      </mesh>
      <Line x={0} color={BLUE} w={0.12} len={radius * 2} />
    </group>
  );
}

// An enclosed hockey net. `sign` points outward (away from center): the mouth is
// the open face at local x=0, the twine/back wall sits at local x = sign*depth.
// This matches the sim's net collision (WO-18) so what you see is what stops the
// puck — a shot rattles in, and you can't score from behind.
function Goal({ team }: { team: 0 | 1 }) {
  const sign = team === 0 ? -1 : 1;
  const x = sign * RINK.goalLineX;
  const hw = RINK.goalWidth / 2;
  const h = RINK.goalHeight;
  const depth = RINK.goalDepth;
  const back = sign * depth; // local x of the back of the net
  const bh = h * 0.8; // the back of the cage sits a little lower than the mouth
  const bar = 0.12; // frame thickness
  const frame = <meshStandardMaterial color={RED} roughness={0.5} />;
  const twine = (
    <meshStandardMaterial color="#eef2f6" roughness={0.9} transparent opacity={0.16} side={THREE.DoubleSide} />
  );
  return (
    <group position={[x, 0, 0]}>
      {/* mouth uprights + crossbar */}
      <mesh position={[0, h / 2, hw]} castShadow>
        <boxGeometry args={[bar, h, bar]} />
        {frame}
      </mesh>
      <mesh position={[0, h / 2, -hw]} castShadow>
        <boxGeometry args={[bar, h, bar]} />
        {frame}
      </mesh>
      <mesh position={[0, h, 0]} castShadow>
        <boxGeometry args={[bar, bar, hw * 2]} />
        {frame}
      </mesh>
      {/* rear uprights + crossbar */}
      <mesh position={[back, bh / 2, hw]} castShadow>
        <boxGeometry args={[bar, bh, bar]} />
        {frame}
      </mesh>
      <mesh position={[back, bh / 2, -hw]} castShadow>
        <boxGeometry args={[bar, bh, bar]} />
        {frame}
      </mesh>
      <mesh position={[back, bh, 0]} castShadow>
        <boxGeometry args={[bar, bar, hw * 2]} />
        {frame}
      </mesh>
      {/* top rails mouth -> back, and base rails on the ice */}
      <mesh position={[back / 2, h, hw]}>
        <boxGeometry args={[depth, bar, bar]} />
        {frame}
      </mesh>
      <mesh position={[back / 2, h, -hw]}>
        <boxGeometry args={[depth, bar, bar]} />
        {frame}
      </mesh>
      <mesh position={[back / 2, bar / 2, hw]}>
        <boxGeometry args={[depth, bar, bar]} />
        {frame}
      </mesh>
      <mesh position={[back / 2, bar / 2, -hw]}>
        <boxGeometry args={[depth, bar, bar]} />
        {frame}
      </mesh>
      {/* twine: back panel, two side panels, and a sloped top */}
      <mesh position={[back, bh / 2, 0]}>
        <boxGeometry args={[0.04, bh, hw * 2]} />
        {twine}
      </mesh>
      <mesh position={[back / 2, bh / 2, hw]}>
        <boxGeometry args={[depth, bh, 0.04]} />
        {twine}
      </mesh>
      <mesh position={[back / 2, bh / 2, -hw]}>
        <boxGeometry args={[depth, bh, 0.04]} />
        {twine}
      </mesh>
      <mesh position={[back / 2, (h + bh) / 2, 0]}>
        <boxGeometry args={[depth, 0.04, hw * 2]} />
        {twine}
      </mesh>
    </group>
  );
}

// Red goal lamp behind each net. Flashes and pulses when the team that scores
// INTO this net lights it up (goal / gamebreaker). Bright emissive + point light
// so it blooms through the post-processing pass.
function GoalLamp({ x, litByTeam }: { x: number; litByTeam: 0 | 1 }) {
  const light = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.Mesh>(null);
  const flash = useRef(0);

  useEffect(() => {
    const trigger = (e: { team: number }) => {
      if (e.team === litByTeam) flash.current = 1;
    };
    const offGoal = net.events.on('goal', trigger);
    const offGb = net.events.on('gamebreaker', trigger);
    return () => {
      offGoal();
      offGb();
    };
  }, [litByTeam]);

  useFrame((_, dt) => {
    if (flash.current > 0) flash.current = Math.max(0, flash.current - dt * 0.45); // ~2.2s
    const strobe = flash.current > 0 ? (0.5 + 0.5 * Math.sin(performance.now() * 0.025)) * flash.current : 0;
    if (light.current) light.current.intensity = strobe * 45;
    if (bulb.current) (bulb.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.15 + strobe * 5;
  });

  return (
    <group position={[x, 3.4, 0]}>
      <mesh ref={bulb}>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshStandardMaterial color="#ff3030" emissive="#ff0000" emissiveIntensity={0.15} roughness={0.4} />
      </mesh>
      {/* little housing cage */}
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.26, 0.4, 0.3, 12, 1, true]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={light} color="#ff2222" intensity={0} distance={34} decay={2} />
    </group>
  );
}

export function Rink({ reflections = true }: { reflections?: boolean }) {
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
      {/* polished wet ice — real-time reflections (high quality) or a plain glossy
          sheet (lower quality, skipping the per-frame reflection pass) (WO-13) */}
      <mesh geometry={iceGeo} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        {reflections ? (
          <MeshReflectorMaterial
            color={ICE}
            resolution={1024}
            mixBlur={1.4}
            mixStrength={0.7}
            blur={[400, 150]}
            mirror={0.25}
            roughness={0.65}
            metalness={0.1}
            depthScale={0}
            minDepthThreshold={0.9}
            maxDepthThreshold={1}
          />
        ) : (
          <meshStandardMaterial color={ICE} roughness={0.5} metalness={0.1} />
        )}
      </mesh>
      {/* white boards */}
      <mesh geometry={boardGeo} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d8e0ea" roughness={0.7} side={THREE.DoubleSide} />
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

      <GoalieCrease team={0} />
      <GoalieCrease team={1} />
      <Goal team={0} />
      <Goal team={1} />

      {/* goal lamps behind each net (team that scores into a net lights it) */}
      <GoalLamp x={RINK.goalLineX + RINK.goalDepth + 0.4} litByTeam={0} />
      <GoalLamp x={-(RINK.goalLineX + RINK.goalDepth + 0.4)} litByTeam={1} />
    </group>
  );
}
