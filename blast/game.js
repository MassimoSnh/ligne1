"use strict";
{
const $ = s => document.querySelector(s), cv = $("#cv"), g = cv.getContext("2d");
const COLS = 15, ROWS = 13, FUSE = 2400, FIRE = 550, WIN = 3, SUDDEN = 90000;
const SPAWNS = [[1, 1], [13, 11], [13, 1], [1, 11]];
const COLORS = ["#facc15", "#38bdf8", "#f472b6", "#4ade80"];
const BOTN = ["Rouille", "Boulon", "Piston"];
const TEAMC = { A: ["#facc15", "#f97316"], B: ["#38bdf8", "#a78bfa"] }, TEAM_OF = i => (i === 0 || i === 3 ? "A" : "B");
const ARENAS = { classique: { name: "Classique", desc: "L'arène de base." }, glace: { name: "Patinoire", desc: "Sol gelé : on glisse, difficile de s'arrêter pile." }, usine: { name: "Usine", desc: "Deux tapis roulants qui t'emportent sur les côtés." }, portails: { name: "Portails", desc: "Deux paires de téléporteurs pour surprendre les autres." } };
const PORTALS = [[[3, 5], [11, 7]], [[11, 5], [3, 7]]], BELTS = [[3, 1], [9, -1]];
const PU_T = [["bomb", 3], ["fire", 3], ["speed", 2], ["kick", 1.3], ["remote", 0.8], ["shield", 1]];
const puType = v => { let s = v * PU_T.reduce((a, b) => a + b[1], 0); for (const [t, w] of PU_T) { s -= w; if (s <= 0) return t; } return "bomb"; };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = (a, b) => { let h = (2166136261 ^ a) >>> 0; h = Math.imul(h ^ b, 16777619); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
const K = (x, y) => x + "," + y;
const isTouch = matchMedia("(pointer:coarse)").matches;
const snd = n => window.SFX && window.SFX.play(n);

/* ---------- écran ---------- */
let W = 0, H = 0, TS = 40, OX = 0, OY = 0;
function fit() {
  const d = devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0);
  const top = 112, portrait = H > W, bottom = isTouch && portrait ? 190 : 14, side = isTouch && !portrait ? 150 : 12;
  TS = Math.max(12, Math.floor(Math.min((W - side * 2) / COLS, (H - top - bottom) / ROWS)));
  OX = Math.floor((W - TS * COLS) / 2); OY = top + Math.floor((H - top - bottom - TS * ROWS) / 2);
}
addEventListener("resize", fit); fit();

/* ---------- état de la manche ---------- */
let mode = "menu", grid = [], pups = {}, bombs = [], fires = [], players = [], me = null, round = 0, seed = 0, roundAt = 0, spiral = [], suddenIdx = 0, gone = new Set(), bombN = 0;
let arena = "classique", teams = false, special = {};
let clock = () => Date.now(), wins = {}, phase = "idle", overAt = 0, winner = "", feed = [], kills = 0, matchOver = false;
const L = window.LOBBY, X = L && L.ctx;
function buildSpiral() {
  const out = []; let x0 = 1, y0 = 1, x1 = COLS - 2, y1 = ROWS - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]); for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]); if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++; y0++; x1--; y1--;
  }
  return out.filter(([x, y]) => !(x % 2 === 0 && y % 2 === 0));
}
function newRound(sd, roster, at) {
  seed = sd; const r = rng(sd); grid = []; special = {};
  const safe = new Set(); SPAWNS.forEach(([x, y]) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => safe.add(K(x + a, y + b))));
  if (arena === "usine") for (const [y, d] of BELTS) for (let x = 1; x < COLS - 1; x++) { special[K(x, y)] = { t: "belt", d }; safe.add(K(x, y)); }
  if (arena === "portails") for (const [a, b] of PORTALS) { special[K(a[0], a[1])] = { t: "portal", to: b }; special[K(b[0], b[1])] = { t: "portal", to: a }; safe.add(K(a[0], a[1])); safe.add(K(b[0], b[1])); }
  for (let y = 0; y < ROWS; y++) { const row = []; for (let x = 0; x < COLS; x++) { const v = r(); row.push(x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1 || (x % 2 === 0 && y % 2 === 0) ? 1 : safe.has(K(x, y)) ? 0 : v < 0.72 ? 2 : 0); } grid.push(row); }
  pups = {}; bombs = []; fires = []; scorch = []; debris = []; gone = new Set(); suddenIdx = 0; spiral = buildSpiral(); roundAt = at; bombN = 0;
  players = roster.map((p, i) => Object.assign({ x: SPAWNS[i][0], y: SPAWNS[i][1], rx: SPAWNS[i][0], ry: SPAWNS[i][1], vx: 0, vy: 0, alive: true, maxB: 1, range: 2, speed: 3.4, dir: 0, walk: 0, deadAt: 0, kick: false, remote: false, shield: false, inv: 0, pcd: 0, ai: { t: 0, path: null } }, p, { team: teams ? TEAM_OF(i) : null, color: teams ? TEAMC[TEAM_OF(i)][i < 2 ? 0 : 1] : COLORS[i] }));
  me = players.find(p => p.local) || null; const db = document.getElementById("detbtn"); if (db) db.hidden = true;
}

