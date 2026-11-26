"use strict";
/* Loup-Garou : un village la nuit, des tâches, des loups cachés, des réunions et des votes. */
{
const $ = s => document.querySelector(s), cv = $("#cv"), g = cv.getContext("2d");
const isTouch = matchMedia("(pointer:coarse)").matches;
const snd = n => window.SFX && window.SFX.play(n);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#ec4899", "#14b8a6", "#f5f5f4", "#8b5cf6"];
const BOTN = ["Gaspard", "Mathilde", "Octave", "Rosalie", "Firmin", "Berthe", "Anatole"];
const MW = 64, MH = 44, PR = 0.42, SPEED = 3.7, BOT_SPEED = 3.3, VIS = 6.5, WVIS = 8.5, FOGVIS = 2.6, KILL_R = 1.5, KILL_CD = 22000, FOG_CD = 50000, MEET_MP = 70000, MEET_SOLO = 32000, REVEAL = 6000;
const mf = (s => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; })(4242);

/* ---------- le village ---------- */
const RECTS = [], CIRCS = [], LANTERNS = [[20, 21], [44, 24], [30, 33], [24, 13], [40, 14], [16, 30], [50, 30]];
const HOUSES = [[6, 4, 7, 5, "#7c2d12"], [17, 3, 6, 5, "#1e3a5f"], [36, 4, 7, 5, "#3f3f46"], [47, 5, 6, 5, "#7c2d12"], [6, 39, 6, 4, "#1e3a5f"], [44, 37, 7, 5, "#3f3f46"], [20, 36, 6, 5, "#7c2d12"], [28, 38, 5, 4, "#1e3a5f"]];
for (const [x, y, w, h, roof] of HOUSES) RECTS.push({ x, y, w, h, k: "house", roof });
RECTS.push({ x: 31, y: 13.5, w: 2, h: 2, k: "bell" }); RECTS.push({ x: 10, y: 33, w: 4, h: 2.4, k: "coop" }); RECTS.push({ x: 53, y: 31, w: 4, h: 2.6, k: "saw" }); RECTS.push({ x: 56, y: 3, w: 3, h: 3, k: "mill" });
CIRCS.push({ x: 32, y: 22, r: 1.2, k: "well" });
for (let i = 0; i < 150; i++) { // forêt tout autour et bois à l'ouest
  let x, y; const z = mf();
  if (z < 0.55) { const e = Math.floor(mf() * 4); x = e === 0 ? mf() * 3 + 0.5 : e === 1 ? MW - mf() * 3 - 0.5 : mf() * MW; y = e === 2 ? mf() * 2.5 + 0.5 : e === 3 ? MH - mf() * 2.5 - 0.5 : mf() * MH; if (e < 2) y = mf() * MH; }
  else { x = 3 + mf() * 10; y = 13 + mf() * 13; }
  if (Math.hypot(x - 7.5, y - 19) < 2.2) continue;
  if (RECTS.some(r => x > r.x - 1 && x < r.x + r.w + 1 && y > r.y - 1 && y < r.y + r.h + 1)) continue;
  CIRCS.push({ x, y, r: 0.55 + mf() * 0.35, k: "tree" });
}
for (const [x, y] of [[51, 14], [53, 23], [46, 26]]) CIRCS.push({ x, y, r: 0.8, k: "hay" });
const STATIONS = {
  eau: { name: "Puiser de l'eau au puits", x: 32, y: 23.9, kind: "hold", dur: 3 },
  bois: { name: "Couper du bois à la scierie", x: 55, y: 34.4, kind: "tap", taps: 8 },
  poules: { name: "Nourrir les poules", x: 12, y: 36.2, kind: "hold", dur: 3 },
  potager: { name: "Arroser le potager", x: 48, y: 19, kind: "hold", dur: 3.5 },
  moulin: { name: "Réparer le moulin", x: 57.5, y: 7, kind: "tap", taps: 10 },
  champi: { name: "Cueillir des champignons", x: 7.5, y: 19, kind: "hold", dur: 2.5 },
  lant1: { name: "Rallumer la lanterne ouest", x: 20, y: 21.8, kind: "hold", dur: 1.6 },
  lant2: { name: "Rallumer la lanterne est", x: 44, y: 24.8, kind: "hold", dur: 1.6 },
  linge: { name: "Ramasser le linge", x: 25, y: 9.5, kind: "hold", dur: 3 },
  pain: { name: "Livrer le pain chez le boulanger", x: 39.5, y: 9.6, kind: "hold", dur: 2 },
  cloture: { name: "Réparer la clôture", x: 15, y: 27.5, kind: "tap", taps: 8 },
  fleurs: { name: "Cueillir des fleurs pour la fête", x: 27, y: 30, kind: "hold", dur: 2.5 }
};
const TASK_IDS = Object.keys(STATIONS), BELL = { x: 32, y: 16.6 };
function solidAt(x, y, r) {
  for (const o of RECTS) { const cx = Math.max(o.x, Math.min(x, o.x + o.w)), cy = Math.max(o.y, Math.min(y, o.y + o.h)); if (Math.hypot(x - cx, y - cy) < r) return o; }
  for (const c of CIRCS) if (Math.hypot(x - c.x, y - c.y) < r + c.r) return c;
  return x < r || y < r || x > MW - r || y > MH - r;
}
function move(p, dx, dy, dt, sp) {
  if (!dx && !dy) return; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  const step = sp * dt, nx = p.x + dx * step, ny = p.y + dy * step;
  if (p.ghost) { p.x = Math.max(0.5, Math.min(MW - 0.5, nx)); p.y = Math.max(0.5, Math.min(MH - 0.5, ny)); }
  else { if (!solidAt(nx, p.y, PR)) p.x = nx; if (!solidAt(p.x, ny, PR)) p.y = ny; }
  if (Math.abs(dx) > 0.2) p.face = dx > 0 ? 1 : -1; p.walk += step * 2.4;
}
// grille pour que les robots trouvent leur chemin
const GRID = []; for (let y = 0; y < MH; y++) { const row = []; for (let x = 0; x < MW; x++) row.push(solidAt(x + 0.5, y + 0.5, 0.55) ? 1 : 0); GRID.push(row); }
function path(sx, sy, tx, ty) {
  const W = MW, s = Math.floor(sy) * W + Math.floor(sx); let t = Math.floor(ty) * W + Math.floor(tx);
  if (GRID[Math.floor(ty)] && GRID[Math.floor(ty)][Math.floor(tx)]) { // cible dans un obstacle : case libre la plus proche
    let best = null, bd = 1e9; for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if (!GRID[y][x]) { const d = Math.hypot(x + 0.5 - tx, y + 0.5 - ty); if (d < bd) { bd = d; best = y * W + x; } } t = best;
  }
  const prev = new Int32Array(W * MH).fill(-1), q = [s]; prev[s] = s;
  while (q.length) { const c = q.shift(); if (c === t) break; const cx = c % W, cy = (c - cx) / W; for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const nx = cx + ax, ny = cy + ay; if (nx < 0 || ny < 0 || nx >= W || ny >= MH || GRID[ny][nx]) continue; if (ax && ay && (GRID[cy][nx] || GRID[ny][cx])) continue; const n = ny * W + nx; if (prev[n] !== -1) continue; prev[n] = c; q.push(n); } }
  if (prev[t] === -1) return [[tx, ty]];
  const out = []; for (let c = t; c !== s; c = prev[c]) out.push([c % W + 0.5, Math.floor(c / W) + 0.5]); out.reverse(); out.push([tx, ty]); return out;
}

