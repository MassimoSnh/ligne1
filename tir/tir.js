"use strict";
{
const $ = s => document.querySelector(s);
const snd = n => window.SFX && window.SFX.play(n); let hurtSnd = 0;
if (!window.THREE) { $("#panel").innerHTML = "<h1>Oups</h1><p>La bibliothèque 3D n'a pas pu se charger. Vérifie ta connexion et recharge la page.</p>"; throw new Error("THREE absent"); }
const T = THREE, cv = $("#c");
const isTouch = matchMedia("(pointer:coarse)").matches;
const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(isTouch ? 1.5 : 2, devicePixelRatio || 1));
if (!isTouch) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; }
const scene = new T.Scene(); scene.background = new T.Color(0x8ecdf5); scene.fog = new T.Fog(0x9fd3f2, 34, 95);
const BASEFOV = 75, camera = new T.PerspectiveCamera(BASEFOV, 1, 0.05, 260);
const hemi = new T.HemisphereLight(0xffffff, 0x557744, 0.85); scene.add(hemi);
const sun = new T.DirectionalLight(0xfff1d6, 0.85); sun.position.set(30, 52, 18);
if (!isTouch) { sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 150 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; }
scene.add(sun); scene.add(sun.target);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

/* ---------- la carte : un lotissement en blocs ---------- */
const solids = [], MATS = {}, statics = [];
let shootables = [];
// textures pixel en niveaux de gris, teintées par la couleur du bloc
const TEX = {};
function makeTex(kind) {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  let sd = kind.length * 977 + kind.charCodeAt(0) * 31 + 13; const r = () => { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; };
  const px = (a, b, w, h, v) => { v = Math.max(0, Math.min(255, Math.round(v))); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(a, b, w, h); };
  const noise = (base, amp, sz) => { for (let i = 0; i < 64; i += sz) for (let j = 0; j < 64; j += sz) px(i, j, sz, sz, base + (r() - 0.5) * amp); };
  if (kind === "brick") { noise(208, 34, 2); for (let row = 0; row < 8; row++) { px(0, row * 8, 64, 1, 140); for (let k = row % 2 ? 8 : 0; k < 64; k += 16) px(k, row * 8, 1, 8, 140); } }
  else if (kind === "siding") { noise(236, 14, 2); for (let row = 0; row < 64; row += 8) { px(0, row, 64, 1, 178); px(0, row + 1, 64, 1, 252); } for (let k = 0; k < 6; k++) px(Math.floor(r() * 60), Math.floor(r() * 8) * 8 + 3, 2, 2, 210); }
  else if (kind === "planks") { noise(212, 22, 1); for (let k = 0; k < 64; k += 16) px(k, 0, 1, 64, 130); for (let k = 0; k < 40; k++) px(Math.floor(r() * 64), Math.floor(r() * 64), 1, 3 + Math.floor(r() * 6), 175); for (let k = 0; k < 4; k++) px(Math.floor(r() * 4) * 16 + 7, Math.floor(r() * 60), 2, 2, 120); }
  else if (kind === "tiles") { noise(205, 36, 2); for (let row = 0; row < 64; row += 8) { px(0, row + 7, 64, 1, 115); for (let k = (row / 8) % 2 ? 6 : 0; k < 64; k += 12) px(k, row, 1, 7, 140); } }
  else if (kind === "grass") { noise(212, 46, 2); for (let k = 0; k < 140; k++) px(Math.floor(r() * 64), Math.floor(r() * 64), 1, 2, 245); for (let k = 0; k < 50; k++) px(Math.floor(r() * 64), Math.floor(r() * 64), 2, 2, 165); }
  else if (kind === "asphalt") { noise(205, 56, 1); for (let k = 0; k < 30; k++) px(Math.floor(r() * 64), Math.floor(r() * 64), 1, 1, 255); }
  else if (kind === "concrete") { noise(226, 22, 2); px(0, 0, 64, 1, 165); px(0, 0, 1, 64, 165); px(0, 32, 64, 1, 190); }
  else if (kind === "leaves") { noise(196, 90, 4); for (let k = 0; k < 60; k++) px(Math.floor(r() * 32) * 2, Math.floor(r() * 32) * 2, 2, 2, 250); }
  else if (kind === "metal") { noise(226, 12, 1); for (let row = 0; row < 64; row += 4) px(0, row, 64, 1, 214); px(0, 0, 64, 2, 170); px(0, 0, 2, 64, 170); for (const [a, b] of [[4, 4], [58, 4], [4, 58], [58, 58]]) px(a, b, 2, 2, 140); }
  else noise(236, 20, 2);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.NearestFilter; t.anisotropy = 4; return t;
}
const tex = k => TEX[k] || (TEX[k] = makeTex(k));
let TX = "noise";
const mat = (c, glow, tx) => { tx = tx || TX; const k = (glow ? "g" : tx) + c; return MATS[k] || (MATS[k] = glow ? new T.MeshBasicMaterial({ color: c }) : new T.MeshLambertMaterial({ color: c, map: tex(tx) })); };
const geo = new T.BoxGeometry(1, 1, 1);
function box(x, y, z, w, h, d, c, solid = true, glow = false) {
  const m = new T.Mesh(geo, mat(c, glow)); m.scale.set(w, h, d); m.position.set(x + w / 2, y + h / 2, z + d / 2); scene.add(m);
  m.userData.solid = solid; statics.push(m);
  if (solid) solids.push({ x1: x, x2: x + w, y1: y, y2: y + h, z1: z, z2: z + d });
  return m;
}
const deco = (x, y, z, w, h, d, c) => box(x, y, z, w, h, d, c, false);
const rnd = (a, b) => a + Math.random() * (b - a);
let seed = 7; const srnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const MX = 34, MZ = 26;
// sol, taches d'herbe, route, trottoirs
TX = "grass"; box(-MX - 40, -1, -MZ - 40, MX * 2 + 80, 1, MZ * 2 + 80, 0x6aa84f, false);
for (let i = 0; i < 40; i++) { const w = 2 + srnd() * 5, d = 2 + srnd() * 5; deco(-MX + srnd() * (MX * 2 - w), 0.002, -MZ + srnd() * (MZ * 2 - d), w, 0.01, d, [0x62a046, 0x74b257, 0x5e9a43][i % 3]); }
TX = "asphalt"; box(-MX, -0.98, -4, MX * 2, 1, 8, 0x4b5563, false); TX = "noise";
for (let x = -MX + 2; x < MX; x += 6) deco(x, 0.03, -0.15, 3, 0.02, 0.3, 0xf8fafc);
TX = "concrete"; box(-MX, -0.97, 4, MX * 2, 1, 1.2, 0xd1d5db, false); box(-MX, -0.97, -5.2, MX * 2, 1, 1.2, 0xd1d5db, false); TX = "noise";
deco(-MX, 0, 3.9, MX * 2, 0.12, 0.15, 0x9ca3af); deco(-MX, 0, -4.05, MX * 2, 0.12, 0.15, 0x9ca3af);
for (let z = -3.6; z < 3.6; z += 1) deco(-12, 0.03, z, 3, 0.02, 0.5, 0xf8fafc); // passage piéton
for (let z = -3.6; z < 3.6; z += 1) deco(14, 0.03, z, 3, 0.02, 0.5, 0xf8fafc);
for (const x of [-18, 5, 27]) { deco(x, 0.025, 1.2, 1, 0.02, 1, 0x374151); deco(x + 0.2, 0.03, 1.4, 0.6, 0.02, 0.6, 0x4b5563); } // plaques d'égout
// haies du quartier, avec des touffes
TX = "leaves";
box(-MX - 1, 0, -MZ - 1, MX * 2 + 2, 2.2, 1, 0x2f6b2a); box(-MX - 1, 0, MZ, MX * 2 + 2, 2.2, 1, 0x2f6b2a);
box(-MX - 1, 0, -MZ, 1, 2.2, MZ * 2, 0x2f6b2a); box(MX, 0, -MZ, 1, 2.2, MZ * 2, 0x2f6b2a);
for (let x = -MX; x < MX; x += 3) { deco(x + srnd(), 2.2, -MZ - 1, 1.4, 0.35, 1, 0x356f2f); deco(x + srnd(), 2.2, MZ, 1.4, 0.35, 1, 0x356f2f); }
// au loin : collines, montagnes, château d'eau, nuages
TX = "grass";
for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2 + srnd() * 0.2, r = 62 + srnd() * 25, cx = Math.cos(a) * r, cz = Math.sin(a) * r; let w = 22 + srnd() * 18, y = -1; const h = 3 + srnd() * 5, cols = i % 3 ? [0x5f9a55, 0x6aa65e, 0x7db36f, 0xe5e7eb] : [0x7a8f86, 0x8a9e96, 0x9fb0aa, 0xf8fafc];
  for (let k = 0; k < 4 && w > 3; k++) { deco(cx - w / 2, y, cz - w / 2, w, h, w * 0.8, cols[k]); y += h; w *= 0.62; } }
TX = "metal"; deco(-8, 0, -48, 1, 16, 1, 0x9ca3af); deco(-4, 0, -48, 1, 16, 1, 0x9ca3af); deco(-8, 0, -44, 1, 16, 1, 0x9ca3af); deco(-4, 0, -44, 1, 16, 1, 0x9ca3af);
deco(-10, 16, -50, 9, 6, 9, 0xe2e8f0); deco(-9, 22, -49, 7, 1.2, 7, 0xcbd5e1); deco(-10.05, 18, -50.05, 9.1, 1, 9.1, 0x3b82f6);
TX = "noise";
const clouds = [], CLOUD = new T.MeshBasicMaterial({ color: 0xffffff, fog: false });
for (let i = 0; i < 14; i++) { const g = new T.Group(), n = 3 + Math.floor(srnd() * 3); for (let k = 0; k < n; k++) { const m = new T.Mesh(geo, CLOUD); m.scale.set(5 + srnd() * 6, 1.6 + srnd() * 1.5, 4 + srnd() * 4); m.position.set(k * 4 - n * 2, srnd(), srnd() * 3); g.add(m); } g.position.set(-90 + srnd() * 180, 32 + srnd() * 14, -80 + srnd() * 160); scene.add(g); clouds.push(g); }

