import * as THREE from 'three';
import * as S from './shared.js';
import { buildWorld } from './world.js';
import { box, mergeGroup, gunModel, makeAvatar, setAvatarGun, vmArms, GUN_L, BARREL_X, SIGHT_Z, IRON_Y } from './models.js';

import { createLocalGame, DIFFICULTY } from './sim.js';

// ======================================================================= local match
let ws = null, myId = null, joined = false, paused = false;
const net = { snaps: [], last: null, you: null, ping: 0 };
function send(m) { if (ws && ws.readyState === 1) ws.send(m); }

// ======================================================================= DOM
const $ = (id) => document.getElementById(id);
const ui = {
  menu: $('menu'), hud: $('hud'), buy: $('buy'), sb: $('scoreboard'), touch: $('touch'),
  name: $('in-name'), join: $('btn-join'), status: $('menu-status'), pause: $('pause'),
};
const LOWFX = /lowfx/.test(location.search);
// graphics quality: low / medium / high (saved; changing it reloads the page)
const GFX_KEYS = ['low', 'medium', 'high'];
let GFX = new URLSearchParams(location.search).get('gfx') || (() => { try { return localStorage.getItem('dl_gfx'); } catch { return null; } })();
if (!GFX_KEYS.includes(GFX)) GFX = (() => {
  // first run: pick Low on phones / tablets and weak or software GPUs
  if (matchMedia('(pointer: coarse)').matches) return 'low';
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|software|mali|adreno|powervr|intel\(r\) (hd|uhd) graphics/i.test(r)) return 'low';
  } catch {}
  return 'medium';
})();
if (LOWFX) GFX = 'low';
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
let teamPref = 'auto';
document.querySelectorAll('#seg-team button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('#seg-team button').forEach((x) => x.classList.toggle('on', x === b));
  teamPref = b.dataset.v;
}));
document.querySelectorAll('#seg-gfx button').forEach((b) => {
  b.classList.toggle('on', b.dataset.v === GFX);
  b.addEventListener('click', () => {
    if (b.dataset.v === GFX) return;
    try { localStorage.setItem('dl_gfx', b.dataset.v); } catch {}
    const q = new URLSearchParams(location.search); q.delete('gfx'); q.set('d', difficulty); location.search = q.toString() || '?';
  });
});
ui.name.value = 'Player' + ((Math.random() * 900 + 100) | 0);

let difficulty = new URLSearchParams(location.search).get('d');
if (!DIFFICULTY[difficulty]) difficulty = 'normal';
function syncDiffButtons() {
  document.querySelectorAll('.seg-diff button').forEach((x) => x.classList.toggle('on', x.dataset.v === difficulty));
  document.querySelectorAll('.diff-label').forEach((x) => { x.textContent = DIFFICULTY[difficulty].label; });
}
function setDifficulty(v) {
  if (!DIFFICULTY[v]) return;
  difficulty = v;
  syncDiffButtons();
  if (joined) { send({ t: 'difficulty', v }); addFeedText(`Bot difficulty: ${DIFFICULTY[v].label}`); }
}
document.querySelectorAll('.seg-diff button').forEach((b) => b.addEventListener('click', () => setDifficulty(b.dataset.v)));
syncDiffButtons();

ui.join.onclick = () => {
  ui.join.disabled = true;
  initAudio();
  ws = createLocalGame();
  ws.onopen = () => send({ t: 'join', name: ui.name.value.trim() || 'Player', team: teamPref, difficulty });
  ws.onmessage = (ev) => onNet(typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data);
};

// pause menu
function setPaused(v) {
  if (!joined) return;
  paused = v;
  ws.setPaused(v);
  ui.pause.classList.toggle('hidden', !v);
  if (v) { keys.clear(); mouseDown = false; rightHeld = false; me.scoped = false; setUse(false); toggleBuy(false); releaseLock(); }
  updateLockHint();
}
$('btn-resume').onclick = () => { setPaused(false); requestLock(); };
$('btn-quit').onclick = () => { const q = new URLSearchParams(location.search); q.set('d', difficulty); location.search = q.toString(); };
$('btn-pause').onclick = () => setPaused(true);
ui.name.addEventListener('keydown', (e) => { if (e.key === 'Enter') ui.join.click(); });

// ======================================================================= renderer / scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: GFX !== 'low' && !isTouch, powerPreference: 'high-performance' });
// render resolution: the biggest cost on laptops with high-DPI screens
renderer.setPixelRatio(LOWFX ? 0.5 : GFX === 'high' ? Math.min(devicePixelRatio, 1.5) : GFX === 'medium' ? 1 : Math.min(devicePixelRatio, 1) * 0.75);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = GFX !== 'low';
renderer.shadowMap.type = GFX === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
// the sun and the map never move: the shadow map is drawn once (characters use cheap blob shadows)
renderer.shadowMap.autoUpdate = false;
let shadowFrames = 3;
const BASE_PR = renderer.getPixelRatio();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = vmCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); vmCam.updateProjectionMatrix(); });

