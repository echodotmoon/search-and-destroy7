// Shared game data used by both the server and the browser client.
export const TILE = 2;           // metres per tile
export const W = 44, H = 40;     // grid size in tiles
export const WALL_H = 4.5;
export const EYE = 1.6;
export const PLAYER_R = 0.4;
export const PLAYER_H = 1.8;
export const EYE_CROUCH = 1.05;
export const PLAYER_H_CROUCH = 1.25;
export const STEP = 0.5;          // max ledge you can walk up without jumping
export const JUMP_V = 5.7;        // ~1m jump: enough to hop onto low cover
export const GRAV = 16;
export const SPRINT_MUL = 1.38, CROUCH_MUL = 0.5, ADREN_MUL = 1.25;
export const eyeH = (crouch) => (crouch ? EYE_CROUCH : EYE);
// leaning: upper body shifts sideways (right = +ln) relative to view yaw
export const LEAN_D = 0.42, LEAN_ROLL = 0.16;
export const leanOff = (yaw, ln) => [-Math.cos(yaw) * ln * LEAN_D, Math.sin(yaw) * ln * LEAN_D];

export const ROUND = {
  buyTime: 15, liveTime: 105, bombTime: 40, endTime: 6, matchEndTime: 12,
  plantTime: 3.2, defuseTime: 7, defuseKitTime: 3.5, winRounds: 7, halftime: 6,
};

export const ECON = {
  start: 800, max: 16000, win: 3250, loss: 1900, lossBonus: 500, lossMax: 3400,
  plant: 300, defuse: 300,
};

// slot: 'secondary' | 'primary' | 'gear'
export const WEAPONS = {
  sidearm:  { name: 'P-9 Sidearm',   slot: 'secondary', price: 0,    dmg: 26,  head: 3.5, rpm: 380, auto: false, mag: 12, reserve: 36, reload: 2.0, spread: 0.010, moveSpread: 0.035, recoil: 0.012, range: 40, falloff: 0.55, speed: 6.2, reward: 300 },
  cannon:   { name: 'Hand Cannon',   slot: 'secondary', price: 700,  dmg: 54,  head: 3.6, rpm: 220, auto: false, mag: 7,  reserve: 35, reload: 2.2, spread: 0.008, moveSpread: 0.06,  recoil: 0.045, range: 60, falloff: 0.7, speed: 6.0, reward: 300 },
  vector:   { name: 'Vector SMG',    slot: 'primary',   price: 1250, dmg: 23,  head: 3.0, rpm: 820, auto: true,  mag: 30, reserve: 120, reload: 2.3, spread: 0.018, moveSpread: 0.028, recoil: 0.010, range: 30, falloff: 0.55, speed: 6.0, reward: 600 },
  raptor:   { name: 'Raptor Rifle',  slot: 'primary',   price: 2700, dmg: 34,  head: 4.0, rpm: 600, auto: true,  mag: 30, reserve: 90,  reload: 2.5, spread: 0.006, moveSpread: 0.07,  recoil: 0.0085, range: 90, falloff: 0.85, speed: 5.5, reward: 300 },
  hornet:   { name: 'Hornet MP',     slot: 'secondary', price: 500,  dmg: 17,  head: 3.0, rpm: 900, auto: true,  mag: 20, reserve: 60,  reload: 1.9, spread: 0.016, moveSpread: 0.026, recoil: 0.0075, range: 20, falloff: 0.5, speed: 6.1, reward: 300 },
  breacher: { name: 'Breacher Shotgun', slot: 'primary', price: 1600, dmg: 15,  head: 1.6, rpm: 72,  auto: false, mag: 6,  reserve: 30,  reload: 2.8, spread: 0.055, moveSpread: 0.012, recoil: 0.05, range: 9, falloff: 0.2, speed: 5.8, reward: 900, pellets: 9 },
  bulldog:  { name: 'Bulldog Carbine', slot: 'primary',  price: 2100, dmg: 29,  head: 3.6, rpm: 660, auto: true,  mag: 25, reserve: 75,  reload: 2.3, spread: 0.008, moveSpread: 0.06,  recoil: 0.0105, range: 60, falloff: 0.75, speed: 5.75, reward: 300 },
  sentinel: { name: 'Sentinel DMR',  slot: 'primary',   price: 3300, dmg: 68,  head: 2.6, rpm: 190, auto: false, mag: 10, reserve: 30,  reload: 2.8, spread: 0.002, moveSpread: 0.09,  recoil: 0.034, range: 120, falloff: 0.9, speed: 5.3, reward: 300 },
  warden:   { name: 'Warden LMG',    slot: 'primary',   price: 3400, dmg: 30,  head: 3.2, rpm: 700, auto: true,  mag: 75, reserve: 150, reload: 4.4, spread: 0.009, moveSpread: 0.09,  recoil: 0.0095, range: 70, falloff: 0.8, speed: 4.8, reward: 300 },
  longbow:  { name: 'Longbow Sniper',slot: 'primary',   price: 4500, dmg: 115, head: 2.5, rpm: 42,  auto: false, mag: 5,  reserve: 25,  reload: 3.4, spread: 0.0015, moveSpread: 0.12, recoil: 0.06, range: 200, falloff: 1.0, speed: 5.0, reward: 100, scope: true },
};
export const GEAR = {
  armor:  { name: 'Kevlar + Helmet', price: 1000 },
  kit:    { name: 'Defuse Kit',      price: 400, team: 'D' },
  flash:  { name: 'Flashbang',       price: 200, max: 2 },
  smoke:  { name: 'Smoke Grenade',   price: 300, max: 2 },
  frag:   { name: 'Frag Grenade',    price: 300, max: 1 },
};
// Signature abilities: every player gets one charge of each, free, every round.
export const ABILITIES = {
  molly:  { name: 'Incendiary', key: 'F', desc: 'Sets an area on fire for 7s' },
  adren:  { name: 'Adrenaline', key: 'X', desc: '+25% speed, faster reload, heals 30 over 3s' },
};
// frag: lethal close up, falls off with distance, needs a clear line from the blast (walls and cover protect you)
export const FRAG = { fuse: 1.7, r: 8, dmg: 120 };
export const FIRE = { fuse: 2.2, time: 7, r: 3.1, dps: 34 };
export const ADREN = { time: 6, heal: 30, healTime: 3, reloadMul: 0.6 };

