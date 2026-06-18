import * as THREE from 'three';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import { SkeletonUtils } from 'three-stdlib';

// --- copied verbatim from CharacterModel.tsx ---
const STICK_BONE = ['handslot.r', 'hand.r'];
const STICK_POS = new THREE.Vector3(0, 0, 0);
const STICK_ROT = new THREE.Euler(Math.PI - 0.5, 0, 0); // [DIAG] flip down + tilt
const STICK_SCALE = 1;

function buildStick(): THREE.Group {
  const stick = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({ color: '#caa46a' });
  const bladeMat = new THREE.MeshStandardMaterial({ color: '#2a2118' });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.05, 8), shaftMat);
  shaft.position.y = -0.5;
  stick.add(shaft);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.3), bladeMat);
  blade.position.set(0, -1.0, 0.13);
  blade.rotation.x = 0.35;
  stick.add(blade);
  stick.position.copy(STICK_POS);
  stick.rotation.copy(STICK_ROT);
  stick.scale.setScalar(STICK_SCALE);
  return stick;
}
const norm = (s: string) => s.replace(/[._\s]/g, '').toLowerCase();
function findBone(root: THREE.Object3D, names: string[]): THREE.Object3D | undefined {
  const want = names.map(norm);
  let found: THREE.Object3D | undefined;
  root.traverse((o) => { if (!found && want.includes(norm(o.name))) found = o; });
  return found;
}
function attachStick(root: THREE.Object3D): boolean {
  const bone = findBone(root, STICK_BONE);
  if (bone) bone.add(new THREE.AxesHelper(0.4)); // [DIAG] show bone local axes
  (bone ?? root).add(buildStick());
  return !!bone;
}
// --- end copy ---

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#223');
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(3, 6, 4); scene.add(dl);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
// view the right side / front so the right hand and stick are clearly visible
camera.position.set(-2.6, 1.1, 2.4);
camera.lookAt(-0.6, 0.7, 0);

const loader = new GLTFLoader();
// drei calls MeshoptDecoder() when it's a function; three-stdlib exports it that way
loader.setMeshoptDecoder((typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder) as any);
loader.load('/models/chars/knight.glb', (gltf) => {
  const model = SkeletonUtils.clone(gltf.scene) as THREE.Object3D;
  const handNames: string[] = [];
  model.traverse((o) => { if (/hand|slot/i.test(o.name)) handNames.push(o.name); });
  console.log('HAND BONE NAMES IN CLONE:', handNames.join(', '));
  const attached = attachStick(model);
  scene.add(model);
  (window as any).__stickAttached = attached;
  const mixer = new THREE.AnimationMixer(model);
  const idle = gltf.animations.find((a) => a.name === 'Idle') ?? gltf.animations[0];
  if (idle) mixer.clipAction(idle).play();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => { mixer.update(clock.getDelta()); renderer.render(scene, camera); });
  console.log('stickAttached=', attached, 'anims=', gltf.animations.map((a) => a.name).length);
});
