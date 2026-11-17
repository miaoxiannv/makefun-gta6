// Image-based lighting from the current sky: a small gradient sky with a sun disc is
// pre-filtered (PMREM) into scene.environment so glass towers and car paint reflect the
// sky and shaded streets still get soft fill light. Rebuilt as the clock moves on.
import * as THREE from 'three';

const GROUND = new THREE.Color('#6d6658');

export class SkyEnvironment {
  constructor(renderer, scene) {
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    const geometry = new THREE.SphereGeometry(50, 32, 16);
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
    this.dome = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    this.sunDisc = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    this.envScene.add(this.dome, this.sunDisc);
    this.target = null;
    this.lastHour = -100;
    this.color = new THREE.Color();
  }

  /** Re-bake when the clock has moved more than a few game minutes. */
  update(hour, lighting) {
    if (Math.abs(hour - this.lastHour) < 0.2) return;
    this.lastHour = hour;
    const position = this.dome.geometry.attributes.position;
    const colors = this.dome.geometry.attributes.color;
    const ground = GROUND.clone().multiplyScalar(0.35 + lighting.ambient * 0.5);
    for (let k = 0; k < position.count; k += 1) {
      const y = position.getY(k) / 50;
      if (y >= 0) this.color.copy(lighting.horizon).lerp(lighting.top, Math.pow(y, 0.6));
      else this.color.copy(lighting.horizon).lerp(ground, Math.min(1, -y * 4));
      colors.setXYZ(k, this.color.r, this.color.g, this.color.b);
    }
    colors.needsUpdate = true;
    this.sunDisc.position.copy(lighting.sunDirection).multiplyScalar(40);
    this.sunDisc.material.color.copy(lighting.sun).multiplyScalar(lighting.isMoon ? 0.4 : 6);
    const next = this.pmrem.fromScene(this.envScene, 0.02);
    this.scene.environment = next.texture;
    this.target?.dispose();
    this.target = next;
  }
}
