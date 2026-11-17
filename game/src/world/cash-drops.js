// Cash drops around town: spinning, bobbing green bundles that pay out when the player
// walks or drives through them, then come back after a while.
import * as THREE from 'three';
import { CASH, CITY } from '../config.js';

export class CashDrops {
  constructor(scene, spots) {
    this.group = new THREE.Group();
    this.group.name = 'cash';
    const bundle = new THREE.BoxGeometry(0.7, 0.35, 0.42);
    const band = new THREE.BoxGeometry(0.72, 0.37, 0.1);
    const green = new THREE.MeshStandardMaterial({ color: '#43c463', emissive: new THREE.Color('#1f8a3a'), emissiveIntensity: 0.6, roughness: 0.6 });
    const white = new THREE.MeshStandardMaterial({ color: '#f4f1e4', roughness: 0.6 });
    const ringMaterial = new THREE.MeshBasicMaterial({ color: '#6dff8f', transparent: true, opacity: 0.45, depthWrite: false });
    const ring = new THREE.RingGeometry(0.75, 1.0, 28);
    ring.rotateX(-Math.PI / 2);
    this.drops = spots.map((spot) => {
      const holder = new THREE.Group();
      const money = new THREE.Group();
      money.add(new THREE.Mesh(bundle, green), new THREE.Mesh(band, white));
      money.children.forEach((mesh) => { mesh.castShadow = true; });
      holder.add(money, new THREE.Mesh(ring, ringMaterial));
      holder.position.set(spot.x, CITY.curb + 0.04, spot.z);
      this.group.add(holder);
      return { x: spot.x, z: spot.z, value: spot.value, active: true, timer: 0, holder, money };
    });
    scene.add(this.group);
  }

  /** Spin the drops, respawn taken ones and return the total collected by a body at (x, z). */
  update(dt, time, x, z, reach) {
    let collected = 0;
    for (const drop of this.drops) {
      if (!drop.active) {
        drop.timer -= dt;
        if (drop.timer <= 0) {
          drop.active = true;
          drop.holder.visible = true;
        }
        continue;
      }
      drop.money.rotation.y = time * 2 + drop.x;
      drop.money.position.y = 0.8 + Math.sin(time * 3 + drop.z) * 0.15;
      const dx = drop.x - x;
      const dz = drop.z - z;
      if (dx * dx + dz * dz < (CASH.radius + reach) ** 2) {
        drop.active = false;
        drop.timer = CASH.respawnSeconds;
        drop.holder.visible = false;
        collected += drop.value;
      }
    }
    return collected;
  }
}
