export const CONTROLLER_RING_COLORS = [
  '#ff3030',
  '#2878ff',
  '#21d96b',
  '#ffd735',
  '#ff3bd4',
  '#26f0ff',
] as const;

export type UniformSchemeId = 'black' | 'red' | 'blue' | 'green' | 'yellow' | 'white';

export interface UniformScheme {
  id: UniformSchemeId;
  name: string;
  jersey: string;
  pants: string;
}

export const UNIFORM_SCHEMES: Record<UniformSchemeId, UniformScheme> = {
  black: { id: 'black', name: 'Black', jersey: '#151820', pants: '#05070c' },
  red: { id: 'red', name: 'Red', jersey: '#d93232', pants: '#671313' },
  blue: { id: 'blue', name: 'Blue', jersey: '#2868d8', pants: '#102b66' },
  green: { id: 'green', name: 'Green', jersey: '#1c9b55', pants: '#0b4627' },
  yellow: { id: 'yellow', name: 'Yellow', jersey: '#ffd735', pants: '#8a6810' },
  white: { id: 'white', name: 'White', jersey: '#f2f4f8', pants: '#9aa6b8' },
};

export function isUniformSchemeId(value: string): value is UniformSchemeId {
  return value in UNIFORM_SCHEMES;
}

export function normalizeUniformPair(
  home: string | undefined,
  away: string | undefined,
): { home: UniformSchemeId; away: UniformSchemeId } {
  const homeId = home && isUniformSchemeId(home) ? home : 'blue';
  let awayId: UniformSchemeId = away && isUniformSchemeId(away) ? away : 'red';
  if (awayId === homeId) awayId = homeId === 'white' ? 'black' : 'white';
  return { home: homeId, away: awayId };
}
