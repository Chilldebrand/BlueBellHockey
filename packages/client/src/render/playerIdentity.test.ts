import { describe, expect, it } from 'vitest';
import {
  CONTROLLER_RING_COLORS,
  UNIFORM_SCHEMES,
  normalizeUniformPair,
} from '@bbh/shared';

describe('player identity presentation', () => {
  it('uses fixed human join-order ring colors for players one through six', () => {
    expect(CONTROLLER_RING_COLORS).toEqual([
      '#ff3030',
      '#2878ff',
      '#21d96b',
      '#ffd735',
      '#ff3bd4',
      '#26f0ff',
    ]);
  });

  it('offers the basic uniform schemes and prevents indistinguishable matchups', () => {
    expect(Object.keys(UNIFORM_SCHEMES)).toEqual(['black', 'red', 'blue', 'green', 'yellow', 'white']);

    expect(normalizeUniformPair('red', 'red')).toEqual({ home: 'red', away: 'white' });
    expect(normalizeUniformPair('blue', 'red')).toEqual({ home: 'blue', away: 'red' });
  });
});
