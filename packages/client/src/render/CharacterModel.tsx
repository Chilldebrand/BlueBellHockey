import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { CHARACTERS, type CharacterVisuals, type UniformScheme } from '@bbh/shared';
import { CLIPS, locoForSpeed, resolve, type LocoClip } from './clipMap.js';
import { frameStore } from './frameStore.js';
import { attachGear } from './gear.js';
import { net } from '../net/client.js';

// KayKit models face +Z; the parent group already yaws to point +Z along `facing`.
const MODEL_YAW = 0;
const MODEL_SCALE = 1.15;
const TEAM_EMISSIVE = ['#3c6bff', '#ff5a3c'];

// preload every distinct model up front
for (const glb of new Set(CHARACTERS.map((c) => c.glb))) useGLTF.preload('/' + glb);

export function CharacterModel({
  id,
  glb,
  team,
  visuals,
  uniform,
  isGoalie = false,
}: {
  id: string;
  glb: string;
  team: number;
  visuals?: CharacterVisuals;
  uniform?: UniformScheme;
  isGoalie?: boolean;
}) {
  const { scene, animations } = useGLTF('/' + glb);

  // per-instance skinned clone + tinted materials
  const model = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as THREE.Object3D;
    const emissive = new THREE.Color(uniform?.jersey ?? TEAM_EMISSIVE[team] ?? '#888');
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
    attachGear(clone, team, visuals, isGoalie);
    return clone;
  }, [scene, team, visuals, uniform, isGoalie]);

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
    const offShot = net.events.on('shot', (e: { shooter: string; charge?: number }) => {
      if (e.shooter !== id) return;
      const slap = (e.charge ?? 0) > 0.6; // a charged slapper gets the big 2H wind-up
      triggerable(slap ? CLIPS.slap : CLIPS.shoot, slap ? 600 : 450)();
    });
    const offHit = net.events.on('hit', (e: { by: string }) => {
      if (e.by === id) triggerable(CLIPS.hit, 550)();
    });
    const offPoke = net.events.on('poke', (e: { by: string }) => {
      if (e.by === id) triggerable(CLIPS.poke, 380)();
    });
    // celebrate when your team scores
    const offGoal = net.events.on('goal', (e: { team: number }) => {
      if (e.team === team) triggerable(CLIPS.cheer, 2200)();
    });
    return () => {
      offShot();
      offHit();
      offPoke();
      offGoal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, team, actions]);

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
