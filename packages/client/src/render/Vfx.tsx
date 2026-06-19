import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { attackingGoalX, getCharacter } from '@bbh/shared';
import { particles, cameraShake, cameraPunch } from './fx.js';
import { frameStore } from './frameStore.js';
import { net } from '../net/client.js';

const dummy = new THREE.Object3D();
const col = new THREE.Color();

function jerseyColor(characterId: string): THREE.Color {
  try {
    return new THREE.Color(getCharacter(characterId).jersey);
  } catch {
    return new THREE.Color('#ffffff');
  }
}

export function Vfx() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const lastPuck = useRef({ x: 0, z: 0 });
  const sprayAccum = useRef(0);

  const geom = useMemo(() => new THREE.SphereGeometry(0.5, 6, 6), []);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(() => {
    const offGoal = net.events.on('goal', (e: { team: number }) => {
      const gx = attackingGoalX((e.team as 0 | 1) ?? 0);
      particles.burst(gx, 1, 0, {
        count: 120,
        speed: 9,
        spread: 2.5,
        up: 4,
        size: 0.25,
        life: 1.1,
        color: new THREE.Color('#ffd23c'),
        gravity: 6,
      });
      cameraShake.add(0.6);
      cameraPunch.add(0.85, gx, 0);
    });
    const offGb = net.events.on('gamebreaker', (e: { team: number }) => {
      const gx = attackingGoalX((e.team as 0 | 1) ?? 0);
      particles.burst(gx, 1.2, 0, {
        count: 220,
        speed: 13,
        spread: 3,
        up: 6,
        size: 0.3,
        life: 1.4,
        color: new THREE.Color('#ffd23c'),
        gravity: 5,
      });
      cameraShake.add(1);
      cameraPunch.add(1, gx, 0);
    });
    const offHit = net.events.on('hit', (e: { target: string }) => {
      const t = frameStore.skater(e.target);
      if (!t) return;
      particles.burst(t.x, 0.9, t.z, {
        count: 28,
        speed: 6,
        spread: 1.5,
        up: 1.5,
        size: 0.18,
        life: 0.5,
        color: new THREE.Color('#ffffff'),
      });
      cameraShake.add(0.35);
    });
    const offAnkle = net.events.on('ankle_break', (e: { target: string }) => {
      const t = frameStore.skater(e.target);
      if (!t) return;
      particles.burst(t.x, 0.6, t.z, {
        count: 40,
        speed: 7,
        spread: 1.8,
        up: 2,
        size: 0.2,
        life: 0.6,
        color: new THREE.Color('#ffd23c'),
        gravity: 5,
      });
      cameraShake.add(0.4);
    });
    const offShot = net.events.on('shot', (e: { shooter: string; charge?: number }) => {
      if ((e.charge ?? 0) < 0.6) return; // only a charged slapper gets extra juice
      const s = frameStore.skater(e.shooter);
      if (!s) return;
      particles.burst(s.x, 0.5, s.z, {
        count: 20,
        speed: 5,
        spread: 1.3,
        up: 1,
        size: 0.16,
        life: 0.4,
        color: new THREE.Color('#cdebff'),
      });
      cameraShake.add(0.3);
    });
    const offDeke = net.events.on('deke', (e: { by: string }) => {
      const s = frameStore.skater(e.by);
      if (!s) return;
      particles.burst(s.x, 0.4, s.z, {
        count: 12,
        speed: 3,
        spread: 1,
        up: 0.6,
        size: 0.12,
        life: 0.35,
        color: new THREE.Color('#bfe2ff'),
        gravity: 2,
      });
    });
    const offUlt = net.events.on('ult', (e: { by: string }) => {
      const s = frameStore.skater(e.by);
      if (!s) return;
      particles.burst(s.x, 1, s.z, {
        count: 90,
        speed: 8,
        spread: 2,
        up: 3,
        size: 0.22,
        life: 0.9,
        color: jerseyColor(s.characterId),
        gravity: 4,
      });
      cameraShake.add(0.45);
      cameraPunch.add(0.6, s.x, s.z);
    });
    return () => {
      offGoal();
      offGb();
      offHit();
      offShot();
      offAnkle();
      offDeke();
      offUlt();
    };
  }, []);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;

    // continuous emitters: ice spray behind fast skaters
    sprayAccum.current += dt;
    if (sprayAccum.current > 0.03) {
      sprayAccum.current = 0;
      for (const id of rosterIds()) {
        const s = frameStore.skater(id);
        if (!s || s.speed < 6) continue;
        const bx = s.x - Math.cos(s.facing) * 0.5;
        const bz = s.z - Math.sin(s.facing) * 0.5;
        particles.spawnOne(bx, 0.08, bz, {
          speed: 1.2,
          spread: 0.6,
          up: 0.8,
          size: 0.12,
          life: 0.35,
          color: col.set('#dff1ff'),
          gravity: 3,
          drag: 3,
        });
      }
    }

    // puck trail / hard-shot streak: emission scales with puck speed, and on a
    // fast puck we fill the gap between frames so it reads as a continuous comet.
    const p = frameStore.puck();
    const dx = p.x - lastPuck.current.x;
    const dz = p.z - lastPuck.current.z;
    const pd = Math.hypot(dx, dz); // distance travelled this frame
    if (pd > 0.1) {
      const fast = pd > 0.35;
      const size = THREE.MathUtils.clamp(0.08 + pd * 0.22, 0.08, 0.24);
      const steps = fast ? Math.min(8, Math.ceil(pd / 0.22)) : 1;
      for (let i = 0; i < steps; i++) {
        const t = steps > 1 ? i / steps : 1;
        particles.spawnOne(lastPuck.current.x + dx * t, 0.12, lastPuck.current.z + dz * t, {
          speed: 0.15,
          spread: 0.15,
          size,
          life: fast ? 0.3 : 0.22,
          color: col.set(fast ? '#cdebff' : '#7fc4ff'),
          gravity: 0,
          drag: 2,
        });
      }
    }
    lastPuck.current = { x: p.x, z: p.z };

    particles.update(dt);

    // write instances
    for (let i = 0; i < particles.max; i++) {
      const pt = particles.pool[i];
      const t = pt.life > 0 ? pt.life / pt.max : 0;
      const scale = pt.size * t;
      dummy.position.set(pt.x, pt.y, pt.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, col.setRGB(pt.r * t, pt.g * t, pt.b * t));
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geom, mat, particles.max]} frustumCulled={false} />;
}

function rosterIds(): string[] {
  // ids are stable s0..s5,g0,g1 — read live from the frame store via a small probe
  return ['s0', 's1', 's2', 's3', 's4', 's5', 'g0', 'g1'];
}