// Weapon attachments. slot: optic | muzzle | grip | rail | mag
export const ATTACH = {
  reddot: { slot: 'optic',  name: 'Red Dot Sight',  price: 200, desc: 'Clean dot · 1.3x zoom',        fov: 60, ads: 0.45, spd: 26, for: ['sidearm', 'cannon', 'hornet', 'vector', 'breacher', 'bulldog', 'raptor', 'sentinel', 'warden'] },
  holo:   { slot: 'optic',  name: 'Holo Sight 2x',  price: 300, desc: 'Ring reticle · 2x zoom',       fov: 42, ads: 0.42, spd: 23, for: ['vector', 'breacher', 'bulldog', 'raptor', 'sentinel', 'warden'] },
  micro:  { slot: 'optic',  name: 'Micro Reflex',   price: 150, desc: 'Tiny green dot · fastest aim', fov: 64, ads: 0.48, spd: 30, for: ['sidearm', 'cannon', 'hornet', 'vector', 'breacher'] },
  prism:  { slot: 'optic',  name: 'Prism Scope 3x', price: 400, desc: 'Etched reticle · 3x zoom',     fov: 30, ads: 0.36, spd: 19, lens: true, for: ['vector', 'bulldog', 'raptor', 'sentinel', 'warden'] },
  acog:   { slot: 'optic',  name: 'ACOG Scope 4x',  price: 500, desc: 'Long range · 4x zoom',         fov: 22, ads: 0.32, spd: 17, lens: true, for: ['bulldog', 'raptor', 'sentinel', 'warden'] },
  recon:  { slot: 'optic',  name: 'Recon Scope 6x', price: 650, desc: 'Mil-dot · 6x zoom · slower aim', fov: 14, ads: 0.25, spd: 13, lens: true, for: ['raptor', 'sentinel', 'warden'] },
  comp:   { slot: 'muzzle', name: 'Compensator',    price: 300, desc: '−40% recoil',                  recoil: 0.6, for: ['cannon', 'hornet', 'vector', 'bulldog', 'raptor', 'sentinel', 'warden'] },
  supp:   { slot: 'muzzle', name: 'Suppressor',     price: 350, desc: 'Quiet · bots can\'t hear shots', recoil: 0.9, quiet: true, for: ['sidearm', 'cannon', 'hornet', 'vector', 'bulldog', 'raptor', 'sentinel', 'warden', 'longbow'] },
  grip:   { slot: 'grip',   name: 'Vertical Grip',  price: 250, desc: '−35% moving spread · −15% recoil', moveSpread: 0.65, recoil: 0.85, for: ['vector', 'breacher', 'bulldog', 'raptor', 'warden'] },
  laser:  { slot: 'rail',   name: 'Laser Sight',    price: 250, desc: '−55% hipfire spread · red beam', hip: 0.45, for: ['sidearm', 'cannon', 'hornet', 'vector', 'breacher', 'bulldog', 'raptor', 'sentinel', 'warden', 'longbow'] },
  extmag: { slot: 'mag',    name: 'Extended Mag',   price: 300, desc: '+50% magazine',                magMul: 1.5, for: ['sidearm', 'cannon', 'hornet', 'vector', 'breacher', 'bulldog', 'raptor', 'sentinel', 'warden'] },
};
export const ATTACH_SLOTS = ['optic', 'muzzle', 'grip', 'rail', 'mag'];
export const NADE = { gravity: 13, speed: 16, flashFuse: 1.4, smokeFuse: 1.8, smokeTime: 15, smokeR: 4.2, flashRange: 30 };

