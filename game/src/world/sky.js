import * as THREE from 'three';
import { makeDaylight, sampleDaylight } from './daylight.js';

const DOME_VERTEX =  `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
    gl_Position.z = gl_Position.w; // always at the far plane
  }`;

const DOME_FRAGMENT =  `
  uniform vec3 zenith;
  uniform vec3 horizon;
  uniform vec3 sunColour;
  uniform vec3 sunDir;
  uniform vec3 moonDir;
  uniform float sunVisible;
  uniform float night;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float up = max(d.y, 0.0);
    vec3 col = mix(horizon, zenith, pow(up, 0.55));
    // below the horizon fade to the horizon colour (hidden by the sea and land anyway)
    col = mix(col, horizon * 0.9, smoothstep(0.0, -0.2, d.y));
    float s = max(dot(d, sunDir), 0.0);
    col += sunColour * (pow(s, 8.0) * 0.35 + pow(s, 64.0) * 0.6) * sunVisible;
    col += sunColour * smoothstep(0.9993, 0.9997, s) * 4.0 * sunVisible;
    float m = max(dot(d, moonDir), 0.0);
    col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9990, 0.9994, m) * night * 1.6;
    col += vec3(0.4, 0.45, 0.7) * pow(m, 30.0) * night * 0.25;
    // stars
    vec3 cell = floor(d * 280.0);
    float star = step(0.9965, hash(cell)) * smoothstep(0.05, 0.3, d.y);
    col += vec3(star) * night * (0.6 + 0.4 * hash(cell + 3.0));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export class Sky {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.day = makeDaylight();
    this.uniforms = {
      zenith: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      sunColour: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3() },
      moonDir: { value: new THREE.Vector3() },
      sunVisible: { value: 1 },
      night: { value: 0 },
    };
    const domeMat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: DOME_VERTEX, fragmentShader: DOME_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), domeMat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1;
    scene.add(this.dome);

    this.sun = new THREE.DirectionalLight('#ffffff', 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -70;
    sc.right = sc.top = 70;
    sc.near = 1;
    sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1);
    scene.add(this.hemi);
    
    this.streetGlow = new THREE.PointLight('#ffc27a', 0, 46, 1.2);
    scene.add(this.streetGlow);
    scene.fog = new THREE.Fog('#cfe0ea', 120, 900);

    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envDome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), domeMat);
    this.envScene.add(this.envDome);
    this.envGround = new THREE.Mesh(new THREE.CircleGeometry(90, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#555' }));
    this.envGround.position.y = -5;
    this.envScene.add(this.envGround);
    this.bakedHour = -99;
    this.envTarget = null;
  }

  update(hour, focus, cameraPos) {
    const d = sampleDaylight(hour, this.day);
    const u = this.uniforms;
    u.zenith.value.copy(d.zenith);
    u.horizon.value.copy(d.horizon);
    u.sunColour.value.copy(d.sun);
    u.sunDir.value.copy(d.sunDir);
    u.moonDir.value.copy(d.moonDir);
    u.sunVisible.value = d.sunVisible;
    u.night.value = d.night;
    this.dome.position.copy(cameraPos);

    this.sun.color.copy(d.sun);
    this.sun.intensity = d.sunI;
    
    const texel = 140 / 2048;
    const fx = Math.round(focus.x / texel) * texel;
    const fz = Math.round(focus.z / texel) * texel;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + d.lightDir.x * 200, d.lightDir.y * 200, fz + d.lightDir.z * 200);

    this.streetGlow.position.set(focus.x, 9, focus.z);
    this.streetGlow.intensity = d.night * 90;
    this.hemi.color.copy(d.hemiSky);
    this.hemi.groundColor.copy(d.hemiGround);
    this.hemi.intensity = d.hemiI;
    this.scene.fog.color.copy(d.fog);
    this.scene.fog.near = 140 - d.night * 40;
    this.scene.fog.far = 950 - d.night * 300;

    if (Math.abs(hour - this.bakedHour) > 0.2) this.bake(d);
    return d;
  }

  bake(d) {
    this.bakedHour = d.hour;
    this.envGround.material.color.copy(d.hemiGround).multiplyScalar(1.4);
    const next = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 400);
    this.envTarget?.dispose();
    this.envTarget = next;
    this.scene.environment = next.texture;
  }
}