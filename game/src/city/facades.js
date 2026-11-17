// Procedural building facades painted on canvases: one texture tile holds a grid of window
// cells (8 columns x 8 floors), plus a matching glow map of lit windows for the night.
import * as THREE from 'three';
import { makeRandom } from '../core/random.js';

export const FACADE_COLUMNS = 8;
export const FACADE_FLOORS = 8;
/** Width of one window column on a wall, in metres. */
export const WINDOW_SPACING = 3.4;
const CELL_PX = 64;

/** The look of each facade family. */
export const FACADE_STYLES = {
  glassBlue: { kind: 'glass', wall: '#24384d', glass: ['#7fb3dd', '#9ccbeb', '#5f93c2'], roof: '#3b4048', metal: 0.55, rough: 0.25 },
  glassTeal: { kind: 'glass', wall: '#1f4446', glass: ['#7cc9c2', '#a3dfd6', '#5aa8a6'], roof: '#3a4443', metal: 0.5, rough: 0.28 },
  glassGold: { kind: 'glass', wall: '#4a3a22', glass: ['#e8c58a', '#f2d9a8', '#c9a161'], roof: '#3f3a33', metal: 0.6, rough: 0.3 },
  office: { kind: 'bands', wall: '#d9d4cb', glass: ['#3d5469', '#4a6378', '#334a5e'], roof: '#6b6a68', metal: 0.1, rough: 0.7 },
  decoPink: { kind: 'deco', wall: '#f4b8c2', accent: '#ffffff', glass: ['#4f8fb0', '#6aa7c6'], roof: '#d9a6ad', metal: 0.05, rough: 0.85 },
  decoMint: { kind: 'deco', wall: '#a8e3cf', accent: '#fdf8ee', glass: ['#3f7ea3', '#5b98bb'], roof: '#8cc2b0', metal: 0.05, rough: 0.85 },
  decoCream: { kind: 'deco', wall: '#f6e7c8', accent: '#e98a6b', glass: ['#3b7598', '#5790b2'], roof: '#d6c6a6', metal: 0.05, rough: 0.85 },
  decoSky: { kind: 'deco', wall: '#a9d4f2', accent: '#ffffff', glass: ['#2f6489', '#46809f'], roof: '#8cb4d0', metal: 0.05, rough: 0.85 },
  stuccoPeach: { kind: 'stucco', wall: '#f0c39a', accent: '#8a5a3a', glass: ['#3a4f60', '#45606f'], roof: '#b8674a', metal: 0, rough: 0.9 },
  stuccoWhite: { kind: 'stucco', wall: '#efe9df', accent: '#3f7a8c', glass: ['#34495b', '#3f5868'], roof: '#c07a52', metal: 0, rough: 0.9 },
  brick: { kind: 'brick', wall: '#9c4f3b', accent: '#e9e0d0', glass: ['#2c3a46', '#36495a'], roof: '#4d4744', metal: 0, rough: 0.95 },
  warehouse: { kind: 'warehouse', wall: '#9aa3a8', accent: '#5d6a73', glass: ['#3a4a55'], roof: '#5a5f63', metal: 0.3, rough: 0.8 },
};

function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = FACADE_COLUMNS * CELL_PX;
  canvas.height = FACADE_FLOORS * CELL_PX;
  return canvas;
}

function speckle(ctx, random, color, count) {
  ctx.fillStyle = color;
  for (let k = 0; k < count; k += 1) ctx.fillRect(random() * ctx.canvas.width, random() * ctx.canvas.height, 2, 2);
}

/** The rectangle of the window inside a cell, in pixels relative to the cell corner. */
function windowRect(kind) {
  switch (kind) {
    case 'glass': return [3, 3, CELL_PX - 6, CELL_PX - 14];
    case 'bands': return [2, 14, CELL_PX - 4, 32];
    case 'deco': return [8, 16, CELL_PX - 16, 30];
    case 'stucco': return [18, 14, 28, 36];
    case 'brick': return [16, 10, 32, 42];
    default: return [10, 22, CELL_PX - 20, 12];
  }
}

