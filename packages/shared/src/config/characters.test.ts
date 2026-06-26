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

  it('uses the approved fictional hockey archetype roster', () => {
    expect(CHARACTERS.map((c) => c.name)).toEqual([
      'Sniper',
      'Heavy Hitter',
      'Deke Artist',
      'Playmaker',
      'Lockdown Defender',
      'All-Around Star',
      'Power Forward',
      'Two-Way Pest',
      'Slap Shot Cannon',
      'Wild Card Defender',
    ]);
  });

  it('keeps presentation copy hockey-focused and non-fantasy', () => {
    const prohibited = /\b(knight|mage|rogue|druid|paladin|barbarian|ranger|freeze|shockwave|phase|spell|magic|cannon never misses)\b/i;
    for (const c of CHARACTERS) {
      expect(`${c.name} ${c.blurb}`).not.toMatch(prohibited);
    }
  });

  it('documents each archetype strengths, weaknesses, and visual hockey gear', () => {
    for (const c of CHARACTERS) {
      expect(c.archetype.strengths.length, `${c.name} strengths`).toBeGreaterThanOrEqual(1);
      expect(c.archetype.weaknesses.length, `${c.name} weaknesses`).toBeGreaterThanOrEqual(1);
      expect(c.visuals.silhouette, `${c.name} silhouette`).not.toHaveLength(0);
      expect(c.visuals.stickTape, `${c.name} stick tape`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.visuals.glove, `${c.name} glove`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.visuals.helmet, `${c.name} helmet`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.visuals.accessory, `${c.name} accessory`).not.toHaveLength(0);
    }
  });

  it('does not include a strictly better stat line than another archetype', () => {
    for (const a of CHARACTERS) {
      for (const b of CHARACTERS) {
        if (a.id === b.id) continue;
        const keys = Object.keys(a.attrs) as (keyof typeof a.attrs)[];
        const allAtLeast = keys.every((key) => a.attrs[key] >= b.attrs[key]);
        const oneBetter = keys.some((key) => a.attrs[key] > b.attrs[key]);
        expect(allAtLeast && oneBetter, `${a.name} strictly dominates ${b.name}`).toBe(false);
      }
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
