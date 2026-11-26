"use strict";
{
const $ = s => document.querySelector(s), cv = $("#cv"), g = cv.getContext("2d");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isTouch = matchMedia("(pointer:coarse)").matches;
const snd = n => window.SFX && window.SFX.play(n), eng = window.SFX ? window.SFX.engine : { set() {}, stop() {} };
const LAPS = 3, CR = 1.35, CAMH = 70;
const COLORS = ["#eab308", "#38bdf8", "#f472b6", "#4ade80", "#f97316", "#a78bfa", "#ef4444", "#14b8a6"];
const BOTS = [["Clark", 0.93], ["Linde", 0.96], ["Still", 0.99]];
let seedN = 1; const srand = s => { seedN = s; }; const rnd = () => { seedN = (seedN * 16807) % 2147483647; return (seedN - 1) / 2147483646; };

/* ---------- les circuits ---------- */
const TRACKS = {
  hangar: { name: "Le Hangar", desc: "L'entrepôt : rayonnages, palettes et piliers. Le circuit pour apprendre.", hw: 9.5, grip: 7,
    ctrl: [[45, 45], [180, 38], [248, 52], [273, 98], [240, 135], [180, 126], [144, 150], [165, 188], [240, 195], [267, 225], [225, 258], [90, 258], [42, 228], [63, 174], [36, 123], [27, 78]], pads: [0.06, 0.55, 0.8], theme: "hangar" },
  quai: { name: "Le Quai", desc: "Les docks : conteneurs, grues et flaques d'eau qui font glisser.", hw: 10, grip: 7,
    ctrl: [[40, 60], [200, 40], [300, 60], [340, 120], [300, 172], [220, 160], [178, 202], [222, 250], [320, 262], [342, 312], [282, 342], [120, 342], [58, 302], [92, 242], [58, 182], [30, 120]], pads: [0.04, 0.33, 0.7], puddles: [0.2, 0.47, 0.62, 0.9], theme: "quai" },
  froid: { name: "La Chambre froide", desc: "Sol gelé : ça glisse partout, freine avant les virages !", hw: 9, grip: 2.4,
    ctrl: [[50, 50], [180, 40], [232, 82], [202, 132], [140, 122], [108, 162], [150, 202], [232, 190], [272, 232], [242, 292], [150, 302], [70, 282], [38, 222], [70, 162], [38, 110]], pads: [0.02, 0.6], ice: [0.28, 0.5, 0.78], theme: "froid" },
  usine: { name: "L'Usine", desc: "Tapis roulants qui te poussent sur le côté et pads turbo.", hw: 9.5, grip: 7,
    ctrl: [[60, 60], [260, 60], [312, 100], [302, 170], [240, 192], [200, 242], [262, 292], [322, 302], [332, 362], [250, 392], [100, 392], [50, 342], [90, 282], [140, 242], [100, 192], [40, 150]], pads: [0.05, 0.42, 0.88], belts: [[0.15, 0.22, 1], [0.5, 0.57, -1], [0.7, 0.76, 1]], theme: "usine" }
};
const THEMES = {
  hangar: { floor: "#3f3f46", tile: "concrete", asph: "#24242a", edge: "#facc15", kerb: ["#dc2626", "#f5f5f5"], line: "#ffffff55" },
  quai: { floor: "#57534e", tile: "planks", asph: "#26262b", edge: "#38bdf8", kerb: ["#2563eb", "#f5f5f5"], line: "#ffffff55", water: "#0e4f7a" },
  froid: { floor: "#dbeafe", tile: "snow", asph: "#9fb7cc", edge: "#67e8f9", kerb: ["#0ea5e9", "#ffffff"], line: "#ffffffaa" },
  usine: { floor: "#27272a", tile: "plate", asph: "#1c1c20", edge: "#f97316", kerb: ["#f97316", "#18181b"], line: "#ffffff44" }
};
function makePattern(kind, base) {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d"); x.fillStyle = base; x.fillRect(0, 0, 64, 64);
  srand(kind.length * 99 + 7); const dot = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  if (kind === "concrete") { for (let i = 0; i < 260; i++) dot(rnd() * 64, rnd() * 64, 2, 2, rnd() < 0.5 ? "#ffffff0d" : "#0000001a"); dot(0, 0, 64, 1, "#00000040"); dot(0, 0, 1, 64, "#00000040"); for (let i = 0; i < 3; i++) { x.fillStyle = "#00000018"; x.beginPath(); x.ellipse(rnd() * 64, rnd() * 64, 6 + rnd() * 8, 3 + rnd() * 5, rnd() * 3, 0, 7); x.fill(); } }
  else if (kind === "asph") { for (let i = 0; i < 500; i++) dot(rnd() * 64, rnd() * 64, 1, 1, rnd() < 0.5 ? "#ffffff14" : "#00000030"); }
  else if (kind === "planks") { for (let k = 0; k < 64; k += 16) dot(0, k, 64, 2, "#00000040"); for (let i = 0; i < 200; i++) dot(rnd() * 64, rnd() * 64, 3, 1, "#0000001a"); for (let k = 0; k < 4; k++) dot(4 + k * 16, k * 16 + 6, 2, 2, "#d6d3d166"); }
  else if (kind === "snow") { for (let i = 0; i < 160; i++) dot(rnd() * 64, rnd() * 64, 2, 2, rnd() < 0.6 ? "#ffffff" : "#bfdbfe"); for (let i = 0; i < 12; i++) dot(rnd() * 64, rnd() * 64, 1, 1, "#60a5fa"); }
  else if (kind === "plate") { for (let i = 0; i < 64; i += 8) for (let j = 0; j < 64; j += 8) { x.save(); x.translate(i + ((j / 8) % 2) * 4 + 2, j + 4); x.rotate(0.6); dot(-2.5, -0.8, 5, 1.6, "#ffffff10"); x.restore(); } dot(0, 0, 64, 1, "#00000060"); dot(0, 0, 1, 64, "#00000060"); }
  else if (kind === "ice") { for (let i = 0; i < 40; i++) { x.strokeStyle = "#ffffff55"; x.beginPath(); const a = rnd() * 64, b = rnd() * 64; x.moveTo(a, b); x.lineTo(a + rnd() * 14 - 7, b + rnd() * 14 - 7); x.stroke(); } }
  const p = g.createPattern(c, "repeat"); if (p.setTransform) p.setTransform(new DOMMatrix().scale(0.14)); return p;
}
function buildTrack(id) {
  const def = TRACKS[id], th = THEMES[def.theme], CT = def.ctrl, n = CT.length, raw = [], N = 900, TR = [];
  for (let i = 0; i < n; i++) {
    const p0 = CT[(i - 1 + n) % n], p1 = CT[i], p2 = CT[(i + 1) % n], p3 = CT[(i + 2) % n];
    for (let k = 0; k < 40; k++) { const t = k / 40, t2 = t * t, t3 = t2 * t; raw.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); }
  }
  let L = 0; const cum = [0]; for (let i = 1; i <= raw.length; i++) { const a = raw[i - 1], b = raw[i % raw.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(L); }
  let j = 0; for (let i = 0; i < N; i++) { const d = i * L / N; while (cum[j + 1] < d) j++; const a = raw[j], b = raw[(j + 1) % raw.length], t = (d - cum[j]) / (cum[j + 1] - cum[j] || 1); TR.push({ x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t }); }
  for (let i = 0; i < N; i++) { const a = TR[(i - 1 + N) % N], b = TR[(i + 1) % N], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy); Object.assign(TR[i], { tx: dx / l, ty: dy / l, nx: -dy / l, ny: dx / l }); }
  for (let i = 0; i < N; i++) { const a = TR[(i - 8 + N) % N], b = TR[(i + 8) % N]; let da = Math.atan2(b.ty, b.tx) - Math.atan2(a.ty, a.tx); while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; TR[i].curv = da; }
  const xs = TR.map(p => p.x), ys = TR.map(p => p.y), bb = { x1: Math.min(...xs) - 50, x2: Math.max(...xs) + 50, y1: Math.min(...ys) - 50, y2: Math.max(...ys) + 50 };
  const far = (x, y, m) => { for (let k = 0; k < N; k += 3) if (Math.abs(TR[k].x - x) < m && Math.abs(TR[k].y - y) < m && Math.hypot(TR[k].x - x, TR[k].y - y) < m) return false; return true; };
  // décor en fausse 3D (boîtes avec hauteur) et décalcomanies au sol
  const boxes = [], flats = [], lights = [], hw = def.hw; srand(id.length * 1337 + 11);
  const B = (x, y, w, h, z, top, side, extra) => boxes.push(Object.assign({ x, y, w, h, z, top, side }, extra || {}));
  for (let y = bb.y1; y < bb.y2; y += 13) for (let x = bb.x1; x < bb.x2; x += 13) {
    const cx = x + rnd() * 5, cy = y + rnd() * 5, r = rnd();
    if (!far(cx + 4, cy + 4, hw + 9)) { if (far(cx, cy, hw + 4) && rnd() < 0.35) flats.push({ k: "stain", x: cx, y: cy, r: 2 + rnd() * 3 }); continue; }
    if (def.theme === "hangar") {
      if (r < 0.45) { const c = rnd() < 0.5 ? "#c2410c" : "#1d4ed8"; B(cx, cy, 11, 3.6, 7, c, "#7c2d12", { rack: true, crates: Array.from({ length: 4 }, () => ["#a16207", "#ca8a04", "#d6d3d1", "#78716c", null][Math.floor(rnd() * 5)]) }); }
      else if (r < 0.62) B(cx, cy, 2.6, 2.6, 1.6 + rnd() * 2.2, "#b45309", "#78350f", { pallet: true });
      else if (r < 0.7) B(cx, cy, 1.6, 1.6, 12, "#a1a1aa", "#52525b", { pillar: true });
      else if (r < 0.76) flats.push({ k: "lines", x: cx, y: cy });
    } else if (def.theme === "quai") {
      if (r < 0.42) { const c = ["#dc2626", "#2563eb", "#16a34a", "#ea580c", "#0891b2", "#a16207"][Math.floor(rnd() * 6)], v = rnd() < 0.5; B(cx, cy, v ? 3.4 : 12, v ? 12 : 3.4, rnd() < 0.3 ? 7 : 3.6, c, "#00000088", { container: v ? "v" : "h" }); }
      else if (r < 0.52) B(cx, cy, 1, 1, 1.2, "#facc15", "#a16207");
      else if (r < 0.6) B(cx, cy, 2.4, 2.4, 1.4 + rnd() * 2, "#a16207", "#78350f", { pallet: true });
      else if (r < 0.63) { B(cx, cy, 1.4, 1.4, 16, "#facc15", "#a16207"); B(cx + 9, cy, 1.4, 1.4, 16, "#facc15", "#a16207"); B(cx - 1, cy - 1, 12, 1.2, 17, "#eab308", "#a16207"); }
    } else if (def.theme === "froid") {
      if (r < 0.35) B(cx, cy, 10, 3.4, 6, "#e2e8f0", "#94a3b8", { rack: true, crates: Array.from({ length: 4 }, () => ["#bae6fd", "#f8fafc", "#fca5a5", null][Math.floor(rnd() * 4)]) });
      else if (r < 0.55) B(cx, cy, 2 + rnd() * 2, 2 + rnd() * 2, 1 + rnd() * 2.5, "#a5f3fc", "#67e8f9", { ice: true });
      else if (r < 0.62) flats.push({ k: "snowpile", x: cx, y: cy, r: 3 + rnd() * 3 });
      else if (r < 0.68) B(cx, cy, 6, 2, 4, "#cbd5e1", "#64748b", { fridge: true });
    } else {
      if (r < 0.3) { B(cx, cy, 6, 5, 4 + rnd() * 3, "#52525b", "#27272a", { machine: true, led: ["#22c55e", "#ef4444", "#facc15"][Math.floor(rnd() * 3)] }); lights.push({ x: cx + 3, y: cy + 2.5, r: 8, c: "#f9731622" }); }
      else if (r < 0.42) B(cx, cy, 2.4, 2.4, 1.5 + rnd() * 2, "#a16207", "#78350f", { pallet: true });
      else if (r < 0.5) B(cx, cy, 1.8, 1.8, 10, "#3f3f46", "#18181b", { pillar: true });
      else if (r < 0.58) flats.push({ k: "hazard", x: cx, y: cy });
    }
  }
  // lampes au plafond : halos de lumière sur la piste
  for (let k = 0; k < N; k += 45) lights.push({ x: TR[k].x, y: TR[k].y, r: 16, c: def.theme === "usine" ? "#fb923c18" : def.theme === "froid" ? "#ffffff30" : "#fde68a1c" });
  const at = f => Math.floor(((f % 1) + 1) % 1 * N);
  const rows = [0.16, 0.38, 0.62, 0.85].map(at);
  return { id, def, th, TR, N, len: L, hw, bb, boxes, flats, lights, rows, pads: (def.pads || []).map(at), puddles: (def.puddles || []).map(at), ice: (def.ice || []).map(at), belts: (def.belts || []).map(([a, b, s]) => [at(a), at(b), s]),
    pat: { floor: makePattern(th.tile, th.floor), asph: makePattern("asph", th.asph), ice: makePattern("ice", "#bae6fd") } };
}
let TK = null;
function nearest(x, y, hint) {
  const T = TK.TR, N = TK.N; let best = null; const span = hint >= 0 ? 40 : N;
  for (let k = -span; k <= span && k < N; k++) {
    const i = ((hint >= 0 ? hint : 0) + k + N * 2) % N, a = T[i], b = T[(i + 1) % N], ex = b.x - a.x, ey = b.y - a.y, l2 = ex * ex + ey * ey;
    let t = ((x - a.x) * ex + (y - a.y) * ey) / l2; t = Math.max(0, Math.min(1, t));
    const px = a.x + ex * t, py = a.y + ey * t, d = Math.hypot(x - px, y - py);
    if (!best || d < best.d) best = { i, d, px, py, lat: (x - px) * a.nx + (y - py) * a.ny };
    if (hint < 0 && k >= N - 1) break;
  }
  return best;
}
const near = (i, j, w) => { const N = TK.N; const d = Math.abs(i - j); return Math.min(d, N - d) <= w; };

