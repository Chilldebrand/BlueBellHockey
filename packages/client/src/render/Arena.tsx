import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RINK } from '@bbh/shared';

// The arena shell around the rink: raked crowd-filled stands on all four sides,
// an enclosing back wall, overhead light banks (which also bloom + reflect in the
// ice), perimeter ad boards, and a center-ice logo. All purely decorative and
// non-colliding — gameplay collision is server-side against RINK only.

const CROWD_PALETTE = [
  '#3c6bff', '#5aa0ff', '#ffffff', '#e0e6f0', '#2a3550',
  '#ff5a3c', '#ff9bb0', '#ffd23c', '#f1c79b', '#caa46a',
];

interface StandSpec {
  axis: 'long' | 'end'; // 'long' runs along X (sits on a ±Z side), 'end' runs along Z (±X side)
  sign: 1 | -1;
  halfSpan: number; // half length along the run axis
  inner: number; // distance from center to the front row
  depth: number; // how far the rake extends outward
  y0: number; // front-row height
  y1: number; // back-row height
  rows: number;
  perRow: number;
}

// Place a point on a stand given its run-axis param u∈[-halfSpan,halfSpan] and
// rake param v∈[0,1] (front→back). Returns [x, y, z].
function standPoint(s: StandSpec, along: number, v: number): [number, number, number] {
  const out = s.inner + v * s.depth;
  const y = s.y0 + v * (s.y1 - s.y0);
  if (s.axis === 'long') return [along, y, s.sign * out];
  return [s.sign * out, y, along];
}

