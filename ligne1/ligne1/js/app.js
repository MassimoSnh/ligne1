"use strict";
{
const $ = s => document.querySelector(s);
const LV = window.LEVELS;
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const TARGETS = window.TARGETS || {};
let prog = [], cur = 0, speed = 1, hist = [], view = store.get("l1v2-view") || "iso", isoOn = false;
const progress = store.get("l1v2-progress") || { stars: {}, unlockAll: false };
const saveProgress = () => store.set("l1v2-progress", progress);
const pkey = n => "l1v2-prog-" + n;
const W = () => SIM.W;
const contacts = () => prog.reduce((n, r) => n + r.blocks.reduce((m, b) => m + b.length, 0), 0);
const target = n => TARGETS[n] || { t: 60, c: 10 };

/* ---------- carte ---------- */
function unlocked(n) { if (progress.unlockAll || n === 1) return true; return !!progress.stars[n - 1]; }
function renderMap() {
  const tot = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  $("#total").innerHTML = `<span>★</span> ${tot} / 60`;
  const cols = matchMedia("(max-width:600px)").matches ? 3 : 4;
  $("#map").querySelectorAll(".node").forEach(n => n.remove());
  LV.forEach((l, i) => {
    const row = Math.floor(i / cols), col = row % 2 ? cols - 1 - (i % cols) : i % cols, st = progress.stars[l.n] || 0, ok = unlocked(l.n);
    const b = document.createElement("button");
    b.className = "node" + (st ? " done" : "") + (ok ? "" : " locked"); b.style.gridRow = row + 1; b.style.gridColumn = col + 1;
    b.innerHTML = `<span class="dot">${l.n}</span><span class="st" aria-label="${st} étoiles">${"★".repeat(st)}${"☆".repeat(3 - st)}</span><span class="nm">${l.title}</span><span class="hl">${ok ? l.hall : "verrouillé"}</span>`;
    b.disabled = !ok; b.addEventListener("click", () => { location.hash = "niveau-" + l.n; });
    $("#map").appendChild(b);
  });
  requestAnimationFrame(drawPath);
}
function drawPath() {
  const m = $("#map"), r0 = m.getBoundingClientRect(), pts = [...m.querySelectorAll(".node .dot")].map(d => { const r = d.getBoundingClientRect(); return [r.left - r0.left + r.width / 2, r.top - r0.top + r.height / 2]; });
  const order = LV.map((l, i) => pts[i]);
  $("#mapsvg").setAttribute("viewBox", `0 0 ${r0.width} ${r0.height}`);
  $("#mapsvg").innerHTML = `<polyline points="${order.map(p => p.join(",")).join(" ")}" fill="none" stroke="#f2b70588" stroke-width="10" stroke-linejoin="round" stroke-dasharray="2 16" stroke-linecap="round"/>`;
}
const mro = new ResizeObserver(() => { if (!$("#vmap").hidden) drawPath(); }); mro.observe($("#map"));
$("#unlock").addEventListener("click", () => { progress.unlockAll = true; saveProgress(); renderMap(); });

/* ---------- niveau ---------- */
function openLevel(n) {
  cur = n; const l = LV[n - 1];
  prog = store.get(pkey(n)) || []; hist = [];
  SIM.build(l); isoOn = SIM.isoOK(l);
  $("#lvn").textContent = `Niveau ${n} / 20 · ${l.hall}`; $("#ltitle").textContent = l.title;
  const tg = target(n);
  $("#brief").innerHTML = `<h2>Le client</h2><p>${l.client}</p><h3>Cahier des charges</h3><ol>${l.goals.map(g => `<li>${g}</li>`).join("")}</ol>
    <div class="goalstars"><b>★</b> objectif atteint · <b>★★</b> en moins de ${tg.t} s · <b>★★★</b> avec ${tg.c} contacts ou moins. Un seul appui sur Marche, sinon une seule étoile.</div>
    <details><summary>Un coup de pouce ?</summary><p>${l.hint}</p></details>
    <h3>Entrées / sorties</h3><table class="io" id="io"></table><div class="log" id="log" aria-live="polite"></div>`;
  renderIO(); renderPupitre(); renderLadder(); fillImport();
  $("#result").className = ""; $("#result").innerHTML = "";
  logV = -1; fit();
}
function renderIO() {
  const w = W();
  $("#io").innerHTML = [...w.ins, ...w.outs].map(o => `<tr data-a="${o.a}"><td><i></i></td><td class="ad">${o.a}</td><td>${o.label}</td></tr>`).join("");
  ioRows = [...$("#io").querySelectorAll("tr")].map(tr => [tr, tr.dataset.a]);
}
let ioRows = [];
function renderPupitre() {
  const w = W(), l = w.level, doors = w.comps.filter(c => c.type === "door");
  $("#pupitre").innerHTML = `<button class="mode" id="mode">Automate : STOP</button>
    <button class="bp m" data-k="marche" aria-label="Bouton Marche">MARCHE</button>
    <button class="bp a" data-k="arret" aria-label="Bouton Arrêt">ARRÊT</button>
    ${l.rearm ? `<button class="bp r" data-k="rearm" aria-label="Bouton Réarmement">RÉARM.</button>` : ""}
    ${l.au ? `<button class="au${w.auPlayer ? " on" : ""}" id="aubtn" aria-pressed="${w.auPlayer}" aria-label="Arrêt d'urgence">AU</button>` : ""}
    ${doors.map(d => `<button class="ghost" data-door="${d.id}">${d.open ? "Fermer" : "Ouvrir"} la porte</button>`).join("")}
    <button class="ghost" id="reset">Recommencer</button>
    ${isoOn ? `<button class="ghost" id="view">${view === "iso" ? "Vue de dessus" : "Vue 3D"}</button>` : ""}
    <button class="ghost" id="big" aria-pressed="${$("#stage").classList.contains("big")}">${$("#stage").classList.contains("big") ? "Réduire" : "Plein écran"}</button>
    <span class="speed">${[1, 2, 4].map(s => `<button class="ghost" data-sp="${s}" aria-pressed="${s === speed}">×${s}</button>`).join("")}</span>`;
  $("#mode").addEventListener("click", () => { SIM.setRun(!W().run); syncMode(); });
  for (const el of $("#pupitre").querySelectorAll(".bp")) {
    const k = el.dataset.k;
    const press = down => { const w = W(); if (down && !w.btn[k] && k === "marche" && w.run && !w.end) { w.marcheCount++; if (w.marcheCount === 2 && w.started) w.logs.unshift({ t: w.t, msg: "Le client : « Pourquoi il faut rappuyer sur Marche ? »", cls: "warn" }), w.logV++; } w.btn[k] = down; el.classList.toggle("down", down); };
    let t0 = 0; const up = () => setTimeout(() => press(false), Math.max(0, 120 - (performance.now() - t0)));
    el.addEventListener("pointerdown", e => { e.preventDefault(); t0 = performance.now(); try { el.setPointerCapture(e.pointerId); } catch (_) {} press(true); });
    for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(ev, up);
    el.addEventListener("keydown", e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); press(true); } });
    el.addEventListener("keyup", e => { if (e.key === " " || e.key === "Enter") press(false); });
  }
  if (l.au) $("#aubtn").addEventListener("click", e => { const w = W(); w.auPlayer = !w.auPlayer; e.currentTarget.classList.toggle("on", w.auPlayer); e.currentTarget.setAttribute("aria-pressed", w.auPlayer); });
  $("#pupitre").querySelectorAll("[data-door]").forEach(b => b.addEventListener("click", () => { const d = W().byId[b.dataset.door]; d.open = !d.open; b.textContent = d.open ? "Fermer la porte" : "Ouvrir la porte"; }));
  $("#reset").addEventListener("click", restart);
  if (isoOn) $("#view").addEventListener("click", () => { view = view === "iso" ? "top" : "iso"; store.set("l1v2-view", view); $("#view").textContent = view === "iso" ? "Vue de dessus" : "Vue 3D"; });
  $("#big").addEventListener("click", () => { $("#stage").classList.toggle("big"); renderPupitre(); syncMode(); fit(); });
  $("#pupitre").querySelectorAll("[data-sp]").forEach(b => b.addEventListener("click", () => { speed = +b.dataset.sp; $("#pupitre").querySelectorAll("[data-sp]").forEach(x => x.setAttribute("aria-pressed", x === b)); }));
}
function syncMode() { const r = W().run; $("#mode").textContent = "Automate : " + (r ? "RUN" : "STOP"); $("#mode").classList.toggle("run", r); }
function restart() { const r = W().run; SIM.build(LV[cur - 1]); if (r) SIM.setRun(true); renderPupitre(); syncMode(); $("#result").className = ""; $("#result").innerHTML = ""; logV = -1; shown = false; }