/* ---------- objets (façon Mario Kart) ---------- */
const ITEMS = {
  turbo: { name: "Turbo", c: "#f97316" }, turbo3: { name: "Triple turbo", c: "#ea580c" }, oil: { name: "Huile", c: "#334155" }, pal: { name: "Palette", c: "#b45309" },
  boulon: { name: "Boulon", c: "#22c55e" }, drone: { name: "Drone", c: "#ef4444" }, star: { name: "Super batterie", c: "#facc15" }, klax: { name: "Klaxon", c: "#a855f7" }
};
const ICON = {
  turbo: `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="#fde047" stroke="#ea580c" stroke-width="1.5"/></svg>`,
  turbo3: `<svg viewBox="0 0 36 24" width="44" height="30" aria-hidden="true"><path d="M9 2L2 14h5l-1 8 7-12H8z" fill="#fde047" stroke="#ea580c"/><path d="M20 2L13 14h5l-1 8 7-12h-5z" fill="#fde047" stroke="#ea580c"/><path d="M31 2l-7 12h5l-1 8 7-12h-5z" fill="#fde047" stroke="#ea580c"/></svg>`,
  oil: `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><ellipse cx="12" cy="15" rx="10" ry="6" fill="#0a0a0a"/><ellipse cx="9" cy="13" rx="3" ry="1.4" fill="#7c3aed"/><path d="M12 2c3 4 4 6 4 8a4 4 0 0 1-8 0c0-2 1-4 4-8z" fill="#111" stroke="#52525b"/></svg>`,
  pal: `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect x="3" y="5" width="18" height="14" fill="#b45309"/><path d="M3 9h18M3 13h18M3 17h18" stroke="#78350f" stroke-width="2"/></svg>`,
  boulon: `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12 2l8 5v10l-8 5-8-5V7z" fill="#22c55e" stroke="#14532d" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="#14532d"/></svg>`,
  drone: `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect x="8" y="8" width="8" height="8" rx="2" fill="#ef4444"/><path d="M8 8L4 4M16 8l4-4M8 16l-4 4M16 16l4 4" stroke="#7f1d1d" stroke-width="2"/><circle cx="4" cy="4" r="3" fill="#fca5a5"/><circle cx="20" cy="4" r="3" fill="#fca5a5"/><circle cx="4" cy="20" r="3" fill="#fca5a5"/><circle cx="20" cy="20" r="3" fill="#fca5a5"/></svg>`,
  star: `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect x="5" y="4" width="14" height="18" rx="2" fill="#facc15" stroke="#a16207" stroke-width="1.5"/><rect x="9" y="1" width="6" height="4" fill="#a16207"/><path d="M13 7l-4 6h3l-1 5 4-6h-3z" fill="#7c2d12"/></svg>`,
  klax: `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M3 9h4l7-5v16l-7-5H3z" fill="#a855f7" stroke="#581c87" stroke-width="1.5"/><path d="M17 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14" stroke="#e9d5ff" stroke-width="2" fill="none"/></svg>`
};
function pickItem(rank, solo) {
  if (solo) return Math.random() < 0.7 ? "turbo" : "turbo3";
  const T = rank < 0.34 ? [["oil", 28], ["pal", 22], ["boulon", 32], ["turbo", 12], ["klax", 6]] : rank < 0.67 ? [["boulon", 20], ["turbo", 18], ["oil", 10], ["pal", 8], ["drone", 20], ["turbo3", 12], ["klax", 12]] : [["turbo3", 24], ["drone", 22], ["star", 20], ["turbo", 14], ["klax", 10], ["boulon", 10]];
  let s = T.reduce((a, b) => a + b[1], 0) * Math.random(); for (const [k, w] of T) { s -= w; if (s <= 0) return k; } return "turbo";
}

