"use strict";
{
const snd = n => window.SFX && window.SFX.play(n); let lastSec = 0;
const $ = s => document.querySelector(s), cv = $("#cv"), g = cv.getContext("2d");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DRAW_T = 80000, CHOOSE_T = 15000, REVEAL_T = 6000;
const COLS = ["#111111", "#ffffff", "#ef4444", "#f97316", "#facc15", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#92400e", "#9ca3af"];
const SIZES = [[4, "Fin"], [10, "Moyen"], [24, "Gros"]];
const L = window.LOBBY, X = L.ctx, WORDS = window.WORDS || ["chat"];
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/[^a-z0-9]+/g, " ").trim().replace(/^(le|la|les|l|un|une|des|du) /, "");
const fnv = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const hashOf = (w, turn) => fnv(`${X.code}|${turn}|${norm(w)}`);

let on = false, turn = -1, word = "", choices = [], found = new Set(), hints = {}, myPts = 0, drawerPts = 0, revealed = "", seenDraw = new Set(), strokesSeen = 0;
let color = COLS[0], size = 10, eraser = false;
const st = () => X.state || {};
const amDrawer = () => on && st().drawer === X.uid;
const nameOf = id => (X.players[id] || X.score[id] || {}).pseudo || "?";

/* ---------- dessin local + envoi ---------- */
let drawing = false, pts = [], lastSent = null, sendT = null;
function seg(c, w, arr) { if (arr.length < 2) return; g.strokeStyle = c; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(arr[0], arr[1]); if (arr.length === 2) g.lineTo(arr[0] + 0.1, arr[1]); for (let i = 2; i < arr.length; i += 2) g.lineTo(arr[i], arr[i + 1]); g.stroke(); }
function clearBoard() { g.fillStyle = "#fff"; g.fillRect(0, 0, 1000, 750); }
clearBoard();
function pos(e) { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / r.width * 1000), Math.round((e.clientY - r.top) / r.height * 750)]; }
function flush() {
  if (pts.length < 2) return;
  const arr = lastSent ? lastSent.concat(pts) : pts;
  X.push("draw", { turn, c: eraser ? "#ffffff" : color, w: eraser ? 36 : size, p: arr });
  lastSent = pts.slice(-2); pts = [];
}
cv.addEventListener("pointerdown", e => { if (!amDrawer() || st().phase !== "draw") return; e.preventDefault(); cv.setPointerCapture(e.pointerId); drawing = true; lastSent = null; const p = pos(e); pts = [...p]; seg(eraser ? "#fff" : color, eraser ? 36 : size, p); sendT = setInterval(flush, 90); });
cv.addEventListener("pointermove", e => { if (!drawing) return; const p = pos(e), n = pts.length; const prev = n ? [pts[n - 2], pts[n - 1]] : lastSent; if (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) < 3) return; seg(eraser ? "#fff" : color, eraser ? 36 : size, prev ? [...prev, ...p] : p); pts.push(...p); });
const stop = () => { if (!drawing) return; drawing = false; clearInterval(sendT); flush(); lastSent = null; };
cv.addEventListener("pointerup", stop); cv.addEventListener("pointercancel", stop);
function tools() {
  $("#tools").hidden = !(amDrawer() && st().phase === "draw");
  $("#tools").innerHTML = COLS.map(c => `<button class="sw" style="background:${c}" data-c="${c}" aria-label="Couleur ${c}" aria-pressed="${!eraser && c === color}"></button>`).join("")
    + SIZES.map(([s, n]) => `<button class="tool" data-s="${s}" aria-pressed="${!eraser && s === size}">${n}</button>`).join("")
    + `<button class="tool" id="eraser" aria-pressed="${eraser}">Gomme</button><button class="tool" id="wipe">Tout effacer</button>`;
  document.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { color = b.dataset.c; eraser = false; tools(); });
  document.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { size = +b.dataset.s; eraser = false; tools(); });
  $("#eraser").onclick = () => { eraser = true; tools(); };
  $("#wipe").onclick = () => { clearBoard(); X.push("draw", { turn, clear: true }); };
}

