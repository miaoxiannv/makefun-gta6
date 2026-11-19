import * as THREE from 'three';
import { CITY_HALF, SHORE } from '../config.js';

const SHALLOW = new THREE.Color('#38c7c0');
const DEEP = new THREE.Color('#1667a8');

export class Ocean {
  constructor(scene) {
    const width = 1600;
    const geo = new THREE.PlaneGeometry(width, 2400, 80, 60).rotateX(-Math.PI / 2);
    this.base = Float32Array.from(geo.attributes.position.array);
    const colours = new Float32Array(geo.attributes.position.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < geo.attributes.position.count; i += 1) {
      const t = Math.min(1, (this.base[i * 3] + width / 2) / 160);
      c.copy(SHALLOW).lerp(DEEP, Math.pow(t, 0.7));
      c.toArray(colours, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.94 });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(CITY_HALF + SHORE.sand - 14 + width / 2, SHORE.water, 0);
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    this.surfMat = new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.6, depthWrite: false });
    this.surf = new THREE.Mesh(new THREE.PlaneGeometry(5, 2400).rotateX(-Math.PI / 2), this.surfMat);
    this.surf.position.set(CITY_HALF + SHORE.sand - 12, SHORE.water + 0.08, 0);
    scene.add(this.surf);
    this.lastWave = -1;
  }

  update(time, day) {
    
    if (time - this.lastWave > 1 / 30) {
      this.lastWave = time;
      const pos = this.mesh.geometry.attributes.position;
      const a = pos.array;
      for (let i = 0; i < pos.count; i += 1) {
        const x = this.base[i * 3];
        const z = this.base[i * 3 + 2];
        a[i * 3 + 1] = Math.sin(x * 0.045 + time * 0.9) * 0.22 + Math.sin(z * 0.06 - time * 0.7 + x * 0.02) * 0.16;
      }
      pos.needsUpdate = true;
      this.mesh.geometry.computeVertexNormals();
    }
    this.surfMat.opacity = 0.35 + 0.25 * Math.sin(time * 0.9);
    this.surf.position.x = CITY_HALF + SHORE.sand - 12 + Math.sin(time * 0.9) * 1.2;
    this.material.color.setScalar(1 - day.night * 0.55);
    this.surfMat.color.setScalar(1 - day.night * 0.6);
  }
}