import { v } from '../sim/physics.js';
import type { SkaterState, WorldState } from '../sim/types.js';

export interface UltimateDef {
  id: string;
  name: string;
  durationMs: number; // how long ultActiveUntil lasts (0 = instant)
  activate(world: WorldState, self: SkaterState): void;
}

function teammates(world: WorldState, self: SkaterState): SkaterState[] {
  return Object.values(world.skaters).filter((s) => s.team === self.team && s.id !== self.id);
}
function opponents(world: WorldState, self: SkaterState): SkaterState[] {
  return Object.values(world.skaters).filter((s) => s.team !== self.team);
}

export const ULTIMATES: Record<string, UltimateDef> = {
  afterburner: {
    id: 'afterburner',
    name: 'Afterburner',
    durationMs: 4000,
    activate(w, s) {
      s.status.speedMult = 1.85;
      s.status.speedMultUntil = w.time + 4000;
    },
  },
  shockwave: {
    id: 'shockwave',
    name: 'Shockwave Check',
    durationMs: 0,
    activate(w, s) {
      for (const o of opponents(w, s)) {
        if (v.dist(o.pos, s.pos) < 7) {
          o.status.staggeredUntil = w.time + 1200;
          if (w.puck.carrier === o.id) w.puck.carrier = null;
        }
      }
    },
  },
  cannon: {
    id: 'cannon',
    name: 'Cannon',
    durationMs: 8000,
    activate(w, s) {
      s.status.guaranteedGoal = true;
      s.status.shootPowerMult = 1.6;
      s.status.shootPowerUntil = w.time + 8000;
    },
  },
  vision: {
    id: 'vision',
    name: 'Vision',
    durationMs: 6000,
    activate(w, s) {
      s.status.passPerfectUntil = w.time + 6000;
      for (const t of teammates(w, s)) {
        t.status.speedMult = 1.35;
        t.status.speedMultUntil = w.time + 6000;
      }
      s.status.speedMult = 1.35;
      s.status.speedMultUntil = w.time + 6000;
    },
  },
  magnet: {
    id: 'magnet',
    name: 'Magnet',
    durationMs: 3000,
    activate(w, s) {
      s.status.magnetUntil = w.time + 3000;
    },
  },
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive',
    durationMs: 8000,
    activate(w, s) {
      s.status.attrBonus = 2;
      s.status.attrBonusUntil = w.time + 8000;
      s.status.speedMult = 1.2;
      s.status.speedMultUntil = w.time + 8000;
    },
  },
  freight_train: {
    id: 'freight_train',
    name: 'Freight Train',
    durationMs: 3000,
    activate(w, s) {
      s.status.speedMult = 2.0;
      s.status.speedMultUntil = w.time + 3000;
      s.status.checkingUntil = w.time + 3000;
    },
  },
  phase: {
    id: 'phase',
    name: 'Phase',
    durationMs: 5000,
    activate(w, s) {
      s.status.intangibleUntil = w.time + 5000;
      s.status.speedMult = 1.25;
      s.status.speedMultUntil = w.time + 5000;
    },
  },
  barrage: {
    id: 'barrage',
    name: 'Barrage',
    durationMs: 5000,
    activate(w, s) {
      s.status.shootPowerMult = 1.8;
      s.status.shootPowerUntil = w.time + 5000;
    },
  },
  deep_freeze: {
    id: 'deep_freeze',
    name: 'Deep Freeze',
    durationMs: 3000,
    activate(w, s) {
      const sorted = opponents(w, s).sort(
        (a, b) => v.dist(a.pos, s.pos) - v.dist(b.pos, s.pos),
      );
      for (const o of sorted.slice(0, 2)) o.status.frozenUntil = w.time + 3000;
    },
  },
};

export function getUltimate(id: string): UltimateDef {
  const u = ULTIMATES[id];
  if (!u) throw new Error(`Unknown ultimate: ${id}`);
  return u;
}
