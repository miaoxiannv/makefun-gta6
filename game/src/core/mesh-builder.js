// A small geometry accumulator. City blocks, street markings, cars and characters are built
// out of many boxes and slanted boxes; adding them all into one BufferGeometry per material
// keeps the draw-call count low enough for the whole city to render every frame.
import * as THREE from 'three';

const WHITE = new THREE.Color(1, 1, 1);
const FACES = [
  // corner indices for each face of an 8-corner solid, wound counter-clockwise from outside
  { name: 'bottom', idx: [0, 1, 2, 3] },
  { name: 'top', idx: [7, 6, 5, 4] },
  { name: 'front', idx: [3, 2, 6, 7] },
  { name: 'back', idx: [1, 0, 4, 5] },
  { name: 'left', idx: [0, 3, 7, 4] },
  { name: 'right', idx: [2, 1, 5, 6] },
];

export class MeshBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.uvs = [];
    this.colors = [];
  }

  get empty() {
    return this.positions.length === 0;
  }

  /** One flat quad from four [x, y, z] corners (counter-clockwise seen from the front). */
  quad(a, b, c, d, { color = WHITE, uv = null, normal = null } = {}) {
    let n = normal;
    if (!n) {
      const ac = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      const bd = new THREE.Vector3(d[0] - b[0], d[1] - b[1], d[2] - b[2]);
      // The cross product of the two diagonals is robust even when the quad is slightly bent.
      const v = new THREE.Vector3().crossVectors(ac, bd).normalize();
      n = [v.x, v.y, v.z];
    }
    const corners = [a, b, c, a, c, d];
    const uvq = uv ?? [[0, 0], [1, 0], [1, 1], [0, 1]];
    const uvs = [uvq[0], uvq[1], uvq[2], uvq[0], uvq[2], uvq[3]];
    for (let k = 0; k < 6; k += 1) {
      this.positions.push(corners[k][0], corners[k][1], corners[k][2]);
      this.normals.push(n[0], n[1], n[2]);
      this.uvs.push(uvs[k][0], uvs[k][1]);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  /**
   * A solid from 8 corners: 0-3 the bottom ring (-x-z, +x-z, +x+z, -x+z), 4-7 the top ring in
   * the same order. `skip` names faces to leave out; `tile` sets metres per texture repeat so
   * facades and pavements wrap their textures at a constant scale.
   */
  solid(corners, { color = WHITE, skip = [], tile = null, faceColors = {} } = {}) {
    for (const face of FACES) {
      if (skip.includes(face.name)) continue;
      const [a, b, c, d] = face.idx.map((i) => corners[i]);
      let uv = null;
      if (tile) {
        const w = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / tile[0];
        const h = Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]) / tile[1];
        const u0 = tile[2] ?? 0;
        uv = [[u0, 0], [u0 + w, 0], [u0 + w, h], [u0, h]];
      }
      this.quad(a, b, c, d, { color: faceColors[face.name] ?? color, uv });
    }
  }

  /** Axis-aligned box centred on (x, y, z), optionally turned by `yaw` about its own centre. */
  box(x, y, z, sx, sy, sz, options = {}) {
    const { yaw = 0 } = options;
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const ring = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const corners = [];
    for (const dy of [-hy, hy]) {
      for (const [dx, dz] of ring) corners.push([x + dx * c + dz * s, y + dy, z - dx * s + dz * c]);
    }
    this.solid(corners, options);
  }

  /**
   * A slanted box for car cabins and roofs: width `sx`, the bottom spans z in [z0, z1] and the
   * top spans [t0, t1], from height y0 up to y1. `inset` narrows the top for a tumblehome.
   */
  wedge(x, y0, y1, z0, z1, t0, t1, sx, { inset = 0, ...options } = {}) {
    const h = sx / 2;
    const ht = h - inset;
    const corners = [
      [x - h, y0, z0], [x + h, y0, z0], [x + h, y0, z1], [x - h, y0, z1],
      [x - ht, y1, t0], [x + ht, y1, t0], [x + ht, y1, t1], [x - ht, y1, t1],
    ];
    this.solid(corners, options);
  }

  /** A flat horizontal rectangle at height y, facing up. */
  flat(x0, z0, x1, z1, y, options = {}) {
    const { tile = null } = options;
    const uv = tile ? [[x0 / tile[0], -z1 / tile[1]], [x1 / tile[0], -z1 / tile[1]], [x1 / tile[0], -z0 / tile[1]], [x0 / tile[0], -z0 / tile[1]]] : null;
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], { ...options, uv, normal: [0, 1, 0] });
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.computeBoundingSphere();
    return g;
  }

  /** Build straight into a mesh with the given material. */
  mesh(material, { shadows = true } = {}) {
    const m = new THREE.Mesh(this.build(), material);
    m.castShadow = shadows;
    m.receiveShadow = true;
    return m;
  }
}
