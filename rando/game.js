"use strict";
/* La Rando Folle : course d'obstacles en pleine nature (3 manches, la dernière en élimination). */
{
const $ = s => document.querySelector(s), T = THREE, cv = $("#c");
const isTouch = matchMedia("(pointer:coarse)").matches;
const snd = n => window.SFX && window.SFX.play(n);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COLORS = [0xf472b6, 0x38bdf8, 0xfacc15, 0x4ade80, 0xa78bfa, 0xfb923c, 0xf87171, 0x2dd4bf];
const BOTN = ["Noisette", "Myrtille", "Pistache", "Caramel", "Prune", "Cerise", "Réglisse"];
const ROUNDS = [null, { name: "La Rivière", tip: "Saute de rondin en rondin, puis passe le pont des troncs qui roulent !" }, { name: "La Montagne", tip: "Esquive les rochers, passe sous les troncs qui balancent, cours sur le pont qui s'effondre !" }, { name: "Les Nénuphars", tip: "Les nénuphars coulent quand on marche dessus. Le dernier debout gagne !" }];
const R0 = 0.5, G = 24, SPEED = 6.4, JUMP = 9.2, ROUND_MS = 120000, FINAL_MS = 150000;

/* ---------- moteur 3D ---------- */
const renderer = new T.WebGLRenderer({ canvas: cv, antialias: !isTouch });
renderer.setPixelRatio(Math.min(isTouch ? 1.5 : 2, devicePixelRatio || 1));
if (!isTouch) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; }
const scene = new T.Scene(); scene.background = new T.Color(0x8fd3f7); scene.fog = new T.Fog(0xbfe6fb, 60, 160);
const camera = new T.PerspectiveCamera(62, 1, 0.1, 400);
scene.add(new T.HemisphereLight(0xffffff, 0x6b8e4e, 0.75));
const sun = new T.DirectionalLight(0xfff4dc, 0.9); sun.position.set(25, 50, 20);
if (!isTouch) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 }); sun.shadow.bias = -0.0006; }
scene.add(sun); scene.add(sun.target);
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
const MATS = {}; const M = (c, o = {}) => { const k = c + JSON.stringify(o); return MATS[k] || (MATS[k] = new T.MeshLambertMaterial(Object.assign({ color: c }, o))); };
const BOX = new T.BoxGeometry(1, 1, 1), SPH = new T.SphereGeometry(1, 18, 14), CYL = new T.CylinderGeometry(1, 1, 1, 16), CONE = new T.ConeGeometry(1, 1, 8);
function mesh(geo, mat, sh = true) { const m = new T.Mesh(geo, mat); m.castShadow = sh && !isTouch; m.receiveShadow = !isTouch; return m; }

