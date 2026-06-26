import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Html, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { useUi } from '../store.js';
import { net } from '../net/client.js';
import { getCharacter, RINK } from '@bbh/shared';
import { inputManager } from '../input/inputState.js';
import { sampleAt, INTERP_DELAY_MS } from '../game/interpolation.js';
import { predictLocal, applyPrediction, predictCarriedPuck, type PredictedPose } from '../game/prediction.js';
import { frameStore } from './frameStore.js';
import { goalReplay } from './replay.js';
import { sfx } from '../audio/sfx.js';
import { Skater } from './Skater.js';
import { Puck } from './Puck.js';
import { Rink } from './Rink.js';
import { Arena } from './Arena.js';
import { Vfx } from './Vfx.js';
import { Pickups } from './Pickups.js';

const SEND_INTERVAL = 1000 / 30;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const CAMERA_BASE_DISTANCE_X = 46;
const CAMERA_Y = 32;
const CAMERA_FOLLOW_X = 0.88;
const CAMERA_LOOKAHEAD_SECONDS = 0.28;
const CAMERA_MAX_LOOKAHEAD_X = 5;
const CAMERA_MAX_LOOK_X = RINK.goalLineX - 3;
const OFFSCREEN_NDC_X = 0.94;
const OFFSCREEN_NDC_Y = 0.9;
const OFFSCREEN_EDGE_PAD = 38;

// Crowd excitement from how close the puck is to a net (WO-11): 0 at center ice,
// ramping to 1 right on the goal line.
const DANGER_START = 18;
function puckDanger(px: number): number {
  return THREE.MathUtils.clamp((Math.abs(px) - DANGER_START) / (RINK.goalLineX - DANGER_START), 0, 1);
}

function Driver() {
  const { camera, pointer, raycaster } = useThree();
  const sendAccum = useRef(0);
  const predicted = useRef<PredictedPose | null>(null);
  const hit = useRef(new THREE.Vector3());
  const lastPuckX = useRef(0);
  const lookXRef = useRef(0);

  useFrame((_, dt) => {
    const ui = useUi.getState();
    const myId = ui.mySkaterId;

    // mouse aim: raycast pointer onto the ice
    if (myId) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(GROUND, hit.current)) {
        const me = frameStore.skater(myId);
        if (me) {
          const dx = hit.current.x - me.x;
          const dz = hit.current.z - me.z;
          if (Math.hypot(dx, dz) > 0.3) inputManager.mouseAim = { x: dx, z: dz };
        }
      }
    }

    const input = inputManager.gather({ hasPuck: !!myId && frameStore.carrier() === myId });

    // send input at a fixed rate
    sendAccum.current += dt * 1000;
    if (sendAccum.current >= SEND_INTERVAL && net.room) {
      sendAccum.current = 0;
      net.sendInput(input);
    }

    // Goal replay (WO-10): while a replay is playing, render the captured slow-mo
    // frames under a tight, low goal cam and skip live prediction + the broadcast
    // camera entirely.
    const replayFrame = goalReplay.sample();
    if (replayFrame) {
      frameStore.set(replayFrame);
      predicted.current = null; // drop stale prediction so we reconcile cleanly after
      const px = replayFrame.puck.x;
      sfx.setCrowdDanger(puckDanger(px));
      const camX = THREE.MathUtils.clamp(px * 0.5, -14, 14);
      camera.position.lerp(new THREE.Vector3(camX, 11, -22), Math.min(1, dt * 4));
      camera.lookAt(camX * 0.9, 1.1, 0);
      return;
    }

    // build render frame: interpolate everyone, predict the local skater
    const renderTime = performance.now() - INTERP_DELAY_MS;
    const frame = sampleAt(net.snapshots, renderTime);
    if (frame) {
      if (myId) {
        predicted.current = predictLocal(net.snapshots, myId, input, dt, predicted.current);
        applyPrediction(frame.skaters, myId, predicted.current);
        // local carrier: drive the puck off the predicted pose (deke included) so it
        // doesn't lag the controlled skater or snap mid-dangle.
        const puckPos = predictCarriedPuck(net.snapshots, myId, predicted.current);
        if (puckPos) {
          frame.puck.x = puckPos.x;
          frame.puck.z = puckPos.z;
          frame.puck.y = puckPos.y;
        }
      }
      frameStore.set(frame);
    }

    // Broadcast-style follow camera: track play vertically toward either goal,
    // add a small rush look-ahead, and keep side-to-side locked at center ice.
    const puck = frameStore.puck();
    sfx.setCrowdDanger(puckDanger(puck.x));
    const vx = dt > 0 ? (puck.x - lastPuckX.current) / dt : 0;
    lastPuckX.current = puck.x;
    const lookAheadX = THREE.MathUtils.clamp(
      vx * CAMERA_LOOKAHEAD_SECONDS,
      -CAMERA_MAX_LOOKAHEAD_X,
      CAMERA_MAX_LOOKAHEAD_X,
    );
    const targetLookX = THREE.MathUtils.clamp(
      puck.x * CAMERA_FOLLOW_X + lookAheadX,
      -CAMERA_MAX_LOOK_X,
      CAMERA_MAX_LOOK_X,
    );
    lookXRef.current = THREE.MathUtils.lerp(
      lookXRef.current,
      targetLookX,
      Math.min(1, dt * 2.8),
    );
    const lookX = lookXRef.current;
    camera.position.lerp(
      new THREE.Vector3(lookX - CAMERA_BASE_DISTANCE_X, CAMERA_Y, 0),
      Math.min(1, dt * 3.2),
    );
    camera.lookAt(lookX, 0, 0);
  });

  return null;
}

