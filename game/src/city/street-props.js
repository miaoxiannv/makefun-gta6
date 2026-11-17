// Street furniture drawn with instancing: lamp posts (with glowing heads and light pools at
// night) and palm trees with drooping fronds.
import * as THREE from 'three';
import { CITY } from '../config.js';

const LAMP_HEIGHT = 7.2;
const FRONDS = 8;

function instanced(geometry, material, count, castShadow = true) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = false;
  return mesh;
}

function glowPoolTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,214,150,0.9)');
  gradient.addColorStop(0.5, 'rgba(255,190,120,0.35)');
  gradient.addColorStop(1, 'rgba(255,170,100,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class StreetProps {
  constructor(layout) {
    this.group = new THREE.Group();
    this.group.name = 'street-props';
    this.buildLamps(layout.lamps);
    this.buildPalms(layout.palms);
  }

  buildLamps(lamps) {
    const metal = new THREE.MeshStandardMaterial({ color: '#2f3438', roughness: 0.5, metalness: 0.6 });
    this.lampHeadMaterial = new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: new THREE.Color('#ffd28a'), emissiveIntensity: 0.1 });
    this.poolMaterial = new THREE.MeshBasicMaterial({ map: glowPoolTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const poleGeometry = new THREE.CylinderGeometry(0.09, 0.14, LAMP_HEIGHT, 8);
    poleGeometry.translate(0, LAMP_HEIGHT / 2, 0);
    const armGeometry = new THREE.BoxGeometry(0.1, 0.1, 2.2);
    armGeometry.translate(0, 0, 1.1);
    const headGeometry = new THREE.BoxGeometry(0.45, 0.16, 0.8);
    const poolGeometry = new THREE.PlaneGeometry(9, 9);
    poolGeometry.rotateX(-Math.PI / 2);

    const poles = instanced(poleGeometry, metal, lamps.length);
    const arms = instanced(armGeometry, metal, lamps.length);
    const heads = instanced(headGeometry, this.lampHeadMaterial, lamps.length, false);
    const pools = instanced(poolGeometry, this.poolMaterial, lamps.length, false);
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Matrix4();
    lamps.forEach((lamp, index) => {
      const yaw = Math.atan2(lamp.dirX, lamp.dirZ);
      rotation.makeRotationY(yaw);
      matrix.copy(rotation).setPosition(lamp.x, CITY.curb, lamp.z);
      poles.setMatrixAt(index, matrix);
      matrix.copy(rotation).setPosition(lamp.x, CITY.curb + LAMP_HEIGHT - 0.1, lamp.z);
      arms.setMatrixAt(index, matrix);
      matrix.copy(rotation).setPosition(lamp.x + lamp.dirX * 2.1, CITY.curb + LAMP_HEIGHT - 0.22, lamp.z + lamp.dirZ * 2.1);
      heads.setMatrixAt(index, matrix);
      matrix.identity().setPosition(lamp.x + lamp.dirX * 2.6, 0.04, lamp.z + lamp.dirZ * 2.6);
      pools.setMatrixAt(index, matrix);
    });
    pools.renderOrder = 2;
    this.group.add(poles, arms, heads, pools);
  }

  buildPalms(palms) {
    const bark = new THREE.MeshStandardMaterial({ color: '#8b6a4a', roughness: 1 });
    const leaf = new THREE.MeshStandardMaterial({ color: '#3f8f3a', roughness: 0.85, side: THREE.DoubleSide });
    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.3, 1, 7, 4);
    trunkGeometry.translate(0, 0.5, 0);
    // A frond: a long tapered leaf, flat, reaching out along +z.
    const frondGeometry = new THREE.BufferGeometry();
    const points = [];
    const segments = 6;
    for (let s = 0; s <= segments; s += 1) {
      const t = s / segments;
      const width = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.55 + 0.05;
      const droop = -t * t * 1.8;
      points.push(-width, droop, t * 3.6, width, droop, t * 3.6);
    }
    const index = [];
    for (let s = 0; s < segments; s += 1) {
      const a = s * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    frondGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    frondGeometry.setIndex(index);
    frondGeometry.computeVertexNormals();

    const trunks = instanced(trunkGeometry, bark, palms.length);
    const fronds = instanced(frondGeometry, leaf, palms.length * FRONDS);
    const matrix = new THREE.Matrix4();
    const top = new THREE.Matrix4();
    const turn = new THREE.Matrix4();
    const tilt = new THREE.Matrix4();
    const lean = new THREE.Matrix4();
    palms.forEach((palm, p) => {
      lean.makeRotationZ(palm.lean);
      matrix.makeScale(1, palm.height, 1).premultiply(lean).setPosition(palm.x, palm.y, palm.z);
      trunks.setMatrixAt(p, matrix);
      const topX = palm.x - Math.sin(palm.lean) * palm.height;
      const topY = palm.y + Math.cos(palm.lean) * palm.height;
      top.makeTranslation(topX, topY, palm.z);
      for (let f = 0; f < FRONDS; f += 1) {
        turn.makeRotationY((f / FRONDS) * Math.PI * 2 + p * 0.7);
        tilt.makeRotationX(-0.35 + (f % 2) * 0.25);
        matrix.copy(top).multiply(turn).multiply(tilt);
        fronds.setMatrixAt(p * FRONDS + f, matrix);
      }
    });
    this.group.add(trunks, fronds);
  }

  setNight(amount) {
    this.lampHeadMaterial.emissiveIntensity = 0.1 + amount * 3;
    this.poolMaterial.opacity = amount * 0.85;
  }
}