// maisons à étage, avec escalier intérieur et fenêtres ouvertes en haut (comme à Nuketown)
const HOUSES = [];
function wallX(xa, xb, z, t, y0, h, ops, c) { let x = xa; for (const [a, b, sl, tp] of ops.slice().sort((p, q) => p[0] - q[0])) { if (a > x) box(x, y0, z, a - x, h, t, c); if (sl > 0) box(a, y0, z, b - a, sl, t, c); if (tp < h) box(a, y0 + tp, z, b - a, h - tp, t, c); x = b; } if (xb > x) box(x, y0, z, xb - x, h, t, c); }
function wallZ(za, zb, x, t, y0, h, ops, c) { let z = za; for (const [a, b, sl, tp] of ops.slice().sort((p, q) => p[0] - q[0])) { if (a > z) box(x, y0, z, t, h, a - z, c); if (sl > 0) box(x, y0, a, t, sl, b - a, c); if (tp < h) box(x, y0 + tp, a, t, h - tp, b - a, c); z = b; } if (zb > z) box(x, y0, z, t, h, zb - z, c); }
function house(x0, z0, w, d, wall, roof, front) {
  const H = 3.2, F = 3.45, H2 = 2.65, t = 0.3, dw = 1.6, dx = x0 + w / 2 - dw / 2, glass = 0x93c5fd, frame = 0xffffff;
  const fz = front > 0 ? z0 + d - t : z0, bz = front > 0 ? z0 : z0 + d - t, out = front > 0 ? 1 : -1;
  // rez-de-chaussée : porte d'entrée et porte du jardin
  TX = "siding";
  wallX(x0, x0 + w, fz, t, 0, H, [[dx, dx + dw, 0, 2.3]], wall);
  wallX(x0, x0 + w, bz, t, 0, H, [[x0 + w / 2 - 1.5, x0 + w / 2 + 1.5, 0, 2.3]], wall);
  wallZ(z0, z0 + d, x0, t, 0, H, [], wall); wallZ(z0, z0 + d, x0 + w - t, t, 0, H, [], wall);
  box(x0 + w * 0.45, 0, z0 + d * 0.4, t, H, d * 0.35, wall);
  // escalier le long du mur de gauche
  const sw = 1.3, sx = x0 + t, run = 0.42, n = 12, rise = F / n, dir = front > 0 ? -1 : 1, zb = front > 0 ? z0 + d - t - 1.4 : z0 + t + 1.4;
  TX = "planks";
  for (let i = 0; i < n; i++) { const za = zb + dir * i * run, zc = za + dir * run; box(sx, 0, Math.min(za, zc), sw, (i + 1) * rise, run, i % 2 ? 0x8b5e34 : 0x9a6b3f); deco(sx, (i + 1) * rise - 0.04, Math.min(za, zc), sw, 0.05, 0.06, 0x5c3a1e); }
  const hz1 = Math.min(zb, zb + dir * n * run), hz2 = Math.max(zb, zb + dir * n * run), hx2 = sx + sw + 0.05;
  // plancher de l'étage, avec la trémie de l'escalier
  box(x0, H, z0, w, F - H, hz1 - z0, 0xb08a5e); box(x0, H, hz2, w, F - H, z0 + d - hz2, 0xb08a5e); box(hx2, H, hz1, x0 + w - hx2, F - H, hz2 - hz1, 0xb08a5e); box(x0, H, hz1, t, F - H, hz2 - hz1, 0xb08a5e);
  TX = "noise";
  box(hx2, F, hz1, 0.1, 0.95, hz2 - hz1, 0xf5f5f4); box(sx, F, dir < 0 ? hz2 - 0.1 : hz1, sw + 0.05, 0.95, 0.1, 0xf5f5f4);
  for (let z = hz1; z < hz2; z += 0.5) deco(hx2 - 0.02, F, z, 0.14, 1.0, 0.1, 0xe7e5e4);
  // étage : fenêtres ouvertes pour tirer depuis la maison
  TX = "siding";
  const fw = [[x0 + 1.4, x0 + 3.2], [x0 + w - 3.2, x0 + w - 1.4]], bw = [[x0 + 2, x0 + 3.8], [x0 + w - 3.8, x0 + w - 2]], sdw = [[z0 + d / 2 - 0.9, z0 + d / 2 + 0.9]];
  wallX(x0, x0 + w, fz, t, F, H2, fw.map(([a, b]) => [a, b, 0.95, 2.05]), wall);
  wallX(x0, x0 + w, bz, t, F, H2, bw.map(([a, b]) => [a, b, 0.95, 2.05]), wall);
  wallZ(z0, z0 + d, x0, t, F, H2, sdw.map(([a, b]) => [a, b, 0.95, 2.05]), wall); wallZ(z0, z0 + d, x0 + w - t, t, F, H2, sdw.map(([a, b]) => [a, b, 0.95, 2.05]), wall);
  TX = "noise";
  for (const [a, b] of fw) { deco(a - 0.1, F + 0.85, front > 0 ? fz + t : fz - 0.18, b - a + 0.2, 0.1, 0.18, frame); deco(a - 0.1, F + 2.05, front > 0 ? fz + t : fz - 0.08, b - a + 0.2, 0.12, 0.08, frame); deco(a - 0.12, F + 0.95, front > 0 ? fz + t : fz - 0.06, 0.12, 1.1, 0.06, frame); deco(b, F + 0.95, front > 0 ? fz + t : fz - 0.06, 0.12, 1.1, 0.06, frame); }
  for (const [a, b] of bw) { deco(a - 0.1, F + 0.85, front > 0 ? bz - 0.18 : bz + t, b - a + 0.2, 0.1, 0.18, frame); deco(a - 0.1, F + 2.05, front > 0 ? bz - 0.08 : bz + t, b - a + 0.2, 0.12, 0.08, frame); }
  for (const [a, b] of sdw) { deco(x0 - 0.18, F + 0.85, a - 0.1, 0.18, 0.1, b - a + 0.2, frame); deco(x0 + w, F + 0.85, a - 0.1, 0.18, 0.1, b - a + 0.2, frame); }
  // bandeau entre les deux niveaux
  deco(x0 - 0.06, H, z0 - 0.06, w + 0.12, 0.26, 0.06, frame); deco(x0 - 0.06, H, z0 + d, w + 0.12, 0.26, 0.06, frame); deco(x0 - 0.06, H, z0, 0.06, 0.26, d, frame); deco(x0 + w, H, z0, 0.06, 0.26, d, frame);
  // encadrement de porte, marche, allée
  const fo = front > 0 ? fz + t : fz - 0.08;
  deco(dx - 0.15, 0, fo, 0.15, 2.45, 0.08, frame); deco(dx + dw, 0, fo, 0.15, 2.45, 0.08, frame); deco(dx - 0.15, 2.3, fo, dw + 0.3, 0.15, 0.08, frame);
  TX = "concrete";
  deco(dx - 0.3, 0, front > 0 ? fz + t : fz - 0.9, dw + 0.6, 0.12, 0.9, 0xd6d3d1);
  if (front > 0) deco(dx, 0.01, z0 + d + 0.9, dw, 0.015, Math.max(0, -5.2 - (z0 + d + 0.9)), 0xd6d3d1);
  else deco(dx, 0.01, 5.2, dw, 0.015, Math.max(0, fz - 0.9 - 5.2), 0xd6d3d1);
  // auvent au-dessus de la porte
  TX = "tiles"; deco(dx - 0.5, 2.55, front > 0 ? fz + t : fz - 0.9, dw + 1, 0.12, 0.9, roof);
  TX = "noise";
  // fenêtres du rez-de-chaussée avec cadres et jardinières
  const win = (x, y, z, ww, hh, alongX, off) => {
    if (alongX) { deco(x, y, z + off, ww, hh, 0.06, glass); deco(x - 0.1, y - 0.1, z + off * 1.6, ww + 0.2, 0.1, 0.1, frame); deco(x - 0.1, y + hh, z + off * 1.6, ww + 0.2, 0.1, 0.1, frame); deco(x - 0.1, y, z + off * 1.6, 0.1, hh, 0.1, frame); deco(x + ww, y, z + off * 1.6, 0.1, hh, 0.1, frame); deco(x + ww / 2 - 0.03, y, z + off * 1.6, 0.06, hh, 0.08, frame); }
    else { deco(x + off, y, z, 0.06, hh, ww, glass); deco(x + off * 1.6, y - 0.1, z - 0.1, 0.1, 0.1, ww + 0.2, frame); deco(x + off * 1.6, y + hh, z - 0.1, 0.1, 0.1, ww + 0.2, frame); }
  };
  for (const wx of [x0 + 1.2, x0 + w - 3.2]) { win(wx, 1.2, front > 0 ? fz + t : fz, 2, 1.1, true, front > 0 ? 0 : -0.06); TX = "planks"; deco(wx, 0.35, front > 0 ? fz + t : fz - 0.5, 2, 0.4, 0.5, 0x7c2d12); TX = "noise"; for (let k = 0; k < 5; k++) deco(wx + 0.15 + k * 0.38, 0.75, front > 0 ? fz + t + 0.12 : fz - 0.38, 0.22, 0.22, 0.22, [0xf43f5e, 0xfacc15, 0xa855f7, 0xffffff, 0xfb923c][k]); }
  for (const wx of [x0 + 1.5, x0 + w - 3.5]) win(wx, 1.2, front > 0 ? bz : bz + t, 2, 1.1, true, front > 0 ? -0.06 : 0);
  win(x0 + w - t, 1.2, z0 + d / 2 - 1, 2, 1.1, false, t);
  // toit en gradins, gouttière, cheminée en briques
  const R0 = F + H2;
  TX = "planks"; deco(x0 + t, R0 - 0.05, z0 + t, w - 2 * t, 0.05, d - 2 * t, 0xf5efe6);
  TX = "noise"; deco(x0 + w / 2 - 0.3, R0 - 0.12, z0 + d / 2 - 0.3, 0.6, 0.07, 0.6, 0xfff7d6);
  TX = "tiles";
  box(x0 - 0.4, R0, z0 - 0.4, w + 0.8, 0.35, d + 0.8, roof);
  box(x0 + 0.8, R0 + 0.35, z0 + 0.8, w - 1.6, 0.6, d - 1.6, roof); box(x0 + 2, R0 + 0.95, z0 + 2, w - 4, 0.5, d - 4, roof);
  TX = "metal"; deco(x0 - 0.45, R0 - 0.12, z0 - 0.45, w + 0.9, 0.12, 0.12, 0xe5e7eb); deco(x0 - 0.45, R0 - 0.12, z0 + d + 0.33, w + 0.9, 0.12, 0.12, 0xe5e7eb);
  TX = "brick"; deco(x0 + w - 3.2, R0 + 0.6, z0 + 1.6, 1, 2.3, 1, 0x9a3412); TX = "noise"; deco(x0 + w - 3.3, R0 + 2.9, z0 + 1.5, 1.2, 0.2, 1.2, 0x44403c);
  // intérieur du bas : parquet, tapis, table, canapé, lampe, caisses
  TX = "planks"; deco(x0 + t, 0.005, z0 + t, w - 2 * t, 0.02, d - 2 * t, 0xc49a6c);
  TX = "noise"; deco(x0 + w * 0.2, 0.03, z0 + d * 0.35, 3, 0.02, 2.2, 0x1e40af);
  TX = "planks"; box(x0 + w * 0.2 + 0.8, 0, z0 + d * 0.35 + 0.6, 1.4, 0.8, 1, 0x78350f);
  TX = "noise"; box(x0 + w * 0.62, 0, front > 0 ? z0 + 1.2 : z0 + d - 2.1, 3, 0.85, 0.9, 0x475569); deco(x0 + w * 0.62, 0.85, front > 0 ? z0 + 1.2 : z0 + d - 1.4, 3, 0.6, 0.2, 0x475569);
  deco(x0 + w - 1.2, 0, z0 + d / 2, 0.1, 1.6, 0.1, 0x111827); deco(x0 + w - 1.4, 1.6, z0 + d / 2 - 0.2, 0.5, 0.4, 0.5, 0xfef3c7);
  TX = "planks"; box(x0 + 2.2, 0.01, front > 0 ? z0 + 1 : z0 + d - 2.2, 2.6, 0.9, 1.2, 0x92400e); TX = "metal"; box(x0 + w - 5, 0.01, front > 0 ? z0 + d - 3 : z0 + 1.8, 2.4, 0.8, 1.2, 0x9ca3af);
  // intérieur du haut : lit, armoire, bureau
  const backZ = front > 0 ? z0 + t : z0 + d - t - 2.1;
  TX = "planks"; box(x0 + w - t - 1.5, F, backZ, 1.5, 0.45, 2.1, 0x7c2d12);
  TX = "noise"; deco(x0 + w - t - 1.45, F + 0.45, backZ + 0.05, 1.4, 0.15, 2.0, 0x2563eb); deco(x0 + w - t - 1.35, F + 0.6, front > 0 ? backZ + 0.1 : backZ + 1.5, 1.2, 0.15, 0.45, 0xffffff);
  TX = "planks"; box(x0 + w * 0.5, F, front > 0 ? z0 + t : z0 + d - t - 0.6, 1.6, 2.0, 0.6, 0x92400e);
  box(x0 + w - t - 0.7, F, z0 + d / 2 + 1.1, 0.7, 0.8, 1.4, 0x78350f); TX = "noise"; deco(x0 + w - t - 0.6, F + 0.8, z0 + d / 2 + 1.4, 0.4, 0.3, 0.5, 0x111827);
  TX = "noise"; deco(x0 + w * 0.45, F + 0.01, z0 + d * 0.35, 2.4, 0.02, 2, 0xbe185d);
  // boîte aux lettres
  const mx = dx + dw + 1.6, mz = front > 0 ? -5.9 : 5.5;
  deco(mx, 0, mz, 0.12, 1, 0.12, 0x52525b); TX = "metal"; deco(mx - 0.2, 1, mz - 0.15, 0.55, 0.35, 0.42, out > 0 ? 0x1d4ed8 : 0xb91c1c); TX = "noise"; deco(mx + 0.32, 1.1, mz - 0.1, 0.05, 0.3, 0.06, 0xef4444);
  // points de passage pour les robots
  const fdz = front > 0 ? 1 : -1;
  HOUSES.push({ x0, z0, w, d, F,
    doors: [[dx + dw / 2, (front > 0 ? z0 + d : z0) + fdz * 1.1, dx + dw / 2, (front > 0 ? z0 + d : z0) - fdz * 1.3], [x0 + w / 2, (front > 0 ? z0 : z0 + d) - fdz * 1.1, x0 + w / 2, (front > 0 ? z0 : z0 + d) + fdz * 1.3]],
    sb: [sx + sw / 2, zb - dir * 0.55], st: [sx + sw / 2, dir < 0 ? hz1 - 0.8 : hz2 + 0.8] });
}
house(-20, -19, 16, 11, 0xf1f5f9, 0xb91c1c, 1);
house(4, 8, 16, 11, 0xfde68a, 0x1d4ed8, -1);
house(8, -19, 12, 10, 0xe9d5ff, 0x374151, 1);
house(-24, 9, 13, 10, 0xbbf7d0, 0x7c2d12, -1);
// clôtures de jardin basses (on saute par-dessus) avec poteaux
TX = "planks";
for (const [x, z, w] of [[-21, -7.6, 6], [-9, -7.6, 6], [7, -7.6, 4], [16, -7.6, 5], [3, 7, 7], [14, 7, 7], [-25, 7, 5], [-15, 7, 5]]) { box(x, 0, z, w, 0.8, 0.25, 0xffffff); for (let k = 0; k <= w; k += 1) deco(x + k - 0.07, 0, z - 0.03, 0.14, 1.05, 0.31, 0xf1f5f9); }
// lampadaires
TX = "metal";
function lamp(x, z, side) { box(x - 0.1, 0, z - 0.1, 0.2, 4.2, 0.2, 0x374151); deco(x - 0.08, 4.1, side > 0 ? z - 1 : z, 0.16, 0.16, 1.1, 0x374151); box(x - 0.25, 3.9, side > 0 ? z - 1.2 : z + 0.8, 0.5, 0.22, 0.5, 0xfff3c4, false, true); box(x - 0.25, 0, z - 0.25, 0.5, 0.3, 0.5, 0x4b5563); }
for (let x = -28; x <= 28; x += 14) { lamp(x, 4.7, 1); if (x + 7 < 33) lamp(x + 7, -4.7, -1); }
// voitures (avec phares, vitres, jantes)
TX = "metal";
function car(x, z, c, rot) {
  const [w, d] = rot ? [1.9, 4.2] : [4.2, 1.9];
  box(x, 0.3, z, w, 0.9, d, c); box(x + (rot ? 0.15 : 1), 1.2, z + (rot ? 1 : 0.15), rot ? 1.6 : 2.2, 0.7, rot ? 2.2 : 1.6, 0x1f2937);
  deco(x + (rot ? 0.1 : 0.95), 1.25, z + (rot ? 0.95 : 0.1), rot ? 1.7 : 2.3, 0.55, rot ? 2.3 : 1.7, 0x93c5fd);
  for (const [a, b] of [[0.2, 0.2], [w - 0.7, 0.2], [0.2, d - 0.7], [w - 0.7, d - 0.7]]) { deco(x + a, 0, z + b, 0.5, 0.5, 0.5, 0x111111); }
  if (rot) { deco(x + 0.2, 0.75, z - 0.03, 0.4, 0.2, 0.05, 0xfef9c3); deco(x + w - 0.6, 0.75, z - 0.03, 0.4, 0.2, 0.05, 0xfef9c3); deco(x + 0.2, 0.75, z + d, 0.4, 0.2, 0.05, 0xdc2626); deco(x + w - 0.6, 0.75, z + d, 0.4, 0.2, 0.05, 0xdc2626); }
  else { deco(x - 0.03, 0.75, z + 0.2, 0.05, 0.2, 0.4, 0xfef9c3); deco(x - 0.03, 0.75, z + d - 0.6, 0.05, 0.2, 0.4, 0xfef9c3); deco(x + w, 0.75, z + 0.2, 0.05, 0.2, 0.4, 0xdc2626); deco(x + w, 0.75, z + d - 0.6, 0.05, 0.2, 0.4, 0xdc2626); }
}
car(-6, -3, 0xdc2626, false); car(10, 1.2, 0x2563eb, false); car(-2, -12, 0x16a34a, true); car(24, 10, 0xf59e0b, true);
// le bus en travers
TX = "metal";
box(-31, 0.4, -3.5, 2.8, 2.6, 9, 0xfacc15); box(-31.05, 1.7, -3, 2.9, 0.8, 8, 0x1f2937); deco(-31, 0, -3, 2.8, 0.5, 8, 0x111111);
deco(-31.06, 1.2, -3.5, 2.92, 0.12, 9, 0x111827); deco(-30.4, 2.95, -3.2, 1.6, 0.15, 8.4, 0xeab308);
// arbres : feuillus et sapins
function tree(x, z) { TX = "planks"; box(x - 0.25, 0, z - 0.25, 0.5, 2.2, 0.5, 0x7c4a1d); TX = "leaves"; box(x - 1.3, 2.2, z - 1.3, 2.6, 2, 2.6, 0x3f8f3a); box(x - 0.8, 4.2, z - 0.8, 1.6, 1, 1.6, 0x4ea84a); deco(x - 1.5, 2.6, z - 0.6, 0.3, 1, 1.2, 0x3a8434); deco(x + 1.2, 2.8, z - 0.5, 0.3, 0.9, 1, 0x47973f); }
function pine(x, z) { TX = "planks"; box(x - 0.2, 0, z - 0.2, 0.4, 1.4, 0.4, 0x6b3f1d); TX = "leaves"; let s = 2.6; for (let y = 1.2; s > 0.5; y += 0.9, s -= 0.55) deco(x - s / 2, y, z - s / 2, s, 0.9, s, y > 3 ? 0x2d6a3e : 0x255a34); }
for (const [x, z] of [[-28, -20], [28, -14], [28, 20], [-4, 21], [0, -22], [-30, 18], [30, -24]]) tree(x, z);
for (const [x, z] of [[-32, -12], [-32, 23], [32, 14], [12, 23.5], [-14, 23.5], [21, -23.5], [-10, -23.5], [5, -23.5]]) pine(x, z);
// buissons et massifs de fleurs
TX = "leaves";
for (const [x, z, w] of [[-19, -7.2, 1.2], [-6, -7.2, 1.2], [9, 22, 1.6], [-21, 20.5, 1.4], [15, -21, 1.2], [-1, 9, 1.2], [31, 2.6, 1.4], [-33, 6.5, 1.2]]) { deco(x, 0, z, w, 0.9, w, 0x3f8f3a); deco(x + 0.2, 0.9, z + 0.2, w - 0.4, 0.3, w - 0.4, 0x4ea84a); }
TX = "noise"; for (const [x, z] of [[-16, 20.5], [18, 21.5], [-27, -21], [23, 7.8]]) for (let k = 0; k < 8; k++) deco(x + k * 0.45, 0, z + (k % 2) * 0.3, 0.3, 0.35, 0.3, [0xf43f5e, 0xfacc15, 0xffffff, 0xa855f7][k % 4]);
// caisses, poubelles, barrières
TX = "planks";
for (const [x, z] of [[2, -6.5], [-14, 5.5], [21, 5.5], [-26, -6.5]]) { box(x, 0, z, 1.2, 1.2, 1.2, 0xa16207); deco(x - 0.02, 0.55, z - 0.02, 1.24, 0.1, 1.24, 0x78350f); }
TX = "metal"; for (const [x, z, c] of [[-9, 5.6, 0x166534], [-8.2, 5.6, 0x374151], [19, -6.3, 0x166534], [19.8, -6.3, 0x1d4ed8], [-29, 5.6, 0x374151]]) { box(x, 0, z, 0.7, 1, 0.7, c); deco(x - 0.05, 1, z - 0.05, 0.8, 0.1, 0.8, 0x111827); }
// piscine dans le jardin du fond
TX = "concrete";
box(24, 0, -22.5, 7, 0.3, 0.4, 0xe5e7eb); box(24, 0, -17.4, 7, 0.3, 0.4, 0xe5e7eb); box(24, 0, -22.1, 0.4, 0.3, 4.7, 0xe5e7eb); box(30.6, 0, -22.1, 0.4, 0.3, 4.7, 0xe5e7eb);
TX = "noise"; deco(24.4, 0.02, -22.1, 6.2, 0.05, 4.7, 0x38bdf8); deco(26, 0.08, -20.5, 0.8, 0.05, 0.8, 0xbae6fd); deco(28.5, 0.08, -19, 0.6, 0.05, 0.6, 0xbae6fd);
deco(30.2, 0, -16.8, 0.1, 1, 0.1, 0x9ca3af); deco(29.6, 0, -16.8, 0.1, 1, 0.1, 0x9ca3af);
// aire de jeux : balançoire et toboggan
TX = "metal";
for (const x of [-33, -29.5]) { deco(x, 0, 11, 0.15, 2.6, 0.15, 0xdc2626); deco(x, 0, 13.5, 0.15, 2.6, 0.15, 0xdc2626); }
deco(-33, 2.6, 11, 3.65, 0.15, 0.15, 0xdc2626); deco(-33, 2.6, 13.5, 3.65, 0.15, 0.15, 0xdc2626);
deco(-32.3, 0.6, 11.7, 0.7, 0.08, 0.4, 0x1f2937); deco(-30.9, 0.6, 12.6, 0.7, 0.08, 0.4, 0x1f2937);
box(-32.5, 0, 16, 1.2, 2, 1.2, 0x2563eb); deco(-32.4, 0.2, 17.2, 1, 0.15, 3, 0xfacc15); deco(-32.4, 2, 16.1, 1, 0.1, 1, 0xfacc15);
// panier de basket sur l'allée
box(-7.2, 0, 23.6, 0.25, 3.2, 0.25, 0x6b7280); deco(-8, 3.1, 23.2, 1.8, 1.1, 0.1, 0xffffff); deco(-7.4, 3.25, 23.18, 0.6, 0.45, 0.03, 0xdc2626); deco(-7.45, 3.05, 22.6, 0.7, 0.05, 0.6, 0xf97316);
// barbecue et table de pique-nique
TX = "planks";
box(17, 0, -24, 2.2, 0.75, 1, 0x92400e); deco(17, 0, -24.6, 2.2, 0.42, 0.35, 0x78350f); deco(17, 0, -22.6, 2.2, 0.42, 0.35, 0x78350f);
deco(-17, 0, 22, 0.1, 0.9, 0.1, 0x111827); deco(-17.35, 0.9, 21.65, 0.8, 0.3, 0.7, 0x1f2937);
// couverts autour des drapeaux de domination
TX = "concrete";
box(-25.2, 0, -16.5, 2.4, 0.9, 0.8, 0xa8a29e); deco(-25.2, 0.9, -16.4, 2.4, 0.2, 0.6, 0xc4b5a0);
box(-30.6, 0, -11.4, 0.8, 0.9, 2.4, 0xa8a29e); TX = "planks"; box(-24.4, 0, -10.4, 1.2, 1.2, 1.2, 0xa16207); TX = "concrete";
TX = "planks"; box(-6.6, 0, 15.6, 2, 0.75, 1, 0x92400e); deco(-6.6, 0, 15, 2, 0.42, 0.35, 0x78350f); deco(-6.6, 0, 16.9, 2, 0.42, 0.35, 0x78350f);
box(-1, 0, 11, 1.2, 1.2, 1.2, 0xa16207);
TX = "concrete"; box(30.2, 0, -10.6, 2.4, 0.9, 0.8, 0xa8a29e); box(24.2, 0, -10, 0.8, 0.9, 2, 0xa8a29e);

