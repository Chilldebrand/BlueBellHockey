import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { CHARACTERS } from '@bbh/shared';
import { CLIPS, locoForSpeed, resolve, type LocoClip } from './clipMap.js';
import { frameStore } from './frameStore.js';
import { net } from '../net/client.js';

// KayKit models face +Z; the parent group already yaws to point +Z along `facing`.
const MODEL_YAW = 0;
const MODEL_SCALE = 1.15;
const TEAM_EMISSIVE = ['#3c6bff', '#ff5a3c'];

// Hockey stick mounts on the KayKit `handslot.r` weapon bone (falls back to hand.r).
// These transforms are in the bone's local space — tune if the stick sits oddly.
const STICK_BONE = ['handslot.r', 'hand.r'];
const STICK_POS = new THREE.Vector3(0, 0, 0);
const STICK_ROT = new THREE.Euler(Math.PI * 0.15, 0, Math.PI * 0.08);
const STICK_SCALE = 1;

// preload every distinct model up front
for (const glb of new Set(CHARACTERS.map((c) => c.glb))) useGLTF.preload('/' + glb);

/** Build a hockey stick: shaft hanging down from the grip, blade at the bottom. */
function buildStick(): THREE.Group {
  const stick = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({ color: '#caa46a' });
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#2a2118' });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 8), shaftMat);
  shaft.position.y = -0.5; // grip near origin, shaft extends down
  shaft.castShadow = true;
  stick.add(shaft);

  // toe of the blade kicks forward (+Z) at the bottom of the shaft
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.3), bladeMat);
  blade.position.set(0, -1.0, 0.13);
  blade.rotation.x = 0.35;
  blade.castShadow = true;
  stick.add(blade);

  stick.position.copy(STICK_POS);
  stick.rotation.copy(STICK_ROT);
  stick.scale.setScalar(STICK_SCALE);
  return stick;
}

function attachStick(root: THREE.Object3D): void {
  let bone: THREE.Object3D | undefined;
  for (const name of STICK_BONE) {
    bone = root.getObjectByName(name);
    if (bone) break;
  }
  (bone ?? root).add(buildStick());
}

export function CharacterModel({ id, glb, team }: { id: string; glb: string; team: number }) {
  const { scene, animations } = useGLTF('/' + glb);

  // per-instance skinned clone + tinted materials
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as THREE.Object3D;
    const emissive = new THREE.Color(TEAM_EMISSIVE[team] ?? '#888');
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      const src = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      const tint = (m: THREE.MeshStandardMaterial) => {
        const c = m.clone();
        c.emissive = emissive;
        c.emissiveIntensity = 0.22;
        return c;
      };
      mesh.material = Array.isArray(src) ? src.map(tint) : tint(src);
    });
    attachStick(clone);
    return clone;
  }, [scene, team]);

  const clipNames = useMemo(() => animations.map((a) => a.name), [animations]);
  const mixer = useMemo(() => new THREE.AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const map: Record<string, THREE.AnimationAction> = {};
    for (const c of animations) map[c.name] = mixer.clipAction(c);
    return map;
  }, [animations, mixer]);

  const current = useRef<string>('');
  const oneShotUntil = useRef(0);

  const play = (name: string, opts: { once?: boolean; fade?: number } = {}) => {
    const resolved = resolve(clipNames, name);
    if (resolved === current.current) return;
    const next = actions[resolved];
    if (!next) return;
    const prev = actions[current.current];
    const fade = opts.fade ?? 0.18;
    next.reset();
    next.setLoop(opts.once ? THREE.LoopOnce : THREE.LoopRepeat, opts.once ? 1 : Infinity);
    next.clampWhenFinished = !!opts.once;
    next.fadeIn(fade).play();
    prev?.fadeOut(fade);
    current.current = resolved;
  };

  // trigger one-shot action animations from broadcast events for this skater
  useEffect(() => {
    const triggerable = (clip: string, dur: number) => () => {
      play(clip, { once: true, fade: 0.08 });
      oneShotUntil.current = performance.now() + dur;
    };
    const offShot = net.events.on('shot', (e: { shooter: string }) => {
      if (e.shooter === id) triggerable(CLIPS.shoot, 450)();
    });
    const offHit = net.events.on('hit', (e: { by: string }) => {
      if (e.by === id) triggerable(CLIPS.hit, 550)();
    });
    return () => {
      offShot();
      offHit();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, actions]);

  // start in idle
  useEffect(() => {
    play(CLIPS.idle);
    return () => {
      mixer.stopAllAction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixer]);

  useFrame((_, dt) => {
    mixer.update(dt);
    const s = frameStore.skater(id);
    if (!s) return;
    if (s.staggered) {
      play(CLIPS.stagger);
    } else if (performance.now() < oneShotUntil.current) {
      // let the one-shot play out
    } else {
      const loco: LocoClip = locoForSpeed(s.speed);
      play(CLIPS[loco]);
    }
  });

  return <primitive object={model} scale={MODEL_SCALE} rotation={[0, MODEL_YAW, 0]} dispose={null} />;
}