// true if a smoke cloud sits between two points (2D)
export function smokeBlocks(ax, az, bx, bz, smokes) {
  if (!smokes || !smokes.length) return false;
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-6;
  for (const s of smokes) {
    if (s.grow !== undefined && s.grow < 0.35) continue;
    const r = NADE.smokeR * 0.85;
    const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.z - az) * dz) / L2));
    const px = ax + dx * t - s.x, pz = az + dz * t - s.z;
    if (px * px + pz * pz < r * r) return true;
  }
  return false;
}

// ---------- Map: carved from rectangles (tile coords, inclusive) ----------
// Every route bends at least twice, so neither spawn has a sightline into the other half of the map.
const FLOOR = [
  [17, 1, 26, 5],   // defender spawn
  [2, 1, 12, 10],   // B site
  [31, 1, 41, 10],  // A site
  [13, 2, 16, 4],   // CT -> B
  [27, 2, 30, 4],   // CT -> A
  [23, 6, 25, 7], [25, 8, 27, 9], // CT -> mid (dogleg)
  [16, 10, 27, 13], // mid top
  [10, 11, 15, 12], // B short
  [14, 6, 16, 8], [15, 9, 16, 9], // B window room
  [28, 11, 31, 12], // A short
  [21, 14, 23, 20], // mid upper
  [17, 16, 19, 20], // mid side room (windows onto mid)
  [14, 21, 26, 22], // mid jog
  [24, 23, 26, 28], // mid lower
  [18, 29, 26, 30], // mid bottom jog
  [18, 31, 20, 33], // T -> mid
  [17, 34, 26, 38], // attacker spawn
  [6, 34, 16, 36],  // T side left
  [6, 25, 9, 33],   // lower tunnels
  [2, 22, 9, 24],   // tunnel bend
  [2, 11, 5, 21],   // upper tunnels -> B
  [10, 23, 14, 24], // tunnels -> mid link
  [27, 34, 36, 36], // T side right
  [34, 24, 37, 33], // lower long
  [27, 25, 33, 26], // mid -> long link
  [34, 21, 41, 23], // long bend
  [38, 11, 41, 20], // upper long -> A
  [34, 17, 36, 19], [35, 20, 35, 20], // long side room (window onto long)
];
// Windows: a wall tile with a sill and a lintel - you can see and shoot through, but not walk through.
export const WINDOWS = [[13, 6], [13, 7], [20, 17], [20, 18], [37, 18]];
export const SILL_H = 1.1, LINTEL_Y = 2.3;
// Cover crates: [tileX, tileZ, height]. Low ones (0.95m) can be jumped onto.
const CRATES = [
  [6, 4, 1.9], [7, 4, 0.95], [6, 5, 0.95], [9, 7, 0.95], [10, 7, 1.9], [4, 8, 0.95],   // B site
  [35, 4, 1.9], [36, 5, 0.95], [33, 7, 0.95], [34, 7, 1.9], [39, 8, 0.95],              // A site
  [21, 3, 0.95], [19, 11, 1.9], [25, 12, 0.95], [16, 21, 0.95], [24, 26, 0.95],          // spawn + mid
  [17, 38, 1.9], [26, 38, 1.9], [6, 28, 0.95], [2, 24, 0.95], [4, 14, 0.95],            // T spawn, tunnels
  [36, 29, 1.9], [39, 22, 1.9], [39, 15, 0.95], [26, 30, 0.95],                          // long
];
// Extra props in tile units: [x, z, w, d, heightMetres, kind, baseMetres?]
const EXTRA = [
  // B site: raised deck with stairs + sandbags
  [2, 2, 2, 2, 1.8, 'deck'], [4, 2, 0.5, 2, 1.35, 'step'], [4.5, 2, 0.5, 2, 0.9, 'step'], [5, 2, 0.5, 2, 0.45, 'step'],
  [5.4, 5.2, 0.5, 0.5, 0.95, 'box'], [7, 9.45, 2, 0.4, 1.0, 'sandbag'], [11.3, 8.5, 0.35, 0.35, 1.1, 'barrel'],
  // A site: "heaven" - a tall platform with a staircase and railings that looks over the whole site
  [39, 1, 3, 3, 2.4, 'deck'],
  [38.5, 1, 0.5, 1.5, 2.0, 'step'], [38, 1, 0.5, 1.5, 1.6, 'step'], [37.5, 1, 0.5, 1.5, 1.2, 'step'], [37, 1, 0.5, 1.5, 0.8, 'step'], [36.5, 1, 0.5, 1.5, 0.4, 'step'],
  [39, 3.95, 3, 0.05, 3.35, 'rail', 2.4], [38.97, 2.5, 0.05, 1.5, 3.35, 'rail', 2.4],
  [37.2, 6.3, 0.5, 0.5, 0.95, 'box'], [32, 9.45, 2, 0.4, 1.0, 'sandbag'], [31.3, 2.3, 0.35, 0.35, 1.1, 'barrel'],
  // defender spawn + connectors
  [19, 4.5, 2, 0.4, 1.0, 'sandbag'], [14.3, 3.2, 0.35, 0.35, 1.1, 'barrel'], [28.6, 3.4, 0.35, 0.35, 1.1, 'barrel'],
  // mid
  [26.5, 10.4, 0.35, 0.35, 1.1, 'barrel'], [21.2, 18.6, 0.5, 0.5, 0.95, 'box'], [17.2, 16.2, 0.5, 0.5, 0.95, 'box'],
  [25.6, 21.3, 0.35, 0.35, 1.1, 'barrel'], [25.2, 23.3, 0.5, 0.5, 0.95, 'box'], [23.3, 29.5, 0.35, 0.35, 1.1, 'barrel'],
  [13.1, 11.2, 0.5, 0.5, 0.95, 'box'], [28.4, 11.3, 0.35, 0.35, 1.1, 'barrel'], [15.9, 6.2, 0.5, 0.5, 0.95, 'box'],
  // tunnels
  [3.5, 11.3, 0.5, 0.5, 0.95, 'box'], [2.2, 18.6, 0.35, 0.35, 1.1, 'barrel'], [12, 23.2, 0.5, 0.5, 0.95, 'box'], [8.6, 31, 0.35, 0.35, 1.1, 'barrel'],
  // long: raised corner platform with steps, cover
  [36, 32, 2, 2, 1.35, 'deck'], [36, 31.5, 2, 0.5, 0.9, 'step'], [36, 31, 2, 0.5, 0.45, 'step'],
  [34.3, 26.5, 0.35, 0.35, 1.1, 'barrel'], [30, 25.05, 0.4, 0.9, 1.0, 'sandbag'], [35, 21.2, 0.5, 0.5, 0.95, 'box'],
  [40.4, 12.2, 0.5, 0.5, 0.95, 'box'], [38.3, 19.5, 0.35, 0.35, 1.1, 'barrel'], [34.2, 17.2, 0.5, 0.5, 0.95, 'box'],
  // attacker side
  [17.5, 37.45, 0.5, 0.5, 0.95, 'box'], [25.5, 37.45, 0.5, 0.5, 0.95, 'box'], [6.5, 35.5, 0.35, 0.35, 1.1, 'barrel'],
  [14, 35.3, 0.5, 0.5, 0.95, 'box'], [33, 35.3, 0.5, 0.5, 0.95, 'box'], [36.4, 35.5, 0.35, 0.35, 1.1, 'barrel'],
  [12, 34.2, 2, 0.4, 1.0, 'sandbag'], [30, 34.2, 2, 0.4, 1.0, 'sandbag'],
];
// Props in world metres: { x0, z0, x1, z1, h, kind, y0 } - y0 > 0 for floating parts (lintels, railings)
export const PROPS = [
  ...CRATES.map(([x, z, h]) => ({ x0: (x + 0.03) * 2, z0: (z + 0.03) * 2, x1: (x + 0.97) * 2, z1: (z + 0.97) * 2, h, y0: 0, kind: h > 1.2 ? 'crateTall' : 'crate' })),
  ...EXTRA.map(([x, z, w, d, h, kind, y0 = 0]) => ({ x0: x * 2, z0: z * 2, x1: (x + w) * 2, z1: (z + d) * 2, h, y0, kind })),
  ...WINDOWS.flatMap(([x, z]) => [
    { x0: x * 2, z0: z * 2, x1: x * 2 + 2, z1: z * 2 + 2, h: SILL_H, y0: 0, kind: 'sill' },
    { x0: x * 2, z0: z * 2, x1: x * 2 + 2, z1: z * 2 + 2, h: WALL_H, y0: LINTEL_Y, kind: 'lintel' },
  ]),
];
export const SITES = {
  A: { x0: 32, z0: 2, x1: 40, z1: 9 },
  B: { x0: 3, z0: 2, x1: 11, z1: 9 },
};
export const SPAWNS = {
  D: [[19, 2], [21, 2], [23, 2], [25, 3], [18, 4]],
  T: [[19, 36], [21, 37], [22, 35], [23, 37], [25, 36]],
};
// Defender hold points per site (tile coords)
export const HOLDS = {
  A: [[34, 2], [40, 5], [32, 3], [38, 9], [35, 6]],
  B: [[3, 5], [8, 2], [11, 5], [5, 8], [8, 6]],
};

