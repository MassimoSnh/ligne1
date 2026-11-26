"use strict";
{
const $ = s => document.querySelector(s);
const V = window.VOLT, LV = window.VOLT_LEVELS, TS = V.TS, W = V.COLS * TS, H = V.ROWS * TS;
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const progress = store.get("volt-progress") || { stars: {}, best: {}, unlockAll: false };
progress.stars = progress.stars || {}; progress.best = progress.best || {};
const saveProgress = () => store.set("volt-progress", progress);
const unlocked = n => progress.unlockAll || n === 1 || progress.best[n - 1] || progress.stars[n - 1] !== undefined;
const points = (n, stars, t) => { const par = LV[n - 1].par; return stars * 100 + 50 + Math.max(0, Math.round(100 * (2 * par - t) / (2 * par))); };

/* ---------- carte des niveaux ---------- */
function renderMap() {
  const tot = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  $("#vtotal").innerHTML = `<span>★</span> ${tot} / ${LV.length * 3}`;
  $("#grid").innerHTML = LV.map((l, i) => {
    const n = i + 1, st = progress.stars[n] || 0, ok = unlocked(n), b = progress.best[n];
    return `<button class="lv${b ? " done" : ""}${ok ? "" : " locked"}" data-n="${n}" ${ok ? "" : "disabled"}>
      <span class="num">${n}</span><span class="nm">${l.name}</span><span class="st" aria-label="${st} étoiles">${"★".repeat(st)}${"☆".repeat(3 - st)}</span>
      <span class="bt">${b ? `${b.t.toFixed(2)} s · ${b.pts} pts` : ok ? "à jouer" : "verrouillé"}</span></button>`;
  }).join("");
}
$("#grid").addEventListener("click", e => { const b = e.target.closest("[data-n]"); if (b) location.hash = "niveau-" + b.dataset.n; });
$("#unlock").addEventListener("click", () => { progress.unlockAll = true; saveProgress(); renderMap(); });

/* ---------- partie ---------- */
let cur = 0, L = null, S = null, deaths = 0, fx = [], trail = [], deadT = 0, endShown = false, paused = false, prevGot = 0;
const input = { h: 0, v: 0, jump: false, dash: false };
const keys = new Set(), touch = { h: 0, v: 0, jump: false, dash: false };
function open(n) {
  cur = n; L = V.parse(LV[n - 1].map); deaths = 0; endShown = false; paused = false;
  $("#lname").textContent = `${n}. ${LV[n - 1].name}`; $("#tip").textContent = LV[n - 1].tip; $("#end").hidden = true;
  respawn(); fit();
}
function respawn() { S = V.newState(L); fx = []; trail = []; deadT = 0; prevGot = 0; }
function hud() {
  $("#hstars").textContent = `${"★".repeat(popc(S.got))}${"☆".repeat(L.stars.length - popc(S.got))}`;
  $("#htime").textContent = `${S.t.toFixed(2)} s`; $("#hdeaths").textContent = `${deaths} mort${deaths > 1 ? "s" : ""}`;
}
const popc = n => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };
function finish() {
  endShown = true; const st = popc(S.got), t = S.t, pts = points(cur, st, t);
  const old = progress.best[cur], better = !old || pts > old.pts;
  progress.stars[cur] = Math.max(progress.stars[cur] || 0, st);
  if (better) progress.best[cur] = { t: +t.toFixed(2), pts };
  saveProgress();
  if (window.ONLINE) window.ONLINE.report("volt", cur, progress.stars[cur], progress.best[cur].pts, progress.best[cur].t);
  $("#end").hidden = false;
  $("#end").innerHTML = `<h2>Niveau terminé !</h2><div class="bigstars">${"★".repeat(st)}${"☆".repeat(3 - st)}</div>
    <p>${t.toFixed(2)} s · ${deaths} mort${deaths > 1 ? "s" : ""} · <b>${pts} points</b>${better && old ? " · nouveau record !" : ""}</p>
    ${st < 3 ? `<p class="small">Il manque ${3 - st} étoile${3 - st > 1 ? "s" : ""} : il faut toutes les attraper dans la même vie.</p>` : ""}
    <div class="row"><button class="ghost" data-go="r">Rejouer (R)</button>${cur < LV.length ? `<button class="cta" data-go="n">Niveau suivant</button>` : ""}<button class="ghost" data-go="m">Niveaux</button></div>`;
}
$("#end").addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (!b) return; const g = b.dataset.go; if (g === "r") open(cur); else if (g === "n") location.hash = "niveau-" + (cur + 1); else location.hash = "niveaux"; });