/* ---------- état de la partie (le même format en solo et en multi) ---------- */
let mode = "menu", S = null, people = [], me = null, clock = () => Date.now(), myDone = [], lastMR = -1, task = null, killCd = 0, fogCd = 0, witness = {}, killSnap = {}, soloChat = [], spoken = {};
const L = window.LOBBY, X = L && L.ctx;
const isHostish = () => mode === "solo" || (mode === "mp" && X.isHost());
const st = () => (mode === "mp" ? X.state : S);
function upd(patch) { if (mode === "solo") Object.assign(S, patch); else if (X.isHost()) { X.updState(patch); Object.assign(X.state, patch); } }
const roleOf = id => (st() && st().roles && st().roles[id]) || "vil";
const isDead = id => !!(st() && st().dead && st().dead[id]);
const nameOf = id => (people.find(p => p.id === id) || {}).name || "?";
const colorOfId = id => (people.find(p => p.id === id) || {}).color || "#fff";
const aliveIds = () => (st() ? st().roster.filter(id => !isDead(id)) : []);
function doneOf(id) { if (mode === "solo") return (S.done && S.done[id]) || []; if (id === X.uid) return myDone; const s = X.score[id]; return (s && s.d) || []; }
function villageProgress() {
  const s = st(); if (!s) return 0; let tot = 0, dn = 0;
  for (const id of s.roster) { if (roleOf(id) === "wolf") continue; const t = (s.tasks && s.tasks[id]) || []; tot += t.length; dn += doneOf(id).filter(x => t.includes(x)).length; }
  return tot ? dn / tot : 0;
}
function makeGame(roster) {
  const n = roster.length, nw = n >= 7 ? 2 : 1, ids = roster.slice(), roles = {}, tasks = {};
  const sh = ids.slice().sort(() => Math.random() - 0.5); ids.forEach(id => roles[id] = "vil"); sh.slice(0, nw).forEach(id => roles[id] = "wolf");
  for (const id of ids) { const pool = TASK_IDS.slice().sort(() => Math.random() - 0.5); tasks[id] = pool.slice(0, 5); }
  return { phase: "play", roster: ids, roles, tasks, dead: {}, bodies: {}, votes: {}, bell: {}, meet: null, reveal: null, fogUntil: 0, mr: 0, at: Math.round(clock() + 3000), winner: "" };
}
/* ---------- règles (appliquées par l'hôte, ou directement en solo) ---------- */
function hostEvent(e) {
  const s = st(); if (!s) return; const by = e.from;
  if (e.type === "kill" && s.phase === "play" && roleOf(by) === "wolf" && !isDead(by) && !isDead(e.target) && roleOf(e.target) !== "wolf") {
    upd({ dead: Object.assign({}, s.dead, { [e.target]: by }), bodies: Object.assign({}, s.bodies, { [e.target]: { x: e.x, y: e.y } }) }); checkWin();
  }
  if ((e.type === "report" || e.type === "bell") && s.phase === "play" && !isDead(by)) {
    if (e.type === "bell" && (s.bell || {})[by]) return;
    const T = clock(); upd({ phase: "meet", meet: { by, body: e.body || "", endAt: Math.round(T + (mode === "solo" ? MEET_SOLO : MEET_MP)), at: Math.round(T) }, votes: {}, bell: e.type === "bell" ? Object.assign({}, s.bell || {}, { [by]: 1 }) : (s.bell || {}) });
  }
  if (e.type === "vote" && s.phase === "meet" && !isDead(by) && !(s.votes && s.votes[by])) upd({ votes: Object.assign({}, s.votes || {}, { [by]: e.target }) });
  if (e.type === "fog" && s.phase === "play" && roleOf(by) === "wolf") upd({ fogUntil: Math.round(clock() + 20000) });
}
function hostTick() {
  const s = st(); if (!s) return; const T = clock();
  if (s.phase === "play") checkWin();
  if (s.phase === "meet") {
    const al = aliveIds(), voted = al.filter(id => s.votes && s.votes[id]).length;
    if (T > s.meet.endAt || voted >= al.length) {
      const tally = {}; for (const id of al) { const v = (s.votes && s.votes[id]) || "skip"; tally[v] = (tally[v] || 0) + 1; }
      const top = Object.entries(tally).sort((a, b) => b[1] - a[1]); let out = "";
      if (top.length && top[0][0] !== "skip" && (top.length === 1 || top[0][1] > top[1][1])) out = top[0][0];
      upd({ phase: "reveal", reveal: { id: out, wolf: out ? roleOf(out) === "wolf" : false, until: Math.round(T + REVEAL), tally }, dead: out ? Object.assign({}, s.dead, { [out]: "vote" }) : s.dead, bodies: {} });
    }
  }
  if (s.phase === "reveal" && T > s.reveal.until) { upd({ phase: "play", mr: (s.mr || 0) + 1, meet: null, votes: {} }); checkWin(); }
}
function checkWin() {
  const s = st(); if (!s || s.phase === "end") return;
  const al = aliveIds(), w = al.filter(id => roleOf(id) === "wolf").length, v = al.length - w;
  let win = ""; if (w === 0) win = "vil"; else if (w >= v) win = "wolf"; else if (villageProgress() >= 1) win = "vil";
  if (win && s.phase !== "meet") { upd({ phase: "end", winner: win }); if (mode === "mp") setTimeout(() => X.end({ winner: win }), 5500); }
}
// actions du joueur local : envoyées à l'hôte (multi) ou appliquées tout de suite (solo)
function act(e) { e.from = me.id; if (mode === "solo") hostEvent(e); else { X.ev(Object.assign({ mr: st().mr || 0 }, e)); if (X.isHost()) hostEvent(e); } }

/* ---------- personnages ---------- */
function makePerson(o, i) { return Object.assign({ x: 32, y: 22, face: 1, walk: 0, color: COLORS[i % COLORS.length], ghost: false, ai: { path: null, t: 0, doing: null, until: 0, wander: null } }, o); }
function spawnAll() { const n = people.length; people.forEach((p, i) => { const a = i / n * Math.PI * 2; p.x = 32 + Math.cos(a) * 3.2; p.y = 22 + Math.sin(a) * 3.2; p.ai.path = null; p.ai.doing = null; }); }

/* ---------- commandes ---------- */
const keys = new Set(), mv = { x: 0, y: 0 };
addEventListener("keydown", e => {
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault(); keys.add(e.code);
  if (e.code === "KeyE" || e.code === "Space") press("use"); if (e.code === "KeyR") press("rep"); if (e.code === "KeyF") press("kill"); if (e.code === "KeyG") press("fog");
});
addEventListener("keyup", e => { keys.delete(e.code); if (e.code === "KeyE" || e.code === "Space") holdUse = false; });
const stick = $("#stick"), knob = $("#knob"); let sid = null, sc = null;
stick.addEventListener("pointerdown", e => { e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); sc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; smove(e); });
stick.addEventListener("pointermove", e => { if (e.pointerId === sid) smove(e); });
const sEnd = e => { if (e.pointerId !== sid) return; sid = null; mv.x = mv.y = 0; knob.style.transform = ""; };
stick.addEventListener("pointerup", sEnd); stick.addEventListener("pointercancel", sEnd);
function smove(e) { let dx = e.clientX - sc.x, dy = e.clientY - sc.y; const d = Math.hypot(dx, dy), m = Math.min(d, 46); if (d > 0) { dx = dx / d * m; dy = dy / d * m; } knob.style.transform = `translate(${dx}px,${dy}px)`; mv.x = dx / 46; mv.y = dy / 46; }
let holdUse = false;
$("#acts").addEventListener("pointerdown", e => { const b = e.target.closest("[data-a]"); if (!b || b.disabled) return; e.preventDefault(); press(b.dataset.a); });
addEventListener("pointerup", () => { holdUse = false; });