export function buildGrid() {
  const g = new Uint8Array(W * H).fill(1); // 1 = wall
  for (const [x0, z0, x1, z1] of FLOOR)
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) g[z * W + x] = 0;
  for (const [x, z] of WINDOWS) g[z * W + x] = 0; // opening: sill + lintel props make it see/shoot-through only
  return g;
}
export const GRID = buildGrid();
// Navigation grid for bots: walls + any tile a prop meaningfully covers.
export const NAV = (() => {
  const n = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) n[i] = GRID[i];
  for (const p of PROPS) {
    for (let tz = Math.floor(p.z0 / TILE); tz <= Math.floor((p.z1 - 1e-6) / TILE); tz++)
      for (let tx = Math.floor(p.x0 / TILE); tx <= Math.floor((p.x1 - 1e-6) / TILE); tx++) {
        const ox = Math.min(p.x1, (tx + 1) * TILE) - Math.max(p.x0, tx * TILE);
        const oz = Math.min(p.z1, (tz + 1) * TILE) - Math.max(p.z0, tz * TILE);
        if (ox * oz >= 0.4 && tx >= 0 && tz >= 0 && tx < W && tz < H) n[tz * W + tx] = 2;
      }
  }
  return n;
})();
export function navBlocked(tx, tz) {
  if (tx < 0 || tz < 0 || tx >= W || tz >= H) return true;
  return NAV[tz * W + tx] !== 0;
}