/* ---------- règles du jeu ---------- */
const tile = (x, y) => (grid[y] && grid[y][x] !== undefined ? grid[y][x] : 1);
const bombAt = (x, y) => bombs.find(b => b.x === x && b.y === y);
const R0 = 0.4;
function overlapsTile(px, py, tx, ty) { return px + R0 > tx - 0.5 && px - R0 < tx + 0.5 && py + R0 > ty - 0.5 && py - R0 < ty + 0.5; }
function blocked(p, nx, ny) {
  for (let ty = Math.floor(ny - R0 + 0.5); ty <= Math.floor(ny + R0 + 0.5); ty++) for (let tx = Math.floor(nx - R0 + 0.5); tx <= Math.floor(nx + R0 + 0.5); tx++) {
    if (!overlapsTile(nx, ny, tx, ty)) continue;
    if (tile(tx, ty)) return true;
    if (bombAt(tx, ty) && !overlapsTile(p.x, p.y, tx, ty)) return true;
  }
  return false;
}
function freeFor(p, tx, ty) { return !tile(tx, ty) && (!bombAt(tx, ty) || overlapsTile(p.x, p.y, tx, ty)); }
function kickCheck(p, dx, dy) {
  if (!p.kick) return;
  const tx = Math.round(p.x) + dx, ty = Math.round(p.y) + dy, b = bombAt(tx, ty);
  if (!b || b.slide || overlapsTile(p.x, p.y, tx, ty)) return;
  const near = dx ? Math.abs(p.x - Math.round(p.x)) < 0.12 && Math.abs(p.y - ty) < 0.3 : Math.abs(p.y - Math.round(p.y)) < 0.12 && Math.abs(p.x - tx) < 0.3;
  if (!near) return;
  b.slide = { dx, dy, acc: 0, mine: !!p.local }; snd("fork");
  if (mode === "mp" && p.local) X.ev({ type: "kick", id: b.id, x: b.x, y: b.y, dx, dy, round });
}
function step(p, dx, dy, dist) {
  kickCheck(p, dx, dy);
  if (dx) {
    const nx = p.x + dx * dist;
    if (!blocked(p, nx, p.y)) p.x = nx;
    else { const cy = Math.round(p.y), off = cy - p.y; if (Math.abs(off) > 0.01 && freeFor(p, Math.round(p.x) + dx, cy)) p.y += Math.sign(off) * Math.min(Math.abs(off), dist); }
  } else if (dy) {
    const ny = p.y + dy * dist;
    if (!blocked(p, p.x, ny)) p.y = ny;
    else { const cx = Math.round(p.x), off = cx - p.x; if (Math.abs(off) > 0.01 && freeFor(p, cx, Math.round(p.y) + dy)) p.x += Math.sign(off) * Math.min(Math.abs(off), dist); }
  }
}
function move(p, dx, dy, dt) {
  if (arena === "glace" && !p.bot) return slide(p, dx, dy, dt);
  if (!dx && !dy) return;
  // une seule direction à la fois, la plus marquée
  if (Math.abs(dx) >= Math.abs(dy)) { dy = 0; dx = Math.sign(dx); } else { dx = 0; dy = Math.sign(dy); }
  p.dir = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 0 : 2;
  let left = p.speed * dt; while (left > 0) { const s = Math.min(0.1, left); step(p, dx, dy, s); left -= s; }
  p.walk += dt * p.speed * 3;
}
// patinoire : on accélère et on glisse
function slide(p, dx, dy, dt) {
  if (dx || dy) { if (Math.abs(dx) >= Math.abs(dy)) { dy = 0; dx = Math.sign(dx); } else { dx = 0; dy = Math.sign(dy); } p.dir = dx > 0 ? 1 : dx < 0 ? 3 : dy > 0 ? 0 : 2; p.walk += dt * p.speed * 2; }
  p.vx += dx * p.speed * 2.6 * dt; p.vy += dy * p.speed * 2.6 * dt;
  const f = Math.max(0, 1 - (dx || dy ? 0.6 : 1.1) * dt); p.vx *= f; p.vy *= f;
  const v = Math.hypot(p.vx, p.vy), mx = p.speed * 1.1; if (v > mx) { p.vx *= mx / v; p.vy *= mx / v; }
  for (const [ax, vv] of [["x", p.vx], ["y", p.vy]]) {
    if (Math.abs(vv) < 0.01) continue; const d = Math.sign(vv); let left = Math.abs(vv) * dt; const before = p[ax];
    while (left > 0) { const st = Math.min(0.1, left); ax === "x" ? step(p, d, 0, st) : step(p, 0, d, st); left -= st; }
    if (Math.abs(p[ax] - before) < Math.abs(vv) * dt * 0.3) { if (ax === "x") p.vx = 0; else p.vy = 0; }
  }
}
function terrain(p, dt) {
  p.inv = Math.max(0, p.inv - dt);
  const k = K(Math.round(p.x), Math.round(p.y)), sp = special[k];
  if (sp && sp.t === "belt" && p.alive) step(p, sp.d, 0, 2.2 * dt);
  if (sp && sp.t === "portal") {
    if (p.pcd <= 0 && Math.hypot(p.x - Math.round(p.x), p.y - Math.round(p.y)) < 0.3) { p.x = sp.to[0]; p.y = sp.to[1]; p.vx = p.vy = 0; p.pcd = 1; if (p.local) snd("dash"); }
  } else p.pcd = 0;
}
function placeBomb(p) {
  if (!p.alive || phase !== "play" || clock() < roundAt) return false;
  const x = Math.round(p.x), y = Math.round(p.y);
  if (tile(x, y) || bombAt(x, y) || bombs.filter(b => b.owner === p.id).length >= p.maxB) return false;
  const rem = p.remote && p.local, b = { id: `${p.id}-${round}-${++bombN}`, x, y, r: p.range, at: Math.round(clock() + (rem ? 15000 - FUSE : 0)), owner: p.id, remote: rem };
  bombs.push(b); if (p.local) snd("bomb"); if (mode === "mp" && p.local) X.ev({ type: "bomb", id: b.id, x, y, r: b.r, at: b.at, round, rem: rem ? 1 : 0 });
  return true;
}
function dropFrom(x, y, until) {
  const idx = y * COLS + x; if (hash(seed, idx) < 0.36) pups[K(x, y)] = { t: puType(hash(seed + 1, idx)), safe: until };
}
// bombe télécommandée : on fait tout sauter d'un coup
function detonate(p) {
  if (!p || !p.alive) return;
  const mine = bombs.filter(b => b.owner === p.id && b.remote); if (!mine.length) return;
  const at = Math.round(clock() - FUSE); for (const b of mine) { b.at = at; b.remote = false; }
  if (mode === "mp" && p.local) X.ev({ type: "det", ids: mine.map(b => b.id), at, round });
}
function explode(b, t) {
  bombs.splice(bombs.indexOf(b), 1); gone.add(b.id); if (clock() - t < 500) snd("boom");
  const fresh = clock() - t < 500;
  const add = (x, y) => { fires.push({ x, y, until: t + FIRE, owner: b.owner, c: x === b.x && y === b.y }); if (fresh) scorch.push({ x, y, t }); };
  if (fresh) { shakeB = Math.min(1, shakeB + 0.45); flashes.push({ x: b.x, y: b.y, life: 0.18 }); if (scorch.length > 120) scorch.splice(0, scorch.length - 120); }
  add(b.x, b.y);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 1; i <= b.r; i++) {
    const x = b.x + dx * i, y = b.y + dy * i, v = tile(x, y);
    if (v === 1) break;
    if (v === 2) { grid[y][x] = 0; add(x, y); dropFrom(x, y, t + FIRE); if (fresh) for (let k = 0; k < 7; k++) debris.push({ x: x + 0.5, y: y + 0.5, z: 0.2, vx: (Math.random() - 0.5) * 5 + dx * 2, vy: (Math.random() - 0.5) * 5 + dy * 2, vz: 2 + Math.random() * 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 18, life: 0.9, c: Math.random() < 0.5 ? "#b45309" : "#78350f" }); break; }
    const ob = bombAt(x, y); if (ob) { ob.at = Math.min(ob.at, t - FUSE); add(x, y); break; }
    const pu = pups[K(x, y)]; if (pu && !(pu.safe > t)) { delete pups[K(x, y)]; add(x, y); break; }
    add(x, y);
  }
}
function processWorld(dt) {
  const T = clock();
  for (const b of bombs) if (b.slide) {
    b.slide.acc += 9 * (dt || 0.016);
    while (b.slide.acc >= 1) {
      const nx = b.x + b.slide.dx, ny = b.y + b.slide.dy;
      if (tile(nx, ny) || bombAt(nx, ny) || players.some(q => q.alive && Math.round(q.x) === nx && Math.round(q.y) === ny) || pups[K(nx, ny)]) {
        if (mode === "mp" && b.slide.mine) X.ev({ type: "kstop", id: b.id, x: b.x, y: b.y, round });
        b.slide = null; break;
      }
      b.x = nx; b.y = ny; b.slide.acc -= 1;
    }
  }
  for (;;) {
    let nb = null; for (const b of bombs) if (b.at + FUSE <= T && (!nb || b.at < nb.at || (b.at === nb.at && b.id < nb.id))) nb = b;
    if (!nb) break; explode(nb, nb.at + FUSE);
  }
  fires = fires.filter(f => f.until > T);
  // mort subite : les murs se referment
  const el = T - roundAt;
  if (phase === "play" && el > SUDDEN) {
    const idx = Math.min(spiral.length, Math.floor((el - SUDDEN) / 320));
    while (suddenIdx < idx) {
      const [x, y] = spiral[suddenIdx++]; grid[y][x] = 1; delete pups[K(x, y)];
      const b = bombAt(x, y); if (b) { bombs.splice(bombs.indexOf(b), 1); gone.add(b.id); }
      for (const p of players) if ((p.local || p.bot) && p.alive && Math.round(p.x) === x && Math.round(p.y) === y) die(p, "");
    }
  }
}
function die(p, by) {
  if (!p.alive) return; p.alive = false; p.deadAt = clock(); if (p.local) snd("die");
  const kn = (players.find(q => q.id === by) || {}).name;
  pushFeed(by && by !== p.id ? `<b style="color:${colorOf(by)}">${esc(kn)}</b> a eu <b style="color:${p.color}">${esc(p.name)}</b>` : `<b style="color:${p.color}">${esc(p.name)}</b> s'est fait avoir`);
  const kq = players.find(q => q.id === by), friendly = teams && kq && kq.team === p.team;
  if (by && by !== p.id && me && by === me.id && !friendly) { kills++; if (mode === "mp") X.setScore({ kills }); }
  if (mode === "mp" && p.local) { X.ev({ type: "die", by: by || "", round }); writeLive(true); }
}
const colorOf = id => (players.find(p => p.id === id) || {}).color || "#fff";
function pushFeed(html) { feed.unshift({ html, t: 4 }); feed = feed.slice(0, 4); }
function checkLocal(p) {
  if (!p.alive) return;
  const tx = Math.round(p.x), ty = Math.round(p.y);
  const f = fires.find(f => f.x === tx && f.y === ty);
  if (f && p.inv <= 0) { if (p.shield) { p.shield = false; p.inv = 1.2; if (p.local) { flash("Bouclier détruit !"); snd("wall"); } } else { die(p, f.owner); return; } }
  const pu = pups[K(tx, ty)];
  if (pu && !(pu.safe > clock())) {
    if (pu.t === "bomb") p.maxB = Math.min(8, p.maxB + 1); else if (pu.t === "fire") p.range = Math.min(10, p.range + 1); else if (pu.t === "speed") p.speed = Math.min(6, p.speed + 0.5);
    else if (pu.t === "kick") p.kick = true; else if (pu.t === "remote") p.remote = true; else if (pu.t === "shield") p.shield = true;
    delete pups[K(tx, ty)];
    if (p.local) { snd("pickup"); flash({ bomb: "+1 bombe", fire: "+1 portée", speed: "+ vitesse", kick: "Coup de pied : pousse les bombes !", remote: "Télécommande : R pour faire tout sauter", shield: "Bouclier : protège d'une explosion" }[pu.t]); if (pu.t === "remote") $("#detbtn").hidden = false; if (mode === "mp") X.ev({ type: "pick", x: tx, y: ty, round }); }
  }
}

