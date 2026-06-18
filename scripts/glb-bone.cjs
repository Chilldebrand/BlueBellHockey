const fs = require('fs');
const path = require('path');

function parseGlb(file) {
  const buf = fs.readFileSync(file);
  const chunkLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + chunkLen).toString('utf8'));
}

// minimal mat4 (column-major) helpers
function fromTRS(t = [0,0,0], q = [0,0,0,1], s = [1,1,1]) {
  const [x,y,z,w] = q;
  const x2=x+x,y2=y+y,z2=z+z;
  const xx=x*x2,xy=x*y2,xz=x*z2,yy=y*y2,yz=y*z2,zz=z*z2,wx=w*x2,wy=w*y2,wz=w*z2;
  const [sx,sy,sz]=s;
  return [
    (1-(yy+zz))*sx, (xy+wz)*sx, (xz-wy)*sx, 0,
    (xy-wz)*sy, (1-(xx+zz))*sy, (yz+wx)*sy, 0,
    (xz+wy)*sz, (yz-wx)*sz, (1-(xx+yy))*sz, 0,
    t[0], t[1], t[2], 1,
  ];
}
function mul(a,b){const o=new Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;}
function scaleOf(m){
  const sx=Math.hypot(m[0],m[1],m[2]);
  const sy=Math.hypot(m[4],m[5],m[6]);
  const sz=Math.hypot(m[8],m[9],m[10]);
  return [sx,sy,sz];
}

const file = path.resolve(__dirname,'..','packages','client','public','models','chars','knight.glb');
const g = parseGlb(file);
const nodes = g.nodes;
const parent = new Array(nodes.length).fill(-1);
nodes.forEach((n,i)=>(n.children||[]).forEach((c)=>parent[c]=i));
const local = nodes.map((n)=>fromTRS(n.translation,n.rotation,n.scale));
function world(i){ return parent[i]<0 ? local[i] : mul(world(parent[i]), local[i]); }

const idxByName = new Map(nodes.map((n,i)=>[n.name,i]));
for (const name of ['root','Rig_Medium','hips','chest','head','handslot.r','hand.r']) {
  const i = idxByName.get(name);
  if (i==null){ console.log(name,'-> (absent)'); continue; }
  const w = world(i);
  console.log(`${name}: worldPos=[${w[12].toFixed(3)}, ${w[13].toFixed(3)}, ${w[14].toFixed(3)}] worldScale=[${scaleOf(w).map(v=>v.toFixed(3)).join(', ')}]`);
}
// scene root nodes
console.log('scene roots:', (g.scenes?.[0]?.nodes||[]).map(i=>nodes[i].name).join(', '));