/* ---------- ladder ---------- */
const SVG = {
  no: '<svg width="46" height="44" viewBox="0 0 46 44" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M0 22H15M31 22H46M15 9V35M31 9V35"/></svg>',
  nc: '<svg width="46" height="44" viewBox="0 0 46 44" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M0 22H15M31 22H46M15 9V35M31 9V35M11 36L35 8"/></svg>',
  p: '<svg width="46" height="44" viewBox="0 0 46 44" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M0 22H15M31 22H46M15 9V35M31 9V35M23 32V12M17 18L23 12L29 18"/></svg>',
  coil: t => `<svg width="52" height="44" viewBox="0 0 52 44" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M0 22H10M42 22H52M16 8Q8 22 16 36M36 8Q44 22 36 36"/>${t ? `<text x="26" y="27" text-anchor="middle" font-size="14" font-weight="700" fill="currentColor" stroke="none" font-family="Inter">${t}</text>` : ""}</svg>`,
  box: t => `<svg width="52" height="44" viewBox="0 0 52 44" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M0 22H6M46 22H52"/><rect x="6" y="8" width="40" height="28" rx="3"/><text x="26" y="27" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor" stroke="none" font-family="Inter">${t}</text></svg>`
};
const coilSym = t => t === "out" ? SVG.coil("") : t === "set" ? SVG.coil("S") : t === "res" ? SVG.coil("R") : t === "ton" ? SVG.box("TON") : SVG.box("CTU");
function optsAll(sel) {
  const w = W(), g = (lab, list) => `<optgroup label="${lab}">${list.map(([a, l]) => `<option value="${a}"${a === sel ? " selected" : ""}>${a}${l ? " · " + l : ""}</option>`).join("")}</optgroup>`;
  return g("Entrées", w.ins.map(i => [i.a, i.label])) + g("Sorties", w.outs.map(o => [o.a, o.label])) + g("Mémoires", SIM.MEM.map(m => [m, ""])) + g("Tempos (bit fini)", SIM.TIM.map(m => [m, ""])) + g("Compteurs (bit atteint)", SIM.CNT.map(m => [m, ""]));
}
function optsCoil(t, sel) {
  const w = W(), g = (lab, list) => `<optgroup label="${lab}">${list.map(([a, l]) => `<option value="${a}"${a === sel ? " selected" : ""}>${a}${l ? " · " + l : ""}</option>`).join("")}</optgroup>`;
  if (t === "ton") return g("Tempos", SIM.TIM.map(m => [m, ""]));
  if (t === "ctu") return g("Compteurs", SIM.CNT.map(m => [m, ""]));
  let s = g("Sorties", w.outs.map(o => [o.a, o.label])) + g("Mémoires", SIM.MEM.map(m => [m, ""]));
  if (t === "res") s += g("Tempos", SIM.TIM.map(m => [m, ""])) + g("Compteurs", SIM.CNT.map(m => [m, ""]));
  return s;
}
const firstIn = () => W().ins[0].a, firstOut = () => (W().outs[0] || { a: "M0.0" }).a;
let els = [];
function renderLadder() {
  $("#ladder").innerHTML = prog.length ? prog.map((r, ri) => `<div class="rung">
    <div class="rh"><button class="mv" data-act="up" data-r="${ri}" aria-label="Monter le barreau">▲</button><span class="rn">${String(ri + 1).padStart(3, "0")}</span><button class="mv" data-act="down" data-r="${ri}" aria-label="Descendre le barreau">▼</button></div>
    <div class="line">${r.blocks.map((b, bi) => `<div class="blk${b.length > 1 ? " par" : ""}">${b.map((c, ci) => `<div class="ct" id="c${ri}_${bi}_${ci}"><button class="sym" data-act="t" data-r="${ri}" data-b="${bi}" data-c="${ci}" aria-label="Type de contact">${SVG[c.t]}</button><select data-act="a" data-r="${ri}" data-b="${bi}" data-c="${ci}" aria-label="Adresse du contact">${optsAll(c.a)}</select><button class="x" data-act="dc" data-r="${ri}" data-b="${bi}" data-c="${ci}" aria-label="Supprimer le contact">×</button></div>`).join("")}<button class="mini" data-act="ap" data-r="${ri}" data-b="${bi}">+ en parallèle</button></div>`).join("")}<button class="mini add" data-act="as" data-r="${ri}">+ contact</button></div>
    <span class="fill"></span>
    <div class="cl" id="k${ri}"><span class="csym">${coilSym(r.coil.t)}</span>
      <select data-act="ct" data-r="${ri}" aria-label="Type de bobine">${[["out", "( ) sortie"], ["set", "(S) mise à 1"], ["res", "(R) mise à 0"], ["ton", "TON tempo"], ["ctu", "CTU compteur"]].map(([v, l]) => `<option value="${v}"${v === r.coil.t ? " selected" : ""}>${l}</option>`).join("")}</select>
      <select data-act="ca" data-r="${ri}" aria-label="Adresse de la bobine">${optsCoil(r.coil.t, r.coil.a)}</select>
      ${r.coil.t === "ton" || r.coil.t === "ctu" ? `<input type="number" data-act="cp" data-r="${ri}" min="${r.coil.t === "ton" ? 0.1 : 1}" step="${r.coil.t === "ton" ? 0.1 : 1}" value="${r.coil.p}" aria-label="${r.coil.t === "ton" ? "Durée en secondes" : "Préréglage du compteur"}"><span class="live" id="lv${ri}"></span>` : ""}
    </div><button class="x" data-act="dr" data-r="${ri}" aria-label="Supprimer le barreau">×</button></div>`).join("")
    : `<div class="empty">Aucun barreau. Ajoute-en un avec « + Barreau », ou importe le programme d'un autre niveau.</div>`;
  els = prog.map((r, ri) => ({ k: $("#k" + ri), lv: $("#lv" + ri), cts: r.blocks.map((b, bi) => b.map((c, ci) => ({ el: $(`#c${ri}_${bi}_${ci}`), c }))) }));
  check();
}
function commit() { store.set(pkey(cur), prog); }
function snap() { hist.push(JSON.stringify(prog)); if (hist.length > 40) hist.shift(); }
$("#ladder").addEventListener("click", e => {
  const t = e.target.closest("[data-act]"); if (!t || t.tagName === "SELECT" || t.tagName === "INPUT") return;
  const r = +t.dataset.r, b = +t.dataset.b, c = +t.dataset.c, a = t.dataset.act; snap();
  if (a === "t") { const k = prog[r].blocks[b][c]; k.t = k.t === "no" ? "nc" : k.t === "nc" ? "p" : "no"; }
  else if (a === "dc") { prog[r].blocks[b].splice(c, 1); if (!prog[r].blocks[b].length) prog[r].blocks.splice(b, 1); }
  else if (a === "ap") prog[r].blocks[b].push({ a: firstIn(), t: "no" });
  else if (a === "as") prog[r].blocks.push([{ a: firstIn(), t: "no" }]);
  else if (a === "dr") prog.splice(r, 1);
  else if (a === "up" && r > 0) [prog[r - 1], prog[r]] = [prog[r], prog[r - 1]];
  else if (a === "down" && r < prog.length - 1) [prog[r + 1], prog[r]] = [prog[r], prog[r + 1]];
  commit(); renderLadder();
});
$("#ladder").addEventListener("change", e => {
  const t = e.target, r = +t.dataset.r, a = t.dataset.act; snap();
  if (a === "a") prog[r].blocks[+t.dataset.b][+t.dataset.c].a = t.value;
  else if (a === "ca") prog[r].coil.a = t.value;
  else if (a === "cp") prog[r].coil.p = Math.max(t.min ? +t.min : 0, +t.value || 1);
  else if (a === "ct") { const k = prog[r].coil; k.t = t.value; if (k.t === "ton") { k.a = "T0"; k.p = 1; } else if (k.t === "ctu") { k.a = "C0"; k.p = 3; } else if (/^[TC]/.test(k.a) && k.t !== "res") k.a = firstOut(); commit(); renderLadder(); return; }
  commit(); check();
});
$("#addrung").addEventListener("click", () => { snap(); prog.push({ blocks: [[{ a: firstIn(), t: "no" }]], coil: { t: "out", a: firstOut(), p: 1 } }); commit(); renderLadder(); });
$("#undo").addEventListener("click", () => { if (!hist.length) return; prog = JSON.parse(hist.pop()); commit(); renderLadder(); });
let clearArm = false;
$("#clear").addEventListener("click", e => { if (!clearArm) { clearArm = true; e.target.textContent = "Sûr ? Clique encore"; setTimeout(() => { clearArm = false; e.target.textContent = "Tout effacer"; }, 2500); return; } clearArm = false; e.target.textContent = "Tout effacer"; snap(); prog = []; commit(); renderLadder(); });
function fillImport() {
  const opts = LV.filter(l => l.n !== cur && (store.get(pkey(l.n)) || []).length).map(l => `<option value="${l.n}">Niveau ${l.n} · ${l.title}</option>`);
  $("#imp").innerHTML = `<option value="">Importer un programme…</option>` + opts.join(""); $("#imp").disabled = !opts.length;
}
$("#imp").addEventListener("change", e => { const n = +e.target.value; if (!n) return; snap(); prog = prog.concat(store.get(pkey(n)) || []); commit(); renderLadder(); e.target.value = ""; });
function check() {
  const n = {}; prog.forEach(r => { if (r.coil.t === "out") n[r.coil.a] = (n[r.coil.a] || 0) + 1; });
  const w = [], known = new Set([...W().ins.map(i => i.a), ...W().outs.map(o => o.a), ...SIM.MEM, ...SIM.TIM, ...SIM.CNT]);
  for (const k in n) if (n[k] > 1) w.push(`Double bobine : <b>${k}</b> est écrite par ${n[k]} barreaux de type sortie. Le dernier gagne, les autres sont écrasés.`);
  if (prog.some(r => !known.has(r.coil.a) || r.blocks.some(b => b.some(c => !known.has(c.a))))) w.push("Certaines adresses n'existent pas sur cette machine (programme importé ?). Vérifie les contacts et bobines.");
  $("#warn").innerHTML = w.join("<br>");
}