/* ---------- ce qui est à portée ---------- */
const near = (a, x, y, r) => Math.hypot(a.x - x, a.y - y) < r;
function nearStation() { if (!me) return null; const s = st(); const mine = (s.tasks[me.id] || []).filter(t => !myDone.includes(t)); for (const t of mine) if (near(me, STATIONS[t].x, STATIONS[t].y, 1.4)) return t; return null; }
function nearBody() { const s = st(); if (!me || me.ghost) return null; for (const [id, b] of Object.entries(s.bodies || {})) if (near(me, b.x, b.y, 2.2)) return id; return null; }
function nearPrey() { if (!me || me.ghost || roleOf(me.id) !== "wolf") return null; let best = null, bd = KILL_R; for (const p of people) { if (p === me || isDead(p.id) || roleOf(p.id) === "wolf") continue; const d = Math.hypot(p.x - me.x, p.y - me.y); if (d < bd) { bd = d; best = p; } } return best; }
function press(a) {
  const s = st(); if (!s || !me || s.phase !== "play" || clock() < s.at) return;
  if (a === "use") { const t = nearStation(); if (t) { if (!task || task.id !== t) task = { id: t, p: 0, taps: 0 }; holdUse = true; if (STATIONS[t].kind === "tap") { task.taps++; snd("box"); } } else if (!me.ghost && near(me, BELL.x, BELL.y, 1.6) && !(s.bell || {})[me.id]) { act({ type: "bell" }); snd("ding"); } }
  if (a === "rep") { const b = nearBody(); if (b) act({ type: "report", body: b }); }
  if (a === "kill" && clock() > killCd) { const p = nearPrey(); if (p) { killCd = clock() + KILL_CD; if (mode === "solo") killNow(me, p); else act({ type: "kill", target: p.id, x: +p.x.toFixed(2), y: +p.y.toFixed(2) }); snd("knife"); flash(`Tu as dévoré ${p.name}`, "Éloigne-toi vite…", 1.6); claws.push({ x: p.x, y: p.y, t: clock() }); } }
  if (a === "fog" && clock() > fogCd && roleOf(me.id) === "wolf" && !me.ghost) { fogCd = clock() + FOG_CD; act({ type: "fog" }); snd("wave"); flash("Brouillard !", "Les villageois n'y voient presque plus", 1.6); }
}
function taskTick(dt) {
  if (!task) return; const s = st(), def = STATIONS[task.id];
  if (!me || s.phase !== "play" || !near(me, def.x, def.y, 1.5) || myDone.includes(task.id)) { task = null; $("#task").hidden = true; return; }
  if (def.kind === "hold") { if (holdUse || keys.has("KeyE") || keys.has("Space")) task.p += dt / def.dur; } else task.p = task.taps / def.taps;
  $("#task").hidden = false; $("#tname").textContent = def.name; $("#tprog").style.width = Math.min(100, task.p * 100) + "%";
  $("#thelp").textContent = def.kind === "hold" ? (isTouch ? "Garde le doigt sur AGIR" : "Garde E (ou Espace) enfoncé") : `Appuie vite sur ${isTouch ? "AGIR" : "E"} (${task.taps}/${def.taps})`;
  if (task.p >= 1) {
    if (roleOf(me.id) !== "wolf") { myDone.push(task.id); if (mode === "mp") X.setScore({ done: myDone.length, d: myDone }); else S.done[me.id] = myDone.slice(); }
    else { myDone.push(task.id); } // le loup fait semblant
    snd("ok"); flash("Tâche faite !", def.name, 1); task = null; $("#task").hidden = true;
  }
}

/* ---------- robots (solo) ---------- */
function botTick(p, dt) {
  const s = S, a = p.ai, T = clock(); if (s.phase !== "play" || T < s.at) return;
  const wolf = roleOf(p.id) === "wolf";
  // repérer un corps
  if (!p.ghost && !wolf) for (const [id, b] of Object.entries(s.bodies || {})) if (near(p, b.x, b.y, 4.5)) { if (!a.seenBody) a.seenBody = T; if (T - a.seenBody > 500) { a.seenBody = 0; hostEvent({ type: "report", body: id, from: p.id }); return; } }
  if (wolf && !p.ghost) {
    // chasser une proie isolée
    if (T > (a.killCd || s.at + 20000)) {
      const preys = people.filter(q => !isDead(q.id) && roleOf(q.id) !== "wolf").map(q => [q, Math.hypot(q.x - p.x, q.y - p.y)]).sort((x, y) => x[1] - y[1]);
      const tgt = preys.find(([q]) => !people.some(o => o !== q && o !== p && !isDead(o.id) && roleOf(o.id) !== "wolf" && Math.hypot(o.x - q.x, o.y - q.y) < 6.5));
      if (tgt) {
        const [q, d] = tgt;
        if (d < KILL_R) { a.killCd = T + KILL_CD + 8000 + Math.random() * 12000; killNow(p, q); a.path = null; a.flee = T + 4000; }
        else if (!a.hunt || T > a.hunt) { a.path = path(p.x, p.y, q.x, q.y); a.hunt = T + 700; }
      }
    }
    if (Math.random() < 0.0006 && T > (a.fogCd || 0)) { a.fogCd = T + FOG_CD; hostEvent({ type: "fog", from: p.id }); }
  }
  // tâches (vraies ou fausses)
  if (!a.path || !a.path.length) {
    if (a.doing) { if (T > a.until) { if (!wolf) { S.done[p.id] = (S.done[p.id] || []).concat([a.doing]); } a.doing = null; } else return; }
    const todo = (s.tasks[p.id] || []).filter(t => !((S.done[p.id] || []).includes(t)) && !(a.fake || []).includes(t));
    const nxt = todo.length ? todo[Math.floor(Math.random() * Math.min(2, todo.length))] : TASK_IDS[Math.floor(Math.random() * TASK_IDS.length)];
    const stn = STATIONS[nxt]; if (near(p, stn.x, stn.y, 1.2)) { a.doing = nxt; a.until = T + (stn.dur || stn.taps * 0.35) * 1000 * (1.1 + Math.random() * 0.6); if (wolf) a.fake = (a.fake || []).concat([nxt]).slice(-3); if (!todo.length) { a.doing = null; a.until = 0; a.path = path(p.x, p.y, 20 + Math.random() * 24, 12 + Math.random() * 20); } return; }
    a.path = path(p.x, p.y, stn.x, stn.y);
  }
  const wp = a.path[0]; const dx = wp[0] - p.x, dy = wp[1] - p.y, d = Math.hypot(dx, dy);
  if (d < 0.25) { a.path.shift(); return; }
  move(p, dx / d, dy / d, dt, BOT_SPEED);
}
function killNow(k, q) {
  // témoins : villageois vivants assez près du loup
  for (const o of people) if (o !== k && o !== q && !isDead(o.id) && roleOf(o.id) !== "wolf" && Math.hypot(o.x - k.x, o.y - k.y) < 6.5) (witness[o.id] = witness[o.id] || []).push({ k: k.id, v: q.id });
  killSnap[q.id] = people.filter(o => o !== q && !isDead(o.id)).map(o => [o.id, Math.hypot(o.x - q.x, o.y - q.y)]).sort((a, b) => a[1] - b[1]);
  hostEvent({ type: "kill", target: q.id, x: q.x, y: q.y, from: k.id });
  if (me && near(me, q.x, q.y, VIS)) claws.push({ x: q.x, y: q.y, t: clock() });
}
// avis des robots pendant la réunion
function botMeeting() {
  const s = S, al = aliveIds(), bots = people.filter(p => p.bot && !isDead(p.id));
  const accusedByChat = {}; for (const m of soloChat) for (const id of al) if (id !== m.from && m.text.toLowerCase().includes(nameOf(id).toLowerCase())) accusedByChat[id] = (accusedByChat[id] || 0) + 1;
  for (const b of bots) {
    const wolf = roleOf(b.id) === "wolf", delay = 2500 + Math.random() * (MEET_SOLO * 0.55);
    let target = "skip", line = "";
    if (!wolf) {
      const seen = (witness[b.id] || []).filter(w => !isDead(w.k)).pop();
      if (seen) { target = seen.k; line = `J'ai vu ${nameOf(seen.k)} dévorer ${nameOf(seen.v)} !`; }
      else {
        const body = s.meet.body, snap = body && killSnap[body] ? killSnap[body].filter(([id]) => id !== b.id && !isDead(id)) : [];
        const chatPick = Object.entries(accusedByChat).filter(([id]) => id !== b.id && !isDead(id)).sort((x, y) => y[1] - x[1])[0];
        if (snap.length && snap[0][1] < 9 && Math.random() < 0.5) { target = snap[0][0]; line = `${nameOf(target)} traînait près de ${nameOf(body)}…`; }
        else if (chatPick && Math.random() < 0.5) { target = chatPick[0]; line = `D'accord, je vote ${nameOf(target)}.`; }
        else line = ["Je n'ai rien vu, je passe.", "J'étais à mes tâches, aucune idée.", "Méfiez-vous, je n'ai pas de preuve.", "Je passe mon tour."][Math.floor(Math.random() * 4)];
      }
    } else {
      const pool = al.filter(id => id !== b.id && roleOf(id) !== "wolf"); const accuser = Object.entries(witness).find(([wid, l]) => !isDead(wid) && l.some(w => w.k === b.id));
      target = accuser ? accuser[0] : s.meet.by !== b.id && roleOf(s.meet.by) !== "wolf" && Math.random() < 0.5 ? s.meet.by : pool[Math.floor(Math.random() * pool.length)] || "skip";
      line = accuser ? `C'est faux ! ${nameOf(target)} ment, je faisais mes tâches.` : `Moi je trouve ${nameOf(target)} bizarre ce soir…`;
      if (Math.random() < 0.3) { target = "skip"; line = "Restons calmes, on n'a aucune preuve."; }
    }
    setTimeout(() => { if (mode !== "solo" || S.phase !== "meet" || isDead(b.id)) return; mlog(b.id, line); soloChat.push({ from: b.id, text: line }); }, delay * 0.6);
    setTimeout(() => { if (mode !== "solo" || S.phase !== "meet" || isDead(b.id)) return; hostEvent({ type: "vote", target, from: b.id }); }, delay);
  }
}

