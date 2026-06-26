import { SLAP_FULL_MS } from '@bbh/shared';
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
  downed: boolean;
  intangible: boolean;
  windup: number; // slap-shot charge 0..1 (0 = not winding up)
  goalieSaving: boolean;
  goalieSaveType: 'none' | 'pad' | 'body' | 'glove' | 'blocker' | 'cover';
  goalieSaveSide: -1 | 0 | 1;
}

function windupOf(shootChargeStart: number, now: number): number {
  if (shootChargeStart <= 0) return 0;
  return Math.max(0, Math.min(1, (now - shootChargeStart) / SLAP_FULL_MS));
}

export interface FrameRender {
  skaters: SkaterRender[];
  puck: { x: number; z: number; y: number; carrier: string };
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

/** Build an interpolated render frame from a bracket (a..b) at fraction t. */
function buildFrame(a: Snapshot, b: Snapshot, t: number): FrameRender {
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
      downed: sb.downedUntil > now,
      intangible: sb.intangibleUntil > now,
      windup: windupOf(sb.shootChargeStart, now),
      goalieSaving: sb.goalieSaveUntil > now,
      goalieSaveType: sb.goalieSaveType,
      goalieSaveSide: sb.goalieSaveSide,
    });
  }
  return {
    skaters,
    puck: {
      x: lerp(a.puck.px, b.puck.px, t),
      z: lerp(a.puck.pz, b.puck.pz, t),
      y: lerp(a.puck.py, b.puck.py, t),
      carrier: b.puck.carrier,
    },
  };
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
  return buildFrame(a, b, t);
}

/**
 * Sample a buffer by *server* time rather than client-receive time (WO-10). The
 * goal replay plays back a captured slice of snapshots on its own slowed clock, so
 * it needs to bracket by the authoritative timestamps it captured.
 */
export function sampleAtServer(buffer: Snapshot[], serverTime: number): FrameRender | null {
  if (buffer.length === 0) return null;
  if (buffer.length === 1) return frameFrom(buffer[0]);

  let a = buffer[0];
  let b = buffer[buffer.length - 1];
  for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i].serverTime <= serverTime && buffer[i + 1].serverTime >= serverTime) {
      a = buffer[i];
      b = buffer[i + 1];
      break;
    }
  }
  const span = b.serverTime - a.serverTime;
  const t = span > 0 ? Math.max(0, Math.min(1, (serverTime - a.serverTime) / span)) : 0;
  return buildFrame(a, b, t);
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
      downed: sk.downedUntil > now,
      intangible: sk.intangibleUntil > now,
      windup: windupOf(sk.shootChargeStart, now),
      goalieSaving: sk.goalieSaveUntil > now,
      goalieSaveType: sk.goalieSaveType,
      goalieSaveSide: sk.goalieSaveSide,
    })),
    puck: { x: s.puck.px, z: s.puck.pz, y: s.puck.py, carrier: s.puck.carrier },
  };
}