export function solidAt(tx, tz) {
  if (tx < 0 || tz < 0 || tx >= W || tz >= H) return true;
  return GRID[tz * W + tx] !== 0;
}
export function solidWorld(x, z) { return solidAt(Math.floor(x / TILE), Math.floor(z / TILE)); }
export function tileCenter(tx, tz) { return [tx * TILE + TILE / 2, tz * TILE + TILE / 2]; }
export function inSite(x, z) {
  const tx = x / TILE, tz = z / TILE;
  for (const k of ['A', 'B']) {
    const s = SITES[k];
    if (tx >= s.x0 && tx < s.x1 + 1 && tz >= s.z0 && tz < s.z1 + 1) return k;
  }
  return null;
}

// Circle-vs-world collision resolve (walls + props taller than a step above your feet).
export function moveCollide(x, z, dx, dz, r = PLAYER_R, y = 0) {
  let nx = x + dx;
  if (collides(nx, z, r, y)) nx = x;
  let nz = z + dz;
  if (collides(nx, nz, r, y)) nz = z;
  return [nx, nz];
}
export function collides(x, z, r, y = 0) {
  const minX = Math.floor((x - r) / TILE), maxX = Math.floor((x + r) / TILE);
  const minZ = Math.floor((z - r) / TILE), maxZ = Math.floor((z + r) / TILE);
  for (let tz = minZ; tz <= maxZ; tz++)
    for (let tx = minX; tx <= maxX; tx++) {
      if (!solidAt(tx, tz)) continue;
      const cx = Math.max(tx * TILE, Math.min(x, (tx + 1) * TILE));
      const cz = Math.max(tz * TILE, Math.min(z, (tz + 1) * TILE));
      if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
    }
  for (const p of PROPS) {
    if (p.h <= y + STEP || p.y0 >= y + PLAYER_H) continue;
    const cx = Math.max(p.x0, Math.min(x, p.x1)), cz = Math.max(p.z0, Math.min(z, p.z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}
// Height of whatever you would be standing on (props you can step onto from height y).
export function groundAt(x, z, r = PLAYER_R, y = 0) {
  let g = 0;
  const rr = r * 0.55;
  for (const p of PROPS) {
    if (p.h > y + STEP + 0.001 || p.h <= g || p.y0 > y + STEP) continue;
    const cx = Math.max(p.x0, Math.min(x, p.x1)), cz = Math.max(p.z0, Math.min(z, p.z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < rr * rr) g = p.h;
  }
  return g;
}
// Is a point inside solid geometry (walls or props)?
export function solidPoint(x, y, z) {
  if (y < WALL_H && solidWorld(x, z)) return true;
  for (const p of PROPS) if (y < p.h && y > p.y0 && x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) return true;
  return false;
}
export function propTop(x, z) {
  let g = 0;
  for (const p of PROPS) if (!p.y0 && x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1 && p.h > g) g = p.h;
  return g;
}
// Ray (unit dir) vs prop boxes; returns distance or maxD.
export function rayProps(o, d, maxD = 300) {
  let best = maxD;
  for (const p of PROPS) {
    let t0 = 0, t1 = best;
    const lo = [p.x0, p.y0, p.z0], hi = [p.x1, p.h, p.z1];
    let ok = true;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) { ok = false; break; } continue; }
      let a = (lo[i] - o[i]) / d[i], b = (hi[i] - o[i]) / d[i];
      if (a > b) { const tmp = a; a = b; b = tmp; }
      if (a > t0) t0 = a; if (b < t1) t1 = b;
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 < best && t0 > 0) best = t0;
  }
  return best;
}
// Clear 3D line of sight between two points (walls, props).
export function segClear(a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-6;
  if (!losClear(a[0], a[2], b[0], b[2])) return false;
  return rayProps(a, [dx / L, dy / L, dz / L], L) >= L - 0.05;
}

// 2D DDA ray vs grid; returns horizontal distance to first solid tile (or maxD).
export function rayGrid(ox, oz, dx, dz, maxD = 300) {
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return maxD;
  dx /= len; dz /= len;
  let tx = Math.floor(ox / TILE), tz = Math.floor(oz / TILE);
  const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDX = Math.abs(TILE / dx), tDZ = Math.abs(TILE / dz);
  let tMaxX = dx !== 0 ? ((dx > 0 ? (tx + 1) * TILE - ox : ox - tx * TILE) / Math.abs(dx)) : Infinity;
  let tMaxZ = dz !== 0 ? ((dz > 0 ? (tz + 1) * TILE - oz : oz - tz * TILE) / Math.abs(dz)) : Infinity;
  let t = 0;
  while (t < maxD) {
    if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDX; tx += stepX; }
    else { t = tMaxZ; tMaxZ += tDZ; tz += stepZ; }
    if (solidAt(tx, tz)) return t;
  }
  return maxD;
}
// 3D ray (unit dir) -> distance along ray to wall or floor.
export function rayWorld(o, d, maxD = 300) {
  const h = Math.hypot(d[0], d[2]);
  let t = h > 1e-6 ? rayGrid(o[0], o[2], d[0], d[2], maxD * h) / h : maxD;
  t = Math.min(t, rayProps(o, d, t));
  if (d[1] < 0) t = Math.min(t, o[1] / -d[1]);
  else if (d[1] > 0) { // above wall height = open sky, no hit beyond
    const tTop = (WALL_H - o[1]) / d[1];
    if (t > tTop) t = Math.min(maxD, t); // walls are capped; keep wall hit if below top
  }
  return Math.min(t, maxD);
}
export function losClear(ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az);
  return rayGrid(ax, az, bx - ax, bz - az, d + 0.01) >= d;
}
// Ray vs player hitbox. Returns {t, head} or null.
function cylHit(o, d, cx, cz, r, y0, y1, py) {
  const ox = o[0] - cx, oz = o[2] - cz;
  const a = d[0] * d[0] + d[2] * d[2];
  const b = 2 * (ox * d[0] + oz * d[2]);
  const c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (a < 1e-9 || disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
    if (t < 0) continue;
    const y = o[1] + d[1] * t - py;
    if (y >= y0 && y <= y1) return { t, y };
  }
  return null;
}
export function rayPlayer(o, d, p) {
  const H = (p.cr ?? p.crouch) ? PLAYER_H_CROUCH : PLAYER_H, r = PLAYER_R + 0.05;
  const ln = +(p.ln || 0);
  if (Math.abs(ln) < 0.05) { const h = cylHit(o, d, p.x, p.z, r, 0, H, p.y); return h ? { t: h.t, head: h.y > H - 0.38 } : null; }
  // leaning: legs stay put, torso + head shift sideways
  const split = H * 0.5, [lx, lz] = leanOff(p.yaw || 0, ln);
  const lo = cylHit(o, d, p.x, p.z, r, 0, split, p.y);
  const hi = cylHit(o, d, p.x + lx * 0.6, p.z + lz * 0.6, r, split, H - 0.38, p.y);
  const hd = cylHit(o, d, p.x + lx, p.z + lz, r * 0.85, H - 0.38, H + 0.02, p.y);
  let best = null;
  for (const [h, head] of [[lo, false], [hi, false], [hd, true]]) if (h && (!best || h.t < best.t)) best = { t: h.t, head };
  return best;
}