/* ---------- entrées ---------- */
const KMAP = { ArrowLeft: "l", KeyA: "l", KeyQ: "l", ArrowRight: "r", KeyD: "r", ArrowUp: "u", KeyW: "u", KeyZ: "u", ArrowDown: "d", KeyS: "d", Space: "j", KeyC: "j", KeyK: "j", KeyX: "x", ShiftLeft: "x", ShiftRight: "x", KeyJ: "x" };
addEventListener("keydown", e => {
  if ($("#vgame").hidden) return;
  if (e.code === "KeyR") { open(cur); return; }
  if (e.code === "Escape" || e.code === "KeyP") { paused = !paused; return; }
  if (KMAP[e.code]) { keys.add(KMAP[e.code]); e.preventDefault(); }
});
addEventListener("keyup", e => { if (KMAP[e.code]) keys.delete(KMAP[e.code]); });
addEventListener("blur", () => keys.clear());
function readInput() {
  input.h = (keys.has("r") ? 1 : 0) - (keys.has("l") ? 1 : 0) || touch.h;
  input.v = (keys.has("d") ? 1 : 0) - (keys.has("u") ? 1 : 0) || touch.v;
  input.jump = keys.has("j") || touch.jump; input.dash = keys.has("x") || touch.dash;
}
// tactile : joystick à gauche, boutons à droite
const pad = $("#pad"), knob = $("#knob"); let padId = null, pc = null;
pad.addEventListener("pointerdown", e => { e.preventDefault(); padId = e.pointerId; pad.setPointerCapture(e.pointerId); const r = pad.getBoundingClientRect(); pc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; movePad(e); });
pad.addEventListener("pointermove", e => { if (e.pointerId === padId) movePad(e); });
const endPad = e => { if (e.pointerId !== padId) return; padId = null; touch.h = 0; touch.v = 0; knob.style.transform = ""; };
pad.addEventListener("pointerup", endPad); pad.addEventListener("pointercancel", endPad);
function movePad(e) {
  const dx = e.clientX - pc.x, dy = e.clientY - pc.y, d = Math.hypot(dx, dy), m = Math.min(d, 46), a = Math.atan2(dy, dx);
  knob.style.transform = `translate(${Math.cos(a) * m}px,${Math.sin(a) * m}px)`;
  if (d < 14) { touch.h = 0; touch.v = 0; return; }
  const sec = Math.round(a / (Math.PI / 4)); const dirs = { 0: [1, 0], 1: [1, 1], 2: [0, 1], 3: [-1, 1], 4: [-1, 0], "-4": [-1, 0], "-3": [-1, -1], "-2": [0, -1], "-1": [1, -1] };
  [touch.h, touch.v] = dirs[sec];
}
for (const [id, k] of [["#bjump", "jump"], ["#bdash", "dash"]]) {
  const b = $(id);
  b.addEventListener("pointerdown", e => { e.preventDefault(); b.setPointerCapture(e.pointerId); touch[k] = true; b.classList.add("on"); });
  const up = () => { touch[k] = false; b.classList.remove("on"); };
  b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("lostpointercapture", up);
}
$("#restart").addEventListener("click", () => open(cur));
$("#back").addEventListener("click", () => { location.hash = "niveaux"; });