// fusion des blocs statiques : beaucoup moins d'objets à dessiner (plus fluide sur téléphone)
(function mergeStatic() {
  const base = geo.toNonIndexed(), bp = base.attributes.position.array, bn = base.attributes.normal.array, groups = {};
  for (const m of statics) { const k = m.material.uuid + (m.userData.solid ? "s" : "d"); (groups[k] = groups[k] || { mat: m.material, solid: m.userData.solid, list: [] }).list.push(m); scene.remove(m); }
  shootables = [];
  for (const g of Object.values(groups)) {
    const n = g.list.length, pos = new Float32Array(n * bp.length), nor = new Float32Array(n * bn.length), uv = new Float32Array(n * bp.length / 3 * 2);
    g.list.forEach((m, i) => { const s = m.scale, p = m.position; for (let j = 0, q = 0; j < bp.length; j += 3, q += 2) { const X = bp[j] * s.x + p.x, Y = bp[j + 1] * s.y + p.y, Z = bp[j + 2] * s.z + p.z, o = i * bp.length + j, u = i * bp.length / 3 * 2 + q; pos[o] = X; pos[o + 1] = Y; pos[o + 2] = Z; const ax = Math.abs(bn[j]), ay = Math.abs(bn[j + 1]); uv[u] = (ax > 0.5 ? Z : X) * 0.5; uv[u + 1] = (ay > 0.5 ? Z : Y) * 0.5; } nor.set(bn, i * bn.length); });
    const bg = new T.BufferGeometry(); bg.setAttribute("position", new T.BufferAttribute(pos, 3)); bg.setAttribute("normal", new T.BufferAttribute(nor, 3)); bg.setAttribute("uv", new T.BufferAttribute(uv, 2)); bg.computeBoundingSphere(); bg.computeBoundingBox();
    const mesh = new T.Mesh(bg, g.mat); mesh.castShadow = mesh.receiveShadow = !g.mat.isMeshBasicMaterial; scene.add(mesh); if (g.solid) shootables.push(mesh);
  }
  statics.length = 0;
})();

/* ---------- joueur ---------- */
const P = { x: 0, y: 0, z: 0, vy: 0, yaw: Math.PI / 2, pitch: 0, hp: 100, ground: true }, R = 0.35, EYE = 1.6;
function hitsAt(x, y, z, r, minH, hh = 1.7) { for (const b of solids) { if (b.y2 - b.y1 < minH) continue; if (x + r > b.x1 && x - r < b.x2 && z + r > b.z1 && z - r < b.z2 && y + hh > b.y1 && y + 0.62 < b.y2) return b; } return null; }
function groundAt(x, z, y) { let g = 0; for (const b of solids) if (x + R > b.x1 && x - R < b.x2 && z + R > b.z1 && z - R < b.z2 && b.y2 <= y + 0.63 && b.y2 > g) g = b.y2; return g; }
// ligne de vue (segment contre les blocs hauts)
function los(ax, ay, az, bx, by, bz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  for (const b of solids) {
    if (b.y2 - b.y1 < 0.95) continue;
    let t0 = 0, t1 = 1, ok = true;
    for (const [o, d, lo, hi] of [[ax, dx, b.x1, b.x2], [ay, dy, b.y1, b.y2], [az, dz, b.z1, b.z2]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } continue; }
      let u = (lo - o) / d, v = (hi - o) / d; if (u > v) [u, v] = [v, u]; t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) { ok = false; break; }
    }
    if (ok) return false;
  }
  return true;
}
const inSolid = (x, y, z) => solids.some(b => x > b.x1 && x < b.x2 && y > b.y1 && y < b.y2 && z > b.z1 && z < b.z2);
const keys = new Set(), mv = { x: 0, z: 0 };
let fireHeld = false, fireQueued = false, aimHeld = false, locked = false, state = "menu", mode = "solo", crouchHeld = false, crouchToggle = false, crouch = false, crouchK = 0;
const PH = () => (crouch ? 1.15 : 1.7);
const MPH = () => window.MP;
addEventListener("keydown", e => {
  keys.add(e.code); if (e.code === "KeyR") reload(); if (e.code === "Space") { jump(); e.preventDefault(); } if (e.code === "Escape" && state === "play" && !locked) pause();
  if (e.code === "KeyC" || e.code === "ControlLeft") { crouchHeld = true; e.preventDefault(); }
  if (e.code === "KeyF" || e.code === "KeyV") { if (state === "play") quickKnife(); }
  const n = "1234567".indexOf(e.key); if (n >= 0 && n < WEAPONS.length && state === "play") equip(n);
});
addEventListener("keyup", e => { keys.delete(e.code); if (e.code === "KeyC" || e.code === "ControlLeft") crouchHeld = false; });
function jump() { if (state === "play" && P.ground) { if (crouch) { crouchToggle = false; return; } P.vy = 5.6; P.ground = false; snd("jump"); } }
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("mousedown", e => { if (state !== "play") return; if (!locked && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} } if (e.button === 0) { fireHeld = true; fireQueued = true; } if (e.button === 2) aimHeld = true; });
addEventListener("mouseup", e => { if (e.button === 0) fireHeld = false; if (e.button === 2) aimHeld = false; });
addEventListener("wheel", e => { if (state === "play") equip((cur + (e.deltaY > 0 ? 1 : WEAPONS.length - 1)) % WEAPONS.length); }, { passive: true });
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === cv; if (!locked && state === "play" && !isTouch) pause(); });
let drag = null;
addEventListener("mousemove", e => { if (state !== "play") return; if (locked) look(e.movementX, e.movementY, 0.0024); else if (drag) { look(e.clientX - drag.x, e.clientY - drag.y, 0.005); drag = { x: e.clientX, y: e.clientY }; } });
cv.addEventListener("mousedown", e => { if (!locked && !isTouch && e.button === 0) drag = { x: e.clientX, y: e.clientY }; });
addEventListener("mouseup", () => { drag = null; });
function look(dx, dy, s) { s *= camera.fov / BASEFOV; P.yaw -= dx * s; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - dy * s)); }
// tactile
const stick = $("#stick"), knob = $("#knob"); let sid = null, sc = null, lookId = null, lp = null;
stick.addEventListener("pointerdown", e => { e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); sc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; smove(e); });
stick.addEventListener("pointermove", e => { if (e.pointerId === sid) smove(e); });
const send = e => { if (e.pointerId !== sid) return; sid = null; mv.x = mv.z = 0; knob.style.transform = ""; };
stick.addEventListener("pointerup", send); stick.addEventListener("pointercancel", send);
function smove(e) { let dx = e.clientX - sc.x, dy = e.clientY - sc.y; const d = Math.hypot(dx, dy), m = Math.min(d, 50); if (d > 0) { dx = dx / d * m; dy = dy / d * m; } knob.style.transform = `translate(${dx}px,${dy}px)`; mv.x = dx / 50; mv.z = dy / 50; }
cv.addEventListener("pointerdown", e => { if (e.pointerType !== "touch" || state !== "play") return; lookId = e.pointerId; lp = { x: e.clientX, y: e.clientY }; });
cv.addEventListener("pointermove", e => { if (e.pointerId !== lookId) return; look(e.clientX - lp.x, e.clientY - lp.y, 0.006); lp = { x: e.clientX, y: e.clientY }; });
const lend = e => { if (e.pointerId === lookId) lookId = null; };
cv.addEventListener("pointerup", lend); cv.addEventListener("pointercancel", lend);
for (const [id, dn, up] of [["#fire", () => { fireHeld = true; fireQueued = true; }, () => fireHeld = false], ["#reload", () => reload(), null], ["#jump", () => jump(), null], ["#swap", () => equip((cur + 1) % WEAPONS.length), null], ["#aim", () => { aimHeld = !aimHeld; $("#aim").classList.toggle("on", aimHeld); }, null], ["#crouch", () => { crouchToggle = !crouchToggle; $("#crouch").classList.toggle("on", crouchToggle); }, null]]) {
  const b = $(id); if (!b) continue; b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); dn(); });
  if (up) { b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up); }
}

