// KayKit-style animation clip names with fallbacks, for when GLB models are
// dropped into public/models/chars/. Used by a future GltfSkater; the procedural
// skater ignores it.
export const CLIP_CANDIDATES = {
  idle: ['Idle', 'idle'],
  walk: ['Walking_A', 'Walk', 'walk'],
  run: ['Running_A', 'Run', 'run'],
  attack: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', 'Attack'],
  death: ['Death_A', 'Death'],
} as const;

export type ClipKey = keyof typeof CLIP_CANDIDATES;

export function resolveClip(available: string[], key: ClipKey): string | null {
  for (const name of CLIP_CANDIDATES[key]) {
    if (available.includes(name)) return name;
  }
  return available[0] ?? null;
}

export function clipKeyForSpeed(speed: number, staggered: boolean): ClipKey {
  if (staggered) return 'death';
  if (speed > 7) return 'run';
  if (speed > 0.6) return 'walk';
  return 'idle';
}