function paintWall(ctx, style, random) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = style.wall;
  ctx.fillRect(0, 0, width, height);
  if (style.kind === 'brick') {
    ctx.strokeStyle = 'rgba(40,20,15,0.35)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += 6) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      for (let x = (y / 6) % 2 ? 0 : 7; x < width; x += 14) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 6); ctx.stroke(); }
    }
  } else if (style.kind === 'warehouse') {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = 0; x < width; x += 8) ctx.fillRect(x, 0, 3, height);
  } else {
    speckle(ctx, random, 'rgba(0,0,0,0.05)', 900);
    speckle(ctx, random, 'rgba(255,255,255,0.06)', 600);
  }
}

function paintCell(ctx, glow, style, random, col, floor) {
  const x = col * CELL_PX;
  const y = floor * CELL_PX;
  const [wx, wy, ww, wh] = windowRect(style.kind);
  if (style.kind === 'deco') {
    ctx.fillStyle = style.accent;
    ctx.fillRect(x, y + 50, CELL_PX, 6);
    ctx.fillRect(x, y + 4, CELL_PX, 3);
  }
  if (style.kind === 'bands') {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y + 48, CELL_PX, 2);
  }
  if (style.kind === 'warehouse' && (floor % 2 === 1 || col % 3 !== 1)) return;
  // Window pane with a sky-reflection gradient.
  const tone = random.pick(style.glass);
  const gradient = ctx.createLinearGradient(0, y + wy, 0, y + wy + wh);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.08, tone);
  gradient.addColorStop(1, shade(tone, -0.35));
  ctx.fillStyle = gradient;
  ctx.fillRect(x + wx, y + wy, ww, wh);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(x + wx, y + wy + wh * 0.7);
  ctx.lineTo(x + wx + ww * 0.45, y + wy);
  ctx.lineTo(x + wx + ww * 0.62, y + wy);
  ctx.lineTo(x + wx, y + wy + wh);
  ctx.fill();
  if (style.kind === 'glass') {
    ctx.fillStyle = shade(style.wall, -0.2);
    ctx.fillRect(x + wx + ww / 2 - 1, y + wy, 2, wh);
  }
  if (style.kind === 'stucco' || style.kind === 'brick') {
    ctx.fillStyle = style.accent;
    ctx.fillRect(x + wx - 3, y + wy + wh, ww + 6, 4);
    if (style.kind === 'stucco') {
      ctx.fillRect(x + wx - 7, y + wy, 5, wh);
      ctx.fillRect(x + wx + ww + 2, y + wy, 5, wh);
    }
  }
  // Night: about a third of the windows are lit, in warm or cool light.
  if (random() < 0.36) {
    glow.fillStyle = random() < 0.75 ? '#ffd690' : '#cfe6ff';
    glow.globalAlpha = 0.55 + random() * 0.45;
    glow.fillRect(x + wx, y + wy, ww, wh);
    glow.globalAlpha = 1;
  }
}

/** Lighten (amount > 0) or darken a hex colour. */
export function shade(hex, amount) {
  const c = new THREE.Color(hex);
  if (amount >= 0) c.lerp(new THREE.Color('#ffffff'), amount);
  else c.multiplyScalar(1 + amount);
  return `#${c.getHexString()}`;
}

function toTexture(canvas, srgb) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Paint the colour and glow textures for one style variant. */
export function paintFacade(styleName, variant) {
  const style = FACADE_STYLES[styleName];
  const random = makeRandom(styleName.length * 977 + variant * 131 + styleName.charCodeAt(0));
  const colorCanvas = makeCanvas();
  const glowCanvas = makeCanvas();
  const ctx = colorCanvas.getContext('2d');
  const glow = glowCanvas.getContext('2d');
  glow.fillStyle = '#000000';
  glow.fillRect(0, 0, glowCanvas.width, glowCanvas.height);
  paintWall(ctx, style, random);
  for (let floor = 0; floor < FACADE_FLOORS; floor += 1) {
    for (let col = 0; col < FACADE_COLUMNS; col += 1) paintCell(ctx, glow, style, random, col, floor);
  }
  return { map: toTexture(colorCanvas, true), glowMap: toTexture(glowCanvas, true) };
}
