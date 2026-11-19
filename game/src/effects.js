import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.max = 240;
    this.pos = new Float32Array(this.max * 3);
    this.col = new Float32Array(this.max * 3);
    this.base = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.span = new Float32Array(this.max);
    this.grav = new Float32Array(this.max);
    for (let i = 0; i < this.max; i++) this.pos[i * 3 + 1] = -1000;
    this.head = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.85, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.skids = [];
    const sg = new THREE.PlaneGeometry(0.4, 1.8);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: '#0d0d0d', transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.06;
      m.visible = false;
      scene.add(m);
      this.skids.push({ mesh: m, life: 0 });
    }
    this.skidIdx = 0;
    this.skidAcc = 0;
  }

  spawn(x, y, z, r, g, b, vx, vy, vz, life, grav) {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.base[i * 3] = r;
    this.base[i * 3 + 1] = g;
    this.base[i * 3 + 2] = b;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.life[i] = life;
    this.span[i] = life;
    this.grav[i] = grav;
  }

  burst(x, y, z, hex, n, speed, life) {
    const c = new THREE.Color(hex);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn(x, y, z, c.r, c.g, c.b, Math.cos(a) * Math.cos(e) * s, Math.abs(Math.sin(e)) * s + speed * 0.3, Math.sin(a) * Math.cos(e) * s, life * (0.6 + Math.random() * 0.7), 9);
    }
  }

  puff(x, y, z) {
    this.spawn(x, y, z, 0.45, 0.42, 0.4, (Math.random() - 0.5) * 1.2, 1.2 + Math.random(), (Math.random() - 0.5) * 1.2, 0.9 + Math.random() * 0.5, -1.5);
  }

  skid(x, z, heading, dt) {
    this.skidAcc += dt;
    if (this.skidAcc < 0.14) return;
    this.skidAcc = 0;
    const s = this.skids[this.skidIdx];
    this.skidIdx = (this.skidIdx + 1) % this.skids.length;
    s.mesh.position.set(x, 0.06, z);
    s.mesh.rotation.z = -heading;
    s.mesh.material.opacity = 0.55;
    s.mesh.visible = true;
    s.life = 8;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -1000; this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0; continue; }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
      const f = this.life[i] / this.span[i];
      this.col[i * 3] = this.base[i * 3] * f;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * f;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    for (const s of this.skids) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      s.mesh.material.opacity = Math.min(0.55, s.life * 0.12);
    }
  }
}