/* ---------- boucle ---------- */
const cv = $("#cv"), g = cv.getContext("2d");
function fit() {
  const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.max(1, r.width * d); cv.height = Math.max(1, r.height * d);
  const s = Math.min(r.width / SIM.WW, r.height / SIM.WH) * d; g.setTransform(s, 0, 0, s, (cv.width - SIM.WW * s) / 2, (cv.height - SIM.WH * s) / 2);
}
const cro = new ResizeObserver(fit); cro.observe(cv);
let logV = -1, shown = false, last = performance.now(), acc = 0, fr = 0;
function ui() {
  const w = W();
  for (const [tr, a] of ioRows) tr.classList.toggle("on", !!w.bits[a]);
  fr++;
  if (fr % 2 === 0) els.forEach((r, ri) => {
    const p = prog[ri]; if (!p) return;
    r.k && r.k.classList.toggle("on", w.run && !!w.bits[p.coil.a]);
    if (r.lv && fr % 6 === 0) { if (p.coil.t === "ton") { const t = w.tim[p.coil.a]; r.lv.textContent = t ? `${t.acc.toFixed(1)} s` : ""; } else { const c = w.cnt[p.coil.a]; r.lv.textContent = c ? `${c.v} / ${p.coil.p}` : ""; } }
    r.cts.forEach(b => b.forEach(o => o.el && o.el.classList.toggle("on", w.run && (o.c.t === "nc" ? !w.bits[o.c.a] : !!w.bits[o.c.a]))));
  });
  if (w.logV !== logV) { logV = w.logV; $("#log").innerHTML = w.logs.map(l => `<div class="${l.cls}">[${l.t.toFixed(1).padStart(5, " ")} s] ${l.msg}</div>`).join(""); }
  if (w.end && !shown) { shown = true; showResult(); }
}
function stars() {
  const w = W(), tg = target(cur); if (w.end.kind !== "win") return w.end.kind === "warn" ? 1 : 0;
  let s = 1 + (SIM.elapsed() <= tg.t) + (contacts() <= tg.c); if (w.marcheCount > 1) s = 1; return s;
}
function showResult() {
  const w = W(), k = w.end.kind, st = stars(), tg = target(cur);
  if (st > (progress.stars[cur] || 0)) { progress.stars[cur] = st; saveProgress(); }
  if (st > 0 && window.ONLINE) window.ONLINE.report(cur, st, SIM.elapsed());
  let msg = w.end.msg || "La machine tourne, le client signe.";
  if (k === "win" && w.marcheCount > 1) msg = `Ça marche, mais il a fallu appuyer ${w.marcheCount} fois sur Marche. Le client veut une ligne qui repart toute seule.`;
  else if (k === "win" && st < 3) msg += ` Pour plus d'étoiles : moins de ${tg.t} s et ${tg.c} contacts ou moins.`;
  $("#result").className = k;
  $("#result").innerHTML = `<h3>${{ win: "Réussi !", fail: "Raté", warn: "Presque…" }[k]}</h3><div class="stars" aria-label="${st} étoiles sur 3">${"★".repeat(st)}${"☆".repeat(3 - st)}</div><p>${msg}</p>
    <div class="small">Temps : ${SIM.elapsed().toFixed(1)} s · Contacts : ${contacts()} · Appuis sur Marche : ${w.marcheCount}</div>
    <div class="row"><button class="ghost" data-go="r">Rejouer</button>${k !== "fail" && cur < 20 ? `<button class="cta" data-go="n">Niveau suivant</button>` : ""}<button class="ghost" data-go="m">Carte</button></div>`;
}
$("#result").addEventListener("click", e => { const b = e.target.closest("[data-go]"); if (!b) return; const go = b.dataset.go; if (go === "r") restart(); else if (go === "n") location.hash = "niveau-" + (cur + 1); else location.hash = "carte"; });
function frame(t) {
  const real = Math.min(0.1, (t - last) / 1000); last = t;
  if (!$("#vlevel").hidden && W()) {
    acc += real * speed; let n = 0;
    while (acc >= 1 / 60 && n < 16) { SIM.step(1 / 60, prog); acc -= 1 / 60; n++; }
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = "#0d1013"; g.fillRect(0, 0, cv.width, cv.height); g.restore();
    if (isoOn && view === "iso") SIM.drawIso(g); else SIM.draw(g); ui();
  }
  requestAnimationFrame(frame);
}