/* ---------- robots (mode solo) ---------- */
function flameTiles(b) {
  const out = [[b.x, b.y]];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 1; i <= b.r; i++) { const x = b.x + dx * i, y = b.y + dy * i, v = tile(x, y); if (v === 1) break; out.push([x, y]); if (v === 2 || bombAt(x, y)) break; }
  return out;
}
function dangerMap(extra) {
  const D = new Set(); for (const f of fires) D.add(K(f.x, f.y));
  for (const b of extra ? bombs.concat([extra]) : bombs) for (const [x, y] of flameTiles(b)) D.add(K(x, y));
  return D;
}
function bfs(p, sx, sy, ok, goal, maxD) {
  const seen = new Set([K(sx, sy)]), q = [[sx, sy, null, 0]];
  while (q.length) {
    const [x, y, first, d] = q.shift();
    if (d > 0 && goal(x, y)) return { first, x, y, d };
    if (d >= maxD) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = K(nx, ny); if (seen.has(k) || tile(nx, ny) || bombAt(nx, ny) || !ok(nx, ny)) continue;
      seen.add(k); q.push([nx, ny, first || [nx, ny], d + 1]);
    }
  }
  return null;
}
function botThink(p) {
  const cx = Math.round(p.x), cy = Math.round(p.y), D = dangerMap(), fireNow = new Set(fires.map(f => K(f.x, f.y))), enemies = players.filter(q => q.alive && q !== p && !(teams && q.team === p.team));
  const live = (x, y) => !fireNow.has(K(x, y));
  if (D.has(K(cx, cy))) { const r = bfs(p, cx, cy, live, (x, y) => !D.has(K(x, y)), 10); p.ai.path = r && r.first; return; }
  const near = enemies.some(q => { const qx = Math.round(q.x), qy = Math.round(q.y); return (qx === cx && Math.abs(qy - cy) <= p.range) || (qy === cy && Math.abs(qx - cx) <= p.range); });
  const crate = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tile(cx + a, cy + b) === 2);
  const mine = bombs.filter(b => b.owner === p.id).length;
  if ((near || crate) && mine < p.maxB && Math.random() < (near ? 0.85 : 0.6)) {
    const D2 = dangerMap({ x: cx, y: cy, r: p.range, owner: p.id, at: clock() });
    const esc2 = bfs(p, cx, cy, live, (x, y) => !D2.has(K(x, y)), 7);
    if (esc2 && placeBomb(p)) { p.ai.path = esc2.first; p.ai.t = 0.35; return; }
  }
  const safe = (x, y) => live(x, y) && !D.has(K(x, y));
  let r = bfs(p, cx, cy, safe, (x, y) => !!pups[K(x, y)], 8)
    || bfs(p, cx, cy, safe, (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => tile(x + a, y + b) === 2), 12)
    || bfs(p, cx, cy, safe, (x, y) => enemies.some(q => Math.abs(Math.round(q.x) - x) + Math.abs(Math.round(q.y) - y) <= 1), 30);
  if (!r && Math.random() < 0.5) { const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [cx + a, cy + b]).filter(([x, y]) => !tile(x, y) && !bombAt(x, y) && safe(x, y)); if (opts.length) r = { first: opts[Math.floor(Math.random() * opts.length)] }; }
  p.ai.path = r ? r.first : null;
}
function botUpdate(p, dt) {
  if (!p.alive || clock() < roundAt) return;
  p.ai.t -= dt;
  const cx = Math.round(p.x), cy = Math.round(p.y), centered = Math.abs(p.x - cx) < 0.12 && Math.abs(p.y - cy) < 0.12;
  if ((centered && (!p.ai.path || (p.ai.path[0] === cx && p.ai.path[1] === cy))) || p.ai.t <= 0) { if (p.ai.t <= 0 || centered) { botThink(p); p.ai.t = 0.25 + Math.random() * 0.2; } }
  const t = p.ai.path; if (!t) return;
  if (t[0] === cx && t[1] === cy && centered) { p.ai.path = null; return; }
  const dx = t[0] - p.x, dy = t[1] - p.y;
  // s'aligner sur l'axe perpendiculaire avant de tourner
  if (t[0] !== cx && Math.abs(p.y - cy) > 0.05) move(p, 0, Math.sign(cy - p.y), dt * 0.6);
  else if (t[1] !== cy && Math.abs(p.x - cx) > 0.05) move(p, Math.sign(cx - p.x), 0, dt * 0.6);
  else if (Math.abs(dx) > Math.abs(dy)) move(p, Math.sign(dx), 0, dt); else move(p, 0, Math.sign(dy), dt);
}

/* ---------- commandes ---------- */
const keys = new Set(), mv = { x: 0, y: 0 };
addEventListener("keydown", e => { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault(); keys.add(e.code); if ((e.code === "Space" || e.code === "Enter" || e.code === "KeyE") && me && mode !== "menu") placeBomb(me); if ((e.code === "KeyR" || e.code === "ShiftLeft" || e.code === "ShiftRight") && me && mode !== "menu") detonate(me); });
addEventListener("keyup", e => keys.delete(e.code));
const stick = $("#stick"), knob = $("#knob"); let sid = null, sc = null;
stick.addEventListener("pointerdown", e => { e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); sc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; smove(e); });
stick.addEventListener("pointermove", e => { if (e.pointerId === sid) smove(e); });
const send = e => { if (e.pointerId !== sid) return; sid = null; mv.x = mv.y = 0; knob.style.transform = ""; };
stick.addEventListener("pointerup", send); stick.addEventListener("pointercancel", send);
function smove(e) { let dx = e.clientX - sc.x, dy = e.clientY - sc.y; const d = Math.hypot(dx, dy), m = Math.min(d, 46); if (d > 0) { dx = dx / d * m; dy = dy / d * m; } knob.style.transform = `translate(${dx}px,${dy}px)`; mv.x = Math.abs(dx) > 12 ? dx / 46 : 0; mv.y = Math.abs(dy) > 12 ? dy / 46 : 0; }
$("#bombbtn").addEventListener("pointerdown", e => { e.preventDefault(); if (me) placeBomb(me); });
$("#detbtn").addEventListener("pointerdown", e => { e.preventDefault(); if (me) detonate(me); });

