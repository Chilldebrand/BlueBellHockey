import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { attachGear } from './gear.js';

function rig(): THREE.Group {
  const root = new THREE.Group();
  for (const name of ['hand.l', 'hand.r', 'lowerleg.l', 'lowerleg.r', 'head', 'spine']) {
    const bone = new THREE.Group();
    bone.name = name;
    root.add(bone);
  }
  return root;
}

function names(root: THREE.Object3D): string[] {
  const out: string[] = [];
  root.traverse((o) => {
    if (o.name) out.push(o.name);
  });
  return out;
}

describe('goalie gear', () => {
  it('attaches goalie-specific pads, gloves, chest bulk, mask, and goalie stick only for goalies', () => {
    const skater = rig();
    attachGear(skater, 0, undefined, false);
    expect(names(skater).some((name) => name.startsWith('goalie-'))).toBe(false);

    const goalie = rig();
    attachGear(goalie, 0, undefined, true);
    const goalieNames = names(goalie);

    expect(goalieNames).toContain('goalie-stick');
    expect(goalieNames).toContain('goalie-leg-pad-l');
    expect(goalieNames).toContain('goalie-leg-pad-r');
    expect(goalieNames).toContain('goalie-blocker');
    expect(goalieNames).toContain('goalie-catcher');
    expect(goalieNames).toContain('goalie-chest');
    expect(goalieNames).toContain('goalie-mask');
  });
});
