import type { FrameRender, SkaterRender } from '../game/interpolation.js';

// Mutable per-frame pose store, written once per render frame by the Driver and
// read by each Skater's useFrame. Keeps React out of the 60fps update path.
let skaters = new Map<string, SkaterRender>();
let puck = { x: 0, z: 0 };

export const frameStore = {
  set(f: FrameRender): void {
    const m = new Map<string, SkaterRender>();
    for (const s of f.skaters) m.set(s.id, s);
    skaters = m;
    puck = f.puck;
  },
  skater(id: string): SkaterRender | undefined {
    return skaters.get(id);
  },
  puck(): { x: number; z: number } {
    return puck;
  },
};