/* ---------- armes ---------- */
// rdmg : dégâts sur un robot · pdmg : dégâts sur un joueur (100 PV) · la tête compte double
const WEAPONS = [
  { id: "ar", name: "Fusil d'assaut", short: "Fusil", auto: true, rate: 0.11, mag: 30, reload: 1.5, spread: 0.018, pellets: 1, rdmg: 1, pdmg: 22, range: 90, speed: 1, kick: 0.004, zoom: 55, col: 0xfff3b0, mz: -0.98 },
  { id: "smg", name: "Mitraillette", short: "Mitraillette", auto: true, rate: 0.065, mag: 40, reload: 1.2, spread: 0.038, pellets: 1, rdmg: 0.6, pdmg: 14, range: 45, speed: 1.12, kick: 0.003, zoom: 60, col: 0xfff3b0, mz: -0.62 },
  { id: "pompe", name: "Fusil à pompe", short: "Pompe", auto: false, rate: 0.85, mag: 6, reload: 2.2, spread: 0.1, pellets: 8, rdmg: 0.8, pdmg: 15, range: 18, speed: 1, kick: 0.05, zoom: 62, col: 0xffd8a8, mz: -0.92 },
  { id: "sniper", name: "Sniper", short: "Sniper", auto: false, rate: 1.15, mag: 5, reload: 2.4, spread: 0.07, pellets: 1, rdmg: 5, pdmg: 95, range: 160, speed: 0.92, kick: 0.07, zoom: 22, scope: true, col: 0xbfffd0, mz: -1.18 },
  { id: "pistol", name: "Pistolet", short: "Pistolet", auto: false, rate: 0.17, mag: 12, reload: 1.1, spread: 0.014, pellets: 1, rdmg: 1.1, pdmg: 30, range: 70, speed: 1.1, kick: 0.012, zoom: 60, col: 0xfff3b0, mz: -0.42 },
  { id: "knife", name: "Couteau", short: "Couteau", melee: true, auto: false, rate: 0.42, mag: Infinity, reload: 0, spread: 0, pellets: 1, rdmg: 3, pdmg: 55, range: 2.4, speed: 1.18, kick: 0, zoom: 70, col: 0xffffff, mz: -0.5 },
  { id: "rpg", name: "Lance-briques", short: "Lance-briques", auto: false, rate: 1, mag: 1, reload: 2.4, spread: 0.01, pellets: 1, rdmg: 7, pdmg: 120, range: 120, speed: 0.9, kick: 0.08, zoom: 60, rocket: true, radius: 4.5, reserve: 3, col: 0xffa94d, mz: -0.82 }
];
const gun = new T.Group(); camera.add(gun); scene.add(camera);
const GM = {}; const gm = (c, g) => GM[c + (g ? "g" : "")] || (GM[c + (g ? "g" : "")] = g ? new T.MeshBasicMaterial({ color: c }) : new T.MeshLambertMaterial({ color: c, map: tex("metal") }));
function model(parts) { const g = new T.Group(); for (const [w, h, d, x, y, z, c, gl] of parts) { const m = new T.Mesh(geo, gm(c, gl)); m.scale.set(w, h, d); m.position.set(x, y, z); g.add(m); } gun.add(g); g.visible = false; return g; }
const ribs = (n, x, y, z0, step, c) => Array.from({ length: n }, (_, i) => [0.075, 0.014, 0.022, x, y, z0 - i * step, c]);
const MODELS = {
  ar: model([[0.09, 0.12, 0.42, 0, 0, -0.2, 0x2b2f36], [0.07, 0.03, 0.42, 0, 0.075, -0.24, 0x111827], ...ribs(7, 0, 0.094, -0.06, 0.055, 0x0b0d10), [0.1, 0.1, 0.3, 0, -0.005, -0.56, 0x3f4651], [0.103, 0.02, 0.26, 0, 0.03, -0.56, 0x2b2f36], [0.035, 0.035, 0.24, 0, 0.01, -0.82, 0x0b0d10], [0.055, 0.055, 0.07, 0, 0.01, -0.95, 0x111111], [0.02, 0.07, 0.02, 0, 0.085, -0.68, 0x111111],
    [0.065, 0.03, 0.09, 0, 0.105, -0.12, 0x111827], [0.065, 0.075, 0.015, 0, 0.16, -0.08, 0x111827], [0.065, 0.075, 0.015, 0, 0.16, -0.17, 0x111827], [0.012, 0.075, 0.1, -0.026, 0.16, -0.125, 0x111827], [0.012, 0.075, 0.1, 0.026, 0.16, -0.125, 0x111827], [0.04, 0.045, 0.004, 0, 0.16, -0.1, 0x22d3ee, 1], [0.008, 0.008, 0.004, 0, 0.162, -0.11, 0xef4444, 1],
    [0.06, 0.2, 0.09, 0, -0.165, -0.25, 0x1f2937], [0.062, 0.03, 0.092, 0, -0.27, -0.26, 0x374151], [0.06, 0.16, 0.07, 0, -0.14, -0.02, 0x1f2937], [0.02, 0.02, 0.1, 0, -0.08, -0.09, 0x111111], [0.012, 0.04, 0.012, 0, -0.07, -0.08, 0x9ca3af], [0.04, 0.04, 0.2, 0, 0.01, 0.1, 0x111827], [0.07, 0.12, 0.14, 0, -0.02, 0.24, 0x2b2f36], [0.072, 0.05, 0.03, 0, -0.06, 0.3, 0x111111], [0.035, 0.02, 0.05, 0.03, 0.06, -0.02, 0x111111]]),
  smg: model([[0.09, 0.12, 0.36, 0, 0, -0.17, 0x1e293b], [0.07, 0.025, 0.3, 0, 0.07, -0.18, 0x0f172a], ...ribs(5, 0, 0.087, -0.05, 0.05, 0x020617), [0.045, 0.045, 0.16, 0, 0.02, -0.43, 0x0f172a], [0.06, 0.06, 0.08, 0, 0.02, -0.54, 0x111111], [0.05, 0.3, 0.07, 0, -0.2, -0.22, 0x475569], [0.052, 0.03, 0.072, 0, -0.36, -0.22, 0x334155], [0.06, 0.16, 0.07, 0, -0.12, -0.04, 0x111827],
    [0.05, 0.05, 0.06, 0, 0.11, -0.12, 0x111827], [0.035, 0.035, 0.004, 0, 0.11, -0.09, 0xef4444, 1], [0.02, 0.02, 0.22, -0.03, 0.02, 0.12, 0x334155], [0.02, 0.02, 0.22, 0.03, 0.02, 0.12, 0x334155], [0.08, 0.1, 0.03, 0, -0.01, 0.23, 0x334155], [0.03, 0.03, 0.08, 0, -0.04, -0.33, 0xf59e0b]]),
  pompe: model([[0.09, 0.11, 0.3, 0, 0, -0.1, 0x3f3f46], [0.05, 0.05, 0.6, 0, 0.03, -0.52, 0x18181b], [0.045, 0.045, 0.5, 0, -0.04, -0.47, 0x27272a], [0.08, 0.075, 0.22, 0, -0.04, -0.46, 0x92400e], ...[0, 1, 2, 3].map(i => [0.082, 0.077, 0.015, 0, -0.04, -0.38 - i * 0.05, 0x6b3410]), [0.02, 0.02, 0.02, 0, 0.065, -0.8, 0xfde68a, 1], [0.054, 0.054, 0.04, 0, 0.03, -0.83, 0x111111],
    [0.1, 0.13, 0.3, 0, -0.04, 0.16, 0x92400e], [0.102, 0.04, 0.02, 0, -0.03, 0.08, 0x6b3410], [0.104, 0.15, 0.03, 0, -0.04, 0.31, 0x111111], [0.06, 0.15, 0.07, 0, -0.12, -0.02, 0x78350f], [0.02, 0.02, 0.09, 0, -0.07, -0.07, 0x111111],
    [0.01, 0.06, 0.16, 0.05, 0.0, -0.12, 0x1f2937], ...[0, 1, 2].map(i => [0.02, 0.025, 0.035, 0.06, 0.0, -0.06 - i * 0.05, 0xdc2626]), ...[0, 1, 2].map(i => [0.022, 0.026, 0.01, 0.061, 0.0, -0.08 - i * 0.05, 0xfacc15])]),
  sniper: model([[0.08, 0.1, 0.5, 0, 0, -0.18, 0x14532d], [0.042, 0.042, 0.55, 0, 0.01, -0.7, 0x111827], [0.065, 0.065, 0.09, 0, 0.01, -1.0, 0x0b0b0b], [0.068, 0.03, 0.02, 0, 0.01, -0.98, 0x374151], [0.068, 0.03, 0.02, 0, 0.01, -1.02, 0x374151],
    [0.075, 0.075, 0.34, 0, 0.12, -0.2, 0x111827], [0.09, 0.09, 0.07, 0, 0.12, -0.38, 0x111827], [0.085, 0.085, 0.05, 0, 0.12, -0.03, 0x111827], [0.06, 0.06, 0.004, 0, 0.12, -0.415, 0x60a5fa, 1], [0.03, 0.04, 0.03, 0, 0.165, -0.2, 0x374151], [0.03, 0.03, 0.03, 0.05, 0.12, -0.2, 0x374151],
    [0.02, 0.05, 0.02, 0, 0.065, -0.12, 0x0b0b0b], [0.02, 0.05, 0.02, 0, 0.065, -0.29, 0x0b0b0b], [0.04, 0.02, 0.06, 0.06, 0.03, -0.02, 0x9ca3af], [0.025, 0.025, 0.025, 0.09, 0.03, -0.0, 0x111111],
    [0.09, 0.14, 0.28, 0, -0.04, 0.16, 0x166534], [0.092, 0.05, 0.12, 0, 0.05, 0.14, 0x15803d], [0.06, 0.15, 0.07, 0, -0.12, -0.04, 0x111827], [0.06, 0.12, 0.08, 0, -0.12, -0.2, 0x1f2937], [0.015, 0.015, 0.2, -0.03, -0.06, -0.5, 0x111827], [0.015, 0.015, 0.2, 0.03, -0.06, -0.5, 0x111827],
    [0.03, 0.03, 0.03, 0.02, 0.02, -0.3, 0x3f6212], [0.03, 0.03, 0.03, -0.02, -0.02, -0.12, 0x3f6212]]),
  pistol: model([[0.06, 0.07, 0.3, 0, 0.03, -0.24, 0x27272a], ...[0, 1, 2, 3].map(i => [0.062, 0.05, 0.008, 0, 0.035, -0.12 - i * 0.022, 0x111111]), [0.055, 0.045, 0.26, 0, -0.025, -0.22, 0x18181b], [0.03, 0.03, 0.02, 0, 0.03, -0.395, 0x0b0b0b], [0.016, 0.02, 0.016, 0, 0.075, -0.37, 0x111111], [0.035, 0.02, 0.016, 0, 0.075, -0.11, 0x111111], [0.008, 0.008, 0.004, -0.01, 0.083, -0.105, 0x4ade80, 1], [0.008, 0.008, 0.004, 0.01, 0.083, -0.105, 0x4ade80, 1], [0.006, 0.008, 0.004, 0, 0.085, -0.375, 0x4ade80, 1],
    [0.056, 0.18, 0.085, 0, -0.13, -0.11, 0x18181b], ...[0, 1, 2, 3, 4].map(i => [0.058, 0.01, 0.087, 0, -0.07 - i * 0.03, -0.11, 0x27272a]), [0.06, 0.02, 0.09, 0, -0.225, -0.11, 0x3f3f46], [0.015, 0.02, 0.09, 0, -0.07, -0.2, 0x111111], [0.01, 0.03, 0.01, 0, -0.06, -0.18, 0x9ca3af]]),
  knife: model([[0.018, 0.06, 0.3, 0, 0.03, -0.36, 0xd4d4d8], [0.019, 0.016, 0.28, 0, 0.0, -0.35, 0xf4f4f5], [0.018, 0.035, 0.07, 0, 0.045, -0.53, 0xd4d4d8], [0.018, 0.018, 0.04, 0, 0.03, -0.56, 0xe4e4e7], [0.02, 0.01, 0.2, 0, 0.06, -0.33, 0x71717a],
    [0.07, 0.13, 0.025, 0, 0.02, -0.2, 0x111827], [0.045, 0.07, 0.18, 0, 0.02, -0.09, 0x3f2a1d], ...[0, 1, 2, 3].map(i => [0.047, 0.072, 0.012, 0, 0.02, -0.03 - i * 0.04, 0x1c1917]), [0.055, 0.08, 0.03, 0, 0.02, 0.01, 0x111827]]),
  rpg: model([[0.16, 0.16, 0.95, 0.02, 0.02, -0.2, 0x4d7c0f], [0.2, 0.2, 0.08, 0.02, 0.02, -0.68, 0x365314], [0.2, 0.2, 0.06, 0.02, 0.02, 0.28, 0x365314], [0.22, 0.22, 0.04, 0.02, 0.02, 0.31, 0x1f2937], [0.12, 0.12, 0.1, 0.02, 0.02, -0.76, 0xf97316], [0.08, 0.08, 0.08, 0.02, 0.02, -0.84, 0xfb923c], [0.04, 0.04, 0.05, 0.02, 0.02, -0.9, 0xfde68a],
    [0.06, 0.17, 0.07, 0.02, -0.14, -0.1, 0x1f2937], [0.05, 0.12, 0.06, 0.02, -0.12, -0.4, 0x1f2937], [0.04, 0.09, 0.12, 0.02, 0.15, -0.3, 0x111827], [0.04, 0.03, 0.004, 0.02, 0.18, -0.36, 0xfacc15, 1], [0.17, 0.03, 0.4, 0.02, 0.105, -0.1, 0x3f6212], [0.165, 0.165, 0.02, 0.02, 0.02, -0.5, 0xfacc15]])
};
const flash = new T.Mesh(new T.SphereGeometry(0.07, 6, 6), new T.MeshBasicMaterial({ color: 0xffd166 })); flash.visible = false; gun.add(flash);
gun.scale.setScalar(0.55); gun.position.set(0.2, -0.17, -0.32);
let cur = 0, swapT = 0, reloadT = 0, cool = 0, recoil = 0, shots = 0, hits = 0;
const ammo = {}, reserve = {};
const W = () => WEAPONS[cur];
function refillAll() { for (const w of WEAPONS) { ammo[w.id] = w.mag; reserve[w.id] = w.reserve; } reloadT = 0; $("#reloadTxt").textContent = ""; }
let knifeT = 0, prevWeapon = null;
function quickKnife() { const k = WEAPONS.findIndex(w => w.melee); if (cur !== k) { const pw = cur; equip(k, true); prevWeapon = pw; swapT = 0.12; fireQueued = true; } else fireQueued = true; }
refillAll();
function equip(n, keepPrev) {
  if (!keepPrev) prevWeapon = null;
  if (n === cur && MODELS[W().id].visible) return;
  cur = n; reloadT = 0; swapT = 0.35; $("#reloadTxt").textContent = ""; fireQueued = false;
  for (const k in MODELS) MODELS[k].visible = k === W().id;
  flash.position.set(W().id === "rpg" ? 0.02 : 0, 0.02, W().mz);
  wbar(); hudAmmo();
}
function reload() {
  const w = W(); if (state !== "play" || w.melee || reloadT > 0 || ammo[w.id] === w.mag) return;
  if (w.reserve !== undefined && reserve[w.id] <= 0) { floatTxt("Plus de briques !"); return; }
  reloadT = w.reload; $("#reloadTxt").textContent = "Rechargement…"; snd("reload");
}
function wbar() { $("#wbar").innerHTML = WEAPONS.map((w, i) => `<span class="${i === cur ? "on" : ""}">${i + 1} ${w.short}</span>`).join(""); }
function hudAmmo() { const w = W(); $("#ammo").textContent = w.melee ? "Corps à corps" : w.reserve !== undefined ? `${ammo[w.id]} · ${reserve[w.id]} en réserve` : `${ammo[w.id]} / ${w.mag}`; $("#wname").textContent = w.name + (crouch ? " · accroupi" : ""); }
equip(0);