function LocalSkaterIndicator() {
  const { camera, size } = useThree();
  const marker = useRef<HTMLDivElement>(null);
  const arrow = useRef<HTMLDivElement>(null);
  const projected = useRef(new THREE.Vector3());

  useFrame(() => {
    const el = marker.current;
    const tri = arrow.current;
    if (!el || !tri) return;

    const ui = useUi.getState();
    const myId = ui.mySkaterId;
    const skater = myId ? frameStore.skater(myId) : undefined;
    if (!myId || !skater || size.width <= 0 || size.height <= 0) {
      el.style.display = 'none';
      return;
    }

    projected.current.set(skater.x, 1.1, skater.z).project(camera);
    const ndcX = projected.current.x;
    const ndcY = projected.current.y;
    const isVisible =
      projected.current.z >= -1 &&
      projected.current.z <= 1 &&
      Math.abs(ndcX) <= OFFSCREEN_NDC_X &&
      Math.abs(ndcY) <= OFFSCREEN_NDC_Y;

    if (isVisible) {
      el.style.display = 'none';
      return;
    }

    const px = (ndcX * 0.5 + 0.5) * size.width;
    const py = (-ndcY * 0.5 + 0.5) * size.height;
    const x = THREE.MathUtils.clamp(px, OFFSCREEN_EDGE_PAD, size.width - OFFSCREEN_EDGE_PAD);
    const y = THREE.MathUtils.clamp(py, OFFSCREEN_EDGE_PAD, size.height - OFFSCREEN_EDGE_PAD);
    const angle = Math.atan2(py - size.height / 2, px - size.width / 2);
    const roster = ui.roster.find((r) => r.id === myId);
    const color = roster ? safeCharacterColor(roster.characterId, roster.team) : '#ffd23c';

    el.style.display = 'block';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    tri.style.borderLeftColor = color;
    tri.style.filter = `drop-shadow(0 0 8px ${color}) drop-shadow(0 2px 4px rgba(0,0,0,0.75))`;
    tri.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
  });

  return (
    <Html fullscreen zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div
        ref={marker}
        style={{
          position: 'absolute',
          display: 'none',
          width: 32,
          height: 32,
          pointerEvents: 'none',
        }}
      >
        <div
          ref={arrow}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 0,
            height: 0,
            borderTop: '12px solid transparent',
            borderBottom: '12px solid transparent',
            borderLeft: '22px solid #ffd23c',
          }}
        />
      </div>
    </Html>
  );
}

// Graphics-quality tiers (WO-13). Each scales the expensive levers: device pixel
// ratio, shadows, IBL resolution, post-processing, and the ice's real-time
// reflection pass. Default 'high' preserves the original look; lower tiers are for
// weaker GPUs.
type Post = 'none' | 'lite' | 'full';
const QUALITY: Record<string, { dpr: [number, number]; shadows: boolean; shadowMap: number; env: number; post: Post; reflections: boolean }> = {
  low: { dpr: [0.75, 1], shadows: false, shadowMap: 512, env: 64, post: 'none', reflections: false },
  medium: { dpr: [1, 1.5], shadows: true, shadowMap: 1024, env: 128, post: 'lite', reflections: false },
  high: { dpr: [1, 2], shadows: true, shadowMap: 2048, env: 256, post: 'full', reflections: true },
};

