import type { Snapshot } from '../net/client.js';

export const INTERP_DELAY_MS = 100;

export interface SkaterRender {
  id: string;
  team: number;
  characterId: string;
  x: number;
  z: number;
  facing: number;
  speed: number;
  ultActive: boolean;
  frozen: boolean;
  staggered: boolean;
  intangible: boolean;
}

export interface FrameRender {
  skaters: SkaterRender[];
  puck: { x: number; z: number; carrier: string };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Sample the snapshot buffer at (now - INTERP_DELAY) and lerp between brackets. */
export function sampleAt(buffer: Snapshot[], renderTime: number): FrameRender | null {
  if (buffer.length === 0) return null;
  if (buffer.length === 1) return frameFrom(buffer[0]);

  let a = buffer[0];
  let b = buffer[buffer.length - 1];
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i].t <= renderTime && buffer[i + 1].t >= renderTime) {
      a = buffer[i];
      b = buffer[i + 1];
      break;
    }
  }
  const span = b.t - a.t;
  const t = span > 0 ? Math.max(0, Math.min(1, (renderTime - a.t) / span)) : 0;

  const skaters: SkaterRender[] = [];
  for (const id of Object.keys(b.skaters)) {
    const sb = b.skaters[id];
    const sa = a.skaters[id] ?? sb;
    const now = b.serverTime;
    skaters.push({
      id,
      team: sb.team,
      characterId: sb.characterId,
      x: lerp(sa.px, sb.px, t),
      z: lerp(sa.pz, sb.pz, t),
      facing: lerpAngle(sa.facing, sb.facing, t),
      speed: Math.hypot(sb.vx, sb.vz),
      ultActive: sb.ultActiveUntil > now,
      frozen: sb.frozenUntil > now,
      staggered: sb.staggeredUntil > now,
      intangible: sb.intangibleUntil > now,
    });
  }
  return {
    skaters,
    puck: { x: lerp(a.puck.px, b.puck.px, t), z: lerp(a.puck.pz, b.puck.pz, t), carrier: b.puck.carrier },
  };
}

function frameFrom(s: Snapshot): FrameRender {
  const now = s.serverTime;
  return {
    skaters: Object.values(s.skaters).map((sk) => ({
      id: sk.id,
      team: sk.team,
      characterId: sk.characterId,
      x: sk.px,
      z: sk.pz,
      facing: sk.facing,
      speed: Math.hypot(sk.vx, sk.vz),
      ultActive: sk.ultActiveUntil > now,
      frozen: sk.frozenUntil > now,
      staggered: sk.staggeredUntil > now,
      intangible: sk.intangibleUntil > now,
    })),
    puck: { x: s.puck.px, z: s.puck.pz, carrier: s.puck.carrier },
  };
}