/* ---------- monde : le niveau courant ---------- */
let level = null, world = new T.Group(); scene.add(world);
let seedN = 1; const srnd = () => { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; };
function addBox(L, x1, x2, y1, y2, z1, z2, col, opt = {}) {
  const b = { x1: Math.min(x1, x2), x2: Math.max(x1, x2), y1, y2, z1: Math.min(z1, z2), z2: Math.max(z1, z2), off: opt.off || null, on: opt.on || null, ice: opt.ice };
  if (!opt.hidden) { const m = opt.mesh || mesh(BOX, M(col)); if (!opt.mesh) { m.scale.set(b.x2 - b.x1, y2 - y1, b.z2 - b.z1); } m.userData.base = new T.Vector3((b.x1 + b.x2) / 2, (y1 + y2) / 2, (b.z1 + b.z2) / 2); m.position.copy(m.userData.base); world.add(m); b.mesh = m; }
  L.boxes.push(b); return b;
}
function tree(x, z, y = 0, s = 1) {
  const g = new T.Group(); const tr = mesh(CYL, M(0x7c4a21)); tr.scale.set(0.25 * s, 1.6 * s, 0.25 * s); tr.position.y = 0.8 * s; g.add(tr);
  const cols = [0x2f7d32, 0x3a9440, 0x2e6b2b]; for (let k = 0; k < 3; k++) { const c = mesh(CONE, M(cols[k])); c.scale.set((1.5 - k * 0.35) * s, 1.6 * s, (1.5 - k * 0.35) * s); c.position.y = (1.9 + k * 0.85) * s; g.add(c); }
  g.position.set(x, y, z); world.add(g); return g;
}
function flower(x, z, y = 0) { const c = [0xf472b6, 0xfacc15, 0xffffff, 0xa78bfa, 0xf87171][Math.floor(srnd() * 5)]; const s = mesh(CYL, M(0x4d7c0f), false); s.scale.set(0.03, 0.35, 0.03); s.position.set(x, y + 0.17, z); world.add(s); const h = mesh(SPH, M(c), false); h.scale.setScalar(0.12); h.position.set(x, y + 0.38, z); world.add(h); }
function rock(x, z, y, s, col = 0x9ca3af) { const r = mesh(new T.DodecahedronGeometry(1, 0), M(col)); r.scale.set(s, s * 0.7, s); r.position.set(x, y + s * 0.35, z); r.rotation.y = srnd() * 3; world.add(r); return r; }
function water(y, x1, x2, z1, z2) { const m = new T.Mesh(new T.PlaneGeometry(x2 - x1, z2 - z1, 1, 1), new T.MeshLambertMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })); m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); m.receiveShadow = !isTouch; world.add(m); level.waters.push(m); return m; }
function arch(z, y, w = 10) {
  const c = [0xf472b6, 0xfacc15, 0x38bdf8]; for (const sx of [-1, 1]) { const p = mesh(BOX, M(0xffffff)); p.scale.set(0.6, 5, 0.6); p.position.set(sx * w / 2, y + 2.5, z); world.add(p); }
  const top = mesh(BOX, M(0xf472b6)); top.scale.set(w + 0.6, 1, 0.8); top.position.set(0, y + 5.2, z); world.add(top);
  for (let i = 0; i < 12; i++) { const f = mesh(new T.ConeGeometry(0.35, 0.7, 3), M(c[i % 3]), false); f.position.set(-w / 2 + i * w / 11, y + 4.4, z); f.rotation.z = Math.PI; world.add(f); }
  // damier d'arrivée au sol
  for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) { const q = mesh(BOX, M((i + j) % 2 ? 0x111111 : 0xffffff), false); q.scale.set(w / 10, 0.02, 0.6); q.position.set(-w / 2 + w / 20 + i * w / 10, y + 0.01, z + (j - 0.5) * 0.6); world.add(q); }
}
function decorAround(zA, zB, y = -0.5) {
  for (let i = 0; i < 40; i++) { const z = zB + srnd() * (zA - zB), side = srnd() < 0.5 ? -1 : 1, x = side * (13 + srnd() * 22); tree(x, z, y + (srnd() * 0.5), 0.8 + srnd() * 0.8); }
  for (let i = 0; i < 12; i++) { const z = zB + srnd() * (zA - zB), side = srnd() < 0.5 ? -1 : 1; rock(side * (11 + srnd() * 25), z, y, 0.8 + srnd() * 1.6); }
}
function sky() {
  // montagnes au loin, nuages, soleil
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, r = 150 + srnd() * 30, h = 30 + srnd() * 40; const m = new T.Mesh(CONE, M(i % 2 ? 0x6b8f71 : 0x7fa388)); m.scale.set(30 + srnd() * 20, h, 30 + srnd() * 20); m.position.set(Math.cos(a) * r, h / 2 - 12, Math.sin(a) * r - 50); world.add(m); const s = new T.Mesh(CONE, M(0xffffff)); s.scale.set(m.scale.x * 0.3, h * 0.3, m.scale.z * 0.3); s.position.set(m.position.x, h - 12 - h * 0.15, m.position.z); world.add(s); }
  const cl = new T.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (let i = 0; i < 12; i++) { const g = new T.Group(); for (let k = 0; k < 4; k++) { const m = new T.Mesh(SPH, cl); m.scale.set(4 + srnd() * 4, 2 + srnd(), 3 + srnd() * 2); m.position.set(k * 4 - 6, srnd(), srnd() * 2); g.add(m); } g.position.set(-90 + srnd() * 180, 40 + srnd() * 20, -160 + srnd() * 180); world.add(g); level.clouds.push(g); }
  const sunM = new T.Mesh(new T.SphereGeometry(8, 16, 12), new T.MeshBasicMaterial({ color: 0xfff7c2, fog: false })); sunM.position.set(80, 90, -200); world.add(sunM);
  const meadow = mesh(BOX, M(0x6abf4b), false); meadow.scale.set(400, 1, 400); meadow.position.set(0, -9, -60); world.add(meadow);
}
function newLevel(r) {
  scene.remove(world); world = new T.Group(); scene.add(world); seedN = 1234 + r * 77;
  level = { r, boxes: [], planks: [], slopes: [], pads: [], rollers: [], boulders: [], pends: [], cps: [], finishZ: null, waters: [], clouds: [], deathY: -6, spawn: [] };
  sky();
  if (r === 1) buildRiver(); else if (r === 2) buildMountain(); else buildLake();
  return level;
}
/* manche 1 : la rivière */
function buildRiver() {
  const L = level; L.cps = [{ z: 0, y: 0 }, { z: -46, y: 0 }, { z: -84, y: 0 }]; L.finishZ = -97; L.deathY = -2.4;
  addBox(L, -8, 8, -1.2, 0, -18, 4, 0x6abf4b);
  for (let i = 0; i < 16; i++) flower(-7 + srnd() * 14, 3 - srnd() * 20);
  water(-1.1, -60, 60, -110, 10);
  // rangées de rondins flottants (certains glissent de gauche à droite)
  for (let i = 0; i < 8; i++) {
    const z = -20.6 - i * 2.75, mv = i % 3 === 1, ph = i * 1.7;
    const bob = t => [mv ? Math.sin(t * 0.7 + ph) * 2.6 : 0, Math.sin(t * 2 + i) * 0.12, 0];
    const parts = mv ? [[-6, -2], [2, 6]] : i % 3 === 2 ? [[-7, -0.6], [0.6, 7]] : [[-6, 6]];
    for (const [a, b] of parts) {
      const m = new T.Group(); const lg = mesh(CYL, M(0x8b5a2b)); lg.scale.set(0.7, b - a, 0.7); lg.rotation.z = Math.PI / 2; m.add(lg);
      const ring = mesh(CYL, M(0xd6a76a), false); ring.scale.set(0.6, 0.02, 0.6); ring.rotation.z = Math.PI / 2; ring.position.x = (b - a) / 2 + 0.01; m.add(ring);
      addBox(L, a, b, -0.7, 0, z - 0.65, z + 0.65, 0, { off: bob, mesh: m });
    }
  }
  addBox(L, -8, 8, -1.2, 0, -48, -42.6, 0x6abf4b); for (let i = 0; i < 6; i++) flower(-7 + srnd() * 14, -43.5 - srnd() * 3);
  // le pont et les troncs qui roulent vers toi
  addBox(L, -3, 3, -0.6, 0, -80, -48, 0xa16207);
  for (let z = -48.5; z > -80; z -= 1) { const p = mesh(BOX, M(z % 2 ? 0x92400e : 0xb45309), false); p.scale.set(6, 0.05, 0.9); p.position.set(0, 0.02, z); world.add(p); }
  for (const sx of [-3.1, 3.1]) { const r = mesh(BOX, M(0x78350f)); r.scale.set(0.15, 0.9, 32); r.position.set(sx, 0.45, -64); world.add(r); }
  L.rollers.push({ x1: -3, x2: 3, y: 0.5, r: 0.5, zFrom: -80, zTo: -48, speed: 3.6, spacing: 10.5 });
  addBox(L, -8, 8, -1.2, 0, -104, -80, 0x6abf4b);
  for (const [x, z] of [[-4, -88], [3, -86], [0, -92], [5, -93], [-5, -94]]) { rock(x, z, 0, 0.9, 0xa8a29e); addBox(L, x - 0.8, x + 0.8, 0, 1.2, z - 0.8, z + 0.8, 0, { hidden: true }); }
  arch(L.finishZ, 0);
  decorAround(10, -110, -1);
  for (let i = 0; i < 8; i++) L.spawn.push([-5.25 + (i % 4) * 3.5, 0, 1 + Math.floor(i / 4) * 2]);
}
/* manche 2 : la montagne */
function buildMountain() {
  const L = level; L.cps = [{ z: 0, y: 0 }, { z: -48, y: 6 }, { z: -77, y: 6 }]; L.finishZ = -112;
  addBox(L, -8, 8, -1.2, 0, -14, 4, 0x6abf4b);
  // la pente
  const sl = { x1: -6, x2: 6, z1: -44, z2: -14, yA: 6, yB: 0 }; L.slopes.push(sl);
  const len = Math.hypot(30, 6), sm = mesh(BOX, M(0x7aa95c)); sm.scale.set(12, 0.6, len); sm.position.set(0, 3 - 0.3, -29); sm.rotation.x = Math.atan2(6, 30); world.add(sm);
  for (let i = 0; i < 10; i++) { const z = -15 - srnd() * 28; rock(-6.8 + srnd() * 0.4, z, 0 + ((-14 - z) / 30) * 6 - 0.4, 0.6, 0x9ca3af); }
  L.boulders.push({ sl, lanes: [-3.6, 0, 3.6], r: 1.0, speed: 7, spacing: 13 });
  addBox(L, -6, 6, 5, 6, -52, -44, 0x8b9a7a);
  // corniche et troncs qui balancent
  addBox(L, -2.2, 2.2, 5, 6, -74, -52, 0x78716c);
  for (const [i, z] of [[0, -57], [1, -63], [2, -69]].map(x => x)) { L.pends.push({ px: 0, py: 13, pz: z, L: 6.2, A: 1.0, w: 1.3 + i * 0.2, ph: i * 1.9, r: 0.7 }); }
  for (const p of L.pends) { const piv = mesh(BOX, M(0x57534e)); piv.scale.set(9, 0.5, 0.5); piv.position.set(0, p.py, p.pz); world.add(piv); for (const sx of [-4.5, 4.5]) { const post = mesh(BOX, M(0x57534e)); post.scale.set(0.5, p.py - 5, 0.5); post.position.set(sx, 5 + (p.py - 5) / 2, p.pz); world.add(post); }
    const g = new T.Group(); const rope = mesh(CYL, M(0xd6d3d1), false); rope.scale.set(0.05, p.L - 1.6, 0.05); rope.position.y = -(p.L - 1.6) / 2; g.add(rope); const lg = mesh(CYL, M(0x8b5a2b)); lg.scale.set(p.r, 2.4, p.r); lg.position.y = -p.L + 0.8; g.add(lg); g.position.set(p.px, p.py, p.pz); world.add(g); p.mesh = g; }
  addBox(L, -6, 6, 5, 6, -80, -74, 0x8b9a7a);
  // pont qui s'effondre (en vague, le même pour tout le monde)
  for (let i = 0; i < 10; i++) {
    const z = -81 - i * 2, pl = { touched: -99 };
    const b = addBox(L, -2.5, 2.5, 5.2, 5.8, z - 0.9, z + 0.9, i % 2 ? 0xa16207 : 0xb45309, { off: t => { const k = t - pl.touched; return [0, k > 0.55 && k < 3.6 ? -(k - 0.55) * 9 : k > 0 && k <= 0.55 ? Math.sin(t * 60) * 0.06 : 0, 0]; }, on: t => { const k = t - pl.touched; return !(k > 0.55 && k < 3.6); } });
    b.plank = pl; pl.i = L.planks.length; L.planks.push(pl);
  }
  addBox(L, -8, 8, 5, 6, -122, -100, 0x8b9a7a);
  for (let i = 0; i < 6; i++) { const f = mesh(new T.ConeGeometry(0.6, 1.2, 3), M([0xf472b6, 0xfacc15, 0x38bdf8][i % 3]), false); f.position.set(-7 + i * 2.8, 6.6, -118); world.add(f); }
  arch(L.finishZ, 6);
  decorAround(8, -125, -1);
  for (let i = 0; i < 8; i++) L.spawn.push([-5.25 + (i % 4) * 3.5, 0, 1 + Math.floor(i / 4) * 2]);
}
/* manche 3 : les nénuphars */
function buildLake() {
  const L = level; L.cps = []; L.finishZ = null; L.deathY = -2.6;
  water(-3, -80, 80, -80, 60);
  for (const [layer, y] of [[0, 5], [1, 0]]) {
    for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) {
      const x = (q + r / 2) * 2.7, z = r * 2.35; if (Math.hypot(x, z) > 10.5) continue;
      const pad = { i: L.pads.length, x, y, z: z - 20, r: 1.55, touched: 0, gone: false, layer };
      const g = new T.Group(); const leaf = mesh(CYL, M(layer ? 0x22c55e : 0x4ade80)); leaf.scale.set(1.5, 0.25, 1.5); g.add(leaf);
      const notch = mesh(BOX, M(0x000000, { transparent: true, opacity: 0 }), false); g.add(notch);
      if ((q + r) % 3 === 0) { const fl = mesh(SPH, M(0xf9a8d4), false); fl.scale.set(0.3, 0.2, 0.3); fl.position.set(0.5, 0.2, 0.3); g.add(fl); }
      g.position.set(pad.x, y - 0.125, pad.z); world.add(g); pad.mesh = g; pad.leaf = leaf; L.pads.push(pad);
    }
  }
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; tree(Math.cos(a) * 30, Math.sin(a) * 30 - 20, -1.5, 1.2 + srnd()); }
  L.pads.filter(p => p.layer === 0).map(p => [p, Math.abs(Math.hypot(p.x, p.z + 20) - 5.4)]).sort((a, b) => a[1] - b[1]).slice(0, 8).forEach(([p]) => L.spawn.push([p.x, 5, p.z]));
}

