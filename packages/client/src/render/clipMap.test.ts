import { describe, expect, it } from 'vitest';
import { CLIPS } from './clipMap.js';

describe('animation clip map', () => {
  it('has a poke-check one-shot clip distinct from the heavy hit', () => {
    expect(CLIPS.poke).toBeTruthy();
    expect(CLIPS.poke).not.toBe(CLIPS.hit);
  });
});