/* ---------- réseau ---------- */
let liveT = 0;
function writeLive(force) { if (mode !== "mp" || !me) return; X.setLive({ x: +me.x.toFixed(2), y: +me.y.toFixed(2), a: me.alive, d: me.dir, r: round, b: me.maxB, f: me.range }); }
function syncRemote(dt) {
  for (const p of players) {
    if (p.local) continue; const l = X.live[p.id];
    if (!l || l.r !== round) continue;
    const k = Math.min(1, dt * 14), ox = p.x, oy = p.y; p.x += (l.x - p.x) * k; p.y += (l.y - p.y) * k; p.dir = l.d; if (Math.hypot(p.x - ox, p.y - oy) > 0.002) p.walk += dt * 10;
  }
}
function onState(ctx) {
  const st = ctx.state; if (mode !== "mp" || !st) return;
  wins = st.wins || {}; phase = st.phase; winner = st.winner || ""; overAt = st.overAt || 0;
  if (st.round !== round) {
    round = st.round; arena = ARENAS[st.arena] ? st.arena : "classique"; teams = !!st.teams;
    const roster = (st.roster || []).map(id => ({ id, name: (ctx.players[id] || ctx.score[id] || {}).pseudo || "?", local: id === ctx.uid }));
    newRound(st.seed, roster, st.at); writeLive();
  }
  hudPlayers();
}
function onEvent(e, ctx) {
  if (mode !== "mp" || e.from === ctx.uid || e.round !== round) return;
  if (e.type === "bomb") { if (!gone.has(e.id) && !bombs.find(b => b.id === e.id)) bombs.push({ id: e.id, x: e.x, y: e.y, r: e.r, at: e.at, owner: e.from, remote: !!e.rem }); }
  if (e.type === "kick") { const b = bombs.find(q => q.id === e.id); if (b) { b.x = e.x; b.y = e.y; b.slide = { dx: e.dx, dy: e.dy, acc: 0 }; } }
  if (e.type === "kstop") { const b = bombs.find(q => q.id === e.id); if (b) { b.x = e.x; b.y = e.y; b.slide = null; } }
  if (e.type === "det") for (const id of e.ids || []) { const b = bombs.find(q => q.id === id); if (b) { b.at = e.at; b.remote = false; } }
  if (e.type === "pick") delete pups[K(e.x, e.y)];
  if (e.type === "die") { const p = players.find(q => q.id === e.from); if (p) die(p, e.by); }
}
function hostTick() {
  if (!X.isHost()) return;
  const st = X.state; if (!st) return;
  const T = clock();
  if (st.phase === "play") {
    if (T - st.at < 1500) return;
    const alive = st.roster.filter(id => X.players[id] && (id === X.uid ? me && me.alive : X.live[id] && X.live[id].r === st.round ? X.live[id].a : T - st.at < 5000));
    const sides = st.teams ? [...new Set(alive.map(id => TEAM_OF(st.roster.indexOf(id))))] : alive;
    if (sides.length <= 1) { const w = sides[0] || ""; const nw = Object.assign({}, st.wins || {}); if (w) nw[w] = (nw[w] || 0) + 1; X.updState({ phase: "over", winner: w, wins: nw, overAt: Math.round(T) }); }
  } else if (st.phase === "over" && T - st.overAt > 3200) {
    const top = Object.entries(st.wins || {}).find(([, n]) => n >= WIN);
    const roster = st.roster.filter(id => X.players[id]);
    if (st.teams && (top || roster.length < 4)) { const wt = top ? top[0] : ""; X.end({ winner: wt ? st.roster.find(id => TEAM_OF(st.roster.indexOf(id)) === wt) || "" : "", wteam: wt, teams: true }); }
    else if (!st.teams && (top || roster.length < 2)) X.end({ winner: top ? top[0] : (roster[0] || "") });
    else X.setState({ round: st.round + 1, seed: Math.floor(Math.random() * 1e9), at: Math.round(T + 2500), phase: "play", wins: st.wins || {}, roster: st.teams ? st.roster : roster, winner: "", arena: st.arena, teams: !!st.teams });
  }
}

/* ---------- mode solo contre les robots ---------- */
let soloArena = "classique", soloTeams = false;
function soloStart() {
  mode = "solo"; clock = () => Date.now(); wins = {}; kills = 0; matchOver = false; feed = []; arena = soloArena; teams = soloTeams; $("#detbtn").hidden = true;
  const name = (window.ONLINE && window.ONLINE.profile && window.ONLINE.profile.pseudo) || "Toi";
  soloRoster = [{ id: "me", name, local: true }].concat(BOTN.map((n, i) => ({ id: "bot" + i, name: n, bot: true })));
  round = 1; phase = "play"; newRound(Math.floor(Math.random() * 1e9), soloRoster, clock() + 2500); hideMenu(); hudPlayers();
}
let soloRoster = [], mpTeams = false;
function soloTick() {
  const T = clock();
  if (phase === "play" && T - roundAt > 1500) {
    const alive = players.filter(p => p.alive);
    if (teams) {
      const sides = [...new Set(alive.map(p => p.team))];
      if (sides.length <= 1) { const w = sides[0] || ""; if (w) wins[w] = (wins[w] || 0) + 1; winner = w; phase = "over"; overAt = T; hudPlayers(); }
    } else if (alive.length <= 1 || (me && !me.alive && T - me.deadAt > 1800)) {
      const w = alive.length === 1 ? alive[0].id : (me && !me.alive ? (alive.sort((a, b) => a.id < b.id ? -1 : 1)[0] || {}).id : "") || "";
      if (w) wins[w] = (wins[w] || 0) + 1; winner = w; phase = "over"; overAt = T; hudPlayers();
    }
  } else if (phase === "over" && T - overAt > 3000 && !matchOver) {
    const top = Object.entries(wins).find(([, n]) => n >= WIN);
    if (top) { matchOver = true; soloEnd(top[0] === (teams ? "A" : "me")); }
    else { round++; phase = "play"; winner = ""; newRound(Math.floor(Math.random() * 1e9), soloRoster, T + 2500); hudPlayers(); }
  }
}
function soloEnd(won) {
  if (window.ONLINE) window.ONLINE.submit("blast", gm => Object.assign(gm, { botWins: (gm.botWins || 0) + (won ? 1 : 0), botGames: (gm.botGames || 0) + 1, kills: (gm.kills || 0) + kills }, teams ? { teamGames: (gm.teamGames || 0) + 1, teamWins: (gm.teamWins || 0) + (won ? 1 : 0) } : {}));
  if (teams) { showMenu(`<h1 style="color:${won ? "#4ade80" : "#fca5a5"}">${won ? "Ton équipe gagne !" : "L'équipe bleue gagne"}</h1><p>Équipe jaune ${wins.A || 0} – ${wins.B || 0} équipe bleue · ${kills} robot${kills > 1 ? "s" : ""} piégé${kills > 1 ? "s" : ""}</p><button class="btn" id="again">Rejouer</button><br><button class="ghost" id="tomenu">Menu</button>`); $("#again").onclick = soloStart; $("#tomenu").onclick = () => { mode = "menu"; showMenu(MENU); bindMenu(); }; return; }
  showMenu(`<h1 style="color:${won ? "#4ade80" : "#fca5a5"}">${won ? "Victoire !" : "Les robots gagnent"}</h1><p>${wins.me || 0} manche${(wins.me || 0) > 1 ? "s" : ""} gagnée${(wins.me || 0) > 1 ? "s" : ""} · ${kills} robot${kills > 1 ? "s" : ""} piégé${kills > 1 ? "s" : ""}</p><button class="btn" id="again">Rejouer</button><button class="ghost" id="tomenu">Menu</button>`);
  $("#again").onclick = soloStart; $("#tomenu").onclick = () => { mode = "menu"; showMenu(MENU); bindMenu(); };
}