/* ---------- rendu ---------- */
const cv = $("#cv"), g = cv.getContext("2d");
function fit() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d); g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); }
new ResizeObserver(fit).observe(cv);
const ch = (x, y) => V.tileAt(L, S, x, y);
function star(x, y, r, rot, col) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fillStyle = col; g.fill(); }
function draw() {
  const t = performance.now() / 1000;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#151a36"); bg.addColorStop(1, "#2a1f4a"); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#ffffff0a"; g.lineWidth = 2; for (let i = 0; i < 9; i++) { g.beginPath(); const y = 40 + i * 60; g.moveTo(0, y); g.lineTo(200 + i * 40, y); g.lineTo(240 + i * 40, y + 40); g.lineTo(W, y + 40); g.stroke(); }
  for (let y = 0; y < V.ROWS; y++) for (let x = 0; x < V.COLS; x++) {
    const c = L.rows[y][x], X = x * TS, Y = y * TS;
    if (c === "#") {
      g.fillStyle = "#3b4363"; g.fillRect(X, Y, TS, TS); g.fillStyle = "#2d3350"; g.fillRect(X + 2, Y + 2, TS - 4, TS - 4);
      if (y === 0 || L.rows[y - 1][x] !== "#") { g.fillStyle = "#7dd3fc"; g.fillRect(X, Y, TS, 3); }
    } else if (c === "c") {
      const i = L.crumbles.findIndex(k => k.x === x && k.y === y), b = S.cb[i];
      if (b.off > 0) { g.strokeStyle = "#a1622f55"; g.strokeRect(X + 2, Y + 2, TS - 4, TS - 4); }
      else { const sh = b.t >= 0 ? (Math.random() - 0.5) * 3 : 0; g.fillStyle = "#a1622f"; g.fillRect(X + sh, Y, TS, TS); g.strokeStyle = "#5b3416"; g.lineWidth = 2; g.beginPath(); g.moveTo(X + 6 + sh, Y + 4); g.lineTo(X + 12 + sh, Y + 12); g.lineTo(X + 8 + sh, Y + 20); g.moveTo(X + 12 + sh, Y + 12); g.lineTo(X + 19 + sh, Y + 9); g.stroke(); }
    } else if (c === "-") { g.fillStyle = "#94a3b8"; g.fillRect(X, Y, TS, 5); g.fillStyle = "#64748b"; g.fillRect(X + 2, Y + 5, 3, 4); g.fillRect(X + TS - 5, Y + 5, 3, 4); }
    else if ("^v<>".includes(c)) {
      g.fillStyle = "#f43f5e"; g.beginPath();
      for (let k = 0; k < 3; k++) {
        const o = k * 8;
        if (c === "^") { g.moveTo(X + o, Y + TS); g.lineTo(X + o + 4, Y + 10); g.lineTo(X + o + 8, Y + TS); }
        if (c === "v") { g.moveTo(X + o, Y); g.lineTo(X + o + 4, Y + 14); g.lineTo(X + o + 8, Y); }
        if (c === ">") { g.moveTo(X, Y + o); g.lineTo(X + 14, Y + o + 4); g.lineTo(X, Y + o + 8); }
        if (c === "<") { g.moveTo(X + TS, Y + o); g.lineTo(X + 10, Y + o + 4); g.lineTo(X + TS, Y + o + 8); }
      }
      g.fill();
    } else if (c === "s") { const k = S.spring > 0 && Math.abs(S.x - (X + 12)) < 30 ? 6 : 0; g.fillStyle = "#64748b"; g.fillRect(X + 2, Y + TS - 6, TS - 4, 6); g.strokeStyle = "#facc15"; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(X + 5, Y + TS - 6 - i * (4 - k / 6) - 2); g.lineTo(X + TS - 5, Y + TS - 6 - i * (4 - k / 6) - 4); } g.stroke(); g.fillStyle = "#facc15"; g.fillRect(X + 2, Y + 8 + k, TS - 4, 5); }
    else if (c === "E") { g.fillStyle = "#14532d"; g.fillRect(X + 2, Y - TS + 4, TS - 4, TS * 2 - 4); g.fillStyle = `rgba(74,222,128,${0.5 + 0.3 * Math.sin(t * 4)})`; g.fillRect(X + 6, Y - TS + 8, TS - 12, TS * 2 - 10); }
  }
  L.crystals.forEach((c, i) => { const on = S.cr[i] <= 0, y = c.y + Math.sin(t * 3 + i) * 2; g.fillStyle = on ? "#4ade80" : "#4ade8033"; g.beginPath(); g.moveTo(c.x, y - 10); g.lineTo(c.x + 7, y); g.lineTo(c.x, y + 10); g.lineTo(c.x - 7, y); g.fill(); if (on) { g.fillStyle = "#dcfce7"; g.fillRect(c.x - 1, y - 5, 2, 6); } });
  L.stars.forEach((s, i) => { if (S.got & (1 << i)) return; g.fillStyle = "#fde04722"; g.beginPath(); g.arc(s.x, s.y, 16, 0, 7); g.fill(); star(s.x, s.y + Math.sin(t * 2 + i) * 2, 10, t * 1.5, "#fde047"); });
  trail.forEach(p => { g.globalAlpha = p.a; g.fillStyle = "#60a5fa"; g.fillRect(p.x - 7, p.y - 20, 14, 20); }); g.globalAlpha = 1;
  if (!S.dead) {
    const px = Math.round(S.x), py = Math.round(S.y);
    g.fillStyle = "#e2e8f0"; g.fillRect(px - 7, py - 18, 14, 14); g.fillStyle = "#475569"; g.fillRect(px - 6, py - 4, 4, 4); g.fillRect(px + 2, py - 4, 4, 4);
    g.fillStyle = "#0f172a"; g.fillRect(px - 5 + S.face * 2, py - 15, 10, 6); g.fillStyle = S.dashOK ? "#facc15" : "#38bdf8"; g.fillRect(px - 3 + S.face * 3, py - 14, 2, 3); g.fillRect(px + 1 + S.face * 3, py - 14, 2, 3);
    g.fillStyle = "#94a3b8"; g.fillRect(px - 1, py - 24, 2, 6); g.fillStyle = S.dashOK ? "#facc15" : "#38bdf8"; g.beginPath(); g.arc(px, py - 25, 3.5, 0, 7); g.fill();
    if (S.dashOK) { g.fillStyle = "#facc1533"; g.beginPath(); g.arc(px, py - 25, 7, 0, 7); g.fill(); }
  }
  fx.forEach(p => { g.globalAlpha = Math.max(0, p.l); g.fillStyle = p.c; g.fillRect(p.x - 2, p.y - 2, 4, 4); }); g.globalAlpha = 1;
  if (paused) { g.fillStyle = "#000a"; g.fillRect(0, 0, W, H); g.fillStyle = "#fff"; g.font = "800 40px 'Inter Tight',sans-serif"; g.textAlign = "center"; g.fillText("PAUSE", W / 2, H / 2); }
}