/* ---------- interface ---------- */
let fl = 0;
function flash(a, b, s = 1.8) { $("#banner").textContent = a; $("#sub").textContent = b || ""; fl = s; }
const MENU = $("#panel").innerHTML;
function showPanel(h) { $("#panel").hidden = false; $("#panel").innerHTML = h; }
function bindMenu() { $("#soloV").onclick = () => soloStart("vil"); $("#soloW").onclick = () => soloStart("wolf"); $("#multi").onclick = () => { $("#panel").hidden = true; L.menu(); }; }
bindMenu();
let actsKey = "";
function hud() {
  const s = st(); if (!s || !me) return;
  const wolf = roleOf(me.id) === "wolf", T = clock();
  $("#vbar").hidden = false; $("#vprog").style.width = Math.round(villageProgress() * 100) + "%";
  $("#role").innerHTML = me.ghost ? `<span style="color:#93c5fd">Fantôme</span>` : wolf ? `<span style="color:#f87171">Loup-garou</span>${s.roster.filter(id => id !== me.id && roleOf(id) === "wolf").map(id => ` · avec ${esc(nameOf(id))}`).join("")}` : `<span style="color:#fde68a">Villageois</span>`;
  $("#tasks").hidden = false;
  $("#tasks").innerHTML = (wolf ? `<b style="color:#f87171">Fausses tâches (pour donner le change)</b><br>` : `<b>Tes tâches</b><br>`) + (s.tasks[me.id] || []).map(t => `<span class="${myDone.includes(t) ? "d" : ""}">${esc(STATIONS[t].name)}</span>`).join("<br>");
  // boutons d'action
  const st2 = nearStation(), body = nearBody(), prey = nearPrey(), bell = !me.ghost && near(me, BELL.x, BELL.y, 1.6) && !(s.bell || {})[me.id];
  const kc = Math.max(0, Math.ceil((killCd - T) / 1000)), fc = Math.max(0, Math.ceil((fogCd - T) / 1000));
  const bt = [];
  bt.push(`<button class="act use" data-a="use" ${st2 || bell ? "" : "disabled"}>${bell && !st2 ? "SONNER" : "AGIR"}<small>${bell && !st2 ? "la cloche" : "E"}</small></button>`);
  if (!me.ghost) bt.push(`<button class="act rep" data-a="rep" ${body ? "" : "disabled"}>SIGNALER<small>R</small></button>`);
  if (wolf && !me.ghost) { bt.push(`<button class="act kill" data-a="kill" ${prey && !kc ? "" : "disabled"}>DÉVORER<small>${kc ? kc + " s" : "F"}</small></button>`); bt.push(`<button class="act fog" data-a="fog" ${fc ? "disabled" : ""}>BROUILLARD<small>${fc ? fc + " s" : "G"}</small></button>`); }
  const k = bt.join(""); if (k !== actsKey) { $("#acts").innerHTML = k; actsKey = k; }
}
// réunion
let meetKey = "", mlogN = 0;
function mlog(from, text, sys) { const d = document.createElement("div"); if (sys) { d.className = "sys"; d.textContent = text; } else d.innerHTML = `<b style="color:${colorOfId(from)}">${esc(nameOf(from))}</b> ${esc(text)}`; $("#mlog").appendChild(d); $("#mlog").scrollTop = 1e6; if (!sys && from !== (me && me.id)) snd("blip"); }
function meetUI() {
  const s = st(); if (!s) return;
  if (s.phase !== "meet") { $("#meet").hidden = true; meetKey = ""; return; }
  const T = clock(), first = $("#meet").hidden; $("#meet").hidden = false;
  if (first) {
    $("#mlog").innerHTML = ""; soloChat = []; snd("boss");
    const by = nameOf(s.meet.by); $("#mtitle").textContent = s.meet.body ? "Un corps a été trouvé !" : "La cloche a sonné !";
    $("#mwhy").textContent = s.meet.body ? `${by} a trouvé ${nameOf(s.meet.body)}, dévoré près de la lisière. Qui est le loup ?` : `${by} a réuni tout le village sur la place.`;
    mlog("", isDead(me.id) ? "Tu es un fantôme : tu peux écouter mais plus parler ni voter." : "Discutez, puis votez. En cas d'égalité, personne n'est chassé.", true);
    if (mode === "solo") botMeeting();
  }
  $("#mtime").textContent = `Vote dans ${Math.max(0, Math.ceil((s.meet.endAt - T) / 1000))} s · ${Object.keys(s.votes || {}).length} / ${aliveIds().length} ont voté`;
  const myVote = s.votes && s.votes[me.id], canVote = !isDead(me.id) && !myVote;
  const k = JSON.stringify([s.votes, s.dead, canVote]);
  if (k !== meetKey) {
    meetKey = k;
    $("#votes").innerHTML = s.roster.map(id => { const dead = isDead(id); return `<button class="vote${dead ? " dead" : ""}${myVote === id ? " mine" : ""}" data-v="${id}" ${dead || !canVote ? "disabled" : ""}><i style="background:${colorOfId(id)}"></i>${esc(nameOf(id))}${id === me.id ? " (toi)" : ""}${s.votes && s.votes[id] ? `<span class="ok">a voté</span>` : ""}</button>`; }).join("") + `<button class="vote skip${myVote === "skip" ? " mine" : ""}" data-v="skip" ${canVote ? "" : "disabled"}>Passer (ne chasser personne)</button>`;
  }
  $("#min").disabled = isDead(me.id);
}
$("#votes").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (!b || b.disabled) return; act({ type: "vote", target: b.dataset.v }); snd("ok"); });
$("#mform").onsubmit = e => { e.preventDefault(); const v = $("#min").value.trim(); if (!v || !me || isDead(me.id)) return; $("#min").value = ""; if (mode === "mp") X.push("chat", { text: v.slice(0, 60), pseudo: me.name, mr: st().mr || 0 }); else { soloChat.push({ from: me.id, text: v }); } mlog(me.id, v.slice(0, 60)); };