export function Arena() {
  const stands: StandSpec[] = useMemo(
    () => [
      { axis: 'long', sign: 1, halfSpan: RINK.halfLength + 10, inner: RINK.halfWidth + 4, depth: 20, y0: 1.2, y1: 11, rows: 11, perRow: 60 },
      { axis: 'long', sign: -1, halfSpan: RINK.halfLength + 10, inner: RINK.halfWidth + 4, depth: 20, y0: 1.2, y1: 11, rows: 11, perRow: 60 },
      { axis: 'end', sign: 1, halfSpan: RINK.halfWidth + 6, inner: RINK.halfLength + 5, depth: 18, y0: 1.2, y1: 10, rows: 9, perRow: 40 },
      { axis: 'end', sign: -1, halfSpan: RINK.halfWidth + 6, inner: RINK.halfLength + 5, depth: 18, y0: 1.2, y1: 10, rows: 9, perRow: 40 },
    ],
    [],
  );

  // crowd: one instanced mesh of little seated blobs, per-instance colored
  const crowd = useMemo(() => {
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    const items: { m: THREE.Matrix4; r: number; g: number; b: number }[] = [];
    for (const s of stands) {
      for (let r = 0; r < s.rows; r++) {
        const v = s.rows > 1 ? r / (s.rows - 1) : 0;
        for (let i = 0; i < s.perRow; i++) {
          const u = (i / (s.perRow - 1) - 0.5) * 2 * s.halfSpan;
          const jU = (Math.random() - 0.5) * (s.halfSpan / s.perRow) * 1.4;
          const jV = (Math.random() - 0.5) * 0.04;
          const [x, y, z] = standPoint(s, u + jU, v + jV);
          dummy.position.set(x, y + 0.25, z);
          const sc = 0.7 + Math.random() * 0.5;
          dummy.scale.set(0.32 * sc, 0.55 * sc, 0.32 * sc);
          dummy.rotation.set(0, Math.random() * 0.6 - 0.3, 0);
          dummy.updateMatrix();
          c.set(CROWD_PALETTE[(Math.random() * CROWD_PALETTE.length) | 0]).multiplyScalar(0.55 + Math.random() * 0.3);
          items.push({ m: dummy.matrix.clone(), r: c.r, g: c.g, b: c.b });
        }
      }
    }
    return items;
  }, [stands]);

  const crowdRef = useRef<THREE.InstancedMesh>(null);
  const crowdGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useLayoutEffect(() => {
    const mesh = crowdRef.current;
    if (!mesh) return;
    for (let i = 0; i < crowd.length; i++) {
      mesh.setMatrixAt(i, crowd[i].m);
      mesh.setColorAt(i, new THREE.Color(crowd[i].r, crowd[i].g, crowd[i].b));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [crowd]);

  const centerLogo = useMemo(() => makeCenterLogo(), []);
  const adTex = useMemo(() => makeAdStripTexture(), []);

  const adZ = RINK.halfWidth + 0.7;
  const adX = RINK.halfLength - RINK.cornerRadius; // straight section only

  return (
    <group>
      {/* enclosing dark bowl wall behind the stands */}
      <mesh position={[0, 12, 0]}>
        <cylinderGeometry args={[70, 74, 40, 48, 1, true]} />
        <meshStandardMaterial color="#0a0f18" side={THREE.BackSide} roughness={1} />
      </mesh>
      {/* dim floor ring outside the boards (concourse) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <ringGeometry args={[RINK.halfWidth + 1, 72, 64]} />
        <meshStandardMaterial color="#11161f" roughness={1} />
      </mesh>

      {/* crowd */}
      <instancedMesh ref={crowdRef} args={[crowdGeo, undefined, crowd.length]} frustumCulled={false}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* overhead light banks: emissive panels that bloom + reflect in the ice */}
      {[-14, 0, 14].map((x) => (
        <mesh key={x} position={[x, 22, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[10, 22]} />
          <meshStandardMaterial color="#ffffff" emissive="#eaf2ff" emissiveIntensity={1.3} toneMapped={false} />
        </mesh>
      ))}

      {/* perimeter ad boards on the straight long sections */}
      {[1, -1].map((sgn) => (
        <mesh key={sgn} position={[0, 1.0, sgn * adZ]} rotation={[0, sgn > 0 ? Math.PI : 0, 0]}>
          <planeGeometry args={[adX * 2, 1.4]} />
          <meshBasicMaterial map={adTex} toneMapped={false} />
        </mesh>
      ))}

      {/* center-ice logo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[4.4, 64]} />
        <meshBasicMaterial map={centerLogo} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

// --- canvas textures ----------------------------------------------------------

function makeCenterLogo(): THREE.CanvasTexture {
  const s = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  ctx.clearRect(0, 0, s, s);
  const cx = s / 2;
  // The ground plane's texture-V points away from the fixed broadcast camera, so
  // pre-rotate the artwork 180° to read upright on screen.
  ctx.translate(cx, cx);
  ctx.rotate(Math.PI);
  ctx.translate(-cx, -cx);
  // outer ring
  ctx.strokeStyle = '#1f4fb5';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx, cx, s * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#c8202b';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cx, s * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  // wordmark
  ctx.fillStyle = '#13294b';
  ctx.font = `bold ${s * 0.26}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BBH', cx, cx * 0.92);
  ctx.fillStyle = '#c8202b';
  ctx.font = `bold ${s * 0.09}px system-ui, sans-serif`;
  ctx.fillText('HOCKEY', cx, cx * 1.32);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeAdStripTexture(): THREE.CanvasTexture {
  const w = 2048;
  const h = 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const ads = [
    ['#1f4fb5', '#ffffff', 'BBELL'],
    ['#c8202b', '#ffffff', 'ARCADE'],
    ['#101722', '#ffd23c', 'PUCK CO'],
    ['#ffd23c', '#101722', 'NEON ICE'],
    ['#0e7a52', '#ffffff', '3v3'],
    ['#7a2fb0', '#ffffff', 'STREET'],
  ];
  const panel = w / 8;
  let x = 0;
  let i = 0;
  while (x < w) {
    const [bg, fg, label] = ads[i % ads.length];
    ctx.fillStyle = bg;
    ctx.fillRect(x, 0, panel - 4, h);
    ctx.fillStyle = fg;
    ctx.font = `bold ${h * 0.5}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + panel / 2, h / 2);
    x += panel;
    i++;
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