/* ---------- les chariots ---------- */
function makeCar(o, slot) {
  const N = TK.N, i = (N - 10 - Math.floor(slot / 2) * 11 + N) % N, p = TK.TR[i], lat = slot % 2 ? -3.4 : 3.4;
  return Object.assign({ x: p.x + p.nx * lat, y: p.y + p.ny * lat, a: Math.atan2(p.ty, p.tx), vx: 0, vy: 0, si: i, laps: 0, started: false, half: false, item: null, uses: 0, boost: 0, spin: 0, slow: 0, oil: 0, fork: 0, forkT: 0, air: 0, star: 0, lapStart: 0, best: 0, fin: 0, wall: 0, ai: { lane: (Math.random() - 0.5) * 7, t: Math.random() * 9, cd: 0 } }, o, { color: COLORS[slot % COLORS.length] });
}
let mode = "menu", cars = [], me = null, raceAt = 0, clock = () => Date.now(), drops = [], projs = [], dropN = 0, ghost = null, rec = [], recT = 0, finishedShown = false, kind = "trial";
let parts = [], skids = [], rings = [], smoke = [], shake = 0, wx = [];
function puff(x, y, c) { smoke.push({ x, y, r: 0.6, life: 0.9, max: 0.9, c: c || "210,214,222" }); if (smoke.length > 160) smoke.shift(); }
const L = window.LOBBY, X = L && L.ctx;
const keys = new Set(), touch = { l: 0, r: 0, gas: 0, brake: 0, drift: 0 };
function physics(c, thr, steer, dt, driftIn) {
  const def = TK.def, fx = Math.cos(c.a), fy = Math.sin(c.a), sp = c.vx * fx + c.vy * fy;
  c.fork = Math.max(0, c.fork - dt); c.forkT = Math.max(0, c.forkT - dt); c.star = Math.max(0, c.star - dt); c.wall = Math.max(0, c.wall - dt);
  if (c.air > 0) { c.air -= dt; thr = 0; steer = 0; }
  if (c.spin > 0) { c.spin -= dt; c.a += dt * 9; thr = 0; steer = 0; }
  c.boost = Math.max(0, c.boost - dt); c.slow = Math.max(0, c.slow - dt); c.oil = Math.max(0, c.oil - dt);
  // dérapage : on tient le virage, les étincelles changent de couleur, on relâche pour un turbo
  if (driftIn && !c.drifting && Math.abs(steer) > 0.3 && sp > 14 && c.air <= 0 && c.spin <= 0) { c.drifting = true; c.dDir = Math.sign(steer); c.dCharge = 0; }
  if (c.drifting && (!driftIn || sp < 9 || c.spin > 0 || c.air > 0)) {
    const lv = c.dCharge >= 2.4 ? 3 : c.dCharge >= 1.5 ? 2 : c.dCharge >= 0.75 ? 1 : 0;
    if (lv && c.spin <= 0 && c.air <= 0) { c.boost = Math.max(c.boost, [0, 0.55, 0.95, 1.45][lv]); if (c === me) { snd("boost"); flash(["", "Mini-turbo !", "Super turbo !", "Ultra turbo !"][lv]); } }
    c.drifting = false; c.dCharge = 0;
  }
  if (c.drifting) { steer = c.dDir * (0.5 + 0.8 * Math.max(0, steer * c.dDir)); c.dCharge += dt * (0.7 + 0.5 * Math.abs(steer)); if ((c.local || c.bot) && Math.random() < 0.7) { const lv = c.dCharge >= 2.4 ? 3 : c.dCharge >= 1.5 ? 2 : c.dCharge >= 0.75 ? 1 : 0, col = ["#e5e7eb", "#38bdf8", "#f97316", "#c084fc"][lv], bx = c.x - Math.cos(c.a) * 1.3, by = c.y - Math.sin(c.a) * 1.3; for (const s2 of [-0.9, 0.9]) part(bx - Math.sin(c.a) * s2, by + Math.cos(c.a) * s2, (Math.random() - 0.5) * 6 - Math.cos(c.a) * 4, (Math.random() - 0.5) * 6 - Math.sin(c.a) * 4, 0.25, col, lv ? 0.5 : 0.3); } }
  const max = (c.boost > 0 ? 50 : 34) * (c.star > 0 ? 1.12 : 1) * (c.slow > 0 ? 0.45 : 1) * (c.maxF || 1);
  let acc = thr > 0 ? (sp < max ? 32 * thr : -14) : thr < 0 ? (sp > 0 ? 48 * thr : sp > -10 ? 18 * thr : 0) : -Math.sign(sp) * Math.min(Math.abs(sp) / dt, 9);
  if (c.boost > 0 && thr >= 0) acc = Math.max(acc, 44);
  c.vx += fx * acc * dt; c.vy += fy * acc * dt;
  const q0 = nearest(c.x, c.y, c.si), onIce = TK.ice.some(i => near(q0.i, i, 22));
  const lat = -c.vx * fy + c.vy * fx, grip = c.air > 0 ? 0 : c.oil > 0 ? 0.6 : onIce ? 0.9 : c.drifting ? Math.min(def.grip, 3.2) : def.grip;
  const k = Math.min(1, grip * dt); c.vx -= -fy * lat * k; c.vy -= fx * lat * k;
  if (Math.abs(lat) > 7 && (c.local || c.bot) && c.air <= 0) { skid(c); if (Math.random() < (c.drifting ? 0.55 : 0.25)) puff(c.x - fx * 1.6 + (Math.random() - 0.5), c.y - fy * 1.6 + (Math.random() - 0.5), TK.th.tile === "snow" ? "240,249,255" : null); }
  // tapis roulants
  for (const [a, b, s] of TK.belts) { const inB = a <= b ? q0.i >= a && q0.i <= b : q0.i >= a || q0.i <= b; if (inB && c.air <= 0) { const p = TK.TR[q0.i]; c.vx += p.nx * s * 16 * dt; c.vy += p.ny * s * 16 * dt; } }
  const sp2 = c.vx * fx + c.vy * fy;
  c.a += steer * dt * 2.6 * Math.max(-1, Math.min(1, sp2 / 10)) * (Math.abs(sp2) > 30 ? 0.82 : 1) * (c.drifting ? 1.3 : 1);
  c.x += c.vx * dt; c.y += c.vy * dt;
  // murs
  const q = nearest(c.x, c.y, c.si), hw = TK.hw;
  if (q.d > hw - CR) {
    const nx = (c.x - q.px) / q.d, ny = (c.y - q.py) / q.d; c.x = q.px + nx * (hw - CR); c.y = q.py + ny * (hw - CR);
    const vn = c.vx * nx + c.vy * ny; if (vn > 0) { c.vx -= nx * vn * 1.4; c.vy -= ny * vn * 1.4; c.vx *= 0.86; c.vy *= 0.86; if (vn > 8 && c.wall <= 0 && (c.local || c.bot)) { c.wall = 0.3; if (c === me) { snd("wall"); shake = Math.max(shake, Math.min(0.5, vn / 40)); } for (let i = 0; i < 8; i++) part(c.x + nx * CR, c.y + ny * CR, (Math.random() - 0.5) * 14 - nx * 6, (Math.random() - 0.5) * 14 - ny * 6, 0.35, i % 2 ? "#fde047" : "#f97316", 0.35); } }
  }
  // pads turbo, flaques
  for (const i of TK.pads) if (near(q.i, i, 4) && Math.abs(q.lat) < 4.2 && c.air <= 0) { if (c.boost < 0.9) { c.boost = 1.1; if (c === me) { flash("Turbo !"); snd("boost"); } } }
  for (const i of TK.puddles) { const p = TK.TR[i]; const lx = p.x + p.nx * ((i % 3) - 1) * 4, ly = p.y + p.ny * ((i % 3) - 1) * 4; if (Math.hypot(c.x - lx, c.y - ly) < 3.2 && c.oil <= 0 && c.star <= 0 && (c.local || c.bot)) { c.oil = 0.6; if (c === me) snd("splash"); for (let k2 = 0; k2 < 6; k2++) part(c.x, c.y, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, 0.5, "#93c5fd", 0.4); } }
  // tours
  const ni = q.i, d = ni - c.si, N = TK.N;
  if (d < -N / 2) { if (!c.started) { c.started = true; c.lapStart = clock(); } else if (c.half) { const lt = clock() - c.lapStart; c.laps++; c.lapStart = clock(); c.half = false; if (!c.best || lt < c.best) c.best = lt; if (c === me) lapDone(lt); if (c.laps >= LAPS && !c.fin) finish(c); } }
  else if (d > N / 2 && c.started) c.half = false;
  if (ni > N * 0.4 && ni < N * 0.6 && c.started) c.half = true;
  c.si = ni;
  if (c.boost > 0 && (c.local || c.bot) && Math.random() < 0.6) part(c.x - fx * 2.2, c.y - fy * 2.2, -fx * 8 + (Math.random() - 0.5) * 4, -fy * 8 + (Math.random() - 0.5) * 4, 0.3, Math.random() < 0.5 ? "#fde047" : "#f97316", 0.5);
  if (c.star > 0 && Math.random() < 0.5) part(c.x + (Math.random() - 0.5) * 3, c.y + (Math.random() - 0.5) * 3, 0, 0, 0.4, `hsl(${(clock() / 3) % 360} 90% 60%)`, 0.45);
}
function skid(c) { const fx = Math.cos(c.a), fy = Math.sin(c.a), nx = -fy, ny = fx; for (const s of [-0.8, 0.8]) { const x = c.x - fx * 1.1 + nx * s, y = c.y - fy * 1.1 + ny * s, k = c.id + s; const lp = c["sk" + s]; if (lp && Math.hypot(lp[0] - x, lp[1] - y) < 2) skids.push([lp[0], lp[1], x, y]); c["sk" + s] = [x, y]; } if (skids.length > 700) skids.splice(0, skids.length - 700); }
function part(x, y, vx, vy, life, c, size) { parts.push({ x, y, vx, vy, life, max: life, c, s: size || 0.4 }); if (parts.length > 500) parts.shift(); }
const progress = c => (c.fin ? 1e9 - c.fin : (c.started ? c.laps * TK.N + c.si : c.si - TK.N));
function finish(c) {
  c.fin = Math.round(clock() - raceAt);
  if (c === me) { eng.stop(); snd("finish"); if (mode === "mp") X.setScore({ fin: c.fin, best: c.best, race: curRace }); flash(`Arrivée ! ${fmt(c.fin)}`); for (let i = 0; i < 60; i++) part(c.x, c.y, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 1.2, COLORS[i % 8], 0.5); if (mode !== "mp") setTimeout(soloEnd, 1800); }
}
function hitCar(c, how) {
  if (c.star > 0 || c.air > 0) return false;
  c.spin = how === "klax" ? 0.8 : 1.0; c.vx *= 0.35; c.vy *= 0.35; c.slow = 0.6;
  for (let i = 0; i < 10; i++) part(c.x, c.y, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, 0.5, "#fde047", 0.4);
  if (c === me) { snd("spin"); shake = 0.45; }
  if (c === me) flash(how === "boulon" ? "Touché par un boulon !" : how === "drone" ? "Le drone t'a eu !" : how === "klax" ? "Assommé par le klaxon !" : how === "star" ? "Percuté par une super batterie !" : "Aïe !");
  return true;
}
function useItem(c) {
  if (!c.item || clock() < raceAt || c.air > 0) return; const it = c.item, fx = Math.cos(c.a), fy = Math.sin(c.a);
  if (it === "turbo3") { c.boost = 1.4; c.uses = (c.uses || 3) - 1; if (c.uses <= 0) { c.item = null; c.uses = 0; } }
  else { c.item = null; }
  if (it === "turbo") c.boost = 1.6;
  else if (it === "star") { c.star = 6; if (c === me) flash("Super batterie : rien ne t'arrête !"); }
  else if (it === "oil" || it === "pal") { const d = { id: `${c.id}-${++dropN}`, k: it, x: c.x - fx * 3.4, y: c.y - fy * 3.4, until: clock() + (it === "oil" ? 16000 : 20000), owner: c.id }; drops.push(d); if (mode === "mp" && c === me) X.ev({ type: "drop", id: d.id, k: it, x: +d.x.toFixed(2), y: +d.y.toFixed(2), until: d.until }); }
  else if (it === "boulon" || it === "drone") {
    const order = cars.slice().sort((a, b) => progress(b) - progress(a)), idx = order.indexOf(c), target = it === "drone" ? (order[idx - 1] || null) : null;
    const p = { id: `${c.id}-${++dropN}`, k: it, x: c.x + fx * 3, y: c.y + fy * 3, vx: fx * (it === "boulon" ? 58 : 46) + c.vx * 0.3, vy: fy * (it === "boulon" ? 58 : 46) + c.vy * 0.3, owner: c.id, target: target ? target.id : "", life: it === "boulon" ? 4.5 : 9, bounces: 0, safe: 0.35, si: c.si };
    if (it === "drone" && !target) { p.vx = fx * 46; p.vy = fy * 46; }
    projs.push(p); if (mode === "mp" && c === me) X.ev({ type: "proj", id: p.id, k: it, x: +p.x.toFixed(2), y: +p.y.toFixed(2), vx: +p.vx.toFixed(2), vy: +p.vy.toFixed(2), target: p.target, si: p.si });
  } else if (it === "klax") {
    rings.push({ x: c.x, y: c.y, r: 0, max: 12, life: 0.5 });
    for (const o of cars) if (o !== c && Math.hypot(o.x - c.x, o.y - c.y) < 12 && (o.local || o.bot)) hitCar(o, "klax");
    projs = projs.filter(p => Math.hypot(p.x - c.x, p.y - c.y) > 12); drops = drops.filter(d => Math.hypot(d.x - c.x, d.y - c.y) > 12);
    if (mode === "mp" && c === me) X.ev({ type: "klax", x: +c.x.toFixed(2), y: +c.y.toFixed(2) });
  }
  if (c === me) { hudItem(); snd(it === "turbo" || it === "turbo3" ? "boost" : it === "star" ? "star" : it === "klax" ? "klax" : it === "oil" || it === "pal" ? "place" : "throw"); }
}
function updateProjs(dt) {
  for (const p of projs.slice()) {
    p.life -= dt; p.safe -= dt;
    if (p.k === "drone") {
      const t = cars.find(o => o.id === p.target && !o.fin);
      const q = nearest(p.x, p.y, p.si); p.si = q.i;
      let tx, ty; if (t && Math.hypot(t.x - p.x, t.y - p.y) < 40) { tx = t.x; ty = t.y; } else { const a = TK.TR[(q.i + 25) % TK.N]; tx = a.x; ty = a.y; }
      const da = Math.atan2(ty - p.y, tx - p.x), cur = Math.atan2(p.vy, p.vx); let d = da - cur; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const na = cur + Math.max(-5 * dt, Math.min(5 * dt, d)); p.vx = Math.cos(na) * 46; p.vy = Math.sin(na) * 46;
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const q = nearest(p.x, p.y, p.si); p.si = q.i;
    if (q.d > TK.hw - 0.6) { const nx = (p.x - q.px) / q.d, ny = (p.y - q.py) / q.d, vn = p.vx * nx + p.vy * ny; p.x = q.px + nx * (TK.hw - 0.6); p.y = q.py + ny * (TK.hw - 0.6); if (vn > 0) { p.vx -= 2 * vn * nx; p.vy -= 2 * vn * ny; } p.bounces++; part(p.x, p.y, 0, 0, 0.25, "#fde047", 0.4); }
    let gone = p.life <= 0 || (p.k === "boulon" && p.bounces > 4);
    if (!gone) for (const c of cars) {
      if (!(c.local || c.bot) || (c.id === p.owner && p.safe > 0) || Math.hypot(c.x - p.x, c.y - p.y) > 2) continue;
      hitCar(c, p.k); gone = true; if (mode === "mp") X.ev({ type: "phit", id: p.id }); break;
    }
    if (!gone) for (const d of drops) if (d.k === "pal" && Math.hypot(d.x - p.x, d.y - p.y) < 2) { gone = true; drops.splice(drops.indexOf(d), 1); break; }
    if (gone) { projs.splice(projs.indexOf(p), 1); for (let i = 0; i < 6; i++) part(p.x, p.y, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, 0.35, p.k === "drone" ? "#ef4444" : "#22c55e", 0.4); }
  }
}
// coup de fourche : on soulève le chariot de devant et on le balance derrière soi
function forkAttack(c) {
  if (c.fork > 0 || c.air > 0 || clock() < raceAt || c.fin) return false;
  c.fork = 3; c.forkT = 0.45;
  const fx = Math.cos(c.a), fy = Math.sin(c.a); let best = null, bd = 1e9;
  for (const o of cars) {
    if (o === c || o.fin || o.air > 0) continue;
    const dx = o.x - c.x, dy = o.y - c.y, d = Math.hypot(dx, dy), along = dx * fx + dy * fy, lat = Math.abs(-dx * fy + dy * fx);
    if (d < 5.8 && along > 0.4 && lat < 2.4 && d < bd) { best = o; bd = d; }
  }
  if (c === me) snd("fork");
  if (!best) { if (c === me) flash("Raté, personne devant !"); return false; }
  const side = (Math.random() < 0.5 ? -1 : 1) * 5, vx = -fx * 24 - fy * side, vy = -fy * 24 + fx * side;
  if (best.local || best.bot) applyFork(best, vx, vy, c);
  else if (mode === "mp") X.ev({ type: "fork", to: best.id, vx: +vx.toFixed(2), vy: +vy.toFixed(2) });
  if (c === me) flash(`Coup de fourche sur ${best.name} !`);
  return true;
}
function applyFork(o, vx, vy, by) {
  if (o.star > 0) return;
  o.vx = vx; o.vy = vy; o.air = 0.7; o.spin = 0.9; o.slow = 0.6;
  if (o === me) { flash(`${by ? by.name : "Quelqu'un"} t'a balancé !`); snd("spin"); shake = 0.6; }
}
function interact(c) {
  const T = clock();
  for (const b of itemBoxes) if (b.off < T && Math.hypot(b.x - c.x, b.y - c.y) < 2.4) {
    b.off = T + 4000; for (let i = 0; i < 10; i++) part(b.x, b.y, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, 0.5, `hsl(${i * 36} 90% 60%)`, 0.45);
    if (!c.item) { const rank = cars.filter(o => progress(o) > progress(c)).length / Math.max(1, cars.length - 1); c.item = pickItem(rank, cars.length === 1); c.uses = c.item === "turbo3" ? 3 : 1; if (c === me) { hudItem(); flash(ITEMS[c.item].name + " !"); snd("box"); } }
  }
  for (const d of drops.slice()) {
    if (Math.hypot(d.x - c.x, d.y - c.y) > 2.1 || c.air > 0) continue;
    if (c.star > 0) { drops.splice(drops.indexOf(d), 1); continue; }
    if (d.k === "oil") { if (!c.oil) { c.oil = 1.2; c.spin = 0.7; if (c === me) flash("Flaque d'huile !"); } }
    else { c.vx *= 0.25; c.vy *= 0.25; c.slow = 0.8; drops.splice(drops.indexOf(d), 1); for (let i = 0; i < 8; i++) part(d.x, d.y, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, 0.5, "#b45309", 0.6); if (c === me) { flash("Palette !"); if (mode === "mp") X.ev({ type: "smash", id: d.id }); } }
  }
}
function collideCars() {
  for (const c of cars) for (const o of cars) {
    if (c === o || !(c.local || c.bot) || c.air > 0 || o.air > 0) continue;
    const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy);
    if (d > 0 && d < CR * 2) {
      if ((o.star > 0 || (!o.local && !o.bot && X && X.live[o.id] && X.live[o.id].st)) && c.star <= 0) { hitCar(c, "star"); continue; }
      const push = (CR * 2 - d) / (o.local || o.bot ? 2 : 1); c.x += dx / d * push; c.y += dy / d * push;
    }
  }
}
function botDrive(c, dt) {
  const N = TK.N, ahead = TK.TR[(c.si + 14 + Math.floor(Math.hypot(c.vx, c.vy) * 0.35)) % N]; c.ai.t += dt; c.ai.cd -= dt;
  const lane = c.ai.lane + Math.sin(c.ai.t * 0.4) * 2, tx = ahead.x + ahead.nx * lane, ty = ahead.y + ahead.ny * lane;
  let da = Math.atan2(ty - c.y, tx - c.x) - c.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  const sp = Math.hypot(c.vx, c.vy), slip = TK.def.grip < 4 ? 0.3 : 0.55, thr = Math.abs(da) > slip && sp > 18 ? 0.15 : 1;
  if (c.item && c.ai.cd <= 0) {
    c.ai.cd = 0.5 + Math.random();
    const fx = Math.cos(c.a), fy = Math.sin(c.a), ahead2 = cars.some(o => o !== c && (o.x - c.x) * fx + (o.y - c.y) * fy > 3 && Math.hypot(o.x - c.x, o.y - c.y) < 45), behind = cars.some(o => o !== c && (o.x - c.x) * fx + (o.y - c.y) * fy < -2 && Math.hypot(o.x - c.x, o.y - c.y) < 18), close = cars.some(o => o !== c && Math.hypot(o.x - c.x, o.y - c.y) < 10);
    const it = c.item, use = it === "boulon" ? ahead2 && Math.abs(da) < 0.15 : it === "oil" || it === "pal" ? behind || Math.random() < 0.15 : it === "klax" ? close : it === "turbo" || it === "turbo3" ? Math.abs(da) < 0.12 : true;
    if (use) useItem(c);
  }
  if (c.fork <= 0 && Math.random() < dt * 2) { const fx = Math.cos(c.a), fy = Math.sin(c.a); if (cars.some(o => o !== c && !o.fin && Math.hypot(o.x - c.x, o.y - c.y) < 5 && (o.x - c.x) * fx + (o.y - c.y) * fy > 0.5 && Math.abs(-(o.x - c.x) * fy + (o.y - c.y) * fx) < 2.2)) forkAttack(c); }
  const cvA = TK.TR[(c.si + 12) % N].curv;
  physics(c, clock() < raceAt ? 0 : thr, Math.max(-1, Math.min(1, da * 2.4)), dt, Math.abs(cvA) > 0.26 && sp > 16 && (c.maxF || 1) > 0.94);
}