/* ---------- surfaces et obstacles ---------- */
let tNow = 0; // secondes depuis le départ de la manche
function boxAt(b, t) { const o = b.off ? b.off(t) : null; return o ? { x1: b.x1 + o[0], x2: b.x2 + o[0], y1: b.y1 + o[1], y2: b.y2 + o[1], z1: b.z1 + o[2], z2: b.z2 + o[2], o } : { x1: b.x1, x2: b.x2, y1: b.y1, y2: b.y2, z1: b.z1, z2: b.z2, o: [0, 0, 0] }; }
function slopeY(s, x, z) { if (x < s.x1 || x > s.x2 || z < s.z1 || z > s.z2) return null; return s.yB + (s.yA - s.yB) * (s.z2 - z) / (s.z2 - s.z1); }
function supportBelow(x, y, z, t) { // plus haute surface sous le point, à moins de 3 m
  let best = -Infinity;
  for (const b of level.boxes) { if (b.on && !b.on(t)) continue; const a = boxAt(b, t); if (x > a.x1 && x < a.x2 && z > a.z1 && z < a.z2 && a.y2 <= y + 0.3 && a.y2 > best) best = a.y2; }
  for (const s of level.slopes) { const h = slopeY(s, x, z); if (h !== null && h <= y + 0.6 && h > best) best = h; }
  for (const p of level.pads) { if (p.gone) continue; if (Math.hypot(x - p.x, z - p.z) < p.r && p.y <= y + 0.3 && p.y > best) best = p.y; }
  return best > y - 3 ? best : null;
}
function rollerPos(R, k, t) { const span = R.zTo - R.zFrom, n = Math.floor(span / R.spacing); return R.zFrom + (((t * R.speed + k * R.spacing) % (n * R.spacing)) + n * R.spacing) % (n * R.spacing); }
function boulderPos(B, lane, k, t) { const s = B.sl, span = s.z2 - s.z1, n = Math.max(1, Math.floor(span / B.spacing)); const d = (((t * B.speed + k * B.spacing + lane * 4.3) % (n * B.spacing)) + n * B.spacing) % (n * B.spacing); return s.z1 + d; }
function pendAngle(p, t) { return p.A * Math.sin(t * p.w + p.ph); }

/* ---------- les petites grenouilles ---------- */
function makeFurball(col, name) {
  const g = new T.Group(), body = new T.Group(); g.add(body);
  const light = new T.Color(col).lerp(new T.Color(0xffffff), 0.55).getHex(), dark = new T.Color(col).multiplyScalar(0.7).getHex();
  // corps rond et un peu aplati, ventre clair
  const b = mesh(SPH, M(col)); b.scale.set(0.5, 0.42, 0.52); b.position.y = 0.5; body.add(b);
  const belly = mesh(SPH, M(light), false); belly.scale.set(0.38, 0.3, 0.3); belly.position.set(0, 0.42, 0.26); body.add(belly);
  // tête large avec la grande bouche
  const head = mesh(SPH, M(col)); head.scale.set(0.46, 0.32, 0.4); head.position.set(0, 0.82, 0.12); body.add(head);
  const mouth = mesh(new T.TorusGeometry(0.22, 0.025, 6, 16, Math.PI), new T.MeshBasicMaterial({ color: 0x3f1d1d }), false); mouth.rotation.set(0, 0, Math.PI); mouth.position.set(0, 0.8, 0.5); mouth.scale.set(1, 0.55, 1); body.add(mouth);
  for (const sx of [-1, 1]) {
    // gros yeux sur le dessus de la tête
    const lid = mesh(SPH, M(col)); lid.scale.setScalar(0.15); lid.position.set(sx * 0.2, 1.05, 0.14); body.add(lid);
    const eye = mesh(SPH, M(0xffffff), false); eye.scale.setScalar(0.12); eye.position.set(sx * 0.2, 1.08, 0.22); body.add(eye);
    const pup = mesh(SPH, new T.MeshBasicMaterial({ color: 0x111111 }), false); pup.scale.set(0.06, 0.07, 0.04); pup.position.set(sx * 0.2, 1.08, 0.32); body.add(pup);
    const shine = mesh(SPH, new T.MeshBasicMaterial({ color: 0xffffff }), false); shine.scale.setScalar(0.022); shine.position.set(sx * 0.2 + 0.03, 1.12, 0.35); body.add(shine);
    const cheek = mesh(SPH, M(0xf9a8d4), false); cheek.scale.set(0.07, 0.04, 0.03); cheek.position.set(sx * 0.3, 0.78, 0.42); body.add(cheek);
    // pattes avant
    const arm = mesh(SPH, M(col), false); arm.scale.set(0.09, 0.2, 0.09); arm.position.set(sx * 0.32, 0.28, 0.28); body.add(arm);
    const hand = mesh(SPH, M(light), false); hand.scale.set(0.11, 0.04, 0.12); hand.position.set(sx * 0.34, 0.1, 0.34); body.add(hand);
  }
  // taches sur le dos
  for (const [x, y, z, r] of [[0.15, 0.75, -0.3, 0.08], [-0.2, 0.62, -0.38, 0.06], [0.05, 0.92, -0.18, 0.05]]) { const sp = mesh(SPH, M(dark), false); sp.scale.setScalar(r); sp.position.set(x, y, z); body.add(sp); }
  // pattes arrière (elles bougent quand on court)
  const feet = []; for (const sx of [-1, 1]) { const leg = new T.Group(); const th = mesh(SPH, M(col), false); th.scale.set(0.14, 0.12, 0.24); th.position.set(0, 0.16, -0.05); leg.add(th); const ft = mesh(SPH, M(light), false); ft.scale.set(0.13, 0.04, 0.2); ft.position.set(0, 0.03, 0.12); leg.add(ft); leg.position.set(sx * 0.33, 0, -0.1); g.add(leg); feet.push(leg); }
  // étiquette du nom
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x = c.getContext("2d"); x.font = "800 34px Inter, sans-serif"; x.textAlign = "center"; const w = Math.min(250, x.measureText(name).width + 28);
  x.fillStyle = "#000000a0"; x.beginPath(); x.roundRect ? x.roundRect(128 - w / 2, 8, w, 48, 16) : x.rect(128 - w / 2, 8, w, 48); x.fill(); x.fillStyle = "#fff"; x.fillText(name, 128, 44);
  const tag = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false, transparent: true })); tag.scale.set(1.6, 0.4, 1); tag.position.y = 1.65; g.add(tag);
  scene.add(g); return { g, body, feet, tag };
}

