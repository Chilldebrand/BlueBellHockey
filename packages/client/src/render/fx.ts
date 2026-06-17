import * as THREE from 'three';

export interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; max: number;
  size: number;
  r: number; g: number; b: number;
  gravity: number;
  drag: number;
}

export interface SpawnOpts {
  count: number;
  speed: number; // base outward speed
  spread?: number; // velocity randomness
  up?: number; // extra upward bias
  size?: number;
  life?: number;
  color?: THREE.Color;
  gravity?: number;
  drag?: number;
}

const MAX = 700;

class ParticleSystem {
  readonly max = MAX;
  readonly pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < MAX; i++) {
      this.pool.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0, r: 1, g: 1, b: 1, gravity: 0, drag: 0 });
    }
  }

  private next(): Particle {
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    return p;
  }

  spawnOne(x: number, y: number, z: number, opts: Omit<SpawnOpts, 'count'>): void {
    const p = this.next();
    const spread = opts.spread ?? 1;
    const c = opts.color ?? new THREE.Color('#ffffff');
    const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * spread, Math.random() * 2 - 1).normalize();
    const sp = opts.speed * (0.5 + Math.random() * 0.5);
    p.x = x; p.y = y; p.z = z;
    p.vx = dir.x * sp;
    p.vy = dir.y * sp + (opts.up ?? 0);
    p.vz = dir.z * sp;
    p.max = p.life = opts.life ?? 0.6;
    p.size = opts.size ?? 0.15;
    p.r = c.r; p.g = c.g; p.b = c.b;
    p.gravity = opts.gravity ?? 9;
    p.drag = opts.drag ?? 1.5;
  }

  burst(x: number, y: number, z: number, opts: SpawnOpts): void {
    for (let i = 0; i < opts.count; i++) this.spawnOne(x, y, z, opts);
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.vy -= p.gravity * dt;
      const f = Math.max(0, 1 - p.drag * dt);
      p.vx *= f; p.vz *= f;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0) { p.y = 0; p.vy *= -0.3; }
    }
  }
}

export const particles = new ParticleSystem();

// --- camera shake -------------------------------------------------------------
class CameraShake {
  private trauma = 0;
  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }
  /** returns a decaying random offset vector and advances the decay */
  sample(dt: number, out: THREE.Vector3): THREE.Vector3 {
    const t = this.trauma * this.trauma;
    out.set(
      (Math.random() * 2 - 1) * t,
      (Math.random() * 2 - 1) * t * 0.6,
      (Math.random() * 2 - 1) * t,
    );
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    return out.multiplyScalar(2.5);
  }
}

export const cameraShake = new CameraShake();
