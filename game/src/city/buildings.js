// Building meshes: boxes wrapped in the procedural facades with UVs scaled so windows keep
// their real size on every wall, setback crowns on tall towers and rooftop clutter.
import * as THREE from 'three';
import { CITY } from '../config.js';
import { FACADE_COLUMNS, FACADE_FLOORS, FACADE_STYLES, WINDOW_SPACING, paintFacade } from './facades.js';
import { FLOOR_HEIGHT } from './layout.js';
import { makeRandom } from '../core/random.js';

/** Box geometry whose side UVs repeat once per window column and floor. */
function facadeBox(w, h, d) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv;
  const vScale = h / (FACADE_FLOORS * FLOOR_HEIGHT);
  // Face order in BoxGeometry: +x, -x, +y, -y, +z, -z; four vertices each.
  const faceWidths = [d, d, 0, 0, w, w];
  for (let face = 0; face < 6; face += 1) {
    if (face === 2 || face === 3) continue;
    const columns = Math.max(1, Math.round(faceWidths[face] / WINDOW_SPACING));
    const uScale = columns / FACADE_COLUMNS;
    for (let k = 0; k < 4; k += 1) {
      const index = face * 4 + k;
      uv.setXY(index, uv.getX(index) * uScale, uv.getY(index) * vScale);
    }
  }
  return geometry;
}

export class BuildingSet {
  constructor(layout) {
    this.group = new THREE.Group();
    this.group.name = 'buildings';
    this.facadeMaterials = [];
    this.materials = new Map();
    const random = makeRandom(CITY.seed ^ 0xb1d);
    const clutter = [];

    for (const b of layout.buildings) {
      const materials = this.materialsFor(b.style, b.variant);
      const mesh = new THREE.Mesh(facadeBox(b.w, b.h, b.d), materials);
      mesh.position.set(b.x, CITY.curb + b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      let roofY = CITY.curb + b.h;
      let roofW = b.w;
      let roofD = b.d;
      // Tall towers step back into a crown.
      if (b.h > 40 && b.w > 18 && b.d > 18) {
        const crownH = Math.round((b.h * 0.22) / FLOOR_HEIGHT) * FLOOR_HEIGHT;
        roofW = b.w * 0.68;
        roofD = b.d * 0.68;
        const crown = new THREE.Mesh(facadeBox(roofW, crownH, roofD), materials);
        crown.position.set(b.x, roofY + crownH / 2, b.z);
        crown.castShadow = true;
        this.group.add(crown);
        roofY += crownH;
        clutter.push({ x: b.x, y: roofY, z: b.z, sx: 0.4, sy: 9 + random() * 8, sz: 0.4 });
      }
      // Parapet trim and air-conditioning boxes on the roof.
      const units = 1 + Math.floor(random() * 3);
      for (let k = 0; k < units; k += 1) {
        clutter.push({
          x: b.x + (random() - 0.5) * roofW * 0.6,
          y: roofY,
          z: b.z + (random() - 0.5) * roofD * 0.6,
          sx: 1.5 + random() * 2.5, sy: 1 + random() * 1.4, sz: 1.5 + random() * 2.5,
        });
      }
    }

    const unitMaterial = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.7, metalness: 0.2 });
    const units = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), unitMaterial, clutter.length);
    const matrix = new THREE.Matrix4();
    clutter.forEach((c, index) => {
      matrix.makeScale(c.sx, c.sy, c.sz);
      matrix.setPosition(c.x, c.y + c.sy / 2, c.z);
      units.setMatrixAt(index, matrix);
    });
    units.castShadow = true;
    this.group.add(units);
  }

  /** Shared [side, side, roof, floor, side, side] materials for a style variant. */
  materialsFor(styleName, variant) {
    const key = `${styleName}:${variant}`;
    if (!this.materials.has(key)) {
      const style = FACADE_STYLES[styleName];
      const { map, glowMap } = paintFacade(styleName, variant);
      const side = new THREE.MeshStandardMaterial({
        map,
        emissiveMap: glowMap,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0,
        roughness: style.rough,
        metalness: style.metal,
      });
      const roof = new THREE.MeshStandardMaterial({ color: style.roof, roughness: 0.95 });
      this.facadeMaterials.push(side);
      this.materials.set(key, [side, side, roof, roof, side, side]);
    }
    return this.materials.get(key);
  }

  /** 0 by day, 1 at night: how brightly the lit windows glow. */
  setNight(amount) {
    for (const material of this.facadeMaterials) material.emissiveIntensity = amount * 1.25;
  }
}
