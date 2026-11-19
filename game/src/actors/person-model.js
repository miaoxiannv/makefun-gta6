import * as THREE from 'three';

const box = (w, h, d, mat, y = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(0, y, 0), mat);
  mesh.castShadow = true;
  return mesh;
};

export const PLAYER_LOOK = { skin: '#b07850', shirt: '#2ab3a6', print: '#f6e7c8', pants: '#f2ede2', shoes: '#1d1d1f', hair: '#1b1410', shades: true };

export class PersonModel {
  constructor(look = PLAYER_LOOK) {
    const m = (c, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...extra });
    const skin = m(look.skin);
    const shirt = m(look.shirt);
    const pants = m(look.pants);
    const shoes = m(look.shoes);
    this.root = new THREE.Group();

    this.hips = new THREE.Group();
    this.hips.position.y = 0.95;
    this.root.add(this.hips);
    this.hips.add(box(0.38, 0.2, 0.22, pants));

    this.torso = new THREE.Group();
    this.torso.position.y = 0.08;
    this.hips.add(this.torso);
    this.torso.add(box(0.44, 0.56, 0.25, shirt, 0.3));
    
    if (look.print) this.torso.add(box(0.16, 0.5, 0.02, m(look.print), 0.31).translateZ(0.13));
    this.torso.add(box(0.12, 0.08, 0.12, skin, 0.62));

    this.head = new THREE.Group();
    this.head.position.y = 0.66;
    this.torso.add(this.head);
    this.head.add(box(0.23, 0.27, 0.24, skin, 0.14));
    this.head.add(box(0.25, 0.09, 0.26, m(look.hair), 0.3));
    this.head.add(box(0.25, 0.14, 0.06, m(look.hair), 0.22).translateZ(-0.11));
    if (look.shades) this.head.add(box(0.24, 0.05, 0.03, m('#0b0b0d', { roughness: 0.2, metalness: 0.6 }), 0.17).translateZ(0.125));

    const limb = (x, y, upper, lower, mat, endMat, endSize) => {
      const joint = new THREE.Group();
      joint.position.set(x, y, 0);
      joint.add(box(upper[0], upper[1], upper[2], mat, -upper[1] / 2));
      const knee = new THREE.Group();
      knee.position.y = -upper[1];
      knee.add(box(lower[0], lower[1], lower[2], lower[3] ?? mat, -lower[1] / 2));
      const end = box(...endSize, endMat, -lower[1] - endSize[1] / 2);
      end.position.z = endSize[2] > 0.2 ? 0.05 : 0;
      knee.add(end);
      joint.add(knee);
      joint.knee = knee;
      return joint;
    };
    this.legL = limb(-0.1, 0, [0.16, 0.45, 0.18], [0.14, 0.42, 0.16], pants, shoes, [0.15, 0.08, 0.27]);
    this.legR = limb(0.1, 0, [0.16, 0.45, 0.18], [0.14, 0.42, 0.16], pants, shoes, [0.15, 0.08, 0.27]);
    this.hips.add(this.legL, this.legR);
    this.armL = limb(-0.28, 0.54, [0.12, 0.3, 0.13], [0.1, 0.27, 0.11, skin], shirt, skin, [0.1, 0.09, 0.11]);
    this.armR = limb(0.28, 0.54, [0.12, 0.3, 0.13], [0.1, 0.27, 0.11, skin], shirt, skin, [0.1, 0.09, 0.11]);
    this.torso.add(this.armL, this.armR);
  }

  pose(phase, gait, airborne, time) {
    const swing = Math.min(1, gait) * 0.55 + Math.max(0, gait - 1) * 0.35;
    const s = Math.sin(phase);
    if (airborne) {
      this.legL.rotation.x = -0.7; this.legL.knee.rotation.x = 1.1;
      this.legR.rotation.x = 0.2; this.legR.knee.rotation.x = 0.5;
      this.armL.rotation.x = -2.2; this.armR.rotation.x = -2.0;
      this.armL.rotation.z = -0.3; this.armR.rotation.z = 0.3;
      this.torso.rotation.x = 0.1;
      this.hips.position.y = 0.95;
      return;
    }
    this.legL.rotation.x = s * swing;
    this.legR.rotation.x = -s * swing;
    this.legL.knee.rotation.x = Math.max(0, -Math.cos(phase)) * swing * 1.3 + 0.05;
    this.legR.knee.rotation.x = Math.max(0, Math.cos(phase)) * swing * 1.3 + 0.05;
    this.armL.rotation.x = -s * swing * 0.9;
    this.armR.rotation.x = s * swing * 0.9;
    this.armL.knee.rotation.x = -0.2 - swing * 0.6;
    this.armR.knee.rotation.x = -0.2 - swing * 0.6;
    this.armL.rotation.z = -0.08;
    this.armR.rotation.z = 0.08;
    this.torso.rotation.x = Math.max(0, gait - 1) * 0.22;
    
    const bob = gait > 0.05 ? Math.abs(Math.cos(phase)) * 0.05 * swing : Math.sin(time * 2) * 0.008;
    this.hips.position.y = 0.95 + bob - swing * 0.03;
    this.head.rotation.y = gait > 0.05 ? 0 : Math.sin(time * 0.4) * 0.25;
  }
}