/* ---------- effets ---------- */
const allMeshes = g => { const out = []; g.traverse(o => { if (o.isMesh) out.push(o); }); return out; };
const enemies = [], ray = new T.Raycaster(), tracers = [], sparks = [], bolts = [], rockets = [], booms = [];
function spark(x, y, z, c) { const m = new T.Mesh(geo, mat(c, true)); m.scale.setScalar(0.12); m.position.set(x, y, z); m.userData.v = new T.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6); m.userData.l = 0.6; scene.add(m); sparks.push(m); }
function tracer(a, b, col) { const tr = new T.Line(new T.BufferGeometry().setFromPoints([a, b]), new T.LineBasicMaterial({ color: col })); tr.userData.l = 0.05; scene.add(tr); tracers.push(tr); }
function explode(x, y, z) {
  snd("boom");
  const m = new T.Mesh(new T.SphereGeometry(1, 12, 10), new T.MeshBasicMaterial({ color: 0xffa94d, transparent: true, opacity: 0.85 })); m.position.set(x, y, z); m.userData.l = 0.35; scene.add(m); booms.push(m);
  for (let i = 0; i < 18; i++) spark(x, y + 0.3, z, [0xf97316, 0xfacc15, 0x78716c, 0xdc2626][i % 4]);
  const d = Math.hypot(P.x - x, P.z - z); if (d < 10) recoil = Math.max(recoil, 1 - d / 10);
}
let ft = 0; function floatTxt(s) { $("#banner").textContent = s; ft = 0.8; }
const hitMark = () => { snd("hit"); $("#cross").classList.add("hit"); setTimeout(() => $("#cross").classList.remove("hit"), 90); };

