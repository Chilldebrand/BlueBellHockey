const fs = require('fs');
const path = require('path');

function nodeNames(file) {
  const buf = fs.readFileSync(file);
  // GLB header: magic(4) version(4) length(4); then chunks: length(4) type(4) data
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glb');
  let off = 12;
  const chunkLen = buf.readUInt32LE(off);
  const chunkType = buf.readUInt32LE(off + 4);
  if (chunkType !== 0x4e4f534a) throw new Error('first chunk not JSON');
  const json = JSON.parse(buf.slice(off + 8, off + 8 + chunkLen).toString('utf8'));
  const names = (json.nodes || []).map((n) => n.name).filter(Boolean);
  const anims = (json.animations || []).map((a) => a.name).filter(Boolean);
  return { names, anims };
}

const dir = path.resolve(__dirname, '..', 'packages', 'client', 'public', 'models', 'chars');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.glb'));

for (const f of files.slice(0, 1)) {
  const { names, anims } = nodeNames(path.join(dir, f));
  console.log(`=== ${f} : ${names.length} nodes ===`);
  const hands = names.filter((n) => /hand|wrist|arm|slot|weapon|grip/i.test(n));
  console.log('HAND-ish bones:', hands.join(', ') || '(none)');
  console.log('ALL nodes:', names.join(', '));
  console.log('ANIMS:', anims.join(', '));
}
