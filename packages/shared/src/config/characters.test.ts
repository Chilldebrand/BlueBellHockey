import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_POINTS, CHARACTERS } from './characters.js';
import { ULTIMATES } from './ultimates.js';

describe('characters', () => {
  it('has 10 characters', () => {
    expect(CHARACTERS).toHaveLength(10);
  });

  it('each attribute set sums to 38 with values in 1..10', () => {
    for (const c of CHARACTERS) {
      const vals = Object.values(c.attrs);
      const sum = vals.reduce((a, b) => a + b, 0);
      expect(sum, `${c.name} sum`).toBe(ATTRIBUTE_POINTS);
      for (const x of vals) {
        expect(x).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThanOrEqual(10);
      }
    }
  });

  it('every attribute distribution is unique', () => {
    const seen = new Set<string>();
    for (const c of CHARACTERS) {
      const key = [...Object.values(c.attrs)].sort((a, b) => a - b).join(',');
      expect(seen.has(key), `${c.name} duplicate distribution`).toBe(false);
      seen.add(key);
    }
  });

  it('references a valid, unique-per-character ultimate', () => {
    for (const c of CHARACTERS) {
      expect(ULTIMATES[c.ultimateId], `${c.name} ultimate`).toBeDefined();
    }
    const ults = CHARACTERS.map((c) => c.ultimateId);
    expect(new Set(ults).size).toBe(CHARACTERS.length);
  });
});
