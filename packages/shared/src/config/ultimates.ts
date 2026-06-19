import { v } from '../sim/physics.js';
import type { SkaterState, WorldState } from '../sim/types.js';

export interface UltimateDef {
  id: string;
  name: string;
  description: string; // one-line "what it does" for the character-select screen
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
    description: 'Blazing speed burst for 4s — leave defenders in the dust.',
    durationMs: 4000,
    activate(w, s) {
      s.status.speedMult = 1.85;
      s.status.speedMultUntil = w.time + 4000;
    },
  },
  shockwave: {
    id: 'shockwave',
    name: 'Shockwave Check',
    description: 'Flatten every nearby opponent with a radial shockwave.',
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
    description: 'Your next shot on net is a guaranteed goal — wind up the howitzer.',
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
    description: 'Passes auto-find the best teammate and the whole line speeds up.',
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
    description: 'Pull the loose puck to your stick and strip nearby carriers for 3s.',
    durationMs: 3000,
    activate(w, s) {
      s.status.magnetUntil = w.time + 3000;
    },
  },
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive',
    description: 'Every attribute and your speed surge for 8s — no weaknesses.',
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
    description: 'Charge at double speed for 3s, flattening anyone you touch.',
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
    description: 'Turn intangible for 5s — skate clean through bodies.',
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
    description: 'Crank shot power for a relentless 5s of heavy artillery.',
    durationMs: 5000,
    activate(w, s) {
      s.status.shootPowerMult = 1.8;
      s.status.shootPowerUntil = w.time + 5000;
    },
  },
  deep_freeze: {
    id: 'deep_freeze',
    name: 'Deep Freeze',
    description: 'Freeze the two nearest opponents solid for 3s, then strike.',
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