/* ---------- déroulé ---------- */
const fmt = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms % 1000 / 10)).padStart(2, "0")}`;
let itemBoxes = [];
function resetBoxes() { itemBoxes = []; for (const i of TK.rows) for (const o of [-6, -2, 2, 6]) { const p = TK.TR[i]; itemBoxes.push({ x: p.x + p.nx * o, y: p.y + p.ny * o, off: 0 }); } }
function setup(trackId, roster, at) {
  TK = buildTrack(TRACKS[trackId] ? trackId : "hangar");
  cars = roster.map((r, i) => makeCar(r, i)); me = cars.find(c => c.local); raceAt = at; drops = []; projs = []; parts = []; skids = []; rings = []; resetBoxes(); rec = []; recT = 0; finishedShown = false; hudItem();
  if (me) { camX = me.x; camY = me.y; camA = me.a; }
  $("#trackname").textContent = TK.def.name;
}
const GP_LIST = ["hangar", "quai", "froid", "usine"], GP_PTS = [15, 12, 10, 8, 6, 4, 2, 1];
let gp = null; // solo : { i, pts: { id: total } }
const raceOrder = () => cars.slice().sort((a, b) => (a.fin && b.fin) ? a.fin - b.fin : a.fin ? -1 : b.fin ? 1 : progress(b) - progress(a));
let soloTrack = (() => { try { return localStorage.getItem("fenwick-track") || "hangar"; } catch (e) { return "hangar"; } })();
function soloStart(k) {
  if (k === "gp" && kind !== "gp-next") gp = { i: 0, pts: {} };
  if (k === "gp-next") k = "gp";
  kind = k; mode = "solo"; clock = () => Date.now();
  const name = (window.ONLINE && window.ONLINE.profile && window.ONLINE.profile.pseudo) || "Toi";
  const roster = [{ id: "me", name, local: true }].concat(k === "bots" || k === "gp" ? BOTS.map(([n, f], i) => ({ id: "bot" + i, name: n, bot: true, maxF: f })) : []);
  try { ghost = k === "trial" ? JSON.parse(localStorage.getItem("fenwick-ghost-" + soloTrack) || "null") : null; } catch (e) { ghost = null; }
  setup(k === "gp" ? GP_LIST[gp.i] : soloTrack, roster, clock() + 3500); hideMenu();
  if (k === "gp") flash(`Grand Prix · course ${gp.i + 1} / 4 : ${TK.def.name}`);
}
function gpTable(pts, names, meId) {
  const rows = Object.entries(pts).sort((a, b) => b[1] - a[1]);
  return `<table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:15px">${rows.map(([id, p], i) => `<tr style="${id === meId ? "color:#facc15;font-weight:700" : ""}"><td style="padding:4px">${i + 1}</td><td style="padding:4px;text-align:left">${esc(names[id] || "?")}</td><td style="padding:4px;text-align:right">${p} pts</td></tr>`).join("")}</table>`;
}
function soloGpEnd() {
  const order = raceOrder(), names = {};
  order.forEach((c, i) => { gp.pts[c.id] = (gp.pts[c.id] || 0) + GP_PTS[i]; names[c.id] = c.local ? "Toi" : c.name; });
  const place = order.indexOf(me) + 1, last = gp.i >= GP_LIST.length - 1;
  if (window.ONLINE) window.ONLINE.submit("fenwick", gm => Object.assign(gm, { races: (gm.races || 0) + 1, bestLap: me.best ? (gm.bestLap ? Math.min(gm.bestLap, me.best) : me.best) : gm.bestLap || 0, bestLaps: me.best ? Object.assign({}, gm.bestLaps, { [TK.id]: gm.bestLaps && gm.bestLaps[TK.id] ? Math.min(gm.bestLaps[TK.id], me.best) : me.best }) : (gm.bestLaps || {}) }, last ? { gpPlayed: (gm.gpPlayed || 0) + 1, gpWins: (gm.gpWins || 0) + (Object.entries(gp.pts).sort((a, b) => b[1] - a[1])[0][0] === "me" ? 1 : 0) } : {}));
  if (last) {
    const top = Object.entries(gp.pts).sort((a, b) => b[1] - a[1]), myRank = top.findIndex(x => x[0] === "me") + 1;
    if (myRank === 1) snd("win");
    showMenu(`<h1>${myRank === 1 ? "GRAND PRIX GAGNÉ !" : `GRAND PRIX : ${myRank}E`}</h1><p>Classement final après les 4 circuits</p>${gpTable(gp.pts, names, "me")}<button class="btn" id="again">Nouveau Grand Prix</button><button class="ghost" id="tomenu">Menu</button>`);
    $("#again").onclick = () => { kind = ""; soloStart("gp"); }; $("#tomenu").onclick = () => { gp = null; mode = "menu"; showMenu(MENU); bindMenu(); };
  } else {
    showMenu(`<h1>COURSE ${gp.i + 1} / 4 : ${place}${place === 1 ? "ER" : "E"}</h1><p>${esc(TK.def.name)} · +${GP_PTS[place - 1]} pts</p>${gpTable(gp.pts, names, "me")}<p>Prochain circuit : <b>${esc(TRACKS[GP_LIST[gp.i + 1]].name)}</b></p><button class="btn" id="next">Course suivante</button><button class="ghost" id="tomenu">Abandonner</button>`);
    $("#next").onclick = () => { gp.i++; kind = "gp-next"; soloStart("gp-next"); }; $("#tomenu").onclick = () => { gp = null; mode = "menu"; showMenu(MENU); bindMenu(); };
  }
}
function soloEnd() {
  if (mode !== "solo" || !me) return;
  if (kind === "gp") return soloGpEnd();
  const place = cars.filter(c => c !== me && c.fin && c.fin < me.fin).length + 1, won = kind === "bots" && place === 1, tid = TK.id;
  let saved = false;
  if (kind === "trial") { try { const old = JSON.parse(localStorage.getItem("fenwick-ghost-" + tid) || "null"); if (!old || me.fin < old.t) { localStorage.setItem("fenwick-ghost-" + tid, JSON.stringify({ t: me.fin, p: rec })); saved = true; } } catch (e) {} }
  if (window.ONLINE) window.ONLINE.submit("fenwick", gm => Object.assign(gm, { bestLap: gm.bestLap ? Math.min(gm.bestLap, me.best) : me.best, bestLaps: Object.assign({}, gm.bestLaps, { [tid]: gm.bestLaps && gm.bestLaps[tid] ? Math.min(gm.bestLaps[tid], me.best) : me.best }), bestRace: gm.bestRace ? Math.min(gm.bestRace, me.fin) : me.fin, botWins: (gm.botWins || 0) + (won ? 1 : 0), races: (gm.races || 0) + 1 }));
  showMenu(`<h1>${kind === "bots" ? (won ? "VICTOIRE !" : `${place}E PLACE`) : "ARRIVÉE !"}</h1><p>${esc(TK.def.name)} · temps total <b>${fmt(me.fin)}</b> · meilleur tour <b>${fmt(me.best)}</b></p>${saved ? `<p style="color:#4ade80">Nouveau record perso sur ce circuit : ton fantôme est enregistré.</p>` : ""}<button class="btn" id="again">Recommencer</button><button class="ghost" id="tomenu">Changer de circuit</button>`);
  $("#again").onclick = () => soloStart(kind); $("#tomenu").onclick = () => { mode = "menu"; showMenu(MENU); bindMenu(); };
}
function lapDone(lt) { if (me.laps < LAPS) snd("lap"); flash(me.laps < LAPS ? `Tour ${me.laps} : ${fmt(lt)}${me.laps === LAPS - 1 ? " · dernier tour !" : ""}` : ""); }

