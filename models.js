// Dustline - character + weapon models (procedural, merged per material to keep draw calls low).
// Gun convention: origin at the pistol grip / trigger, bore along -z at y=0, muzzle at z = -(GUN_L + BARREL_X).
import * as THREE from 'three';

// ------------------------------------------------------------------ shared helpers
const geoCache = new Map();
const cached = (k, f) => { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g; };
export function boxGeo(w, h, d) { return cached(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)); }
export function box(w, h, d, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = w * h * d > 0.012; return m;
}
// cylinder along z (rf = radius at the front / -z end)
function cyl(rf, rb, len, mat, x = 0, y = 0, z = 0, seg = 10) {
  const g = cached(`c${rf}|${rb}|${len}|${seg}`, () => new THREE.CylinderGeometry(rf, rb, len, seg).rotateX(-Math.PI / 2));
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); return m;
}
// cylinder along x
function cylX(r, len, mat, x = 0, y = 0, z = 0, seg = 8) {
  const g = cached(`cx${r}|${len}|${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2));
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); return m;
}
function sph(r, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, ws = 10, hs = 7) {
  const m = new THREE.Mesh(cached(`s${r}|${ws}|${hs}`, () => new THREE.SphereGeometry(r, ws, hs)), mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); return m;
}
const _up = new THREE.Vector3(0, 1, 0);
// capsule between two points
function limb(p1, p2, r, mat, r2 = r) {
  const d = new THREE.Vector3().subVectors(p2, p1), len = d.length();
  const g = r2 === r ? cached(`cap${r}|${len.toFixed(3)}`, () => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 2, 8))
    : cached(`cone${r}|${r2}|${len.toFixed(3)}`, () => new THREE.CylinderGeometry(r2, r, len, 8));
  const m = new THREE.Mesh(g, mat);
  m.position.copy(p1).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(_up, d.normalize());
  m.castShadow = true; return m;
}
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(...rep); return t;
}
function speck(c, w, h, n, a) { for (let i = 0; i < n; i++) { const v = (Math.random() - 0.5) * a; c.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }

// Merge a group's direct child meshes into one mesh per material (fewer draw calls per character).
export function mergeGroup(g) {
  const byMat = new Map();
  for (const c of [...g.children]) if (c.isMesh && !c.children.length && !c.name) { if (!byMat.has(c.material)) byMat.set(c.material, []); byMat.get(c.material).push(c); }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    let nv = 0, ni = 0; const shadow = list.some((c) => c.castShadow);
    for (const c of list) { nv += c.geometry.attributes.position.count; ni += c.geometry.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0, oi = 0;
    for (const c of list) {
      c.updateMatrix();
      const geo = c.geometry.clone().applyMatrix4(c.matrix);
      pos.set(geo.attributes.position.array, ov * 3); nor.set(geo.attributes.normal.array, ov * 3); uv.set(geo.attributes.uv.array, ov * 2);
      const src = geo.index.array; for (let i = 0; i < src.length; i++) idx[oi + i] = src[i] + ov;
      ov += geo.attributes.position.count; oi += src.length; geo.dispose();
      g.remove(c);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    mg.setIndex(new THREE.BufferAttribute(idx, 1)); mg.computeBoundingSphere();
    const m = new THREE.Mesh(mg, mat); m.castShadow = shadow; g.add(m);
  }
  return g;
}

// ------------------------------------------------------------------ materials
const woodTex = canvasTex(128, 256, (c, w, h) => {
  c.fillStyle = '#9a6a44'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { c.strokeStyle = `rgba(${Math.random() < 0.5 ? '60,30,12' : '170,110,60'},${0.15 + Math.random() * 0.3})`; c.lineWidth = 0.6 + Math.random() * 1.6; c.beginPath(); let x = Math.random() * w; c.moveTo(x, 0); for (let y = 0; y <= h; y += 16) { x += (Math.random() - 0.5) * 3; c.lineTo(x, y); } c.stroke(); }
  speck(c, w, h, 600, 0.2);
});
const metalTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#808080'; c.fillRect(0, 0, w, h); speck(c, w, h, 2500, 0.18); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(Math.random() * w, Math.random() * h, 8 + Math.random() * 20, 1); } });
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.6, ...o });
export const gunMat = std({ color: '#3a3c3f', roughness: 0.42, metalness: 0.65, map: metalTex });   // steel / parkerized
export const darkMat = std({ color: '#2b2c2f', roughness: 0.5, metalness: 0.25 });                  // black polymer / anodized
export const woodMat = std({ color: '#a88468', roughness: 0.55, map: woodTex });
const steelMat = std({ color: '#2a2b2e', roughness: 0.35, metalness: 0.8, map: metalTex });
const fdeMat = std({ color: '#9a8461', roughness: 0.72, metalness: 0.05 });
const odMat = std({ color: '#4f5638', roughness: 0.7, metalness: 0.1 });
const bakeliteMat = std({ color: '#5e3220', roughness: 0.5, metalness: 0.05 });
const brassMat = std({ color: '#b08d4a', roughness: 0.35, metalness: 0.8 });
const sightDot = new THREE.MeshBasicMaterial({ color: '#d8f05a' });
export const laserMat = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
export const opticMat = std({ color: '#25272a', roughness: 0.55, metalness: 0.5 });
const sightGlassMat = new THREE.MeshBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.1, depthWrite: false });
const holoBtnMat = std({ color: '#3d4144', roughness: 0.7 });
const glassMat = std({ color: '#2e4a5a', roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.7 });
const microShieldMat = std({ color: '#6f6250', roughness: 0.6, metalness: 0.35 });
const microLensMat = new THREE.MeshBasicMaterial({ color: '#7fb6ff', transparent: true, opacity: 0.16, depthWrite: false });
const microLedMat = new THREE.MeshBasicMaterial({ color: '#173f24' });

export const GUN_L = { sidearm: 0.2, cannon: 0.28, hornet: 0.3, vector: 0.42, breacher: 0.74, bulldog: 0.58, raptor: 0.62, sentinel: 0.82, warden: 0.74, longbow: 0.95 };
export const BARREL_X = { raptor: 0.26, sentinel: 0.22, warden: 0.18 };
// height of the iron-sight line above the bore (gun units, before viewmodel scale)
export const IRON_Y = { raptor: 0.098, vector: 0.092, hornet: 0.075, bulldog: 0.062, sentinel: 0.075, warden: 0.1, longbow: 0.1, breacher: 0.032, sidearm: 0.064, cannon: 0.054 };
// where the support hand grips (z along the gun) and whether the weapon is a handgun
export const LH_Z = { raptor: -0.4, vector: -0.24, hornet: -0.2, bulldog: -0.33, sentinel: -0.4, warden: -0.44, longbow: -0.42, breacher: -0.44, sidearm: 0.0, cannon: 0.0 };
export const PISTOL = new Set(['sidearm', 'cannon']);
const RIFLE = new Set(['raptor', 'vector', 'bulldog', 'sentinel', 'warden', 'hornet']);
// [optic position along the gun (fraction of length), eye distance when aiming]
export const SIGHT_Z = { reddot: [0.35, 0.2], micro: [0.3, 0.19], holo: [0.4, 0.17] };
const topOf = (key) => (key === 'sidearm' || key === 'cannon' || key === 'hornet' ? 0.055 : 0.065);

// ------------------------------------------------------------------ gun parts
function rail(g, len, z, y, w = 0.03) {
  // picatinny: base strip + cross slots; top surface at y
  g.add(box(w, 0.008, len, darkMat, 0, y - 0.004 - 0.004, z));
  const n = Math.floor(len / 0.012);
  for (let i = 0; i < n; i++) g.add(box(w + 0.004, 0.005, 0.006, darkMat, 0, y - 0.0025, z - len / 2 + 0.006 + i * (len / n)));
}
function curvedMag(g, mat, x, y, z, w, d, segs, segH, curve, ext = 1) {
  // stacked segments that curve forward toward the bottom (STANAG / AK banana)
  let px = 0, py = y, pz = z, a = 0;
  const n = Math.round(segs * ext);
  for (let i = 0; i < n; i++) {
    const m = box(w, segH * 1.04, d, mat, x, py - Math.cos(a) * segH / 2, pz - Math.sin(a) * segH / 2, a);
    g.add(m);
    py -= Math.cos(a) * segH; pz -= Math.sin(a) * segH; a += curve;
  }
  g.add(box(w + 0.006, 0.012, d + 0.01, darkMat, x, py - 0.004, pz - 0.002, a - curve));
  void px;
}
function grip(g, mat, z = 0.03, y = -0.065, h = 0.11, tilt = -0.32, w = 0.034, d = 0.046) {
  g.add(box(w, h, d, mat, 0, y, z, tilt));
  // finger grooves / texture strip
  g.add(box(w + 0.002, h * 0.8, 0.006, darkMat, 0, y, z - d / 2 - 0.001 + 0.002, tilt));
}
function triggerGuard(g, z = -0.03, y = -0.045, len = 0.07) {
  g.add(box(0.012, 0.006, len, darkMat, 0, y - 0.022, z));
  g.add(box(0.012, 0.024, 0.006, darkMat, 0, y - 0.01, z - len / 2));
  g.add(box(0.004, 0.022, 0.006, steelMat, 0, y - 0.008, z + 0.005, 0.25)); // trigger blade
}
function peepRear(g, y, z, w = 0.026) {
  g.add(box(w, 0.016, 0.022, darkMat, 0, y - 0.025, z));
  for (const s of [-1, 1]) g.add(box(0.005, 0.03, 0.02, darkMat, s * 0.009, y - 0.006, z));
  const ring = new THREE.Mesh(cached('peep', () => new THREE.TorusGeometry(0.0055, 0.0022, 6, 14)), darkMat); ring.position.set(0, y, z); g.add(ring);
}
function postFront(g, y, z, base) {
  g.add(box(0.016, y - base - 0.012, 0.016, darkMat, 0, (y + base) / 2 - 0.006, z));
  g.add(box(0.003, 0.016, 0.004, darkMat, 0, y - 0.008, z)); // thin post, tip at y
  for (const s of [-1, 1]) g.add(box(0.0035, 0.02, 0.012, darkMat, s * 0.009, y - 0.01, z)); // protective ears
}
function muzzleDevice(g, z, r = 0.012, len = 0.05) {
  g.add(cyl(r, r, len, darkMat, 0, 0, z - len / 2, 10));
  for (let i = 0; i < 3; i++) g.add(box(0.004, r * 2.05, 0.008, steelMat, 0, 0, z - 0.012 - i * 0.012));
}

// ------------------------------------------------------------------ weapons
const BUILD = {
  raptor(g, o) { // AR-15 / M4 carbine
    g.add(box(0.05, 0.055, 0.2, darkMat, 0, -0.022, -0.06));                // lower receiver
    g.add(box(0.056, 0.05, 0.075, darkMat, 0, -0.065, -0.135));             // magwell
    triggerGuard(g, -0.035, -0.05);
    grip(g, darkMat, 0.035, -0.08, 0.11);
    g.add(box(0.052, 0.052, 0.22, darkMat, 0, 0.026, -0.08));               // upper receiver
    g.add(box(0.002, 0.026, 0.07, steelMat, 0.027, 0.02, -0.06));           // ejection port cover
    g.add(cylX(0.008, 0.02, darkMat, 0.032, 0.03, 0.01));                    // forward assist
    g.add(box(0.026, 0.01, 0.035, darkMat, 0, 0.056, 0.045));               // charging handle
    rail(g, 0.22, -0.08, 0.065);
    g.add(cyl(0.032, 0.032, 0.32, darkMat, 0, 0.012, -0.35, 8));            // octagonal handguard
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) g.add(box(0.004, 0.012, 0.03, steelMat, s * 0.031, 0.012, -0.24 - i * 0.055)); // M-LOK slots
    rail(g, 0.32, -0.35, 0.065);
    g.add(box(0.03, 0.022, 0.32, darkMat, 0, 0.048, -0.35));
    g.add(cyl(0.009, 0.009, 0.32, steelMat, 0, 0, -0.66));                  // barrel
    g.add(cyl(0.013, 0.013, 0.025, steelMat, 0, 0, -0.55));                 // gas block
    muzzleDevice(g, -0.82, 0.012, 0.06);
    g.add(cyl(0.016, 0.016, 0.17, darkMat, 0, 0.022, 0.13));                // buffer tube
    g.add(box(0.044, 0.07, 0.15, darkMat, 0, 0.0, 0.2, 0.06));              // collapsible stock
    g.add(box(0.046, 0.1, 0.03, darkMat, 0, -0.012, 0.275));                // butt pad
    o.curved(darkMat, 0, -0.085, -0.135, 0.05, 0.068, 5, 0.032, 0.07);    // 30rd STANAG
    if (!o.optic) { peepRear(g, IRON_Y.raptor, 0.02); postFront(g, IRON_Y.raptor, -0.5, 0.06); }
  },
  vector(g, o) { // KRISS Vector
    g.add(box(0.05, 0.065, 0.36, darkMat, 0, 0.022, -0.12));                // upper
    rail(g, 0.3, -0.12, 0.065);
    g.add(box(0.05, 0.13, 0.12, darkMat, 0, -0.06, -0.23, 0.55));          // slanted recoil housing
    g.add(box(0.048, 0.05, 0.16, darkMat, 0, -0.025, -0.06));                // lower frame
    triggerGuard(g, -0.015, -0.05, 0.06);
    grip(g, darkMat, 0.035, -0.08, 0.1, -0.2);
    o.straight(darkMat, 0, -0.06, -0.085, 0.03, 0.04, 0.16);                 // Glock-style mag
    g.add(cyl(0.016, 0.016, 0.12, darkMat, 0, 0.004, -0.36));               // barrel shroud
    g.add(cyl(0.008, 0.008, 0.06, steelMat, 0, 0.004, -0.39));
    g.add(box(0.03, 0.06, 0.03, darkMat, 0, 0.0, 0.09));                    // stock adapter
    g.add(box(0.028, 0.03, 0.18, darkMat, 0, 0.0, 0.18));                   // folding stock
    g.add(box(0.04, 0.09, 0.025, darkMat, 0, -0.01, 0.27));
    g.add(box(0.012, 0.01, 0.03, steelMat, 0.028, 0.03, -0.02));             // charging handle
    if (!o.optic) { peepRear(g, IRON_Y.vector, 0.01); postFront(g, IRON_Y.vector, -0.25, 0.065); }
  },
  hornet(g, o) { // MP7-style PDW
    g.add(box(0.045, 0.06, 0.25, darkMat, 0, 0.014, -0.09));
    rail(g, 0.22, -0.1, 0.055);
    g.add(box(0.04, 0.05, 0.1, darkMat, 0, -0.03, -0.16));
    triggerGuard(g, -0.03, -0.04, 0.05);
    g.add(box(0.032, 0.12, 0.045, darkMat, 0, -0.08, 0.02, -0.12));       // grip (mag goes through it)
    o.straight(darkMat, 0, -0.14, 0.024, 0.026, 0.038, 0.09);
    g.add(box(0.024, 0.075, 0.03, darkMat, 0, -0.07, -0.2, 0.15));         // folding foregrip
    g.add(cyl(0.008, 0.008, 0.1, steelMat, 0, 0.004, -0.27));
    g.add(cyl(0.012, 0.012, 0.03, darkMat, 0, 0.004, -0.31));
    for (const s of [-1, 1]) g.add(box(0.005, 0.008, 0.15, steelMat, s * 0.018, 0.0, 0.1)); // stock rods
    g.add(box(0.045, 0.06, 0.016, darkMat, 0, -0.005, 0.18));
    if (!o.optic) { g.add(box(0.03, 0.02, 0.02, darkMat, 0, 0.065, 0.01)); g.add(box(0.004, 0.022, 0.006, darkMat, 0, 0.064, -0.18)); }
  },
  bulldog(g, o) { // AKM
    g.add(box(0.05, 0.06, 0.27, steelMat, 0, 0.0, -0.05));                  // stamped receiver
    g.add(box(0.046, 0.016, 0.24, steelMat, 0, 0.036, -0.04));              // dust cover
    g.add(box(0.008, 0.008, 0.06, steelMat, 0.03, 0.012, -0.03));          // charging handle
    g.add(box(0.004, 0.03, 0.12, steelMat, 0.026, -0.005, 0.02));            // safety lever
    triggerGuard(g, -0.03, -0.04);
    grip(g, bakeliteMat, 0.04, -0.075, 0.105, -0.3);
    g.add(box(0.056, 0.05, 0.2, woodMat, 0, -0.01, -0.29));                 // lower handguard
    g.add(box(0.036, 0.026, 0.18, woodMat, 0, 0.032, -0.28));               // upper handguard
    g.add(cyl(0.01, 0.01, 0.18, steelMat, 0, 0.034, -0.46));               // gas tube
    g.add(cyl(0.0095, 0.0095, 0.32, steelMat, 0, 0, -0.55));                // barrel
    g.add(box(0.022, 0.06, 0.03, steelMat, 0, 0.012, -0.55));              // gas block
    g.add(box(0.03, 0.06, 0.026, steelMat, 0, 0.01, -0.62));               // front sight block
    g.add(cyl(0.013, 0.014, 0.05, steelMat, 0, 0, -0.68, 8));              // slant brake
    g.add(box(0.06, 0.06, 0.24, woodMat, 0, -0.03, 0.2, 0.17));            // wooden stock
    g.add(box(0.06, 0.11, 0.02, steelMat, 0, -0.06, 0.32, 0.17));
    o.curved(steelMat, 0, -0.03, -0.12, 0.034, 0.06, 6, 0.03, 0.14);      // banana mag
    if (o.optic) { g.add(box(0.014, 0.05, 0.12, steelMat, -0.03, 0.025, -0.06)); rail(g, 0.16, -0.08, 0.065); g.add(box(0.03, 0.02, 0.16, darkMat, 0, 0.05, -0.08)); }
    else { g.add(box(0.028, 0.02, 0.05, steelMat, 0, 0.046, -0.2)); g.add(box(0.016, 0.008, 0.04, steelMat, 0, 0.057, -0.2)); postFront(g, IRON_Y.bulldog, -0.62, 0.035); }
  },
  sentinel(g, o) { // M14 / DMR in a walnut stock
    g.add(box(0.058, 0.06, 0.58, woodMat, 0, -0.018, -0.2));               // forend + wrist
    g.add(box(0.05, 0.11, 0.25, woodMat, 0, -0.05, 0.19, 0.12));           // butt
    g.add(box(0.052, 0.12, 0.03, darkMat, 0, -0.07, 0.31, 0.12));
    grip(g, woodMat, 0.04, -0.07, 0.09, -0.4, 0.04, 0.05);
    g.add(box(0.046, 0.04, 0.26, steelMat, 0, 0.024, -0.06));               // receiver
    g.add(box(0.03, 0.012, 0.05, steelMat, 0.022, 0.04, -0.02));           // op rod handle
    triggerGuard(g, -0.03, -0.05);
    o.straight(steelMat, 0, -0.045, -0.12, 0.034, 0.07, 0.11);
    g.add(cyl(0.011, 0.011, 0.55, steelMat, 0, 0.004, -0.78));             // barrel
    g.add(box(0.03, 0.035, 0.07, steelMat, 0, -0.008, -0.58));            // gas cylinder
    muzzleDevice(g, -1.0, 0.013, 0.06);
    if (o.optic) { rail(g, 0.2, -0.08, 0.065); g.add(box(0.03, 0.02, 0.2, darkMat, 0, 0.051, -0.08)); }
    else { peepRear(g, IRON_Y.sentinel, 0.03); postFront(g, IRON_Y.sentinel, -0.95, 0.012); }
  },
  warden(g, o) { // M249 SAW
    g.add(box(0.07, 0.085, 0.32, steelMat, 0, 0.0, -0.08));
    g.add(box(0.072, 0.03, 0.2, steelMat, 0, 0.045, -0.1));                // feed cover
    rail(g, 0.2, -0.1, 0.065);
    g.add(box(0.012, 0.012, 0.06, darkMat, 0.04, 0.0, -0.02));             // charging handle
    triggerGuard(g, -0.02, -0.055);
    grip(g, darkMat, 0.04, -0.09, 0.11, -0.25);
    const bx = o.ext ? 0.16 : 0.12;
    g.add(box(0.1, bx, 0.11, odMat, -0.012, -0.045 - bx / 2, -0.14));       // ammo box
    g.add(box(0.08, 0.012, 0.03, darkMat, -0.012, -0.045 - bx - 0.004, -0.14));
    for (let i = 0; i < 6; i++) g.add(cylX(0.006, 0.02, brassMat, -0.045, 0.02, -0.06 - i * 0.012, 6)); // belt links
    g.add(cyl(0.035, 0.035, 0.22, darkMat, 0, 0.012, -0.36, 10));          // heat shield
    g.add(cyl(0.012, 0.012, 0.54, steelMat, 0, 0, -0.65));
    g.add(box(0.03, 0.05, 0.04, steelMat, 0, -0.025, -0.52));              // gas block
    g.add(box(0.012, 0.06, 0.016, darkMat, 0, 0.05, -0.32));               // carry handle post
    g.add(box(0.016, 0.014, 0.18, darkMat, 0, 0.085, -0.38));
    for (const s of [-1, 1]) g.add(cyl(0.006, 0.006, 0.28, steelMat, s * 0.014, -0.03, -0.68)); // folded bipod
    muzzleDevice(g, -0.92, 0.014, 0.05);
    g.add(box(0.05, 0.1, 0.24, darkMat, 0, -0.03, 0.18, 0.08));            // skeleton stock
    g.add(box(0.052, 0.13, 0.03, darkMat, 0, -0.04, 0.3, 0.08));
    if (!o.optic) { g.add(box(0.024, 0.024, 0.02, darkMat, 0, IRON_Y.warden - 0.012, 0.0)); postFront(g, IRON_Y.warden, -0.86, 0.015); }
  },
  longbow(g) { // bolt-action magnum sniper with thumbhole stock
    const stk = odMat;
    g.add(box(0.06, 0.07, 0.48, stk, 0, -0.02, -0.18));                     // forend / chassis
    g.add(box(0.058, 0.08, 0.18, stk, 0, -0.03, 0.16, 0.06));               // rear stock top
    g.add(box(0.058, 0.04, 0.16, stk, 0, -0.12, 0.22, -0.1));               // thumbhole lower bar
    g.add(box(0.058, 0.13, 0.04, stk, 0, -0.08, 0.32));                     // butt
    g.add(box(0.062, 0.14, 0.02, darkMat, 0, -0.08, 0.345));                // recoil pad
    g.add(box(0.03, 0.03, 0.12, stk, 0, 0.02, 0.18));                       // cheek rest
    grip(g, stk, 0.06, -0.075, 0.1, -0.15, 0.036, 0.05);
    triggerGuard(g, -0.01, -0.05);
    g.add(cyl(0.02, 0.02, 0.24, steelMat, 0, 0.022, -0.06));                // receiver
    g.add(cylX(0.005, 0.06, steelMat, 0.04, 0.025, 0.04)); g.add(sph(0.011, steelMat, 0.072, 0.02, 0.04)); // bolt handle + knob
    g.add(box(0.035, 0.07, 0.08, darkMat, 0, -0.06, -0.08));                // mag
    g.add(cyl(0.013, 0.015, 0.62, steelMat, 0, 0.02, -0.6));               // fluted heavy barrel
    g.add(box(0.04, 0.03, 0.07, steelMat, 0, 0.02, -0.94));                 // muzzle brake
    for (const s of [-1, 1]) g.add(box(0.008, 0.02, 0.05, darkMat, s * 0.021, 0.02, -0.94));
    // scope
    g.add(cyl(0.018, 0.018, 0.27, darkMat, 0, 0.1, -0.08, 14));
    g.add(cyl(0.03, 0.019, 0.07, darkMat, 0, 0.1, -0.24, 16));             // objective bell
    g.add(cyl(0.025, 0.025, 0.012, glassMat, 0, 0.1, -0.276, 16));
    g.add(cyl(0.022, 0.018, 0.06, darkMat, 0, 0.1, 0.08, 14));             // eyepiece
    g.add(box(0.016, 0.02, 0.016, darkMat, 0, 0.128, -0.08)); g.add(box(0.02, 0.016, 0.016, darkMat, 0.024, 0.1, -0.08)); // turrets
    for (const z of [-0.15, -0.01]) g.add(box(0.022, 0.06, 0.018, darkMat, 0, 0.065, z)); // rings
  },
  breacher(g) { // pump shotgun (870 pattern)
    g.add(box(0.05, 0.065, 0.2, steelMat, 0, -0.006, -0.08));
    triggerGuard(g, -0.03, -0.05);
    g.add(cyl(0.013, 0.013, 0.56, steelMat, 0, 0.012, -0.46));              // barrel
    g.add(box(0.008, 0.006, 0.54, steelMat, 0, 0.027, -0.46));              // vent rib
    g.add(sph(0.004, brassMat, 0, 0.032, -0.72));                           // bead
    g.add(cyl(0.012, 0.012, 0.42, steelMat, 0, -0.022, -0.38));             // magazine tube
    const pump = cyl(0.024, 0.024, 0.17, woodMat, 0, -0.018, -0.44, 12); g.add(pump);
    for (let i = 0; i < 6; i++) g.add(cyl(0.0245, 0.0245, 0.006, darkMat, 0, -0.018, -0.38 - i * 0.025, 12));
    g.add(box(0.05, 0.06, 0.1, woodMat, 0, -0.04, 0.05, -0.35));           // wrist
    g.add(box(0.052, 0.1, 0.26, woodMat, 0, -0.06, 0.2, 0.14));            // stock
    g.add(box(0.054, 0.12, 0.025, darkMat, 0, -0.085, 0.33, 0.14));
    g.add(box(0.004, 0.025, 0.05, steelMat, 0.026, -0.005, -0.08));        // ejection port
  },
  sidearm(g, o) { // striker-fired 9mm (Glock pattern)
    g.add(box(0.03, 0.034, 0.19, darkMat, 0, 0.034, -0.08));                // slide (top at ~0.051)
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) g.add(box(0.002, 0.026, 0.004, steelMat, s * 0.0152, 0.034, 0.0 - i * 0.008)); // serrations
    g.add(box(0.002, 0.016, 0.04, steelMat, 0.016, 0.04, -0.06));          // ejection port
    g.add(cyl(0.007, 0.007, 0.008, steelMat, 0, 0.03, -0.177));            // muzzle crown
    g.add(box(0.028, 0.02, 0.18, darkMat, 0, 0.008, -0.075));               // frame
    rail(g, 0.04, -0.13, -0.001, 0.024);
    triggerGuard(g, -0.04, -0.012, 0.05);
    g.add(box(0.03, 0.105, 0.048, darkMat, 0, -0.048, 0.012, -0.28));     // grip
    g.add(box(0.032, 0.012, 0.052, darkMat, 0, -0.1, 0.028, -0.28));       // mag base
    if (o.ext) g.add(box(0.026, 0.06, 0.04, darkMat, 0, -0.13, 0.036, -0.28));
    if (!o.optic) {
      g.add(box(0.024, 0.012, 0.01, darkMat, -0.0, 0.056, 0.004));
      g.add(sph(0.0018, sightDot, -0.007, 0.06, 0.0)); g.add(sph(0.0018, sightDot, 0.007, 0.06, 0.0));
      g.add(box(0.004, 0.012, 0.006, darkMat, 0, 0.058, -0.165)); g.add(sph(0.0019, sightDot, 0, 0.063, -0.1685));
    }
  },
  cannon(g, o) { // .44 revolver
    g.add(box(0.03, 0.05, 0.1, steelMat, 0, 0.015, -0.035));              // frame
    g.add(cyl(0.024, 0.024, 0.048, steelMat, 0, 0.012, -0.045, 6));       // cylinder
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.add(cyl(0.006, 0.006, 0.05, darkMat, Math.cos(a) * 0.0145, 0.012 + Math.sin(a) * 0.0145, -0.045, 6)); }
    g.add(cyl(0.011, 0.011, 0.19, steelMat, 0, 0.022, -0.185));            // barrel
    g.add(box(0.012, 0.014, 0.19, steelMat, 0, 0.036, -0.185));            // top rib
    g.add(box(0.014, 0.014, 0.17, steelMat, 0, 0.002, -0.17));             // ejector shroud
    g.add(box(0.008, 0.02, 0.025, steelMat, 0, 0.042, 0.022, 0.4));        // hammer
    triggerGuard(g, -0.02, -0.005, 0.045);
    g.add(box(0.032, 0.1, 0.045, woodMat, 0, -0.048, 0.03, -0.42));      // wood grip
    if (!o.optic) { g.add(box(0.016, 0.01, 0.012, steelMat, 0, 0.048, 0.01)); g.add(box(0.004, 0.012, 0.012, steelMat, 0, 0.048, -0.27)); }
    else rail(g, 0.1, -0.15, 0.055, 0.022);
  },
};

function addAttachments(g, key, att, L) {
  if (!att) return;
  const top = topOf(key);
  const bx = BARREL_X[key] || 0;
  if (att.optic === 'reddot') {
    const c = top + 0.043, z = -L * 0.35, o = 0.032, t = 0.008, d = 0.06;
    g.add(box(0.04, 0.014, 0.06, darkMat, 0, top + 0.005, z));
    g.add(box(o * 2, t, d, opticMat, 0, c + o - t / 2, z)); g.add(box(o * 2, t, d, opticMat, 0, c - o + t / 2, z));
    g.add(box(t, o * 2, d, opticMat, -o + t / 2, c, z)); g.add(box(t, o * 2, d, opticMat, o - t / 2, c, z));
    g.add(box(0.014, 0.018, 0.022, opticMat, o + 0.006, c, z + 0.008));
    const gl = box(o * 2 - t * 2, o * 2 - t * 2, 0.002, sightGlassMat, 0, c, z - d / 2 + 0.004); gl.castShadow = false; g.add(gl);
  }
  if (att.optic === 'micro') {
    const z = -L * 0.3, c = 0.095, hw = 0.026, hh = 0.017, wb = c - hh, wt = c + hh, d = 0.014, post = 0.0045;
    g.add(box(0.03, wb - top + 0.004, 0.07, darkMat, 0, (top + wb) / 2, z + 0.01));
    g.add(box(hw * 2 + 0.004, 0.006, 0.03, microShieldMat, 0, wb + 0.001, z - 0.012));
    for (const sx of [-1, 1]) {
      const s1 = box(post, wt - wb, d, microShieldMat, sx * (hw - post / 2 + 0.002), c, z - 0.02); s1.rotation.z = sx * 0.12; g.add(s1);
      const s2 = box(0.012, 0.008, 0.012, microShieldMat, sx * (hw - 0.004), wt - 0.002, z - 0.02); s2.rotation.z = sx * -0.55; g.add(s2);
    }
    g.add(box(hw * 1.35, 0.005, d + 0.004, microShieldMat, 0, wt + 0.002, z - 0.02));
    const lens = box(hw * 2 - 0.006, hh * 2 - 0.004, 0.0015, microLensMat, 0, c, z - 0.024); lens.castShadow = false; lens.rotation.x = -0.12; g.add(lens);
    g.add(box(0.004, 0.0025, 0.004, microLedMat, 0, wb + 0.005, z + 0.03));
    g.add(box(0.006, 0.006, 0.01, darkMat, hw - 0.002, wb - 0.002, z + 0.026));
  }
  if (att.optic === 'holo') {
    const z = -L * 0.4, hw = 0.036, wb = top + 0.012, wt = top + 0.062, d = 0.075;
    g.add(box(0.064, 0.016, 0.13, opticMat, 0, top + 0.004, z + 0.01));
    g.add(box(0.026, 0.026, 0.07, opticMat, hw + 0.012, top + 0.016, z + 0.03));
    g.add(box(0.03, 0.006, 0.012, darkMat, hw + 0.012, top + 0.016, z + 0.068));
    g.add(box(0.012, wt - wb, d, opticMat, -hw, (wb + wt) / 2, z - 0.01)); g.add(box(0.012, wt - wb, d, opticMat, hw, (wb + wt) / 2, z - 0.01));
    g.add(box(hw * 2 + 0.012, 0.012, d + 0.012, opticMat, 0, wt + 0.004, z - 0.01));
    g.add(box(hw * 2 + 0.006, 0.006, 0.02, darkMat, 0, wt + 0.012, z + 0.01));
    g.add(box(0.012, 0.008, 0.008, holoBtnMat, -0.014, top + 0.016, z + 0.072)); g.add(box(0.012, 0.008, 0.008, holoBtnMat, 0.014, top + 0.016, z + 0.072));
    for (const zz of [z - d / 2 - 0.004, z + d / 2 - 0.01]) { const gl = box(hw * 2 - 0.012, wt - wb, 0.002, sightGlassMat, 0, (wb + wt) / 2, zz); gl.castShadow = false; g.add(gl); }
  }
  if (att.optic === 'prism') {
    const z = -L * 0.38, y = top + 0.03;
    g.add(box(0.05, 0.012, 0.09, darkMat, 0, top + 0.004, z));
    g.add(box(0.058, 0.046, 0.1, opticMat, 0, y, z));
    g.add(cyl(0.024, 0.024, 0.03, opticMat, 0, y, z - 0.062, 14)); g.add(cyl(0.02, 0.02, 0.004, glassMat, 0, y, z - 0.078, 14));
    g.add(cyl(0.02, 0.02, 0.03, opticMat, 0, y, z + 0.064, 14));
    g.add(box(0.018, 0.018, 0.02, opticMat, 0.034, y, z));
  }
  if (att.optic === 'recon') {
    const z = -L * 0.38, y = top + 0.045;
    g.add(cyl(0.017, 0.017, 0.24, opticMat, 0, y, z, 14));
    g.add(cyl(0.03, 0.018, 0.07, opticMat, 0, y, z - 0.15, 16)); g.add(cyl(0.026, 0.026, 0.004, glassMat, 0, y, z - 0.186, 16));
    g.add(cyl(0.022, 0.017, 0.05, opticMat, 0, y, z + 0.14, 14));
    g.add(box(0.016, 0.02, 0.016, opticMat, 0, y + 0.024, z)); g.add(box(0.02, 0.016, 0.016, opticMat, 0.024, y, z));
    for (const zz of [z - 0.07, z + 0.07]) g.add(box(0.022, 0.05, 0.016, darkMat, 0, top + 0.02, zz));
  }
  if (att.optic === 'acog') {
    const z = -L * 0.38, y = top + 0.035;
    g.add(box(0.04, 0.014, 0.1, darkMat, 0, top + 0.006, z));
    g.add(cyl(0.022, 0.016, 0.16, opticMat, 0, y, z, 12));
    g.add(cyl(0.025, 0.025, 0.04, opticMat, 0, y, z - 0.09, 14)); g.add(cyl(0.021, 0.021, 0.004, glassMat, 0, y, z - 0.111, 14));
    g.add(box(0.016, 0.014, 0.03, opticMat, 0, y + 0.024, z)); g.add(box(0.012, 0.006, 0.06, odMat, 0, y + 0.033, z - 0.02)); // fibre optic
  }
  const mz = -L - bx;
  if (att.muzzle === 'supp') { g.add(cyl(0.022, 0.022, 0.2, darkMat, 0, 0, mz - 0.09, 14)); g.add(cyl(0.016, 0.022, 0.02, darkMat, 0, 0, mz - 0.2, 14)); }
  if (att.muzzle === 'comp') { g.add(cyl(0.02, 0.02, 0.07, darkMat, 0, 0, mz - 0.03, 8)); for (let i = 0; i < 3; i++) g.add(box(0.044, 0.006, 0.01, steelMat, 0, 0.012, mz - 0.01 - i * 0.02)); }
  if (att.grip === 'grip') { g.add(cyl(0.016, 0.016, 0.1, darkMat, 0, -0.09, -L * 0.72, 10).rotateX(Math.PI / 2)); g.add(box(0.028, 0.012, 0.05, darkMat, 0, -0.035, -L * 0.72)); }
  if (att.rail === 'laser') {
    const lz = -Math.min(L * 0.7, L - 0.06), lx = 0.03 + 0.016;
    g.add(box(0.008, 0.02, 0.05, darkMat, 0.034, 0, lz + 0.01));
    g.add(box(0.026, 0.032, 0.075, opticMat, lx, -0.004, lz));
    g.add(box(0.01, 0.01, 0.012, opticMat, lx, 0.016, lz + 0.02));
    const em = box(0.012, 0.012, 0.004, laserMat, lx, -0.004, lz - 0.038); em.name = 'laserEmit'; g.add(em);
  }
}
export function gunModel(key, scale = 1, att = null) {
  const g = new THREE.Group();
  const L = GUN_L[key] || 0.3;
  const ext = att?.mag === 'extmag';
  const o = {
    optic: !!att?.optic, ext,
    curved: (mat, x, y, z, w, d, segs, segH, curve) => curvedMag(g, mat, x, y, z, w, d, segs, segH, curve / segs, ext ? 1.5 : 1),
    straight: (mat, x, y, z, w, d, h) => { const hh = h * (ext ? 1.6 : 1); g.add(box(w, hh, d, mat, x, y - hh / 2, z)); g.add(box(w + 0.006, 0.012, d + 0.008, darkMat, x, y - hh - 0.004, z)); },
  };
  (BUILD[key] || BUILD.sidearm)(g, o);
  addAttachments(g, key, att, L);
  g.scale.setScalar(scale);
  return g;
}
const mergedGunCache = new Map();
export function avatarGun(key) {
  let src = mergedGunCache.get(key);
  if (!src) { src = bake(gunModel(key, 1)); mergedGunCache.set(key, src); }
  const g = new THREE.Group(); const m = new THREE.Mesh(src, gunBakeMat); m.receiveShadow = true; g.add(m); g.scale.setScalar(1.1);
  return g;
}

// ------------------------------------------------------------------ people
const fabricTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#d0d0d0'; c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.05; for (let i = 0; i < w; i += 2) { c.fillStyle = i % 4 ? '#000' : '#fff'; c.fillRect(i, 0, 1, h); c.fillRect(0, i, w, 1); }
  c.globalAlpha = 1; speck(c, w, h, 1500, 0.18);
  for (let i = 0; i < 12; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; c.beginPath(); c.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 25, 4 + Math.random() * 10, Math.random() * 3, 0, 7); c.fill(); }
});
const camoTex = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#b8a582'; c.fillRect(0, 0, w, h);
  for (const [col, n, s] of [['#8e7a55', 26, 30], ['#6f6a45', 18, 22], ['#c9b892', 20, 18], ['#4f4532', 12, 12]]) for (let i = 0; i < n; i++) {
    c.fillStyle = col; c.beginPath(); const x = Math.random() * w, y = Math.random() * h;
    for (let a = 0; a < 6.3; a += 0.7) { const r = s * (0.5 + Math.random()); c.lineTo(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r); } c.fill();
  }
  speck(c, w, h, 2500, 0.15);
}, [2, 2]);
const molleTex = canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = '#c8c8c8'; c.fillRect(0, 0, w, h); speck(c, w, h, 1200, 0.2);
  for (let y = 10; y < h; y += 22) { c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(0, y, w, 10); c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, y, w, 2); for (let x = 0; x < w; x += 18) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x, y, 2, 10); } }
});
function faceTex(skin, beard) {
  return canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = skin; c.fillRect(0, 0, w, h); speck(c, w, h, 900, 0.08);
    const fx = w * 0.25; // +z front of a SphereGeometry sits at u = 0.25
    const cheek = c.createRadialGradient(fx, h * 0.55, 2, fx, h * 0.55, 34); cheek.addColorStop(0, 'rgba(200,90,70,0.12)'); cheek.addColorStop(1, 'rgba(200,90,70,0)'); c.fillStyle = cheek; c.fillRect(0, 0, w, h);
    for (const s of [-1, 1]) {
      c.fillStyle = '#f2ede6'; c.beginPath(); c.ellipse(fx + s * 11, h * 0.47, 5, 2.6, 0, 0, 7); c.fill();
      c.fillStyle = '#3b2a1c'; c.beginPath(); c.arc(fx + s * 11, h * 0.47, 2.2, 0, 7); c.fill();
      c.fillStyle = 'rgba(40,25,15,0.85)'; c.fillRect(fx + s * 11 - 6, h * 0.405, 12, 2.4); // brows
      c.fillStyle = 'rgba(60,30,20,0.25)'; c.fillRect(fx + s * 11 - 5, h * 0.5, 10, 1.5);   // under-eye
    }
    c.fillStyle = 'rgba(120,60,50,0.7)'; c.fillRect(fx - 7, h * 0.66, 14, 2.2); // mouth
    if (beard) { c.fillStyle = 'rgba(40,28,18,0.65)'; c.beginPath(); c.ellipse(fx, h * 0.7, 26, 11, 0, 0, 7); c.fill(); c.fillStyle = skin; c.fillRect(fx - 8, h * 0.655, 16, 3); }
    c.fillStyle = 'rgba(40,28,18,0.22)'; c.fillRect(0, h * 0.62, w, h * 0.14); // stubble shadow band
    c.fillStyle = '#2b2018'; c.fillRect(0, 0, w, h * 0.3); // hair line
    c.fillRect(fx + w * 0.18, 0, w * 0.4, h * 0.45); // back of head hair
  });
}
const SKIN = ['#c99a73', '#a8754f', '#e0b48f', '#7d5236'];
const faceMats = SKIN.map((s, i) => [std({ map: faceTex(s, false), roughness: 0.7 }), std({ map: faceTex(s, i % 2 === 0), roughness: 0.7 })]);
const skinMats = SKIN.map((s) => std({ color: s, roughness: 0.7 }));
const TEAM = {
  T: {
    shirt: std({ map: fabricTex, color: '#7a5a3c', roughness: 0.9 }), pants: std({ map: camoTex, color: '#e2d4b8', roughness: 0.95 }),
    vest: std({ map: molleTex, color: '#7a6646', roughness: 0.9 }), pouch: std({ map: fabricTex, color: '#6b5a3d', roughness: 0.9 }),
    head: std({ map: fabricTex, color: '#3b3a33', roughness: 0.95 }), wrap: std({ map: fabricTex, color: '#b9a98a', roughness: 0.95 }),
    band: std({ color: '#d4692a', roughness: 0.6, emissive: '#3a1500' }), glove: std({ color: '#3a3128', roughness: 0.85 }), boot: std({ color: '#5a4630', roughness: 0.8 }),
  },
  D: {
    shirt: std({ map: fabricTex, color: '#3a5a78', roughness: 0.9 }), pants: std({ map: fabricTex, color: '#565c63', roughness: 0.95 }),
    vest: std({ map: molleTex, color: '#2c3236', roughness: 0.9 }), pouch: std({ map: fabricTex, color: '#262b2f', roughness: 0.9 }),
    head: std({ color: '#3c4a52', roughness: 0.55, metalness: 0.15 }), wrap: std({ color: '#1a1c1e', roughness: 0.4, metalness: 0.4 }),
    band: std({ color: '#3fa3d0', roughness: 0.6, emissive: '#05202c' }), glove: std({ color: '#1f2124', roughness: 0.85 }), boot: std({ color: '#222326', roughness: 0.8 }),
  },
};
// ------------------------------------------------------------------ texture atlas + baking
// Every 3rd-person character (body, arms, gun) is baked into a few meshes that share ONE material:
// the part textures are packed into an atlas and each part's colour goes into vertex colours.
const ATLAS_W = 1024, ATLAS_H = 512;
const atlasCanvas = document.createElement('canvas'); atlasCanvas.width = ATLAS_W; atlasCanvas.height = ATLAS_H;
const actx = atlasCanvas.getContext('2d'); actx.fillStyle = '#ffffff'; actx.fillRect(0, 0, ATLAS_W, ATLAS_H);
const atlasRect = new Map(); let ax = 0, ay = 0;
const WHITE_RECT = [ATLAS_W - 64, ATLAS_H - 64, 64, 64];
function atlasAdd(tex, w, h) { if (atlasRect.has(tex)) return; if (ax + w > ATLAS_W) { ax = 0; ay += 128; } actx.drawImage(tex.image, ax, ay, w, h); atlasRect.set(tex, [ax, ay, w, h]); ax += w; }
for (const t of [fabricTex, camoTex, molleTex, metalTex, woodTex]) atlasAdd(t, 128, 128);
for (const pair of faceMats) for (const m of pair) atlasAdd(m.map, 256, 128);
const atlasTex = new THREE.CanvasTexture(atlasCanvas); atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.anisotropy = 4;
export const personMat = new THREE.MeshStandardMaterial({ map: atlasTex, vertexColors: true, roughness: 0.82, metalness: 0 });
export const gunBakeMat = new THREE.MeshStandardMaterial({ map: atlasTex, vertexColors: true, roughness: 0.5, metalness: 0.3 });
const _v3 = new THREE.Vector3(), _n3 = new THREE.Matrix3(), _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4(), _col = new THREE.Color();
// Collect meshes under `anc` (skipping `skip` subtrees / named meshes) and bake them into one geometry in anc space.
// boneOf(mesh) -> skin index (optional). The source meshes are removed.
function bake(anc, { skip = [], boneOf = null } = {}) {
  anc.updateMatrixWorld(true); _inv.copy(anc.matrixWorld).invert();
  const list = [];
  const walk = (o) => { for (const c of o.children) { if (skip.includes(c)) continue; if (c.isMesh && !c.name) list.push(c); walk(c); } };
  walk(anc);
  let nv = 0, ni = 0;
  for (const m of list) { const g = m.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const si = boneOf ? new Uint16Array(nv * 4) : null, sw = boneOf ? new Float32Array(nv * 4) : null;
  let ov = 0, oi = 0;
  for (const m of list) {
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, mt = m.material;
    _rel.multiplyMatrices(_inv, m.matrixWorld); _n3.getNormalMatrix(_rel);
    const [rx, ry, rw, rh] = atlasRect.get(mt.map) || WHITE_RECT;
    _col.copy(mt.color); if (mt.emissive) { _col.r += mt.emissive.r * 2; _col.g += mt.emissive.g * 2; _col.b += mt.emissive.b * 2; }
    const b = boneOf ? boneOf(m) : 0;
    for (let i = 0; i < P.count; i++) {
      const o = (ov + i) * 3;
      _v3.fromBufferAttribute(P, i).applyMatrix4(_rel); pos[o] = _v3.x; pos[o + 1] = _v3.y; pos[o + 2] = _v3.z;
      _v3.fromBufferAttribute(N, i).applyMatrix3(_n3).normalize(); nor[o] = _v3.x; nor[o + 1] = _v3.y; nor[o + 2] = _v3.z;
      const u = U ? Math.min(1, Math.max(0, U.getX(i))) : 0.5, v = U ? Math.min(1, Math.max(0, U.getY(i))) : 0.5;
      uv[(ov + i) * 2] = (rx + 2 + u * (rw - 4)) / ATLAS_W; uv[(ov + i) * 2 + 1] = 1 - (ry + 2 + (1 - v) * (rh - 4)) / ATLAS_H;
      col[o] = _col.r; col[o + 1] = _col.g; col[o + 2] = _col.b;
      if (si) { si[(ov + i) * 4] = b; sw[(ov + i) * 4] = 1; }
    }
    if (g.index) { const src = g.index.array; for (let i = 0; i < src.length; i++) idx[oi + i] = src[i] + ov; oi += src.length; }
    else { for (let i = 0; i < P.count; i++) idx[oi + i] = ov + i; oi += P.count; }
    ov += P.count; m.parent.remove(m);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (si) { out.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); out.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4)); }
  out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
  return out;
}
const lensMat = std({ color: '#0d0f12', roughness: 0.1, metalness: 0.9 });
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// 2-bone IK: returns elbow position given shoulder, hand target and a pole hint
function solveElbow(s, h, a, b, pole) {
  const d = new THREE.Vector3().subVectors(h, s); let len = d.length();
  len = Math.min(len, a + b - 0.002); d.normalize();
  const ca = (a * a + len * len - b * b) / (2 * a * len), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  const p = pole.clone().sub(d.clone().multiplyScalar(pole.dot(d))).normalize();
  return s.clone().addScaledVector(d, a * ca).addScaledVector(p, a * sa);
}
// gloved hand: palm block + wrapped finger row; dir = hand forward axis
function hand(g, at, mat, rotY = 0, rotX = 0, rotZ = 0, s = 1) {
  const h = new THREE.Group(); h.position.copy(at); h.rotation.set(rotX, rotY, rotZ, 'YXZ'); h.scale.setScalar(s);
  h.add(box(0.05, 0.085, 0.03, mat, 0, 0, 0));
  h.add(box(0.05, 0.075, 0.022, mat, 0.0, -0.002, -0.026));
  h.add(limb(V(-0.025, 0.03, -0.01), V(-0.03, -0.01, -0.04), 0.011, mat)); // thumb
  g.add(h); mergeGroup(h); return h;
}
// Build the arms for a weapon. Arms group origin = shoulder line centre (pivot for aim pitch).
// gunHolder sits inside arms; hands are placed on the grip and handguard with simple IK.
function buildArms(arms, key, team, gunHolder) {
  const M = TEAM[team];
  for (const c of [...arms.children]) if (c !== gunHolder) { arms.remove(c); c.geometry?.dispose(); }
  const pistol = PISTOL.has(key);
  const k = 1.1; // avatar gun scale
  // gun pose relative to shoulder centre (y=0 at shoulder height, +z forward)
  if (pistol) { gunHolder.position.set(0.03, 0.0, 0.5); }
  else { gunHolder.position.set(0.09, 0.04, 0.3); }
  const gp = gunHolder.position;
  // gun-local -> arms-local (gunHolder rotated PI about y: x->-x, z->-z)
  const toA = (x, y, z) => V(gp.x - x * k, gp.y + y * k, gp.z - z * k);
  const rH = toA(0, -0.055, 0.03);
  const lH = pistol ? toA(0.022, -0.065, 0.035) : toA(0, -0.035, LH_Z[key] ?? -0.35);
  const sR = V(0.2, 0, pistol ? 0.0 : -0.06), sL = V(-0.2, 0, pistol ? 0.0 : 0.07);
  const eR = solveElbow(sR, rH, 0.29, 0.27, V(0.6, -1, -0.2)), eL = solveElbow(sL, lH, 0.29, 0.27, V(-0.8, -1, 0));
  arms.add(limb(sR, eR, 0.052, M.shirt, 0.046), limb(eR, rH, 0.044, M.shirt, 0.036));
  arms.add(limb(sL, eL, 0.052, M.shirt, 0.046), limb(eL, lH, 0.044, M.shirt, 0.036));
  arms.add(sph(0.062, M.shirt, sR.x, sR.y, sR.z), sph(0.062, M.shirt, sL.x, sL.y, sL.z));          // deltoids
  const band = new THREE.Mesh(cached('band', () => new THREE.CylinderGeometry(0.054, 0.054, 0.05, 10)), M.band);
  band.position.copy(sL).lerp(eL, 0.45); band.quaternion.setFromUnitVectors(_up, eL.clone().sub(sL).normalize()); arms.add(band);
  const band2 = band.clone(); band2.position.copy(sR).lerp(eR, 0.45); band2.quaternion.setFromUnitVectors(_up, eR.clone().sub(sR).normalize()); arms.add(band2);
  hand(arms, rH, M.glove, 0, 0.3, 0);
  hand(arms, lH, M.glove, 0, pistol ? 0.3 : 1.3, pistol ? 0 : 0.2);
  const am = new THREE.Mesh(bake(arms, { skip: [gunHolder] }), personMat); am.receiveShadow = true; arms.add(am);
}
export function makeAvatar(team, variant = 0) {
  const M = TEAM[team];
  const skin = skinMats[variant % SKIN.length], face = faceMats[variant % SKIN.length][team === 'T' ? 1 : 0];
  const root = new THREE.Group();
  const body = new THREE.Bone(); root.add(body);
  // legs: hip group -> thigh + knee group -> shin + boot
  const mkLeg = (x) => {
    const hip = new THREE.Bone(); hip.position.set(x, 0.92, 0);
    hip.add(limb(V(0, 0, 0), V(0, -0.44, 0.01), 0.082, M.pants, 0.068));
    const knee = new THREE.Bone(); knee.position.set(0, -0.45, 0.01); hip.add(knee);
    knee.add(limb(V(0, 0, 0), V(0, -0.4, -0.01), 0.062, M.pants, 0.052));
    knee.add(box(0.11, 0.1, 0.05, M.pouch, 0, -0.02, 0.06));                 // knee pad
    knee.add(box(0.11, 0.08, 0.26, M.boot, 0, -0.43, 0.04));                 // boot
    knee.add(box(0.115, 0.025, 0.27, darkMat, 0, -0.465, 0.04));             // sole
    knee.add(limb(V(0, -0.3, -0.01), V(0, -0.38, 0.0), 0.058, M.boot));       // boot upper
    hip.userData.knee = knee; return hip;
  };
  const legL = mkLeg(-0.1), legR = mkLeg(0.1);
  body.add(legL, legR);
  // pelvis, belt, torso
  body.add(box(0.31, 0.16, 0.2, M.pants, 0, 0.95, 0));
  body.add(box(0.33, 0.045, 0.215, darkMat, 0, 1.03, 0));
  body.add(box(0.05, 0.035, 0.02, M.pouch, 0, 1.03, 0.11));
  body.add(box(0.07, 0.1, 0.05, M.pouch, 0.17, 0.98, 0.0));                  // dump pouch / holster
  const chest = new THREE.Mesh(cached('chest', () => new THREE.CylinderGeometry(0.2, 0.16, 0.42, 10).scale(1, 1, 0.62)), M.shirt);
  chest.position.set(0, 1.24, 0); chest.castShadow = true; body.add(chest);
  // plate carrier + pouches
  body.add(box(0.34, 0.32, 0.27, M.vest, 0, 1.27, 0));
  body.add(box(0.36, 0.06, 0.28, M.vest, 0, 1.13, 0));                      // cummerbund
  for (const x of [-0.1, 0, 0.1]) body.add(box(0.075, 0.1, 0.045, M.pouch, x, 1.2, 0.155));
  body.add(box(0.12, 0.06, 0.03, M.pouch, -0.08, 1.33, 0.15));               // admin pouch
  body.add(box(0.05, 0.12, 0.05, M.pouch, -0.19, 1.25, -0.04));              // radio
  body.add(box(0.012, 0.18, 0.012, darkMat, -0.2, 1.4, -0.06));              // antenna
  for (const s of [-1, 1]) body.add(box(0.07, 0.03, 0.2, M.vest, s * 0.12, 1.44, 0));   // shoulder straps
  // neck + head
  body.add(new THREE.Mesh(cached('neck', () => new THREE.CylinderGeometry(0.052, 0.058, 0.12, 10)), skin)).children.at(-1).position.set(0, 1.5, 0.0);
  const headG = new THREE.Bone(); headG.position.set(0, 1.56, 0);
  headG.add(sph(0.105, face, 0, 0.11, 0.0, 0.92, 1.12, 1.02, 14, 10));        // skull + painted face
  headG.add(box(0.022, 0.04, 0.03, skin, 0, 0.1, 0.105, -0.25));            // nose
  headG.add(sph(0.05, skin, 0, 0.035, 0.05, 1.3, 0.8, 1.0));                  // jaw
  for (const s of [-1, 1]) headG.add(sph(0.022, skin, s * 0.098, 0.11, -0.005, 0.5, 1, 0.8)); // ears
  if (team === 'T') {
    headG.add(sph(0.11, M.head, 0, 0.165, -0.005, 0.98, 0.75, 1.02));          // beanie
    headG.add(box(0.2, 0.03, 0.2, M.head, 0, 0.17, 0));
    // shemagh wrapped around neck/lower face
    headG.add(new THREE.Mesh(cached('wrap', () => new THREE.CylinderGeometry(0.1, 0.085, 0.09, 10)), M.wrap)).children.at(-1).position.set(0, 0.01, 0.005);
    headG.add(sph(0.08, M.wrap, 0, -0.035, -0.02, 1.4, 0.7, 1.3));
  } else {
    // ballistic helmet with NVG shroud, rails, headset and glasses
    const helm = new THREE.Mesh(cached('helm', () => new THREE.SphereGeometry(0.135, 12, 7, 0, Math.PI * 2, 0, Math.PI * 0.55)), M.head);
    helm.position.set(0, 0.135, -0.008); helm.scale.set(0.95, 0.95, 1.05); helm.castShadow = true; headG.add(helm);
    headG.add(box(0.05, 0.03, 0.025, M.wrap, 0, 0.215, 0.12, -0.5));         // NVG shroud
    for (const s of [-1, 1]) { headG.add(box(0.012, 0.03, 0.12, M.wrap, s * 0.122, 0.15, 0)); headG.add(cylX(0.035, 0.03, M.wrap, s * 0.105, 0.1, -0.005, 12)); } // rails + ear cups
    headG.add(box(0.19, 0.012, 0.02, M.wrap, 0, 0.21, -0.005, 0, 0, 0));     // headset band
    headG.add(box(0.16, 0.03, 0.02, lensMat, 0, 0.125, 0.1));                // glasses
  }
  body.add(headG);
  // arms + gun
  const arms = new THREE.Group(); arms.position.set(0, 1.4, 0);
  const gunHolder = new THREE.Group(); gunHolder.rotation.y = Math.PI; arms.add(gunHolder);
  body.add(arms);
  // one skinned mesh for the whole body (rigid skinning: every part follows its bone)
  const bones = [body, legL, legL.userData.knee, legR, legR.userData.knee, headG];
  const boneOf = (m) => { for (let o = m.parent; o; o = o.parent) { const i = bones.indexOf(o); if (i >= 0) return i; } return 0; };
  const geo = bake(root, { skip: [arms], boneOf });
  root.updateMatrixWorld(true);
  const sm = new THREE.SkinnedMesh(geo, personMat); sm.frustumCulled = false; sm.receiveShadow = true;
  root.add(sm); sm.bind(new THREE.Skeleton(bones));
  root.userData = { body, legL, legR, kneeL: legL.userData.knee, kneeR: legR.userData.knee, headG, arms, gunHolder, gunKey: null, phase: 0, team };
  return root;
}
// swap gun + re-pose arms for that weapon
export function setAvatarGun(u, key) {
  u.gunHolder.clear(); u.gunHolder.add(avatarGun(key)); u.gunKey = key;
  buildArms(u.arms, key, u.team, u.gunHolder);
}

// ------------------------------------------------------------------ first-person arms
// Built in gun space (before the 0.75 viewmodel scale) so they follow recoil/sway with the gun.
const vmMats = { T: { sleeve: TEAM.T.shirt, glove: TEAM.T.glove, band: TEAM.T.band }, D: { sleeve: TEAM.D.shirt, glove: TEAM.D.glove, band: TEAM.D.band } };
export function vmArms(key, team) {
  const g = new THREE.Group(), M = vmMats[team] || vmMats.T;
  const pistol = PISTOL.has(key);
  const gl = M.glove;
  // right hand wraps the pistol grip
  const rg = new THREE.Group(); rg.position.set(0, pistol ? -0.05 : -0.075, pistol ? 0.015 : 0.035); rg.rotation.x = pistol ? -0.28 : -0.32; g.add(rg);
  rg.add(box(0.022, 0.085, 0.06, gl, 0.028, 0, 0.004));                  // palm (right side of grip)
  rg.add(box(0.06, 0.02, 0.06, gl, 0.012, 0.042, 0.02));                 // web of the hand over the backstrap
  for (let i = 0; i < 3; i++) rg.add(limb(V(0.03, 0.012 - i * 0.024, -0.03), V(-0.022, 0.008 - i * 0.024, -0.03), 0.011, gl)); // fingers around the front strap
  rg.add(limb(V(0.03, 0.04, -0.02), V(0.015, 0.035, -0.075), 0.0095, gl));   // trigger finger along the frame
  rg.add(limb(V(-0.01, 0.04, 0.01), V(-0.024, 0.03, -0.035), 0.011, gl));    // thumb on the left side
  mergeGroup(rg);
  const wristR = V(0.04, pistol ? -0.1 : -0.13, pistol ? 0.07 : 0.1);
  const elbowR = V(0.2, -0.36, 0.42);
  g.add(limb(wristR, V(0.06, pistol ? -0.12 : -0.15, 0.13), 0.034, gl));
  g.add(limb(V(0.06, pistol ? -0.12 : -0.15, 0.13), elbowR, 0.042, M.sleeve, 0.055));
  g.add(limb(V(0.06, pistol ? -0.12 : -0.15, 0.14), V(0.07, pistol ? -0.13 : -0.16, 0.17), 0.045, darkMat)); // watch / cuff
  // left hand
  const lz = LH_Z[key] ?? -0.35;
  const lg = new THREE.Group(); g.add(lg);
  if (pistol) {
    // support hand cups the right hand
    lg.position.set(-0.03, -0.06, 0.02); lg.rotation.set(-0.3, 0.25, 0);
    lg.add(box(0.022, 0.08, 0.06, gl, -0.012, 0, 0));
    for (let i = 0; i < 4; i++) lg.add(limb(V(-0.02, 0.02 - i * 0.02, -0.03), V(0.035, 0.01 - i * 0.02, -0.03), 0.01, gl));
    lg.add(limb(V(-0.01, 0.04, -0.01), V(0.004, 0.035, -0.07), 0.01, gl));
    mergeGroup(lg);
    g.add(limb(V(-0.05, -0.08, 0.07), V(-0.2, -0.36, 0.42), 0.04, M.sleeve, 0.055));
  } else {
    const hy = key === 'hornet' ? -0.1 : key === 'breacher' ? -0.05 : -0.045;
    lg.position.set(0, hy, lz); g.add(lg);
    lg.add(box(0.07, 0.02, 0.07, gl, 0, -0.022, 0));                       // palm under the handguard
    for (let i = 0; i < 4; i++) lg.add(limb(V(-0.032, -0.02, 0.025 - i * 0.017), V(-0.04, 0.02, 0.022 - i * 0.017), 0.0095, gl)); // fingers up the left side
    lg.add(limb(V(0.03, -0.02, 0.02), V(0.036, 0.016, -0.02), 0.011, gl)); // thumb over the right side
    mergeGroup(lg);
    const wl = V(-0.03, hy - 0.06, lz + 0.05), el = V(-0.3, -0.4, lz + 0.36);
    g.add(limb(V(0, hy - 0.035, lz + 0.03), wl, 0.032, gl));
    g.add(limb(wl, el, 0.04, M.sleeve, 0.055));
    g.add(limb(wl.clone().lerp(el, 0.12), wl.clone().lerp(el, 0.2), 0.044, M.band));
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  mergeGroup(g);
  return g;
}
