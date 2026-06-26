import * as THREE from 'three';
import type { CharacterVisuals } from '@bbh/shared';

// Procedural hockey gear bolted onto the rigged KayKit mascots: a stick on the
// right hand, team-colored gloves on both hands, and team socks/shin pads on the
// lower legs. All attach to skeleton bones so they follow the animation.
//
// Bone-name note: GLTFLoader strips the dot from names ("hand.r" -> "handr"), so
// findBone() matches by a normalized name. The lower-leg bone's local +Y points
// down the limb (verified), so a default-oriented cylinder aligns with the leg.

const TEAM_GEAR = ['#2a5cff', '#ff4a2a'];
const DEFAULT_VISUALS: CharacterVisuals = {
  silhouette: 'standard hockey skater',
  stickTape: '#f2f4f8',
  glove: '#2a2f3a',
  helmet: '#161a22',
  accessory: 'plain visor',
};

const normName = (s: string) => s.replace(/[._\s]/g, '').toLowerCase();
export function findBone(root: THREE.Object3D, names: string[]): THREE.Object3D | undefined {
  const want = names.map(normName);
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!found && want.includes(normName(o.name))) found = o;
  });
  return found;
}

// --- stick -------------------------------------------------------------------
const STICK_BONE = ['handslot.r', 'hand.r'];
// The hand bone's local -Y points up in world, so STICK_ROT flips the shaft down
// (~Math.PI) and tilts it forward so the blade rests on the ice ahead of the skater.
const STICK_ROT = new THREE.Euler(Math.PI - 0.5, 0, 0);

export function buildStick(visuals: CharacterVisuals = DEFAULT_VISUALS): THREE.Group {
  const stick = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({ color: '#caa46a' });
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#2a2118' });
  const tapeMat = new THREE.MeshStandardMaterial({ color: visuals.stickTape, roughness: 0.8 });

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 8), shaftMat);
  shaft.position.y = -0.5; // grip near origin, shaft extends down
  shaft.castShadow = true;
  stick.add(shaft);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.3), bladeMat);
  blade.position.set(0, -1.0, 0.13);
  blade.rotation.x = 0.35;
  blade.castShadow = true;
  stick.add(blade);

  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.076, 0.18), tapeMat);
  tape.position.set(0, -1.0, 0.2);
  tape.rotation.x = 0.35;
  tape.castShadow = true;
  stick.add(tape);

  stick.rotation.copy(STICK_ROT);
  return stick;
}

export function attachStick(root: THREE.Object3D, visuals: CharacterVisuals = DEFAULT_VISUALS): void {
  const bone = findBone(root, STICK_BONE);
  (bone ?? root).add(buildStick(visuals));
}

// --- gloves ------------------------------------------------------------------
/** Chunky blocky hockey glove cuff. Roughly isotropic so bone orientation is fine. */
export function buildGlove(team: number, visuals: CharacterVisuals = DEFAULT_VISUALS): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: visuals.glove || TEAM_GEAR[team] || '#888', roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.7 });
  const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), mat);
  cuff.castShadow = true;
  g.add(cuff);
  // knuckle strip + a dark backhand band for definition
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 0.05), dark);
  strip.position.set(0, 0.06, 0.07);
  g.add(strip);
  return g;
}

export function attachGloves(root: THREE.Object3D, team: number, visuals: CharacterVisuals = DEFAULT_VISUALS): void {
  for (const name of ['hand.l', 'hand.r']) {
    const bone = findBone(root, [name]);
    if (bone) bone.add(buildGlove(team, visuals));
  }
}

// --- socks / shin pads -------------------------------------------------------
/** Team sock over the shin: flared cylinder + white stripe, aligned to the leg (+Y). */
export function buildSock(team: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: TEAM_GEAR[team] ?? '#888', roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: '#f2f4f8', roughness: 0.7 });
  const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.2, 12), mat);
  sock.position.y = 0.08; // centered on the shin (bone +Y heads toward the foot)
  sock.castShadow = true;
  g.add(sock);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.097, 0.097, 0.035, 12), white);
  stripe.position.y = 0.05;
  g.add(stripe);
  return g;
}

export function attachSocks(root: THREE.Object3D, team: number): void {
  for (const name of ['lowerleg.l', 'lowerleg.r']) {
    const bone = findBone(root, [name]);
    if (bone) bone.add(buildSock(team));
  }
}

export function buildHelmet(visuals: CharacterVisuals = DEFAULT_VISUALS): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: visuals.helmet, roughness: 0.45 });
  const visor = new THREE.MeshStandardMaterial({
    color: visuals.stickTape,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.42,
  });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), shell);
  cap.rotation.x = Math.PI;
  cap.position.y = 0.04;
  cap.castShadow = true;
  g.add(cap);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.045), visor);
  shield.position.set(0, -0.03, 0.16);
  g.add(shield);
  return g;
}

export function attachHelmet(root: THREE.Object3D, visuals: CharacterVisuals = DEFAULT_VISUALS): void {
  const bone = findBone(root, ['head']);
  if (bone) bone.add(buildHelmet(visuals));
}

export function buildAccessory(visuals: CharacterVisuals = DEFAULT_VISUALS): THREE.Group {
  const g = new THREE.Group();
  const accent = new THREE.MeshStandardMaterial({ color: visuals.stickTape, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: visuals.helmet, roughness: 0.65 });
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.05), accent);
  chest.position.set(0, 0.15, 0.2);
  chest.castShadow = true;
  g.add(chest);

  if (visuals.silhouette.includes('wide') || visuals.silhouette.includes('big')) {
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.13), dark);
    shoulders.position.set(0, 0.23, 0.02);
    shoulders.castShadow = true;
    g.add(shoulders);
  }

  if (visuals.silhouette.includes('extra padding')) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.08), accent);
    pad.position.set(0, -0.13, 0.18);
    pad.castShadow = true;
    g.add(pad);
  }

  return g;
}

export function attachAccessory(root: THREE.Object3D, visuals: CharacterVisuals = DEFAULT_VISUALS): void {
  const bone = findBone(root, ['spine', 'chest']);
  (bone ?? root).add(buildAccessory(visuals));
}

/** Attach the full kit. */
export function attachGear(root: THREE.Object3D, team: number, visuals: CharacterVisuals = DEFAULT_VISUALS): void {
  attachStick(root, visuals);
  attachGloves(root, team, visuals);
  attachSocks(root, team);
  attachHelmet(root, visuals);
  attachAccessory(root, visuals);
}
