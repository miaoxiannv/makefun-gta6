import * as THREE from 'three';
import { GRID } from '../config.js';
import { MeshBuilder } from '../core/mesh-builder.js';
import { makeRng } from '../core/rng.js';
import { FACADE_STYLES, facadeTextures, roofTexture } from '../core/textures.js';

const FLOOR = 3.4;
const TERRACOTTA = ['#c8643f', '#b9573a', '#d07a4c'];
const AWNINGS = ['#ef5b5b', '#2bb3a3', '#f5b83d', '#4f86c6', '#f08bb0'];

export class Buildings {
  constructor(plan) {
    this.group = new THREE.Group();
    this.group.name = 'buildings';
    this.facadeMaterials = [];
    const rng = makeRng(GRID.seed + 7);

    const walls = {};
    for (const name of Object.keys(FACADE_STYLES)) walls[name] = new MeshBuilder();
    const roofs = new MeshBuilder();
    const tiles = new MeshBuilder();
    const trim = new MeshBuilder();
    const glow = new MeshBuilder();

    for (const b of plan.buildings) {
      const tile = [FACADE_STYLES[b.style].tile[0], FLOOR * 8, rng() * 8];
      const w = b.x1 - b.x0;
      const d = b.z1 - b.z0;
      const cx = (b.x0 + b.x1) / 2;
      const cz = (b.z0 + b.z1) / 2;
      const color = new THREE.Color(b.tint);
      walls[b.style].box(cx, b.height / 2, cz, w, b.height, d, { skip: ['top', 'bottom'], tile, color });

      if (b.roof === 'tiles') {
        
        const eave = 0.6;
        const ridge = Math.min(w, d) * 0.32;
        const along = w > d;
        tiles.wedge(cx, b.height, b.height + ridge, cz - d / 2 - eave, cz + d / 2 + eave,
          along ? cz - 0.2 : cz - d / 2 + ridge, along ? cz + 0.2 : cz + d / 2 - ridge, w + eave * 2,
          { inset: along ? ridge : (w + eave * 2) / 2 - 0.2, color: new THREE.Color(rng.pick(TERRACOTTA)) });
      } else {
        roofs.flat(b.x0, b.z0, b.x1, b.z1, b.height, { tile: [8, 8] });
        
        const p = 0.35;
        const ph = 0.9;
        const pc = color.clone().multiplyScalar(0.92);
        trim.box(cx, b.height + ph / 2, b.z0 + p / 2, w, ph, p, { color: pc });
        trim.box(cx, b.height + ph / 2, b.z1 - p / 2, w, ph, p, { color: pc });
        trim.box(b.x0 + p / 2, b.height + ph / 2, cz, p, ph, d - p * 2, { color: pc });
        trim.box(b.x1 - p / 2, b.height + ph / 2, cz, p, ph, d - p * 2, { color: pc });
        
        const grey = new THREE.Color('#b9b6b0');
        for (let k = rng.int(1, 3); k > 0; k -= 1) {
          const sx = rng.range(1.5, 3.5);
          const sz = rng.range(1.5, 3);
          trim.box(cx + rng.range(-w / 2 + 3, w / 2 - 3), b.height + 0.7, cz + rng.range(-d / 2 + 3, d / 2 - 3), sx, 1.4, sz, { color: grey });
        }
        if (b.floors > 4) trim.box(cx + w * 0.18, b.height + 1.5, cz - d * 0.15, 3.2, 3, 3.2, { color: color.clone().multiplyScalar(0.85) });
        if (b.roof === 'plant' && b.floors < 12) {
          const tank = new THREE.Color('#8f7b62');
          trim.box(cx - w * 0.2, b.height + 2.6, cz + d * 0.2, 2.2, 2.4, 2.2, { color: tank });
          trim.box(cx - w * 0.2, b.height + 0.8, cz + d * 0.2, 1.6, 1.6, 1.6, { color: new THREE.Color('#555') });
        }
      }

      if (b.crown) {
        
        const c2 = color.clone().multiplyScalar(0.95);
        trim.box(cx, b.height + 2, cz, w * 0.7, 4, d * 0.7, { color: c2 });
        trim.box(cx, b.height + 5.5, cz, w * 0.4, 3, d * 0.4, { color: c2 });
        trim.box(cx, b.height + 13, cz, 0.35, 12, 0.35, { color: new THREE.Color('#d8d8d8') });
        glow.box(cx, b.height + 19.2, cz, 0.7, 0.7, 0.7, { color: new THREE.Color('#ff3b30') });
      }

      if ((b.district === 'beach' || b.district === 'brisa') && rng.chance(0.7)) {
        const ac = new THREE.Color(rng.pick(AWNINGS));
        const faceSouth = rng.chance(0.5);
        const z = faceSouth ? b.z1 + 0.9 : b.z0 - 0.9;
        trim.wedge(cx, 3.1, 3.6, z - 0.9, z + 0.9, faceSouth ? z - 0.9 : z + 0.5, faceSouth ? z - 0.5 : z + 0.9, w * 0.8, { color: ac });
      }
    }

    for (const [name, builder] of Object.entries(walls)) {
      if (builder.empty) continue;
      const tex = facadeTextures(name, GRID.seed + name.length * 31);
      const mat = new THREE.MeshStandardMaterial({
        map: tex.day,
        emissiveMap: tex.night,
        emissive: new THREE.Color('#ffffff'),
        emissiveIntensity: 0,
        vertexColors: true,
        roughness: name === 'tower' ? 0.35 : 0.8,
        metalness: name === 'tower' ? 0.35 : 0.05,
      });
      this.facadeMaterials.push(mat);
      this.group.add(builder.mesh(mat));
    }
    const roofTex = roofTexture();
    this.group.add(roofs.mesh(new THREE.MeshStandardMaterial({ map: roofTex, roughness: 1, vertexColors: true }), { shadows: false }));
    this.group.add(tiles.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
    this.group.add(trim.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
    this.beacons = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: new THREE.Color('#ff2a1a'), emissiveIntensity: 0 });
    if (!glow.empty) this.group.add(glow.mesh(this.beacons, { shadows: false }));
  }

  update(night, time) {
    for (const mat of this.facadeMaterials) mat.emissiveIntensity = night * 1.25;
    this.beacons.emissiveIntensity = 0.4 + 6 * night * (Math.sin(time * 3) > 0 ? 1 : 0.15);
  }
}