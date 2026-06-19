// Maps game state/actions to KayKit animation clip names (present in the GLBs:
// Idle, Walking_A, Running_A, Death_A, Hit_A, 1H_Melee_Attack_*, 2H_Melee_Attack_*, ...).
export const CLIPS = {
  idle: 'Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  stagger: 'Hit_A',
  shoot: '1H_Melee_Attack_Chop',
  slap: '2H_Melee_Attack_Chop', // bigger wind-up for a charged slap shot
  pass: '1H_Melee_Attack_Slice_Diagonal',
  hit: '2H_Melee_Attack_Chop',
  cheer: 'Cheer',
} as const;

export type LocoClip = 'idle' | 'walk' | 'run';

export function locoForSpeed(speed: number): LocoClip {
  if (speed > 7) return 'run';
  if (speed > 0.6) return 'walk';
  return 'idle';
}

/** First candidate that exists in the model's clip list, else a safe fallback. */
export function resolve(available: string[], name: string, fallback = 'Idle'): string {
  if (available.includes(name)) return name;
  return available.includes(fallback) ? fallback : (available[0] ?? name);
}
