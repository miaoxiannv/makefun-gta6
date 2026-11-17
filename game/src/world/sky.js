// Sky dome with a gradient and a glowing sun, the sun/moon light with a shadow box that
// follows the player, hemisphere fill light and distance fog, all driven by the clock.
import * as THREE from 'three';
import { lightingAt, makeLighting } from './time-of-day.js';

const SKY_VERTEX = /* glsl */ `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  vec4 world = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w; // always at the far plane
}`;

const SKY_FRAGMENT = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSun;
uniform vec3 uSunDirection;
uniform float uNight;
varying vec3 vDirection;
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 dir = normalize(vDirection);
  float up = clamp(dir.y, 0.0, 1.0);
  vec3 color = mix(uHorizon, uTop, pow(up, 0.55));
  color = mix(color, uHorizon * 0.7, smoothstep(0.0, -0.2, dir.y));
  float sunAmount = max(dot(dir, normalize(uSunDirection)), 0.0);
  color += uSun * (pow(sunAmount, 900.0) * 3.0 + pow(sunAmount, 12.0) * 0.35);
  // Stars come out at night.
  vec3 cell = floor(dir * 300.0);
  float star = step(0.9975, hash(cell)) * up * uNight;
  color += vec3(star);
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene) {
    this.lighting = makeLighting();
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uSun: { value: new THREE.Color() },
      uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
      uNight: { value: 0 },
    };
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(1500, 32, 16),
      new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    dome.frustumCulled = false;
    dome.renderOrder = -1;
    this.dome = dome;

    this.sunLight = new THREE.DirectionalLight('#ffffff', 3);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const box = this.sunLight.shadow.camera;
    box.left = -75; box.right = 75; box.top = 75; box.bottom = -75; box.near = 1; box.far = 400;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.03;
    this.hemisphere = new THREE.HemisphereLight('#bfdfff', '#8a7a5a', 1);
    scene.fog = new THREE.Fog('#c5e4f6', 160, 900);
    scene.add(dome, this.sunLight, this.sunLight.target, this.hemisphere);
    this.scene = scene;
  }

  /** Recolour everything for `hour` and centre the shadow box on `focus`. */
  update(hour, focus, cameraPosition) {
    const l = lightingAt(hour, this.lighting);
    this.uniforms.uTop.value.copy(l.top);
    this.uniforms.uHorizon.value.copy(l.horizon);
    this.uniforms.uSun.value.copy(l.isMoon ? new THREE.Color('#1a2040') : l.sun);
    this.uniforms.uSunDirection.value.copy(l.sunDirection);
    this.uniforms.uNight.value = l.night;
    this.dome.position.copy(cameraPosition);

    this.sunLight.color.copy(l.sun);
    this.sunLight.intensity = l.sunPower;
    this.sunLight.target.position.copy(focus);
    this.sunLight.position.copy(focus).addScaledVector(l.sunDirection, 200);
    this.hemisphere.intensity = l.ambient;
    this.hemisphere.color.copy(l.top).lerp(new THREE.Color('#ffffff'), 0.45);
    this.scene.fog.color.copy(l.horizon);
    return l;
  }
}
