// Marisol Beach and the open ocean east of town: a sand strip, a moving foam line and a
// shaded water surface with small waves, sky reflection and sun glitter.
import * as THREE from 'three';
import { COAST, HALF } from '../config.js';

const WATER_VERTEX = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  world.y += sin(world.x * 0.08 + uTime * 1.1) * 0.12 + sin(world.z * 0.11 + uTime * 0.8) * 0.1;
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const WATER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSun;
uniform vec3 uSunDirection;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uShore;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  vec3 normal = normalize(vec3(
    sin(p.x * 0.35 + uTime * 1.7) * 0.06 + sin((p.x + p.y) * 0.9 + uTime * 2.3) * 0.03,
    1.0,
    cos(p.y * 0.4 + uTime * 1.3) * 0.06 + sin((p.x - p.y) * 0.7 + uTime * 1.9) * 0.03));
  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = pow(1.0 - max(dot(view, normal), 0.0), 3.0);
  float shallow = 1.0 - smoothstep(0.0, 90.0, vWorld.x - uShore);
  vec3 color = mix(uDeep, uShallow, shallow * 0.8);
  color = mix(color, uSky, fresnel * 0.7);
  vec3 halfway = normalize(view + normalize(uSunDirection));
  color += uSun * pow(max(dot(normal, halfway), 0.0), 180.0) * 2.5;
  float fogAmount = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
  gl_FragColor = vec4(mix(color, uFogColor, fogAmount), 1.0);
  #include <colorspace_fragment>
}`;

export class Coast {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'coast';
    const shore = HALF + COAST.sandWidth;
    const sand = new THREE.Mesh(
      new THREE.BoxGeometry(COAST.sandWidth + 40, 0.1, HALF * 2 + 400),
      new THREE.MeshStandardMaterial({ color: '#ecd9ac', roughness: 1 }),
    );
    sand.position.set(HALF + (COAST.sandWidth + 40) / 2, 0, 0);
    sand.receiveShadow = true;

    this.foamMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false });
    this.foam = new THREE.Mesh(new THREE.PlaneGeometry(3, HALF * 2 + 400), this.foamMaterial);
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.set(shore, 0.12, 0);

    this.uniforms = {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#0d5f86') },
      uShallow: { value: new THREE.Color('#3fd0d0') },
      uSky: { value: new THREE.Color('#bfe3f7') },
      uSun: { value: new THREE.Color('#ffffff') },
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uFogColor: { value: new THREE.Color('#c5e4f6') },
      uFogNear: { value: 160 },
      uFogFar: { value: 900 },
      uShore: { value: shore },
    };
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 2400, 80, 80),
      new THREE.ShaderMaterial({ vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, uniforms: this.uniforms }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(shore + 800, 0.02, 0);
    this.group.add(sand, this.foam, water);
    scene.add(this.group);
  }

  update(time, lighting, fog) {
    this.uniforms.uTime.value = time;
    this.uniforms.uSky.value.copy(lighting.horizon);
    this.uniforms.uSun.value.copy(lighting.sun).multiplyScalar(lighting.isMoon ? 0.3 : 1);
    this.uniforms.uSunDirection.value.copy(lighting.sunDirection);
    this.uniforms.uFogColor.value.copy(fog.color);
    this.uniforms.uFogNear.value = fog.near;
    this.uniforms.uFogFar.value = fog.far;
    const darkness = 1 - lighting.night * 0.75;
    this.uniforms.uDeep.value.set('#0d5f86').multiplyScalar(darkness);
    this.uniforms.uShallow.value.set('#3fd0d0').multiplyScalar(darkness);
    this.foam.position.x = HALF + COAST.sandWidth + Math.sin(time * 0.6) * 1.2;
    this.foamMaterial.opacity = 0.45 + Math.sin(time * 0.6 + 1) * 0.15;
  }
}