/* ---------- déroulé ---------- */
let lastPhase = "", lastDeadN = 0, endShown = false;
function phaseWatch() {
  const s = st(); if (!s) return; const T = clock();
  // morts : fantôme, son et message
  for (const p of people) { const d = isDead(p.id); if (d && !p.ghost) { p.ghost = true; if (p === me) { snd("die"); const by = s.dead[p.id]; flash(by === "vote" ? "Chassé du village…" : "Tu as été dévoré !", by === "vote" ? "Tu continues en fantôme : finis tes tâches pour aider" : `C'était ${nameOf(by)}. Tu continues en fantôme.`, 3); task = null; } else if (s.dead[p.id] !== "vote" && me && !me.ghost && near(me, p.x, p.y, curVis())) claws.push({ x: p.x, y: p.y, t: T }); } }
  if (s.phase !== lastPhase) {
    if (s.phase === "reveal" && s.reveal) { const r = s.reveal; flash(r.id ? `${nameOf(r.id)} est chassé du village` : "Personne n'est chassé", r.id ? (r.wolf ? `${nameOf(r.id)} était un loup-garou !` : `${nameOf(r.id)} n'était pas un loup-garou…`) : "Égalité ou trop d'abstentions", 5); snd(r.id ? (r.wolf ? "win" : "lose") : "blip"); }
    if (s.phase === "play" && lastPhase === "reveal") { const w = aliveIds().filter(id => roleOf(id) === "wolf").length; flash("La nuit continue…", `${w} loup${w > 1 ? "s" : ""}-garou${w > 1 ? "s" : ""} encore parmi vous`, 2.4); }
    if (s.phase === "end" && !endShown) { endShown = true; endScreen(s); }
    lastPhase = s.phase;
  }
  if ((s.mr || 0) !== lastMR) { lastMR = s.mr || 0; spawnAll(); killCd = Math.max(killCd, T + 15000); }
}
function endScreen(s) {
  const wolf = me && roleOf(me.id) === "wolf", won = (s.winner === "wolf") === wolf;
  snd(won ? "win" : "lose"); flash(s.winner === "wolf" ? "Les loups-garous gagnent" : "Le village est sauvé !", won ? "Bravo !" : "Perdu…", 4);
  if (window.ONLINE) window.ONLINE.submit("garou", gm => Object.assign(gm, mode === "mp" ? { games: (gm.games || 0) + 1, wins: (gm.wins || 0) + (won ? 1 : 0), wolfWins: (gm.wolfWins || 0) + (won && wolf ? 1 : 0), tasks: (gm.tasks || 0) + (wolf ? 0 : myDone.length) } : { soloGames: (gm.soloGames || 0) + 1, soloWins: (gm.soloWins || 0) + (won ? 1 : 0), tasks: (gm.tasks || 0) + (wolf ? 0 : myDone.length) }));
  if (mode === "solo") setTimeout(() => { mode = "menu"; $("#meet").hidden = true; showPanel(`<h1>${s.winner === "wolf" ? "Victoire des loups" : "Le village est sauvé"}</h1><p>${won ? "Tu as gagné !" : "Tu as perdu cette fois."}</p><table><tr><th>Joueur</th><th>Rôle</th><th>État</th></tr>${s.roster.map(id => `<tr><td style="color:${colorOfId(id)}">${esc(nameOf(id))}</td><td>${roleOf(id) === "wolf" ? "Loup-garou" : "Villageois"}</td><td>${isDead(id) ? (s.dead[id] === "vote" ? "chassé" : "dévoré") : "vivant"}</td></tr>`).join("")}</table><button class="btn" id="again">Rejouer</button><br><button class="ghost" id="tomenu">Menu</button>`); $("#again").onclick = () => soloStart(soloRole); $("#tomenu").onclick = () => { showPanel(MENU); bindMenu(); }; }, 4500);
}
let soloRole = "vil";
function soloStart(role) {
  soloRole = role; mode = "solo"; clock = () => Date.now(); $("#panel").hidden = true; endShown = false; lastPhase = ""; lastMR = -1; myDone = []; witness = {}; killSnap = {}; task = null; claws = [];
  const name = (window.ONLINE && window.ONLINE.profile && window.ONLINE.profile.pseudo) || "Toi";
  people = [makePerson({ id: "me", name, local: true }, 0)].concat(BOTN.map((n, i) => makePerson({ id: "bot" + i, name: n, bot: true }, i + 1)));
  me = people[0];
  S = makeGame(people.map(p => p.id)); S.done = {};
  // le rôle choisi pour toi
  const wolves = S.roster.filter(id => S.roles[id] === "wolf");
  if (role === "wolf" && S.roles.me !== "wolf") { S.roles[wolves[0]] = "vil"; S.roles.me = "wolf"; }
  if (role === "vil" && S.roles.me === "wolf") { S.roles.me = "vil"; const c = S.roster.filter(id => id !== "me" && S.roles[id] !== "wolf"); S.roles[c[Math.floor(Math.random() * c.length)]] = "wolf"; }
  killCd = S.at + 15000; fogCd = S.at + 20000;
  for (const p of people) p.ghost = false;
  introFlash();
}
function introFlash() { const wolf = roleOf(me.id) === "wolf"; snd(wolf ? "boss" : "wave"); flash(wolf ? "Tu es un loup-garou" : "Tu es villageois", wolf ? "Dévore les villageois sans te faire voir (F), sème le brouillard (G)" : "Fais tes tâches et démasque les loups", 3.5); }

/* ---------- multijoueur ---------- */
let liveT = 0, mpCur = "";
function writeLive() { if (mode !== "mp" || !me) return; X.setLive({ x: +me.x.toFixed(2), y: +me.y.toFixed(2), f: me.face, w: +me.walk.toFixed(1) }); }
function syncRemote(dt) { for (const p of people) { if (p.local) continue; const l = X.live[p.id]; if (!l) continue; const k = Math.min(1, dt * 12); p.x += (l.x - p.x) * k; p.y += (l.y - p.y) * k; p.face = l.f; p.walk = l.w; } }
function onState(ctx) {
  const s = ctx.state; if (mode !== "mp" || !s) return;
  const key = s.roster.join(",") + s.at;
  if (key !== mpCur) {
    mpCur = key; endShown = false; lastPhase = ""; lastMR = -1; myDone = []; task = null; claws = [];
    people = s.roster.map((id, i) => makePerson({ id, name: (ctx.players[id] || ctx.score[id] || {}).pseudo || "?", local: id === ctx.uid }, i));
    me = people.find(p => p.local) || null; killCd = s.at + 15000; fogCd = s.at + 20000;
    if (me) introFlash();
  }
}
function onEvent(e, ctx) {
  if (mode !== "mp") return;
  if (ctx.isHost() && e.from !== ctx.uid) hostEvent(e);
  if (e.type === "kill" && me && !me.ghost && e.from !== ctx.uid && near(me, e.x, e.y, curVis())) claws.push({ x: e.x, y: e.y, t: clock() });
}
let chatSub = false;
if (L) L.init({
  id: "garou", title: "Loup-Garou", min: 4, max: 10,
  initState: (ctx) => { const ids = Object.entries(ctx.players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)).slice(0, 10).map(x => x[0]); clock = ctx.now; return makeGame(ids); },
  onStart(ctx) { mode = "mp"; clock = ctx.now; mpCur = ""; $("#panel").hidden = true; ctx.setScore({ done: 0, d: [] }); if (!chatSub) { chatSub = true; ctx.sub("chat", m => { if (!m || mode !== "mp" || !st() || m.from === ctx.uid || st().phase !== "meet" || (m.mr || 0) !== (st().mr || 0)) return; mlog(m.from, m.text); }, 40); } if (ctx.state) onState(ctx); },
  onState, onEvent,
  onEnd() { mode = "menu"; $("#meet").hidden = true; },
  onStop() { mode = "menu"; $("#meet").hidden = true; },
  results(ctx) {
    const s = ctx.state || {}, w = ctx.meta.winner, wolf = (s.roles || {})[ctx.uid] === "wolf", won = (w === "wolf") === wolf;
    return `<h1 style="color:${won ? "#4ade80" : "#f5f3ff"}">${w === "wolf" ? "Les loups-garous gagnent" : "Le village est sauvé"}</h1><table><tr><th>Joueur</th><th>Rôle</th></tr>${(s.roster || []).map(id => `<tr><td>${esc((ctx.score[id] || ctx.players[id] || {}).pseudo || "?")}</td><td>${(s.roles || {})[id] === "wolf" ? "Loup-garou" : "Villageois"}${(s.dead || {})[id] ? " (" + ((s.dead[id] === "vote") ? "chassé" : "dévoré") + ")" : ""}</td></tr>`).join("")}</table>`;
  },
  onBack() { showPanel(MENU); bindMenu(); }
});