/* ---------- les coureurs ---------- */
let runners = [], me = null, mode = "menu", roundN = 1, roundAt = 0, phase = "idle", clock = () => Date.now(), qualified = [], soloRoster = [], finishOrder = [], outOrder = [];
const L = window.LOBBY, X = L && L.ctx;
function makeRunner(o, i) {
  const r = Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ry: Math.PI, ground: false, dive: 0, stun: 0, cp: 0, fin: 0, out: 0, walk: 0, jumpQ: false, ai: { t: 0, tx: 0, wait: 0, pad: null }, color: COLORS[i % 8] }, o);
  r.model = makeFurball(r.color, r.local ? "TOI" : r.name);
  return r;
}
function placeAtSpawn(r, i) { const s = level.spawn[i % level.spawn.length]; r.x = s[0]; r.y = s[1] + 0.05; r.z = s[2]; r.vx = r.vy = r.vz = 0; r.cp = 0; r.fin = 0; r.out = 0; r.dive = 0; r.stun = 0; r.ry = Math.PI; }
function respawn(r) { const cp = level.cps[r.cp] || level.cps[0]; r.x = (Math.random() - 0.5) * 4; r.y = cp.y + 2; r.z = cp.z; r.vx = r.vy = r.vz = 0; r.stun = 0.3; r.dive = 0; if (r.local) { snd("splash"); flash("Plouf !", "Retour au dernier point de passage", 1.2); } }

function physics(r, ix, iz, jump, dive, dt, t) {
  if (r.out || r.fin) { if (r.fin) { r.vx *= 0.9; r.vz *= 0.9; } }
  const ctrl = r.stun > 0 ? 0.15 : r.dive > 0 ? 0.1 : r.ground ? 1 : 0.55;
  const tvx = ix * SPEED, tvz = iz * SPEED, k = Math.min(1, dt * (r.ground ? 12 : 4) * ctrl);
  r.vx += (tvx - r.vx) * k; r.vz += (tvz - r.vz) * k;
  if (ix || iz) r.ry = Math.atan2(ix, iz);
  if (jump && r.ground && r.dive <= 0 && r.stun <= 0) { r.vy = JUMP; r.ground = false; if (r.bot) { r.vx = tvx; r.vz = tvz; } if (r.local) snd("jump"); }
  if (dive && r.dive <= 0 && r.stun <= 0) { r.dive = 0.7; const f = Math.hypot(r.vx, r.vz) > 0.5 ? 1 : 0; const dx = Math.sin(r.ry), dz = Math.cos(r.ry); r.vx = dx * 9.5; r.vz = dz * 9.5; if (r.ground) r.vy = 4; if (r.local) snd("dash"); }
  r.dive = Math.max(0, r.dive - dt); r.stun = Math.max(0, r.stun - dt);
  r.vy -= G * dt; if (r.vy < -30) r.vy = -30;
  r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt;
  r.ground = false;
  // boîtes (fixes ou mobiles) : on se pose dessus, on est porté par celles qui bougent
  for (const b of level.boxes) {
    if (b.on && !b.on(t)) continue;
    const a = boxAt(b, t), cx = Math.max(a.x1, Math.min(r.x, a.x2)), cy = Math.max(a.y1, Math.min(r.y + R0, a.y2)), cz = Math.max(a.z1, Math.min(r.z, a.z2));
    const dx = r.x - cx, dy = r.y + R0 - cy, dz = r.z - cz, d = Math.hypot(dx, dy, dz);
    if (d >= R0 || (d === 0 && !(r.y + R0 > a.y1 && r.y < a.y2))) continue;
    if (dy > 0.25 * d || (d === 0)) { // dessus
      if (r.vy <= 0.5) { r.y = a.y2; if (r.vy < 0) r.vy = 0; r.ground = true; if (b.plank && (r.local || r.bot) && t - b.plank.touched > 3.6) { b.plank.touched = t; if (mode === "mp") X.ev({ type: "plank", i: b.plank.i, tt: +t.toFixed(2), round: roundN }); } if (b.off) { const p = boxAt(b, t - dt).o; r.x += a.o[0] - p[0]; r.z += a.o[2] - p[2]; } }
    } else { const nx = dx / (d || 1), nz = dz / (d || 1), ny = dy / (d || 1); r.x += nx * (R0 - d); r.z += nz * (R0 - d); r.y += ny * (R0 - d); const vn = r.vx * nx + r.vz * nz; if (vn < 0) { r.vx -= vn * nx; r.vz -= vn * nz; } if (ny < -0.6 && r.vy > 0) r.vy = 0; }
  }
  for (const s of level.slopes) { const h = slopeY(s, r.x, r.z); if (h !== null && r.y < h && r.y > h - 1.2 && r.vy <= 0.5) { r.y = h; r.vy = 0; r.ground = true; } }
  for (const p of level.pads) { if (p.gone) continue; const py = p.y + p.sink; if (Math.hypot(r.x - p.x, r.z - p.z) < p.r + 0.1 && r.y < py && r.y > py - 0.9 && r.vy <= 0.5) { r.y = py; r.vy = 0; r.ground = true; if (!p.touched && (r.local || r.bot)) touchPad(p); } }
  // troncs qui roulent
  for (const R of level.rollers) { const n = Math.floor((R.zTo - R.zFrom) / R.spacing); for (let kk = 0; kk < n; kk++) { const lz = rollerPos(R, kk, t); if (lz < R.zFrom + 1.4 || r.x < R.x1 - 0.3 || r.x > R.x2 + 0.3) continue; const dy = r.y + R0 - R.y, dz = r.z - lz, d = Math.hypot(dy, dz); if (d < R.r + R0) { const nz = dz / (d || 1), ny = dy / (d || 1); r.z += nz * (R.r + R0 - d); r.y += Math.max(0, ny) * (R.r + R0 - d); r.vz = R.speed + 4; r.vy = Math.max(r.vy, 5); r.stun = 0.6; r.ground = false; if (r.local) { snd("hit"); shake = 0.5; } } } }
  // rochers
  for (const B of level.boulders) { const s = B.sl, n = Math.max(1, Math.floor((s.z2 - s.z1) / B.spacing)); B.lanes.forEach((lx, li) => { for (let kk = 0; kk < n; kk++) { const bz = boulderPos(B, li, kk, t), by = slopeY(s, lx, bz) + B.r; const dx = r.x - lx, dy = r.y + R0 - by, dz = r.z - bz, d = Math.hypot(dx, dy, dz); if (d < B.r + R0) { r.vx = dx / (d || 1) * 7; r.vz = B.speed + 3; r.vy = 7; r.stun = 0.8; r.ground = false; if (r.local) { snd("hit"); shake = 0.7; } } } }); }
  // troncs qui balancent
  for (const P of level.pends) { const a = pendAngle(P, t), bx = P.px + Math.sin(a) * (P.L - 0.8), by = P.py - Math.cos(a) * (P.L - 0.8), dx = r.x - bx, dy = r.y + R0 - by, dz = r.z - P.pz; if (Math.abs(dz) < 1.2 + R0 && Math.abs(dy) < 1.2 + R0 && Math.abs(dx) < P.r + R0) { const w = Math.cos(t * P.w + P.ph); r.vx = (w >= 0 ? 1 : -1) * 8; r.vy = 4.5; r.stun = 0.7; r.ground = false; if (r.local) { snd("hit"); shake = 0.8; } } }
  // bousculade entre coureurs
  for (const o of runners) { if (o === r || o.out || !o.model.g.visible) continue; const dx = r.x - o.x, dz = r.z - o.z, d = Math.hypot(dx, dz); if (d < 0.9 && d > 0.001 && Math.abs(r.y - o.y) < 0.9) { const p = (0.9 - d) / 2; r.x += dx / d * p; r.z += dz / d * p; if (o.dive > 0.3 && r.dive <= 0) { r.vx += o.vx * 0.6; r.vz += o.vz * 0.6; r.stun = 0.4; } } }
  // points de passage, chute
  level.cps.forEach((c, i) => { if (i > r.cp && r.z < c.z + 1 && r.ground) r.cp = i; });
  if (r.y < level.deathY) { if (roundN === 3) { if (!r.out) eliminate(r); } else respawn(r); }
  r.walk += Math.hypot(r.vx, r.vz) * dt * 2.2;
}
function eliminate(r) {
  r.out = clock(); outOrder.push(r.id);
  if (r.local) { snd("lose"); flash("ÉLIMINÉ", "Tu regardes la fin de la finale", 2.2); if (mode === "mp") X.setScore({ out: 3, ot: Math.round(clock()) }); }
}
function touchPad(p) { p.touched = clock(); if (mode === "mp") X.ev({ type: "pad", i: p.i, at: Math.round(clock()), round: roundN }); }

