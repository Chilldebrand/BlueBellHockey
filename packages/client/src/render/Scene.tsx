import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useUi } from '../store.js';
import { net } from '../net/client.js';
import { inputManager } from '../input/inputState.js';
import { sampleAt, INTERP_DELAY_MS } from '../game/interpolation.js';
import { predictLocal, applyPrediction, predictCarriedPuck } from '../game/prediction.js';
import { frameStore } from './frameStore.js';
import { cameraShake } from './fx.js';
import { Skater } from './Skater.js';
import { Puck } from './Puck.js';
import { Rink } from './Rink.js';
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

    // broadcast camera: side view that drifts with the puck, plus shake impulses
    const px = frameStore.puck().x;
    const camX = THREE.MathUtils.clamp(px * 0.4, -12, 12);
    camera.position.lerp(new THREE.Vector3(camX, 24, -36), Math.min(1, dt * 3));
    cameraShake.sample(dt, shakeOffset);
    camera.position.add(shakeOffset);
    camera.lookAt(camX, 0, 2);
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

  return (
    <Canvas shadows camera={{ position: [0, 24, -36], fov: 45 }}>
      <color attach="background" args={['#0c121c']} />
      <fog attach="fog" args={['#0c121c', 70, 150]} />
      <hemisphereLight intensity={1.0} color="#ffffff" groundColor="#9fb2c8" />
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
      <Rink />
      <Puck />
      {roster.map((r) => (
        <Skater key={r.id} id={r.id} team={r.team} characterId={r.characterId} isLocal={r.id === myId} />
      ))}
      <Vfx />
      <Driver />
    </Canvas>
  );
}