/* ---------- robots ---------- */
const SPAWNS = [[-32, -24], [32, -24], [-32, 24], [32, 24], [-32, 0], [32, 0], [0, -24], [0, 24]];
const RT = {
  grunt: { body: 0x9ca3af, scale: 1, hp: 3.4, speed: 2.5, melee: 14, pts: 100 },
  runner: { body: 0xf97316, scale: 0.85, bulk: 0.8, hp: 1.8, speed: 4.9, melee: 10, pts: 120, core: 0xfde047, fins: true },
  shooter: { body: 0x60a5fa, scale: 1, hp: 3, speed: 2.3, melee: 8, pts: 150, gun: true },
  sniper: { body: 0x14b8a6, scale: 1, hp: 2.4, speed: 2.0, melee: 6, pts: 220, gun: true, sniper: true, eye: 0x4ade80, core: 0x4ade80 },
  tank: { body: 0x7f1d1d, scale: 1.3, bulk: 1.35, hp: 10, speed: 1.8, melee: 26, pts: 250, armor: true, core: 0xf97316 },
  boss: { body: 0x6d28d9, scale: 2.0, bulk: 1.3, hp: 40, speed: 1.6, melee: 32, pts: 1000, gun: true, twin: true, horns: true, eye: 0xfacc15, core: 0xf0abfc, armor: true }
};
const RM = {}; const rmat = (c, k) => RM[k + c] || (RM[k + c] = k === "g" ? new T.MeshBasicMaterial({ color: c }) : new T.MeshLambertMaterial({ color: c, map: tex(k || "metal") }));
function makeRobot(type, wave) {
  const def = RT[type], g = new T.Group(), B = def.bulk || 1;
  const body = new T.MeshLambertMaterial({ color: def.body, map: tex("metal") }), dark = rmat(0x2a303a), mid = rmat(0x4b5563), visor = rmat(0x0b1220, "noise"), gunM = rmat(0x111827);
  const eyeM = new T.MeshBasicMaterial({ color: def.eye || 0xef4444 }), coreM = rmat(def.core || 0x22d3ee, "g");
  const part = (par, w, h, d, x, y, z, m, head) => { const k = new T.Mesh(geo, m); k.scale.set(w, h, d); k.position.set(x, y, z); k.castShadow = !isTouch; k.userData.head = !!head; par.add(k); return k; };
  const joint = (par, x, y, z) => { const p = new T.Group(); p.position.set(x, y, z); par.add(p); return p; };
  // bassin, torse, plaque de poitrine, cœur lumineux, sac à dos
  part(g, 0.6 * B, 0.22, 0.36, 0, 0.72, 0, dark);
  part(g, 0.78 * B, 0.6, 0.48, 0, 1.12, 0, body); part(g, 0.68 * B, 0.2, 0.46, 0, 1.5, 0, body);
  part(g, 0.5 * B, 0.36, 0.06, 0, 1.16, 0.25, mid); part(g, 0.16, 0.16, 0.04, 0, 1.18, 0.29, coreM);
  for (const sx of [-1, 1]) part(g, 0.06, 0.24, 0.04, sx * 0.19 * B, 1.16, 0.285, dark);
  part(g, 0.5 * B, 0.5, 0.22, 0, 1.2, -0.34, dark); part(g, 0.07, 0.22, 0.07, 0.17 * B, 1.52, -0.4, mid); part(g, 0.07, 0.22, 0.07, -0.17 * B, 1.52, -0.4, mid);
  if (def.armor) { part(g, 0.86 * B, 0.12, 0.54, 0, 0.92, 0, mid); part(g, 0.3, 0.5, 0.06, -0.24 * B, 1.15, 0.28, body); part(g, 0.3, 0.5, 0.06, 0.24 * B, 1.15, 0.28, body); }
  // épaulières
  for (const sx of [-1, 1]) { part(g, 0.32, 0.2, 0.44, sx * 0.52 * B, 1.56, 0, body); part(g, 0.34, 0.05, 0.46, sx * 0.52 * B, 1.67, 0, mid); }
  // tête : casque, visière, yeux, antenne
  part(g, 0.2, 0.12, 0.2, 0, 1.66, 0, dark, true);
  const head = joint(g, 0, 1.88, 0);
  part(head, 0.5, 0.4, 0.46, 0, 0, 0, body, true); part(head, 0.54, 0.07, 0.5, 0, 0.22, 0, dark, true); part(head, 0.44, 0.13, 0.04, 0, 0.03, 0.235, visor, true);
  const e1 = part(head, 0.1, 0.06, 0.02, -0.1, 0.03, 0.26, eyeM, true), e2 = part(head, 0.1, 0.06, 0.02, 0.1, 0.03, 0.26, eyeM, true);
  part(head, 0.05, 0.12, 0.3, -0.26, -0.02, 0, mid, true); part(head, 0.05, 0.12, 0.3, 0.26, -0.02, 0, mid, true);
  part(head, 0.04, 0.26, 0.04, 0.15, 0.36, -0.08, mid, true); part(head, 0.08, 0.08, 0.08, 0.15, 0.52, -0.08, coreM, true);
  if (def.fins) for (let k = 0; k < 3; k++) part(head, 0.06, 0.16 - k * 0.03, 0.12, 0, 0.3 - k * 0.02, 0.1 - k * 0.14, body, true);
  if (def.horns) for (const sx of [-1, 1]) { part(head, 0.08, 0.22, 0.08, sx * 0.22, 0.32, 0.05, mid, true); part(head, 0.06, 0.14, 0.06, sx * 0.26, 0.48, 0.08, eyeM, true); }
  // bras articulés (pivot à l'épaule)
  const arm = sx => { const p = joint(g, sx * 0.52 * B, 1.46, 0); part(p, 0.2, 0.38, 0.2, 0, -0.2, 0, dark); part(p, 0.17, 0.08, 0.17, 0, -0.42, 0, mid); part(p, 0.19, 0.34, 0.19, 0, -0.62, 0, body); part(p, 0.22, 0.14, 0.24, 0, -0.86, 0.02, dark); return p; };
  const armL = arm(-1), armR = arm(1);
  const cannon = (p, long) => { part(p, 0.17, long ? 1.0 : 0.62, 0.17, 0, long ? -1.05 : -0.95, 0, gunM); part(p, 0.2, 0.08, 0.2, 0, long ? -1.55 : -1.27, 0, mid); part(p, 0.09, 0.03, 0.09, 0, long ? -1.58 : -1.3, 0, def.sniper ? rmat(0x4ade80, "g") : rmat(0xff3b3b, "g")); if (long) { part(p, 0.12, 0.3, 0.12, 0, -0.9, 0.14, gunM); part(p, 0.1, 0.02, 0.1, 0, -0.74, 0.14, rmat(0x4ade80, "g")); } };
  if (def.gun) { cannon(armR, def.sniper); armR.rotation.x = -1.45; if (def.twin) { cannon(armL, false); armL.rotation.x = -1.45; } }
  else { for (const p of [armL, armR]) { part(p, 0.06, 0.12, 0.06, -0.07, -0.98, 0.06, mid); part(p, 0.06, 0.12, 0.06, 0.07, -0.98, 0.06, mid); } }
  // jambes (pivot à la hanche)
  const leg = sx => { const p = joint(g, sx * 0.18 * B, 0.66, 0); part(p, 0.24, 0.3, 0.26, 0, -0.15, 0, dark); part(p, 0.22, 0.09, 0.22, 0, -0.33, 0.02, mid); part(p, 0.22, 0.28, 0.24, 0, -0.5, 0, body); part(p, 0.27, 0.1, 0.4, 0, -0.61, 0.07, dark); return p; };
  const legL = leg(-1), legR = leg(1);
  const [sx, sz] = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
  g.position.set(sx + rnd(-1.5, 1.5), 0, sz + rnd(-1.5, 1.5)); g.scale.setScalar(def.scale); scene.add(g);
  const hpMul = 1 + (wave - 1) * 0.16, spMul = Math.min(2, 1 + (wave - 1) * 0.05);
  const e = { g, type, def, body, eyeM, legL, legR, armL, armR, head, y: 0, hp: def.hp * hpMul, speed: (def.speed + Math.random() * 0.35) * spMul, t: Math.random() * 6, flash: 0, stuck: 0, side: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rnd(1, 3), cd: rnd(0.8, 2.2), aim: 0, wave, laser: null, push: null };
  g.traverse(o => { if (o.isMesh) o.userData.enemy = e; });
  enemies.push(e);
}
function damageRobot(e, dmg, head) {
  e.hp -= dmg; e.flash = 0.08;
  if (e.hp <= 0 && enemies.includes(e)) killRobot(e, head);
}
function killRobot(e, head) {
  if (e.laser) { scene.remove(e.laser); e.laser = null; }
  scene.remove(e.g); enemies.splice(enemies.indexOf(e), 1); kills++; snd(head ? "head" : "robotDie"); if (head) setTimeout(() => snd("robotDie"), 60);
  const pts = Math.round(e.def.pts * (1 + (e.wave - 1) * 0.05)) + (head ? 50 : 0); score += pts; floatTxt(e.type === "boss" ? `BOSS DÉTRUIT · +${pts}` : head ? `+${pts} tête !` : `+${pts}`);
  const p = e.g.position;
  for (let i = 0; i < (e.type === "boss" ? 30 : 12); i++) spark(p.x, p.y + 0.5 + Math.random() * 1.6 * e.def.scale, p.z, [e.def.body, 0x4b5563, 0x22d3ee, 0xfacc15][i % 4]);
}
const aimY = () => P.y + (crouch ? 0.72 : 1.12);
function fireBolt(e) {
  const s = e.def.scale, ox = e.g.position.x, oy = e.y + 1.3 * s, oz = e.g.position.z, w = e.wave, sn = e.def.sniper;
  const err = sn ? 0.08 : Math.max(0.12, 0.95 - w * 0.07), spd = sn ? 70 : Math.min(34, 15 + w * 1.2), dmg = sn ? Math.min(45, 28 + w * 2) : e.type === "boss" ? 13 + w : Math.min(22, 8 + w);
  const tx = P.x + rnd(-err, err), ty = aimY() + rnd(-err, err) * 0.5, tz = P.z + rnd(-err, err);
  const n = e.type === "boss" ? 3 : 1; snd(sn ? "zap" : "pew");
  for (let i = 0; i < n; i++) {
    const a = (i - (n - 1) / 2) * 0.14, dx = tx - ox, dz = tz - oz, ca = Math.cos(a), sa = Math.sin(a);
    const v = new T.Vector3(dx * ca - dz * sa, ty - oy, dx * sa + dz * ca).normalize().multiplyScalar(spd);
    const m = new T.Mesh(geo, mat(e.type === "boss" ? 0xc084fc : sn ? 0x4ade80 : 0xff3b3b, true)); m.scale.set(sn ? 0.1 : 0.2, sn ? 0.1 : 0.2, sn ? 0.9 : 0.2); m.position.set(ox + v.x / spd * 0.6, oy, oz + v.z / spd * 0.6); m.lookAt(m.position.clone().add(v)); scene.add(m);
    bolts.push({ m, v, l: 3, dmg });
  }
}
// navigation : entrer par une porte, monter ou descendre l'escalier
const houseOf = (x, z) => HOUSES.find(h => x > h.x0 && x < h.x0 + h.w && z > h.z0 && z < h.z0 + h.d);
function navTarget(e) {
  const x = e.g.position.x, z = e.g.position.z, hp = houseOf(P.x, P.z), he = houseOf(x, z), up = P.y > 2.5, eup = e.y > 2.5;
  const near = (p, r) => Math.hypot(p[0] - x, p[1] - z) < r;
  const door = h => h.doors.slice().sort((a, b) => Math.hypot(a[0] - x, a[1] - z) - Math.hypot(b[0] - x, b[1] - z))[0];
  if (eup && he && !(up && hp === he)) return near(he.st, 0.9) || e.y < he.F - 0.2 ? he.sb : he.st;            // redescendre
  if (he && hp !== he) { const dr = door(he); return near([dr[2], dr[3]], 0.8) ? [dr[0], dr[1]] : [dr[2], dr[3]]; } // sortir
  if (hp && he !== hp) { const dr = door(hp); return near([dr[0], dr[1]], 0.9) ? [dr[2], dr[3]] : [dr[0], dr[1]]; } // entrer
  if (up && he && he === hp && !eup && !(z > he.z0 + 0.95 && z < he.z0 + he.d - 0.95) && !near(he.sb, 1.2)) { const dr = door(he); if (!near([dr[2], dr[3]], 0.5)) return [dr[2], dr[3]]; } // s'écarter du mur de la porte
  if (hp && he === hp && up && !eup) return near(hp.sb, 0.8) || e.y > 0.25 ? hp.st : hp.sb;               // monter
  return null;
}
function moveRobot(e, vx, vz, dt) {
  const s = e.speed * dt, p = e.g.position, ox = p.x, oz = p.z, r = 0.33 * Math.min(1.4, e.def.scale);
  if (e.side) { const sd = e.side; [vx, vz] = [vx * 0.3 - vz * sd, vz * 0.3 + vx * sd]; e.stuck -= dt; if (e.stuck <= 0) e.side = 0; }
  if (!hitsAt(ox + vx * s, e.y, oz, r, 0.95)) p.x += vx * s; if (!hitsAt(p.x, e.y, oz + vz * s, r, 0.95)) p.z += vz * s;
  const moved = Math.hypot(p.x - ox, p.z - oz);
  if (moved < s * 0.3 && !e.side) { e.side = Math.random() < 0.5 ? -1 : 1; e.stuck = 0.9; }
  return moved;
}
function updateRobots(dt) {
  for (const e of enemies.slice()) {
    const p = e.g.position, s = e.def.scale;
    // gravité et marches
    const gy = groundAt(p.x, p.z, e.y); e.y = gy >= e.y ? gy : Math.max(gy, e.y - 7 * dt); p.y = e.y;
    if (e.push) { e.push.t -= dt; if (!hitsAt(p.x + e.push.x * dt, e.y, p.z, 0.33, 0.95)) p.x += e.push.x * dt; if (!hitsAt(p.x, e.y, p.z + e.push.z * dt, 0.33, 0.95)) p.z += e.push.z * dt; if (e.push.t <= 0) e.push = null; }
    const ex = P.x - p.x, ez = P.z - p.z, d = Math.hypot(ex, ez), same = Math.abs(P.y - e.y) < 1.4;
    const nav = navTarget(e), tx = nav ? nav[0] : P.x, tz = nav ? nav[1] : P.z, md = Math.hypot(tx - p.x, tz - p.z) || 1, ux = (tx - p.x) / md, uz = (tz - p.z) / md;
    let moved = 0;
    if (e.def.gun) {
      e.cd -= dt; e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rnd(0.8, 2.4); }
      const sn = e.def.sniper, see = d < (sn ? 70 : 45) && los(p.x, e.y + 1.3 * s, p.z, P.x, P.y + (crouch ? 0.9 : 1.4), P.z);
      if (e.aim > 0) {
        e.aim -= dt; e.eyeM.color.setHex(Math.sin(e.aim * 60) > 0 ? 0xffffff : (e.def.eye || 0xff0000));
        if (sn) { const a = new T.Vector3(p.x, e.y + 1.3 * s, p.z), b = new T.Vector3(P.x, aimY(), P.z); if (!e.laser) { e.laser = new T.Line(new T.BufferGeometry().setFromPoints([a, b]), new T.LineBasicMaterial({ color: 0xff2d2d })); scene.add(e.laser); } else e.laser.geometry.setFromPoints([a, b]); }
        if (e.aim <= 0) { e.eyeM.color.setHex(e.def.eye || 0xef4444); if (e.laser) { scene.remove(e.laser); e.laser = null; } if (see) fireBolt(e); e.cd = sn ? rnd(3, 4) : e.type === "boss" ? rnd(1.1, 1.6) : Math.max(0.7, 2.5 - e.wave * 0.14) + rnd(0, 0.5); }
      } else if (see && e.cd <= 0 && d < (sn ? 65 : 30)) { e.aim = sn ? 1.1 : e.type === "boss" ? 0.5 : Math.max(0.22, 0.42 - e.wave * 0.015); if (sn) snd("laser"); }
      else if (e.type === "boss" && (d > 2.4 || nav)) moved = moveRobot(e, ux, uz, dt);
      else if (!see || d > (sn ? 32 : 17)) moved = moveRobot(e, ux, uz, dt);
      else if (d < (sn ? 16 : 8)) moved = moveRobot(e, -ux * 0.8 - uz * e.strafe * 0.6, -uz * 0.8 + ux * e.strafe * 0.6, dt);
      else moved = moveRobot(e, -uz * e.strafe, ux * e.strafe, dt * 0.85);
    } else if (d > 1.25 * s || !same || nav) moved = moveRobot(e, ux, uz, dt);
    e.g.rotation.y = Math.atan2(nav && !e.aim ? tx - p.x : ex, nav && !e.aim ? tz - p.z : ez);
    if (d <= 1.3 * s && same) { P.hp -= (e.def.melee + e.wave * (e.type === "tank" ? 1.8 : 1.2)) * dt; hurt = 0.4; if (performance.now() - hurtSnd > 450) { hurtSnd = performance.now(); snd("hurt"); } }
    e.t += dt * (moved > 0.001 ? e.speed * 3 : 1);
    const sw = Math.sin(e.t) * (moved > 0.001 ? 0.55 : 0.08);
    e.legL.rotation.x = sw; e.legR.rotation.x = -sw;
    if (!e.def.gun) { e.armL.rotation.x = d < 2 * s ? -1.2 + Math.sin(e.t * 3) * 0.6 : -sw * 0.9; e.armR.rotation.x = d < 2 * s ? -1.2 - Math.sin(e.t * 3) * 0.6 : sw * 0.9; }
    else if (!e.def.twin) e.armL.rotation.x = -sw * 0.8;
    e.head.rotation.y = Math.sin(e.t * 0.3) * 0.15;
    if (e.flash > 0) { e.flash -= dt; e.body.emissive.set(0xffffff); } else e.body.emissive.set(0x000000);
  }
  // les robots ne s'empilent pas
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    if (Math.abs(enemies[i].y - enemies[j].y) > 1) continue;
    const a = enemies[i].g.position, b = enemies[j].g.position, dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz), min = 0.45 * (enemies[i].def.scale + enemies[j].def.scale);
    if (dd > 0 && dd < min) { const push = (min - dd) / 2, px = dx / dd * push, pz = dz / dd * push; if (!hitsAt(a.x - px, enemies[i].y, a.z - pz, 0.3, 0.95)) { a.x -= px; a.z -= pz; } if (!hitsAt(b.x + px, enemies[j].y, b.z + pz, 0.3, 0.95)) { b.x += px; b.z += pz; } }
  }
}
function updateBolts(dt) {
  for (const b of bolts.slice()) {
    b.l -= dt; b.m.position.addScaledVector(b.v, dt); const p = b.m.position;
    let gone = b.l <= 0 || p.y < 0;
    if (!gone && state === "play" && mode === "solo" && Math.hypot(p.x - P.x, p.z - P.z) < 0.5 && p.y > P.y && p.y < P.y + (crouch ? 1.2 : 1.85)) { P.hp -= b.dmg; hurt = 0.6; gone = true; snd("hurt"); }
    if (!gone && inSolid(p.x, p.y, p.z)) { spark(p.x, p.y, p.z, 0xff6b6b); gone = true; }
    if (gone) { scene.remove(b.m); bolts.splice(bolts.indexOf(b), 1); }
  }
}