/* ---------- multijoueur ---------- */
if (L) L.init({
  id: "blast", title: "Blast", min: 2, max: 4, modes: ARENAS,
  lobbyExtra: ctx => `<label class="lb-small" style="display:flex;gap:8px;align-items:center;justify-content:center;margin:8px 0;font-size:15px"><input type="checkbox" id="bteams" ${mpTeams ? "checked" : ""} ${ctx.isHost() ? "" : "disabled"} style="width:20px;height:20px"> Équipes en 2 contre 2 ${ctx.isHost() ? "" : "(l'hôte choisit)"}</label><p class="lb-small">${mpTeams ? "Il faut 4 joueurs. Le 1er et le 4e arrivés contre le 2e et le 3e." : ""}</p>`,
  lobbyBind: ctx => { const c = $("#bteams"); if (c) c.onchange = () => { mpTeams = c.checked; c.closest("label").nextElementSibling.textContent = mpTeams ? "Il faut 4 joueurs. Le 1er et le 4e arrivés contre le 2e et le 3e." : ""; }; },
  initState: (ctx, sd) => ({ arena: ARENAS[ctx.meta.mode] ? ctx.meta.mode : "classique", teams: mpTeams && Object.keys(ctx.players).length === 4, round: 1, seed: sd, at: Math.round(ctx.now() + 2500), phase: "play", wins: {}, winner: "", roster: Object.entries(ctx.players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)).slice(0, 4).map(x => x[0]) }),
  onStart(ctx) { mode = "mp"; clock = ctx.now; round = 0; kills = 0; feed = []; wins = {}; hideMenu(); ctx.setScore({ kills: 0 }); if (ctx.state) onState(ctx); },
  onState, onEvent,
  onEnd(ctx) {
    const myI = ((ctx.state && ctx.state.roster) || []).indexOf(ctx.uid), won = ctx.meta.teams ? myI >= 0 && TEAM_OF(myI) === ctx.meta.wteam : ctx.meta.winner === ctx.uid;
    if (window.ONLINE) window.ONLINE.submit("blast", gm => Object.assign(gm, { wins: (gm.wins || 0) + (won ? 1 : 0), kills: (gm.kills || 0) + kills, games: (gm.games || 0) + 1 }));
    mode = "menu"; players = []; me = null;
  },
  onStop() { mode = "menu"; players = []; me = null; },
  results(ctx) {
    const w = (ctx.state && ctx.state.wins) || {}, roster = (ctx.state && ctx.state.roster) || Object.keys(ctx.score);
    if (ctx.meta.teams) {
      const nm = id => esc((ctx.score[id] || ctx.players[id] || {}).pseudo || "?"), side = t => roster.filter((id, i) => TEAM_OF(i) === t), myT = TEAM_OF(roster.indexOf(ctx.uid));
      return `<h1 style="color:${ctx.meta.wteam === myT ? "#4ade80" : "#f5f3ff"}">${ctx.meta.wteam ? `L'équipe ${ctx.meta.wteam === "A" ? "jaune" : "bleue"} gagne !` : "Fin de partie"}</h1><table><tr><th>Équipe</th><th>Joueurs</th><th class="n">Manches</th></tr>${["A", "B"].map(t => `<tr><td style="color:${TEAMC[t][0]}">${t === "A" ? "Jaune" : "Bleue"}</td><td>${side(t).map(nm).join(" + ")}</td><td class="n">${w[t] || 0}</td></tr>`).join("")}</table>`;
    }
    const rows = roster.map(id => ({ id, name: (ctx.score[id] || ctx.players[id] || {}).pseudo || "?", w: w[id] || 0, k: (ctx.score[id] || {}).kills || 0 })).sort((a, b) => b.w - a.w || b.k - a.k);
    const wn = (ctx.score[ctx.meta.winner] || ctx.players[ctx.meta.winner] || {}).pseudo;
    return `<h1 style="color:${ctx.meta.winner === ctx.uid ? "#4ade80" : "#f5f3ff"}">${wn ? esc(wn) + " gagne !" : "Fin de partie"}</h1><table><tr><th>Joueur</th><th class="n">Manches</th><th class="n">Pièges</th></tr>${rows.map(r => `<tr style="${r.id === ctx.uid ? "color:#facc15" : ""}"><td>${esc(r.name)}</td><td class="n">${r.w}</td><td class="n">${r.k}</td></tr>`).join("")}</table>`;
  },
  onBack() { showMenu(MENU); bindMenu(); }
});

/* ---------- interface ---------- */
const MENU = $("#panel").innerHTML;
function showMenu(html) { $("#panel").hidden = false; $("#panel").innerHTML = html; }
function hideMenu() { $("#panel").hidden = true; }
function bindMenu() {
  const ar = $("#arenas"); if (ar) { ar.innerHTML = Object.entries(ARENAS).map(([k, a]) => `<button class="arn" data-a="${k}" aria-pressed="${k === soloArena}"><b>${a.name}</b><span>${a.desc}</span></button>`).join(""); ar.querySelectorAll(".arn").forEach(b => b.onclick = () => { soloArena = b.dataset.a; ar.querySelectorAll(".arn").forEach(x => x.setAttribute("aria-pressed", x === b)); }); }
  $("#solo").onclick = () => { soloTeams = false; soloStart(); }; $("#solo2").onclick = () => { soloTeams = true; soloStart(); }; $("#multi").onclick = () => { hideMenu(); L.menu(); }; }
bindMenu();
let fl = 0; function flash(s) { $("#banner").textContent = s; fl = 1.2; }
function hudPlayers() {
  if (teams) { $("#players").innerHTML = ["A", "B"].map(t => `<span class="chip" style="border-color:${TEAMC[t][0]}"><i style="background:${TEAMC[t][0]}"></i>${players.filter(p => p.team === t).map(p => `<span class="${p.alive ? "" : "dead"}">${esc(p.local ? "Toi" : p.name)}</span>`).join(" + ")}<b>${"●".repeat(wins[t] || 0)}${"○".repeat(Math.max(0, WIN - (wins[t] || 0)))}</b></span>`).join(""); return; }
  $("#players").innerHTML = players.map(p => `<span class="chip${p.alive ? "" : " dead"}"><i style="background:${p.color}"></i>${esc(p.name)}<b>${"●".repeat(wins[p.id] || 0)}${"○".repeat(Math.max(0, WIN - (wins[p.id] || 0)))}</b></span>`).join("");
}