scene.add(new THREE.HemisphereLight('#fff1d8', '#7a5a3a', 1.25));
const sun = new THREE.DirectionalLight('#ffe2b0', 2.4);
const MW = S.W * S.TILE, MH = S.H * S.TILE;
sun.position.set(MW / 2 + 30, 60, MH / 2 - 25);
sun.target.position.set(MW / 2, 0, MH / 2);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : GFX === 'high' ? 4096 : 2048, isTouch ? 1024 : GFX === 'high' ? 4096 : 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 160 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function noise(ctx, w, h, base, amt, n = 3000) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (Math.random() - 0.5) * amt;
    ctx.fillStyle = v > 0 ? `rgba(255,240,220,${v})` : `rgba(40,20,0,${-v})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
}
// world: streets, buildings, props, decor, sky (see world.js)
// Low quality: replace physically based materials with much cheaper Lambert ones
const lambertCache = new Map();
function toLambert(m) {
  if (!m || !m.isMeshStandardMaterial) return m;
  let l = lambertCache.get(m);
  if (!l) {
    l = new THREE.MeshLambertMaterial({ map: m.map, color: m.color, vertexColors: m.vertexColors, transparent: m.transparent, opacity: m.opacity, alphaTest: m.alphaTest, side: m.side, depthWrite: m.depthWrite, emissive: m.emissive, emissiveIntensity: m.emissiveIntensity, polygonOffset: m.polygonOffset, polygonOffsetFactor: m.polygonOffsetFactor, polygonOffsetUnits: m.polygonOffsetUnits });
    if (m.metalness > 0.3) l.color = m.color.clone().multiplyScalar(0.8);
    lambertCache.set(m, l);
  }
  return l;
}
function lowMats(root) { if (GFX !== 'low') return; root.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(toLambert) : toLambert(o.material); }); }
const { sortWalls } = buildWorld(scene, { hi: !isTouch && GFX !== 'low', bump: GFX === 'high' && !isTouch, sunDir: sun.position.clone().sub(sun.target.position).normalize() });
lowMats(scene);

// ======================================================================= character models
// character + weapon models live in models.js
function nameSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 48;
  const x = c.getContext('2d');
  x.font = '600 26px Barlow, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(0,0,0,0.5)'; const w = x.measureText(text).width + 20; x.fillRect(128 - w / 2, 6, w, 36);
  x.fillStyle = color; x.fillText(text, 128, 25);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.3, 1); s.position.y = 2.25; s.renderOrder = 5;
  return s;
}

const avatars = new Map(); // id -> {root, team, tag}
function ensureAvatar(p) {
  let a = avatars.get(p.id);
  if (a && a.team !== p.tm) { scene.remove(a.root); avatars.delete(p.id); a = null; }
  if (!a) {
    const root = makeAvatar(p.tm, [...String(p.id)].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) >>> 0); lowMats(root); scene.add(root);
    a = { root, team: p.tm, tag: null, name: p.n, deadT: 0 };
    avatars.set(p.id, a);
  }
  if (a.name !== p.n && a.tag) { a.root.remove(a.tag); a.tag = null; }
  a.name = p.n;
  return a;
}

// bomb model
const bombMesh = new THREE.Group();
{
  bombMesh.add(box(0.5, 0.22, 0.34, new THREE.MeshStandardMaterial({ color: '#3b3a2a', roughness: 0.7 }), 0, 0.11, 0));
  bombMesh.add(box(0.22, 0.06, 0.16, new THREE.MeshStandardMaterial({ color: '#111' }), 0.05, 0.25, 0));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.04), new THREE.MeshBasicMaterial({ color: '#ff2a1a' }));
  led.position.set(-0.17, 0.25, 0); bombMesh.add(led); bombMesh.userData.led = led;
  bombMesh.visible = false; scene.add(bombMesh);
}
const bombLight = new THREE.PointLight('#ff3a20', 0, 6); if (GFX === 'high') scene.add(bombLight);
bombMesh.traverse((o) => { o.castShadow = false; });

// ======================================================================= first-person viewmodel
// The first-person gun lives in its own little scene, drawn after the world with a cleared depth
// buffer: it never clips into walls (leaning against cover) and doesn't distort when zooming in.
const vmScene = new THREE.Scene();
const vmCam = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.01, 5);
vmScene.add(vmCam);
const vmHemi = new THREE.HemisphereLight('#fff1d8', '#7a5a3a', 1.25); vmScene.add(vmHemi);
const vmSun = new THREE.DirectionalLight('#ffe2b0', 2.4); vmScene.add(vmSun, vmSun.target);
const vmFlashLight = new THREE.PointLight('#ffc070', 0, 3); vmCam.add(vmFlashLight); vmFlashLight.position.set(0.2, -0.1, -0.7);
const vm = new THREE.Group(); vmCam.add(vm);
const vmGunHolder = new THREE.Group(); vm.add(vmGunHolder);
const vmArmMat = new THREE.MeshStandardMaterial({ color: '#a8592a', roughness: 0.85 });
vm.position.set(0.24, -0.24, -0.42);
let vmKey = null, vmLaserEmit = null;
// laser beam (viewmodel pass, emitter -> screen centre) and the dot it paints on the world
const laserBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 1, 5, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
  new THREE.MeshBasicMaterial({ color: '#ff3020', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
laserBeam.visible = false;
vmCam.add(laserBeam);
const laserDot = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,230,1)'); gr.addColorStop(0.18, 'rgba(255,60,40,1)'); gr.addColorStop(0.5, 'rgba(255,30,20,0.35)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.visible = false; sp.renderOrder = 5; scene.add(sp); return sp;
})();
const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
vm.add(flash);
const flashLight = new THREE.PointLight('#ffc070', 0, 8); if (GFX === 'high') camera.add(flashLight); flashLight.position.set(0.2, -0.1, -0.8);
// ---- first-person plant / defuse rig (hands + defuse kit + wire cutters, or the bomb's keypad) ----
const useRig = new THREE.Group(); vmCam.add(useRig); useRig.visible = false;
const rig = {};
{
  const gloveMat = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 });
  const kitMat = new THREE.MeshStandardMaterial({ color: '#34383a', roughness: 0.5, metalness: 0.4 });
  const screenMat = new THREE.MeshBasicMaterial({ color: '#0d2a14' });
  const barMat = new THREE.MeshBasicMaterial({ color: '#43ff74' });
  const cutterMat = new THREE.MeshStandardMaterial({ color: '#8a8f94', roughness: 0.3, metalness: 0.8 });
  const gripMat = new THREE.MeshStandardMaterial({ color: '#c0281c', roughness: 0.6 });
  const wireCols = ['#d4352a', '#2a6fd4', '#e8c43a', '#36b04a'];
  rig.ledMat = new THREE.MeshBasicMaterial({ color: '#ff3020' });
  // left arm + defuse kit (tablet) — defuse only
  const L = new THREE.Group(); L.position.set(-0.15, -0.02, 0); useRig.add(L);
  L.add(box(0.075, 0.075, 0.3, vmArmMat, 0, -0.02, 0.16)); L.add(box(0.09, 0.08, 0.1, gloveMat, 0, 0, 0));
  const kit = new THREE.Group(); kit.position.set(0.05, 0.035, -0.04); kit.rotation.set(-0.9, 0.25, 0); L.add(kit);
  kit.add(box(0.17, 0.11, 0.03, kitMat, 0, 0, 0));
  const scr = box(0.13, 0.065, 0.004, screenMat, 0, 0.01, 0.017); kit.add(scr);
  rig.bar = box(0.12, 0.012, 0.005, barMat, 0, -0.008, 0.019); rig.bar.geometry = rig.bar.geometry.clone(); rig.bar.geometry.translate(0.06, 0, 0); rig.bar.position.x = -0.06; kit.add(rig.bar);
  const led = box(0.012, 0.012, 0.006, rig.ledMat, 0.065, 0.04, 0.017); kit.add(led);
  // wires running from the kit
  wireCols.forEach((c, i) => kit.add(box(0.006, 0.006, 0.12, new THREE.MeshBasicMaterial({ color: c }), -0.05 + i * 0.018, -0.06, 0.04)));
  rig.kit = kit; rig.left = L;
  // right arm + wire cutters (defuse) / pressing finger (plant)
  const Rr = new THREE.Group(); Rr.position.set(0.14, -0.03, 0); useRig.add(Rr);
  Rr.add(box(0.075, 0.075, 0.3, vmArmMat, 0, -0.02, 0.16)); Rr.add(box(0.09, 0.08, 0.1, gloveMat, 0, 0, 0));
  const cut = new THREE.Group(); cut.position.set(-0.03, 0.02, -0.07); cut.rotation.set(-0.5, 0.5, 0); Rr.add(cut);
  rig.jawA = new THREE.Group(); rig.jawB = new THREE.Group(); cut.add(rig.jawA, rig.jawB);
  rig.jawA.add(box(0.012, 0.01, 0.07, cutterMat, 0, 0, -0.035)); rig.jawB.add(box(0.012, 0.01, 0.07, cutterMat, 0, 0, -0.035));
  cut.add(box(0.016, 0.018, 0.09, gripMat, -0.012, 0, 0.04)); cut.add(box(0.016, 0.018, 0.09, gripMat, 0.012, 0, 0.04));
  rig.cutters = cut;
  const finger = box(0.022, 0.022, 0.07, gloveMat, -0.03, 0.01, -0.07); Rr.add(finger); rig.finger = finger; rig.right = Rr;
  // ---- plant rig: C4 set on the ground, code typed on the keypad, arming switch flipped ----
  const P = new THREE.Group(); useRig.add(P); rig.plant = P;
  const olive = new THREE.MeshStandardMaterial({ color: '#59563a', roughness: 0.85 });
  const tape = new THREE.MeshStandardMaterial({ color: '#2b2b26', roughness: 0.9 });
  const panel = new THREE.MeshStandardMaterial({ color: '#16181a', roughness: 0.6, metalness: 0.3 });
  const keyMat = new THREE.MeshStandardMaterial({ color: '#9a9a8c', roughness: 0.7 });
  rig.lcdMat = new THREE.MeshBasicMaterial({ color: '#0b2410' });
  rig.digOn = new THREE.MeshBasicMaterial({ color: '#7dff8c' });
  rig.digOff = new THREE.MeshBasicMaterial({ color: '#123a18' });
  const bomb = new THREE.Group(); P.add(bomb); rig.bomb = bomb;
  for (const bx2 of [-0.075, 0, 0.075]) bomb.add(box(0.07, 0.06, 0.15, olive, bx2, 0, 0));             // three charge blocks
  for (const bx2 of [-0.0375, 0.0375]) bomb.add(box(0.012, 0.064, 0.154, tape, bx2, 0, 0));  // tape bands
  bomb.add(box(0.15, 0.012, 0.13, panel, 0.035, 0.036, 0));                                              // control panel
  bomb.add(box(0.11, 0.004, 0.028, rig.lcdMat, 0.035, 0.044, -0.042));                                   // LCD
  rig.digits = [];
  for (let i = 0; i < 7; i++) { const d = box(0.01, 0.003, 0.014, rig.digOff, -0.01 + i * 0.015, 0.047, -0.042); bomb.add(d); rig.digits.push(d); }
  rig.keys = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const k = box(0.026, 0.008, 0.017, keyMat, 0.008 + c * 0.03, 0.045, -0.012 + r * 0.021); bomb.add(k); rig.keys.push(k);
  }
  // arming switch, LED, antenna, wires
  bomb.add(box(0.026, 0.01, 0.03, panel, 0.096, 0.044, -0.03));
  rig.lever = new THREE.Group(); rig.lever.position.set(0.096, 0.049, -0.03); bomb.add(rig.lever);
  rig.lever.add(box(0.008, 0.03, 0.008, new THREE.MeshStandardMaterial({ color: '#c8c8c0', metalness: 0.8, roughness: 0.3 }), 0, 0.015, 0));
  rig.c4led = box(0.014, 0.008, 0.014, rig.ledMat, 0.096, 0.045, 0.03); bomb.add(rig.c4led);
  rig.ant = new THREE.Group(); rig.ant.position.set(0.1, 0.04, -0.06); bomb.add(rig.ant);
  rig.ant.add(box(0.005, 0.12, 0.005, panel, 0, 0.06, 0));
  [['#d4352a', 0.03], ['#2a6fd4', 0.05], ['#e8c43a', 0.07]].forEach(([c, z]) => bomb.add(box(0.11, 0.006, 0.006, new THREE.MeshBasicMaterial({ color: c }), -0.04, 0.033, -0.07 + z)));
  // hands (origin at the fingertip so they can be aimed at a key)
  const mkHand = (point) => {
    const h = new THREE.Group();
    if (point) h.add(box(0.02, 0.02, 0.06, gloveMat, 0, 0, 0.03));
    h.add(box(0.085, 0.07, 0.1, gloveMat, point ? 0.01 : 0, 0.005, point ? 0.1 : 0.04));
    h.add(box(0.07, 0.07, 0.22, vmArmMat, point ? 0.012 : 0, 0.0, point ? 0.25 : 0.19));
    h.scale.setScalar(0.72); P.add(h); return h;
  };
  rig.pR = mkHand(true); rig.pL = mkHand(false);
  useRig.traverse((o) => { if (o.isMesh) o.castShadow = false; });
}
let useT = 0, useAnim = 0, snipT = 0, rigMode = '';
function setViewmodel(key) {
  const att = attFor(key), sig = key + JSON.stringify(att) + me.team;
  if (vmKey === sig) return;
  vmKey = sig;
  vmGunHolder.clear();
  const g = mergeGroup(gunModel(key, 0.75, att));
  g.add(vmArms(key, me.team));
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.material = o.material.clone(); o.material.depthTest = true; } });
  vmGunHolder.add(g);
  vmLaserEmit = g.getObjectByName('laserEmit') || null;
  vmGunHolder.position.z = key === 'breacher' || key === 'warden' ? 0.04 : 0;
  const L = GUN_L[key] || 0.3;
  const bx = BARREL_X[key] || 0;
  const ext = att.muzzle === 'supp' ? bx + 0.2 : att.muzzle === 'comp' ? bx + 0.06 : bx;
  flash.position.set(0, 0.0, -(L + ext) * 0.75 - 0.08);
  vmArmMat.color.set(me.team === 'D' ? '#2f6f8f' : '#a8592a');
}

// ======================================================================= effects
const fx = [];
// Tracers: one pre-allocated line-segment buffer (single draw call, no per-shot allocations).
const TR_N = 96;
const trPos = new Float32Array(TR_N * 6), trCol = new Float32Array(TR_N * 6), trLife = new Float32Array(TR_N);
const trGeo = new THREE.BufferGeometry();
trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3).setUsage(THREE.DynamicDrawUsage));
trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3).setUsage(THREE.DynamicDrawUsage));
const tracerLines = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
tracerLines.frustumCulled = false; scene.add(tracerLines);
let trIdx = 0;
function tracer(o, e) {
  const i = trIdx; trIdx = (trIdx + 1) % TR_N;
  const b = i * 6; trPos[b] = o[0]; trPos[b + 1] = o[1]; trPos[b + 2] = o[2]; trPos[b + 3] = e[0]; trPos[b + 4] = e[1]; trPos[b + 5] = e[2]; trLife[i] = 0.07;
  trGeo.attributes.position.needsUpdate = true;
}
// Impact puffs: one instanced mesh, scaled down to fade.
const PF_N = 160;
const puffMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }), PF_N);
puffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); puffMesh.frustumCulled = false; scene.add(puffMesh);
const puffs = Array.from({ length: PF_N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
const COL_BLOOD = new THREE.Color('#a3121a'), COL_DUST = new THREE.Color('#d9c3a0');
let pfIdx = 0;
const _m4 = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
for (let i = 0; i < PF_N; i++) { puffMesh.setMatrixAt(i, _zero); puffMesh.setColorAt(i, COL_DUST); }
function impact(p, blood) {
  for (let i = 0; i < (blood ? 6 : 4); i++) {
    const j = pfIdx; pfIdx = (pfIdx + 1) % PF_N; const f = puffs[j];
    f.life = 0.35; f.p.set(p[0], p[1], p[2]); f.v.set((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3);
    puffMesh.setColorAt(j, blood ? COL_BLOOD : COL_DUST); puffMesh.instanceColor.needsUpdate = true;
  }
}
// Point lights are pre-allocated so the shader set never changes mid-match (no hitching recompiles).
const lightPool = [0, 1, 2].map(() => { const l = new THREE.PointLight('#ffffff', 0, 30, 2); scene.add(l); return { l, until: 0, max: 0, peak: 0 }; });
function burstLight(x, y, z, color, peak, dist, dur) {
  const e = lightPool.reduce((a, b) => (a.until < b.until ? a : b));
  e.l.color.set(color); e.l.distance = dist; e.l.position.set(x, y, z); e.l.intensity = peak; e.peak = peak; e.max = dur; e.until = dur; e.fire = null;
  return e;
}
const boomMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0 })); boomMesh.visible = false; scene.add(boomMesh);
const popMesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 })); popMesh.visible = false; scene.add(popMesh);
function explosionFx(x, z) {
  boomMesh.position.set(x, 1, z); boomMesh.visible = true;
  fx.push({ obj: boomMesh, life: 1.4, max: 1.4, kind: 'boom' });
  burstLight(x, 4, z, '#ff8a30', 60, 60, 1.2);
}
function updateFx(dt) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt; const k = Math.max(0, f.life / f.max);
    if (f.kind === 'boom') { const s = 1 + (1 - k) * 18; f.obj.scale.setScalar(s); f.obj.material.opacity = k * 0.8; }
    if (f.kind === 'fball') { f.obj.scale.setScalar(0.6 + (1 - k) * 3.2); f.obj.material.opacity = k; }
    if (f.kind === 'fdust') { f.obj.scale.set(1.5 + (1 - k) * 4.5, 0.6 + (1 - k) * 1.8, 1.5 + (1 - k) * 4.5); f.obj.material.opacity = Math.min(1, k * 1.4) * 0.55; }
    if (f.kind === 'pop') { f.obj.scale.setScalar(1 + (1 - k) * 3); f.obj.material.opacity = k; }
    if (f.life <= 0) { f.obj.visible = false; fx.splice(i, 1); }
  }
  // tracers
  let trDirty = false;
  for (let i = 0; i < TR_N; i++) {
    if (trLife[i] <= 0) continue;
    trLife[i] -= dt; const k = Math.max(0, trLife[i] / 0.07);
    for (let v = 0; v < 2; v++) { trCol[i * 6 + v * 3] = 1 * k; trCol[i * 6 + v * 3 + 1] = 0.89 * k; trCol[i * 6 + v * 3 + 2] = 0.63 * k * (v ? 0.6 : 1); }
    trDirty = true;
  }
  if (trDirty) trGeo.attributes.color.needsUpdate = true;
  // puffs
  let pfDirty = false;
  for (let i = 0; i < PF_N; i++) {
    const f = puffs[i]; if (f.life <= 0) continue;
    f.life -= dt; pfDirty = true;
    if (f.life <= 0) { puffMesh.setMatrixAt(i, _zero); continue; }
    f.v.y -= 9 * dt; f.p.addScaledVector(f.v, dt);
    const sc = f.life / 0.35; _m4.makeScale(sc, sc, sc).setPosition(f.p); puffMesh.setMatrixAt(i, _m4);
  }
  if (pfDirty) puffMesh.instanceMatrix.needsUpdate = true;
  // lights
  for (const e of lightPool) {
    if (e.fire) continue;
    if (e.until > 0) { e.until -= dt; e.l.intensity = e.peak * Math.max(0, e.until / e.max); } else e.l.intensity = 0;
  }
}

// ======================================================================= audio (procedural)
let actx = null, master = null, noiseBuf = null;
function initAudio() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0.55; master.connect(actx.destination);
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 1.5, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // ambient desert wind
    const src = actx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.6;
    const g = actx.createGain(); g.gain.value = 0.035;
    const lfo = actx.createOscillator(); lfo.frequency.value = 0.07; const lg = actx.createGain(); lg.gain.value = 250; lfo.connect(lg).connect(f.frequency); lfo.start();
    src.connect(f).connect(g).connect(master); src.start();
  } catch { actx = null; }
}
function sfxShot(key, vol = 1, pan = 0, quiet = false) {
  if (!actx) return;
  const t = actx.currentTime;
  const prof = ({ sidearm: [1800, 0.12, 0.5], cannon: [900, 0.22, 0.8], hornet: [2500, 0.07, 0.4], vector: [2200, 0.08, 0.45], breacher: [520, 0.34, 1.1], bulldog: [1500, 0.12, 0.65], raptor: [1300, 0.14, 0.7], sentinel: [800, 0.3, 0.9], warden: [1100, 0.16, 0.8], longbow: [600, 0.45, 1] }[key] || [1500, 0.1, 0.6]).slice();
  if (quiet) { prof[0] *= 0.35; prof[1] *= 0.6; }
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(prof[0] * 2.5, t); f.frequency.exponentialRampToValueAtTime(prof[0] * 0.3, t + prof[1]);
  const g = actx.createGain(); g.gain.setValueAtTime(prof[2] * vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + prof[1] * 1.6);
  const p = actx.createStereoPanner ? actx.createStereoPanner() : null;
  let node = src.connect(f).connect(g);
  if (p) { p.pan.value = pan; node = node.connect(p); }
  node.connect(master);
  src.start(t, Math.random() * 0.5, prof[1] * 2);
  // thump
  const o = actx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  const og = actx.createGain(); og.gain.setValueAtTime(0.5 * vol * prof[2], t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(og).connect(master); o.start(t); o.stop(t + 0.16);
}
function tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
  if (!actx) return;
  const t = actx.currentTime + when;
  const o = actx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function sfxFrag(v) {
  if (!actx) return;
  const t = actx.currentTime;
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.7);
  const g = actx.createGain(); g.gain.setValueAtTime(1.1 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
  src.connect(f).connect(g).connect(master); src.start(t);
  tone(55, 0.35, 'sine', 0.5 * v);
}
function sfxBoom() {
  if (!actx) return;
  const t = actx.currentTime;
  const src = actx.createBufferSource(); src.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(60, t + 1.4);
  const g = actx.createGain(); g.gain.setValueAtTime(1.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  src.connect(f).connect(g).connect(master); src.start(t);
}
const sfx = {
  hit: () => tone(1400, 0.05, 'square', 0.08),
  head: () => { tone(2200, 0.06, 'square', 0.1); tone(1600, 0.08, 'triangle', 0.1, 0.03); },
  hurt: () => tone(180, 0.12, 'sawtooth', 0.12),
  reload: () => { tone(500, 0.04, 'square', 0.06); tone(320, 0.05, 'square', 0.06, 0.35); tone(700, 0.04, 'square', 0.07, 0.7); },
  empty: () => tone(900, 0.03, 'square', 0.05),
  buy: () => { tone(880, 0.06, 'triangle', 0.12); tone(1320, 0.08, 'triangle', 0.1, 0.06); },
  beep: (hi) => tone(hi ? 1900 : 1500, 0.07, 'square', 0.09),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.15, i * 0.12)),
  lose: () => [440, 370, 311, 262].forEach((f, i) => tone(f, 0.35, 'triangle', 0.13, i * 0.14)),
  step: (v = 1) => { if (!actx) return; const t = actx.currentTime; const s = actx.createBufferSource(); s.buffer = noiseBuf; const f = actx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; const g = actx.createGain(); g.gain.setValueAtTime(0.09 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.08); s.connect(f).connect(g).connect(master); s.start(t, Math.random(), 0.1); },
  plant: () => tone(1000, 0.05, 'square', 0.06),
  key: () => tone(1250 + Math.random() * 500, 0.04, 'square', 0.05),
  snip: () => { noiseBurst(5200, 0.05, 0.22, 'highpass'); tone(2600, 0.03, 'square', 0.04); },
  kit: () => tone(1700, 0.05, 'triangle', 0.05),
  arm: () => { tone(650, 0.05, 'square', 0.07); setTimeout(() => tone(2100, 0.12, 'square', 0.06), 90); },
  throw: () => noiseBurst(900, 0.12, 0.12, 'bandpass'),
  bang: (v) => { noiseBurst(3000, 0.35, 1.1 * v, 'lowpass'); tone(90, 0.3, 'sine', 0.5 * v); },
  hiss: (v) => noiseBurst(2500, 1.6, 0.18 * v, 'highpass'),
  ring: (amt) => tone(3200, 0.6 + amt * 2.6, 'sine', 0.05 + amt * 0.08),
  ignite: (v) => { noiseBurst(700, 1.1, 0.5 * v, 'lowpass'); noiseBurst(2600, 0.5, 0.15 * v, 'bandpass'); },
  crackle: (v) => noiseBurst(1800 + Math.random() * 1500, 0.06, 0.12 * v, 'bandpass'),
  fizzle: (v) => noiseBurst(4000, 0.6, 0.2 * v, 'highpass'),
  adren: () => { tone(220, 0.25, 'sawtooth', 0.08); tone(440, 0.35, 'triangle', 0.1, 0.08); noiseBurst(1200, 0.3, 0.12, 'bandpass'); },
  heart: () => { tone(58, 0.11, 'sine', 0.35); tone(52, 0.13, 'sine', 0.28, 0.16); },
  land: (v) => { if (!actx) return; noiseBurst(220, 0.12, 0.18 * v, 'lowpass'); },
};
function noiseBurst(freq, dur, vol, type) {
  if (!actx) return;
  const t = actx.currentTime;
  const s = actx.createBufferSource(); s.buffer = noiseBuf;
  const f = actx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 0.3, dur + 0.05);
}

// ======================================================================= local player state
const me = {
  team: 'T', x: 0, y: 0, z: 0, vy: 0, yaw: 0, pitch: 0, vx: 0, vz: 0, alive: false, onGround: true,
  primary: null, secondary: 'sidearm', cur: 'secondary', ammo: {}, reloadT: 0, fireT: 0, bloom: 0, recoilP: 0, recoilY: 0,
  scoped: false, using: false, lean: 0, leanS: 0, stepT: 0, lastWeaponKey: null, money: 800, hp: 100, armor: 0, kit: false,
  att: { primary: {}, secondary: {} }, flash: 0, smoke: 0, frag: 0, throwT: 0, blind: 0, blindMax: 1,
  molly: 0, adren: 0, adrT: 0, crouch: false, sprint: false, stamina: 1, staminaDelay: 0, exhausted: false, sprintOut: 0,
  eye: S.EYE, yS: 0, adsLatch: false,
};
function curWeaponKey() { return me.cur === 'primary' && me.primary ? me.primary : me.secondary; }
function attFor(k) { return (S.WEAPONS[k] && me.att[S.WEAPONS[k].slot]) || {}; }
// weapon stats after attachments
const effCache = new Map();
function eff(k) {
  const sig = k + '|' + JSON.stringify(attFor(k)) + (me.adrT > 0 ? 'A' : '');
  let c = effCache.get(sig); if (c) return c;
  c = effRaw(k); if (effCache.size > 200) effCache.clear(); effCache.set(sig, c); return c;
}
function effRaw(k) {
  const w = S.WEAPONS[k], a = attFor(k);
  let recoil = w.recoil, moveSpread = w.moveSpread, mag = w.mag, hipMul = 1;
  for (const id of Object.values(a)) {
    const t = S.ATTACH[id]; if (!t) continue;
    if (t.recoil) recoil *= t.recoil;
    if (t.moveSpread) moveSpread *= t.moveSpread;
    if (t.magMul) mag = Math.round(mag * t.magMul);
    if (t.hip) hipMul *= t.hip;
  }
  const optic = w.scope ? 'sniper' : a.optic || 'iron';
  const fov = w.scope ? 20 : S.ATTACH[a.optic]?.fov ?? (w.slot === 'secondary' ? 68 : 64);
  const adsMul = w.scope ? 0.15 : S.ATTACH[a.optic]?.ads ?? 0.55;
  const adsSpd = w.scope ? 13 : S.ATTACH[a.optic]?.spd ?? 25, lens = optic === 'sniper' || !!S.ATTACH[a.optic]?.lens;
  const reload = w.reload * (me.adrT > 0 ? S.ADREN.reloadMul : 1);
  return { ...w, recoil, moveSpread, mag, hipMul, laser: a.rail === 'laser', optic, fov, adsMul, adsSpd, lens, reload, quiet: !!S.ATTACH[a.muzzle]?.quiet };
}
function ammoFor(k) { if (!me.ammo[k]) { const e = eff(k); me.ammo[k] = { mag: e.mag, res: e.reserve }; } return me.ammo[k]; }
function refillAll() { me.ammo = {}; }

// ======================================================================= input
const keys = new Set();
let mouseDown = false, lookMode = 'free';
const cursor = { x: 0.5, y: 0.5, inside: false };
const touchState = { move: [0, 0], fire: false, crouch: false, leanL: false, leanR: false };
addEventListener('keydown', (e) => {
  if (!joined) return;
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'escape' || k === 'p') {
    if (k === 'escape' && !ui.buy.classList.contains('hidden')) { toggleBuy(false); return; }
    setPaused(!paused); return;
  }
  if (paused) return;
  if (k === 'tab') { e.preventDefault(); ui.sb.classList.remove('hidden'); renderScoreboard(); return; }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) me.jumpQ = performance.now(); }
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);
  if (k === 'b') toggleBuy();
  if (k === 'z' || k === '6') throwNade('molly');
  if (k === 'x' || k === '7') useAdrenaline();
  if (e.code === 'KeyV') aimKeyDown();
  if (k === 'g' || k === '4') throwNade('flash');
  if (k === 't' || k === '5') throwNade('smoke');
  if (k === 'h' || k === '3') throwNade('frag');
  if (k === 'r') startReload();
  if (k === '1') switchWeapon('primary');
  if (k === '2') switchWeapon('secondary');
  if (k === 'f') setUse(true);
  if (e.code === 'KeyC') toggleCrouch();
  if (e.code === 'KeyQ') toggleLean(-1);
  if (e.code === 'KeyE') toggleLean(1);
  if (k === ' ' && !me.alive) cycleSpectate();
});
addEventListener('keyup', (e) => {
  keys.delete(e.code);
  const k = e.key.toLowerCase();
  if (k === 'tab') ui.sb.classList.add('hidden');
  if (k === 'f') setUse(false);
  if (e.code === 'KeyV') aimKeyUp();
});
// Secondary aim key (V): tap = toggle aim, hold = aim while held.
let aimKeyHeld = false, aimKeyT = 0;
function aimKeyDown() {
  if (me.adsLatch) { me.adsLatch = false; setAds(false); return; }
  aimKeyHeld = true; aimKeyT = performance.now(); setAds(true);
}
function aimKeyUp() {
  if (!aimKeyHeld) return;
  aimKeyHeld = false;
  if (performance.now() - aimKeyT < 260 && me.alive) me.adsLatch = true;
  else if (!rightHeld) setAds(false);
}
addEventListener('blur', () => { keys.clear(); mouseDown = false; rightHeld = false; aimKeyHeld = false; me.adsLatch = false; me.scoped = false; setUse(false); });
// ---- mouse lock: keeps the cursor centred. Falls back to free-look + edge turning if the page blocks it.
let locked = false, lockFailed = false, expectUnlock = false, rightHeld = false;
const inFrame = (() => { try { return window.top !== window; } catch { return true; } })();
function requestLock() {
  if (isTouch || locked || !canvas.requestPointerLock) return;
  try {
    const r = canvas.requestPointerLock({ unadjustedMovement: true });
    if (r && r.catch) r.catch((e) => { if (isSandboxErr(e)) return onLockFail(true); try { const r2 = canvas.requestPointerLock(); r2?.catch?.((e2) => onLockFail(isSandboxErr(e2))); } catch (e3) { onLockFail(isSandboxErr(e3)); } });
  } catch (e) { onLockFail(isSandboxErr(e)); }
}
function releaseLock() { if (locked) { expectUnlock = true; document.exitPointerLock?.(); } }
let lockSandboxed = false;
function isSandboxErr(e) { return !!e && /sandbox/i.test(String(e.message || e)); }
function onLockFail(sb) { lockFailed = true; if (sb) lockSandboxed = true; updateLockHint(); }
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { lockFailed = false; cursor.inside = true; }
  if (!locked && joined && !paused && !expectUnlock && ui.buy.classList.contains('hidden')) setPaused(true);
  expectUnlock = false;
  updateLockHint();
});
document.addEventListener('pointerlockerror', onLockFail);
function updateLockHint() {
  const lh = $('lock-hint');
  if (!lh) return;
  const show = joined && !isTouch && !locked && !paused && me.alive && ui.buy.classList.contains('hidden');
  lh.classList.toggle('hidden', !show);
  $('lock-text').textContent = lockFailed
    ? lockSandboxed ? 'Mouse lock is disabled on this preview link (works once published) — aim with the mouse + screen edges'
    : (inFrame ? 'Mouse lock is blocked in this embedded preview — aim with free mouse + screen edges, or open the game in its own tab' : 'Mouse lock was blocked — click the game to try again')
    : 'Click to lock the mouse';
  $('btn-newtab').classList.toggle('hidden', !(lockFailed && inFrame && !lockSandboxed));
}
$('btn-newtab').onclick = (e) => { e.stopPropagation(); window.open(location.href, '_blank', 'noopener'); };
canvas.addEventListener('mousedown', (e) => {
  if (!joined || paused) return;
  if (!locked && !lockSandboxed && (!lockFailed || !inFrame) && !isTouch && ui.buy.classList.contains('hidden')) { requestLock(); if (e.button === 0) return; }
  if (e.button === 0) { mouseDown = true; me.clickQ = true; if (!me.alive) cycleSpectate(); }
  if (e.button === 2) { rightHeld = true; me.adsLatch = false; setAds(true); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; if (e.button === 2) { rightHeld = false; if (!aimKeyHeld) setAds(false); } });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// mouse wheel: quick-swap primary <-> sidearm
let wheelT = 0;
addEventListener('wheel', (e) => { if (!joined || paused || !ui.buy.classList.contains('hidden') || performance.now() - wheelT < 180 || Math.abs(e.deltaY) < 4) return; wheelT = performance.now(); switchWeapon(me.cur === 'primary' ? 'secondary' : 'primary'); }, { passive: true });
const SENS = 0.0022;
addEventListener('mousemove', (e) => {
  if (!joined || isTouch || paused) return;
  if (!locked) { cursor.x = e.clientX / innerWidth; cursor.y = e.clientY / innerHeight; cursor.inside = true; }
  if (!ui.buy.classList.contains('hidden')) return;
  const s = SENS * adsSens();
  me.yaw -= e.movementX * s; me.pitch -= e.movementY * s;
  me.pitch = Math.max(-1.45, Math.min(1.45, me.pitch));
});

// touch controls
function setupTouch() {
  ui.touch.classList.remove('hidden');
  const stick = $('stick'), knob = $('stick-knob');
  let stickId = null, lookId = null, lx = 0, ly = 0;
  stick.addEventListener('touchstart', (e) => { e.preventDefault(); stickId = e.changedTouches[0].identifier; }, { passive: false });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        const r = stick.getBoundingClientRect();
        let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
        touchState.move = [dx, dy];
        knob.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
      } else if (t.identifier === lookId) {
        const s = 0.006 * adsSens();
        me.yaw -= (t.clientX - lx) * s; me.pitch -= (t.clientY - ly) * s;
        me.pitch = Math.max(-1.45, Math.min(1.45, me.pitch));
        lx = t.clientX; ly = t.clientY;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) if (lookId === null && t.clientX > innerWidth * 0.35) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
    if (!me.alive) cycleSpectate();
  }, { passive: true });
  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) { stickId = null; touchState.move = [0, 0]; knob.style.transform = ''; }
      if (t.identifier === lookId) lookId = null;
    }
  };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  const hold = (id, on, off) => { const b = $(id); b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('on'); on(); const t = e.changedTouches[0]; if (lookId === null && id === 't-fire') { lookId = t.identifier; lx = t.clientX; ly = t.clientY; } }, { passive: false }); b.addEventListener('touchend', (e) => { e.preventDefault(); b.classList.remove('on'); off && off(); }); };
  hold('t-fire', () => { touchState.fire = true; }, () => { touchState.fire = false; });
  hold('t-jump', () => { me.jumpQ = performance.now(); });
  hold('t-reload', startReload);
  hold('t-use', () => setUse(true), () => setUse(false));
  hold('t-swap', () => switchWeapon(me.cur === 'primary' ? 'secondary' : 'primary'));
  hold('t-scope', toggleScope);
  hold('t-buy', () => toggleBuy());
  hold('t-flash', () => throwNade('flash'));
  hold('t-smoke', () => throwNade('smoke'));
  hold('t-frag', () => throwNade('frag'));
  hold('t-molly', () => throwNade('molly'));
  hold('t-adren', useAdrenaline);
  // lean buttons toggle (tap again to stand straight)
  hold('t-lean-l', () => toggleLean(-1)); hold('t-lean-r', () => toggleLean(1));
  hold('t-crouch', toggleCrouch);
  hold('t-score', () => { ui.sb.classList.toggle('hidden'); renderScoreboard(); });
}

// stance toggles (keyboard + touch share the same state)
function syncStanceBtns() { $('t-crouch')?.classList.toggle('latched', touchState.crouch); $('t-lean-l')?.classList.toggle('latched', touchState.leanL); $('t-lean-r')?.classList.toggle('latched', touchState.leanR); }
function toggleCrouch() { if (!me.alive) return; touchState.crouch = !touchState.crouch; syncStanceBtns(); }
function toggleLean(side) { if (!me.alive) return; const k = side < 0 ? 'leanL' : 'leanR', o = side < 0 ? 'leanR' : 'leanL'; touchState[k] = !touchState[k]; touchState[o] = false; syncStanceBtns(); }
function clearStance() { touchState.crouch = touchState.leanL = touchState.leanR = false; syncStanceBtns(); }
function setUse(on) { if (me.using === on) return; me.using = on; send({ t: 'use', on }); }
function switchWeapon(slot) {
  if (slot === 'primary' && !me.primary) return;
  if (me.cur === slot) return;
  me.cur = slot; me.reloadT = 0; me.scoped = false; me.adsLatch = false; me.fireT = Math.max(me.fireT, 0.35);
  me.drawT = 0.35;
}
// aim down sights (right mouse hold / SCOPE toggle on touch)
function setAds(on) { if (!me.alive && on) return; if (on && me.reloadT > 0) return; me.scoped = on; if (on) me.sprint = false; }
function toggleScope() { setAds(!me.scoped); }
const TAN_HIP = Math.tan((78 / 2) * Math.PI / 180);
function adsSens() { return me.scoped ? Math.tan((eff(curWeaponKey()).fov / 2) * Math.PI / 180) / TAN_HIP : 1; }
function throwNade(k) {
  if (!me.alive || paused || !(me[k] > 0) || me.throwT > 0) return;
  const ph = net.last?.ph; if (ph !== 'live' && ph !== 'end') { flashHint(k === 'molly' ? 'Abilities unlock once the round is live' : 'Grenades can be thrown once the round is live'); return; }
  me.throwT = 0.7; me[k]--; me.sprint = false;
  const yaw = me.yaw, pitch = me.pitch + 0.12;
  const d = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  send({ t: 'throw', k, o: [me.x + d[0] * 0.4, me.y + S.eyeH(me.crouch) - 0.1, me.z + d[2] * 0.4], d: d.map((v) => +v.toFixed(4)) });
  me.throwAnim = 0.45; sfx.throw();
}
function useAdrenaline() {
  if (!me.alive || paused || !(me.adren > 0) || me.adrT > 0) return;
  const ph = net.last?.ph; if (ph !== 'live' && ph !== 'end') { flashHint('Abilities unlock once the round is live'); return; }
  me.adren--; me.adrT = S.ADREN.time; me.stamina = 1; me.exhausted = false;
  send({ t: 'ability', k: 'adren' });
  sfx.adren(); flashHint('Adrenaline — faster movement, quicker reloads, healing');
}
function startReload() {
  const k = curWeaponKey(), w = eff(k), a = ammoFor(k);
  if (me.reloadT > 0 || a.mag >= w.mag || a.res <= 0 || !me.alive) return;
  me.reloadT = w.reload; me.reloadMax = w.reload; me.scoped = false; sfx.reload();
}

// ======================================================================= buy menu
const ITEM_STATS = {
  sidearm: 'Default · 12 rds', cannon: 'High damage · 7 rds', hornet: 'Machine pistol · full auto', vector: 'Fast fire · +$600 kills', breacher: '9 pellets · close range · +$900',
  bulldog: 'Budget rifle · 25 rds', raptor: 'All-rounder · 30 rds', sentinel: 'Semi-auto marksman · 10 rds', warden: 'LMG · 75 rds · slow', longbow: 'One-shot body · scoped',
  armor: '100 armor + helmet', kit: 'Defuse in 3.5s', flash: 'Blinds anyone facing it · G', smoke: 'Blocks vision 15s · T', frag: 'Explodes after 1.7s · H',
};
let modSlot = 'primary';
function buyBtn(k, name, price, stats, onclick) {
  const b = document.createElement('button');
  b.className = 'buy-item'; b.dataset.item = k;
  b.innerHTML = `<span class="bi-top"><span class="bi-name"></span><span class="bi-price">$${price}</span></span><span class="bi-stats"></span>`;
  b.querySelector('.bi-name').textContent = name; b.querySelector('.bi-stats').textContent = stats;
  b.onclick = () => { onclick(); sfx.buy(); };
  return b;
}
function buildBuy() {
  for (const list of document.querySelectorAll('.buy-list')) {
    const cat = list.dataset.cat;
    if (cat === 'mods') continue;
    list.innerHTML = '';
    const items = cat === 'gear' ? Object.keys(S.GEAR) : Object.keys(S.WEAPONS).filter((k) => S.WEAPONS[k].slot === cat);
    for (const k of items) {
      const it = S.WEAPONS[k] || S.GEAR[k];
      list.appendChild(buyBtn(k, it.name, it.price, ITEM_STATS[k], () => send({ t: 'buy', item: k })));
    }
  }
}
buildBuy();
document.querySelectorAll('#mod-seg button').forEach((b) => b.addEventListener('click', () => { modSlot = b.dataset.v; buildMods(); }));
function buildMods() {
  const list = document.querySelector('.buy-list[data-cat="mods"]');
  document.querySelectorAll('#mod-seg button').forEach((x) => x.classList.toggle('on', x.dataset.v === modSlot));
  const wk = me[modSlot];
  const sig = modSlot + wk + JSON.stringify(me.att[modSlot]) + me.money;
  if (list.dataset.sig === sig) return;
  list.dataset.sig = sig; list.innerHTML = '';
  if (!wk) { list.innerHTML = '<p class="muted small mods-empty">Buy a primary weapon to fit attachments.</p>'; return; }
  const head = document.createElement('p'); head.className = 'mods-for'; head.textContent = S.WEAPONS[wk].name; list.appendChild(head);
  const ids = Object.keys(S.ATTACH).filter((id) => S.ATTACH[id].for.includes(wk));
  if (!ids.length) { list.insertAdjacentHTML('beforeend', '<p class="muted small mods-empty">No attachments for this weapon.</p>'); return; }
  for (const slot of S.ATTACH_SLOTS) {
    for (const id of ids.filter((i) => S.ATTACH[i].slot === slot)) {
      const a = S.ATTACH[id], on = me.att[modSlot][slot] === id;
      const b = buyBtn('att:' + id, a.name, a.price, (on ? 'Equipped · ' : '') + a.desc, () => send({ t: 'buy', item: 'att:' + id, slot: modSlot }));
      b.dataset.slotName = slot;
      b.classList.toggle('owned', on);
      b.disabled = on || me.money < a.price;
      list.appendChild(b);
    }
  }
}
$('buy-close').onclick = () => toggleBuy(false);
function toggleBuy(force) {
  const open = force ?? ui.buy.classList.contains('hidden');
  if (open && (net.last?.ph !== 'buy' || !me.alive)) { flashHint('Buying is only allowed during the buy phase'); return; }
  const was = !ui.buy.classList.contains('hidden');
  ui.buy.classList.toggle('hidden', !open);
  if (open) { mouseDown = false; me.scoped = false; releaseLock(); if (!me.primary) modSlot = 'secondary'; else if (!was) modSlot = 'primary'; refreshBuy(); }
  else if (was && joined && !paused && navigator.userActivation?.isActive !== false) requestLock();
  updateLockHint();
}
function refreshBuy() {
  if (ui.buy.classList.contains('hidden')) return;
  $('buy-money').textContent = '$' + me.money;
  for (const b of ui.buy.querySelectorAll('.buy-item')) {
    const k = b.dataset.item, it = S.WEAPONS[k] || S.GEAR[k];
    if (!it) continue;
    const nade = k === 'flash' || k === 'smoke' || k === 'frag';
    const owned = k === me.primary || k === me.secondary || (k === 'armor' && me.armor >= 100) || (k === 'kit' && me.kit) || (nade && me[k] >= it.max);
    const blocked = (k === 'kit' && me.team !== 'D');
    b.classList.toggle('owned', owned);
    b.disabled = owned || blocked || me.money < it.price;
    if (nade) b.querySelector('.bi-stats').textContent = `${ITEM_STATS[k]} · ${me[k]}/${it.max}`;
    if (k === 'kit') b.classList.toggle('hidden', me.team !== 'D');
  }
  buildMods();
}

// ======================================================================= net handling
let lastPhase = null, spectateIdx = 0, spectateId = null;
function onNet(m) {
  if (m.t === 'welcome') {
    myId = m.id; joined = true;
    ui.menu.classList.add('hidden'); ui.hud.classList.remove('hidden'); document.body.classList.add('ingame');
    if (isTouch) setupTouch();
    return;
  }
  if (m.t === 'error') { ui.status.textContent = m.msg; ui.join.disabled = false; return; }
  if (m.t === 'snap') {
    m.recv = performance.now() / 1000;
    net.snaps.push(m); if (net.snaps.length > 30) net.snaps.shift();
    net.last = m;
    applyYou(m);
    if (!net.gotFirst) { net.gotFirst = true; if (m.ph === 'buy' && me.alive) toggleBuy(true); }
    return;
  }
  if (m.t === 'shot') {
    if (m.id === myId) { if (m.hitP) impact(m.e, true); if (m.ex) for (const e of m.ex) if (e[3]) impact(e, true); return; }
    tracer(m.o, m.e); impact(m.e, m.hitP);
    if (m.ex) for (const e of m.ex) { tracer(m.o, e); if (Math.random() < 0.5 || e[3]) impact(e, !!e[3]); }
    const d = Math.hypot(m.o[0] - me.x, m.o[2] - me.z);
    const ang = Math.atan2(m.o[0] - me.x, m.o[2] - me.z) - me.yaw;
    sfxShot(m.w, Math.max(0.05, 1 - d / 70) * 0.8 * (m.q ? 0.3 : 1), Math.max(-1, Math.min(1, -Math.sin(ang))), m.q);
    const a = avatars.get(m.id); if (a) a.flashT = 0.05;
    return;
  }
  if (m.t === 'hitConfirm') {
    const hm = $('hitmarker'); hm.classList.toggle('head', !!m.head); hm.classList.add('show');
    setTimeout(() => hm.classList.remove('show'), 90);
    m.head ? sfx.head() : sfx.hit();
    return;
  }
  if (m.t === 'hurt') {
    const d = $('damage'); d.classList.toggle('burn', !!m.burn); d.style.transition = 'none'; d.style.opacity = m.burn ? 0.55 : Math.min(1, 0.3 + m.dmg / 60);
    requestAnimationFrame(() => { d.style.transition = 'opacity 600ms'; d.style.opacity = 0; });
    if (m.burn) { if (Math.random() < 0.35) sfx.hurt(); } else { sfx.hurt(); me.recoilP += 0.03; }
    return;
  }
  if (m.t === 'kill') { addKill(m); return; }
  if (m.t === 'flashed') { me.blind = Math.max(me.blind, m.dur); me.blindMax = Math.max(me.blind, 0.01); me.blindAmt = m.amt; sfx.ring(m.amt); return; }
  if (m.t === 'event') onEvent(m);
}
function applyYou(m) {
  const y = m.you; if (!y) return;
  const wasAlive = me.alive;
  me.team = y.team; me.money = y.money; me.armor = y.armor; me.hp = y.hp; me.kit = y.kit;
  if (y.att) {
    for (const sl of ['primary', 'secondary']) {
      const before = me.att[sl]?.mag, after = y.att[sl]?.mag;
      const wk = sl === 'primary' ? y.primary : y.secondary;
      if (before !== after && wk && me.ammo[wk]) me.ammo[wk] = null; // magazine size changed
    }
    me.att = JSON.parse(JSON.stringify(y.att));
  }
  if (me.throwT <= 0) { me.flash = y.flash ?? 0; me.smoke = y.smoke ?? 0; me.frag = y.frag ?? 0; me.molly = y.molly ?? 0; }
  if (!(me.adrT > 0 && y.adrT <= 0 && me.adren === y.adren)) me.adren = y.adren ?? 0;
  if (Math.abs((y.adrT || 0) - me.adrT) > 0.4 && !(me.adrT > 5.5)) me.adrT = y.adrT || 0;
  if (me.primary !== y.primary && y.primary) { me.cur = 'primary'; me.ammo[y.primary] = null; modSlot = 'primary'; }
  if (me.secondary !== y.secondary) { me.ammo[y.secondary] = null; if (!y.primary) me.cur = 'secondary'; }
  me.primary = y.primary; me.secondary = y.secondary;
  if (!me.primary && me.cur === 'primary') me.cur = 'secondary';
  me.alive = y.alive; me.useProg = y.useProg;
  if (y.force || (!wasAlive && y.alive)) {
    me.x = y.x; me.z = y.z; me.y = 0; me.yS = 0; me.vy = 0; me.yaw = y.yaw; me.pitch = 0; me.vx = me.vz = 0;
    me.crouch = false; me.sprint = false; me.stamina = 1; me.exhausted = false; me.adrT = 0; me.lean = 0; me.leanS = 0; clearStance();
  }
  if (wasAlive && !y.alive) { me.scoped = false; me.adsLatch = false; me.adrT = 0; setUse(false); spectateId = null; }
  refreshBuy();
}
function onEvent(m) {
  const mine = me.team;
  switch (m.kind) {
    case 'roundStart':
      refillAll(); me.reloadT = 0; me.bloom = 0; me.scoped = false;
      showBanner(`Round ${m.round}`, 'Buy phase — gear up', null, 2200);
      if (me.alive) toggleBuy(true);
      break;
    case 'live': toggleBuy(false); showBanner('Go go go', me.team === 'T' ? 'Plant the bomb at A or B' : 'Defend both sites', me.team, 1600); break;
    case 'planted': showBanner('Bomb planted', `Site ${m.site} · ${S.ROUND.bombTime}s to detonation`, 'warn', 2500); break;
    case 'defused': showBanner('Bomb defused', m.by, 'D', 2500); break;
    case 'exploded': explosionFx(net.last?.bomb.x ?? 0, net.last?.bomb.z ?? 0); sfxBoom(); break;
    case 'roundEnd': {
      const won = m.winner === mine;
      showBanner(won ? 'Round won' : 'Round lost', m.reason, m.winner, 4000);
      won ? sfx.win() : sfx.lose();
      break;
    }
    case 'halftime': showBanner('Halftime', 'Switching sides', null, 3500); break;
    case 'matchEnd': {
      const won = m.winner === mine;
      showBanner(m.winner === 'draw' ? 'Draw' : won ? 'Victory' : 'Defeat', `Final ${m.score.T} – ${m.score.D} · new match soon`, m.winner === 'draw' ? null : m.winner, 11000);
      ui.sb.classList.remove('hidden'); renderScoreboard(); setTimeout(() => ui.sb.classList.add('hidden'), 10000);
      break;
    }
    case 'joined': addFeedText(`${m.name} joined ${m.team === 'T' ? 'Attackers' : 'Defenders'}`); break;
    case 'left': addFeedText(`Player left — ${m.name} took over`); break;
    case 'bombPickup': flashHint('You picked up the bomb'); break;
    case 'flash': flashFx(m.x, m.y, m.z); sfx.bang(Math.max(0.1, 1 - Math.hypot(m.x - me.x, m.z - me.z) / 50)); break;
    case 'smoke': sfx.hiss(Math.max(0.1, 1 - Math.hypot(m.x - me.x, m.z - me.z) / 40)); break;
    case 'throw': if (m.id !== myId) { const a = avatars.get(m.id); if (a) a.throwT = 0.4; } break;
    case 'frag': fragFx(m.x, m.y, m.z); sfxFrag(Math.max(0.12, 1 - Math.hypot(m.x - me.x, m.z - me.z) / 60)); break;
    case 'ignite': sfx.ignite(Math.max(0.1, 1 - Math.hypot(m.x - me.x, m.z - me.z) / 45)); break;
    case 'fizzle': sfx.fizzle(Math.max(0.1, 1 - Math.hypot(m.x - me.x, m.z - me.z) / 40)); break;
    case 'adren': if (m.id !== myId) { const a = avatars.get(m.id); if (a) a.adrFx = 1; } break;
  }
}
let bannerTimer = null;
function showBanner(title, sub, cls, ms = 2500) {
  const b = $('banner'); b.className = cls || ''; $('banner-title').textContent = title; $('banner-sub').textContent = sub || '';
  b.classList.remove('hidden'); void b.offsetWidth;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
}
let hintTimer = null;
function flashHint(t) { const h = $('hint'); h.textContent = t; h.classList.remove('hidden'); clearTimeout(hintTimer); hintTimer = setTimeout(() => h.classList.add('hidden'), 1800); }
const WNAME = { sidearm: 'P-9', cannon: 'Cannon', hornet: 'Hornet', vector: 'Vector', breacher: 'Breacher', bulldog: 'Bulldog', raptor: 'Raptor', sentinel: 'Sentinel', warden: 'Warden', longbow: 'Longbow', bomb: 'Bomb', fire: 'Incendiary', frag: 'Frag' };
function addKill(m) {
  const li = document.createElement('li');
  const mineK = m.killer === myName();
  if (mineK || m.vid === myId) li.className = 'mine';
  li.innerHTML = `<span class="${m.kt || ''}"></span><span class="w">${WNAME[m.w] || m.w}${m.head ? ' · HS' : ''}</span><span class="${m.vt}"></span>`;
  li.children[0].textContent = m.killer; li.children[2].textContent = m.victim;
  pushFeed(li);
}
function addFeedText(t) { const li = document.createElement('li'); li.textContent = t; li.style.color = 'var(--muted)'; pushFeed(li); }
function pushFeed(li) { const kf = $('killfeed'); kf.appendChild(li); while (kf.children.length > 6) kf.firstChild.remove(); setTimeout(() => li.remove(), 7000); }
function myName() { return net.last?.pl.find((p) => p.id === myId)?.n; }

// ======================================================================= local simulation
const tmpV = new THREE.Vector3();
let sendT = 0;
function simulateMe(dt) {
  const snap = net.last; if (!snap) return;
  const frozen = snap.ph === 'buy' || snap.ph === 'matchEnd';
  const k = curWeaponKey(), w = eff(k);
  me.throwT = Math.max(0, me.throwT - dt); me.blind = Math.max(0, me.blind - dt);
  if (me.alive) {
    // movement
    let fx = 0, fz = 0;
    if (keys.has('KeyW')) fz += 1; if (keys.has('KeyS')) fz -= 1;
    if (keys.has('KeyD')) fx += 1; if (keys.has('KeyA')) fx -= 1;
    fx += touchState.move[0]; fz -= touchState.move[1];
    const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
    const trigger = ((mouseDown || me.clickQ) && ui.buy.classList.contains('hidden')) || touchState.fire;
    // sprint (hold Shift while moving forward; on touch: push the stick all the way forward)
    me.adrT = Math.max(0, me.adrT - dt);
    const adr = me.adrT > 0;
    const sprintKey = keys.has('ShiftLeft') || keys.has('ShiftRight') || (isTouch && touchState.move[1] < -0.92);
    if (me.exhausted && me.stamina > 0.3) me.exhausted = false;
    // starting a sprint stands you up and straightens a lean
    if (sprintKey && fz > 0.5 && !me.scoped && !me.using && !frozen && !me.exhausted && me.reloadT <= 0 && !trigger && (touchState.crouch || touchState.leanL || touchState.leanR)) clearStance();
    // crouch (C toggles, also on touch)
    me.crouch = (touchState.crouch || me.useProg > 0) && !frozen; // you kneel while planting/defusing
    const canSprint = sprintKey && fz > 0.5 && !me.scoped && !me.crouch && !me.using && !frozen && !me.exhausted && me.reloadT <= 0 && !trigger;
    if (me.sprint && !canSprint) me.sprintOut = 0.14; // short delay before you can shoot out of a sprint
    me.sprint = canSprint;
    if (me.sprint && l > 0.3) {
      if (!adr) me.stamina = Math.max(0, me.stamina - dt / 6);
      me.staminaDelay = 0.8;
      if (me.stamina <= 0) { me.exhausted = true; me.sprint = false; }
    } else {
      me.staminaDelay -= dt;
      if (me.staminaDelay <= 0) me.stamina = Math.min(1, me.stamina + dt / 3.5);
    }
    me.sprintOut = Math.max(0, me.sprintOut - dt);
    // lean (Q / E toggle) — clamped so you can't lean through walls
    let lt = 0;
    if (!frozen && !me.sprint && me.alive) lt = (touchState.leanR ? 1 : 0) - (touchState.leanL ? 1 : 0);
    if (lt) {
      const eh = me.y + S.eyeH(me.crouch), [lx, lz] = S.leanOff(me.yaw, lt);
      if (!S.segClear([me.x, eh, me.z], [me.x + lx * 1.3, eh, me.z + lz * 1.3])) lt *= 0.4;
    }
    me.lean = lt;
    me.leanS += (me.lean - me.leanS) * Math.min(1, dt * 11);
    if (Math.abs(me.leanS) < 0.002) me.leanS = 0;
    const speed = frozen ? 0 : w.speed * (Math.abs(me.leanS) > 0.3 ? 0.8 : 1) * (me.sprint ? S.SPRINT_MUL : 1) * (me.crouch ? S.CROUCH_MUL : 1) * (me.scoped ? 0.6 : 1) * (adr ? S.ADREN_MUL : 1);
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    // forward = (sin yaw, cos yaw); right = (-cos yaw, sin yaw)
    let tvx = (sy * fz - cy * fx) * speed, tvz = (cy * fz + sy * fx) * speed;
    if (frozen || me.using) { tvx = 0; tvz = 0; }
    if (me.using && me.onGround) { me.vx = 0; me.vz = 0; }
    const accel = me.onGround ? 14 : 3;
    me.vx += (tvx - me.vx) * Math.min(1, accel * dt);
    me.vz += (tvz - me.vz) * Math.min(1, accel * dt);
    // horizontal move against walls + any prop taller than a step above our feet
    [me.x, me.z] = S.moveCollide(me.x, me.z, me.vx * dt, me.vz * dt, S.PLAYER_R, me.y);
    // vertical: jump, gravity, land on props, step up stairs / low ledges
    // jump presses are buffered briefly so a quick tap is never lost between frames
    const wantJump = keys.has('Space') || performance.now() - (me.jumpQ || 0) < 180;
    if (wantJump && me.onGround && !frozen && !me.using && me.vy <= 0) { me.vy = S.JUMP_V * (me.crouch ? 0.85 : 1); me.onGround = false; me.jumpQ = 0; keys.delete('Space'); }
    const g = S.groundAt(me.x, me.z, S.PLAYER_R, me.y);
    if (me.onGround) {
      if (g > me.y) me.y = g;                       // stepped up
      else if (g < me.y - 0.02) me.onGround = false; // walked off an edge
    }
    if (!me.onGround) {
      const fall = me.vy;
      me.vy -= S.GRAV * dt; me.y += me.vy * dt;
      const g2 = S.groundAt(me.x, me.z, S.PLAYER_R, Math.max(me.y, 0));
      if (me.y <= g2) {
        me.y = g2;
        if (me.vy <= 0) { if (fall < -4.5) { sfx.land(Math.min(1, -fall / 9)); vmKick = Math.min(1, vmKick + 0.25); } me.vy = 0; me.onGround = true; }
      }
    }
    if (me.y < 0) { me.y = 0; me.vy = 0; me.onGround = true; }
    // smoothed values for the camera (stairs + crouch transitions)
    me.yS = me.onGround && me.y > me.yS ? me.yS + (me.y - me.yS) * Math.min(1, dt * 16) : me.y;
    me.eye += (S.eyeH(me.crouch) - me.eye) * Math.min(1, dt * 12);
    const hs = Math.hypot(me.vx, me.vz);
    me.moving = hs > 0.5;
    if (me.onGround && hs > 3.5 && !me.crouch) { me.stepT -= dt * hs * (me.sprint ? 1.15 : 1); if (me.stepT <= 0) { me.stepT = 2.3; sfx.step(me.sprint ? 1.25 : 1); } }
    // adrenaline heartbeat
    if (adr) { me.heartT = (me.heartT || 0) - dt; if (me.heartT <= 0) { me.heartT = 0.62; sfx.heart(); } }
    // weapons
    me.fireT -= dt; me.drawT = Math.max(0, (me.drawT || 0) - dt);
    const a = ammoFor(k);
    if (me.reloadT > 0) {
      me.reloadT -= dt;
      if (me.reloadT <= 0) { const need = w.mag - a.mag, take = Math.min(need, a.res); a.mag += take; a.res -= take; }
    }
    if (trigger && !frozen && me.fireT <= 0 && me.reloadT <= 0 && me.drawT <= 0 && me.sprintOut <= 0 && !me.sprint) {
      if (a.mag <= 0) { if (me.fireT < -0.2) { sfx.empty(); startReload(); me.fireT = 0.2; } }
      else if (w.auto || !me.triggerHeld) {
        fireShot(k, w, a);
      }
    }
    me.triggerHeld = trigger; if (me.fireT > 0 || !mouseDown) me.clickQ = false;
    if ((rightHeld || aimKeyHeld || me.adsLatch) && !me.scoped && me.reloadT <= 0 && me.drawT <= 0) me.scoped = true;
    if (!trigger) me.bloom = Math.max(0, me.bloom - dt * 3.5);
    else me.bloom = Math.max(0, me.bloom - dt * 0.8);
    // edge-turn: keeps turning while the cursor rests near the screen edge (no pointer lock in the preview)
    if (!isTouch && !locked && cursor.inside && ui.buy.classList.contains('hidden')) {
      const E = 0.07, rate = 2.6 * adsSens();
      if (cursor.x < E) me.yaw += rate * dt * (1 - cursor.x / E + 0.3);
      else if (cursor.x > 1 - E) me.yaw -= rate * dt * (1 - (1 - cursor.x) / E + 0.3);
      if (cursor.y < E) me.pitch = Math.min(1.45, me.pitch + rate * 0.5 * dt);
      else if (cursor.y > 1 - E) me.pitch = Math.max(-1.45, me.pitch - rate * 0.5 * dt);
    }
    // recoil recovery
    const rec = Math.min(1, dt * 7);
    me.pitch -= me.recoilP * rec; me.recoilP -= me.recoilP * rec;
    me.yaw -= me.recoilY * rec; me.recoilY -= me.recoilY * rec;
    // use hint
    updateUseHint(snap);
  }
  sendT -= dt;
  if (sendT <= 0) {
    sendT = 1 / 30;
    send({ t: 'state', x: me.x, y: me.y, z: me.z, yaw: me.yaw, pitch: me.pitch, mv: me.moving ? 1 : 0, c: me.cur, cr: me.crouch ? 1 : 0, sp: me.sprint && me.moving ? 1 : 0, ln: +me.leanS.toFixed(2) });
  }
}
function fireShot(k, w, a) {
  me.fireT = 60 / w.rpm;
  a.mag--;
  me.sprint = false;
  const moveF = Math.min(1, Math.hypot(me.vx, me.vz) / 5) + (me.onGround ? 0 : 1.2);
  let spread = w.spread + w.moveSpread * moveF + me.bloom * w.recoil * 0.9;
  if (w.scope && !me.scoped) spread += 0.06;
  if (me.scoped) spread = w.scope ? spread * 0.15 : spread * (w.pellets ? 0.8 : w.adsMul);
  if (me.crouch && me.onGround) spread *= 0.7;
  if (!me.scoped) spread *= w.hipMul; // laser sight tightens hipfire
  me.bloom = Math.min(8, me.bloom + 1);
  const [olx, olz] = S.leanOff(me.yaw, me.leanS);
  const o = [me.x + olx, me.y + S.eyeH(me.crouch), me.z + olz];
  const dirOf = (yw, pt) => [Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt)];
  const dirs = [];
  if (w.pellets) {
    const base = w.spread * (me.scoped ? 0.8 : w.hipMul < 1 ? 0.65 : 1) * (me.crouch ? 0.85 : 1), extra = Math.max(0, spread - base);
    const cy = me.yaw + (Math.random() - 0.5) * extra, cp = me.pitch + (Math.random() - 0.5) * extra;
    for (let i = 0; i < w.pellets; i++) {
      const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * base;
      dirs.push(dirOf(cy + Math.cos(ang) * r, cp + Math.sin(ang) * r));
    }
    send({ t: 'shoot', o, d: dirs[0], ds: dirs, w: k });
  } else {
    dirs.push(dirOf(me.yaw + (Math.random() - 0.5) * 2 * spread, me.pitch + (Math.random() - 0.5) * 2 * spread));
    send({ t: 'shoot', o, d: dirs[0], w: k });
  }
  // local prediction of tracer end points vs world + players
  camera.updateMatrixWorld();
  vmCam.updateMatrixWorld(); const muzzle = camera.localToWorld(flash.getWorldPosition(tmpV));
  const mz = [muzzle.x, muzzle.y, muzzle.z];
  for (const d of dirs) {
    let tEnd = S.rayWorld(o, d, w.pellets ? 60 : 250); let hitP = false;
    for (const p of renderPlayers) { if (p.id === myId || !p.a) continue; const h = S.rayPlayer(o, d, p); if (h && h.t < tEnd) { tEnd = h.t; hitP = true; } }
    const e = [o[0] + d[0] * tEnd, o[1] + d[1] * tEnd, o[2] + d[2] * tEnd];
    tracer(mz, e);
    if (!hitP && (!w.pellets || Math.random() < 0.6)) impact(e, false);
  }
  me.recoilP -= w.recoil * (1 + Math.random() * 0.5) * (me.bloom < 3 ? 0.6 : 1);
  me.pitch += w.recoil * (me.crouch ? 0.85 : 1);
  me.yaw += (Math.random() - 0.5) * w.recoil * 0.8;
  vmKick = Math.min(1, vmKick + (w.pellets ? 1 : 0.6));
  flash.material.opacity = 1; flash.rotation.z = Math.random() * 3; flashLight.intensity = w.pellets ? 6 : 4;
  sfxShot(k, w.quiet ? 0.35 : 1, 0, w.quiet);
  if (a.mag <= 0) setTimeout(startReload, 250);
}
function updateUseHint(snap) {
  const b = snap.bomb;
  let hint = '';
  if (me.team === 'T' && b.s === 'carried' && b.c === myId) hint = S.inSite(me.x, me.z) ? 'Hold F to plant the bomb' : '';
  if (me.team === 'D' && b.s === 'planted' && Math.hypot(me.x - b.x, me.z - b.z) < 1.8) hint = 'Hold F to defuse';
  const pr = $('progress');
  if (me.useProg > 0) {
    const total = me.team === 'T' ? S.ROUND.plantTime : (me.kit ? S.ROUND.defuseKitTime : S.ROUND.defuseTime);
    pr.classList.remove('hidden'); $('progress-label').textContent = me.team === 'T' ? 'Planting' : 'Defusing';
    $('progress-fill').style.width = Math.min(100, (me.useProg / total) * 100) + '%';
  } else pr.classList.add('hidden');
  const h = $('hint');
  if (hint && me.useProg <= 0) { h.textContent = hint; h.classList.remove('hidden'); h.dataset.use = '1'; }
  else if (h.dataset.use) { h.classList.add('hidden'); delete h.dataset.use; }
}

// ======================================================================= interpolation & rendering of others
let renderPlayers = [];
function interpPlayers() {
  const sn = net.snaps; if (!sn.length) return [];
  const rt = performance.now() / 1000 - 0.1;
  let a = sn[sn.length - 1], b = null;
  for (let i = sn.length - 1; i > 0; i--) { if (sn[i - 1].recv <= rt) { a = sn[i - 1]; b = sn[i]; break; } }
  if (!b) return a.pl.map((p) => ({ ...p }));
  const t = Math.max(0, Math.min(1, (rt - a.recv) / (b.recv - a.recv || 1)));
  const prev = new Map(a.pl.map((p) => [p.id, p]));
  return b.pl.map((p) => {
    const q = prev.get(p.id); if (!q) return { ...p };
    let dy = p.yw - q.yw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    return { ...p, x: q.x + (p.x - q.x) * t, y: q.y + (p.y - q.y) * t, z: q.z + (p.z - q.z) * t, yw: q.yw + dy * t, pt: q.pt + (p.pt - q.pt) * t };
  });
}
// soft round contact shadow under every character: one instanced draw call for everybody
const blobs = (() => {
  const t = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 16);
  m.count = 0; m.frustumCulled = false; m.renderOrder = 1; scene.add(m); return m;
})();
const _bm = new THREE.Matrix4();
function updateAvatars(dt) {
  renderPlayers = interpPlayers();
  let nb = 0;
  const seen = new Set();
  for (const p of renderPlayers) {
    seen.add(p.id);
    const a = ensureAvatar(p);
    const r = a.root, u = r.userData;
    const isMe = p.id === myId;
    const fpv = isMe && me.alive;
    r.visible = !fpv;
    if (isMe && me.alive) { r.position.set(me.x, me.y, me.z); continue; }
    r.position.set(p.x, p.y, p.z);
    if (nb < 16) { const sz = p.a ? 0.95 : 1.6; _bm.makeScale(sz, 1, sz).setPosition(p.x, (p.gy ?? p.y) + 0.02, p.z); blobs.setMatrixAt(nb++, _bm); }
    r.rotation.y = p.yw;
    // gun
    if (u.gunKey !== p.w) { setAvatarGun(u, p.w); lowMats(u.arms); }
    u.arms.rotation.x = -p.pt * 0.9; u.headG.rotation.x = -p.pt * 0.6;
    // planting / defusing: gun slung, arms reach down and work on the bomb, head looks down
    u.gunHolder.visible = !(p.u && p.a);
    if (p.u && p.a) { a.useA = (a.useA || 0) + dt; u.arms.rotation.x = 0.95 + Math.sin(a.useA * 7) * 0.12; u.arms.position.z = 0.05; u.headG.rotation.x = 0.55; }
    else u.arms.position.z = 0;
    if (p.a) {
      a.deadT = 0;
      const cr = p.cr || p.u;
      a.crT = (a.crT || 0) + ((cr ? 1 : 0) - (a.crT || 0)) * Math.min(1, dt * 12);
      a.lnS = (a.lnS || 0) + ((p.ln || 0) - (a.lnS || 0)) * Math.min(1, dt * 10); u.body.rotation.set(p.sp ? 0.18 : 0, 0, a.lnS * 0.32); u.body.position.y = -0.45 * a.crT;
      if (p.mv) { u.phase += dt * (p.sp ? 15 : cr ? 6 : 10); } else u.phase *= 0.8;
      const amp = p.sp ? 0.9 : cr ? 0.3 : 0.6;
      u.legL.rotation.x = Math.sin(u.phase) * amp - 1.1 * a.crT; u.legR.rotation.x = -Math.sin(u.phase) * amp - 0.5 * a.crT;
      // knees: bend on the forward swing, fold fully when crouched (left foot planted, right knee down)
      u.kneeL.rotation.x = Math.max(0, -Math.sin(u.phase + 0.5)) * amp * 1.2 * (1 - a.crT) + 2.07 * a.crT;
      u.kneeR.rotation.x = Math.max(0, Math.sin(u.phase + 0.5)) * amp * 1.2 * (1 - a.crT) + 1.9 * a.crT;
      if (a.adrFx) { a.adrFx = Math.max(0, a.adrFx - dt * 0.5); }
    } else {
      a.deadT = Math.min(1, a.deadT + dt * 3);
      u.body.rotation.x = -Math.PI / 2 * a.deadT; u.body.position.y = 0.15 * a.deadT;
    }
    // teammate name tags
    const showTag = p.tm === me.team && !isMe && p.a;
    if (showTag && !a.tag) { a.tag = nameSprite(p.n, p.tm === 'T' ? '#f0a070' : '#8fd3ef'); r.add(a.tag); }
    if (a.tag) a.tag.visible = showTag;
  }
  blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
  for (const [id, a] of avatars) if (!seen.has(id)) { scene.remove(a.root); avatars.delete(id); }
}
function updateBomb(dt) {
  const b = net.last?.bomb; if (!b) { bombMesh.visible = false; return; }
  if (b.s === 'dropped' || b.s === 'planted') {
    bombMesh.visible = true; bombMesh.position.set(b.x, b.y || 0, b.z);
    if (b.s === 'planted') {
      const rate = b.tm > 20 ? 1 : b.tm > 10 ? 2 : b.tm > 5 ? 4 : 8;
      bombBlink += dt * rate;
      const on = (bombBlink % 1) < 0.25;
      bombMesh.userData.led.material.color.set(on ? '#ff2a1a' : '#401010');
      bombLight.position.set(b.x, (b.y || 0) + 0.6, b.z); bombLight.intensity = on ? 3 : 0;
      if (on && !lastBlinkOn) { const d = Math.hypot(b.x - me.x, b.z - me.z); if (d < 45) sfx.beep(b.tm < 10); }
      lastBlinkOn = on;
    } else { bombLight.intensity = 0; bombMesh.userData.led.material.color.set('#401010'); }
  } else { bombMesh.visible = false; bombLight.intensity = 0; }
}
let bombBlink = 0, lastBlinkOn = false;

// ======================================================================= grenades + smoke
const nadeGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8);
const nadeMats = { flash: new THREE.MeshStandardMaterial({ color: '#c9ccd1', metalness: 0.6, roughness: 0.35 }), smoke: new THREE.MeshStandardMaterial({ color: '#5d6b4c', roughness: 0.6 }), molly: new THREE.MeshStandardMaterial({ color: '#b8401e', roughness: 0.5, emissive: '#5a1400' }), frag: new THREE.MeshStandardMaterial({ color: '#3d4a2a', roughness: 0.7, metalness: 0.2 }) };
const nadeMeshes = new Map(), smokeClouds = new Map();
const smokeTex = canvasTex(128, 128, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(200,200,200,${Math.random() * 0.15})`; c.beginPath(); c.arc(w / 2 + (Math.random() - 0.5) * 70, h / 2 + (Math.random() - 0.5) * 70, 6 + Math.random() * 14, 0, 7); c.fill(); }
});
function makeCloud(sm) {
  const grp = new THREE.Group(); grp.position.set(sm.x, 0, sm.z);
  const puffs = [];
  // 4 shared materials per cloud (shade variety) instead of one per sprite
  const mats = [0, 1, 2, 3].map((i) => new THREE.SpriteMaterial({ map: smokeTex, color: new THREE.Color().setHSL(0.09, 0.08, 0.68 + i * 0.04), transparent: true, depthWrite: false, opacity: 0, fog: true, rotation: i * 1.3 }));
  for (let i = 0; i < 34; i++) {
    const sp = new THREE.Sprite(mats[i % 4]);
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * S.NADE.smokeR * 0.85;
    sp.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, y: 0.6 + Math.random() * 3.4, s: 3.8 + Math.random() * 2.8, spin: (Math.random() - 0.5) * 0.3 };
    grp.add(sp); puffs.push(sp);
  }
  scene.add(grp);
  return { grp, puffs, mats, t: 0 };
}
function updateNades(dt) {
  const sn = net.last;
  const nds = sn?.nd || [], sms = sn?.sm || [];
  const seen = new Set();
  for (const n of nds) {
    seen.add(n.id);
    let m = nadeMeshes.get(n.id);
    if (!m) { m = new THREE.Mesh(nadeGeo, nadeMats[n.k]); scene.add(m); nadeMeshes.set(n.id, m); m.position.set(n.x, n.y, n.z); }
    m.position.lerp(tmpV.set(n.x, n.y, n.z), Math.min(1, dt * 20));
    m.rotation.x += dt * 9; m.rotation.z += dt * 5;
  }
  for (const [id, m] of nadeMeshes) if (!seen.has(id)) { scene.remove(m); nadeMeshes.delete(id); }
  const seenS = new Set();
  for (const sm of sms) {
    seenS.add(sm.id);
    let c = smokeClouds.get(sm.id);
    if (!c) { c = makeCloud(sm); smokeClouds.set(sm.id, c); }
    c.t += dt;
    const grow = Math.min(1, c.t / 1.4), fade = Math.min(1, sm.t / 2.5);
    for (const p of c.puffs) {
      const u = p.userData;
      p.position.set(u.x * (0.3 + grow * 0.7), u.y * (0.4 + grow * 0.6), u.z * (0.3 + grow * 0.7));
      const sc = u.s * (0.35 + grow * 0.65); p.scale.set(sc, sc, 1);
    }
    for (const m of c.mats) { m.opacity = 0.92 * grow * fade; m.rotation += 0.05 * dt; }
  }
  for (const [id, c] of smokeClouds) if (!seenS.has(id)) { scene.remove(c.grp); c.mats.forEach((m) => m.dispose()); smokeClouds.delete(id); }
  updateFires(dt);
}
// frag blast: fireball, dust ring, debris sparks, light, and a camera kick if you're close
const fragBall = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb35a', transparent: true, opacity: 0, depthWrite: false }));
const fragDust = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#8a7358', transparent: true, opacity: 0, depthWrite: false, roughness: 1 }));
fragBall.visible = fragDust.visible = false; scene.add(fragBall, fragDust);
let camShake = 0;
function fragFx(x, y, z) {
  fragBall.position.set(x, y + 0.4, z); fragBall.visible = true; fx.push({ obj: fragBall, life: 0.35, max: 0.35, kind: 'fball' });
  fragDust.position.set(x, y + 0.2, z); fragDust.visible = true; fx.push({ obj: fragDust, life: 1.6, max: 1.6, kind: 'fdust' });
  burstLight(x, y + 1, z, '#ffa040', 45, 22, 0.4);
  const d = Math.hypot(x - me.x, y - me.y, z - me.z);
  if (d < 18 && me.alive) camShake = Math.max(camShake, (1 - d / 18) * 0.9);
}
function flashFx(x, y, z) {
  burstLight(x, y + 0.3, z, '#ffffff', 80, 30, 0.35);
  popMesh.position.set(x, y, z); popMesh.visible = true;
  fx.push({ obj: popMesh, life: 0.25, max: 0.25, kind: 'pop' });
}
// ---- incendiary fire: additive flame sprites + scorch + a pooled light
const flameTex = canvasTex(64, 128, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h * 0.72, 2, w / 2, h * 0.62, w * 0.55);
  g.addColorStop(0, 'rgba(255,245,200,1)'); g.addColorStop(0.3, 'rgba(255,170,50,0.9)'); g.addColorStop(0.7, 'rgba(220,60,10,0.45)'); g.addColorStop(1, 'rgba(120,20,0,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(w / 2, 4); c.quadraticCurveTo(w * 1.02, h * 0.62, w / 2, h - 2); c.quadraticCurveTo(-w * 0.02, h * 0.62, w / 2, 4); c.fill();
});
const scorchTex = canvasTex(128, 128, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  g.addColorStop(0, 'rgba(20,12,6,0.85)'); g.addColorStop(0.7, 'rgba(30,18,8,0.5)'); g.addColorStop(1, 'rgba(30,18,8,0)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
});
const flameMat = new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: true });
const scorchGeo = new THREE.PlaneGeometry(S.FIRE.r * 2.2, S.FIRE.r * 2.2);
const fires = new Map();
function makeFire(f) {
  const grp = new THREE.Group(); grp.position.set(f.x, f.y || 0, f.z);
  const sc = new THREE.Mesh(scorchGeo, new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false, opacity: 0 }));
  sc.rotation.x = -Math.PI / 2; sc.position.y = 0.03; grp.add(sc);
  const flames = [];
  for (let i = 0; i < 26; i++) {
    const sp = new THREE.Sprite(flameMat.clone());
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * S.FIRE.r * 0.9;
    sp.userData = { x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.6 + Math.random() * 0.9, ph: Math.random() * 10, sp: 6 + Math.random() * 6 };
    sp.position.set(sp.userData.x, 0, sp.userData.z);
    grp.add(sp); flames.push(sp);
  }
  scene.add(grp);
  return { grp, sc, flames, t: 0, light: null, crackT: 0 };
}
function updateFires(dt) {
  const list = net.last?.fi || [];
  const seen = new Set();
  for (const f of list) {
    seen.add(f.id);
    let c = fires.get(f.id);
    if (!c) { c = makeFire(f); fires.set(f.id, c); }
    c.t += dt;
    const grow = Math.min(1, c.t / 0.4), fade = Math.min(1, f.t / 1.2);
    c.sc.material.opacity = Math.min(1, c.t / 0.6) * 0.9;
    for (const sp of c.flames) {
      const u = sp.userData; u.ph += dt * u.sp;
      const k = (0.7 + Math.sin(u.ph) * 0.3) * grow * fade * u.s;
      sp.scale.set(0.9 * k, 1.6 * k, 1); sp.position.y = 0.75 * k;
      sp.material.opacity = 0.75 + Math.sin(u.ph * 1.7) * 0.25;
    }
    // claim a pooled light for the nearest fires
    if (!c.light) { const e = lightPool.find((x) => !x.fire && x.until <= 0); if (e) { c.light = e; e.fire = f.id; e.l.color.set('#ff7a2a'); e.l.distance = 14; } }
    if (c.light) { c.light.l.position.set(f.x, (f.y || 0) + 1.2, f.z); c.light.l.intensity = (9 + Math.sin(c.t * 23) * 2 + Math.sin(c.t * 37) * 1.5) * grow * fade; }
    c.crackT -= dt;
    if (c.crackT <= 0) { c.crackT = 0.08 + Math.random() * 0.15; const d = Math.hypot(f.x - me.x, f.z - me.z); if (d < 25) sfx.crackle(1 - d / 25); }
  }
  for (const [id, c] of fires) if (!seen.has(id)) {
    if (c.light) { c.light.fire = null; c.light.l.intensity = 0; }
    scene.remove(c.grp); c.flames.forEach((sp) => sp.material.dispose()); c.sc.material.dispose(); fires.delete(id);
  }
}