/* ---------- tir ---------- */
function stab(w) {
  cool = w.rate; knifeT = 0.28; shots++; snd("knife");
  ray.setFromCamera({ x: 0, y: 0 }, camera); ray.far = w.range;
  const targets = shootables.concat(mode === "mp" ? MPH().targets() : enemies.flatMap(e => e.g.children.length ? allMeshes(e.g) : [])), hit = ray.intersectObjects(targets, false)[0];
  ray.far = Infinity;
  if (mode === "mp") MPH().onShot();
  if (!hit) return;
  const head = !!hit.object.userData.head;
  if (hit.object.userData.remote) { hits++; if (MPH().hit(hit.object.userData.remote, head, hit.point, Math.round(w.pdmg * (head ? 1.5 : 1)), w.id)) hitMark(); }
  else if (hit.object.userData.enemy) { hits++; hitMark(); const e = hit.object.userData.enemy; damageRobot(e, w.rdmg * (head ? 1.5 : 1), head); const p = e.g.position, d = Math.hypot(p.x - P.x, p.z - P.z) || 1; e.push = { x: (p.x - P.x) / d * 3, z: (p.z - P.z) / d * 3, t: 0.2 }; }
  else spark(hit.point.x, hit.point.y, hit.point.z, 0xffffff);
}
function shoot() {
  const w = W();
  if (w.melee) { stab(w); return; }
  if (ammo[w.id] <= 0) { snd("empty"); reload(); return; }
  ammo[w.id]--; shots++; cool = w.rate; snd(w.rocket ? "rpg" : w.id); recoil = 1; flash.visible = true; setTimeout(() => flash.visible = false, 45); muzzleFx(w);
  P.pitch = Math.min(1.45, P.pitch + w.kick * (aimHeld ? 0.6 : 1));
  const start = new T.Vector3(0.22, -0.18, -1).applyMatrix4(camera.matrixWorld);
  if (mode === "mp") MPH().onShot();
  const scoped = aimHeld && camera.fov < w.zoom + 6, sp = (w.scope ? (scoped ? 0 : w.spread) : w.spread * (aimHeld ? 0.45 : 1)) * (crouch ? 0.6 : 1);
  if (w.rocket) {
    ray.setFromCamera({ x: 0, y: 0 }, camera);
    const m = new T.Group(); const body = new T.Mesh(geo, mat(0x4d7c0f)); body.scale.set(0.16, 0.16, 0.5); const tip = new T.Mesh(geo, mat(0xf97316, true)); tip.scale.set(0.18, 0.18, 0.12); tip.position.z = -0.3; const fire = new T.Mesh(geo, mat(0xfacc15, true)); fire.scale.set(0.12, 0.12, 0.25); fire.position.z = 0.35; m.add(body, tip, fire);
    m.position.copy(start); m.lookAt(start.clone().add(ray.ray.direction)); m.rotateY(Math.PI); scene.add(m);
    rockets.push({ m, v: ray.ray.direction.clone().multiplyScalar(38), l: 3.5, smoke: 0 });
    if (ammo[w.id] === 0) reload(); hudAmmo(); return;
  }
  const remote = {}; let touched = false;
  for (let k = 0; k < w.pellets; k++) {
    ray.setFromCamera({ x: (Math.random() - 0.5) * sp, y: (Math.random() - 0.5) * sp }, camera); ray.far = w.range;
    const targets = shootables.concat(mode === "mp" ? MPH().targets() : enemies.flatMap(e => allMeshes(e.g))), hit = ray.intersectObjects(targets, false)[0];
    const end = hit ? hit.point : ray.ray.at(w.range, new T.Vector3());
    if (k < 3) tracer(start, end, w.col);
    if (hit && hit.object.userData.remote) { const u = hit.object.userData.remote; remote[u] = remote[u] || { dmg: 0, head: false, pt: end }; remote[u].dmg += w.pdmg * (hit.object.userData.head ? 2 : 1); remote[u].head = remote[u].head || hit.object.userData.head; }
    else if (hit && hit.object.userData.enemy) { hits += 1 / w.pellets; touched = true; damageRobot(hit.object.userData.enemy, w.rdmg * (hit.object.userData.head ? 2 : 1), hit.object.userData.head); }
    else if (hit) { spark(end.x, end.y, end.z, 0xdddddd); if (k < 2) impactDecal(hit); }
  }
  ray.far = Infinity;
  for (const [u, r] of Object.entries(remote)) { hits++; if (MPH().hit(u, r.head, r.pt, Math.round(r.dmg), w.id)) touched = true; }
  if (touched) hitMark();
  if (ammo[w.id] === 0) reload();
  hudAmmo();
}
function updateRockets(dt) {
  for (const r of rockets.slice()) {
    const from = r.m.position.clone(), step = r.v.clone().multiplyScalar(dt), len = step.length();
    r.l -= dt; r.smoke -= dt; if (r.smoke <= 0) { r.smoke = 0.03; const s = new T.Mesh(geo, mat(0xd6d3d1, true)); s.scale.setScalar(0.18); s.position.copy(from); s.userData.v = new T.Vector3(0, 0.4, 0); s.userData.l = 0.5; scene.add(s); sparks.push(s); }
    ray.set(from, r.v.clone().normalize()); ray.far = len;
    const targets = shootables.concat(mode === "mp" ? MPH().targets() : enemies.flatMap(e => allMeshes(e.g))), hit = ray.intersectObjects(targets, false)[0];
    ray.far = Infinity;
    let at = null; if (hit) at = hit.point; else { r.m.position.add(step); if (r.m.position.y <= 0.05 || r.l <= 0) at = r.m.position.clone(); }
    if (at) { scene.remove(r.m); rockets.splice(rockets.indexOf(r), 1); blast(at); }
  }
}
function blast(at) {
  const w = WEAPONS.find(x => x.id === "rpg"); explode(at.x, at.y, at.z);
  if (mode === "mp") { if (MPH().blast(at, w.radius, w.pdmg, w.id)) { hits++; hitMark(); } return; }
  let any = false;
  for (const e of enemies.slice()) { const p = e.g.position, d = Math.hypot(p.x - at.x, p.y + e.def.scale - at.y, p.z - at.z); if (d < w.radius) { any = true; damageRobot(e, w.rdmg * (1 - d / w.radius * 0.6), false); } }
  if (any) { hits++; hitMark(); }
}

/* ---------- vagues ---------- */
let wave = 0, queue = [], spawnT = 0, between = 0, score = 0, kills = 0, medkits = [];
function buildQueue(w) {
  const n = Math.round(5 + w * 2.6 + Math.pow(w, 1.3)), out = [];
  const pS = Math.min(0.4, 0.14 + 0.035 * w), pR = w >= 2 ? Math.min(0.2, 0.08 + 0.015 * w) : 0, pT = w >= 3 ? Math.min(0.2, 0.05 + 0.02 * w) : 0, pN = w >= 5 ? Math.min(0.15, 0.04 + 0.012 * w) : 0;
  for (let i = 0; i < n; i++) { const r = Math.random(); out.push(r < pS ? "shooter" : r < pS + pR ? "runner" : r < pS + pR + pT ? "tank" : r < pS + pR + pT + pN ? "sniper" : "grunt"); }
  if (w % 5 === 0) { out.splice(Math.floor(n / 3), 0, "boss"); if (w >= 10) out.splice(Math.floor(n * 2 / 3), 0, "boss"); }
  return out;
}
function nextWave() {
  wave++; queue = buildQueue(wave); spawnT = 1.5; snd(wave % 5 === 0 ? "boss" : "wave"); $("#wave").textContent = `Vague ${wave}`;
  $("#banner").textContent = wave % 5 === 0 ? `Vague ${wave} · ${wave >= 10 ? "deux BOSS" : "un BOSS"} arrive${wave >= 10 ? "nt" : ""} !` : wave === 5 ? "Vague 5 · attention aux robots snipers (laser rouge) !" : `Vague ${wave}`; ft = 2.2;
}
function medkit() { const x = (Math.random() - 0.5) * 40, z = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 1.5); const m = new T.Mesh(geo, new T.MeshLambertMaterial({ color: 0xffffff })); m.scale.set(0.6, 0.4, 0.6); m.position.set(x, 0.3, z); const c1 = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xdc2626 })); c1.scale.set(0.7, 0.3, 0.3); const c2 = c1.clone(); c2.scale.set(0.3, 0.3, 0.7); c1.position.y = c2.position.y = 0.05; m.add(c1, c2); scene.add(m); medkits.push(m); }

/* ---------- partie ---------- */
let best = 0; try { best = +localStorage.getItem("tir-best") || 0; } catch (e) {}
$("#best").textContent = best ? `Record : ${best} points` : "";
function clearWorld() {
  enemies.slice().forEach(e => { scene.remove(e.g); if (e.laser) scene.remove(e.laser); }); enemies.length = 0; medkits.forEach(m => scene.remove(m)); medkits = [];
  for (const b of bolts) scene.remove(b.m); bolts.length = 0; for (const r of rockets) scene.remove(r.m); rockets.length = 0;
}
function start() {
  clearWorld(); clearFx(); MOOD.k = 0; mode = "solo";
  Object.assign(P, { x: 6, y: 0, z: 2.2, vy: 0, yaw: Math.PI / 2, pitch: 0, hp: 100, ground: true });
  refillAll(); equip(0); crouch = false; crouchToggle = false; prevWeapon = null; score = 0; kills = 0; shots = 0; hits = 0; wave = 0; between = 0; aimHeld = false;
  state = "play"; $("#panel").hidden = true; nextWave(); hud();
  if (!isTouch && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
}
function pause() { state = "pause"; aimHeld = false; fireHeld = false; $("#panel").hidden = false; $("#panel").innerHTML = mode === "mp" ? `<h1>Pause</h1><p>La partie continue pendant ta pause !</p><button class="btn" id="resume">Reprendre</button><br><button class="ghost" id="quitmp">Quitter la partie</button>` : `<h1>Pause</h1><p>Vague ${wave} · ${score} points</p><button class="btn" id="resume">Reprendre</button><br><a class="ghost" href="../">← Arcade</a>`; if (mode === "mp") $("#quitmp").onclick = () => MPH().leave(); $("#resume").onclick = () => { state = "play"; $("#panel").hidden = true; if (!isTouch && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} } }; }
function gameOver() {
  state = "over"; aimHeld = false; snd("over"); if (document.exitPointerLock) document.exitPointerLock();
  const acc = shots ? Math.min(100, Math.round(hits / shots * 100)) : 0, bonus = Math.round(score * acc / 400), total = score + bonus;
  const rec = total > best; if (rec) { best = total; try { localStorage.setItem("tir-best", total); } catch (e) {} }
  if (window.ONLINE) window.ONLINE.submit("tir", g => Object.assign(g, { best: Math.max(total, g.best || 0), wave: Math.max(wave, g.wave || 0), kills: (g.kills || 0) + kills, games: (g.games || 0) + 1 }));
  $("#panel").hidden = false;
  $("#panel").innerHTML = `<h1>${rec ? "Nouveau record !" : "Éliminé"}</h1><p>Vague ${wave} · ${kills} robots · précision ${acc} %</p><p><b>${score}</b> + bonus précision ${bonus} = <b style="color:#4ade80;font-size:22px">${total} points</b></p><p>Record : ${best}</p><button class="btn" id="again">Rejouer</button><br><a class="ghost" href="../">← Arcade</a>`;
  $("#again").onclick = start;
}
$("#go").onclick = start;
function hud() {
  $("#hp").style.width = Math.max(0, P.hp) + "%"; hudAmmo();
  if (mode === "mp") return;
  $("#score").textContent = score;
  const left = enemies.length + queue.length;
  $("#left").textContent = state === "play" ? `${left} robot${left > 1 ? "s" : ""} restant${left > 1 ? "s" : ""}` : "";
}