/* ---------- robots ---------- */
function botThink(r, t, dt) {
  const a = r.ai; a.t -= dt;
  let ix = 0, iz = -1, jump = false, dive = false;
  if (r.fin || r.out) return [0, 0, false, false];
  if (roundN === 3) {
    // choisir un nénuphar encore solide, pas trop loin, sur la même couche
    if (!a.pad || a.pad.gone || a.pad.touched || a.t <= 0) {
      const cand = level.pads.filter(p => !p.gone && !p.touched && Math.abs(p.y - r.y) < 1 && Math.hypot(p.x - r.x, p.z - r.z) < 5.5 && Math.hypot(p.x - r.x, p.z - r.z) > 1);
      a.pad = cand.length ? cand[Math.floor(Math.random() * cand.length)] : level.pads.filter(p => !p.gone && !p.touched).sort((p, q) => Math.hypot(p.x - r.x, p.z - r.z) - Math.hypot(q.x - r.x, q.z - r.z))[0]; a.t = 0.6 + Math.random() * 0.8;
    }
    if (a.pad) { const dx = a.pad.x - r.x, dz = a.pad.z - r.z, d = Math.hypot(dx, dz) || 1; ix = dx / d; iz = dz / d; const gap = supportBelow(r.x + ix * 1.1, r.y + 0.1, r.z + iz * 1.1, t) === null; if (gap && Math.abs(a.pad.y - r.y) < 1 && r.ground && Math.random() < 0.9) jump = true; }
    return [ix, iz, jump, false];
  }
  // suivre le milieu du parcours : repérer le bord et l'appui suivant
  if (!r.ground && a.jv) return [0, -a.jv, false, false];
  {
    a.jv = 0; let edge = null, land = null;
    for (let d = 0.25; d <= 5.5; d += 0.25) { const sup = supportBelow(r.x, r.y + 0.3, r.z - d, edge === null ? t : t + 0.7); if (edge === null) { if (sup === null) edge = d; } else if (sup !== null) { land = d; break; } }
    if (edge !== null && edge <= 0.55) {
      if (land !== null && land - edge <= 3.3) { jump = true; a.jv = Math.min(1, (land + 0.6) / 0.77 / SPEED); iz = -a.jv; a.wait = 0; a.side = 0; return [0, iz, true, false]; }
      else {
        // pas d'appui en face : chercher sur le côté un endroit où sauter
        iz = 0; a.wait += dt;
        if (!a.side) { let best = null; for (const off of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) { const x2 = r.x + off; if (supportBelow(x2, r.y + 0.3, r.z, t) === null) continue; for (let d = edge; d <= 4; d += 0.25) if (supportBelow(x2, r.y + 0.3, r.z - d, t + 0.7) !== null) { best = off; break; } if (best !== null) break; } a.side = best === null ? 0 : best > 0 ? 1 : -1; a.sideT = 0.5; }
        if (a.side) { ix = a.side; a.sideT -= dt; if (a.sideT <= 0) a.side = 0; }
        if (a.wait > 2.5) { jump = true; a.jv = 1; a.wait = 0; }
      }
    }
  }
  // obstacles qui arrivent
  for (const R of level.rollers) { const n = Math.floor((R.zTo - R.zFrom) / R.spacing); for (let kk = 0; kk < n; kk++) { const dz = r.z - rollerPos(R, kk, t), ttc = (dz - R.r - R0) / (R.speed + Math.max(1, -r.vz)); if (ttc > 0.05 && ttc < 0.16 + r.ai.react * 0.12 && r.x > R.x1 - 0.5 && r.x < R.x2 + 0.5 && r.ground) { jump = true; a.jv = 0.7; iz = -0.7; } } }
  for (const B of level.boulders) { const n = Math.max(1, Math.floor((B.sl.z2 - B.sl.z1) / B.spacing)); B.lanes.forEach((lx, li) => { for (let kk = 0; kk < n; kk++) { const bz = boulderPos(B, li, kk, t); if (Math.abs(r.x - lx) < 1.7 && r.z - bz > 0 && r.z - bz < 5) ix += (r.x >= lx ? 1 : -1) * 1.2; } }); }
  for (const P of level.pends) { const dz = r.z - P.pz; if (dz > 0.8 && dz < 2.8) { let hit = false; for (let k = 0.1; k <= 0.75; k += 0.1) { const bx = P.px + Math.sin(pendAngle(P, t + k)) * (P.L - 0.8); if (Math.abs(bx - r.x) < 1.5) hit = true; } if (hit) iz = 0.2; else iz = -1; } }
  // revenir vers le centre et suivre l'appui
  const tx = a.tx; if (!a.side) ix += (tx - r.x) * 0.4; else a.tx = r.x; if (t > a.t) { a.tx = (Math.random() - 0.5) * (roundN === 2 && r.z < -50 && r.z > -100 ? 0.6 : 4); a.t = t + 1 + Math.random() * 2; }
  const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; }
  if (Math.random() < 0.002 && r.ground) dive = true;
  const sp = a.jv ? 1 : r.ai.sp;
  return [ix * sp, iz * sp, jump, dive];
}