// ======================================================================= camera
let vmKick = 0, bobT = 0, menuOrbit = 0, adsT = 0, sprintT = 0, vmShadeT = 0, vmLit = 1, vmLitS = 1;
function cycleSpectate() { spectateIdx++; spectateId = null; }
const lzA = new THREE.Vector3(), lzD = new THREE.Vector3(), lzZ = new THREE.Vector3(0, 0, 1);
function updateLaser(w) {
  const on = w.laser && vmLaserEmit && vm.visible && me.alive && !(w.lens && adsT > 0.3);
  laserBeam.visible = laserDot.visible = !!on;
  if (!on) return;
  camera.getWorldDirection(lzD);
  const o = [camera.position.x, camera.position.y, camera.position.z], d = [lzD.x, lzD.y, lzD.z];
  const t = S.rayWorld(o, d, 120);
  laserDot.position.set(o[0] + d[0] * (t - 0.03), o[1] + d[1] * (t - 0.03), o[2] + d[2] * (t - 0.03));
  laserDot.scale.setScalar(0.09 + t * 0.008);
  // beam: from the emitter on the gun to the screen centre (where the dot sits)
  vm.updateMatrixWorld(true);
  vmLaserEmit.getWorldPosition(lzA); vmCam.worldToLocal(lzA);
  lzD.set(0, 0, -Math.min(t, 4.5)).sub(lzA); const len = lzD.length(); lzD.divideScalar(len);
  laserBeam.position.copy(lzA); laserBeam.quaternion.setFromUnitVectors(lzZ, lzD); laserBeam.scale.set(1, 1, len);
  laserBeam.material.opacity = 0.42 * (1 - adsT * 0.75);
}
// planting, driven by the real plant progress: set the C4 down, type a 7-digit code, flip the arming switch
const KEYSEQ = [6, 1, 9, 3, 4, 10, 7];
let plantDigits = 0, plantArmed = false;
function plantAnim(dt, prog, usingNow) {
  const P = rig.plant;
  // keep the bomb lying flat on the ground in front of you, whatever the camera pitch
  P.rotation.set(-camera.rotation.x - useRig.rotation.x, 0, 0);
  const lay = Math.min(1, prog / 0.16), e = 1 - Math.pow(1 - lay, 3);
  P.position.set(0, 0.07 - (1 - e) * 0.12, -0.04 - (1 - e) * 0.04);
  rig.bomb.position.set(0, 0, 0); rig.bomb.rotation.set((1 - e) * 0.6, (1 - e) * 0.25, 0);
  const tType = (prog - 0.18) / 0.58, dig = prog < 0.18 ? 0 : Math.min(7, Math.floor(tType * 7) + (tType > 0 ? 1 : 0));
  const armT = Math.max(0, Math.min(1, (prog - 0.78) / 0.12));
  // digits on the display
  if (prog < 0.02) { plantDigits = 0; plantArmed = false; }
  if (dig > plantDigits && usingNow) { plantDigits = dig; sfx.key(); }
  rig.digits.forEach((d, i) => { d.material = i < Math.min(dig, plantDigits) ? rig.digOn : rig.digOff; });
  if (prog > 0.95) rig.digits.forEach((d) => { d.material = Math.floor(useAnim * 8) % 2 ? rig.digOn : rig.digOff; });
  rig.keys.forEach((k) => { k.position.y = 0.045; });
  // right hand: hover over the next key and press it
  const R = rig.pR, Lh = rig.pL;
  if (prog < 0.18) {
    R.position.set(0.12, 0.02 + (1 - e) * 0.05, 0.02); R.rotation.set(-0.42, 1.05, 0);
  } else if (armT <= 0) {
    const seg = tType * 7, i = Math.min(6, Math.floor(seg)), f = seg - i;
    const k = rig.keys[KEYSEQ[i]], prev = rig.keys[KEYSEQ[Math.max(0, i - 1)]];
    const mv = Math.min(1, f / 0.45), press = f > 0.45 && f < 0.8 ? Math.sin(((f - 0.45) / 0.35) * Math.PI) : 0;
    const tx = prev.position.x + (k.position.x - prev.position.x) * mv, tz = prev.position.z + (k.position.z - prev.position.z) * mv;
    R.position.set(tx, 0.052 + 0.03 * (1 - press), tz + 0.004); R.rotation.set(-0.42, 1.05, 0);
    if (press > 0.6) k.position.y = 0.041;
  } else {
    // flip the arming switch (left side of the panel), then pull the hand back
    const back = Math.max(0, (prog - 0.9) / 0.1);
    R.position.set(0.096 + back * 0.04, 0.075 - armT * 0.012 + back * 0.05, -0.03 + (armT - 0.5) * 0.02 + back * 0.08); R.rotation.set(-0.5, 1.1, 0);
  }
  rig.lever.rotation.x = -0.6 + armT * 1.2;
  if (armT >= 1 && !plantArmed && usingNow) { plantArmed = true; sfx.arm(); }
  rig.ant.scale.y = 0.15 + armT * 0.85;
  // left hand steadies the bomb
  Lh.position.set(-0.13, 0.025 + Math.sin(useAnim * 1.7) * 0.004, 0.035); Lh.rotation.set(-0.5, -0.5, 0.2);
  rig.c4led.material = armT >= 1 && Math.floor(useAnim * 6) % 2 ? rig.ledMat : rig.lcdMat;
}
function updateUseRig(dt, ue, usingNow) {
  useRig.visible = ue > 0.02;
  if (!useRig.visible) { rigMode = ''; return; }
  const mode = me.team === 'D' ? 'defuse' : 'plant';
  if (mode !== rigMode) { rigMode = mode; const d = mode === 'defuse'; rig.kit.visible = rig.cutters.visible = rig.left.visible = rig.right.visible = d; rig.finger.visible = false; rig.plant.visible = !d; }
  useAnim += dt;
  const total = me.team === 'T' ? S.ROUND.plantTime : (me.kit ? S.ROUND.defuseKitTime : S.ROUND.defuseTime);
  const prog = Math.min(1, (me.useProg || 0) / total);
  useRig.position.set(0, -0.62 + ue * 0.36, -0.42);
  useRig.rotation.set(0.1 + Math.sin(useAnim * 1.3) * 0.015, 0, Math.sin(useAnim * 0.9) * 0.01);
  if (rigMode === 'defuse') {
    // cutters close on a wire roughly once a second, kit screen fills with progress
    const cyc = (useAnim * 1.15) % 1, close = cyc < 0.18 ? cyc / 0.18 : cyc < 0.3 ? 1 : Math.max(0, 1 - (cyc - 0.3) / 0.25);
    const open = 0.38 * (1 - close);
    rig.jawA.rotation.y = open; rig.jawB.rotation.y = -open;
    rig.right.position.set(0.14 - close * 0.03, -0.03 + Math.sin(useAnim * 2.1) * 0.01, -close * 0.035);
    rig.left.position.set(-0.15, -0.02 + Math.sin(useAnim * 1.7) * 0.006, 0);
    rig.bar.scale.x = Math.max(0.02, prog);
    if (usingNow && cyc > 0.16 && snipT <= 0) { snipT = 0.5; sfx.snip(); }
    snipT -= dt;
    rig.ledMat.color.set(Math.floor(useAnim * 4) % 2 ? '#ff3020' : '#3a0805');
  } else {
    plantAnim(dt, prog, usingNow);
  }
}
function updateCamera(dt) {
  laserBeam.visible = laserDot.visible = false;
  if (!joined) {
    menuOrbit += dt * 0.05;
    camera.position.set(MW / 2 + Math.sin(menuOrbit) * 55, 34, MH / 2 + Math.cos(menuOrbit) * 55);
    camera.lookAt(MW / 2, 0, MH / 2);
    vm.visible = false;
    return;
  }
  if (me.alive) {
    const [clx, clz] = S.leanOff(me.yaw, me.leanS);
    camera.position.set(me.x + clx, me.yS + me.eye - Math.abs(me.leanS) * 0.06, me.z + clz);
    // planting / defusing: look down at the bomb while the hands work
    const usingNow = me.useProg > 0 && me.alive;
    useT += ((usingNow ? 1 : 0) - useT) * Math.min(1, dt * (usingNow ? 7 : 10));
    if (useT < 0.002) useT = 0;
    const ue = useT * useT * (3 - 2 * useT);
    camera.rotation.set(me.pitch + (Math.max(-1.1, Math.min(-0.55, me.pitch)) - me.pitch) * ue * 0.9, me.yaw + Math.PI, -me.leanS * S.LEAN_ROLL);
    if (camShake > 0.001) { camera.rotation.x += (Math.random() - 0.5) * camShake * 0.07; camera.rotation.y += (Math.random() - 0.5) * camShake * 0.07; camShake = Math.max(0, camShake - dt * 1.6); }
    updateUseRig(dt, ue, usingNow);
    const k = curWeaponKey();
    setViewmodel(k);
    const ew = eff(k);
    // aim-down-sights: faster for light optics; zoom tracks the gun so it never lags behind
    adsT += ((me.scoped ? 1 : 0) - adsT) * Math.min(1, dt * ew.adsSpd);
    if (Math.abs(adsT - (me.scoped ? 1 : 0)) < 0.004) adsT = me.scoped ? 1 : 0;
    vm.visible = !(ew.lens && adsT > 0.55) && useT < 0.55;
    const hs = Math.hypot(me.vx, me.vz);
    bobT += dt * hs * 1.6;
    const bob = me.onGround ? Math.min(1, hs / 6) : 0;
    vmKick *= Math.pow(0.0005, dt);
    const reloadDip = me.reloadT > 0 ? Math.sin(Math.min(1, 1 - me.reloadT / (me.reloadMax || ew.reload)) * Math.PI) * 0.25 : 0;
    sprintT += ((me.sprint && hs > 1 ? 1 : 0) - sprintT) * Math.min(1, dt * 10);
    const drawDip = (me.drawT || 0) * 0.6;
    const sightY = ew.optic === 'reddot' ? 0.108 : ew.optic === 'holo' ? 0.1 : ew.optic === 'micro' ? 0.095 : ew.lens ? 0.11 : IRON_Y[k] ?? 0.05;
    const hipX = 0.24, hipY = -0.24, adsX = 0, adsY = -sightY * 0.75;
    // window sights (red dot / micro / holo) are brought close to the eye so their frame surrounds the reticle
    const sightK = SIGHT_Z[ew.optic], gl = GUN_L[k] || 0.3;
    const adsZ = sightK ? -sightK[1] + gl * sightK[0] * 0.75 - vmGunHolder.position.z : -0.36;
    const bobA = 1 - adsT * 0.85, throwDip = (me.throwAnim || 0) * 0.5;
    me.throwAnim = Math.max(0, (me.throwAnim || 0) - dt);
    const sbob = 1 + sprintT * 1.4;
    vm.position.set(hipX + (adsX - hipX) * adsT + Math.sin(bobT) * 0.012 * bob * bobA * sbob - sprintT * 0.06, hipY + (adsY - hipY) * adsT + Math.abs(Math.cos(bobT)) * 0.012 * bob * bobA * sbob - reloadDip - drawDip - throwDip - sprintT * 0.07 - useT * 0.6, -0.42 + (adsZ + 0.42) * adsT + vmKick * 0.06 * bobA + sprintT * 0.04);
    vm.rotation.set(vmKick * 0.12 * bobA + reloadDip * 0.8 - sprintT * 0.35, sprintT * 0.75, reloadDip * 0.5 + sprintT * 0.25);
    updateLaser(ew);
    flash.material.opacity *= Math.pow(0.0001, dt);
    flashLight.intensity *= Math.pow(0.0001, dt);
    const hipFov = 78 + sprintT * 5 + (me.adrT > 0 ? 3 : 0);
    // zoom eases in with the ADS motion (ease-in so the scope picture snaps in at the end)
    const zk = adsT * adsT * (3 - 2 * adsT);
    const fov = hipFov + ((me.scoped || adsT > 0 ? ew.fov : hipFov) - hipFov) * zk;
    if (Math.abs(camera.fov - fov) > 0.02) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const vfov = 74 + sprintT * 3 - adsT * 10;
    if (Math.abs(vmCam.fov - vfov) > 0.02) { vmCam.fov = vfov; vmCam.updateProjectionMatrix(); }
    // gun gets darker when you stand in shadow (checked a few times a second)
    if ((vmShadeT -= dt) <= 0) { vmShadeT = 0.15; const e = camera.position, sd = sunDirV.subVectors(sun.position, sun.target.position).normalize(); const L = Math.max(0.5, (S.WALL_H * 1.15 - e.y) / Math.max(0.2, sd.y)); vmLit = S.segClear([e.x, e.y, e.z], [e.x + sd.x * L, e.y + sd.y * L, e.z + sd.z * L]) ? 1 : 0.4; }
    vmLitS += (vmLit - vmLitS) * Math.min(1, dt * 6); vmSun.intensity = 2.4 * vmLitS; vmHemi.intensity = 1.25 * (0.75 + 0.25 * vmLitS);
    $('spectate').classList.add('hidden');
  } else {
    vm.visible = false;
    if (camera.fov !== 78) { camera.fov = 78; camera.updateProjectionMatrix(); }
    const mates = renderPlayers.filter((p) => p.a && p.tm === me.team && p.id !== myId);
    const pool = mates.length ? mates : renderPlayers.filter((p) => p.a);
    let tgt = pool.find((p) => p.id === spectateId);
    if (!tgt && pool.length) { tgt = pool[spectateIdx % pool.length]; spectateId = tgt.id; }
    const sp = $('spectate');
    if (tgt) {
      const back = 3.2;
      let cx = tgt.x - Math.sin(tgt.yw) * back, cz = tgt.z - Math.cos(tgt.yw) * back;
      const dist = S.rayGrid(tgt.x, tgt.z, cx - tgt.x, cz - tgt.z, back);
      if (dist < back) { cx = tgt.x - Math.sin(tgt.yw) * (dist - 0.3); cz = tgt.z - Math.cos(tgt.yw) * (dist - 0.3); }
      camera.position.lerp(tmpV.set(cx, tgt.y + 2.3, cz), Math.min(1, dt * 8));
      camera.lookAt(tgt.x + Math.sin(tgt.yw) * 4, tgt.y + 1.3, tgt.z + Math.cos(tgt.yw) * 4);
      sp.innerHTML = '';
      sp.append(`Spectating ${tgt.n}`);
      const s = document.createElement('small'); s.textContent = net.last?.ph === 'buy' ? 'You will spawn next round' : 'Click / Space to switch player'; sp.appendChild(s);
      sp.classList.remove('hidden');
    } else {
      camera.position.set(MW / 2, 70, MH / 2 + 20); camera.lookAt(MW / 2, 0, MH / 2);
      sp.classList.add('hidden');
    }
  }
}