/* ---------- routes ---------- */
function route() {
  const m = /^#niveau-(\d+)$/.exec(location.hash), n = m ? +m[1] : 0, on = /^#(profil|classement|collegues)$/.exec(location.hash);
  $("#stage").classList.remove("big");
  $("#vonline").hidden = !on;
  if (on) { $("#vmap").hidden = true; $("#vlevel").hidden = true; if (window.ONLINE) window.ONLINE.show(on[1]); else $("#online").innerHTML = "<h1>Jeu en ligne</h1><p class='lead'>Le classement et les collègues fonctionnent sur la version publiée du jeu, une fois Firebase configuré.</p>"; window.scrollTo(0, 0); return; }
  if (n >= 1 && n <= 20 && unlocked(n)) { $("#vmap").hidden = true; $("#vlevel").hidden = false; shown = false; openLevel(n); window.scrollTo(0, 0); }
  else { $("#vlevel").hidden = true; $("#vmap").hidden = false; renderMap(); }
}
$("#back").addEventListener("click", () => { location.hash = "carte"; });
addEventListener("keydown", e => { if (e.key === "Escape" && $("#stage").classList.contains("big")) { $("#stage").classList.remove("big"); renderPupitre(); syncMode(); fit(); } });
addEventListener("hashchange", route);
window.APP = { progress, saveProgress, refresh: () => { if (!$("#vmap").hidden) renderMap(); } };
route(); requestAnimationFrame(frame);