// A* over walkable tiles (8-dir, no corner cutting)
export function findPath(sx, sz, gx, gz) {
  if (navBlocked(gx, gz)) return null;
  const N = W * H, start = sz * W + sx, goal = gz * W + gx;
  const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const open = [start]; g[start] = 0;
  const f = new Float32Array(N).fill(Infinity);
  const hfn = (i) => { const x = i % W, z = (i / W) | 0; const dx = Math.abs(x - gx), dz = Math.abs(z - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  f[start] = hfn(start);
  let iter = 0;
  while (open.length && iter++ < 4000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
    const cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (cur === goal) {
      const path = []; let c = cur;
      while (c !== -1) { path.push([c % W, (c / W) | 0]); c = came[c]; }
      return path.reverse();
    }
    closed[cur] = 1;
    const cx = cur % W, cz = (cur / W) | 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (navBlocked(nx, nz)) continue;
      if (dx && dz && (navBlocked(cx + dx, cz) || navBlocked(cx, cz + dz))) continue;
      const ni = nz * W + nx;
      if (closed[ni]) continue;
      const ng = g[cur] + (dx && dz ? 1.414 : 1);
      if (ng < g[ni]) {
        if (g[ni] === Infinity) open.push(ni);
        g[ni] = ng; came[ni] = cur; f[ni] = ng + hfn(ni);
      }
    }
  }
  return null;
}