/* ---------- réception ---------- */
function onDraw(d, key) {
  if (!on || !d || seenDraw.has(key)) return; seenDraw.add(key);
  if (d.turn !== st().turn || d.from === X.uid) return;
  if (d.clear) clearBoard(); else seg(d.c, d.w, d.p || []);
}
function onChat(m, key) {
  if (!on || !m || m.turn !== st().turn) return;
  log(`<b style="color:${X.colorOf(m.from)}">${esc(m.pseudo)}</b> ${esc(m.text)}`);
}
function log(html, cls) { const d = document.createElement("div"); if (cls) d.className = cls; d.innerHTML = html; $("#log").appendChild(d); while ($("#log").children.length > 80) $("#log").firstChild.remove(); $("#log").scrollTop = 1e9; }
function onEvent(e) {
  if (!on || e.turn !== st().turn) return;
  if (e.type === "found" && !found.has(e.from)) {
    found.add(e.from); log(`${esc(nameOf(e.from))} a trouvé !`, "ok"); snd("ok");
    if (amDrawer()) { drawerPts += 25; myPts += 25; X.setScore({ pts: myPts }); }
    players();
  }
  if (e.type === "hint" && e.from === st().drawer) { hints[e.i] = e.ch; mask(); }
  if (e.type === "reveal") { revealed = e.word; overlay(); }
  if (e.type === "word" && X.isHost() && st().phase === "choose" && e.from === st().drawer) X.updState({ phase: "draw", hash: e.hash, shape: e.shape, endsAt: Math.round(X.now() + DRAW_T) });
}
$("#gf").onsubmit = e => {
  e.preventDefault(); const t = $("#gi").value.trim(); if (!t || !on) return; $("#gi").value = "";
  const s = st();
  if (amDrawer()) { if (norm(t).includes(norm(word))) { log("Tu ne peux pas écrire le mot !", "sys"); return; } X.push("chat", { turn: s.turn, text: t.slice(0, 60), pseudo: X.pseudo }); log(`<b style="color:${X.colorOf(X.uid)}">${esc(X.pseudo)}</b> ${esc(t)}`); return; }
  if (s.phase === "draw" && !found.has(X.uid) && s.hash && hashOf(t, s.turn) === s.hash) {
    const left = Math.max(0, s.endsAt - X.now()), bonus = [20, 10, 5][found.size] || 0, gain = Math.min(100, Math.round(30 + 50 * left / DRAW_T) + bonus);
    myPts += gain; X.setScore({ pts: myPts }); found.add(X.uid); X.ev({ type: "found", turn: s.turn });
    log(`Bravo, c'est ça ! +${gain} pts`, "ok"); snd("win"); players(); return;
  }
  if (found.has(X.uid) && s.phase === "draw") { log("Tu as déjà trouvé : pas d'indices pour les autres !", "sys"); return; }
  X.push("chat", { turn: s.turn, text: t.slice(0, 60), pseudo: X.pseudo }); log(`<b style="color:${X.colorOf(X.uid)}">${esc(X.pseudo)}</b> ${esc(t)}`);
};