/* ---------- réseau ---------- */
let liveT = 0;
function writeLive() { if (mode !== "mp" || !me) return; X.setLive({ x: +me.x.toFixed(2), y: +me.y.toFixed(2), a: +me.a.toFixed(3), si: me.si, l: me.laps, st: me.star > 0 ? 1 : 0, s0: me.started, f: me.fin || 0, ai: me.air > 0 ? +me.air.toFixed(2) : 0, b: me.boost > 0 ? 1 : 0, dr: me.drifting ? (me.dCharge >= 2.4 ? 3 : me.dCharge >= 1.5 ? 2 : me.dCharge >= 0.75 ? 1 : 0) + 1 : 0 }); }
function syncRemote(dt) {
  for (const c of cars) {
    if (c.local) continue; const l = X.live[c.id]; if (!l) continue;
    const k = Math.min(1, dt * 12); c.x += (l.x - c.x) * k; c.y += (l.y - c.y) * k;
    let da = l.a - c.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; c.a += da * k;
    c.si = l.si; c.laps = l.l; c.started = l.s0; c.fin = l.f; c.star = l.st ? 1 : 0; c.boost = l.b ? 0.2 : 0;
    if (l.dr && Math.random() < 0.6) { const col = ["#e5e7eb", "#38bdf8", "#f97316", "#c084fc"][l.dr - 1], bx = c.x - Math.cos(c.a) * 1.3, by = c.y - Math.sin(c.a) * 1.3; for (const s2 of [-0.9, 0.9]) part(bx - Math.sin(c.a) * s2, by + Math.cos(c.a) * s2, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, 0.25, col, 0.45); }
    c.forkT = Math.max(0, (c.forkT || 0) - dt); c.air = l.ai ? Math.max(0, l.ai) : Math.max(0, (c.air || 0) - dt);
  }
}
function hostTick() {
  if (!X.isHost() || !X.state) return;
  const st = X.state, T = clock(), race = st.race || 0;
  if (st.phase === "inter") {
    if (T > st.inter.until) X.setState(Object.assign({}, st, { phase: "race", race: race + 1, track: GP_LIST[st.gp.i + 1], gp: { i: st.gp.i + 1, pts: st.gp.pts }, at: Math.round(T + 4500), inter: null }));
    return;
  }
  const roster = st.roster.filter(id => X.players[id]), fin = id => { const s = X.score[id] || {}; return s.race === race ? s.fin : 0; };
  const fins = roster.map(fin).filter(Boolean);
  const all = roster.length && roster.every(fin);
  if (all || (fins.length && T - (st.at + Math.min(...fins)) > 30000) || (T - st.at > 420000)) {
    const order = st.roster.slice().sort((a, b) => { const fa = fin(a), fb = fin(b); if (fa && fb) return fa - fb; if (fa) return -1; if (fb) return 1; const la = X.live[a] || {}, lb = X.live[b] || {}; return ((lb.l || 0) * TK.N + (lb.si || 0)) - ((la.l || 0) * TK.N + (la.si || 0)); });
    if (st.gp) {
      const pts = Object.assign({}, st.gp.pts); order.forEach((id, i) => { pts[id] = (pts[id] || 0) + GP_PTS[i]; });
      if (st.gp.i < GP_LIST.length - 1) X.setState(Object.assign({}, st, { phase: "inter", gp: { i: st.gp.i, pts }, inter: { order, until: Math.round(T + 9000) } }));
      else { const fo = st.roster.slice().sort((a, b) => (pts[b] || 0) - (pts[a] || 0)); X.end({ winner: fo[0], order: fo, gpPts: pts, lastOrder: order }); }
    } else X.end({ winner: order[0], order });
  }
}
const MODES = Object.assign({ gp: { name: "Grand Prix", desc: "Les 4 circuits à la suite, avec des points cumulés (15, 12, 10, 8…)." } }, Object.fromEntries(Object.entries(TRACKS).map(([k, t]) => [k, { name: t.name, desc: t.desc }])));
let curRace = -1, mpStats = { w: 0, s: 0, t: 0, r: 0 };
if (L) L.init({
  id: "fenwick", title: "Course de Fenwick", min: 2, max: 8, modes: MODES,
  initState: (ctx) => ({ at: Math.round(ctx.now() + 4500), race: 0, phase: "race", gp: ctx.meta.mode === "gp" ? { i: 0, pts: {} } : null, track: ctx.meta.mode === "gp" ? GP_LIST[0] : ctx.meta.mode || "hangar", roster: Object.entries(ctx.players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)).map(x => x[0]) }),
  onStart(ctx) { mode = "mp"; clock = ctx.now; ghost = null; hideMenu(); curRace = -1; mpStats = { w: 0, s: 0, t: 0, r: 0 }; $("#inter").hidden = true; if (ctx.state) onState(ctx); },
  onState, onEvent(e, ctx) {
    if (mode !== "mp" || e.from === ctx.uid) return;
    if (e.type === "drop" && !drops.find(d => d.id === e.id)) drops.push({ id: e.id, k: e.k, x: e.x, y: e.y, until: e.until, owner: e.from });
    if (e.type === "smash") drops = drops.filter(d => d.id !== e.id);
    if (e.type === "proj" && !projs.find(p => p.id === e.id)) projs.push({ id: e.id, k: e.k, x: e.x, y: e.y, vx: e.vx, vy: e.vy, owner: e.from, target: e.target, life: e.k === "boulon" ? 4.5 : 9, bounces: 0, safe: 0.35, si: e.si });
    if (e.type === "phit") projs = projs.filter(p => p.id !== e.id);
    if (e.type === "klax") { rings.push({ x: e.x, y: e.y, r: 0, max: 12, life: 0.5 }); if (me && Math.hypot(me.x - e.x, me.y - e.y) < 12) hitCar(me, "klax"); projs = projs.filter(p => Math.hypot(p.x - e.x, p.y - e.y) > 12); drops = drops.filter(d => Math.hypot(d.x - e.x, d.y - e.y) > 12); }
    if (e.type === "fork" && e.to === ctx.uid && me) applyFork(me, e.vx, e.vy, cars.find(c => c.id === e.from));
    if (e.type === "forkfx") { const c = cars.find(o => o.id === e.from); if (c) c.forkT = 0.45; }
  },
  onEnd(ctx) {
    const gpm = !!ctx.meta.gpPts, order = gpm ? (ctx.meta.lastOrder || []) : (ctx.meta.order || []), pl = order.indexOf(ctx.uid) + 1, n = order.length, tid = TK ? TK.id : "hangar", gpWon = gpm && ctx.meta.winner === ctx.uid;
    const W2 = mpStats.w + (pl === 1 ? 1 : 0), S2 = mpStats.s + (pl === 2 ? 1 : 0), T2 = mpStats.t + (pl === 3 && n >= 3 ? 1 : 0), R2 = mpStats.r + 1;
    if (window.ONLINE && me) window.ONLINE.submit("fenwick", gm => Object.assign(gm, { wins: (gm.wins || 0) + W2, seconds: (gm.seconds || 0) + S2, thirds: (gm.thirds || 0) + T2, races: (gm.races || 0) + R2, gpPlayed: (gm.gpPlayed || 0) + (gpm ? 1 : 0), gpWins: (gm.gpWins || 0) + (gpWon ? 1 : 0), bestLap: me.best ? (gm.bestLap ? Math.min(gm.bestLap, me.best) : me.best) : gm.bestLap || 0, bestLaps: me.best ? Object.assign({}, gm.bestLaps, { [tid]: gm.bestLaps && gm.bestLaps[tid] ? Math.min(gm.bestLaps[tid], me.best) : me.best }) : (gm.bestLaps || {}) }));
    mode = "menu"; cars = []; me = null; eng.stop();
  },
  onStop() { mode = "menu"; cars = []; me = null; },
  results(ctx) {
    const order = ctx.meta.order || [];
    if (ctx.meta.gpPts) { const P = ctx.meta.gpPts; return `<h1>${esc((ctx.score[ctx.meta.winner] || ctx.players[ctx.meta.winner] || {}).pseudo || "?")} gagne le Grand Prix !</h1><table><tr><th>#</th><th>Pilote</th><th class="n">Points</th></tr>${order.map((id, i) => `<tr style="${id === ctx.uid ? "color:#facc15" : ""}"><td>${i + 1}</td><td>${esc((ctx.score[id] || ctx.players[id] || {}).pseudo || "?")}</td><td class="n">${P[id] || 0}</td></tr>`).join("")}</table>`; }
    return `<h1>Podium</h1><p class="lb-small">${esc((TRACKS[ctx.meta.mode] || TRACKS.hangar).name)}</p><table><tr><th>#</th><th>Pilote</th><th class="n">Temps</th><th class="n">Meilleur tour</th></tr>${order.map((id, i) => { const s = ctx.score[id] || {}; return `<tr style="${id === ctx.uid ? "color:#facc15" : ""}"><td>${i + 1}</td><td>${esc(s.pseudo || (ctx.players[id] || {}).pseudo || "?")}</td><td class="n">${s.fin ? fmt(s.fin) : "abandon"}</td><td class="n">${s.best ? fmt(s.best) : "—"}</td></tr>`; }).join("")}</table>`;
  },
  onBack() { showMenu(MENU); bindMenu(); }
});
function onState(ctx) {
  const st = ctx.state; if (mode !== "mp" || !st) return;
  if ((st.race || 0) !== curRace) {
    curRace = st.race || 0; $("#inter").hidden = true;
    setup(st.track || "hangar", st.roster.map(id => ({ id, name: (ctx.players[id] || {}).pseudo || "?", local: id === ctx.uid })), st.at);
    ctx.setScore({ fin: 0, best: 0, race: curRace });
    if (st.gp) flash(`Grand Prix · course ${st.gp.i + 1} / 4 : ${TK.def.name}`);
  }
  if (st.phase === "inter" && st.inter && $("#inter").hidden) {
    const names = {}; for (const id of st.roster) names[id] = id === ctx.uid ? "Toi" : (ctx.players[id] || ctx.score[id] || {}).pseudo || "?";
    const order = st.inter.order || [], pl = order.indexOf(ctx.uid) + 1;
    if (pl === 1) mpStats.w++; else if (pl === 2) mpStats.s++; else if (pl === 3 && order.length >= 3) mpStats.t++; mpStats.r++;
    $("#inter").innerHTML = `<h1>COURSE ${st.gp.i + 1} / 4 : ${pl}${pl === 1 ? "ER" : "E"}</h1>${gpTable(st.gp.pts, names, ctx.uid)}<p>Prochain circuit : <b>${esc(TRACKS[GP_LIST[st.gp.i + 1]].name)}</b> dans quelques secondes…</p>`;
    $("#inter").hidden = false; eng.stop();
  }
}