export function Scene() {
  const roster = useUi((s) => s.roster);
  const myId = useUi((s) => s.mySkaterId);
  const homeUniform = useUi((s) => s.homeUniform);
  const awayUniform = useUi((s) => s.awayUniform);
  const quality = useUi((s) => s.quality);
  const q = QUALITY[quality] ?? QUALITY.high;

  useEffect(() => {
    inputManager.attach();
    return () => inputManager.detach();
  }, []);

  // Kick off a slow-mo instant replay on every goal (WO-10). Triggering off the
  // plain 'goal' event covers Gamebreakers too (they fire 'goal' first).
  useEffect(() => {
    const off = net.events.on('goal', (e: { team: number }) =>
      goalReplay.trigger(net.snapshots, e.team),
    );
    return () => {
      off();
      goalReplay.stop();
    };
  }, []);

  return (
    <Canvas
      key={quality}
      shadows={q.shadows}
      dpr={q.dpr}
      camera={{ position: [-CAMERA_BASE_DISTANCE_X, CAMERA_Y, 0], fov: 45 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
    >
      <color attach="background" args={['#0c121c']} />
      <fog attach="fog" args={['#0c121c', 70, 150]} />
      <hemisphereLight intensity={0.55} color="#ffffff" groundColor="#9fb2c8" />
      <directionalLight
        position={[10, 36, -10]}
        intensity={2.1}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={q.shadowMap}
        shadow-mapSize-height={q.shadowMap}
        shadow-bias={-0.0004}
        shadow-camera-left={-36}
        shadow-camera-right={36}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
      {/* soft fill from the opposite side so shadows aren't pitch black */}
      <directionalLight position={[-14, 20, 12]} intensity={0.5} color="#dce8ff" />

      {/* Network-free image-based lighting: an arena-style rig of emissive panels
          rendered only into the environment cubemap, giving the wet ice and the
          glossy models something bright to reflect. */}
      <Environment resolution={q.env} frames={1}>
        <color attach="background" args={['#0a0e16']} />
        {/* overhead rink banks */}
        <Lightformer intensity={1.4} color="#ffffff" position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[60, 24, 1]} />
        <Lightformer intensity={0.8} color="#dfeaff" position={[0, 10, -18]} rotation={[Math.PI / 3, 0, 0]} scale={[60, 10, 1]} />
        <Lightformer intensity={0.8} color="#dfeaff" position={[0, 10, 18]} rotation={[-Math.PI / 3, 0, 0]} scale={[60, 10, 1]} />
        {/* cool/warm side bounce for reflection color */}
        <Lightformer intensity={0.7} color="#9fc4ff" position={[-30, 6, 0]} rotation={[0, Math.PI / 2, 0]} scale={[40, 12, 1]} />
        <Lightformer intensity={0.7} color="#ffd9b0" position={[30, 6, 0]} rotation={[0, -Math.PI / 2, 0]} scale={[40, 12, 1]} />
      </Environment>

      <Arena />
      <Rink reflections={q.reflections} />
      <Pickups />
      <Puck />
      {roster.map((r) => (
        <Skater
          key={r.id}
          id={r.id}
          team={r.team}
          characterId={r.characterId}
          isLocal={r.id === myId}
          controllerIndex={r.controllerIndex}
          uniformId={r.team === 0 ? homeUniform : awayUniform}
        />
      ))}
      <Vfx />
      <Driver />
      <LocalSkaterIndicator />

      {/* Post-processing scales with quality (WO-13). 'low' drops the composer
          entirely (the Canvas's own ACES tone mapping then encodes output); 'lite'
          keeps tone mapping + vignette but no bloom; 'full' is the original stack.
          NOTE: whenever the composer IS present it must include a ToneMapping effect
          — it applies tone mapping AND the final sRGB encode, else the frame washes
          out to grey blacks. */}
      {q.post === 'full' && (
        <EffectComposer multisampling={4}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.9} luminanceSmoothing={0.12} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={0.25} darkness={0.7} />
        </EffectComposer>
      )}
      {q.post === 'lite' && (
        <EffectComposer multisampling={0}>
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette eskil={false} offset={0.25} darkness={0.7} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

function safeCharacterColor(characterId: string, team: number): string {
  try {
    return getCharacter(characterId).jersey;
  } catch {
    return team === 0 ? '#3c6bff' : '#ff5a3c';
  }
}