/* ---------- commandes ---------- */
const keys = new Set(), mv = { x: 0, y: 0 }; let jumpBtn = false, diveBtn = false;
addEventListener("keydown", e => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault(); keys.add(e.code); if (e.code === "Space") jumpBtn = true; if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyE") diveBtn = true; });
addEventListener("keyup", e => keys.delete(e.code));
const stick = $("#stick"), knob = $("#knob"); let sid = null, sc = null;
stick.addEventListener("pointerdown", e => { e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); sc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; smove(e); });
stick.addEventListener("pointermove", e => { if (e.pointerId === sid) smove(e); });
const sEnd = e => { if (e.pointerId !== sid) return; sid = null; mv.x = mv.y = 0; knob.style.transform = ""; };
stick.addEventListener("pointerup", sEnd); stick.addEventListener("pointercancel", sEnd);
function smove(e) { let dx = e.clientX - sc.x, dy = e.clientY - sc.y; const d = Math.hypot(dx, dy), m = Math.min(d, 46); if (d > 0) { dx = dx / d * m; dy = dy / d * m; } knob.style.transform = `translate(${dx}px,${dy}px)`; mv.x = dx / 46; mv.y = dy / 46; }
$("#tjump").addEventListener("pointerdown", e => { e.preventDefault(); jumpBtn = true; });
$("#tdive").addEventListener("pointerdown", e => { e.preventDefault(); diveBtn = true; });
function inputs() {
  let ix = mv.x + (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("KeyQ") ? 1 : 0);
  let iz = mv.y + (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("KeyW") || keys.has("KeyZ") ? 1 : 0);
  const m = Math.hypot(ix, iz); if (m > 1) { ix /= m; iz /= m; }
  const j = jumpBtn, d = diveBtn; jumpBtn = diveBtn = false; return [ix, iz, j, d];
}

/* ---------- interface ---------- */
let fl = 0, shake = 0;
function flash(a, b, s = 1.6) { $("#banner").textContent = a; $("#sub").textContent = b || ""; fl = s; }
const MENU = $("#panel").innerHTML;
function showPanel(h) { $("#panel").hidden = false; $("#panel").innerHTML = h; }
function bindMenu() { $("#solo").onclick = soloStart; $("#multi").onclick = () => { $("#panel").hidden = true; L.menu(); }; }
bindMenu();
const fmt = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const qualCount = n => (n <= 2 ? n : Math.max(2, Math.ceil(n * 0.66)));
function hud() {
  if (phase === "idle") { $("#round").textContent = ""; $("#info").textContent = ""; return; }
  const T2 = clock(), lim = roundN === 3 ? FINAL_MS : ROUND_MS, left = Math.max(0, roundAt + lim - Math.max(T2, roundAt));
  $("#round").textContent = phase === "idle" ? "" : `Manche ${roundN} · ${ROUNDS[roundN].name}`;
  const alive = runners.filter(r => r.model.g.visible);
  if (roundN === 3) $("#info").textContent = `${alive.filter(r => !r.out).length} encore debout · ${fmt(left)}`;
  else $("#info").textContent = `Qualifiés ${finishOrder.length} / ${qualCount(alive.length)} · ${fmt(left)}`;
}

