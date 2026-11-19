import * as THREE from 'three';
import { makeRng } from './rng.js';

function canvasTexture(size, paint, { srgb = true, repeat = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function speckle(ctx, size, rng, count, colours, alpha = 0.25, max = 2) {
  for (let i = 0; i < count; i += 1) {
    ctx.globalAlpha = alpha * rng();
    ctx.fillStyle = rng.pick(colours);
    const s = 1 + rng() * max;
    ctx.fillRect(rng() * size, rng() * size, s, s);
  }
  ctx.globalAlpha = 1;
}

export function asphaltTexture() {
  const rng = makeRng(11);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#4a4c52';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 5000, ['#2c2e33', '#6b6d72', '#57595e', '#3a3c40'], 0.6, 2);
    
    for (let i = 0; i < 5; i += 1) {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#202226';
      ctx.beginPath();
      ctx.ellipse(rng() * s, rng() * s, 20 + rng() * 40, 10 + rng() * 25, rng() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}

export function pavementTexture() {
  const rng = makeRng(12);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#c9c2b4';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 2500, ['#b3ab9c', '#ddd6c8', '#a59d8e'], 0.5, 2);
    ctx.strokeStyle = 'rgba(90,82,70,0.45)';
    ctx.lineWidth = 2;
    const step = s / 4;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(s, i * step); ctx.stroke();
    }
  });
}

export function grassTexture() {
  const rng = makeRng(13);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#5f8f3e';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 9000, ['#4c7a30', '#77a64e', '#86b35a', '#557f36'], 0.7, 3);
  });
}

export function sandTexture() {
  const rng = makeRng(14);
  return canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#e8d3a6';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 7000, ['#d8bf8c', '#f3e3bf', '#cdb27c', '#fff3d8'], 0.6, 2);
  });
}

export function roofTexture() {
  const rng = makeRng(15);
  return canvasTexture(128, (ctx, s) => {
    ctx.fillStyle = '#8d8a85';
    ctx.fillRect(0, 0, s, s);
    speckle(ctx, s, rng, 2200, ['#6f6c68', '#a8a49e', '#7d7a75'], 0.7, 2);
  });
}

export const FACADE_STYLES = {
  tower: { bays: 8, floors: 8, tile: [24, 28], wall: '#e9eef2', glass: '#5d7f99', frame: 0.08, gap: 0.04 },
  office: { bays: 8, floors: 8, tile: [26, 28], wall: '#f2efe8', glass: '#3e5568', frame: 0.22, gap: 0.3 },
  deco: { bays: 8, floors: 8, tile: [22, 26], wall: '#fbf7ef', glass: '#4b6a7a', frame: 0.3, gap: 0.42, bands: true },
  stucco: { bays: 8, floors: 8, tile: [28, 26], wall: '#fbf5ea', glass: '#3b4b55', frame: 0.38, gap: 0.45, shutters: true },
  warehouse: { bays: 8, floors: 8, tile: [32, 24], wall: '#e7e3dc', glass: '#46525a', frame: 0.5, gap: 0.62, ribs: true },
};

export function facadeTextures(styleName, seed) {
  const style = FACADE_STYLES[styleName];
  const rng = makeRng(seed);
  const size = 512;
  const cw = size / style.bays;
  const ch = size / style.floors;
  const windows = [];
  for (let f = 0; f < style.floors; f += 1) {
    for (let b = 0; b < style.bays; b += 1) {
      const mx = cw * style.frame * 0.5;
      const my = ch * style.gap * 0.5;
      windows.push({ x: b * cw + mx, y: f * ch + my, w: cw - mx * 2, h: ch - my * 2, lit: rng() < 0.38, warm: rng() < 0.75, shade: rng() });
    }
  }

  const day = canvasTexture(size, (ctx) => {
    ctx.fillStyle = style.wall;
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rng, 1800, ['#000000', '#ffffff'], 0.05, 3);
    if (style.ribs) {
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      for (let x = 0; x < size; x += 8) ctx.fillRect(x, 0, 3, size);
    }
    if (style.bands) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let f = 0; f < style.floors; f += 1) ctx.fillRect(0, f * ch + ch * 0.86, size, ch * 0.1);
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let f = 0; f < style.floors; f += 1) ctx.fillRect(0, f * ch + ch * 0.96, size, ch * 0.04);
    }
    for (const w of windows) {
      const g = ctx.createLinearGradient(w.x, w.y, w.x + w.w, w.y + w.h);
      const glass = new THREE.Color(style.glass).offsetHSL(0, 0, (w.shade - 0.5) * 0.12);
      g.addColorStop(0, `#${glass.clone().offsetHSL(0, 0, 0.18).getHexString()}`);
      g.addColorStop(0.55, `#${glass.getHexString()}`);
      g.addColorStop(1, `#${glass.clone().offsetHSL(0, 0, -0.08).getHexString()}`);
      ctx.fillStyle = g;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      if (style.frame > 0.15) {
        
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(w.x, w.y, w.w, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(w.x + w.w / 2 - 1, w.y, 2, w.h);
      }
      if (style.shutters) {
        ctx.fillStyle = 'rgba(70,120,110,0.55)';
        ctx.fillRect(w.x - 7, w.y, 6, w.h);
        ctx.fillRect(w.x + w.w + 1, w.y, 6, w.h);
      }
    }
  });

  const night = canvasTexture(size, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    for (const w of windows) {
      if (!w.lit) continue;
      const tone = w.warm ? `rgba(255,${190 + Math.floor(w.shade * 40)},${110 + Math.floor(w.shade * 50)},1)` : 'rgba(190,225,255,1)';
      ctx.fillStyle = tone;
      ctx.globalAlpha = 0.55 + w.shade * 0.45;
      ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, w.h - 4);
    }
    ctx.globalAlpha = 1;
  });
  return { day, night, tile: style.tile };
}