/* ---------- interface ---------- */
const MENU = $("#panel").innerHTML;
function showMenu(html) { $("#panel").hidden = false; $("#panel").innerHTML = html; }
function hideMenu() { $("#panel").hidden = true; }
function trackPreview(id) {
  const c = document.createElement("canvas"); c.width = 160; c.height = 110; const x = c.getContext("2d"), t = TRACKS[id], th = THEMES[t.theme];
  const xs = t.ctrl.map(p => p[0]), ys = t.ctrl.map(p => p[1]), mx = Math.min(...xs), Mx = Math.max(...xs), my = Math.min(...ys), My = Math.max(...ys), s = Math.min(140 / (Mx - mx), 90 / (My - my));
  x.fillStyle = th.floor; x.fillRect(0, 0, 160, 110); x.lineJoin = x.lineCap = "round";
  const path = () => { x.beginPath(); t.ctrl.forEach((p, i) => { const X2 = 10 + (p[0] - mx) * s, Y2 = 10 + (p[1] - my) * s; i ? x.lineTo(X2, Y2) : x.moveTo(X2, Y2); }); x.closePath(); };
  path(); x.strokeStyle = th.edge; x.lineWidth = 9; x.stroke(); path(); x.strokeStyle = th.asph; x.lineWidth = 6; x.stroke();
  return c.toDataURL();
}
function bindMenu() {
  const list = $("#tracks");
  if (list) {
    list.innerHTML = Object.entries(TRACKS).map(([k, t]) => `<button class="trk" data-t="${k}" aria-pressed="${k === soloTrack}"><img src="${trackPreview(k)}" alt=""><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`).join("");
    list.querySelectorAll(".trk").forEach(b => b.onclick = () => { soloTrack = b.dataset.t; try { localStorage.setItem("fenwick-track", soloTrack); } catch (e) {} list.querySelectorAll(".trk").forEach(o => o.setAttribute("aria-pressed", o === b)); });
  }
  $("#trial").onclick = () => soloStart("trial"); $("#bots").onclick = () => soloStart("bots"); if ($("#gp")) $("#gp").onclick = () => { kind = ""; soloStart("gp"); }; $("#multi").onclick = () => { hideMenu(); L.menu(); };
}
bindMenu();
let fl = 0; function flash(s) { $("#banner").textContent = s; fl = 2; }
function hudItem() {
  const it = me && me.item;
  $("#item").innerHTML = it ? `${ICON[it]}<span>${ITEMS[it].name}${it === "turbo3" && me.uses > 1 ? ` ×${me.uses}` : ""}</span>` : `<span class="empty">objet</span>`;
  $("#item").classList.toggle("full", !!it);
}
addEventListener("keydown", e => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault(); keys.add(e.code); if ((e.code === "Space" || e.code === "KeyE") && me) useItem(me); if (e.code === "KeyF" && me && !e.repeat) doFork(); });
function doFork() { if (!me) return; const ok = forkAttack(me); if (mode === "mp" && me.forkT > 0.4) X.ev({ type: "forkfx" }); return ok; }
addEventListener("keyup", e => keys.delete(e.code));
for (const [id, k] of [["#tl", "l"], ["#tr", "r"], ["#tgas", "gas"], ["#tbrake", "brake"], ["#tdrift", "drift"]]) {
  const b = $(id); b.addEventListener("pointerdown", e => { e.preventDefault(); touch[k] = 1; b.classList.add("on"); });
  const up = () => { touch[k] = 0; b.classList.remove("on"); }; b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up);
}
$("#item").addEventListener("pointerdown", e => { e.preventDefault(); if (me) useItem(me); });
$("#tfork").addEventListener("pointerdown", e => { e.preventDefault(); doFork(); });