/* ---------- déroulé ---------- */
function onState() {
  if (!on) return; const s = st();
  if (s.turn !== turn) newTurn(s);
  if (s.phase === "draw" && amDrawer() && !hintsPlanned) planHints(s);
  if (s.phase === "reveal" && amDrawer() && word && !revealSent) { revealSent = true; X.ev({ type: "reveal", turn: s.turn, word }); }
  mask(); overlay(); tools(); players();
}
let hintsPlanned = false, revealSent = false;
function newTurn(s) {
  snd(s.drawer === X.uid ? "ding" : "blip");
  turn = s.turn; found = new Set(); hints = {}; revealed = ""; word = ""; drawerPts = 0; hintsPlanned = false; revealSent = false; clearBoard(); eraser = false;
  if (s.drawer === X.uid) { const pool = WORDS.slice(); choices = []; while (choices.length < 3) { const w = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; choices.push(w); } }
  log(`${esc(nameOf(s.drawer))} dessine (${s.turn + 1} / ${s.total})`, "sys");
}
function choose(w) {
  const s = st(); if (!amDrawer() || s.phase !== "choose" || word) return;
  word = w; const shape = w.split("").map(c => /[a-zàâäçéèêëîïôöûüœ0-9]/i.test(c) ? "_" : c).join("");
  X.ev({ type: "word", turn: s.turn, hash: hashOf(w, s.turn), shape });
  overlay();
}
function planHints(s) {
  hintsPlanned = true; const idx = word.split("").map((c, i) => /[a-z]/i.test(norm(c)) ? i : -1).filter(i => i >= 0);
  const n = word.length >= 5 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const at = s.endsAt - DRAW_T + DRAW_T * (k ? 0.75 : 0.5), i = idx.splice(Math.floor(Math.random() * idx.length), 1)[0];
    if (i === undefined) continue;
    setTimeout(() => { const c = st(); if (c.turn === s.turn && c.phase === "draw") X.ev({ type: "hint", turn: s.turn, i, ch: word[i] }); }, Math.max(0, at - X.now()));
  }
}
function mask() {
  const s = st();
  if (!on) return;
  $("#who").textContent = s.phase === "choose" ? `${nameOf(s.drawer)} choisit un mot…` : amDrawer() ? "À toi de dessiner :" : `${nameOf(s.drawer)} dessine`;
  if (amDrawer() && word) $("#mask").textContent = word.toUpperCase();
  else if (s.shape) $("#mask").textContent = s.shape.split("").map((c, i) => hints[i] ? hints[i].toUpperCase() : c).join(" ").replace(/ {3}/g, "   ");
  else $("#mask").textContent = "";
}
function overlay() {
  const s = st(), o = $("#over");
  if (s.phase === "choose" && amDrawer() && !word) { o.hidden = false; o.innerHTML = `<div><h2>CHOISIS TON MOT</h2>${choices.map((w, i) => `<button class="choice" data-i="${i}">${esc(w)}</button>`).join("")}<p>Tu as 15 secondes.</p></div>`; o.querySelectorAll(".choice").forEach(b => b.onclick = () => choose(choices[+b.dataset.i])); }
  else if (s.phase === "choose") { o.hidden = false; o.innerHTML = `<div><h2>${esc(nameOf(s.drawer))}</h2><p>choisit un mot…</p></div>`; if (amDrawer()) o.hidden = true; }
  else if (s.phase === "reveal") { o.hidden = false; o.innerHTML = `<div><h2>LE MOT ÉTAIT</h2><p style="font:800 28px Inter;color:#fff">${esc((revealed || (amDrawer() ? word : "") || "…").toUpperCase())}</p><p>${found.size ? `${found.size} collègue${found.size > 1 ? "s ont" : " a"} trouvé` : "Personne n'a trouvé !"}</p></div>`; }
  else o.hidden = true;
}
function players() {
  const s = st(), ids = (s.roster || []).filter(id => X.players[id] || X.score[id]);
  const rows = ids.map(id => ({ id, n: nameOf(id), p: (X.score[id] || {}).pts || 0 })).sort((a, b) => b.p - a.p);
  $("#plist").innerHTML = rows.map(r => `<div class="pl${found.has(r.id) ? " found" : ""}${r.id === s.drawer ? " draw" : ""}"><span style="width:10px;height:10px;border-radius:50%;background:${X.colorOf(r.id)}"></span><b>${esc(r.n)}${r.id === X.uid ? " (toi)" : ""}</b>${r.id === s.drawer ? `<span title="Dessine">✎</span>` : ""}<span class="pts">${r.p}</span></div>`).join("");
}
function hostTick() {
  if (!X.isHost()) return; const s = st(); if (!s.roster) return; const T = X.now();
  const present = id => !!X.players[id];
  if (s.phase === "choose" && (T > s.endsAt + 4000 || !present(s.drawer))) next(s);
  else if (s.phase === "draw") {
    const guessers = s.roster.filter(id => present(id) && id !== s.drawer);
    if (T > s.endsAt || !present(s.drawer) || (guessers.length && guessers.every(id => found.has(id)))) X.updState({ phase: "reveal", endsAt: Math.round(T + REVEAL_T) });
  } else if (s.phase === "reveal" && T > s.endsAt) next(s);
}
function next(s) {
  let t = s.turn + 1; while (t < s.total && !X.players[s.roster[t % s.roster.length]]) t++;
  const alive = s.roster.filter(id => X.players[id]);
  if (t >= s.total || alive.length < 2) { const top = Object.entries(X.score).sort((a, b) => (b[1].pts || 0) - (a[1].pts || 0))[0]; X.end({ winner: top ? top[0] : "" }); return; }
  X.clear("draw"); X.clear("chat");
  X.setState(Object.assign({}, s, { turn: t, drawer: s.roster[t % s.roster.length], phase: "choose", endsAt: Math.round(X.now() + CHOOSE_T), hash: "", shape: "" }));
}
function loop() {
  if (on) {
    const s = st(), left = Math.max(0, (s.endsAt || 0) - X.now()), tot = s.phase === "draw" ? DRAW_T : s.phase === "choose" ? CHOOSE_T : REVEAL_T;
    $("#clock").textContent = s.phase ? Math.ceil(left / 1000) : ""; { const sec = Math.ceil(left / 1000); if (s.phase === "draw" && sec <= 10 && sec > 0 && sec !== lastSec) snd("tick"); lastSec = sec; } $("#bar i").style.width = `${Math.min(100, left / tot * 100)}%`;
    if (s.phase === "choose" && amDrawer() && !word && left <= 0 && choices.length) choose(choices[0]);
    hostTick();
  }
}
setInterval(loop, 250);

