// Collapse a group's child meshes into one mesh per material, baking each child's local
// transform in. Cuts a car from ~20 draw calls to a handful.
import * as THREE from 'three';

/** Merge non-indexed copies of `geometries` (position, normal, uv) into one geometry. */
function mergeGeometries(geometries) {
  const parts = geometries.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((sum, g) => sum + g.attributes.position.count, 0);
  const merged = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    if (!parts.every((g) => g.attributes[name])) continue;
    const size = parts[0].attributes[name].itemSize;
    const array = new Float32Array(total * size);
    let offset = 0;
    for (const g of parts) {
      array.set(g.attributes[name].array, offset);
      offset += g.attributes[name].array.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Replace the direct mesh children of `group` with one mesh per material. Child groups are
 * left alone. Returns the new meshes.
 */
export function mergeByMaterial(group, castShadow = true) {
  const byMaterial = new Map();
  for (const child of [...group.children]) {
    if (!child.isMesh) continue;
    child.updateMatrix();
    const geometry = child.geometry.clone().applyMatrix4(child.matrix);
    if (!byMaterial.has(child.material)) byMaterial.set(child.material, { list: [], shadow: false });
    const entry = byMaterial.get(child.material);
    entry.list.push(geometry);
    entry.shadow ||= child.castShadow;
    group.remove(child);
  }
  const meshes = [];
  for (const [material, entry] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(entry.list), material);
    mesh.castShadow = castShadow && entry.shadow;
    group.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