/* ---------- dessin ---------- */
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
let scorch = [], debris = [], shakeB = 0, flashes = [];
function drawGear(x, y, r, a, c) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = c; for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.fillRect(-r * 0.13, -r - r * 0.16, r * 0.26, r * 0.32); } g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.fillStyle = "#0a0716"; g.beginPath(); g.arc(0, 0, r * 0.35, 0, 7); g.fill(); g.restore(); }
function floorTile(x, y, T) {
  const px = OX + x * TS, py = OY + y * TS;
  if (arena === "glace") { g.fillStyle = (x + y) % 2 ? "#123047" : "#0f2a3f"; g.fillRect(px, py, TS, TS); g.strokeStyle = "#7dd3fc33"; g.lineWidth = 1; g.beginPath(); g.moveTo(px + TS * 0.2, py + TS * 0.75); g.lineTo(px + TS * 0.55, py + TS * 0.4); g.moveTo(px + TS * 0.5, py + TS * 0.85); g.lineTo(px + TS * 0.8, py + TS * 0.55); g.stroke(); }
  else if (arena === "usine") { g.fillStyle = (x + y) % 2 ? "#1c1a24" : "#18161f"; g.fillRect(px, py, TS, TS); }
  else { g.fillStyle = (x + y) % 2 ? "#1a1235" : "#160f2e"; g.fillRect(px, py, TS, TS); }
  const sp = special[K(x, y)];
  if (sp && sp.t === "belt") {
    g.fillStyle = "#27272a"; g.fillRect(px, py + TS * 0.08, TS, TS * 0.84); g.fillStyle = "#facc15"; g.fillRect(px, py + TS * 0.08, TS, TS * 0.06); g.fillRect(px, py + TS * 0.86, TS, TS * 0.06);
    const off = ((T / 1000 * 2.2 * sp.d) % 1 + 1) % 1; g.strokeStyle = "#52525b"; g.lineWidth = Math.max(2, TS * 0.08);
    for (let i = -1; i < 2; i++) { const ax = px + ((i + off) * TS * 0.5 + TS) % TS; g.beginPath(); g.moveTo(ax - sp.d * TS * 0.12, py + TS * 0.3); g.lineTo(ax + sp.d * TS * 0.08, py + TS * 0.5); g.lineTo(ax - sp.d * TS * 0.12, py + TS * 0.7); g.stroke(); }
  } else if (sp && sp.t === "portal") {
    const pc = sp.to[0] > x ? "#22d3ee" : "#e879f9", cx = px + TS / 2, cy = py + TS / 2;
    g.save(); g.shadowColor = pc; g.shadowBlur = 14; g.strokeStyle = pc; g.lineWidth = Math.max(2, TS * 0.08);
    for (let i = 0; i < 3; i++) { const a0 = T / 300 + i * 2.1; g.beginPath(); g.arc(cx, cy, TS * (0.18 + i * 0.09), a0, a0 + 3.6); g.stroke(); }
    g.restore(); g.fillStyle = pc + "66"; g.beginPath(); g.arc(cx, cy, TS * 0.44, 0, 7); g.fill(); g.fillStyle = "#0a0716"; g.beginPath(); g.arc(cx, cy, TS * 0.14, 0, 7); g.fill();
  }
}
// bloc en relief : face avant + dessus remonté
function blockTile(x, y, v) {
  const px = OX + x * TS, py = OY + y * TS, D = Math.round(TS * 0.24);
  let top, side, line;
  if (v === 2) { top = "#d97706"; side = "#92400e"; }
  else { const outer = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1, closing = !outer && !(x % 2 === 0 && y % 2 === 0); top = closing ? "#b91c1c" : outer ? "#3b2d6b" : "#6d28d9"; side = closing ? "#7f1d1d" : outer ? "#221a44" : "#3b0f7a"; line = closing ? "#fca5a5" : outer ? "#5b4a9b" : "#c084fc"; if (arena === "glace" && !closing) { top = outer ? "#1e3a5f" : "#38bdf8"; side = outer ? "#0f2740" : "#0369a1"; line = "#e0f2fe"; } }
  g.fillStyle = "#00000055"; g.fillRect(px + TS * 0.14, py + TS * 0.14, TS, TS);
  g.fillStyle = side; g.fillRect(px, py + TS - D, TS, D);
  const ty = py - D;
  g.fillStyle = top; g.fillRect(px, ty, TS, TS);
  if (v === 2) {
    g.strokeStyle = "#78350f"; g.lineWidth = Math.max(1.5, TS * 0.06); g.strokeRect(px + 3, ty + 3, TS - 6, TS - 6); g.beginPath(); g.moveTo(px + 4, ty + 4); g.lineTo(px + TS - 4, ty + TS - 4); g.moveTo(px + TS - 4, ty + 4); g.lineTo(px + 4, ty + TS - 4); g.stroke();
    g.fillStyle = "#fbbf2440"; g.fillRect(px + 4, ty + 4, TS - 8, TS * 0.1);
  } else {
    g.strokeStyle = line; g.lineWidth = 1.5; g.strokeRect(px + TS * 0.1, ty + TS * 0.1, TS * 0.8, TS * 0.8);
    g.fillStyle = "#ffffff1f"; g.fillRect(px + TS * 0.12, ty + TS * 0.12, TS * 0.76, TS * 0.1);
    if (arena === "glace" && line === "#e0f2fe") { g.fillStyle = "#ffffffcc"; g.fillRect(px, ty, TS, TS * 0.12); for (let k = 0; k < 3; k++) g.fillRect(px + TS * (0.15 + k * 0.3), ty + TS * 0.12, TS * 0.08, TS * (0.1 + (k % 2) * 0.12)); }
  }
}
function drawBonus(k, pu, T) {
  const [x, y] = k.split(",").map(Number), cx = OX + x * TS + TS / 2, cy = OY + y * TS + TS / 2 - Math.abs(Math.sin(T / 300 + x)) * TS * 0.08, s = TS * (0.36 + Math.sin(T / 200) * 0.03);
  g.fillStyle = "#0006"; g.beginPath(); g.ellipse(cx, OY + y * TS + TS * 0.9, s * 0.8, s * 0.22, 0, 0, 7); g.fill();
  g.fillStyle = { bomb: "#7c3aed", fire: "#ea580c", speed: "#0891b2", kick: "#16a34a", remote: "#dc2626", shield: "#0e7490" }[pu.t]; rr(cx - s, cy - s, s * 2, s * 2, s * 0.4); g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 2; g.stroke();
  g.fillStyle = "#fff";
  if (pu.t === "bomb") { g.beginPath(); g.arc(cx, cy + s * 0.1, s * 0.5, 0, 7); g.fill(); g.fillRect(cx + s * 0.2, cy - s * 0.65, s * 0.18, s * 0.35); }
  else if (pu.t === "fire") { g.beginPath(); g.moveTo(cx, cy - s * 0.75); g.quadraticCurveTo(cx + s * 0.75, cy, cx, cy + s * 0.65); g.quadraticCurveTo(cx - s * 0.75, cy, cx, cy - s * 0.75); g.fill(); }
  else if (pu.t === "kick") { g.fillRect(cx - s * 0.35, cy - s * 0.65, s * 0.4, s * 0.8); rr(cx - s * 0.35, cy + s * 0.05, s * 0.85, s * 0.45, s * 0.15); g.fill(); }
  else if (pu.t === "remote") { rr(cx - s * 0.35, cy - s * 0.3, s * 0.7, s * 0.95, s * 0.12); g.fill(); g.fillRect(cx + s * 0.12, cy - s * 0.8, s * 0.1, s * 0.5); g.fillStyle = "#dc2626"; g.beginPath(); g.arc(cx, cy + s * 0.05, s * 0.18, 0, 7); g.fill(); }
  else if (pu.t === "shield") { g.beginPath(); g.moveTo(cx, cy - s * 0.75); g.lineTo(cx + s * 0.6, cy - s * 0.45); g.quadraticCurveTo(cx + s * 0.55, cy + s * 0.4, cx, cy + s * 0.75); g.quadraticCurveTo(cx - s * 0.55, cy + s * 0.4, cx - s * 0.6, cy - s * 0.45); g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(cx + s * 0.15, cy - s * 0.75); g.lineTo(cx - s * 0.45, cy + s * 0.1); g.lineTo(cx, cy + s * 0.1); g.lineTo(cx - s * 0.15, cy + s * 0.75); g.lineTo(cx + s * 0.45, cy - s * 0.1); g.lineTo(cx, cy - s * 0.1); g.closePath(); g.fill(); }
}
function drawBomb(b, T) {
  const cx = OX + b.x * TS + TS / 2, cy = OY + b.y * TS + TS / 2, left = (b.at + FUSE - T) / FUSE, pulse = 1 + Math.sin(T / (left < 0.35 ? 40 : 110)) * 0.07, r = TS * 0.36 * pulse;
  g.fillStyle = "#0007"; g.beginPath(); g.ellipse(cx, cy + TS * 0.36, r * 0.9, r * 0.28, 0, 0, 7); g.fill();
  g.fillStyle = "#0b0b12"; g.beginPath(); g.arc(cx, cy + TS * 0.04, r, 0, 7); g.fill(); g.strokeStyle = colorOf(b.owner); g.lineWidth = 2.5; g.stroke();
  g.fillStyle = "#ffffff55"; g.beginPath(); g.arc(cx - r * 0.35, cy - r * 0.3, r * 0.22, 0, 7); g.fill();
  if (b.remote) { g.strokeStyle = "#e5e7eb"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx, cy - r * 1.6); g.stroke(); g.save(); if (Math.sin(T / 160) > 0) { g.shadowColor = "#ef4444"; g.shadowBlur = 14; } g.fillStyle = Math.sin(T / 160) > 0 ? "#ef4444" : "#7f1d1d"; g.beginPath(); g.arc(cx, cy - r * 1.65, TS * 0.08, 0, 7); g.fill(); g.restore(); g.fillStyle = "#ef4444"; g.beginPath(); g.arc(cx, cy + TS * 0.04, r * 0.28, 0, 7); g.fill(); }
  else {
    g.strokeStyle = "#a8a29e"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + r * 0.4, cy - r * 0.6); g.quadraticCurveTo(cx + r * 0.9, cy - r * 1.2, cx + r * 0.7, cy - r * 1.3); g.stroke();
    g.save(); g.shadowColor = "#fde047"; g.shadowBlur = 10; g.fillStyle = Math.sin(T / 50) > 0 ? "#fde047" : "#f97316"; g.beginPath(); g.arc(cx + r * 0.7, cy - r * 1.3, TS * 0.08, 0, 7); g.fill(); g.restore();
  }
}
function drawFire(f, T) {
  const a = Math.max(0, (f.until - T) / FIRE), px = OX + f.x * TS, py = OY + f.y * TS, m = TS * 0.1 * (1 - a), w = Math.sin(T / 40 + f.x + f.y) * TS * 0.04;
  g.globalAlpha = Math.min(1, a * 1.6);
  g.save(); g.shadowColor = "#f97316"; g.shadowBlur = TS * 0.6; g.fillStyle = "#ea580c"; rr(px + m - w, py + m - w, TS - 2 * m + 2 * w, TS - 2 * m + 2 * w, TS * 0.25); g.fill(); g.restore();
  g.fillStyle = "#f97316"; rr(px + TS * 0.12, py + TS * 0.12, TS * 0.76, TS * 0.76, TS * 0.22); g.fill();
  g.fillStyle = "#fde047"; rr(px + TS * 0.25, py + TS * 0.25, TS * 0.5, TS * 0.5, TS * 0.15); g.fill();
  if (f.c) { g.fillStyle = "#fff"; g.beginPath(); g.arc(px + TS / 2, py + TS / 2, TS * 0.2 * (0.6 + a * 0.6), 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
function drawPlayer(p, T) {
  const dead = !p.alive, k = dead ? Math.max(0, 1 - (T - p.deadAt) / 900) : 1; if (k <= 0) return;
  const cx = OX + p.x * TS + TS / 2, cy = OY + p.y * TS + TS / 2, s = TS * 0.4, moving = p.alive && Math.abs(Math.sin(p.walk * 7.3)) > 0 && (p.lw !== p.walk), bob = moving ? Math.abs(Math.sin(p.walk)) * TS * 0.06 : 0;
  p.lw = p.walk;
  g.globalAlpha = k; g.fillStyle = "#0006"; g.beginPath(); g.ellipse(cx, cy + s * 0.95, s * 0.8, s * 0.25, 0, 0, 7); g.fill();
  if (p.team && p.alive) { g.strokeStyle = TEAMC[p.team][0]; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy + s * 0.95, s * 0.95, s * 0.32, 0, 0, 7); g.stroke(); }
  // petites jambes
  const st = moving ? Math.sin(p.walk) * s * 0.28 : 0; g.fillStyle = "#1f1f2e";
  rr(cx - s * 0.55, cy + s * 0.6 + Math.max(0, st) * 0.4, s * 0.4, s * 0.38, s * 0.12); g.fill(); rr(cx + s * 0.15, cy + s * 0.6 + Math.max(0, -st) * 0.4, s * 0.4, s * 0.38, s * 0.12); g.fill();
  // bras levés quand on gagne la manche
  const cheer = phase === "over" && p.alive && (winner === p.id || (p.team && winner === p.team));
  g.fillStyle = p.color;
  if (cheer) { const wv = Math.sin(T / 90) * 0.3; for (const sd of [-1, 1]) { g.save(); g.translate(cx + sd * s * 0.9, cy - s * 0.4 - bob); g.rotate(sd * (-2.4 + wv)); g.fillRect(0, -s * 0.13, s * 0.6, s * 0.26); g.restore(); } }
  else { const sw = moving ? Math.sin(p.walk) * 0.5 : 0; for (const sd of [-1, 1]) { g.save(); g.translate(cx + sd * s * 0.95, cy - s * 0.1 - bob); g.rotate(Math.PI / 2 + sd * sw); g.fillRect(0, -s * 0.12, s * 0.5, s * 0.24); g.restore(); } }
  g.fillStyle = p.color; rr(cx - s, cy - s * 1.1 - bob, s * 2, s * 2, s * 0.45); g.fill();
  g.fillStyle = "#ffffff28"; rr(cx - s * 0.85, cy - s * 1.02 - bob, s * 1.7, s * 0.35, s * 0.15); g.fill();
  g.fillStyle = "#fff"; rr(cx - s * 0.7, cy - s * 0.8 - bob, s * 1.4, s * 0.9, s * 0.3); g.fill();
  const ex = [0, 0.25, 0, -0.25][p.dir] * s, ey = [0.12, 0, -0.12, 0][p.dir] * s, hsh = (p.id.charCodeAt(p.id.length - 1) || 0) * 377, blink = ((T + hsh) % 3200) < 130;
  g.fillStyle = "#0a0716";
  if (p.dir !== 2 && !dead) { if (blink) { g.fillRect(cx - s * 0.38 + ex, cy - s * 0.42 - bob + ey, s * 0.2, s * 0.06); g.fillRect(cx + s * 0.18 + ex, cy - s * 0.42 - bob + ey, s * 0.2, s * 0.06); } else { g.fillRect(cx - s * 0.38 + ex, cy - s * 0.55 - bob + ey, s * 0.2, s * 0.32); g.fillRect(cx + s * 0.18 + ex, cy - s * 0.55 - bob + ey, s * 0.2, s * 0.32); } }
  if (p.bot) { g.fillStyle = "#e5e7eb"; g.fillRect(cx - s * 0.06, cy - s * 1.45 - bob, s * 0.12, s * 0.35); g.fillStyle = "#ef4444"; g.beginPath(); g.arc(cx, cy - s * 1.5 - bob, s * 0.13, 0, 7); g.fill(); }
  if (p.alive && (p.shield || p.inv > 0) && (p.inv <= 0 || Math.sin(T / 60) > 0)) { g.save(); g.strokeStyle = "#67e8f9"; g.shadowColor = "#22d3ee"; g.shadowBlur = 12; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy - s * 0.1 - bob, s * 1.35, 0, 7); g.stroke(); g.restore(); }
  if (dead) { g.strokeStyle = "#0a0716"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - s * 0.4, cy - s * 0.6); g.lineTo(cx + s * 0.4, cy - s * 0.1); g.moveTo(cx + s * 0.4, cy - s * 0.6); g.lineTo(cx - s * 0.4, cy - s * 0.1); g.stroke(); }
  if (TS >= 22) { g.font = `700 ${Math.max(10, TS * 0.3)}px Inter, sans-serif`; g.textAlign = "center"; const t = p.local ? "TOI" : p.name.slice(0, 10); const tw = g.measureText(t).width + 8; g.fillStyle = "#0a0716cc"; rr(cx - tw / 2, cy - s * 2.15 - bob, tw, TS * 0.36, 4); g.fill(); g.fillStyle = p.color; g.fillText(t, cx, cy - s * 1.88 - bob); }
  g.globalAlpha = 1;
}
function draw() {
  g.fillStyle = "#0a0716"; g.fillRect(0, 0, W, H);
  if (!grid.length) return;
  const T = clock(), t2 = performance.now();
  // engrenages et vapeur dans les marges
  const gc = arena === "glace" ? "#0f1f33" : arena === "usine" ? "#1f1a2e" : "#160f2e";
  drawGear(OX - TS * 1.6, OY + TS * 3, TS * 1.5, t2 / 3000, gc); drawGear(OX + COLS * TS + TS * 1.8, OY + TS * 9.5, TS * 1.9, -t2 / 3800, gc); drawGear(OX - TS * 1.2, OY + TS * 10.5, TS * 0.9, -t2 / 2000, gc);
  if (arena === "usine") for (let k = 0; k < 6; k++) { const ph = ((t2 / 2600 + k / 6) % 1), x = k % 2 ? OX - TS * 1.5 : OX + COLS * TS + TS * 1.5; g.fillStyle = `rgba(200,200,220,${0.18 * (1 - ph)})`; g.beginPath(); g.arc(x + Math.sin(ph * 6 + k) * 10, OY + TS * ROWS - ph * TS * 8, TS * (0.4 + ph * 0.8), 0, 7); g.fill(); }
  // secousse
  g.save(); if (shakeB > 0) g.translate((Math.random() - 0.5) * shakeB * TS * 0.5, (Math.random() - 0.5) * shakeB * TS * 0.5);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) floorTile(x, y, T);
  // traces de brûlé
  for (const sc of scorch) { const cx = OX + sc.x * TS + TS / 2, cy = OY + sc.y * TS + TS / 2, a = Math.max(0, 1 - (T - sc.t) / 9000), gg = g.createRadialGradient(cx, cy, 1, cx, cy, TS * 0.62); gg.addColorStop(0, `rgba(0,0,0,${0.55 * a})`); gg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gg; g.fillRect(cx - TS, cy - TS, TS * 2, TS * 2); }
  for (const f of fires) drawFire(f, T);
  // rangée par rangée, pour que le relief cache bien ce qui est derrière
  const pupRows = {}; for (const [k, pu] of Object.entries(pups)) { if (pu.safe > T) continue; const yy = +k.split(",")[1]; (pupRows[yy] = pupRows[yy] || []).push([k, pu]); }
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) { const v = grid[y][x]; if (v) blockTile(x, y, v); }
    for (const [k, pu] of pupRows[y] || []) drawBonus(k, pu, T);
    for (const b of bombs) if (b.y === y) drawBomb(b, T);
    for (const p of players) if (Math.round(p.y) === y) drawPlayer(p, T);
  }
  // débris et flashs
  for (const d of debris) { g.save(); g.globalAlpha = Math.min(1, d.life * 2); g.translate(OX + d.x * TS, OY + d.y * TS - d.z * TS); g.rotate(d.r); g.fillStyle = d.c; g.fillRect(-TS * 0.12, -TS * 0.05, TS * 0.24, TS * 0.1); g.restore(); }
  for (const f of flashes) { const a = f.life / 0.18, cx = OX + f.x * TS + TS / 2, cy = OY + f.y * TS + TS / 2, gg = g.createRadialGradient(cx, cy, 0, cx, cy, TS * 3); gg.addColorStop(0, `rgba(255,250,220,${0.7 * a})`); gg.addColorStop(1, "rgba(255,200,100,0)"); g.fillStyle = gg; g.fillRect(cx - TS * 3, cy - TS * 3, TS * 6, TS * 6); }
  g.restore();
  // compte à rebours et fin de manche
  g.textAlign = "center";
  if (T < roundAt) { const n = Math.ceil((roundAt - T) / 1000); bigText(n > 0 ? String(n) : "GO", "#facc15"); }
  else if (T - roundAt < 700) bigText("GO !", "#4ade80");
  if (phase === "over" && teams) bigText(winner ? `L'équipe ${winner === "A" ? "jaune" : "bleue"} gagne la manche` : "Égalité", winner ? TEAMC[winner][0] : "#fff", 0.45);
  else if (phase === "over") { const w = players.find(p => p.id === winner); bigText(w ? `${w.local ? "Tu gagnes" : w.name + " gagne"} la manche` : "Égalité", w ? w.color : "#fff", 0.5); }
  if (phase === "play" && T - roundAt > SUDDEN - 5000 && T - roundAt < SUDDEN + 2500) { g.font = `800 ${Math.max(16, TS * 0.6)}px "Inter Tight", Inter, sans-serif`; g.fillStyle = "#f87171"; g.fillText(T - roundAt < SUDDEN ? "Les murs vont se refermer !" : "MORT SUBITE", W / 2, OY - 10); }
}
function bigText(s, c, k = 1) { g.font = `800 ${Math.max(24, TS * 1.6 * k)}px "Inter Tight", Inter, sans-serif`; g.lineWidth = 6; g.strokeStyle = "#0a0716"; g.strokeText(s, W / 2, OY + TS * ROWS / 2 + TS * 0.5); g.fillStyle = c; g.fillText(s, W / 2, OY + TS * ROWS / 2 + TS * 0.5); }

