// Gibt Animationen, Materialien, Knoten und Bounding-Box-Höhe einer GLB-Datei aus.
import { readFileSync } from 'node:fs';

for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file);
  const jsonLength = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
  let minY = Infinity, maxY = -Infinity;
  for (const mesh of gltf.meshes ?? []) for (const p of mesh.primitives) {
    const acc = gltf.accessors[p.attributes.POSITION];
    minY = Math.min(minY, acc.min[1]); maxY = Math.max(maxY, acc.max[1]);
  }
  console.log(file.split('/').pop(), `${(buf.length / 1024).toFixed(0)} kB`);
  console.log('  animations:', (gltf.animations ?? []).map((a) => `${a.name}(${a.channels.length})`).join(', ') || '-');
  console.log('  materials:', (gltf.materials ?? []).map((m) => m.name).join(', '));
  console.log('  nodes:', gltf.nodes.length, 'meshes:', gltf.meshes?.length, 'local mesh y-range:', minY.toFixed(2), maxY.toFixed(2));
}