/* ---------- boucle ---------- */
let last = performance.now(), hurt = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const aliveMP = mode !== "mp" || (MPH() && MPH().alive());
  if (mode === "mp" && MPH()) MPH().update(dt, state === "play");
  const w = W();
  if (state === "play" && aliveMP) {
    // déplacement
    let fx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") || keys.has("KeyQ") ? 1 : 0) + mv.x, fz = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") || keys.has("KeyZ") ? 1 : 0) + mv.z;
    const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
    const wantC = crouchHeld || crouchToggle; if (wantC !== crouch) { if (wantC || !hitsAt(P.x, P.y, P.z, R, 0, 1.7)) { crouch = wantC; hudAmmo(); } }
    const sp = (crouch ? 2.7 : keys.has("ShiftLeft") && !aimHeld ? 7.5 : aimHeld ? 3.6 : 5.2) * w.speed * dt, sn = Math.sin(P.yaw), cs = Math.cos(P.yaw);
    const dx = (fx * cs + fz * sn) * sp, dz = (-fx * sn + fz * cs) * sp;
    if (!hitsAt(P.x + dx, P.y, P.z, R, 0, PH())) P.x += dx; if (!hitsAt(P.x, P.y, P.z + dz, R, 0, PH())) P.z += dz;
    P.vy -= 16 * dt; P.y += P.vy * dt; const gy = groundAt(P.x, P.z, P.y);
    if (P.y <= gy) { P.y = gy; P.vy = 0; P.ground = true; } else if (P.y - gy > 0.05) P.ground = false;
    if (hitsAt(P.x, P.y, P.z, R, 0, PH()) && P.vy > 0) P.vy = 0;
    // arme
    cool -= dt; swapT = Math.max(0, swapT - dt);
    if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { if (w.reserve !== undefined) { const n = Math.min(w.mag - ammo[w.id], reserve[w.id]); ammo[w.id] += n; reserve[w.id] -= n; } else ammo[w.id] = w.mag; $("#reloadTxt").textContent = ""; } }
    if ((w.auto ? fireHeld : fireQueued) && cool <= 0 && reloadT <= 0 && swapT <= 0) { fireQueued = false; shoot(); }
    if (!w.auto && cool > 0 && !fireHeld) fireQueued = false;
    if (knifeT > 0) { knifeT -= dt; if (knifeT <= 0 && prevWeapon !== null && W().melee && !fireHeld && keys.has("KeyF") === false && prevWeapon !== cur) { equip(prevWeapon); prevWeapon = null; } }
    recoil = Math.max(0, recoil - dt * 8);
    if (mode === "solo") {
      // vagues
      const maxAlive = Math.min(26, 9 + wave);
      if (queue.length) { spawnT -= dt; if (spawnT <= 0 && enemies.length < maxAlive) { makeRobot(queue.shift(), wave); spawnT = Math.max(0.25, 1.0 - wave * 0.07); } }
      else if (!enemies.length) { if (between <= 0) { between = 3.5; const b = 250 * wave; score += b; $("#banner").textContent = `Vague ${wave} nettoyée · +${b}`; ft = 2.4; medkit(); P.hp = Math.min(100, P.hp + 15); reserve.rpg = Math.min(6, reserve.rpg + 2); } else { between -= dt; if (between <= 0) nextWave(); } }
      updateRobots(dt);
      for (const m of medkits.slice()) { m.rotation.y += dt * 2; if (Math.hypot(m.position.x - P.x, m.position.z - P.z) < 1.2) { P.hp = Math.min(100, P.hp + 40); snd("heal"); scene.remove(m); medkits.splice(medkits.indexOf(m), 1); floatTxt("+40 santé"); } }
    }
  }
  if (mode === "solo" && state === "play") { updateBolts(dt); if (P.hp <= 0) { P.hp = 0; gameOver(); } }
  updateRockets(dt);
  if (state === "play" || mode === "mp") hud();
  // visée et lunette
  const aiming = aimHeld && state === "play" && aliveMP && reloadT <= 0 && swapT <= 0, tf = aiming ? w.zoom : BASEFOV;
  if (Math.abs(camera.fov - tf) > 0.05) { camera.fov += (tf - camera.fov) * Math.min(1, dt * 14); camera.updateProjectionMatrix(); }
  const scoped = aiming && w.scope && camera.fov < w.zoom + 6;
  $("#scope").hidden = !scoped; gun.visible = !scoped && aliveMP; $("#cross").style.opacity = scoped ? 0 : aiming ? 0.5 : 1;
  gun.position.set(aiming ? 0.02 : 0.2, aiming ? -0.12 : -0.17, -0.32 + recoil * 0.05);
  gun.rotation.x = recoil * 0.1 - (reloadT > 0 ? 0.6 : 0) - swapT * 2.2;
  if (W().melee) { const k = knifeT > 0 ? Math.sin((1 - knifeT / 0.28) * Math.PI) : 0; gun.position.set(0.16 - k * 0.12, -0.2 + k * 0.05, -0.3 - k * 0.25); gun.rotation.set(-0.1 - k * 0.4, k * 0.6, k * 0.9); } else gun.rotation.set(gun.rotation.x, 0, 0);
  crouchK += ((crouch ? 1 : 0) - crouchK) * Math.min(1, dt * 12);
  hurt = Math.max(0, hurt - dt); $("#hurt").style.opacity = Math.min(1, hurt * 2);
  if (ft > 0) { ft -= dt; if (ft <= 0) $("#banner").textContent = ""; }
  for (const t of tracers.slice()) { t.userData.l -= dt; if (t.userData.l <= 0) { scene.remove(t); tracers.splice(tracers.indexOf(t), 1); } }
  for (const s of sparks.slice()) { s.userData.l -= dt; s.userData.v.y -= 12 * dt; s.position.addScaledVector(s.userData.v, dt); if (s.userData.l <= 0) { scene.remove(s); sparks.splice(sparks.indexOf(s), 1); } }
  for (const b of booms.slice()) { b.userData.l -= dt; const k = 1 - b.userData.l / 0.35; b.scale.setScalar(0.5 + k * 4); b.material.opacity = Math.max(0, 0.85 * (1 - k)); if (b.userData.l <= 0) { scene.remove(b); booms.splice(booms.indexOf(b), 1); } }
  for (const c of clouds) { c.position.x += dt * 0.8; if (c.position.x > 100) c.position.x = -100; }
  camera.position.set(P.x, P.y + EYE - 0.6 * crouchK, P.z); camera.rotation.set(P.pitch, P.yaw, 0, "YXZ");
  moodTick(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
/* ---------- ambiance : crépuscule, yeux qui brillent, flammes, douilles, impacts, herbe ---------- */
const MOOD = { k: 0, day: [0x8ecdf5, 0x9fd3f2, 0xfff1d6], dusk: [0xe0875a, 0xc98a6e, 0xff9a5a], night: [0x0d1230, 0x1a1f3d, 0x7b8be0] };
const _c1 = new T.Color(), _c2 = new T.Color();
function mix3(a, b, c, k) { if (k < 0.5) { _c1.setHex(a); _c2.setHex(b); return _c1.lerp(_c2, k * 2); } _c1.setHex(b); _c2.setHex(c); return _c1.lerp(_c2, (k - 0.5) * 2); }
function glowTex(r, gC, b) { const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, `rgba(${r},${gC},${b},1)`); gr.addColorStop(0.35, `rgba(${r},${gC},${b},.5)`); gr.addColorStop(1, `rgba(${r},${gC},${b},0)`); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); }
const EYEGLOW = glowTex(255, 60, 60), WHITEGLOW = glowTex(255, 255, 255);
// étoiles et lune
const starGeo = new T.BufferGeometry(), sp = []; for (let i = 0; i < 400; i++) { const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 1.2, r = 200; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
starGeo.setAttribute("position", new T.Float32BufferAttribute(sp, 3));
const stars = new T.Points(starGeo, new T.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(stars);
const moon = new T.Mesh(new T.SphereGeometry(6, 16, 12), new T.MeshBasicMaterial({ color: 0xfef3c7, fog: false, transparent: true, opacity: 0 })); moon.position.set(-90, 70, -120); scene.add(moon);
// éclair du canon : étoile lumineuse + lumière qui éclaire le décor
const flashStar = new T.Sprite(new T.SpriteMaterial({ map: WHITEGLOW, color: 0xffc35a, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); flashStar.scale.setScalar(0.5); flash.add(flashStar);
const gunLight = new T.PointLight(0xffb347, 0, 9, 2); gun.add(gunLight); gunLight.position.set(0, 0, -0.6);
// douilles et impacts
const shells = [], decals = [], SHELLM = new T.MeshLambertMaterial({ color: 0xd4a017 }), DECALM = new T.MeshBasicMaterial({ map: glowTex(20, 20, 24), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const decalGeo = new T.PlaneGeometry(0.22, 0.22), _n = new T.Vector3();
function muzzleFx(w) {
  if (w.melee) return;
  flashStar.material.rotation = Math.random() * 6; flashStar.scale.setScalar(w.rocket ? 0.9 : w.id === "pompe" ? 0.75 : 0.45 + Math.random() * 0.2); gunLight.intensity = w.rocket ? 4 : 2.6;
  if (w.rocket) return;
  const s = new T.Mesh(geo, SHELLM); s.scale.set(0.035, 0.035, 0.09); s.position.copy(new T.Vector3(0.28, -0.12, -0.45).applyMatrix4(camera.matrixWorld));
  const right = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  s.userData = { v: right.multiplyScalar(2 + Math.random()).add(new T.Vector3(0, 2.2 + Math.random(), 0)), r: new T.Vector3(Math.random() * 20, Math.random() * 20, 0), l: 2.2 };
  scene.add(s); shells.push(s); if (shells.length > 30) scene.remove(shells.shift());
}
function impactDecal(hit) {
  if (!hit || !hit.face) return;
  _n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
  const d = new T.Mesh(decalGeo, DECALM); d.position.copy(hit.point).addScaledVector(_n, 0.012); d.lookAt(hit.point.clone().add(_n)); d.scale.setScalar(0.7 + Math.random() * 0.5);
  scene.add(d); decals.push(d); if (decals.length > 70) scene.remove(decals.shift());
}
function clearFx() { for (const d of decals) scene.remove(d); decals.length = 0; for (const s of shells) scene.remove(s); shells.length = 0; }
// herbe en touffes (une seule géométrie instanciée, légère)
{
  const n = isTouch ? 1400 : 3200, gg = new T.ConeGeometry(0.05, 0.32, 3); gg.translate(0, 0.16, 0);
  const im = new T.InstancedMesh(gg, new T.MeshLambertMaterial({ color: 0xffffff }), n), m4 = new T.Matrix4(), q = new T.Quaternion(), col = new T.Color(); let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const x = (Math.random() * 2 - 1) * (MX - 1), z = (Math.random() * 2 - 1) * (MZ - 1);
    if (Math.abs(z) < 5.6 || HOUSES.some(h => x > h.x0 - 0.6 && x < h.x0 + h.w + 0.6 && z > h.z0 - 0.6 && z < h.z0 + h.d + 0.6) || solids.some(b => b.y2 > 0.3 && x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2)) continue;
    q.setFromAxisAngle(new T.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize(), Math.random() * 3); const s = 0.6 + Math.random() * 0.9;
    m4.compose(new T.Vector3(x, 0, z), q, new T.Vector3(s, s * (0.7 + Math.random() * 0.8), s)); im.setMatrixAt(k, m4);
    col.setHSL(0.25 + Math.random() * 0.06, 0.5, 0.3 + Math.random() * 0.15); im.setColorAt(k, col); k++;
  }
  im.count = k; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; scene.add(im);
  // petits cailloux et débris
  for (let i = 0; i < 60; i++) { const x = (Math.random() * 2 - 1) * (MX - 1), z = (Math.random() * 2 - 1) * (MZ - 1); if (HOUSES.some(h => x > h.x0 && x < h.x0 + h.w && z > h.z0 && z < h.z0 + h.d)) continue; const r = new T.Mesh(geo, mat(Math.random() < 0.5 ? 0x6b7280 : 0x78716c)); r.scale.set(0.12 + Math.random() * 0.2, 0.06 + Math.random() * 0.08, 0.1 + Math.random() * 0.2); r.position.set(x, 0.03, z); r.rotation.y = Math.random() * 3; scene.add(r); }
}
function moodTick(dt) {
  const target = mode === "solo" ? Math.min(1, Math.max(0, (wave - 1) / 6)) : 0.38;
  MOOD.k += (target - MOOD.k) * Math.min(1, dt * 0.6); const k = MOOD.k;
  scene.background = mix3(MOOD.day[0], MOOD.dusk[0], MOOD.night[0], k).clone(); scene.fog.color.copy(mix3(MOOD.day[1], MOOD.dusk[1], MOOD.night[1], k));
  scene.fog.near = 34 - k * 16; scene.fog.far = 95 - k * 40;
  sun.color.copy(mix3(MOOD.day[2], MOOD.dusk[2], MOOD.night[2], k)); sun.intensity = 0.85 - k * 0.62; hemi.intensity = 0.85 - k * 0.5;
  stars.material.opacity = Math.max(0, (k - 0.45) * 1.8); moon.material.opacity = Math.max(0, (k - 0.35) * 1.6);
  CLOUD.color.copy(mix3(0xffffff, 0xf5b08a, 0x3a3f66, k));
  gunLight.intensity = Math.max(0, gunLight.intensity - dt * 40);
  // yeux des robots qui brillent dans le noir
  for (const e of enemies) {
    if (!e.glow) { e.glow = []; const c = e.def.eye || 0xef4444; for (const sx of [-0.1, 0.1]) { const s = new T.Sprite(new T.SpriteMaterial({ map: EYEGLOW, color: c, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); s.position.set(sx, 0.03, 0.3); s.scale.setScalar(0.4); e.head.add(s); e.glow.push(s); } }
    for (const s of e.glow) { s.material.opacity = 0.15 + k * 0.85; s.scale.setScalar(0.3 + k * 0.35); }
  }
  for (const s of shells.slice()) { const u = s.userData; u.l -= dt; u.v.y -= 11 * dt; s.position.addScaledVector(u.v, dt); s.rotation.x += u.r.x * dt; s.rotation.y += u.r.y * dt; if (s.position.y < 0.03) { s.position.y = 0.03; u.v.y *= -0.35; u.v.x *= 0.5; u.v.z *= 0.5; u.r.multiplyScalar(0.5); } if (u.l <= 0) { scene.remove(s); shells.splice(shells.indexOf(s), 1); } }
}
camera.position.set(6, EYE, 2.2); camera.rotation.set(0, Math.PI / 2, 0, "YXZ");
wbar();
requestAnimationFrame(frame);
function lockPointer() { if (!isTouch && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} } }
function enterMP() { clearWorld(); mode = "mp"; refillAll(); equip(cur); crouch = false; crouchToggle = false; shots = 0; hits = 0; state = "play"; aimHeld = false; $("#panel").hidden = true; $("#wave").textContent = ""; $("#left").textContent = ""; lockPointer(); }
function exitMP() { mode = "solo"; state = "menu"; aimHeld = false; if (document.exitPointerLock) document.exitPointerLock(); }
function setHurt(v) { hurt = v; }
window.TIRCORE = { T, scene, camera, P, geo, solids, hitsAt, groundAt, spark, floatTxt, enterMP, exitMP, lockPointer, setHurt, isTouch, tracers, gunFlash: flash, explode, WEAPONS,
  set state(v) { state = v; }, get state() { return state; }, get mode() { return mode; }, refill() { refillAll(); hudAmmo(); }, get acc() { return shots ? hits / shots : 0; }, get weapon() { return W().id; }, get crouch() { return crouch; }, setWave: n => { wave = n - 1; nextWave(); }, get mood() { return MOOD.k; }, HOUSES };
window.TIR = { get crouch() { return crouch; }, setWave: n => { wave = n - 1; nextWave(); }, get mood() { return MOOD.k; }, set crouchHold(v) { crouchHeld = v; }, HOUSES, navTarget, start, get state() { return state; }, P, enemies, shoot, get score() { return score; }, look, equip, bolts, get wave() { return wave; }, set aim(v) { aimHeld = v; }, makeRobot, los };
}