/* ---------- déroulé d'une manche ---------- */
function setupRound(r, roster, at) {
  for (const x of runners) scene.remove(x.model.g);
  roundN = r; roundAt = at; newLevel(r); finishOrder = []; outOrder = [];
  runners = roster.map((o, i) => makeRunner(o, o.ci ?? i));
  runners.forEach((x, i) => placeAtSpawn(x, i));
  me = runners.find(x => x.local) || null;
  phase = "play"; lastCount = 9;
  flash(`Manche ${r}`, ROUNDS[r].tip, 3.2);
}
function onFinish(r) {
  if (r.fin) return; r.fin = clock(); finishOrder.push(r.id);
  if (r.local) { snd("finish"); flash("QUALIFIÉ !", `${finishOrder.length}e place`, 2.2); if (mode === "mp") X.setScore({ fin: roundN, ft: Math.round(clock()) }); }
}
// solo
function soloStart() {
  mode = "solo"; clock = () => Date.now(); $("#panel").hidden = true;
  const name = (window.ONLINE && window.ONLINE.profile && window.ONLINE.profile.pseudo) || "Toi";
  soloRoster = [{ id: "me", name, local: true, ci: 0 }].concat(BOTN.map((n, i) => ({ id: "bot" + i, name: n, bot: true, ci: i + 1, ai: { t: 0, tx: 0, wait: 0, pad: null, sp: 0.78 + Math.random() * 0.2, react: Math.random() * 0.8 } })));
  setupRound(1, soloRoster, Date.now() + 3500);
}
function soloTick() {
  const T2 = clock(), lim = roundN === 3 ? FINAL_MS : ROUND_MS, n = runners.length;
  if (phase !== "play" || T2 < roundAt) return;
  if (roundN < 3) {
    const q = qualCount(n);
    if (finishOrder.length >= q || T2 > roundAt + lim || (me && !me.fin && false)) {
      phase = "over"; const qual = finishOrder.slice(0, q);
      if (qual.length < 2) { const rest = runners.filter(r => !qual.includes(r.id)).sort((a, b) => a.z - b.z); while (qual.length < 2 && rest.length) qual.push(rest.shift().id); }
      const meQ = qual.includes("me");
      flash(meQ ? "Manche terminée" : "ÉLIMINÉ", meQ ? "Tu passes à la manche suivante !" : "Tu n'as pas fini à temps…", 3);
      setTimeout(() => { if (mode !== "solo") return; if (!meQ) return soloEnd(false, roundN); setupRound(roundN + 1, soloRoster.filter(o => qual.includes(o.id)), Date.now() + 3500); }, 3500);
    }
  } else {
    const alive = runners.filter(r => !r.out);
    if (alive.length <= 1 || T2 > roundAt + lim || (me && me.out && T2 - me.out > 2500 && alive.length <= 3)) {
      phase = "over"; const w = alive.length ? alive.sort((a, b) => b.y - a.y)[0] : runners.find(r => r.id === outOrder[outOrder.length - 1]);
      const won = w && w.local; flash(won ? "TU GAGNES !" : `${w ? w.name : "Personne"} gagne`, won ? "La couronne des Nénuphars est à toi" : "", 3.2); snd(won ? "win" : "lose");
      setTimeout(() => mode === "solo" && soloEnd(won, 3), 3200);
    }
  }
}
function soloEnd(won, reached) {
  phase = "idle"; mode = "menu";
  if (window.ONLINE) window.ONLINE.submit("rando", g => Object.assign(g, { soloGames: (g.soloGames || 0) + 1, soloWins: (g.soloWins || 0) + (won ? 1 : 0), finals: (g.finals || 0) + (reached >= 3 ? 1 : 0), quals: (g.quals || 0) + reached - 1 }));
  showPanel(`<h1>${won ? "Victoire !" : reached >= 3 ? "Finaliste !" : "Éliminé"}</h1><p>${won ? "Tu as gagné la couronne de la Rando Folle." : reached >= 3 ? "Tu as atteint la finale des Nénuphars." : `Tu t'arrêtes à la manche ${reached} : ${ROUNDS[reached].name}.`}</p><button class="btn" id="again">Rejouer</button><br><button class="ghost" id="tomenu">Menu</button>`);
  $("#again").onclick = soloStart; $("#tomenu").onclick = () => { showPanel(MENU); bindMenu(); };
}

/* ---------- multijoueur ---------- */
let liveT = 0, curRound = 0, mpBest = 0;
function writeLive() { if (mode !== "mp" || !me) return; X.setLive({ x: +me.x.toFixed(2), y: +me.y.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2), d: me.dive > 0 ? 1 : 0, r: roundN, o: me.out ? 1 : 0, w: +me.walk.toFixed(1) }); }
function syncRemote(dt) { for (const r of runners) { if (r.local) continue; const l = X.live[r.id]; if (!l || l.r !== roundN) continue; const k = Math.min(1, dt * 12); r.x += (l.x - r.x) * k; r.y += (l.y - r.y) * k; r.z += (l.z - r.z) * k; r.ry = l.ry; r.dive = l.d ? 0.3 : 0; r.walk = l.w; if (l.o && !r.out) { r.out = clock(); outOrder.push(r.id); } } }
function onState(ctx) {
  const st = ctx.state; if (mode !== "mp" || !st) return;
  if (st.round !== curRound) {
    curRound = st.round;
    const roster = (st.alive || []).map(id => ({ id, name: (ctx.players[id] || ctx.score[id] || {}).pseudo || "?", local: id === ctx.uid, ci: (st.all || []).indexOf(id) }));
    setupRound(st.round, roster, st.at);
    if (!me) flash(`Manche ${st.round}`, "Tu es éliminé : tu regardes la course", 3);
    mpBest = Math.max(mpBest, me ? st.round : 0); writeLive();
  }
  if (st.phase === "over" && phase === "play") { phase = "over"; const q = st.qual || [], meQ = me && q.includes(X.uid); if (st.round < 3) flash(me ? (meQ ? "Manche terminée" : "ÉLIMINÉ") : "Manche terminée", meQ ? "Tu passes à la manche suivante !" : `${q.length} qualifiés`, 3); }
}
function onEvent(e, ctx) {
  if (mode !== "mp" || e.from === ctx.uid || e.round !== roundN) return;
  if (e.type === "pad") { const p = level.pads[e.i]; if (p && !p.touched) p.touched = e.at; }
  if (e.type === "plank") { const p = level.planks[e.i]; if (p && e.tt - p.touched > 3.6) p.touched = e.tt; }
}
function hostTick() {
  if (!X.isHost()) return; const st = X.state; if (!st || st.phase !== "play") { if (st && st.phase === "over" && clock() > st.overAt + 4000) next(st); return; }
  const T2 = clock(); if (T2 < st.at) return;
  const alive = (st.alive || []).filter(id => X.players[id]), lim = st.round === 3 ? FINAL_MS : ROUND_MS;
  if (st.round < 3) {
    const fins = alive.filter(id => X.score[id] && X.score[id].fin === st.round).sort((a, b) => X.score[a].ft - X.score[b].ft), q = qualCount(alive.length);
    if (fins.length >= q || T2 > st.at + lim) {
      const qual = fins.slice(0, q); if (qual.length < 2) { const rest = alive.filter(id => !qual.includes(id)).sort((a, b) => ((X.live[a] || {}).z ?? 99) - ((X.live[b] || {}).z ?? 99)); while (qual.length < 2 && rest.length) qual.push(rest.shift()); }
      X.updState({ phase: "over", qual, overAt: Math.round(T2) });
    }
  } else {
    const up = alive.filter(id => !(X.score[id] && X.score[id].out === 3) && !((X.live[id] || {}).o && (X.live[id] || {}).r === 3));
    if (up.length <= 1 || T2 > st.at + lim) { const w = up[0] || alive.filter(id => X.score[id] && X.score[id].out === 3).sort((a, b) => X.score[b].ot - X.score[a].ot)[0] || ""; X.updState({ phase: "over", qual: [w], overAt: Math.round(T2) }); }
  }
}
let nextDone = 0;
function next(st) { if (nextDone === st.round) return; nextDone = st.round; if (st.round >= 3) { X.end({ winner: (st.qual || [])[0] || "", reached: st.reachedMap || null }); return; } X.setState({ round: st.round + 1, at: Math.round(clock() + 4000), phase: "play", alive: st.qual, all: st.all, qual: [] }); }
if (L) L.init({
  id: "rando", title: "La Rando Folle", min: 2, max: 8,
  initState: (ctx, sd) => { const all = Object.entries(ctx.players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)).slice(0, 8).map(x => x[0]); return { round: 1, at: Math.round(ctx.now() + 4000), phase: "play", alive: all, all, qual: [] }; },
  onStart(ctx) { mode = "mp"; clock = ctx.now; curRound = 0; nextDone = 0; mpBest = 1; $("#panel").hidden = true; ctx.setScore({ fin: 0 }); if (ctx.state) onState(ctx); },
  onState, onEvent,
  onEnd(ctx) {
    const won = ctx.meta.winner === ctx.uid;
    if (window.ONLINE) window.ONLINE.submit("rando", g => Object.assign(g, { games: (g.games || 0) + 1, wins: (g.wins || 0) + (won ? 1 : 0), finals: (g.finals || 0) + (mpBest >= 3 ? 1 : 0), quals: (g.quals || 0) + Math.max(0, mpBest - 1) }));
    mode = "menu"; phase = "idle";
  },
  onStop() { mode = "menu"; phase = "idle"; },
  results(ctx) { const wn = (ctx.score[ctx.meta.winner] || ctx.players[ctx.meta.winner] || {}).pseudo; return `<h1 style="color:${ctx.meta.winner === ctx.uid ? "#4ade80" : "#f5f3ff"}">${wn ? esc(wn) + " gagne la couronne !" : "Fin de la rando"}</h1><p>Finale des Nénuphars terminée.</p>`; },
  onBack() { showPanel(MENU); bindMenu(); }
});

