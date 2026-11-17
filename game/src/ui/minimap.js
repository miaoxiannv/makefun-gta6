// The radar in the top-left corner: a pre-painted top-down map of Port Solano (roads,
// sidewalks, buildings, parks, beach, ocean) drawn rotated with the camera, with the player
// arrow, cars, cash drops and a north marker on top.
import { CITY, COAST, HALF } from '../config.js';

const PIXELS_PER_METRE = 2;
const MAP_MIN_X = -HALF - 30;
const MAP_MIN_Z = -HALF - 30;
const MAP_W = HALF * 2 + COAST.sandWidth + 140;
const MAP_H = HALF * 2 + 60;

function paintCityMap(layout) {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_W * PIXELS_PER_METRE;
  canvas.height = MAP_H * PIXELS_PER_METRE;
  const ctx = canvas.getContext('2d');
  ctx.scale(PIXELS_PER_METRE, PIXELS_PER_METRE);
  ctx.translate(-MAP_MIN_X, -MAP_MIN_Z);
  ctx.fillStyle = '#6f7f4f';
  ctx.fillRect(MAP_MIN_X, MAP_MIN_Z, MAP_W, MAP_H);
  ctx.fillStyle = '#555c66';
  ctx.fillRect(-HALF, -HALF, HALF * 2, HALF * 2);
  ctx.fillStyle = '#e8d6a6';
  ctx.fillRect(HALF, MAP_MIN_Z, COAST.sandWidth, MAP_H);
  ctx.fillStyle = '#2b8fb8';
  ctx.fillRect(HALF + COAST.sandWidth, MAP_MIN_Z, 200, MAP_H);
  for (const block of layout.blocks) {
    ctx.fillStyle = '#a9a69f';
    ctx.fillRect(block.x0, block.z0, CITY.block, CITY.block);
    if (block.kind === 'park') {
      ctx.fillStyle = '#6aa94e';
      ctx.fillRect(block.x0 + CITY.sidewalk, block.z0 + CITY.sidewalk, CITY.block - CITY.sidewalk * 2, CITY.block - CITY.sidewalk * 2);
    }
  }
  for (const b of layout.buildings) {
    ctx.fillStyle = b.h > 40 ? '#7b8494' : '#8d929a';
    ctx.fillRect(b.x - b.w / 2, b.z - b.d / 2, b.w, b.d);
  }
  return canvas;
}

export class Minimap {
  constructor(canvas, layout) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = paintCityMap(layout);
  }

  /**
   * Draw the radar. `view` = { x, z, yaw, heading, inCar, cars, cash, blips }: the map turns
   * so the camera's forward points up.
   */
  draw(view) {
    const { ctx, canvas } = this;
    const size = canvas.width;
    const scale = view.inCar ? 0.75 : 1.1;
    ctx.save();
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#6f7f4f';
    ctx.fillRect(0, 0, size, size);

    ctx.translate(size / 2, size / 2);
    ctx.rotate(view.yaw);
    ctx.scale(scale, scale);
    ctx.translate(-view.x, -view.z);
    ctx.drawImage(this.map, MAP_MIN_X, MAP_MIN_Z, MAP_W, MAP_H);

    for (const spot of view.cash) {
      if (!spot.active) continue;
      ctx.fillStyle = '#3ddc6a';
      ctx.beginPath();
      ctx.arc(spot.x, spot.z, 4 / scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0b3a18';
      ctx.lineWidth = 1.4 / scale;
      ctx.stroke();
    }
    for (const car of view.cars) {
      ctx.save();
      ctx.translate(car.position.x, car.position.z);
      ctx.rotate(-car.heading);
      ctx.fillStyle = car.driver ? '#ffffff' : '#4fa3ff';
      ctx.fillRect(-car.type.width / 2 - 0.4, -car.type.length / 2 - 0.4, car.type.width + 0.8, car.type.length + 0.8);
      ctx.restore();
    }
    for (const blip of view.blips ?? []) {
      ctx.fillStyle = blip.color;
      ctx.beginPath();
      ctx.arc(blip.x, blip.z, 5 / scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // The player arrow, pointing along their heading.
    ctx.save();
    ctx.translate(view.x, view.z);
    ctx.rotate(Math.PI - view.heading);
    ctx.scale(1 / scale, 1 / scale);
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(7.5, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-7.5, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    // North marker on the rim.
    const northAngle = view.yaw - Math.PI / 2;
    const r = size / 2 - 14;
    ctx.fillStyle = 'rgba(10,14,22,0.85)';
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(northAngle) * r, size / 2 + Math.sin(northAngle) * r, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', size / 2 + Math.cos(northAngle) * r, size / 2 + Math.sin(northAngle) * r + 1);
  }
}