/* ---------- dessin ---------- */
let W = 0, H = 0, SC = 32, camX = 32, camY = 22, claws = [];
const dark = document.createElement("canvas"), dg = dark.getContext("2d");
function fit() { const d = devicePixelRatio || 1; W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; dark.width = W; dark.height = H; SC = Math.max(26, Math.min(W, H) / 15); }
addEventListener("resize", fit); fit();
const sx = x => (x - camX) * SC + W / 2, sy = y => (y - camY) * SC + H / 2;
function curVis() { const s = st(); if (!me) return VIS; if (me.ghost) return 99; const wolf = roleOf(me.id) === "wolf"; if (!wolf && s && clock() < s.fogUntil) return FOGVIS; return wolf ? WVIS : VIS; }
// motif d'herbe
const grass = (() => { const c = document.createElement("canvas"); c.width = c.height = 96; const x = c.getContext("2d"); x.fillStyle = "#1c3326"; x.fillRect(0, 0, 96, 96); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${40 + Math.random() * 30},${80 + Math.random() * 50},${50 + Math.random() * 20},${0.4 + Math.random() * 0.5})`; x.fillRect(Math.random() * 96, Math.random() * 96, 1.5, 3); } return g.createPattern(c, "repeat"); })();
const PATHS = [[32, 22, 9.5, 9], [32, 22, 20, 8], [32, 22, 39.5, 9], [32, 22, 50, 10], [32, 22, 57.5, 7], [32, 22, 12, 35], [32, 22, 9, 41], [32, 22, 23, 38], [32, 22, 30, 40], [32, 22, 47, 37], [32, 22, 55, 33], [32, 22, 48, 19], [32, 22, 7.5, 19]];
function drawWorld(T) {
  g.fillStyle = grass; g.save(); g.translate(sx(0) % 96, sy(0) % 96); g.fillRect(-96, -96, W + 192, H + 192); g.restore();
  // chemins de terre et place
  g.lineCap = "round"; g.strokeStyle = "#4a3b2a"; g.lineWidth = SC * 1.4; g.beginPath(); for (const [a, b, c, d] of PATHS) { g.moveTo(sx(a), sy(b)); g.quadraticCurveTo(sx((a + c) / 2 + (b - d) * 0.08), sy((b + d) / 2 + (c - a) * 0.08), sx(c), sy(d)); } g.stroke();
  g.fillStyle = "#57483a"; g.beginPath(); g.arc(sx(32), sy(22), SC * 5, 0, 7); g.fill(); g.strokeStyle = "#6b5a48"; g.lineWidth = 1; for (let i = 0; i < 40; i++) { const a = i * 2.4, r = (i % 5 + 1) * SC * 0.85; g.strokeRect(sx(32) + Math.cos(a) * r - 6, sy(22) + Math.sin(a) * r - 4, 12, 8); }
  // champ de blé et potager
  g.fillStyle = "#5c4a1e"; g.fillRect(sx(44), sy(14), 14 * SC, 10 * SC); g.strokeStyle = "#a3862f"; g.lineWidth = SC * 0.25; for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(sx(44.4 + i * 0.75), sy(14.3)); g.lineTo(sx(44.4 + i * 0.75), sy(23.7)); g.stroke(); }
  // épouvantail
  g.strokeStyle = "#6b4423"; g.lineWidth = SC * 0.15; g.beginPath(); g.moveTo(sx(52), sy(18)); g.lineTo(sx(52), sy(20.5)); g.moveTo(sx(51), sy(18.8)); g.lineTo(sx(53), sy(18.8)); g.stroke(); g.fillStyle = "#d4a017"; g.beginPath(); g.arc(sx(52), sy(17.8), SC * 0.35, 0, 7); g.fill();
  // clôture
  g.strokeStyle = "#8b6b4a"; g.lineWidth = SC * 0.12; g.beginPath(); g.moveTo(sx(13), sy(26.8)); g.lineTo(sx(18), sy(26.8)); g.moveTo(sx(13), sy(27.3)); g.lineTo(sx(18), sy(27.3)); g.stroke(); for (let i = 0; i <= 5; i++) { g.fillStyle = "#6b4a2a"; g.fillRect(sx(13 + i) - 3, sy(26.5), 6, SC * 1.1); }
  // fil à linge
  g.strokeStyle = "#d6d3d1"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx(23), sy(9)); g.lineTo(sx(27), sy(9)); g.stroke(); for (let i = 0; i < 4; i++) { g.fillStyle = ["#f5f5f4", "#93c5fd", "#fca5a5", "#fde68a"][i]; g.fillRect(sx(23.4 + i), sy(9), SC * 0.6, SC * 0.7); }
  // fleurs
  for (let i = 0; i < 18; i++) { g.fillStyle = ["#f472b6", "#fde047", "#c4b5fd", "#ffffff"][i % 4]; g.beginPath(); g.arc(sx(25.5 + (i * 37 % 30) / 10), sy(29 + (i * 17 % 20) / 10), SC * 0.12, 0, 7); g.fill(); }
  // ronds des tâches (les tiennes, en surbrillance)
  const s = st(), mine = me && s ? (s.tasks[me.id] || []).filter(t => !myDone.includes(t)) : [];
  for (const t of mine) { const p = STATIONS[t], pul = 0.5 + Math.sin(T / 300) * 0.2; g.strokeStyle = `rgba(253,224,71,${pul})`; g.lineWidth = 3; g.beginPath(); g.arc(sx(p.x), sy(p.y), SC * 0.7, 0, 7); g.stroke(); }
  // corps
  for (const [id, b] of Object.entries((s && s.bodies) || {})) drawBody(b.x, b.y, colorOfId(id));
  // objets à hauteur : obstacles et personnages, triés par profondeur
  const items = [];
  for (const o of RECTS) items.push({ y: o.y + o.h, f: () => drawRect(o, T) });
  for (const c of CIRCS) items.push({ y: c.y + c.r * 0.5, f: () => drawCirc(c, T) });
  for (const [x, y] of LANTERNS) items.push({ y, f: () => { g.fillStyle = "#1f2937"; g.fillRect(sx(x) - 2, sy(y) - SC * 1.2, 4, SC * 1.2); g.fillStyle = "#fbbf24"; g.fillRect(sx(x) - SC * 0.18, sy(y) - SC * 1.5, SC * 0.36, SC * 0.36); } });
  const vis = curVis();
  for (const p of people) { if (!me) break; const seen = p === me || Math.hypot(p.x - me.x, p.y - me.y) < vis + 0.3; if (!seen) continue; if (p.ghost && !(me && me.ghost) && p !== me) continue; items.push({ y: p.y, f: () => drawPerson(p, T) }); }
  items.sort((a, b) => a.y - b.y).forEach(i => i.f());
  // griffures
  claws = claws.filter(c => T - c.t < 900); for (const c of claws) { const k = (T - c.t) / 900; g.strokeStyle = `rgba(254,226,226,${1 - k})`; g.lineWidth = 4; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(sx(c.x) - SC * 0.7 + i * 10, sy(c.y) - SC * 0.8); g.lineTo(sx(c.x) + SC * 0.5 + i * 10, sy(c.y) + SC * 0.6); g.stroke(); } }
}
function drawRect(o, T) {
  const x = sx(o.x), y = sy(o.y), w = o.w * SC, h = o.h * SC;
  if (o.k === "house") {
    g.fillStyle = "#0006"; g.fillRect(x + 6, y + 8, w, h); g.fillStyle = "#c2a37a"; g.fillRect(x, y + h * 0.35, w, h * 0.65);
    g.fillStyle = o.roof; g.beginPath(); g.moveTo(x - 6, y + h * 0.45); g.lineTo(x + w / 2, y - h * 0.25); g.lineTo(x + w + 6, y + h * 0.45); g.closePath(); g.fill(); g.fillStyle = "#ffffff12"; g.beginPath(); g.moveTo(x + w / 2, y - h * 0.25); g.lineTo(x + w + 6, y + h * 0.45); g.lineTo(x + w / 2, y + h * 0.45); g.fill();
    g.fillStyle = "#4a2c18"; g.fillRect(x + w / 2 - SC * 0.4, y + h - SC * 1.1, SC * 0.8, SC * 1.1);
    for (const wx of [0.18, 0.72]) { g.fillStyle = "#fbbf24"; g.fillRect(x + w * wx, y + h * 0.58, SC * 0.7, SC * 0.6); g.strokeStyle = "#4a2c18"; g.lineWidth = 2; g.strokeRect(x + w * wx, y + h * 0.58, SC * 0.7, SC * 0.6); }
    g.fillStyle = "#57534e"; g.fillRect(x + w * 0.75, y - h * 0.12, SC * 0.5, SC * 0.9);
  } else if (o.k === "bell") {
    g.fillStyle = "#0006"; g.fillRect(x + 5, y + 6, w, h); g.fillStyle = "#78716c"; g.fillRect(x, y, w, h); g.fillStyle = "#57534e"; g.fillRect(x - 4, y - 4, w + 8, SC * 0.5);
    g.fillStyle = "#d4a017"; g.beginPath(); g.moveTo(x + w / 2, y + h * 0.2); g.quadraticCurveTo(x + w * 0.85, y + h * 0.3, x + w * 0.82, y + h * 0.8); g.lineTo(x + w * 0.18, y + h * 0.8); g.quadraticCurveTo(x + w * 0.15, y + h * 0.3, x + w / 2, y + h * 0.2); g.fill();
  } else if (o.k === "coop") {
    g.fillStyle = "#7c4a21"; g.fillRect(x, y, w, h); g.fillStyle = "#a16207"; g.fillRect(x - 3, y - 4, w + 6, SC * 0.5); for (let i = 0; i < 4; i++) { g.fillStyle = "#f5f5f4"; g.beginPath(); g.ellipse(x + w * (0.1 + i * 0.27), y + h + SC * (0.4 + (i % 2) * 0.3) + Math.sin(T / 200 + i) * 2, SC * 0.22, SC * 0.17, 0, 0, 7); g.fill(); g.fillStyle = "#dc2626"; g.fillRect(x + w * (0.1 + i * 0.27) + SC * 0.12, y + h + SC * (0.25 + (i % 2) * 0.3) + Math.sin(T / 200 + i) * 2, 4, 4); }
  } else if (o.k === "saw") {
    g.fillStyle = "#57534e"; g.fillRect(x, y, w, h); g.fillStyle = "#78350f"; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + w * 0.2 + i * SC * 0.6, y + h + SC * 0.4, SC * 0.3, SC * 0.3, 0, 0, 7); g.fill(); g.fillStyle = "#d6a76a"; g.beginPath(); g.arc(x + w * 0.2 + i * SC * 0.6, y + h + SC * 0.4, SC * 0.18, 0, 7); g.fill(); g.fillStyle = "#78350f"; }
  } else if (o.k === "mill") {
    g.fillStyle = "#e7e5e4"; g.fillRect(x, y, w, h); g.save(); g.translate(x + w / 2, y + h * 0.3); g.rotate(T / 1500); g.fillStyle = "#a8a29e"; for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillRect(-SC * 0.15, 0, SC * 0.3, SC * 2.4); } g.restore();
  }
}
function drawCirc(c, T) {
  const x = sx(c.x), y = sy(c.y), r = c.r * SC;
  if (c.k === "tree") { g.fillStyle = "#0007"; g.beginPath(); g.ellipse(x + 5, y + r * 0.6, r * 1.1, r * 0.5, 0, 0, 7); g.fill(); g.fillStyle = "#3b2414"; g.fillRect(x - r * 0.18, y - r * 0.2, r * 0.36, r * 0.9); g.fillStyle = "#14321f"; g.beginPath(); g.arc(x, y - r * 0.6, r * 1.25, 0, 7); g.fill(); g.fillStyle = "#1d4a2c"; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.9, r * 0.8, 0, 7); g.fill(); }
  else if (c.k === "well") { g.fillStyle = "#0006"; g.beginPath(); g.ellipse(x + 4, y + 6, r, r * 0.7, 0, 0, 7); g.fill(); g.fillStyle = "#78716c"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = "#0c1a2e"; g.beginPath(); g.arc(x, y, r * 0.65, 0, 7); g.fill(); g.fillStyle = "#6b4423"; g.fillRect(x - r, y - r * 1.4, r * 2, r * 0.25); g.fillRect(x - r, y - r * 1.4, r * 0.15, r * 1.4); g.fillRect(x + r * 0.85, y - r * 1.4, r * 0.15, r * 1.4); }
  else if (c.k === "hay") { g.fillStyle = "#a16207"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = "#ca8a04"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 0.6, 0, 5); g.stroke(); }
}
function drawPerson(p, T) {
  const x = sx(p.x), y = sy(p.y), s = SC * 0.5, bob = Math.abs(Math.sin(p.walk)) * s * 0.15;
  g.save(); if (p.ghost) g.globalAlpha = 0.45;
  g.fillStyle = "#0007"; g.beginPath(); g.ellipse(x, y + s * 0.85, s * 0.75, s * 0.25, 0, 0, 7); g.fill();
  // jambes
  const st2 = Math.sin(p.walk) * s * 0.2; g.fillStyle = "#3f2a1a"; g.fillRect(x - s * 0.35, y + s * 0.3 + st2 * 0.3, s * 0.25, s * 0.55); g.fillRect(x + s * 0.1, y + s * 0.3 - st2 * 0.3, s * 0.25, s * 0.55);
  // cape
  g.fillStyle = p.color; g.beginPath(); g.moveTo(x - s * 0.7, y + s * 0.5 - bob); g.quadraticCurveTo(x - s * 0.75, y - s * 0.5 - bob, x, y - s * 0.6 - bob); g.quadraticCurveTo(x + s * 0.75, y - s * 0.5 - bob, x + s * 0.7, y + s * 0.5 - bob); g.closePath(); g.fill();
  // tête
  g.fillStyle = "#f2c9a0"; g.beginPath(); g.arc(x, y - s * 0.85 - bob, s * 0.42, 0, 7); g.fill();
  const wolfMate = me && roleOf(me.id) === "wolf" && roleOf(p.id) === "wolf";
  g.fillStyle = wolfMate ? "#dc2626" : "#1f2937"; g.beginPath(); g.arc(x + p.face * s * 0.08 - s * 0.14, y - s * 0.85 - bob, s * 0.06, 0, 7); g.arc(x + p.face * s * 0.08 + s * 0.14, y - s * 0.85 - bob, s * 0.06, 0, 7); g.fill();
  // chapeau de paille
  g.fillStyle = "#c08b3a"; g.beginPath(); g.ellipse(x, y - s * 1.12 - bob, s * 0.7, s * 0.18, 0, 0, 7); g.fill(); g.fillStyle = "#d4a24c"; g.beginPath(); g.ellipse(x, y - s * 1.25 - bob, s * 0.35, s * 0.2, 0, Math.PI, 0); g.fill(); g.fillStyle = p.color; g.fillRect(x - s * 0.35, y - s * 1.22 - bob, s * 0.7, s * 0.07);
  if (wolfMate) { g.fillStyle = "#7f1d1d"; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(x + sd * s * 0.25, y - s * 1.3 - bob); g.lineTo(x + sd * s * 0.42, y - s * 1.75 - bob); g.lineTo(x + sd * s * 0.05, y - s * 1.4 - bob); g.fill(); } }
  g.restore();
  g.font = `700 ${Math.max(11, SC * 0.38)}px Inter, sans-serif`; g.textAlign = "center"; const t = p === me ? "Toi" : p.name.slice(0, 12), tw = g.measureText(t).width + 10;
  g.fillStyle = "#000a"; g.fillRect(x - tw / 2, y - s * 2.25, tw, SC * 0.5); g.fillStyle = p.ghost ? "#93c5fd" : p.color; g.fillText(t, x, y - s * 2.25 + SC * 0.38);
}
function drawBody(bx, by, col) {
  const x = sx(bx), y = sy(by), s = SC * 0.5;
  g.fillStyle = "#0006"; g.beginPath(); g.ellipse(x, y + s * 0.3, s * 1.1, s * 0.35, 0, 0, 7); g.fill();
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, s * 0.95, s * 0.45, 0.2, 0, 7); g.fill();
  g.fillStyle = "#f2c9a0"; g.beginPath(); g.arc(x - s * 0.95, y - s * 0.1, s * 0.38, 0, 7); g.fill();
  g.strokeStyle = "#1f2937"; g.lineWidth = 2; for (const ex of [-1.08, -0.82]) { g.beginPath(); g.moveTo(x + ex * s - 3, y - s * 0.18 - 3); g.lineTo(x + ex * s + 3, y - s * 0.18 + 3); g.moveTo(x + ex * s + 3, y - s * 0.18 - 3); g.lineTo(x + ex * s - 3, y - s * 0.18 + 3); g.stroke(); }
  g.fillStyle = "#c08b3a"; g.beginPath(); g.ellipse(x + s * 1.3, y + s * 0.5, s * 0.55, s * 0.15, 0.6, 0, 7); g.fill();
  g.strokeStyle = "#fecaca99"; g.lineWidth = 2; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x - s * 0.2 + i * 6, y - s * 0.4); g.lineTo(x + s * 0.4 + i * 6, y + s * 0.3); g.stroke(); }
}
function drawDark(T) {
  if (!me) return; const vis = curVis(); if (vis > 50) { g.fillStyle = "#0b1a3a33"; g.fillRect(0, 0, W, H); return; }
  dg.globalCompositeOperation = "source-over"; dg.clearRect(0, 0, W, H); dg.fillStyle = "rgba(4,7,18,0.94)"; dg.fillRect(0, 0, W, H);
  dg.globalCompositeOperation = "destination-out";
  const hole = (x, y, r, a = 1) => { const gr = dg.createRadialGradient(x, y, r * 0.35, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, "rgba(0,0,0,0)"); dg.fillStyle = gr; dg.beginPath(); dg.arc(x, y, r, 0, 7); dg.fill(); };
  hole(sx(me.x), sy(me.y), vis * SC);
  for (const [x, y] of LANTERNS) hole(sx(x), sy(y - 1.3), SC * 2.6, 0.75);
  for (const o of RECTS) if (o.k === "house") for (const wx of [0.18, 0.72]) hole(sx(o.x + o.w * wx + 0.35), sy(o.y + o.h * 0.58 + 0.3), SC * 1.3, 0.6);
  g.drawImage(dark, 0, 0, W, H);
  // lueur chaude des lanternes et des fenêtres
  g.globalCompositeOperation = "lighter";
  for (const [x, y] of LANTERNS) { const flick = 0.85 + Math.sin(T / 120 + x) * 0.08; const gr = g.createRadialGradient(sx(x), sy(y - 1.3), 2, sx(x), sy(y - 1.3), SC * 2.2 * flick); gr.addColorStop(0, "rgba(251,191,36,.35)"); gr.addColorStop(1, "rgba(251,191,36,0)"); g.fillStyle = gr; g.fillRect(sx(x) - SC * 3, sy(y - 1.3) - SC * 3, SC * 6, SC * 6); }
  g.globalCompositeOperation = "source-over";
  // brouillard
  const s = st(); if (s && T < s.fogUntil) { g.fillStyle = "rgba(148,163,184,.18)"; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse((i * 211 + T / 30) % (W + 300) - 150, (i * 137) % H, 220, 60, 0, 0, 7); g.fill(); } }
  // lucioles
  for (let i = 0; i < 14; i++) { const fx = sx(10 + (i * 41) % 44 + Math.sin(T / 1400 + i) * 2), fy = sy(8 + (i * 23) % 30 + Math.cos(T / 1700 + i) * 2); if (Math.sin(T / 400 + i * 2) > 0.3) { g.fillStyle = "rgba(190,242,100,.8)"; g.beginPath(); g.arc(fx, fy, 2, 0, 7); g.fill(); } }
}

// petite carte : le village, tes tâches et toi
function minimap(T) {
  const w = Math.min(170, W * 0.28), k = w / MW, h = MH * k, x0 = W - w - 12, y0 = isTouch ? 64 : 66;
  g.fillStyle = "#0b1020d9"; g.fillRect(x0 - 4, y0 - 4, w + 8, h + 8); g.strokeStyle = "#2d3a5e"; g.lineWidth = 1; g.strokeRect(x0 - 4, y0 - 4, w + 8, h + 8);
  g.fillStyle = "#1c3326"; g.fillRect(x0, y0, w, h); g.fillStyle = "#57483a"; g.beginPath(); g.arc(x0 + 32 * k, y0 + 22 * k, 5 * k, 0, 7); g.fill();
  for (const o of RECTS) { g.fillStyle = o.k === "house" ? "#a16207" : "#78716c"; g.fillRect(x0 + o.x * k, y0 + o.y * k, o.w * k, o.h * k); }
  const s = st(); for (const t of (s.tasks[me.id] || []).filter(t => !myDone.includes(t))) { const p = STATIONS[t]; g.fillStyle = Math.sin(T / 250) > 0 ? "#fde047" : "#ca8a04"; g.beginPath(); g.arc(x0 + p.x * k, y0 + p.y * k, 3, 0, 7); g.fill(); }
  g.fillStyle = "#c084fc"; g.fillRect(x0 + BELL.x * k - 2, y0 + BELL.y * k - 2, 4, 4);
  g.fillStyle = "#fff"; g.beginPath(); g.arc(x0 + me.x * k, y0 + me.y * k, 3.5, 0, 7); g.fill(); g.strokeStyle = me.color; g.lineWidth = 2; g.stroke();
}
/* ---------- boucle ---------- */
let last = performance.now(), lastTick = performance.now();
function tick(dt) {
  lastTick = performance.now();
  if ((mode === "solo" || mode === "mp") && st() && people.length) {
    const s = st(), T = clock();
    phaseWatch();
    if (me && s.phase === "play" && T >= s.at && $("#meet").hidden) {
      let dx = mv.x + (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyA") || keys.has("KeyQ") ? 1 : 0);
      let dy = mv.y + (keys.has("ArrowDown") || keys.has("KeyS") ? 1 : 0) - (keys.has("ArrowUp") || keys.has("KeyW") || keys.has("KeyZ") ? 1 : 0);
      if (dx || dy) { move(me, dx, dy, dt, SPEED * (me.ghost ? 1.2 : 1)); if (task && Math.hypot(dx, dy) > 0.3 && STATIONS[task.id].kind === "hold") { /* on peut bouger un peu */ } }
      taskTick(dt);
    }
    if (mode === "solo") { for (const p of people) if (p.bot && !isDead(p.id)) botTick(p, dt); hostTick(); }
    if (mode === "mp") { syncRemote(dt); liveT += dt; if (liveT > 0.09) { liveT = 0; writeLive(); } if (X.isHost()) hostTick(); }
    hud(); meetUI();
    if (me) { camX += (me.x - camX) * Math.min(1, dt * 8); camY += (me.y - camY) * Math.min(1, dt * 8); }
  }
  if (fl > 0) { fl -= dt; if (fl <= 0) { $("#banner").textContent = ""; $("#sub").textContent = ""; } }
}
function draw() {
  const d = devicePixelRatio || 1, T = clock(); g.setTransform(d, 0, 0, d, 0, 0);
  g.fillStyle = "#0b1020"; g.fillRect(0, 0, W, H);
  drawWorld(T); drawDark(T);
  if (me && mode !== "menu") minimap(T);
  if (mode === "menu") { g.fillStyle = "rgba(4,7,18,.55)"; g.fillRect(0, 0, W, H); camX = 32 + Math.sin(T / 9000) * 8; camY = 22 + Math.cos(T / 11000) * 5; }
}
function frame(t) { const dt = Math.min(0.05, (t - last) / 1000); last = t; tick(dt); draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
setInterval(() => { const t = performance.now(); if (t - lastTick > 400 && mode === "mp") tick(Math.min(0.1, (t - lastTick) / 1000)); }, 300);
window.GAROU = { get S() { return st(); }, get me() { return me; }, get people() { return people; }, soloStart, press, act: e => act(e), get myDone() { return myDone; }, tp: (x, y) => { if (me) { me.x = x; me.y = y; } }, STATIONS, BELL, keys, villageProgress };
}