/* ---------- format texte (tests et import) ---------- */
function parseText(text) {
  const sym = W().sym, res = s => { s = s.trim(); if (sym[s]) return sym[s]; if (sym[s + ".i"]) return sym[s + ".i"]; if (sym[s + ".q"]) return sym[s + ".q"]; if (/^([IQ]\d\.\d|M\d\.\d|T\d|C\d)$/.test(s)) return s; throw new Error("Symbole inconnu : " + s); };
  return text.split("\n").map(l => l.replace(/#.*/, "").trim()).filter(Boolean).map(l => {
    const [lhs, rhs] = l.split("->");
    const blocks = lhs.trim() ? lhs.split("&").map(b => b.split("|").map(c => { c = c.trim(); let t = "no"; if (c[0] === "/") { t = "nc"; c = c.slice(1); } else if (c[0] === "^") { t = "p"; c = c.slice(1); } return { a: res(c), t }; })) : [];
    const r = rhs.trim().split(/\s+/); let coil;
    if (r[0] === "S") coil = { t: "set", a: res(r[1]), p: 1 }; else if (r[0] === "R") coil = { t: "res", a: res(r[1]), p: 1 };
    else if (r[0] === "TON") coil = { t: "ton", a: r[1], p: +r[2] }; else if (r[0] === "CTU") coil = { t: "ctu", a: r[1], p: +r[2] }; else coil = { t: "out", a: res(r[0]), p: 1 };
    return { blocks, coil };
  });
}
window.LIGNE = {
  loadText(t) { prog = parseText(t); commit(); renderLadder(); return contacts(); },
  run() { if (!W().run) { SIM.setRun(true); syncMode(); } },
  fast(sec, marche = true) {
    const w = W(); let steps = Math.round(sec * 60);
    for (let i = 0; i < steps && !w.end; i++) { if (marche) w.btn.marche = i < 12; if (i === 12 && marche) w.marcheCount = 1; SIM.step(1 / 60, prog); }
    w.btn.marche = false; return { end: w.end, t: +SIM.elapsed().toFixed(1), contacts: contacts(), logs: w.logs.slice(0, 8).map(l => `[${l.t.toFixed(1)}] ${l.msg}`) };
  },
  sym: () => W().sym
};
}