/* ---------- salon ---------- */
L.init({
  id: "dessin", title: "Dessine et devine", min: 2, max: 10,
  initState: (ctx) => { const roster = Object.entries(ctx.players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)).map(x => x[0]); return { roster, total: roster.length * (roster.length <= 3 ? 2 : 1), turn: 0, drawer: roster[0], phase: "choose", endsAt: Math.round(ctx.now() + CHOOSE_T), hash: "", shape: "" }; },
  onStart(ctx) {
    on = true; turn = -1; myPts = 0; seenDraw = new Set(); $("#log").innerHTML = ""; $("#panel").hidden = true; ctx.setScore({ pts: 0 });
    if (!subbed) { subbed = true; ctx.sub("draw", onDraw, 3000); ctx.sub("chat", onChat, 60); }
    onState();
  },
  onState, onEvent, onPlayers: () => on && players(),
  onEnd(ctx) {
    on = false; const top = Object.entries(ctx.score).sort((a, b) => (b[1].pts || 0) - (a[1].pts || 0)), won = top[0] && top[0][0] === ctx.uid && (top[0][1].pts || 0) > 0;
    if (window.ONLINE) window.ONLINE.submit("dessin", gm => Object.assign(gm, { points: (gm.points || 0) + myPts, wins: (gm.wins || 0) + (won ? 1 : 0), games: (gm.games || 0) + 1 }));
    $("#tools").hidden = true; $("#over").hidden = true;
  },
  onStop() { on = false; },
  results(ctx) {
    const rows = Object.entries(ctx.score).sort((a, b) => (b[1].pts || 0) - (a[1].pts || 0));
    const w = rows[0];
    return `<h1>${w ? esc(w[1].pseudo) + " gagne !" : "Fin"}</h1><table><tr><th>#</th><th>Joueur</th><th class="n">Points</th></tr>${rows.map(([id, s], i) => `<tr style="${id === ctx.uid ? "color:#facc15" : ""}"><td>${i + 1}</td><td>${esc(s.pseudo)}</td><td class="n">${s.pts || 0}</td></tr>`).join("")}</table>`;
  },
  onBack() { $("#panel").hidden = false; }
});
let subbed = false;
$("#multi").onclick = () => { $("#panel").hidden = true; L.menu(); };
window.DESSIN = { get word() { return word; }, get choices() { return choices; }, choose: i => choose(choices[i]), get found() { return found; }, get pts() { return myPts; }, st, seg, hashOf, norm };
}
