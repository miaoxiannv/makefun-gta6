// The radar in the corner: a round, heading-up minimap. The whole city is painted once into an
// off-screen canvas (roads, blocks by district, parks, beach, sea); each frame that image is
// rotated under the player's arrow and the live blips are drawn on top: cash, cars, the
// hospital and a north marker riding the rim.
import { CITY_HALF, GRID, HOSPITAL, SHORE } from '../config.js';

const SCALE = 1.1; // radar pixels per metre
const PAD = 260; // metres of map painted beyond the city on every side
const BLOCK_COLOURS = { center: '#7f8fa3', beach: '#d7b9a1', heights: '#93a37c', docks: '#8c8778', brisa: '#a99a86', coral: '#8e96a0' };

export class Radar {
  constructor(canvas, plan) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.size = canvas.width;
    this.map = this.paintMap(plan);
  }

  paintMap(plan) {
    const span = (CITY_HALF + PAD) * 2;
    const map = document.createElement('canvas');
    map.width = map.height = Math.ceil(span);
    const ctx = map.getContext('2d');
    const at = (v) => v + CITY_HALF + PAD; // world metre -> map pixel (1 px per metre)
    ctx.fillStyle = '#5a6a4d';
    ctx.fillRect(0, 0, map.width, map.height);
    // city asphalt
    ctx.fillStyle = '#d6d9dc';
    ctx.fillRect(at(-CITY_HALF), at(-CITY_HALF), CITY_HALF * 2, CITY_HALF * 2);
    // sand and sea
    ctx.fillStyle = '#e8d49e';
    ctx.fillRect(at(CITY_HALF), 0, SHORE.sand, map.height);
    ctx.fillStyle = '#3d86b8';
    ctx.fillRect(at(CITY_HALF + SHORE.sand - 12), 0, map.width, map.height);
    for (const b of plan.blocks) {
      ctx.fillStyle = b.park ? '#6fa860' : BLOCK_COLOURS[b.kind];
      ctx.fillRect(at(b.x0), at(b.z0), GRID.block, GRID.block);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (const b of plan.buildings) ctx.fillRect(at(b.x0), at(b.z0), b.x1 - b.x0, b.z1 - b.z0);
    this.at = at;
    return map;
  }

  /**
   * Draw for a player at (x, z) facing `heading`, with the view turned to camera `yaw`.
   * `blips` holds {cars, cash} lists, plus `police` cruisers (flashing red/blue), the
   * `mission` target (a gold diamond) and `enemies` (red dots), and `time`.
   */
  draw({ x, z, yaw, heading, inCar, cars, cash, police = [], mission = null, enemies = [], time = 0 }) {
    const { ctx, size } = this;
    const r = size / 2;
    const turn = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(r, r);
    ctx.rotate(turn);
    ctx.scale(SCALE, SCALE);
    ctx.drawImage(this.map, -this.at(x), -this.at(z));

    // blips in world metres relative to the player
    const rel = (px, pz) => [px - x, pz - z];
    ctx.fillStyle = 'rgba(40,40,48,0.75)';
    for (const car of cars) {
      const [dx, dz] = rel(car.position.x, car.position.z);
      if (Math.abs(dx) > 130 || Math.abs(dz) > 130) continue;
      ctx.save();
      ctx.translate(dx, dz);
      ctx.rotate(-car.heading);
      ctx.fillRect(-1, -2.2, 2, 4.4);
      ctx.restore();
    }
    // police cruisers flash red/blue on the radar
    for (const car of police) {
      const [dx, dz] = rel(car.position.x, car.position.z);
      if (Math.abs(dx) > 130 || Math.abs(dz) > 130) continue;
      ctx.fillStyle = Math.floor(time * 4) % 2 === 0 ? '#ff3b30' : '#2f7bff';
      ctx.beginPath();
      ctx.arc(dx, dz, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // rival crew: small red dots
    ctx.fillStyle = '#ff2211';
    for (const e of enemies) {
      const [dx, dz] = rel(e.position.x, e.position.z);
      if (Math.abs(dx) > 130 || Math.abs(dz) > 130) continue;
      ctx.beginPath();
      ctx.arc(dx, dz, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // icons stay upright, so place them in screen space
    const toScreen = (px, pz) => {
      const [dx, dz] = rel(px, pz);
      const c = Math.cos(turn);
      const s = Math.sin(turn);
      return [r + (dx * c - dz * s) * SCALE, r + (dx * s + dz * c) * SCALE];
    };
    const edge = (sx, sy, margin = 10) => {
      const dx = sx - r;
      const dy = sy - r;
      const d = Math.hypot(dx, dy);
      const max = r - margin;
      return d > max ? [r + (dx / d) * max, r + (dy / d) * max, true] : [sx, sy, false];
    };
    // the mission target: a gold diamond, clamped to the rim when far away
    if (mission) {
      const [mx, my, clamped] = edge(...toScreen(mission.x, mission.z), 12);
      ctx.fillStyle = '#ffd54a';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(Math.PI / 4);
      const half = clamped ? 6 : 8;
      ctx.fillRect(-half, -half, half * 2, half * 2);
      ctx.strokeRect(-half, -half, half * 2, half * 2);
      ctx.restore();
    }
    for (const d of cash) {
      if (!d.active) continue;
      const [sx, sy] = toScreen(d.x, d.z);
      if (Math.hypot(sx - r, sy - r) > r - 6) continue;
      ctx.fillStyle = '#1f7a37';
      ctx.beginPath(); ctx.arc(sx, sy, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9ffd5';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', sx, sy + 0.5);
    }
    {
      const [hx, hy] = edge(...toScreen(HOSPITAL.x, HOSPITAL.z), 9);
      ctx.fillStyle = '#e8eef5';
      ctx.fillRect(hx - 6, hy - 6, 12, 12);
      ctx.fillStyle = '#d32f2f';
      ctx.fillRect(hx - 1.5, hy - 4.5, 3, 9);
      ctx.fillRect(hx - 4.5, hy - 1.5, 9, 3);
    }
    // north marker
    const [nx, ny] = edge(...toScreen(x, z - 10000), 11);
    ctx.fillStyle = 'rgba(10,14,22,0.85)';
    ctx.beginPath(); ctx.arc(nx, ny, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny + 0.5);

    // the player
    const a = Math.atan2(Math.cos(heading), Math.sin(heading)) + turn;
    ctx.save();
    ctx.translate(r, r);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = inCar ? '#ffd54a' : '#ffffff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // rim
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r, r, r - 2, 0, Math.PI * 2); ctx.stroke();
  }
}