/* ---------- boucle ---------- */
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.05, (t - last) / 1000); last = t; tick(dt); draw(); requestAnimationFrame(frame);
}
let lastCount = 9, lastPhase = "";
function tick(dt) {
  lastTick = performance.now();
  shakeB = Math.max(0, shakeB - dt * 2.5);
  for (const d of debris) { d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.vz -= 12 * dt; if (d.z < 0) { d.z = 0; d.vz *= -0.3; d.vx *= 0.6; d.vy *= 0.6; } d.r += d.vr * dt; d.life -= dt; } debris = debris.filter(d => d.life > 0);
  for (const f of flashes) f.life -= dt; flashes = flashes.filter(f => f.life > 0);
  if (mode !== "menu" && grid.length) { const n = Math.ceil((roundAt - clock()) / 1000); if (n !== lastCount) { if (n >= 1 && n <= 3) snd("beep"); else if (n <= 0 && lastCount >= 1) snd("go"); lastCount = n; } if (phase !== lastPhase) { if (phase === "over") snd(winner && me && (winner === me.id || winner === me.team) ? "win" : "lose"); lastPhase = phase; } }
  if (mode === "solo" || mode === "mp") {
    processWorld(dt);
    if (me && me.alive && clock() >= roundAt && phase === "play") {
      let dx = mv.x + (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("KeyQ") ? 1 : 0);
      let dy = mv.y + (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("KeyW") || keys.has("KeyZ") ? 1 : 0);
      move(me, dx, dy, dt);
    } else if (me && arena === "glace" && me.alive) move(me, 0, 0, dt);
    if (me && me.alive && clock() >= roundAt) terrain(me, dt);
    if (me) checkLocal(me);
    if (mode === "solo") { for (const p of players) if (p.bot) { botUpdate(p, dt); if (p.alive && clock() >= roundAt) terrain(p, dt); checkLocal(p); } soloTick(); }
    if (mode === "mp") { syncRemote(dt); liveT += dt; if (liveT > 0.08) { liveT = 0; writeLive(); } hostTick(); }
    const el = Math.max(0, clock() - roundAt), left = Math.max(0, SUDDEN - el);
    $("#timer").textContent = phase === "play" && clock() >= roundAt ? (left > 0 ? `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")}` : "Mort subite") : `Manche ${round}`;
    $("#stats").innerHTML = me ? `<span title="Bombes">B ${me.maxB}</span><span title="Portée">F ${me.range}</span><span title="Vitesse">V ${Math.round((me.speed - 3.4) / 0.5) + 1}</span>${me.kick ? `<span title="Coup de pied" style="color:#4ade80">PIED</span>` : ""}${me.remote ? `<span title="Télécommande" style="color:#f87171">TÉLÉ</span>` : ""}${me.shield ? `<span title="Bouclier" style="color:#67e8f9">BOUCL.</span>` : ""}` : "";
    if (Math.random() < 0.1) hudPlayers();
  }
  feed.forEach(f => f.t -= dt); feed = feed.filter(f => f.t > 0); $("#feed").innerHTML = feed.map(f => `<div>${f.html}</div>`).join("");
  if (fl > 0) { fl -= dt; if (fl <= 0) $("#banner").textContent = ""; }
}
let lastTick = performance.now();
setInterval(() => { const t = performance.now(); if (t - lastTick > 400 && mode === "mp") tick(Math.min(0.1, (t - lastTick) / 1000)); }, 300);
requestAnimationFrame(frame);
window.BLAST = { get players() { return players; }, get bombs() { return bombs; }, get grid() { return grid; }, get me() { return me; }, get phase() { return phase; }, get wins() { return wins; }, get round() { return round; }, soloStart, placeBomb: () => me && placeBomb(me), get mode() { return mode; }, die: () => me && die(me, ""), keys, get arena() { return arena; }, get teams() { return teams; }, get special() { return special; }, give: t => { if (!me) return; if (t === "kick") me.kick = true; if (t === "remote") me.remote = true; if (t === "shield") me.shield = true; }, detonate: () => detonate(me), setSolo: (a, t) => { soloArena = a; soloTeams = !!t; }, get pups() { return pups; }, get fires() { return fires; } };
}
