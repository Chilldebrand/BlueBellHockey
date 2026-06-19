import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { useUi } from '../store.js';
import { net } from '../net/client.js';
import { inputManager } from '../input/inputState.js';
import { sampleAt, INTERP_DELAY_MS } from '../game/interpolation.js';
import { predictLocal, applyPrediction, predictCarriedPuck } from '../game/prediction.js';
import { frameStore } from './frameStore.js';
import { cameraShake, cameraPunch } from './fx.js';
import { goalReplay } from './replay.js';
import { Skater } from './Skater.js';
import { Puck } from './Puck.js';
import { Rink } from './Rink.js';
import { Arena } from './Arena.js';
import { Vfx } from './Vfx.js';

const SEND_INTERVAL = 1000 / 30;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const shakeOffset = new THREE.Vector3();

function Driver() {
  const { camera, pointer, raycaster } = useThree();
  const sendAccum = useRef(0);
  const predicted = useRef<{ x: number; z: number; facing: number } | null>(null);
  const hit = useRef(new THREE.Vector3());

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

    const input = inputManager.gather();

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
        }
      }
      frameStore.set(frame);
    }

    // broadcast camera: side view that drifts with the puck, punches in on big
    // moments (goals/ults), plus shake impulses.
    const px = frameStore.puck().x;
    const camX = THREE.MathUtils.clamp(px * 0.4, -12, 12);
    const k = cameraPunch.sample(dt) * 0.7; // blend amount toward the punched-in framing
    const L = THREE.MathUtils.lerp;
    const tx = L(camX, cameraPunch.fx * 0.65, k);
    const ty = L(24, 15, k);
    const tz = L(-36, -23, k);
    camera.position.lerp(new THREE.Vector3(tx, ty, tz), Math.min(1, dt * 3));
    cameraShake.sample(dt, shakeOffset);
    camera.position.add(shakeOffset);
    camera.lookAt(L(camX, cameraPunch.fx * 0.85, k), 0, L(2, cameraPunch.fz, k));
  });

  return null;
}

export function Scene() {
  const roster = useUi((s) => s.roster);
  const myId = useUi((s) => s.mySkaterId);

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
      shadows
      camera={{ position: [0, 24, -36], fov: 45 }}
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
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
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
      <Environment resolution={256} frames={1}>
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
      <Rink />
      <Puck />
      {roster.map((r) => (
        <Skater key={r.id} id={r.id} team={r.team} characterId={r.characterId} isLocal={r.id === myId} />
      ))}
      <Vfx />
      <Driver />

      {/* NOTE: the ToneMapping effect must be present — it applies tone mapping AND
          the final sRGB output encode. Without it the composer outputs unencoded
          linear color (washed-out, grey blacks). */}
      <EffectComposer multisampling={4}>
        <Bloom
          mipmapBlur
          intensity={0.85}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.12}
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette eskil={false} offset={0.25} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