// ======================================================================= HUD
const radar = $('radar'), rctx = radar.getContext('2d');
const radarBase = document.createElement('canvas');
{
  radarBase.width = 200; radarBase.height = 182;
  const c = radarBase.getContext('2d'), sx = 200 / S.W, sz = 182 / S.H;
  for (let z = 0; z < S.H; z++) for (let x = 0; x < S.W; x++) {
    const v = S.GRID[z * S.W + x];
    if (v === 0) { c.fillStyle = S.inSite(x * S.TILE + 1, z * S.TILE + 1) ? 'rgba(200,70,50,0.45)' : 'rgba(230,210,180,0.32)'; c.fillRect(x * sx, z * sz, sx + 0.5, sz + 0.5); }
  }
  const mx = 200 / (S.W * S.TILE), mz = 182 / (S.H * S.TILE);
  for (const p of S.PROPS) {
    if (p.kind === 'lintel' || p.kind === 'rail') continue;
    c.fillStyle = p.kind === 'sill' ? 'rgba(120,175,210,0.85)' : p.kind === 'deck' || p.kind === 'step' ? 'rgba(90,90,90,0.75)' : p.h > 1.2 ? 'rgba(110,70,35,0.85)' : 'rgba(150,105,60,0.7)';
    c.fillRect(p.x0 * mx, p.z0 * mz, Math.max(1.5, (p.x1 - p.x0) * mx), Math.max(1.5, (p.z1 - p.z0) * mz));
  }
  c.font = '700 14px Chakra Petch, sans-serif'; c.fillStyle = 'rgba(255,220,200,0.9)';
  for (const k of ['A', 'B']) { const s = S.SITES[k]; c.fillText(k, ((s.x0 + s.x1) / 2) * sx - 4, ((s.z0 + s.z1) / 2) * sz + 5); }
}
function drawRadar() {
  const w = radar.width, h = radar.height, sx = w / (S.W * S.TILE), sz = h / (S.H * S.TILE);
  rctx.clearRect(0, 0, w, h); rctx.drawImage(radarBase, 0, 0);
  const mates = renderPlayers.filter((p) => p.tm === me.team && p.a);
  for (const p of renderPlayers) {
    if (!p.a) continue;
    const mine = p.id === myId;
    const px = (mine ? me.x : p.x) * sx, pz = (mine ? me.z : p.z) * sz;
    let visible = p.tm === me.team;
    if (!visible) visible = mates.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < 70 && S.losClear(m.x, m.z, p.x, p.z) && !S.smokeBlocks(m.x, m.z, p.x, p.z, net.last?.sm));
    if (!visible) continue;
    rctx.fillStyle = p.tm === 'T' ? '#e5793a' : '#4fb3d9';
    rctx.beginPath(); rctx.arc(px, pz, mine ? 4 : 3, 0, 7); rctx.fill();
    if (mine) {
      rctx.strokeStyle = '#fff'; rctx.lineWidth = 1.5; rctx.stroke();
      rctx.beginPath(); rctx.moveTo(px, pz); rctx.lineTo(px + Math.sin(me.yaw) * 10, pz + Math.cos(me.yaw) * 10); rctx.stroke();
    }
  }
  const b = net.last?.bomb;
  if (b && (b.s === 'planted' || (b.s === 'dropped' && me.team === 'T'))) {
    rctx.fillStyle = b.s === 'planted' ? '#ff3a2a' : '#f2c14e';
    rctx.fillRect(b.x * sx - 3, b.z * sz - 3, 6, 6);
  }
}
function fmtTime(t) { t = Math.max(0, Math.ceil(t)); return `${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}`; }
let hudT = 0, radarT = 0;
const hudCache = new Map();
// write to the DOM only when a value actually changes (avoids layout work every frame)
function setText(id, v) { v = String(v); if (hudCache.get(id) !== v) { hudCache.set(id, v); $(id).textContent = v; } }
function setStyle(id, prop, v) { const key = id + ':' + prop; if (hudCache.get(key) !== v) { hudCache.set(key, v); $(id).style[prop] = v; } }
function updateHud(dt) {
  const s = net.last; if (!s) return;
  hudT -= dt; radarT -= dt;
  if (radarT <= 0) { radarT = 0.05; drawRadar(); }
  setText('score-T', s.sc.T); setText('score-D', s.sc.D);
  const clock = document.querySelector('.clock');
  const planted = s.bomb.s === 'planted';
  clock.classList.toggle('bomb', planted);
  setText('timer', planted ? fmtTime(s.bomb.tm) : fmtTime(s.tm));
  setText('phase-label', s.ph === 'buy' ? 'Buy phase' : planted ? 'Bomb' : s.ph === 'end' ? 'Round over' : s.ph === 'matchEnd' ? 'Match over' : 'Live');
  setText('round-label', `Round ${s.r}`);
  if (hudT <= 0) {
    hudT = 0.25;
    for (const t of ['T', 'D']) {
      const el = $('pips-' + t), list = s.pl.filter((p) => p.tm === t);
      el.innerHTML = list.map((p) => `<i class="${p.a ? '' : 'dead'}"></i>`).join('');
    }
    if (!ui.sb.classList.contains('hidden')) renderScoreboard();
    $('buy-timer').textContent = s.ph === 'buy' ? `${Math.ceil(s.tm)}s left` : '';
  }
  setText('money', '$' + me.money);
  setText('hp', me.hp); $('hp').classList.toggle('low', me.hp <= 25);
  setText('armor', me.armor);
  const tt = $('team-tag'); tt.className = me.team; tt.textContent = me.team === 'T' ? 'Attackers' : 'Defenders';
  const k = curWeaponKey(), a = ammoFor(k);
  setText('weapon-name', S.WEAPONS[k].name + (me.reloadT > 0 ? ' · reloading' : ''));
  setText('mag', a.mag); setText('reserve', a.res);
  $('ammo').classList.toggle('empty', a.mag === 0);
  $('bomb-tag').classList.toggle('hidden', !(s.bomb.s === 'carried' && s.bomb.c === myId));
  const w = eff(k);
  const ovl = me.scoped && me.alive && adsT > (w.lens ? 0.55 : 0.6) ? w.optic : '';
  const lensOn = !!ovl && w.lens;
  const scCls = lensOn ? (ovl === 'sniper' ? 'sniper' : 'lens ' + ovl) : 'hidden';
  if (hudCache.get('scope') !== scCls) { hudCache.set('scope', scCls); $('scope').className = scCls; }
  const retCls = ovl && !w.lens ? ovl : 'hidden';
  if (hudCache.get('ret') !== retCls) { hudCache.set('ret', retCls); $('reticle').className = retCls; }
  $('crosshair').classList.toggle('hidden', me.scoped || !me.alive);
  const moveF = Math.min(1, Math.hypot(me.vx, me.vz) / 5) + (me.onGround ? 0 : 1.2);
  const spread = (w.spread + w.moveSpread * moveF + me.bloom * w.recoil * 0.9) * (me.scoped ? 1 : w.hipMul);
  const gap = `${Math.round(4 + spread * (me.crouch ? 0.7 : 1) * 380)}px`;
  if (hudCache.get('gap') !== gap) { hudCache.set('gap', gap); $('crosshair').style.setProperty('--gap', gap); }
  const lh = $('look-hint');
  lh.classList.toggle('hidden', isTouch || locked || cursor.inside || !me.alive || !lockFailed);
  updateLockHint();
  // utility counts
  setText('nf-b', me.flash); setText('ns-b', me.smoke); setText('ng-b', me.frag || 0); $('nade-frag').classList.toggle('none', !me.frag); setText('nm-b', me.molly); setText('na-b', me.adren);
  $('nade-flash').classList.toggle('none', !me.flash); $('nade-smoke').classList.toggle('none', !me.smoke);
  $('nade-molly').classList.toggle('none', !me.molly); $('nade-adren').classList.toggle('none', !me.adren);
  $('nade-adren').classList.toggle('active', me.adrT > 0);
  if (isTouch) { $('t-molly').classList.toggle('none', !me.molly); $('t-adren').classList.toggle('none', !me.adren); }
  // stamina + adrenaline
  const st = $('stamina');
  st.classList.toggle('hidden', !me.alive || (me.stamina >= 0.999 && me.adrT <= 0));
  setStyle('stamina-fill', 'width', `${Math.round(me.stamina * 100)}%`);
  st.classList.toggle('low', me.exhausted); st.classList.toggle('adr', me.adrT > 0);
  setStyle('adren-ovl', 'opacity', me.adrT > 0 && me.alive ? String(+(0.55 + Math.sin(performance.now() / 98) * 0.15).toFixed(2) * Math.min(1, me.adrT)) : '0');
  const stTxt = !me.alive ? '' : [me.crouch ? 'Crouched' : '', me.lean < 0 ? 'Leaning left' : me.lean > 0 ? 'Leaning right' : ''].filter(Boolean).join(' · ');
  setText('stance', stTxt); $('stance').classList.toggle('hidden', !stTxt);
  // flash + smoke overlays
  const fb = $('flashbang');
  if (me.blind > 0 || fb.style.opacity !== '0') fb.style.opacity = me.blind > 0 ? Math.min(1, (me.blind / Math.max(0.6, me.blindMax)) * 1.6) * Math.min(1, (me.blindAmt || 1) * 1.3) : 0;
  let inSmoke = 0;
  for (const sm of s.sm || []) { const d = Math.hypot(sm.x - camera.position.x, sm.z - camera.position.z); if (camera.position.y < 4.2) inSmoke = Math.max(inSmoke, Math.min(1, (S.NADE.smokeR - d) / 1.5) * sm.grow * Math.min(1, sm.t / 2)); }
  setStyle('smoke-ovl', 'opacity', String(+(Math.max(0, inSmoke) * 0.92).toFixed(2)));
}
function renderScoreboard() {
  const s = net.last; if (!s) return;
  $('sb-score-T').textContent = s.sc.T; $('sb-score-D').textContent = s.sc.D;
  for (const t of ['T', 'D']) {
    const body = $('sb-' + t); body.innerHTML = '';
    for (const p of s.pl.filter((q) => q.tm === t).sort((a, b) => b.k - a.k)) {
      const tr = document.createElement('tr');
      tr.className = (p.a ? '' : 'dead') + (p.id === myId ? ' me' : '');
      const td = document.createElement('td'); td.textContent = p.n; if (p.b) { const b = document.createElement('span'); b.className = 'bot'; b.textContent = 'BOT'; td.appendChild(b); }
      tr.appendChild(td);
      for (const v of [p.k, p.d, t === me.team ? '$' + p.m : '—']) { const c = document.createElement('td'); c.textContent = v; tr.appendChild(c); }
      body.appendChild(tr);
    }
  }
}