/* ---------- dessin ---------- */
let W = 0, H = 0, S0 = 10, S = 10, camX = 100, camY = 100, camA = 0, AX = 0, AY = 0;
function fit() { const d = devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; S0 = Math.max(7, Math.min(W, H) / 38); AX = W / 2; AY = H * 0.66; }
addEventListener("resize", fit); fit();
function worldT() { const d = devicePixelRatio || 1, sh = shake > 0 ? shake * 14 : 0; g.setTransform(d, 0, 0, d, 0, 0); g.translate(AX + (Math.random() - 0.5) * sh, AY + (Math.random() - 0.5) * sh); g.rotate(-(camA + Math.PI / 2)); g.scale(S, S); g.translate(-camX, -camY); }
function toScreen(x, y) { const dx = (x - camX) * S, dy = (y - camY) * S, r = -(camA + Math.PI / 2), c = Math.cos(r), s = Math.sin(r); return [AX + dx * c - dy * s, AY + dx * s + dy * c]; }
const PC = () => [camX, camY];
function box3d(b) {
  const f = b.z / (CAMH - b.z), C = PC(), pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]], top = pts.map(([x, y]) => [x + (x - C[0]) * f, y + (y - C[1]) * f]);
  g.fillStyle = "#00000040"; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x + 0.6, y + 0.8) : g.moveTo(x + 0.6, y + 0.8)); g.closePath(); g.fill();
  const sides = [0, 1, 2, 3].map(i => ({ i, d: Math.hypot((pts[i][0] + pts[(i + 1) % 4][0]) / 2 - C[0], (pts[i][1] + pts[(i + 1) % 4][1]) / 2 - C[1]) })).sort((a, b) => b.d - a.d);
  for (const { i } of sides) { const j = (i + 1) % 4; g.fillStyle = b.side; g.beginPath(); g.moveTo(pts[i][0], pts[i][1]); g.lineTo(pts[j][0], pts[j][1]); g.lineTo(top[j][0], top[j][1]); g.lineTo(top[i][0], top[i][1]); g.closePath(); g.fill(); g.strokeStyle = "#00000030"; g.lineWidth = 0.08; g.stroke(); }
  g.fillStyle = b.top; g.beginPath(); top.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();
  // détails sur le dessus
  const tx = top[0][0], ty = top[0][1], tw = top[1][0] - top[0][0], th = top[3][1] - top[0][1];
  if (b.rack) { const n = b.crates.length; b.crates.forEach((c, i) => { if (!c) return; g.fillStyle = c; g.fillRect(tx + tw * (i / n) + tw * 0.03, ty + th * 0.15, tw / n * 0.9, th * 0.7); g.strokeStyle = "#0004"; g.lineWidth = 0.1; g.strokeRect(tx + tw * (i / n) + tw * 0.03, ty + th * 0.15, tw / n * 0.9, th * 0.7); }); }
  else if (b.pallet) { g.strokeStyle = "#78350f"; g.lineWidth = 0.18; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(tx, ty + th * k / 4); g.lineTo(tx + tw, ty + th * k / 4); g.stroke(); } }
  else if (b.container) { g.strokeStyle = "#00000040"; g.lineWidth = 0.2; const v = b.container === "v"; for (let k = 1; k < 10; k++) { g.beginPath(); if (v) { g.moveTo(tx, ty + th * k / 10); g.lineTo(tx + tw, ty + th * k / 10); } else { g.moveTo(tx + tw * k / 10, ty); g.lineTo(tx + tw * k / 10, ty + th); } g.stroke(); } }
  else if (b.machine) { g.fillStyle = "#18181b"; g.fillRect(tx + tw * 0.15, ty + th * 0.2, tw * 0.5, th * 0.5); g.fillStyle = b.led; g.beginPath(); g.arc(tx + tw * 0.82, ty + th * 0.3, 0.45, 0, 7); g.fill(); g.fillStyle = "#facc15"; g.fillRect(tx, ty + th - 0.5, tw, 0.5); }
  else if (b.ice) { g.fillStyle = "#ffffff70"; g.fillRect(tx + tw * 0.1, ty + th * 0.1, tw * 0.3, th * 0.2); }
  else if (b.fridge) { g.fillStyle = "#94a3b8"; g.fillRect(tx + tw * 0.48, ty + th * 0.1, tw * 0.04, th * 0.8); g.fillStyle = "#38bdf8"; g.fillRect(tx + tw * 0.1, ty + th * 0.15, tw * 0.15, th * 0.2); }
  else if (b.pillar) { g.fillStyle = "#facc15"; g.fillRect(tx, ty, tw, th * 0.25); }
}
function forklift(c, alpha) {
  const lift = c.air > 0 ? Math.sin(Math.max(0, 0.7 - c.air) / 0.7 * Math.PI) : 0;
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = "#00000055"; g.beginPath(); g.ellipse(c.x + 0.5 + lift * 2, c.y + 0.7 + lift * 2, 2.1, 1.5, c.a, 0, 7); g.fill();
  const sc = 1 + lift * 0.45; g.translate(c.x, c.y); g.rotate(c.a); g.scale(sc, sc);
  if (c.spin > 0 && c.air <= 0) g.rotate(Math.sin(clock() / 40) * 0.1);
  // roues
  g.fillStyle = "#0b0b0b"; for (const [x, y] of [[-1.15, -1.12], [-1.15, 0.78], [0.55, -1.12], [0.55, 0.78]]) { g.fillRect(x, y, 0.8, 0.34); g.fillStyle = "#3f3f46"; g.fillRect(x + 0.25, y + 0.08, 0.3, 0.18); g.fillStyle = "#0b0b0b"; }
  // contrepoids et caisse
  g.fillStyle = "#1f2937"; g.fillRect(-1.75, -0.82, 0.55, 1.64);
  g.fillStyle = c.star > 0 ? `hsl(${(clock() / 3) % 360} 90% 60%)` : c.color; g.fillRect(-1.3, -0.85, 2.4, 1.7);
  g.fillStyle = "#ffffff30"; g.fillRect(-1.3, -0.85, 2.4, 0.3);
  g.fillStyle = "#00000030"; g.fillRect(-1.3, 0.6, 2.4, 0.25);
  // cabine : arceaux et pilote
  g.fillStyle = "#111827"; g.fillRect(-0.9, -0.72, 1.3, 0.14); g.fillRect(-0.9, 0.58, 1.3, 0.14); g.fillRect(-0.9, -0.72, 0.14, 1.44); g.fillRect(0.26, -0.72, 0.14, 1.44);
  g.fillStyle = "#1f2937"; g.fillRect(-0.55, -0.4, 0.5, 0.8);
  g.fillStyle = "#fde68a"; g.beginPath(); g.arc(-0.2, 0, 0.36, 0, 7); g.fill(); g.fillStyle = c.color; g.beginPath(); g.arc(-0.25, 0, 0.3, Math.PI * 0.6, Math.PI * 1.4); g.fill();
  // feux
  g.fillStyle = "#fef9c3"; g.fillRect(0.95, -0.8, 0.18, 0.28); g.fillRect(0.95, 0.52, 0.18, 0.28); g.fillStyle = "#ef4444"; g.fillRect(-1.78, -0.78, 0.1, 0.3); g.fillRect(-1.78, 0.48, 0.1, 0.3);
  // mât et fourches
  const fk = c.forkT > 0 ? Math.sin(Math.max(0, 0.45 - c.forkT) / 0.45 * Math.PI) : 0;
  g.fillStyle = "#4b5563"; g.fillRect(1.1, -0.95, 0.3, 1.9); g.fillStyle = "#6b7280"; g.fillRect(1.15, -0.88, 0.2, 1.76);
  g.fillStyle = fk > 0 ? "#fde047" : "#9ca3af"; g.fillRect(1.4, -0.62, 1.4 + fk * 1.2, 0.24); g.fillRect(1.4, 0.38, 1.4 + fk * 1.2, 0.24);
  if (c.boost > 0) { g.fillStyle = Math.random() < 0.5 ? "#f97316" : "#fde047"; g.beginPath(); g.moveTo(-1.78, -0.45); g.lineTo(-2.9 - Math.random() * 1.2, 0); g.lineTo(-1.78, 0.45); g.fill(); }
  g.restore();
  if (c.star > 0) { g.strokeStyle = `hsla(${(clock() / 3) % 360},90%,60%,.7)`; g.lineWidth = 0.3; g.beginPath(); g.arc(c.x, c.y, 2.6, 0, 7); g.stroke(); }
}
function trackPath(off) {
  const T = TK.TR; g.beginPath(); for (let i = 0; i <= TK.N; i++) { const p = T[i % TK.N], x = p.x + p.nx * off, y = p.y + p.ny * off; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath();
}
function draw() {
  const d = devicePixelRatio || 1, T = clock();
  g.setTransform(d, 0, 0, d, 0, 0);
  if (!TK) { g.fillStyle = "#18181b"; g.fillRect(0, 0, W, H); return; }
  const th = TK.th, hw = TK.hw;
  g.fillStyle = th.floor; g.fillRect(0, 0, W, H);
  worldT();
  // sol à motifs (et eau autour du quai)
  const bb = TK.bb;
  if (th.water) { g.fillStyle = th.water; g.fillRect(bb.x1 - 400, bb.y1 - 400, bb.x2 - bb.x1 + 800, bb.y2 - bb.y1 + 800); g.strokeStyle = "#ffffff22"; g.lineWidth = 0.3; for (let k = 0; k < 40; k++) { const wy = bb.y1 - 300 + k * 30 + Math.sin(T / 900 + k) * 3; g.beginPath(); g.moveTo(bb.x1 - 400, wy); g.lineTo(bb.x2 + 400, wy + 6); g.stroke(); } }
  g.fillStyle = TK.pat.floor; g.fillRect(bb.x1, bb.y1, bb.x2 - bb.x1, bb.y2 - bb.y1);
  if (th.water) { g.strokeStyle = "#a8a29e"; g.lineWidth = 1.2; g.strokeRect(bb.x1, bb.y1, bb.x2 - bb.x1, bb.y2 - bb.y1); }
  for (const f of TK.flats) {
    if (f.k === "stain") { g.fillStyle = "#00000022"; g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.6, 0.4, 0, 7); g.fill(); }
    else if (f.k === "lines" || f.k === "hazard") { g.save(); g.translate(f.x, f.y); for (let k = 0; k < 5; k++) { g.fillStyle = k % 2 ? "#111" : "#facc15"; g.fillRect(k * 1.2, 0, 1.2, 4); } g.restore(); }
    else if (f.k === "snowpile") { g.fillStyle = "#ffffff"; g.beginPath(); g.ellipse(f.x, f.y, f.r, f.r * 0.7, 0, 0, 7); g.fill(); g.fillStyle = "#e0f2fe"; g.beginPath(); g.ellipse(f.x - f.r * 0.2, f.y - f.r * 0.15, f.r * 0.5, f.r * 0.3, 0, 0, 7); g.fill(); }
  }
  // piste : bordure, vibreurs, bitume
  g.lineJoin = "round"; g.lineCap = "round";
  trackPath(0); g.strokeStyle = th.edge; g.lineWidth = hw * 2 + 3.2; g.stroke();
  trackPath(0); g.lineCap = "butt"; g.setLineDash([2.4, 2.4]); g.strokeStyle = "#111"; g.stroke(); g.setLineDash([]); g.lineCap = "round";
  trackPath(0); g.strokeStyle = th.asph; g.lineWidth = hw * 2; g.stroke();
  trackPath(0); g.strokeStyle = TK.pat.asph; g.lineWidth = hw * 2; g.stroke();
  const Tr = TK.TR, N = TK.N;
  for (let i = 0; i < N; i += 2) { const p = Tr[i], q2 = Tr[(i + 2) % N]; if (Math.abs(p.curv) < 0.16) continue; const side = p.curv > 0 ? -1 : 1, o1 = (hw - 1.4) * side, o2 = hw * side; g.fillStyle = th.kerb[(i / 2) % 2]; g.beginPath(); g.moveTo(p.x + p.nx * o1, p.y + p.ny * o1); g.lineTo(q2.x + q2.nx * o1, q2.y + q2.ny * o1); g.lineTo(q2.x + q2.nx * o2, q2.y + q2.ny * o2); g.lineTo(p.x + p.nx * o2, p.y + p.ny * o2); g.closePath(); g.fill(); }
  trackPath(0); g.lineCap = "butt"; g.setLineDash([3, 4]); g.strokeStyle = th.line; g.lineWidth = 0.3; g.stroke(); g.setLineDash([]); g.lineCap = "round";
  // zones spéciales : glace, flaques, tapis roulants, pads turbo
  for (const i of TK.ice) { g.save(); g.globalAlpha = 0.75; g.lineCap = "butt"; g.beginPath(); for (let k = -22; k <= 22; k++) { const p = Tr[(i + k + N) % N]; k === -22 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y); } g.strokeStyle = "#bae6fd"; g.lineWidth = hw * 2 - 0.6; g.stroke(); g.strokeStyle = TK.pat.ice; g.stroke(); g.restore(); }
  for (const i of TK.puddles) { const p = Tr[i], lx = p.x + p.nx * ((i % 3) - 1) * 4, ly = p.y + p.ny * ((i % 3) - 1) * 4; g.fillStyle = "#1e3a8acc"; g.beginPath(); g.ellipse(lx, ly, 3.4, 2.4, Math.atan2(p.ty, p.tx), 0, 7); g.fill(); g.fillStyle = "#93c5fd66"; g.beginPath(); g.ellipse(lx - 0.8, ly - 0.5, 1.2, 0.5, 0.3, 0, 7); g.fill(); const sh2 = 0.35 + 0.35 * Math.sin(T / 300 + i), ph = (T / 1200 + i) % 1; g.fillStyle = `rgba(255,248,220,${sh2})`; g.beginPath(); g.ellipse(lx + 0.6 + Math.sin(T / 700 + i) * 0.8, ly + 0.3, 0.9, 0.18, 0.2, 0, 7); g.fill(); g.strokeStyle = `rgba(191,219,254,${0.5 - ph * 0.5})`; g.lineWidth = 0.12; g.beginPath(); g.ellipse(lx, ly, 1 + ph * 2.2, 0.7 + ph * 1.5, Math.atan2(p.ty, p.tx), 0, 7); g.stroke(); }
  for (const [a, b, s] of TK.belts) { const len = ((b - a) + N) % N; for (let k = 0; k < len; k++) { const p = Tr[(a + k) % N]; g.fillStyle = k % 2 ? "#3f3f46" : "#52525b"; g.beginPath(); const q2 = Tr[(a + k + 1) % N]; g.moveTo(p.x + p.nx * hw, p.y + p.ny * hw); g.lineTo(q2.x + q2.nx * hw, q2.y + q2.ny * hw); g.lineTo(q2.x - q2.nx * hw, q2.y - q2.ny * hw); g.lineTo(p.x - p.nx * hw, p.y - p.ny * hw); g.fill(); if (k % 6 === Math.floor(T / 90) % 6) { g.strokeStyle = "#facc15"; g.lineWidth = 0.4; for (let o = -hw + 2; o < hw; o += 3.5) { const cx = p.x + p.nx * o, cy = p.y + p.ny * o; g.beginPath(); g.moveTo(cx - p.tx * 0.8 - p.nx * s * 0.6, cy - p.ty * 0.8 - p.ny * s * 0.6); g.lineTo(cx + p.nx * s * 0.6, cy + p.ny * s * 0.6); g.lineTo(cx + p.tx * 0.8 - p.nx * s * 0.6, cy + p.ty * 0.8 - p.ny * s * 0.6); g.stroke(); } } } }
  for (const i of TK.pads) { const p = Tr[i]; g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.ty, p.tx)); g.fillStyle = "#7c2d12"; g.fillRect(-4, -4.2, 8, 8.4); for (let k = 0; k < 3; k++) { const on = (Math.floor(T / 120) % 3) === k; g.strokeStyle = on ? "#fde047" : "#f97316"; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-2.6 + k * 2.2, -3); g.lineTo(-0.8 + k * 2.2, 0); g.lineTo(-2.6 + k * 2.2, 3); g.stroke(); } g.restore(); }
  // départ en damier et cases de départ
  { const p = Tr[0]; g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.ny, p.nx)); for (let k = -8; k < 8; k++) for (let j = 0; j < 2; j++) { g.fillStyle = (k + j) % 2 ? "#fff" : "#111"; g.fillRect(k * hw / 8, (j - 1) * 0.9, hw / 8, 0.9); } g.restore(); }
  for (let s2 = 0; s2 < 8; s2++) { const i = (N - 10 - Math.floor(s2 / 2) * 11 + N) % N, p = Tr[i], lat = s2 % 2 ? -3.4 : 3.4; g.save(); g.translate(p.x + p.nx * lat, p.y + p.ny * lat); g.rotate(Math.atan2(p.ty, p.tx)); g.strokeStyle = "#ffffff55"; g.lineWidth = 0.2; g.strokeRect(-1.8, -1.3, 3.6, 2.6); g.restore(); }
  // traces de pneus
  g.strokeStyle = "#00000059"; g.lineWidth = 0.35; g.beginPath(); for (const s of skids) { g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); } g.stroke();
  // halos de lumière
  for (const l of TK.lights) { const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); gr.addColorStop(0, l.c); gr.addColorStop(1, "transparent"); g.fillStyle = gr; g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
  // caisses à objets (cubes arc-en-ciel)
  for (const b of itemBoxes) { if (b.off > T) continue; const s = 1.1 + Math.sin(T / 250 + b.x) * 0.08, hue = (T / 8 + b.x * 10) % 360; g.save(); g.translate(b.x, b.y); g.rotate(T / 600 + b.y); g.fillStyle = "#00000040"; g.fillRect(-s + 0.4, -s + 0.5, s * 2, s * 2); g.fillStyle = `hsla(${hue},90%,60%,.9)`; g.fillRect(-s, -s, s * 2, s * 2); g.fillStyle = "#ffffffcc"; g.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4); g.rotate(-(T / 600 + b.y) + camA + Math.PI / 2); g.fillStyle = `hsl(${hue},80%,40%)`; g.font = `800 ${s * 1.5}px Inter`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 0, 0.1); g.restore(); }
  // huile et palettes
  drops = drops.filter(dd => dd.until > T);
  for (const dd of drops) {
    if (dd.k === "oil") { g.fillStyle = "#0a0a0a"; g.beginPath(); g.ellipse(dd.x, dd.y, 2, 1.4, 0.4, 0, 7); g.fill(); g.fillStyle = "#7c3aed88"; g.beginPath(); g.ellipse(dd.x - 0.5, dd.y - 0.3, 0.8, 0.35, 0.4, 0, 7); g.fill(); }
    else box3d({ x: dd.x - 1.3, y: dd.y - 1.3, w: 2.6, h: 2.6, z: 1.2, top: "#b45309", side: "#78350f", pallet: true });
  }
  // projectiles
  for (const p of projs) {
    g.fillStyle = "#00000050"; g.beginPath(); g.arc(p.x + 0.4, p.y + 0.5, 0.9, 0, 7); g.fill();
    if (p.k === "boulon") { g.save(); g.translate(p.x, p.y); g.rotate(T / 60); g.fillStyle = "#22c55e"; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(Math.cos(a) * 1, Math.sin(a) * 1); } g.fill(); g.fillStyle = "#14532d"; g.beginPath(); g.arc(0, 0, 0.42, 0, 7); g.fill(); g.restore(); }
    else { g.save(); g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx)); g.fillStyle = "#ef4444"; g.fillRect(-0.6, -0.6, 1.2, 1.2); g.fillStyle = "#fca5a5"; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.arc(a * 0.9, b * 0.9, 0.45 + Math.random() * 0.1, 0, 7); g.fill(); } g.restore(); }
  }
  // fantôme
  if (ghost && me && T > raceAt) { const i = Math.floor((T - raceAt) / 100); const gp = ghost.p[Math.min(i, ghost.p.length - 1)]; if (gp) forklift({ x: gp[0], y: gp[1], a: gp[2], color: "#e5e7eb", forkT: 0, air: 0, boost: 0, star: 0, spin: 0 }, 0.35); }
  for (const c of cars) {
    const fx = Math.cos(c.a), fy = Math.sin(c.a), hx = c.x + fx * 1.2, hy = c.y + fy * 1.2, L2 = 15, sp2 = 6;
    const gr2 = g.createLinearGradient(hx, hy, hx + fx * L2, hy + fy * L2); gr2.addColorStop(0, "rgba(254,249,195,.32)"); gr2.addColorStop(1, "rgba(254,249,195,0)");
    g.fillStyle = gr2; g.beginPath(); g.moveTo(hx - fy * 0.9, hy + fx * 0.9); g.lineTo(hx + fx * L2 - fy * sp2, hy + fy * L2 + fx * sp2); g.lineTo(hx + fx * L2 + fy * sp2, hy + fy * L2 - fx * sp2); g.lineTo(hx + fy * 0.9, hy - fx * 0.9); g.closePath(); g.fill();
    if (!c.local) { const ba = T / 180 + c.x, rg = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, 9); rg.addColorStop(0, "rgba(251,146,60,.45)"); rg.addColorStop(1, "rgba(251,146,60,0)"); g.fillStyle = rg; g.beginPath(); g.moveTo(c.x, c.y); g.arc(c.x, c.y, 9, ba, ba + 0.9); g.closePath(); g.fill(); }
  }
  for (const c of cars.slice().sort((a, b) => (a.local ? 1 : 0) - (b.local ? 1 : 0))) {
    forklift(c, 1);
    if (!c.local) { const on = Math.sin(T / 90 + c.x) > 0; g.fillStyle = on ? "#fb923c" : "#9a3412"; g.beginPath(); g.arc(c.x - Math.cos(c.a) * 0.3, c.y - Math.sin(c.a) * 0.3, 0.32, 0, 7); g.fill(); }
  }
  // particules et ondes
  for (const p of parts) { g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); } g.globalAlpha = 1;
  for (const p of smoke) { g.fillStyle = `rgba(${p.c},${0.32 * p.life / p.max})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 7); g.fill(); }
  for (const r of rings) { g.strokeStyle = `rgba(168,85,247,${r.life * 2})`; g.lineWidth = 0.8; g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke(); }
  // décor en fausse 3D (du plus loin au plus près)
  const C = PC(), vis = TK.boxes.filter(b => Math.abs(b.x - C[0]) < 70 && Math.abs(b.y - C[1]) < 70).sort((a, b) => Math.hypot(b.x + b.w / 2 - C[0], b.y + b.h / 2 - C[1]) - Math.hypot(a.x + a.w / 2 - C[0], a.y + a.h / 2 - C[1]));
  for (const b of vis) box3d(b);
  // étiquettes à l'écran
  g.setTransform(d, 0, 0, d, 0, 0);
  g.font = `700 ${Math.max(11, S * 1.0)}px Inter, sans-serif`; g.textAlign = "center"; g.textBaseline = "alphabetic";
  for (const c of cars) { const [sx, sy] = toScreen(c.x, c.y), t = c.local ? "TOI" : c.name.slice(0, 12), tw = g.measureText(t).width + 10; g.fillStyle = "#000b"; g.fillRect(sx - tw / 2, sy - 3.6 * S, tw, S * 1.5); g.fillStyle = c.color; g.fillText(t, sx, sy - 2.5 * S); }
  // météo et ambiance du circuit
  const tile = TK.th.tile;
  if (tile === "planks" || tile === "snow") {
    while (wx.length < (tile === "snow" ? 90 : 140)) wx.push({ x: Math.random() * W, y: Math.random() * H, v: 0.6 + Math.random() * 0.8, s: 1 + Math.random() * 2.2 });
    for (const p of wx) {
      if (tile === "planks") { g.strokeStyle = "rgba(203,213,225,.38)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - 4, p.y + 16); g.stroke(); }
      else { g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.arc(p.x + Math.sin(T / 700 + p.v * 9) * 6, p.y, p.s, 0, 7); g.fill(); }
    }
    if (tile === "planks") { g.strokeStyle = "rgba(226,232,240,.35)"; g.lineWidth = 1; for (let k = 0; k < 10; k++) { const ph = ((T / 600 + k * 0.37) % 1), n2 = Math.floor(T / 600 + k * 0.37), rx = (k * 137.5 + n2 * 91) % W, ry = (k * 211.3 + n2 * 53) % H; g.beginPath(); g.ellipse(rx, ry, 3 + ph * 9, 1.5 + ph * 4, 0, 0, 7); g.stroke(); } }
    else { const fr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); fr.addColorStop(0, "rgba(224,242,254,0)"); fr.addColorStop(1, "rgba(224,242,254,.4)"); g.fillStyle = fr; g.fillRect(0, 0, W, H); }
  }
  if (tile === "plate" && Math.random() < 0.35) { const ms = vis.filter(b => b.machine); if (ms.length) { const b = ms[Math.floor(Math.random() * ms.length)]; for (let k = 0; k < 6; k++) part(b.x + b.w * Math.random(), b.y + b.h + 0.3, (Math.random() - 0.5) * 10, Math.random() * 6, 0.35, Math.random() < 0.5 ? "#fde047" : "#fff7ed", 0.3); } }
  if (tile === "concrete") { for (let k = 0; k < 26; k++) { const px2 = (k * 97.3 + T / 40 * (k % 3 + 1)) % W, py2 = (k * 53.7 + Math.sin(T / 1500 + k) * 30 + H) % H; g.fillStyle = "rgba(254,243,199,.25)"; g.fillRect(px2, py2, 2, 2); } }
  // vitesse : traits
  if (me && me.boost > 0) { g.strokeStyle = "#ffffff30"; g.lineWidth = 2; for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, r1 = Math.min(W, H) * 0.35, r2 = r1 + 60 + Math.random() * 80; g.beginPath(); g.moveTo(AX + Math.cos(a) * r1, AY + Math.sin(a) * r1); g.lineTo(AX + Math.cos(a) * r2, AY + Math.sin(a) * r2); g.stroke(); } }
  // feux de départ
  if (T < raceAt + 800 && cars.length) {
    const n = Math.ceil((raceAt - T) / 1000); g.fillStyle = "#000c"; g.fillRect(W / 2 - 110, 130, 220, 70);
    for (let k = 0; k < 3; k++) { g.fillStyle = T >= raceAt ? "#22c55e" : n <= 3 - k ? "#ef4444" : "#3f3f46"; g.beginPath(); g.arc(W / 2 - 66 + k * 66, 165, 24, 0, 7); g.fill(); }
  }
  // mini-carte
  const mw = Math.min(170, W * 0.3), sx = mw / (bb.x2 - bb.x1 - 80), mh = (bb.y2 - bb.y1 - 80) * sx, mx = W - mw - 14, my = 72, ox = bb.x1 + 40, oy = bb.y1 + 40;
  g.fillStyle = "#0a0a0ce6"; g.fillRect(mx - 8, my - 8, mw + 16, mh + 16); g.strokeStyle = TK.th.edge; g.lineWidth = 2; g.strokeRect(mx - 8, my - 8, mw + 16, mh + 16);
  g.beginPath(); Tr.forEach((p, i) => i % 6 ? 0 : (i ? g.lineTo(mx + (p.x - ox) * sx, my + (p.y - oy) * sx) : g.moveTo(mx + (p.x - ox) * sx, my + (p.y - oy) * sx))); g.closePath(); g.strokeStyle = "#d4d4d8"; g.lineWidth = 3; g.stroke();
  for (const c of cars) { g.fillStyle = c.color; g.beginPath(); g.arc(mx + (c.x - ox) * sx, my + (c.y - oy) * sx, c.local ? 5 : 4, 0, 7); g.fill(); if (c.local) { g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke(); } }
}

/* ---------- boucle ---------- */
let last = performance.now(), lastTick = performance.now(), lastCount = 9;
document.addEventListener("visibilitychange", () => { if (document.hidden) eng.stop(); });
function tick(dt) {
  lastTick = performance.now();
  for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; } parts = parts.filter(p => p.life > 0);
  for (const r of rings) { r.life -= dt; r.r = r.max * (1 - r.life / 0.5); } rings = rings.filter(r => r.life > 0);
  if (mode === "menu" || !me) { eng.stop(); return; }
  const T = clock();
  { const n = Math.ceil((raceAt - T) / 1000); if (n !== lastCount) { if (n >= 1 && n <= 3) snd("beep"); else if (n <= 0 && lastCount >= 1) snd("go"); lastCount = n; } }
  if (!me.fin) eng.set(Math.min(1, Math.hypot(me.vx, me.vy) / 50), me.boost > 0); 
  if (!me.fin) {
    const thr = (keys.has("ArrowUp") || keys.has("KeyW") || keys.has("KeyZ") || touch.gas ? 1 : 0) - (keys.has("ArrowDown") || keys.has("KeyS") || touch.brake ? 1 : 0);
    const st = (keys.has("ArrowRight") || keys.has("KeyD") || touch.r ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("KeyQ") || touch.l ? 1 : 0);
    physics(me, T < raceAt ? 0 : thr, st, dt, keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("KeyX") || touch.drift);
  } else { me.vx *= 0.96; me.vy *= 0.96; physics(me, 0, 0, dt); }
  interact(me);
  for (const c of cars) if (c.bot) { if (!c.fin) botDrive(c, dt); else physics(c, 0, 0, dt); interact(c); }
  collideCars(); updateProjs(dt);
  if (mode === "mp") { syncRemote(dt); liveT += dt; if (liveT > 0.09) { liveT = 0; writeLive(); } hostTick(); if (!me) return; }
  if (T > raceAt && !me.fin) { recT += dt; if (recT >= 0.1) { recT -= 0.1; rec.push([+me.x.toFixed(2), +me.y.toFixed(2), +me.a.toFixed(2)]); } }
  // caméra qui suit le chariot
  const sp = Math.hypot(me.vx, me.vy), fx = Math.cos(me.a), fy = Math.sin(me.a);
  camX += (me.x + fx * 7 - camX) * Math.min(1, dt * 8); camY += (me.y + fy * 7 - camY) * Math.min(1, dt * 8);
  let da = me.a - camA; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; if (me.spin <= 0) camA += da * Math.min(1, dt * 4);
  S += (S0 * (1.12 - Math.min(0.3, sp / 160)) - S) * Math.min(1, dt * 3);
  const pos = cars.slice().sort((a, b) => progress(b) - progress(a)).indexOf(me) + 1;
  $("#lap").textContent = `Tour ${Math.min(LAPS, me.laps + 1)} / ${LAPS}`;
  $("#pos").textContent = cars.length > 1 ? `${pos}${pos === 1 ? "er" : "e"} / ${cars.length}` : "Chrono";
  $("#time").textContent = T > raceAt ? fmt(me.fin || T - raceAt) : fmt(0);
  $("#driftst").textContent = me.drifting ? ["Dérapage…", "Mini-turbo prêt", "Super turbo prêt", "ULTRA TURBO prêt"][me.dCharge >= 2.4 ? 3 : me.dCharge >= 1.5 ? 2 : me.dCharge >= 0.75 ? 1 : 0] : ""; $("#driftst").style.color = me.drifting ? ["#e5e7eb", "#38bdf8", "#f97316", "#c084fc"][me.dCharge >= 2.4 ? 3 : me.dCharge >= 1.5 ? 2 : me.dCharge >= 0.75 ? 1 : 0] : "";
  $("#forkst").textContent = me.fork > 0 ? `Fourche ${Math.ceil(me.fork)} s` : "Fourche prête (F)"; $("#forkst").classList.toggle("ready", me.fork <= 0);
  if (me.fin && mode === "mp" && !finishedShown) { finishedShown = true; flash(`Arrivée en ${pos}${pos === 1 ? "re" : "e"} position !`); }
}
function fxTick(dt) {
  shake = Math.max(0, shake - dt * 1.6);
  for (const p of smoke) { p.life -= dt; p.r += dt * 2.6; } smoke = smoke.filter(p => p.life > 0);
  const tile = TK && TK.th.tile, sp = me ? Math.hypot(me.vx, me.vy) : 0;
  for (const p of wx) { if (tile === "planks") { p.y += 900 * dt * p.v; p.x -= 220 * dt * p.v; } else { p.y += 60 * dt * p.v; p.x -= sp * dt * 1.5; } if (p.y > H) { p.y = -20; p.x = Math.random() * (W + 200); } if (p.x < -30) p.x = W + 20; }
  if (tile !== "planks" && tile !== "snow") wx = [];
}
function frame(t) { const dt = Math.min(0.05, (t - last) / 1000); last = t; tick(dt); fxTick(dt); draw(); if (fl > 0) { fl -= dt; if (fl <= 0) $("#banner").textContent = ""; } requestAnimationFrame(frame); }
setInterval(() => { const t = performance.now(); if (t - lastTick > 400 && mode === "mp") tick(Math.min(0.1, (t - lastTick) / 1000)); }, 300);
requestAnimationFrame(frame);
window.FENWICK = { finishNow: () => { for (const c of cars) if ((c.local || c.bot) && !c.fin) { c.best = c.best || 30000; finish(c); } }, get gp() { return gp; }, get drifting() { return me && me.drifting; }, get cars() { return cars; }, get me() { return me; }, soloStart, keys, touch, useItem: () => me && useItem(me), fork: () => doFork(), get drops() { return drops; }, get projs() { return projs; }, get TK() { return TK; }, TRACKS, setTrack: t => { soloTrack = t; }, give: it => { if (me) { me.item = it; me.uses = it === "turbo3" ? 3 : 1; hudItem(); } } };
}