/* ---------- boucle ---------- */
let last = performance.now(), lastCount = 9, lastTick = performance.now();
const camPos = new T.Vector3(0, 6, 10), camLook = new T.Vector3();
function step(dt) {
  lastTick = performance.now();
  if (!level) return;
  const T2 = clock(); tNow = Math.max(0, (T2 - roundAt) / 1000);
  if (mode !== "menu" && phase !== "idle") { const n = Math.ceil((roundAt - T2) / 1000); if (n !== lastCount) { if (n >= 1 && n <= 3) { snd("beep"); flash(String(n), ROUNDS[roundN].tip, 1.1); } else if (n <= 0 && lastCount >= 1) { snd("go"); flash("PARTEZ !", "", 1); } lastCount = n; } }
  const started = T2 >= roundAt && phase !== "idle";
  // nénuphars : ils coulent un peu après qu'on les touche
  for (const p of level.pads) { p.sink = 0; if (p.touched && !p.gone) { const k = (T2 - p.touched) / 1000; if (k > 0.75) { p.sink = -(k - 0.75) * 5; if (k > 1.6) { p.gone = true; p.mesh.visible = false; } } else p.leaf.material = M(k % 0.2 < 0.1 ? 0xfde047 : (p.layer ? 0x22c55e : 0x4ade80)); p.mesh.position.y = p.y - 0.125 + p.sink; } }
  for (const r of runners) {
    if (r.out && roundN === 3) { r.model.g.visible = r.y > -8; if (r.local || r.bot) { r.vy -= G * dt; r.y += r.vy * dt; } continue; }
    if (r.local || r.bot) {
      let [ix, iz, j, d] = !started || r.fin ? [0, 0, false, false] : r.local ? inputs() : botThink(r, tNow, dt);
      const n = Math.ceil(dt / 0.017), h = dt / n;
      for (let k = 0; k < n; k++) { physics(r, ix, iz, j, d, h, tNow - dt + h * (k + 1)); j = d = false; if (r.out) break; }
    }
    if ((r.local || r.bot) && started && level.finishZ !== null && !r.fin && r.z < level.finishZ) onFinish(r);
  }
  if (mode === "mp") { syncRemote(dt); for (const r of runners) if (!r.local && X.score[r.id] && X.score[r.id].fin === roundN && !r.fin) { r.fin = X.score[r.id].ft; finishOrder.push(r.id); } liveT += dt; if (liveT > 0.09) { liveT = 0; writeLive(); } hostTick(); }
  if (mode === "solo") soloTick();
  if (fl > 0) { fl -= dt; if (fl <= 0) { $("#banner").textContent = ""; $("#sub").textContent = ""; } }
  shake = Math.max(0, shake - dt * 2);
  hud();
}
function render(dt) {
  if (!level) { camera.position.set(0, 6, 10); camera.lookAt(0, 0, -10); renderer.render(scene, camera); return; }
  const t = tNow;
  for (const b of level.boxes) if (b.mesh && (b.off || b.on)) { const a = boxAt(b, t); b.mesh.position.set(b.mesh.userData.base.x + a.o[0], b.mesh.userData.base.y + a.o[1], b.mesh.userData.base.z + a.o[2]); b.mesh.visible = !b.on || b.on(t) || a.o[1] > -8; }
  // troncs et rochers (meshes recyclés)
  level.rollM = level.rollM || []; let ri = 0;
  for (const R of level.rollers) { const n = Math.floor((R.zTo - R.zFrom) / R.spacing); for (let k = 0; k < n; k++) { let m = level.rollM[ri]; if (!m) { m = new T.Group(); const c = mesh(CYL, M(0x92400e)); c.scale.set(R.r, R.x2 - R.x1 - 0.2, R.r); c.rotation.z = Math.PI / 2; m.add(c); for (const sx of [-1, 1]) { const e = mesh(CYL, M(0xd6a76a), false); e.scale.set(R.r * 0.85, 0.02, R.r * 0.85); e.rotation.z = Math.PI / 2; e.position.x = sx * ((R.x2 - R.x1) / 2 - 0.09); m.add(e); } world.add(m); level.rollM.push(m); } const z = rollerPos(R, k, t); m.position.set((R.x1 + R.x2) / 2, R.y + Math.max(0, R.zFrom + 1.4 - z) * 3, z); m.rotation.x = z / R.r; ri++; } }
  level.bouM = level.bouM || []; let bi = 0;
  for (const B of level.boulders) { const n = Math.max(1, Math.floor((B.sl.z2 - B.sl.z1) / B.spacing)); B.lanes.forEach((lx, li) => { for (let k = 0; k < n; k++) { let m = level.bouM[bi]; if (!m) { m = mesh(new T.DodecahedronGeometry(B.r, 1), M(0x8d8d8d)); world.add(m); level.bouM.push(m); } const z = boulderPos(B, li, k, t); m.position.set(lx, slopeY(B.sl, lx, z) + B.r, z); m.rotation.x = z / B.r; bi++; } }); }
  for (const P of level.pends) P.mesh.rotation.z = -pendAngle(P, t);
  for (const w of level.waters) w.material.color.setHSL(0.56, 0.75, 0.47 + Math.sin(performance.now() / 900) * 0.03);
  for (const c of level.clouds) { c.position.x += dt * 1.2; if (c.position.x > 110) c.position.x = -110; }
  // persos
  for (const r of runners) {
    const g = r.model.g; if (r.out && roundN === 3 && r.y < -8) { g.visible = false; continue; }
    g.position.set(r.x, r.y, r.z); g.rotation.y = r.ry;
    const sp = Math.hypot(r.vx, r.vz), stepA = Math.sin(r.walk * 3);
    r.model.body.rotation.x = r.dive > 0 ? 1.2 : r.stun > 0 ? Math.sin(performance.now() / 50) * 0.3 : 0;
    r.model.body.position.y = r.dive > 0 ? -0.25 : Math.abs(stepA) * 0.08 * Math.min(1, sp / 3);
    r.model.body.scale.set(1, r.ground === false && r.vy > 2 ? 1.12 : 1, 1);
    r.model.feet[0].position.z = -0.1 + stepA * 0.22 * Math.min(1, sp / 3); r.model.feet[1].position.z = -0.1 - stepA * 0.22 * Math.min(1, sp / 3);
  }
  // caméra : derrière le coureur suivi
  const tgt = me && !(me.out && roundN === 3) ? me : runners.find(r => !r.out) || me;
  if (tgt) {
    const fin = roundN === 3, off = fin ? new T.Vector3(0, 9, 11) : new T.Vector3(0, 4.6, 7.8);
    const want = new T.Vector3(tgt.x * (fin ? 0.5 : 0.75), Math.max(tgt.y, fin ? 3 : -1) + off.y, tgt.z + off.z);
    camPos.lerp(want, Math.min(1, dt * 5)); camLook.lerp(new T.Vector3(tgt.x * (fin ? 0.5 : 0.85), Math.max(tgt.y, fin ? 2 : -1) + 0.8, tgt.z - (fin ? 2 : 5)), Math.min(1, dt * 6));
    camera.position.copy(camPos); if (shake > 0) camera.position.add(new T.Vector3((Math.random() - 0.5) * shake * 0.5, (Math.random() - 0.5) * shake * 0.5, 0)); camera.lookAt(camLook);
    sun.position.set(tgt.x + 25, 50, tgt.z + 20); sun.target.position.set(tgt.x, 0, tgt.z - 5);
  }
  renderer.render(scene, camera);
}
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); render(dt); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
setInterval(() => { const t = performance.now(); if (t - lastTick > 400 && mode === "mp") step(Math.min(0.1, (t - lastTick) / 1000)); }, 300);
// décor d'accueil derrière le menu
newLevel(1); camPos.set(0, 5, 9); camLook.set(0, 0, -12);
window.RANDO = { get me() { return me; }, get runners() { return runners; }, get round() { return roundN; }, get phase() { return phase; }, get level() { return level; }, soloStart, keys, finishMe: () => { if (me && level.finishZ !== null) { me.z = level.finishZ - 1; } }, tp: (x, y, z) => { if (me) { me.x = x; me.y = y; me.z = z; me.vx = me.vy = me.vz = 0; } }, get finishOrder() { return finishOrder; }, debugRound: n => setupRound(n, soloRoster, Date.now() + 600) };
}
