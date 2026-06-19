import * as THREE from 'three';
import { GLTFLoader, MeshoptDecoder } from 'three-stdlib';
import { SkeletonUtils } from 'three-stdlib';
import { attachGear } from './render/gear.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#223');
scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(3, 6, 4); scene.add(dl);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
// frame the whole body so stick, gloves, and socks are all visible
camera.position.set(-2.6, 1.4, 3.0);
camera.lookAt(-0.3, 0.8, 0);

// model + team selectable via query: ?m=mage.glb&t=1
const params = new URLSearchParams(location.search);
const modelFile = params.get('m') ?? 'knight.glb';
const team = Number(params.get('t') ?? '0');

const loader = new GLTFLoader();
// drei calls MeshoptDecoder() when it's a function; three-stdlib exports it that way
loader.setMeshoptDecoder((typeof MeshoptDecoder === 'function' ? (MeshoptDecoder as any)() : MeshoptDecoder) as any);
loader.load('/models/chars/' + modelFile, (gltf) => {
  const model = SkeletonUtils.clone(gltf.scene) as THREE.Object3D;
  attachGear(model, team);
  scene.add(model);
  (window as any).__stickAttached = true;
  const mixer = new THREE.AnimationMixer(model);
  const idle = gltf.animations.find((a) => a.name === 'Idle') ?? gltf.animations[0];
  if (idle) mixer.clipAction(idle).play();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => { mixer.update(clock.getDelta()); renderer.render(scene, camera); });
  console.log('gear attached; anims=', gltf.animations.map((a) => a.name).length);
});
