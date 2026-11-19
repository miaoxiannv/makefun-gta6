import * as THREE from 'three';
import { CASH_DROPS, GRID } from '../config.js';
import { makeRng } from '../core/rng.js';

export class CashDrops {
  constructor(scene, spots) {
    const rng = makeRng(GRID.seed + 99);
    const bill = new THREE.BoxGeometry(0.75, 0.32, 0.42);
    const mat = new THREE.MeshStandardMaterial({ color: '#46c463', emissive: '#1f8f3c', emissiveIntensity: 0.6, roughness: 0.5 });
    const band = new THREE.MeshStandardMaterial({ color: '#f5e7b0', roughness: 0.6 });
    const bandGeo = new THREE.BoxGeometry(0.16, 0.34, 0.44);
    const ringGeo = new THREE.RingGeometry(0.9, 1.15, 28).rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#6dff8f', transparent: true, opacity: 0.55, depthWrite: false });
    this.drops = spots.map((s) => {
      const group = new THREE.Group();
      const stack = new THREE.Mesh(bill, mat);
      stack.castShadow = true;
      stack.add(new THREE.Mesh(bandGeo, band));
      group.add(stack);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = -0.8;
      group.add(ring);
      group.position.set(s.x, GRID.curb + 1, s.z);
      scene.add(group);
      return { x: s.x, z: s.z, value: Math.round(rng.range(CASH_DROPS.min, CASH_DROPS.max) / 5) * 5, active: true, timer: 0, group, stack, phase: rng() * 6 };
    });
  }

  update(dt, time, x, z, extraReach = 0) {
    let found = 0;
    const reach = CASH_DROPS.radius + extraReach;
    for (const d of this.drops) {
      if (!d.active) {
        d.timer -= dt;
        if (d.timer <= 0) {
          d.active = true;
          d.group.visible = true;
        }
        continue;
      }
      d.stack.rotation.y = time * 1.8 + d.phase;
      d.stack.position.y = Math.sin(time * 2.4 + d.phase) * 0.15;
      if (Math.hypot(d.x - x, d.z - z) < reach) {
        found += d.value;
        d.active = false;
        d.group.visible = false;
        d.timer = CASH_DROPS.respawn;
      }
    }
    return found;
  }
}