// Dustline - environment builder: textured streets, building trim, wall decor, palms, skyline and sky.
// Everything here is visual only; gameplay collision/sightlines still come from shared.js GRID/PROPS.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as S from './shared.js';

const T = S.TILE, MW = S.W * T, MH = S.H * T;
let seed = 1337;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const R = (a, b) => a + (b - a) * Math.random();

function tex(w, h, draw, { repeat, srgb = true, aniso = 4 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(...repeat);
  return t;
}
function speckle(c, w, h, n, amt, light = '255,245,225', dark = '40,25,10', size = 2) {
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * amt;
    c.fillStyle = v > 0 ? `rgba(${light},${v})` : `rgba(${dark},${-v})`;
    const s = 1 + Math.random() * size;
    c.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}
// soft blotch drawn with horizontal (and optionally vertical) wrap so textures stay seamless
function blotch(c, w, h, x, y, r, col, wrapY = true) {
  for (const ox of [-w, 0, w]) for (const oy of wrapY ? [-h, 0, h] : [0]) {
    const X = x + ox, Y = y + oy;
    if (X + r < 0 || X - r > w || Y + r < 0 || Y - r > h) continue;
    const g = c.createRadialGradient(X, Y, 0, X, Y, r);
    g.addColorStop(0, col); g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    c.fillStyle = g; c.fillRect(X - r, Y - r, r * 2, r * 2);
  }
}
function crack(c, x, y, len, ang, wdt = 1.2, col = 'rgba(55,35,18,0.55)') {
  c.strokeStyle = col; c.lineWidth = wdt; c.beginPath(); c.moveTo(x, y);
  for (let i = 0; i < len; i++) {
    ang += (Math.random() - 0.5) * 0.9; x += Math.cos(ang) * 6; y += Math.sin(ang) * 6; c.lineTo(x, y);
    if (Math.random() < 0.08) crack(c, x, y, len * 0.4 | 0, ang + (Math.random() - 0.5) * 2, wdt * 0.6, col);
  }
  c.stroke();
}

// ------------------------------------------------------------------ textures
function makeTextures(hi) {
  const k = hi ? 1 : 0.5;
  const P = (n) => Math.round(n * k);
  const out = {};
  // Plaster/stucco wall, 2 m wide x 4.5 m tall face. Neutral light tone; instance colour tints per building.
  out.wall = tex(P(512), P(1152), (c, w, h) => {
    c.fillStyle = '#ece4d6'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) blotch(c, w, h, R(0, w), R(0, h), R(20, 140) * k, Math.random() < 0.5 ? `rgba(255,252,240,${R(0.08, 0.2)})` : `rgba(150,120,85,${R(0.05, 0.14)})`, false);
    speckle(c, w, h, 26000 * k * k, 0.18, undefined, undefined, 2);
    for (let i = 0; i < 2; i++) crack(c, R(0.15, 0.85) * w, R(0.1, 0.9) * h, (R(6, 14) * k) | 0, R(0, 6.28), 1 * k, 'rgba(70,50,30,0.3)');
    // rain streaks from the top
    for (let i = 0; i < 40; i++) {
      const x = R(0, w), len = R(0.08, 0.45) * h, g = c.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, 'rgba(90,70,45,0.18)'); g.addColorStop(1, 'rgba(90,70,45,0)');
      c.fillStyle = g; c.fillRect(x, 0, R(2, 7) * k, len);
    }
    // sun-bleached top, dirty splash zone at the base
    let g = c.createLinearGradient(0, 0, 0, h * 0.2); g.addColorStop(0, 'rgba(255,250,235,0.25)'); g.addColorStop(1, 'rgba(255,250,235,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h * 0.2);
    g = c.createLinearGradient(0, h * 0.72, 0, h); g.addColorStop(0, 'rgba(85,60,35,0)'); g.addColorStop(0.7, 'rgba(85,60,35,0.28)'); g.addColorStop(1, 'rgba(60,40,22,0.5)');
    c.fillStyle = g; c.fillRect(0, h * 0.72, w, h * 0.28);
    speckle(c, w, h * 0.2, 3000 * k, 0.35, '200,170,130', '60,40,20', 3);
  }, { aniso: 4 });
  // spalled plaster decal (alpha) revealing mud brick - scattered per wall face to break up tiling
  out.spall = tex(P(256), P(256), (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const px = w / 2, py = h / 2, pr = w * 0.3, pts = [];
    for (let a = 0; a < 6.28; a += 0.35) pts.push([px + Math.cos(a) * pr * R(0.6, 1.05) * 1.35, py + Math.sin(a) * pr * R(0.6, 1.05)]);
    c.save(); c.beginPath(); pts.forEach(([x, y]) => c.lineTo(x, y)); c.closePath();
    c.fillStyle = '#8f6d4e'; c.fill(); c.clip();
    const bw = 40 * k, bh = 17 * k;
    for (let y = 0; y < h; y += bh) for (let x = ((Math.round(y / bh) % 2) * bw) / 2 - bw; x < w; x += bw) {
      c.fillStyle = `hsl(${R(20, 30)},${R(22, 32)}%,${R(44, 56)}%)`; c.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    }
    speckle(c, w, h, 2500 * k, 0.35);
    const g = c.createRadialGradient(px, py, pr * 0.3, px, py, pr * 1.3); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(50,30,15,0.45)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.restore();
    c.strokeStyle = 'rgba(255,248,235,0.5)'; c.lineWidth = 3 * k; c.beginPath(); pts.forEach(([x, y]) => c.lineTo(x - 1, y - 2)); c.closePath(); c.stroke();
    c.strokeStyle = 'rgba(70,50,30,0.4)'; c.lineWidth = 1.5 * k; c.beginPath(); pts.forEach(([x, y]) => c.lineTo(x + 1, y + 2)); c.closePath(); c.stroke();
  }, { aniso: 2 });
  // wall-base dirt / water stain decal
  out.stain = tex(P(128), P(128), (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) blotch(c, w, h, R(0.25, 0.75) * w, R(0.55, 0.95) * h, R(12, 40) * k, `rgba(70,50,30,${R(0.12, 0.25)})`, false);
    for (let i = 0; i < 10; i++) { const x = R(0.2, 0.8) * w, len = R(0.2, 0.7) * h, g = c.createLinearGradient(0, h - len, 0, h); g.addColorStop(0, 'rgba(70,50,30,0)'); g.addColorStop(1, 'rgba(70,50,30,0.25)'); c.fillStyle = g; c.fillRect(x, h - len, R(3, 10) * k, len); }
  }, { aniso: 2 });
  // Flagstone pavers; one tile = 8 m x 8 m
  out.floor = tex(P(1024), P(1024), (c, w, h) => {
    c.fillStyle = '#8a7a64'; c.fillRect(0, 0, w, h);
    speckle(c, w, h, 20000 * k * k, 0.3, '210,185,140', '50,35,20', 2);
    const rows = []; let y = 0;
    while (y < h) { let rh = Math.round(R(70, 120) * k); if (h - y - rh < 60 * k) rh = h - y; rows.push([y, rh]); y += rh; }
    const joint = 4 * k;
    for (const [ry, rh] of rows) {
      let x = 0; const off = R(0, w);
      while (x < w) {
        let sw = Math.round(R(80, 150) * k); if (w - x - sw < 60 * k) sw = w - x;
        for (const ox of [0, -w]) {
          const X = x + off + ox; if (X > w || X + sw < 0) continue;
          const l = R(56, 70), hue = R(30, 40), sat = R(12, 24);
          c.fillStyle = `hsl(${hue},${sat}%,${l}%)`;
          c.beginPath(); c.roundRect(X + joint, ry + joint, sw - joint * 2, rh - joint * 2, 6 * k); c.fill();
          // bevel: darker lower/right edge, lighter upper/left edge
          c.strokeStyle = 'rgba(60,40,20,0.35)'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(X + sw - joint, ry + joint + 4); c.lineTo(X + sw - joint, ry + rh - joint); c.lineTo(X + joint + 4, ry + rh - joint); c.stroke();
          c.strokeStyle = 'rgba(255,240,215,0.25)'; c.beginPath(); c.moveTo(X + joint, ry + rh - joint - 4); c.lineTo(X + joint, ry + joint); c.lineTo(X + sw - joint - 4, ry + joint); c.stroke();
          // worn centre
          const g = c.createRadialGradient(X + sw / 2, ry + rh / 2, 2, X + sw / 2, ry + rh / 2, sw * 0.6);
          g.addColorStop(0, `rgba(255,245,225,${R(0, 0.12)})`); g.addColorStop(1, 'rgba(70,45,20,0.12)');
          c.fillStyle = g; c.fillRect(X, ry, sw, rh);
          if (Math.random() < 0.18) crack(c, X + R(0.2, 0.8) * sw, ry + R(0.2, 0.8) * rh, (R(3, 8) * k) | 0, R(0, 6.28), 1.2 * k, 'rgba(50,32,15,0.6)');
        }
        x += sw;
      }
    }
    speckle(c, w, h, 50000 * k * k, 0.16, '255,240,210', '50,30,10', 1.5);
    for (let i = 0; i < 26; i++) blotch(c, w, h, R(0, w), R(0, h), R(60, 200) * k, Math.random() < 0.6 ? `rgba(215,185,135,${R(0.15, 0.35)})` : `rgba(70,50,30,${R(0.06, 0.14)})`);
    for (let i = 0; i < 8; i++) blotch(c, w, h, R(0, w), R(0, h), R(15, 40) * k, `rgba(40,28,18,${R(0.2, 0.35)})`); // oil / water stains
  }, { repeat: [MW / 8, MH / 8], aniso: 8 });
  // wooden plank crate side
  out.crate = tex(P(512), P(512), (c, w, h) => {
    c.fillStyle = '#3a2817'; c.fillRect(0, 0, w, h);
    const n = 6, bh = h / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = `hsl(${R(26, 32)},${R(36, 46)}%,${R(40, 50)}%)`; c.fillRect(0, i * bh + 2, w, bh - 4);
      for (let j = 0; j < 14; j++) { c.strokeStyle = `rgba(60,35,15,${R(0.15, 0.4)})`; c.lineWidth = R(0.6, 1.8) * k; c.beginPath(); const yy = i * bh + R(4, bh - 4); c.moveTo(0, yy); c.bezierCurveTo(w * 0.3, yy + R(-4, 4), w * 0.6, yy + R(-4, 4), w, yy + R(-3, 3)); c.stroke(); }
      if (Math.random() < 0.6) { c.fillStyle = 'rgba(50,28,12,0.6)'; c.beginPath(); c.ellipse(R(0, w), i * bh + bh / 2, R(5, 10) * k, R(3, 5) * k, 0, 0, 7); c.fill(); }
    }
    speckle(c, w, h, 9000 * k, 0.22);
    const fb = 46 * k; c.fillStyle = '#7a5532';
    c.fillRect(0, 0, w, fb); c.fillRect(0, h - fb, w, fb); c.fillRect(0, 0, fb, h); c.fillRect(w - fb, 0, fb, h);
    c.save(); c.translate(w / 2, h / 2); c.rotate(Math.atan2(h - fb * 2, w - fb * 2)); c.fillRect(-w * 0.62, -fb / 2, w * 1.24, fb); c.restore();
    c.strokeStyle = 'rgba(30,18,8,0.6)'; c.lineWidth = 3 * k;
    c.strokeRect(fb, fb, w - fb * 2, h - fb * 2); c.strokeRect(1, 1, w - 2, h - 2);
    speckle(c, w, h, 4000 * k, 0.25);
    c.fillStyle = '#2a2520';
    for (const [x, y] of [[fb / 2, fb / 2], [w - fb / 2, fb / 2], [fb / 2, h - fb / 2], [w - fb / 2, h - fb / 2], [w / 2, fb / 2], [w / 2, h - fb / 2]]) { c.beginPath(); c.arc(x, y, 4 * k, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(25,20,15,0.55)'; c.font = `700 ${34 * k}px monospace`; c.textAlign = 'center'; c.fillText('THIS SIDE UP', w / 2, h * 0.3);
  });
  // olive ammo crate
  out.box = tex(P(256), P(256), (c, w, h) => {
    c.fillStyle = '#58603f'; c.fillRect(0, 0, w, h); speckle(c, w, h, 5000 * k, 0.25);
    c.strokeStyle = '#2f341f'; c.lineWidth = 8 * k; c.strokeRect(4 * k, 4 * k, w - 8 * k, h - 8 * k);
    c.fillStyle = '#3a3f28'; c.fillRect(0, h * 0.18, w, 10 * k); c.fillRect(0, h * 0.78, w, 10 * k);
    c.fillStyle = 'rgba(235,225,190,0.8)'; c.font = `700 ${30 * k}px monospace`; c.textAlign = 'center';
    c.fillText('7.62 MM', w / 2, h * 0.48); c.font = `700 ${18 * k}px monospace`; c.fillText('LOT 44-91', w / 2, h * 0.62);
    c.fillStyle = '#2a2a24'; c.fillRect(w * 0.42, h * 0.08, w * 0.16, 14 * k);
    for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(140,90,50,${R(0.2, 0.5)})`; c.fillRect(R(0, w), R(0, h), R(2, 8), R(1, 3)); }
  });
  // corrugated metal (deck sides)
  out.corr = tex(P(512), P(256), (c, w, h) => {
    const n = 28, pw = w / n;
    for (let i = 0; i < n; i++) {
      const g = c.createLinearGradient(i * pw, 0, (i + 1) * pw, 0);
      g.addColorStop(0, '#6f7672'); g.addColorStop(0.3, '#a7aca6'); g.addColorStop(0.6, '#6b716d'); g.addColorStop(1, '#4d524f');
      c.fillStyle = g; c.fillRect(i * pw, 0, pw + 1, h);
    }
    for (let i = 0; i < 30; i++) {
      const x = R(0, w), len = R(0.2, 0.9) * h, g = c.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, 'rgba(130,70,30,0.5)'); g.addColorStop(1, 'rgba(130,70,30,0)'); c.fillStyle = g; c.fillRect(x, 0, R(3, 12) * k, len);
    }
    for (let i = 0; i < 10; i++) blotch(c, w, h, R(0, w), R(0, h), R(15, 50) * k, `rgba(120,60,25,${R(0.25, 0.5)})`);
    speckle(c, w, h, 6000 * k, 0.25);
    c.fillStyle = '#3d3a35'; c.fillRect(0, 0, w, 8 * k); c.fillRect(0, h - 8 * k, w, 8 * k);
  });
  // weathered deck planks (top of platforms)
  out.planks = tex(P(512), P(512), (c, w, h) => {
    const n = 8, bw = w / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = `hsl(${R(28, 34)},${R(12, 22)}%,${R(36, 46)}%)`; c.fillRect(i * bw + 2, 0, bw - 4, h);
      for (let j = 0; j < 12; j++) { c.strokeStyle = `rgba(40,28,18,${R(0.15, 0.35)})`; c.lineWidth = R(0.6, 1.6) * k; const xx = i * bw + R(4, bw - 4); c.beginPath(); c.moveTo(xx, 0); c.lineTo(xx + R(-3, 3), h); c.stroke(); }
      const cut = R(0.2, 0.8) * h; c.fillStyle = 'rgba(20,14,8,0.8)'; c.fillRect(i * bw, cut, bw, 2 * k);
      c.fillStyle = '#2a2622'; for (const yy of [8 * k, cut - 8 * k, cut + 10 * k, h - 8 * k]) { c.beginPath(); c.arc(i * bw + bw * 0.3, yy, 2.5 * k, 0, 7); c.arc(i * bw + bw * 0.7, yy, 2.5 * k, 0, 7); c.fill(); }
    }
    speckle(c, w, h, 8000 * k, 0.22);
  });
  // concrete step with worn safety nosing
  out.concrete = tex(P(256), P(256), (c, w, h) => {
    c.fillStyle = '#a49b8c'; c.fillRect(0, 0, w, h); speckle(c, w, h, 9000 * k, 0.3, '240,235,225', '40,35,30', 2);
    for (let i = 0; i < 10; i++) blotch(c, w, h, R(0, w), R(0, h), R(20, 70) * k, `rgba(80,70,55,${R(0.06, 0.15)})`);
    c.fillStyle = 'rgba(214,165,40,0.85)'; c.fillRect(0, 0, w, 14 * k);
    c.globalCompositeOperation = 'destination-out'; speckle(c, w, 14 * k, 500 * k, 1.6); c.globalCompositeOperation = 'source-over';
    c.strokeStyle = 'rgba(55,45,35,0.4)'; c.lineWidth = 3 * k; c.strokeRect(1, 1, w - 2, h - 2);
    crack(c, R(0.2, 0.8) * w, h * 0.6, 8, -1.2, 1.2 * k);
  });
  // burlap
  out.burlap = tex(P(128), P(128), (c, w, h) => {
    c.fillStyle = '#a39272'; c.fillRect(0, 0, w, h);
    c.globalAlpha = 0.35;
    for (let i = 0; i < w; i += 2 * k + 1) { c.fillStyle = i % 4 ? '#7d6644' : '#c3a97c'; c.fillRect(i, 0, 1, h); c.fillRect(0, i, w, 1); }
    c.globalAlpha = 1; speckle(c, w, h, 1500 * k, 0.3);
    for (let i = 0; i < 6; i++) blotch(c, w, h, R(0, w), R(0, h), R(10, 30) * k, 'rgba(70,50,30,0.2)');
  });
  // painted steel drum, near-white base so instance colour sets the paint
  out.barrel = tex(P(256), P(256), (c, w, h) => {
    c.fillStyle = '#e8e4dc'; c.fillRect(0, 0, w, h); speckle(c, w, h, 4000 * k, 0.2);
    for (let i = 0; i < 26; i++) { const x = R(0, w), len = R(0.1, 0.6) * h, y0 = Math.random() < 0.5 ? 0 : h - len; c.fillStyle = `rgba(120,65,30,${R(0.25, 0.6)})`; c.fillRect(x, y0, R(2, 8) * k, len); }
    for (let i = 0; i < 12; i++) blotch(c, w, h, R(0, w), R(0, h), R(8, 30) * k, `rgba(110,60,25,${R(0.3, 0.6)})`);
    c.fillStyle = 'rgba(245,240,225,0.9)'; c.fillRect(w * 0.1, h * 0.42, w * 0.22, h * 0.16);
    c.fillStyle = 'rgba(30,30,30,0.8)'; c.font = `700 ${14 * k}px monospace`; c.fillText('UN1203', w * 0.11, h * 0.52);
  });
  // wooden door (vertical boards)
  out.door = tex(P(256), P(512), (c, w, h) => {
    c.fillStyle = '#e6e0d4'; c.fillRect(0, 0, w, h);
    const n = 6, bw = w / n;
    for (let i = 0; i < n; i++) { c.fillStyle = `rgba(0,0,0,${R(0.02, 0.1)})`; c.fillRect(i * bw, 0, bw, h); c.fillStyle = 'rgba(30,20,10,0.55)'; c.fillRect(i * bw, 0, 2 * k, h); }
    // peeling paint revealing wood
    for (let i = 0; i < 18; i++) { const x = R(0, w), y = R(0, h); c.fillStyle = `rgba(120,85,50,${R(0.5, 0.9)})`; c.beginPath(); c.ellipse(x, y, R(3, 16) * k, R(5, 30) * k, 0, 0, 7); c.fill(); }
    speckle(c, w, h, 5000 * k, 0.25);
    c.fillStyle = 'rgba(40,30,20,0.35)'; c.fillRect(0, h * 0.18, w, 16 * k); c.fillRect(0, h * 0.78, w, 16 * k);
    c.fillStyle = '#2b2620'; c.fillRect(w * 0.82, h * 0.5, 10 * k, 30 * k);
    const g = c.createLinearGradient(0, h * 0.8, 0, h); g.addColorStop(0, 'rgba(60,40,20,0)'); g.addColorStop(1, 'rgba(60,40,20,0.45)'); c.fillStyle = g; c.fillRect(0, h * 0.8, w, h * 0.2);
  });
  // louvred shutter
  out.shutter = tex(P(128), P(256), (c, w, h) => {
    c.fillStyle = '#e8e2d6'; c.fillRect(0, 0, w, h);
    for (let y = 12 * k; y < h - 12 * k; y += 10 * k) { c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(8 * k, y + 6 * k, w - 16 * k, 3 * k); c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(8 * k, y, w - 16 * k, 2 * k); }
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 6 * k; c.strokeRect(3 * k, 3 * k, w - 6 * k, h - 6 * k);
    for (let i = 0; i < 10; i++) { c.fillStyle = `rgba(130,95,60,${R(0.4, 0.8)})`; c.fillRect(R(0, w), R(0, h), R(2, 10) * k, R(2, 14) * k); }
    speckle(c, w, h, 1500 * k, 0.25);
  });
  // AC unit front grille
  out.ac = tex(P(256), P(128), (c, w, h) => {
    c.fillStyle = '#c9c6bd'; c.fillRect(0, 0, w, h); speckle(c, w, h, 2000 * k, 0.2);
    c.fillStyle = '#3a3a38'; c.beginPath(); c.arc(w * 0.68, h / 2, h * 0.38, 0, 7); c.fill();
    c.strokeStyle = '#8a8880'; c.lineWidth = 2 * k; for (let r = 4 * k; r < h * 0.38; r += 6 * k) { c.beginPath(); c.arc(w * 0.68, h / 2, r, 0, 7); c.stroke(); }
    c.fillStyle = 'rgba(60,60,58,0.6)'; for (let y = 14 * k; y < h - 14 * k; y += 7 * k) c.fillRect(10 * k, y, w * 0.32, 3 * k);
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(110,70,30,0)'); g.addColorStop(1, 'rgba(110,70,30,0.35)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  // distant buildings: plaster with window grid
  out.facade = tex(P(256), P(512), (c, w, h) => {
    c.fillStyle = '#e8dfcf'; c.fillRect(0, 0, w, h); speckle(c, w, h, 6000 * k, 0.2);
    for (let i = 0; i < 14; i++) blotch(c, w, h, R(0, w), R(0, h), R(20, 80) * k, `rgba(140,110,75,${R(0.05, 0.14)})`, false);
    const floors = 4, cols = 3, fh = h / floors, cw = w / cols;
    for (let f = 0; f < floors; f++) for (let j = 0; j < cols; j++) {
      const x = j * cw + cw * 0.28, y = f * fh + fh * 0.3, ww = cw * 0.44, wh = fh * 0.45, r = Math.random();
      c.fillStyle = r < 0.25 ? '#5d7f86' : r < 0.45 ? '#7a5a3a' : '#23201c'; c.fillRect(x, y, ww, wh);
      c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(x, y, ww, 3 * k);
      c.fillStyle = 'rgba(200,190,170,0.9)'; c.fillRect(x - 3 * k, y + wh, ww + 6 * k, 5 * k);
      if (Math.random() < 0.2) { c.fillStyle = '#b8b5ad'; c.fillRect(x + ww * 0.1, y + wh + 5 * k, ww * 0.8, 12 * k); }
    }
    const g = c.createLinearGradient(0, h * 0.85, 0, h); g.addColorStop(0, 'rgba(80,55,30,0)'); g.addColorStop(1, 'rgba(80,55,30,0.35)'); c.fillStyle = g; c.fillRect(0, h * 0.85, w, h * 0.15);
  });
  // palm frond with alpha
  out.frond = tex(P(64), P(256), (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#6d6a2f'; c.lineWidth = 3 * k; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke();
    for (let y = 6; y < h - 4; y += 3.2 * k) {
      const t = y / h, len = (w / 2) * Math.sin(Math.PI * Math.min(1, t * 1.15)) * R(0.8, 1);
      for (const s of [-1, 1]) {
        c.strokeStyle = `hsl(${R(70, 92)},${R(35, 50)}%,${R(32, 46)}%)`; c.lineWidth = R(1.5, 2.6) * k;
        c.beginPath(); c.moveTo(w / 2, y); c.lineTo(w / 2 + s * len, y + len * 0.55); c.stroke();
      }
    }
  }, { aniso: 2 });
  out.bark = tex(P(64), P(128), (c, w, h) => {
    c.fillStyle = '#7a6448'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 7 * k) { c.fillStyle = 'rgba(40,28,15,0.55)'; c.fillRect(0, y, w, 2 * k); c.fillStyle = 'rgba(190,165,125,0.25)'; c.fillRect(0, y + 2 * k, w, 2 * k); }
    speckle(c, w, h, 600 * k, 0.3);
  });
  out.poster = [0, 1, 2].map((i) => tex(P(128), P(180), (c, w, h) => {
    const cols = [['#c23b2a', '#f1e3c4'], ['#2d5f8a', '#f2ead6'], ['#e2a73b', '#2c241c']][i];
    c.fillStyle = cols[1]; c.fillRect(0, 0, w, h);
    c.fillStyle = cols[0]; c.fillRect(0, 0, w, h * 0.55);
    c.fillStyle = cols[1]; c.font = `700 ${26 * k}px sans-serif`; c.textAlign = 'center'; c.fillText(['SALE', 'RADIO', 'CIRCUS'][i], w / 2, h * 0.35);
    c.fillStyle = 'rgba(30,25,20,0.7)'; for (let y = h * 0.62; y < h * 0.92; y += 9 * k) c.fillRect(w * 0.12, y, w * R(0.5, 0.76), 4 * k);
    // fading and torn corners
    c.fillStyle = 'rgba(240,225,195,0.35)'; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-out';
    c.beginPath(); c.moveTo(w, h); c.lineTo(w - R(10, 40) * k, h); c.lineTo(w, h - R(10, 50) * k); c.fill();
    c.beginPath(); c.moveTo(0, 0); c.lineTo(R(5, 25) * k, 0); c.lineTo(0, R(5, 30) * k); c.fill();
    c.globalCompositeOperation = 'source-over';
  }));
  return out;
}

// ------------------------------------------------------------------ instancing helper
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();
class Batch {
  constructor(geo, mat, { shadow = false, receive = true } = {}) { this.geo = geo; this.mat = mat; this.items = []; this.shadow = shadow; this.receive = receive; }
  add(x, y, z, sx, sy, sz, ry = 0, color = null, rx = 0, rz = 0) { this.items.push([x, y, z, sx, sy, sz, ry, color, rx, rz]); }
  build(scene) {
    if (!this.items.length) return null;
    const im = new THREE.InstancedMesh(this.geo, this.mat, this.items.length);
    this.items.forEach(([x, y, z, sx, sy, sz, ry, color, rx, rz], i) => {
      _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
      im.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
      if (color) im.setColorAt(i, _c.set(color));
    });
    if (im.instanceColor) for (let i = 0; i < this.items.length; i++) if (!this.items[i][7]) im.setColorAt(i, _c.set('#ffffff'));
    im.castShadow = this.shadow; im.receiveShadow = this.receive;
    scene.add(im); return im;
  }
}

// ------------------------------------------------------------------ world
export function buildWorld(scene, { hi = true, bump = true, sunDir = new THREE.Vector3(0.45, 0.8, -0.38) } = {}) {
  seed = 1337;
  const X = makeTextures(hi);
  const std = (o) => { if (!bump) { delete o.bumpMap; delete o.bumpScale; } return new THREE.MeshStandardMaterial({ roughness: 0.9, ...o }); };
  const box = new THREE.BoxGeometry(1, 1, 1);
  const boxB = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // base at y=0
  const solid = (x, z) => x < 0 || z < 0 || x >= S.W || z >= S.H || S.GRID[z * S.W + x] === 1;
  const isWin = new Set(S.WINDOWS.map(([x, z]) => z * S.W + x));
  const hjOf = (x, z) => 1 + ((x * 7 + z * 13) % 5 === 0 ? 0.25 : 0);

  // ---------- sky dome
  const HORIZON = new THREE.Color('#e7d3b0'), ZENITH = new THREE.Color('#5d93c9');
  const dome = new THREE.Mesh(new THREE.SphereGeometry(185, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { hz: { value: HORIZON }, zn: { value: ZENITH }, sun: { value: sunDir.clone().normalize() } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 hz; uniform vec3 zn; uniform vec3 sun; varying vec3 vD;
      void main(){ float h = max(vD.y, 0.0); vec3 c = mix(hz, zn, pow(h, 0.55));
        float s = max(dot(normalize(vD), sun), 0.0);
        c += vec3(1.0, 0.85, 0.6) * (pow(s, 8.0) * 0.25 + pow(s, 64.0) * 0.5) + vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9996, s) * 3.0;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);
  scene.background = HORIZON;
  scene.fog = new THREE.Fog(HORIZON, 45, 170);

  // ---------- distant mountains (two hazy ridgelines)
  {
    const ridges = [[110, 10, 16, '#a88c6c'], [150, 18, 26, '#b9a184']];
    for (const [rad, base, amp, col] of ridges) {
      const N = 96, pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const hgt = base + amp * (0.5 + 0.3 * Math.sin(a * 3 + rad) + 0.2 * Math.sin(a * 7.3 + 1.7) + 0.15 * Math.sin(a * 17.1)) * (0.7 + rnd() * 0.3);
        pos.push(Math.cos(a) * rad, -3, Math.sin(a) * rad, Math.cos(a) * rad, hgt, Math.sin(a) * rad);
        if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, fog: true }));
      m.position.set(MW / 2, 0, MH / 2); scene.add(m);
    }
  }

  // ---------- floor: paver texture + baked contact shadow / macro variation in vertex colours
  {
    const SX = S.W * 2, SZ = S.H * 2;
    const g = new THREE.PlaneGeometry(MW, MH, SX, SZ);
    const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
    const lowProps = S.PROPS.filter((p) => p.y0 === 0 && p.h > 0.3);
    const rectD = (px, pz, x0, z0, x1, z1) => Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(z0 - pz, 0, pz - z1));
    for (let i = 0; i < pos.count; i++) {
      const px = MW / 2 + pos.getX(i), pz = MH / 2 - pos.getY(i);
      const tx = Math.floor(px / T), tz = Math.floor(pz / T);
      let dw = 9;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (solid(tx + dx, tz + dz)) dw = Math.min(dw, rectD(px, pz, (tx + dx) * T, (tz + dz) * T, (tx + dx + 1) * T, (tz + dz + 1) * T));
      let dp = 9;
      for (const p of lowProps) if (Math.abs((p.x0 + p.x1) / 2 - px) < 8 && Math.abs((p.z0 + p.z1) / 2 - pz) < 8) dp = Math.min(dp, rectD(px, pz, p.x0, p.z0, p.x1, p.z1));
      const sm = (d, r) => { const t = Math.min(1, d / r); return t * t * (3 - 2 * t); };
      let ao = Math.min(0.5 + 0.5 * sm(dw, 1.1), 0.62 + 0.38 * sm(dp, 0.7));
      const macro = 0.93 + 0.05 * Math.sin(px * 0.11 + Math.sin(pz * 0.07) * 2) + 0.04 * Math.sin(pz * 0.13 + px * 0.05);
      const sandy = Math.max(0, Math.sin(px * 0.05 + 1.3) * Math.sin(pz * 0.06 + 0.4)) * 0.08;
      cols[i * 3] = ao * (macro + sandy); cols[i * 3 + 1] = ao * (macro + sandy * 0.85); cols[i * 3 + 2] = ao * (macro + sandy * 0.5);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const floor = new THREE.Mesh(g, std({ map: X.floor, bumpMap: X.floor, bumpScale: 1.4, vertexColors: true, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(MW / 2, 0, MH / 2); floor.receiveShadow = true;
    scene.add(floor);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), std({ color: '#c3a57c', roughness: 1 }));
    outer.rotation.x = -Math.PI / 2; outer.position.set(MW / 2, -0.03, MH / 2); outer.receiveShadow = true; scene.add(outer);
  }

  // ---------- walls (instanced), coloured per "building" block
  const PALETTE = ['#e2d3b8', '#d8c09c', '#ebe3d2', '#d8b9a0', '#efebe2', '#cdbb9f', '#e0cdb0'];
  const walls = [], faces = [];
  for (let z = 0; z < S.H; z++) for (let x = 0; x < S.W; x++) {
    if (S.GRID[z * S.W + x] !== 1) continue;
    let edge = false;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!solid(x + dx, z + dz)) edge = true;
    if (!edge) continue;
    walls.push([x, z]);
    for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (solid(x + nx, z + nz)) continue;
      faces.push({ x, z, nx, nz, hj: hjOf(x, z), win: isWin.has((z + nz) * S.W + x + nx), cx: x * T + 1 + nx, cz: z * T + 1 + nz, ry: Math.atan2(nx, nz) });
    }
  }
  const wallCol = (x, z) => {
    const b = PALETTE[Math.abs(Math.floor(x / 5) * 7 + Math.floor(z / 4) * 13) % PALETTE.length];
    return _c.set(b).offsetHSL(0, 0, (((x * 31 + z * 17) % 7) - 3) * 0.004).getHexString();
  };
  const wallMat = std({ map: X.wall, bumpMap: X.wall, bumpScale: 1.2, roughness: 0.92 });
  const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(T, S.WALL_H, T), wallMat, walls.length);
  walls.forEach(([x, z], i) => {
    const hj = hjOf(x, z);
    _m.makeScale(1, hj, 1); _m.setPosition(x * T + 1, (S.WALL_H * hj) / 2, z * T + 1); wm.setMatrixAt(i, _m);
    wm.setColorAt(i, _c.set('#' + wallCol(x, z)));
  });
  wm.castShadow = true; wm.receiveShadow = true; scene.add(wm);
  const N = walls.length, baseM = wm.instanceMatrix.array.slice(), baseC = wm.instanceColor.array.slice();
  const wcx = new Float32Array(N), wcz = new Float32Array(N), order = new Uint16Array(N), dist = new Float32Array(N);
  walls.forEach(([x, z], i) => { wcx[i] = x * T + 1; wcz[i] = z * T + 1; order[i] = i; });
  let lastX = -1e9, lastZ = -1e9;
  const sortWalls = (px, pz) => {
    dome.position.set(px, 0, pz);
    if ((px - lastX) ** 2 + (pz - lastZ) ** 2 < 0.6) return;
    lastX = px; lastZ = pz;
    for (let i = 0; i < N; i++) dist[i] = (wcx[i] - px) ** 2 + (wcz[i] - pz) ** 2;
    order.sort((a, b) => dist[a] - dist[b]);
    const M = wm.instanceMatrix.array, C = wm.instanceColor.array;
    for (let j = 0; j < N; j++) { const i = order[j]; M.set(baseM.subarray(i * 16, i * 16 + 16), j * 16); C.set(baseC.subarray(i * 3, i * 3 + 3), j * 3); }
    wm.instanceMatrix.needsUpdate = true; wm.instanceColor.needsUpdate = true;
  };

  // ---------- plinths + parapet coping
  const stoneMat = std({ map: X.concrete, color: '#b9a588', roughness: 0.95 });
  const plinth = new Batch(box, std({ map: X.concrete, color: '#b3a48e', roughness: 0.95 }));
  const coping = new Batch(box, stoneMat, { shadow: true });
  for (const f of faces) {
    const tx = Math.abs(f.nz), tz = Math.abs(f.nx);
    if (!f.win) plinth.add(f.cx + f.nx * 0.03, 0.17, f.cz + f.nz * 0.03, T + 0.06, 0.34, 0.06, f.ry);
    const top = S.WALL_H * f.hj;
    coping.add(f.cx + f.nx * 0.04, top - 0.08, f.cz + f.nz * 0.04, T + 0.1, 0.16, 0.08, f.ry);
    void tx; void tz;
  }
  for (const [x, z] of walls) coping.add(x * T + 1, S.WALL_H * hjOf(x, z) + 0.05, z * T + 1, T, 0.1, T, 0, null);
  plinth.build(scene); coping.build(scene);

  // ---------- wall decor (doors, shutters, AC units, boxes, pipes, lamps, posters, wires)
  const doorMat = std({ map: X.door, roughness: 0.85 });
  const frameMat = std({ color: '#4b3624', roughness: 0.85 });
  const metalMat = std({ color: '#77736b', roughness: 0.5, metalness: 0.5 });
  const darkMet = std({ color: '#33312d', roughness: 0.55, metalness: 0.5 });
  const B = {
    door: new Batch(box, doorMat), frame: new Batch(box, frameMat, { shadow: true }),
    shutter: new Batch(box, std({ map: X.shutter, roughness: 0.8 })), sill: new Batch(box, stoneMat),
    glass: new Batch(box, std({ color: '#1c2126', roughness: 0.15, metalness: 0.6 })),
    ac: new Batch(box, [std({ color: '#bdbab1', roughness: 0.6 }), std({ color: '#bdbab1' }), std({ color: '#c9c6bd' }), std({ color: '#999' }), std({ map: X.ac, roughness: 0.6 }), std({ color: '#999' })], { shadow: true }),
    ebox: new Batch(box, std({ color: '#8d9188', roughness: 0.45, metalness: 0.45 })),
    pipe: new Batch(new THREE.CylinderGeometry(0.5, 0.5, 1, 8), metalMat, { shadow: true }),
    bracket: new Batch(box, darkMet),
    bulb: new Batch(new THREE.SphereGeometry(0.5, 6, 4), new THREE.MeshStandardMaterial({ color: '#fff2c8', emissive: '#ffd890', emissiveIntensity: 1.4 })),
    poster: X.poster.map((t) => new Batch(new THREE.PlaneGeometry(1, 1), std({ map: t, transparent: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2 }))),
    spall: new Batch(new THREE.PlaneGeometry(1, 1), std({ map: X.spall, bumpMap: X.spall, transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
    stain: new Batch(new THREE.PlaneGeometry(1, 1), std({ map: X.stain, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })),
    awning: new Batch(box, std({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide }), { shadow: true }),
  };
  const DOOR_COL = ['#3f6f86', '#5d7b4a', '#8a5a34', '#9a3f2e', '#c9b48a', '#4a5f8e'];
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const used = new Set();
  const straight = (f) => { const ax = Math.abs(f.nz), az = Math.abs(f.nx); return solid(f.x + ax, f.z + az) && solid(f.x - ax, f.z - az) && !solid(f.x + ax + f.nx, f.z + az + f.nz) && !solid(f.x - ax + f.nx, f.z - az + f.nz); };
  const nearSpawn = (f) => ['T', 'D'].some((t) => S.SPAWNS[t].some(([sx, sz]) => Math.abs(sx - f.x) + Math.abs(sz - f.z) < 5));
  for (const f of faces) {
    if (f.win) continue;
    const key = f.z * S.W + f.x;
    const ox = (o) => f.cx + f.nx * o, oz = (o) => f.cz + f.nz * o;
    const tan = (d) => [Math.abs(f.nz) * d, Math.abs(f.nx) * d]; // offset along the wall
    if (rnd() < 0.3) { const [a, b] = tan((rnd() - 0.5) * 1.1), sz = 0.35 + rnd() * 0.7; B.spall.add(ox(0.006) + a, 0.7 + rnd() * (S.WALL_H * f.hj - 1.4), oz(0.006) + b, sz * 1.3, sz, 1, f.ry, null, 0, (rnd() - 0.5) * 0.6); }
    if (rnd() < 0.35) { const [a, b] = tan((rnd() - 0.5) * 0.8); B.stain.add(ox(0.004) + a, 0.55, oz(0.004) + b, 1.2 + rnd() * 0.8, 1.1, 1, f.ry); }
    const r = rnd();
    if (r < 0.07 && straight(f) && !used.has(key)) {
      used.add(key);
      const dw = 1.15, dh = 2.25, col = pick(DOOR_COL);
      B.door.add(ox(0.03), dh / 2, oz(0.03), dw, dh, 0.06, f.ry, col);
      B.frame.add(ox(0.06), dh + 0.07, oz(0.06), dw + 0.3, 0.14, 0.1, f.ry);
      for (const s of [-1, 1]) { const [a, b] = tan(s * (dw / 2 + 0.07)); B.frame.add(ox(0.06) + a, dh / 2, oz(0.06) + b, 0.14, dh, 0.1, f.ry); }
      B.sill.add(ox(0.18), 0.06, oz(0.18), dw + 0.3, 0.12, 0.34, f.ry);
      if (nearSpawn(f) || rnd() < 0.3) B.awning.add(ox(0.45), dh + 0.42, oz(0.45), dw + 0.7, 0.04, 0.95, f.ry, pick(['#b8432f', '#2f6f86', '#c9a24a', '#6a7d46']), 0.3, 0);
    } else if (r < 0.17 && !used.has(key)) {
      used.add(key);
      const col = pick(DOOR_COL), ww = 0.9, wh = 1.1, wy = Math.min(S.WALL_H * f.hj - 1.0, 3.2);
      B.glass.add(ox(0.01), wy, oz(0.01), ww, wh, 0.02, f.ry);
      for (const s of [-1, 1]) { const [a, b] = tan(s * (ww / 2 + 0.24)); B.shutter.add(ox(0.05) + a, wy, oz(0.05) + b, 0.46, wh + 0.06, 0.04, f.ry, col); }
      B.frame.add(ox(0.05), wy + wh / 2 + 0.05, oz(0.05), ww + 0.12, 0.1, 0.08, f.ry);
      B.sill.add(ox(0.08), wy - wh / 2 - 0.05, oz(0.08), ww + 0.25, 0.08, 0.16, f.ry);
    } else if (r < 0.215) {
      const [a, b] = tan((rnd() - 0.5) * 0.8);
      B.ac.add(ox(0.22) + a, 2.75, oz(0.22) + b, 0.8, 0.52, 0.42, f.ry);
      B.bracket.add(ox(0.22) + a, 2.47, oz(0.22) + b, 0.7, 0.04, 0.46, f.ry);
    } else if (r < 0.245) {
      const [a, b] = tan((rnd() - 0.5) * 1.0);
      B.ebox.add(ox(0.08) + a, 1.45, oz(0.08) + b, 0.42, 0.55, 0.14, f.ry);
      B.pipe.add(ox(0.06) + a + 0.0, 0.6 + 0.0, oz(0.06) + b, 0.05, 1.2, 0.05, 0);
    } else if (r < 0.285) {
      const [a, b] = tan(0.92);
      const top = S.WALL_H * f.hj;
      B.pipe.add(ox(0.07) + a, top / 2, oz(0.07) + b, 0.1, top, 0.1, 0);
    } else if (r < 0.325) {
      B.bracket.add(ox(0.2), 3.3, oz(0.2), 0.05, 0.05, 0.4, f.ry);
      B.bracket.add(ox(0.38), 3.22, oz(0.38), 0.22, 0.06, 0.22, f.ry);
      B.bulb.add(ox(0.38), 3.15, oz(0.38), 0.12, 0.12, 0.12, 0);
    } else if (r < 0.38) {
      const [a, b] = tan((rnd() - 0.5) * 0.9);
      const pb = B.poster[Math.floor(rnd() * B.poster.length)];
      pb.add(ox(0.012) + a, 1.55 + rnd() * 0.3, oz(0.012) + b, 0.62, 0.86, 1, f.ry, null, 0, (rnd() - 0.5) * 0.08);
    }
  }
  for (const b of Object.values(B)) (Array.isArray(b) ? b : [b]).forEach((x) => x.build(scene));

  // overhead wires spanning corridors (well above head height)
  {
    const geos = [];
    let count = 0;
    for (const f of faces) {
      if (count > 40 || rnd() > 0.16) continue;
      let k = 1; while (k < 7 && !solid(f.x + f.nx * k, f.z + f.nz * k)) k++;
      if (k < 2 || k > 6) continue;
      const y0 = 4.0 + rnd() * 0.35, y1 = 4.0 + rnd() * 0.35, ax = Math.abs(f.nz), off = (rnd() - 0.5) * 1.4;
      const p0 = new THREE.Vector3(f.cx + ax * off, y0, f.cz + (1 - ax) * off);
      const p1 = new THREE.Vector3(f.cx + f.nx * (k - 1) * T + ax * off, y1, f.cz + f.nz * (k - 1) * T + (1 - ax) * off);
      const mid = p0.clone().lerp(p1, 0.5); mid.y -= 0.25 + rnd() * 0.3;
      geos.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, mid, p1), 10, 0.013, 4, false));
      count++;
    }
    if (geos.length) scene.add(new THREE.Mesh(mergeGeometries(geos), std({ color: '#1d1b19', roughness: 0.6 })));
  }

  // ---------- cover props
  const wallTint = '#efe4d2';
  const unitCyl = (() => {
    const pts = [[0, 0], [0.48, 0], [0.5, 0.02], [0.5, 0.3], [0.52, 0.33], [0.5, 0.36], [0.5, 0.64], [0.52, 0.67], [0.5, 0.7], [0.5, 0.97], [0.48, 1], [0.44, 0.985], [0, 0.985]];
    return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 10);
  })();
  const sideCorr = std({ map: X.corr, roughness: 0.55, metalness: 0.45 });
  const deckTop = std({ map: X.planks, roughness: 0.9 });
  const KIND = {
    crate: { geo: boxB, mat: std({ map: X.crate, bumpMap: X.crate, bumpScale: 0.8, roughness: 0.85 }), col: () => _c.setHSL(0.08, 0.2, 0.82 + rnd() * 0.18).getHexString() },
    crateTall: { geo: boxB, mat: std({ map: X.crate, bumpMap: X.crate, bumpScale: 0.8, roughness: 0.85, color: '#d9cbb6' }) },
    deck: { geo: boxB, mat: [sideCorr, sideCorr, deckTop, sideCorr, sideCorr, sideCorr] },
    step: { geo: boxB, mat: std({ map: X.concrete, roughness: 0.92 }) },
    box: { geo: boxB, mat: std({ map: X.box, roughness: 0.7 }) },
    barrel: { geo: unitCyl, mat: std({ map: X.barrel, roughness: 0.45, metalness: 0.35 }), col: () => pick(['#3a6aa8', '#a83a2c', '#4b7a42', '#d1a640', '#8a5530', '#5b6066']) },
    sill: { geo: boxB, mat: std({ map: X.wall, roughness: 0.92, color: wallTint }) },
    lintel: { geo: boxB, mat: std({ map: X.wall, roughness: 0.92, color: wallTint }) },
  };
  for (const [kind, def] of Object.entries(KIND)) {
    const list = S.PROPS.filter((p) => p.kind === kind);
    if (!list.length) continue;
    const b = new Batch(def.geo, def.mat, { shadow: true });
    list.forEach((p) => b.add((p.x0 + p.x1) / 2, p.y0, (p.z0 + p.z1) / 2, p.x1 - p.x0, p.h - p.y0, p.z1 - p.z0, 0, def.col ? '#' + def.col().replace('#', '') : null));
    b.build(scene);
  }
  // sandbags: individual pillow-shaped bags stacked in running bond
  {
    const bag = new THREE.SphereGeometry(1, 6, 4);
    const geos = [];
    for (const p of S.PROPS.filter((q) => q.kind === 'sandbag')) {
      const wx = p.x1 - p.x0, wz = p.z1 - p.z0, alongX = wx >= wz, L = alongX ? wx : wz, D = alongX ? wz : wx;
      const rows = Math.max(2, Math.round(p.h / 0.17)), rh = p.h / rows, cols = Math.max(1, Math.round(D / 0.34));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const n = Math.max(1, Math.round(L / 0.5)), shift = r % 2 ? 0.5 : 0;
        for (let i = 0; i < n + (shift ? 0 : 0); i++) {
          let u = (i + 0.5 + shift - 0.25) / n; if (u > 1) continue; u = Math.min(Math.max(u, 0.5 / n), 1 - 0.5 / n);
          const v = (c + 0.5) / cols;
          const g = bag.clone();
          const bl = (L / n) * 0.56, bd = (D / cols) * 0.56;
          g.scale(alongX ? bl : bd, rh * 0.62, alongX ? bd : bl);
          g.rotateY((rnd() - 0.5) * 0.12);
          const x = alongX ? p.x0 + u * wx : p.x0 + v * wx, z = alongX ? p.z0 + v * wz : p.z0 + u * wz;
          g.translate(x + (rnd() - 0.5) * 0.03, r * rh + rh * 0.55, z + (rnd() - 0.5) * 0.03);
          geos.push(g);
        }
      }
    }
    if (geos.length) { const m = new THREE.Mesh(mergeGeometries(geos), std({ map: X.burlap, color: '#c9bea6', roughness: 1 })); m.castShadow = m.receiveShadow = true; scene.add(m); }
  }
  // deck trim + support posts
  {
    const trim = new Batch(box, std({ color: '#2f2b26', roughness: 0.55, metalness: 0.5 }), { shadow: true });
    for (const d of S.PROPS.filter((p) => p.kind === 'deck')) trim.add((d.x0 + d.x1) / 2, d.h - 0.09, (d.z0 + d.z1) / 2, d.x1 - d.x0 + 0.03, 0.1, d.z1 - d.z0 + 0.03);
    trim.build(scene);
    // guard rails: posts + top rail + mid rail (collision box stays the same)
    const rl = new Batch(boxB, std({ color: '#6b655c', roughness: 0.5, metalness: 0.45 }), { shadow: true });
    for (const r of S.PROPS.filter((p) => p.kind === 'rail')) {
      const wx = r.x1 - r.x0, wz = r.z1 - r.z0, alongX = wx >= wz, L = alongX ? wx : wz, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, H = r.h - r.y0;
      for (const [y, t] of [[r.h - 0.03, 0.06], [r.y0 + H * 0.5, 0.035]]) rl.add(cx, y - t, cz, alongX ? L : 0.05, t, alongX ? 0.05 : L);
      const n = Math.max(1, Math.round(L / 1.1));
      for (let i = 0; i <= n; i++) { const u = Math.min(L - 0.025, Math.max(0.025, (i / n) * L)); rl.add(alongX ? r.x0 + u : cx, r.y0, alongX ? cz : r.z0 + u, 0.05, H, 0.05); }
    }
    rl.build(scene);
  }
  // window opening timber frames + glass-less mullion look
  {
    const fr = new Batch(box, std({ color: '#4a3220', roughness: 0.8 }), { shadow: true });
    const fw = 0.12, dep = 0.1;
    for (const [tx, tz] of S.WINDOWS) {
      const alongX = S.solidAt(tx - 1, tz) || S.solidAt(tx + 1, tz);
      const cx = tx * T + 1, cz = tz * T + 1, y0 = S.SILL_H, y1 = S.LINTEL_Y, hgt = y1 - y0, ry = alongX ? 0 : Math.PI / 2;
      for (const side of [-1, 1]) {
        const fx = alongX ? cx : cx + side * (T / 2 + dep / 2), fz = alongX ? cz + side * (T / 2 + dep / 2) : cz;
        fr.add(fx, y1 - fw / 2, fz, T, fw, dep, ry);
        fr.add(fx, y0 + fw / 2 - 0.02, fz, T + 0.12, fw, dep + 0.06, ry);
        const o = T / 2 - fw / 2;
        fr.add(fx + (alongX ? -o : 0), y0 + hgt / 2, fz + (alongX ? 0 : -o), fw, hgt, dep, ry);
        fr.add(fx + (alongX ? o : 0), y0 + hgt / 2, fz + (alongX ? 0 : o), fw, hgt, dep, ry);
      }
    }
    fr.build(scene);
  }
  // rubble & pebbles along wall bases
  {
    const rock = new Batch(new THREE.IcosahedronGeometry(1, 0), std({ color: '#9c8466', roughness: 1 }));
    for (const f of faces) {
      if (rnd() > 0.35) continue;
      const n = 1 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const t = (rnd() - 0.5) * 1.8, o = 0.08 + rnd() * 0.35, s = 0.03 + rnd() * rnd() * 0.12;
        const ax = Math.abs(f.nz);
        rock.add(f.cx + f.nx * o + ax * t, s * 0.4, f.cz + f.nz * o + (1 - ax) * t, s * (1 + rnd()), s, s * (1 + rnd()), rnd() * 6, _c.setHSL(0.08, 0.2, 0.42 + rnd() * 0.2).getHexString().replace(/^/, '#'));
      }
    }
    rock.build(scene);
  }

  // ---------- site markers: worn stencilled paint
  for (const k of ['A', 'B']) {
    const s = S.SITES[k];
    const w = (s.x1 - s.x0 + 1) * T, h = (s.z1 - s.z0 + 1) * T;
    const t = tex(512, Math.round(512 * (h / w)), (c, cw, ch) => {
      c.clearRect(0, 0, cw, ch);
      c.strokeStyle = 'rgba(150,38,26,0.7)'; c.lineWidth = 12; c.setLineDash([34, 20]); c.strokeRect(10, 10, cw - 20, ch - 20);
      c.fillStyle = 'rgba(150,38,26,0.72)'; c.font = `700 ${ch * 0.5}px Chakra Petch, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(k, cw / 2, ch / 2);
      c.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.8})`; const z = 1 + Math.random() * 3; c.fillRect(Math.random() * cw, Math.random() * ch, z, z); }
      for (let i = 0; i < 25; i++) blotch(c, cw, ch, Math.random() * cw, Math.random() * ch, 10 + Math.random() * 40, 'rgba(0,0,0,0.5)');
    }, { aniso: 4 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(s.x0 * T + w / 2, 0.015, s.z0 * T + h / 2); mesh.receiveShadow = true;
    scene.add(mesh);
  }
  // team banners at spawns
  {
    const pole = new Batch(new THREE.CylinderGeometry(0.05, 0.06, 1, 8), darkMet, { shadow: true });
    const cloth = new Batch(new THREE.PlaneGeometry(1, 1, 1, 4), std({ color: '#ffffff', side: THREE.DoubleSide, roughness: 1 }), { shadow: true });
    for (const [tx, tz, col] of [[21.5, 34, '#a8452c'], [24.5, 34, '#a8452c'], [20, 1, '#2b6283'], [26, 1, '#2b6283']]) {
      pole.add(tx * T, 2.5, tz * T + 1, 1, 5, 1); cloth.add(tx * T + 0.62, 3.8, tz * T + 1, 1.2, 2, 1, 0, col);
    }
    pole.build(scene); cloth.build(scene);
  }

  // ---------- palms (deep inside solid blocks and outside the map) + skyline buildings
  const trunk = new Batch(new THREE.CylinderGeometry(0.11, 0.15, 1, 7, 1, true).translate(0, 0.5, 0), std({ map: X.bark, roughness: 1 }), { shadow: true });
  const frondGeo = (() => {
    const g = new THREE.PlaneGeometry(0.7, 3.2, 1, 4).translate(0, 1.6, 0).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const zz = -p.getZ(i); p.setY(i, p.getY(i) + zz * 0.35 - zz * zz * 0.16); }
    g.computeVertexNormals(); return g;
  })();
  const frond = new Batch(frondGeo, std({ map: X.frond, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, emissive: '#2a3214', color: '#c8d890' }), { shadow: true });
  const palm = (x, z, hgt) => {
    let px = x, pz = z, py = 0; const lean = rnd() * 6.28, bend = 0.08 + rnd() * 0.12, segs = 5, sl = hgt / segs;
    for (let i = 0; i < segs; i++) {
      const tilt = bend * (i + 1) * 0.5;
      trunk.add(px, py, pz, 1 - i * 0.08, sl * 1.02, 1 - i * 0.08, lean, null, tilt);
      px += Math.sin(lean) * Math.sin(tilt) * sl; pz += Math.cos(lean) * Math.sin(tilt) * sl; py += Math.cos(tilt) * sl;
    }
    const n = 9 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) frond.add(px, py - 0.05, pz, 1, 1, 0.9 + rnd() * 0.4, (i / n) * 6.28 + rnd() * 0.4, _c.setHSL(0.2 + rnd() * 0.05, 0.25, 0.75 + rnd() * 0.25).getHexString().replace(/^/, '#'), -0.1 - rnd() * 0.35);
  };
  // distance-to-open for solid tiles
  const dOpen = (x, z) => { for (let r = 1; r <= 4; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (!solid(x + dx, z + dz)) return r; return 5; };
  for (let z = 1; z < S.H - 1; z++) for (let x = 1; x < S.W - 1; x++) {
    if (!solid(x, z)) continue;
    const d = dOpen(x, z);
    if (d >= 3 && rnd() < 0.09) palm(x * T + 1 + (rnd() - 0.5), z * T + 1 + (rnd() - 0.5), 6.5 + rnd() * 3);
  }
  const bld = new Batch(boxB, std({ map: X.facade, roughness: 0.9 }), { shadow: true });
  const roof = new Batch(boxB, std({ color: '#cbb795', roughness: 0.95 }), { shadow: false });
  const tank = new Batch(new THREE.CylinderGeometry(0.6, 0.6, 1.1, 10).translate(0, 0.55, 0), std({ color: '#d9d4c8', roughness: 0.5, metalness: 0.2 }));
  const ring = (inset, outset, step) => {
    // walk around the map perimeter, dropping buildings in the band outside it
    for (let side = 0; side < 4; side++) {
      const len = side % 2 ? MH : MW;
      for (let t = -outset; t < len + outset; t += step * (0.7 + rnd() * 0.6)) {
        const w = 6 + rnd() * 8, d = 6 + rnd() * 8, hh = 7 + rnd() * 10, o = inset + rnd() * 6 + d / 2;
        let x, z;
        if (side === 0) { x = t; z = -o; } else if (side === 1) { x = MW + o; z = t; } else if (side === 2) { x = MW - t; z = MH + o; } else { x = -o; z = MH - t; }
        bld.add(x, 0, z, w, hh, d, 0, '#' + _c.set(pick(PALETTE)).offsetHSL(0, 0, (rnd() - 0.5) * 0.06).getHexString());
        roof.add(x, hh, z, w + 0.3, 0.35, d + 0.3);
        if (rnd() < 0.4) tank.add(x + (rnd() - 0.5) * w * 0.5, hh + 0.35, z + (rnd() - 0.5) * d * 0.5, 1, 1, 1);
        if (rnd() < 0.35) palm(side % 2 ? x + (side === 1 ? -o + 2 : o - 2) : x + (rnd() - 0.5) * 4, side % 2 ? z : z + (side === 0 ? o - 2 : -o + 2), 7 + rnd() * 4);
      }
    }
  };
  ring(4, 10, 9);
  bld.build(scene); roof.build(scene); tank.build(scene); trunk.build(scene); frond.build(scene);

  return { sortWalls, skyColor: HORIZON };
}
