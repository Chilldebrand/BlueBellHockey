import type { AttributeSet } from '../sim/types.js';

export interface CharacterDef {
  id: string;
  name: string;
  attrs: AttributeSet; // each 1..10, sum === 38
  ultimateId: string;
  glb: string; // path under client public/, e.g. "models/chars/knight.glb"
  jersey: string; // hex tint applied to the model
  blurb: string;
}

// Every attribute set sums to 38 and every {speed,hit,steal,shoot,pass}
// multiset is unique. Tune freely, but keep the sum === 38 invariant
// (validated by characters.test.ts).
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'blaze',
    name: 'Blaze',
    attrs: { speed: 10, hit: 5, steal: 7, shoot: 8, pass: 8 },
    ultimateId: 'afterburner',
    glb: 'models/chars/ranger.glb',
    jersey: '#ff5a3c',
    blurb: 'Pure speed. Burns past defenders before they react.',
  },
  {
    id: 'tank',
    name: 'Tank',
    attrs: { speed: 7, hit: 10, steal: 8, shoot: 7, pass: 6 },
    ultimateId: 'shockwave',
    glb: 'models/chars/knight.glb',
    jersey: '#3c6bff',
    blurb: 'Immovable enforcer who levels the zone with a shockwave check.',
  },
  {
    id: 'sniper',
    name: 'Sniper',
    attrs: { speed: 8, hit: 6, steal: 6, shoot: 10, pass: 8 },
    ultimateId: 'cannon',
    glb: 'models/chars/rogue.glb',
    jersey: '#27c93f',
    blurb: 'Deadeye shooter. The cannon never misses the net.',
  },
  {
    id: 'maestro',
    name: 'Maestro',
    attrs: { speed: 9, hit: 5, steal: 7, shoot: 7, pass: 10 },
    ultimateId: 'vision',
    glb: 'models/chars/mage.glb',
    jersey: '#b347ff',
    blurb: 'Playmaker. Sees lanes nobody else can and feeds the team.',
  },
  {
    id: 'pickpocket',
    name: 'Pickpocket',
    attrs: { speed: 8, hit: 6, steal: 10, shoot: 5, pass: 9 },
    ultimateId: 'magnet',
    glb: 'models/chars/druid.glb',
    jersey: '#ffd23c',
    blurb: 'Lifts the puck off your stick before you knew it was gone.',
  },
  {
    id: 'allrounder',
    name: 'Allrounder',
    attrs: { speed: 8, hit: 8, steal: 8, shoot: 6, pass: 8 },
    ultimateId: 'overdrive',
    glb: 'models/chars/paladin.glb',
    jersey: '#19c4c4',
    blurb: 'No weaknesses. Overdrive pushes every stat over the top.',
  },
  {
    id: 'freight',
    name: 'Freight',
    attrs: { speed: 9, hit: 9, steal: 6, shoot: 7, pass: 7 },
    ultimateId: 'freight_train',
    glb: 'models/chars/barbarian.glb',
    jersey: '#ff8c19',
    blurb: 'A runaway train — charges the lane and flattens everything.',
  },
  {
    id: 'trickster',
    name: 'Trickster',
    attrs: { speed: 8, hit: 6, steal: 9, shoot: 6, pass: 9 },
    ultimateId: 'phase',
    glb: 'models/chars/rogue.glb',
    jersey: '#8c8cff',
    blurb: 'Slips through bodies and threads passes nobody can touch.',
  },
  {
    id: 'powerfwd',
    name: 'Power Forward',
    attrs: { speed: 6, hit: 10, steal: 6, shoot: 9, pass: 7 },
    ultimateId: 'barrage',
    glb: 'models/chars/knight.glb',
    jersey: '#c41e3a',
    blurb: 'Crashes the net and unloads a barrage of heavy shots.',
  },
  {
    id: 'frost',
    name: 'Frost',
    attrs: { speed: 9, hit: 7, steal: 5, shoot: 9, pass: 8 },
    ultimateId: 'deep_freeze',
    glb: 'models/chars/mage.glb',
    jersey: '#6fd3ff',
    blurb: 'Freezes defenders solid, then rips it home.',
  },
];

export const ATTRIBUTE_POINTS = 38;

const byId = new Map(CHARACTERS.map((c) => [c.id, c]));
export function getCharacter(id: string): CharacterDef {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown character: ${id}`);
  return c;
}
