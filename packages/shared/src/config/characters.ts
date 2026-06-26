import type { AttributeSet } from '../sim/types.js';

export interface CharacterVisuals {
  silhouette: string;
  stickTape: string;
  glove: string;
  helmet: string;
  accessory: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  attrs: AttributeSet; // each 1..10, sum === 38
  ultimateId: string;
  glb: string; // path under client public/, e.g. "models/chars/knight.glb"
  jersey: string; // hex tint applied to the model
  blurb: string;
  archetype: {
    strengths: string[];
    weaknesses: string[];
  };
  visuals: CharacterVisuals;
}

// Every attribute set sums to 38 and every {speed,hit,steal,shoot,pass}
// multiset is unique. Tune freely, but keep the sum === 38 invariant
// (validated by characters.test.ts). The existing ids stay stable for saved
// selections and tests; the player-facing identity is the hockey archetype.
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'blaze',
    name: 'Sniper',
    attrs: { speed: 8, hit: 5, steal: 6, shoot: 10, pass: 9 },
    ultimateId: 'afterburner',
    glb: 'models/chars/ranger.glb',
    jersey: '#ff5a3c',
    blurb: 'Elite quick-release scorer with sharp lanes and lighter contact play.',
    archetype: {
      strengths: ['quick release', 'accuracy'],
      weaknesses: ['board battles', 'body contact'],
    },
    visuals: {
      silhouette: 'low shooter stance with taped blade and narrow visor',
      stickTape: '#f8f2d8',
      glove: '#20242c',
      helmet: '#111820',
      accessory: 'white blade tape',
    },
  },
  {
    id: 'tank',
    name: 'Heavy Hitter',
    attrs: { speed: 6, hit: 10, steal: 7, shoot: 8, pass: 7 },
    ultimateId: 'shockwave',
    glb: 'models/chars/knight.glb',
    jersey: '#3c6bff',
    blurb: 'Contact-first bruiser who wins collisions and jars pucks loose.',
    archetype: {
      strengths: ['checking power', 'balance resistance'],
      weaknesses: ['top speed', 'east-west agility'],
    },
    visuals: {
      silhouette: 'wide shoulders with dark gloves and reinforced helmet',
      stickTape: '#1f2933',
      glove: '#371818',
      helmet: '#191b20',
      accessory: 'heavy shoulder pads',
    },
  },
  {
    id: 'sniper',
    name: 'Deke Artist',
    attrs: { speed: 10, hit: 4, steal: 9, shoot: 7, pass: 8 },
    ultimateId: 'cannon',
    glb: 'models/chars/rogue.glb',
    jersey: '#27c93f',
    blurb: 'Fast puck-control specialist built for cuts, slips, and loose-puck steals.',
    archetype: {
      strengths: ['edge speed', 'puck control'],
      weaknesses: ['contact resistance', 'heavy shot power'],
    },
    visuals: {
      silhouette: 'slim skater with bright tape and compact gloves',
      stickTape: '#40f5ff',
      glove: '#0f3b35',
      helmet: '#10251f',
      accessory: 'flashy stick tape',
    },
  },
  {
    id: 'maestro',
    name: 'Playmaker',
    attrs: { speed: 8, hit: 5, steal: 7, shoot: 8, pass: 10 },
    ultimateId: 'vision',
    glb: 'models/chars/mage.glb',
    jersey: '#b347ff',
    blurb: 'Lane-creation specialist who turns small seams into clean chances.',
    archetype: {
      strengths: ['passing lanes', 'team setup'],
      weaknesses: ['net-front strength', 'solo checking'],
    },
    visuals: {
      silhouette: 'upright distributor with clean visor and light stick tape',
      stickTape: '#ffffff',
      glove: '#2d1e44',
      helmet: '#1b1526',
      accessory: 'clear visor',
    },
  },
  {
    id: 'pickpocket',
    name: 'Lockdown Defender',
    attrs: { speed: 7, hit: 10, steal: 10, shoot: 4, pass: 7 },
    ultimateId: 'magnet',
    glb: 'models/chars/druid.glb',
    jersey: '#ffd23c',
    blurb: 'Reach, positioning, blocks, and stick pressure before the shot arrives.',
    archetype: {
      strengths: ['poke checks', 'shot lanes'],
      weaknesses: ['finishing touch', 'breakaway pace'],
    },
    visuals: {
      silhouette: 'long-reach defender with dark cage and squared shoulders',
      stickTape: '#ffd735',
      glove: '#2f2b18',
      helmet: '#171717',
      accessory: 'defensive cage',
    },
  },
  {
    id: 'allrounder',
    name: 'All-Around Star',
    attrs: { speed: 8, hit: 8, steal: 8, shoot: 7, pass: 7 },
    ultimateId: 'overdrive',
    glb: 'models/chars/paladin.glb',
    jersey: '#19c4c4',
    blurb: 'Balanced captain type who can fill any lane without an extreme peak.',
    archetype: {
      strengths: ['balanced shifts', 'reliable support'],
      weaknesses: ['no elite specialty', 'predictable matchup profile'],
    },
    visuals: {
      silhouette: 'classic captain look with clean helmet and balanced pads',
      stickTape: '#d7fbff',
      glove: '#183235',
      helmet: '#102527',
      accessory: 'captain-style chest mark',
    },
  },
  {
    id: 'freight',
    name: 'Power Forward',
    attrs: { speed: 7, hit: 10, steal: 5, shoot: 9, pass: 7 },
    ultimateId: 'freight_train',
    glb: 'models/chars/barbarian.glb',
    jersey: '#ff8c19',
    blurb: 'Net-crasher with body strength, crease pressure, and a heavy release.',
    archetype: {
      strengths: ['net-front strength', 'heavy shot'],
      weaknesses: ['stick steals', 'quick resets'],
    },
    visuals: {
      silhouette: 'big net-front frame with reinforced gloves and black tape',
      stickTape: '#111111',
      glove: '#4b250c',
      helmet: '#20140c',
      accessory: 'net-front shoulder bulk',
    },
  },
  {
    id: 'trickster',
    name: 'Two-Way Pest',
    attrs: { speed: 9, hit: 7, steal: 9, shoot: 6, pass: 7 },
    ultimateId: 'phase',
    glb: 'models/chars/rogue.glb',
    jersey: '#8c8cff',
    blurb: 'Annoying forechecker who pressures exits, steals pucks, and scores ugly.',
    archetype: {
      strengths: ['forecheck pressure', 'disruption'],
      weaknesses: ['clean shooting', 'set plays'],
    },
    visuals: {
      silhouette: 'busy forechecker with mismatched tape and low gloves',
      stickTape: '#ff3bd4',
      glove: '#22234d',
      helmet: '#15162f',
      accessory: 'chirpy visor tint',
    },
  },
  {
    id: 'powerfwd',
    name: 'Slap Shot Cannon',
    attrs: { speed: 5, hit: 9, steal: 5, shoot: 10, pass: 9 },
    ultimateId: 'barrage',
    glb: 'models/chars/knight.glb',
    jersey: '#c41e3a',
    blurb: 'Big windup specialist with a booming shot and higher miss danger.',
    archetype: {
      strengths: ['slap-shot power', 'point shots'],
      weaknesses: ['windup time', 'defensive steals'],
    },
    visuals: {
      silhouette: 'point shooter with long stick tape and squared stance',
      stickTape: '#ffef8a',
      glove: '#3a1018',
      helmet: '#220910',
      accessory: 'extended stick knob',
    },
  },
  {
    id: 'frost',
    name: 'Wild Card Defender',
    attrs: { speed: 8, hit: 9, steal: 8, shoot: 6, pass: 7 },
    ultimateId: 'deep_freeze',
    glb: 'models/chars/mage.glb',
    jersey: '#6fd3ff',
    blurb: 'Chaotic high-effort defender who blocks, bumps, and breaks plays loose.',
    archetype: {
      strengths: ['scramble blocks', 'loose-puck disruption'],
      weaknesses: ['shot selection', 'structured passing'],
    },
    visuals: {
      silhouette: 'awkward shot-blocker with extra padding and bright helmet',
      stickTape: '#26f0ff',
      glove: '#193642',
      helmet: '#083142',
      accessory: 'extra shin padding',
    },
  },
];

export const ATTRIBUTE_POINTS = 38;

const byId = new Map(CHARACTERS.map((c) => [c.id, c]));
export function getCharacter(id: string): CharacterDef {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown character: ${id}`);
  return c;
}