/* ---------- boucle ---------- */
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!$("#vgame").hidden && S) {
    if (!paused && !endShown) {
      acc += dt;
      while (acc >= V.DT) {
        acc -= V.DT; readInput();
        if (S.dead) { deadT += V.DT; if (deadT > 0.45) respawn(); }
        else { const pvy = S.vy, pd = S.dashT || 0; V.step(L, S, input); if (window.SFX) { if ((S.dashT || 0) > 0 && !(pd > 0)) window.SFX.play("dash"); else if (S.vy < pvy - 120 && S.vy < 0) window.SFX.play("jump"); if (S.dead) window.SFX.play("die"); if (S.got !== prevGot) window.SFX.play("coin"); if (S.won) window.SFX.play("win"); } if (S.dashT > 0) trail.push({ x: S.x, y: S.y, a: 0.5 }); if (S.dead) { deaths++; for (let i = 0; i < 24; i++) fx.push({ x: S.x, y: S.y - 10, vx: Math.cos(i) * (80 + i * 6), vy: Math.sin(i) * (80 + i * 6), l: 1, c: i % 2 ? "#facc15" : "#e2e8f0" }); } if (S.got !== prevGot) { const i = Math.log2(S.got ^ prevGot) | 0, s = L.stars[i]; if (s) for (let k = 0; k < 14; k++) fx.push({ x: s.x, y: s.y, vx: Math.cos(k) * 120, vy: Math.sin(k) * 120, l: 0.8, c: "#fde047" }); } prevGot = S.got; if (S.won) finish(); }
        trail.forEach(p => p.a -= V.DT * 2.5); trail = trail.filter(p => p.a > 0);
        fx.forEach(p => { p.x += p.vx * V.DT; p.y += p.vy * V.DT; p.vy += 400 * V.DT; p.l -= V.DT * 1.5; }); fx = fx.filter(p => p.l > 0);
      }
    }
    draw(); hud();
  }
  requestAnimationFrame(frame);
}

/* ---------- routes ---------- */
function route() {
  const m = /^#niveau-(\d+)$/.exec(location.hash), n = m ? +m[1] : 0;
  if (n >= 1 && n <= LV.length && unlocked(n)) { $("#vmap").hidden = true; $("#vgame").hidden = false; open(n); window.scrollTo(0, 0); }
  else { $("#vgame").hidden = true; $("#vmap").hidden = false; renderMap(); }
}
addEventListener("hashchange", route);
window.APP = { game: "volt", progress, saveProgress, refresh: () => { if (!$("#vmap").hidden) renderMap(); } };
route(); requestAnimationFrame(frame);
window.VOLT_GAME = { open, get S() { return S; }, get L() { return L; }, input, finish, set paused(v) { paused = v; } };
}