// ======================================================================= main loop
const clock = new THREE.Clock();
let frameN = 0, perfAcc = 0, perfN = 0, curPR = BASE_PR, compiled = false;
const sunDirV = new THREE.Vector3(), camInv = new THREE.Matrix4();
function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta(), dt = Math.min(raw, 0.1);
  step(dt);
  // shadows at ~30 Hz: the sun never moves, only players/props-in-motion change
  frameN++;
  if (renderer.shadowMap.enabled && shadowFrames > 0) { shadowFrames--; renderer.shadowMap.needsUpdate = true; }
  if (!compiled && joined) { compiled = true; shadowFrames = 2; try { renderer.compile(scene, camera); } catch {} }
  sortWalls(camera.position.x, camera.position.z);
  renderer.render(scene, camera);
  if ((vm.visible || useRig.visible) && joined) {
    // sun direction in view space so the gun is lit consistently with the world
    sunDirV.subVectors(sun.position, sun.target.position).normalize().transformDirection(camInv.copy(camera.matrixWorld).invert());
    vmSun.position.copy(sunDirV).multiplyScalar(10); vmSun.target.position.set(0, 0, 0);
    vmFlashLight.intensity = flashLight.intensity * 0.6;
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(vmScene, vmCam); renderer.autoClear = true;
  }
  // adaptive resolution: only drops below native if the frame rate actually suffers
  if (!LOWFX && joined && !paused && raw < 0.25) {
    perfAcc += raw; perfN++;
    if (perfN >= 90) {
      const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
      let pr = curPR;
      if (avg > 1 / 50 && pr > BASE_PR * 0.5) pr = Math.max(BASE_PR * 0.5, pr - 0.15);
      else if (avg < 1 / 75 && pr < BASE_PR) pr = Math.min(BASE_PR, pr + 0.1);
      if (pr !== curPR) { curPR = pr; renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight); }
    }
  }
}
function step(dt) {
  if (joined && !paused) simulateMe(dt);
  updateAvatars(dt);
  updateBomb(dt);
  updateNades(dt);
  updateCamera(dt);
  updateFx(dt);
  if (joined) updateHud(dt);
}
requestAnimationFrame(frame);

// test hooks
window.render_game_to_text = () => JSON.stringify({
  joined, myId, phase: net.last?.ph, timer: net.last?.tm, round: net.last?.r, score: net.last?.sc,
  me: { team: me.team, x: +me.x.toFixed(2), z: +me.z.toFixed(2), yaw: +me.yaw.toFixed(2), hp: me.hp, money: me.money, alive: me.alive, primary: me.primary, cur: curWeaponKey(), ammo: ammoFor(curWeaponKey()) },
  bomb: net.last?.bomb, players: net.last?.pl.length,
});
window.__game = { me, keys, net, send, renderer, step, scene, camera, setPaused, setDifficulty, get room() { return ws?.room; }, setLook: (m) => { lookMode = m; } };
document.addEventListener('mouseleave', () => { cursor.inside = false; });
