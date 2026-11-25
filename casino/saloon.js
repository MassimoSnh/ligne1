"use strict";
/* Le Saloon : tables partagées en temps réel (roulette, blackjack) + chat + joueurs présents.
   Les tirages sont calculés à partir du numéro de manche : tout le monde voit le même résultat sans serveur. */
{
const $ = s => document.querySelector(s), K = () => window.CASINO;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const RR = 30, RB = 20, RS = 26, BR = 36, BB = 10, BA = 27;
let frameN = 0, R = null, off = 0, opened = false, players = {}, bets = {}, bjs = {}, sub = "r", lastChat = 0;
const now = () => Date.now() + off;
function rng(seed) { let h = 2166136261 >>> 0; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); let a = h >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ref = path => R.d.ref(R.rdb, "saloon/" + path);

async function open() {
  if (opened) return; opened = true;
  const fail = m => { $("#sphase").textContent = m; $("#bphase").textContent = m; $("#spl").innerHTML = `<p class="small">${m}</p>`; };
  if (!window.ONLINE) return fail("Service en ligne indisponible.");
  const prof = await new Promise(r => window.ONLINE.onReady(r));
  if (!prof) { opened = false; return fail("Crée ton pseudo d'arcade pour entrer au saloon."); }
  try { R = await window.ONLINE.realtime(); } catch (e) { return fail(e.message); }
  if (!R) return fail("Connexion impossible.");
  R.d.onValue(R.d.ref(R.rdb, ".info/serverTimeOffset"), s => { off = s.val() || 0; });
  const meRef = ref(`players/${R.uid}`);
  R.d.onValue(R.d.ref(R.rdb, ".info/connected"), s => { if (s.val() === true) { R.d.onDisconnect(meRef).remove(); R.d.set(meRef, { pseudo: R.pseudo, coins: K().wal.coins, table: sub, t: R.d.serverTimestamp() }); } });
  R.d.onValue(ref("players"), s => { players = s.val() || {}; renderPlayers(); });
  R.d.onValue(ref("bets"), s => { bets = s.val() || {}; renderBets(); });
  R.d.onValue(ref("bj"), s => { bjs = s.val() || {}; });
  R.d.onChildAdded(R.d.query(ref("chat"), R.d.limitToLast(60)), s => addChat(s.val()));
  window.ONLINE.setDetail("au Saloon");
  say(`${R.pseudo} pousse les portes du saloon.`, true);
  buildBoard(); chips($("#schips"), () => chipR, v => chipR = v); chips($("#bchips"), () => chipB, v => chipB = v);
  requestAnimationFrame(loop);
}
function syncMe() { if (R) R.d.update(ref(`players/${R.uid}`), { coins: K().wal.coins, table: sub }); }
document.querySelector(".subtabs").onclick = e => {
  const b = e.target.closest("[data-s]"); if (!b) return; sub = b.dataset.s;
  document.querySelectorAll(".subtabs .tab").forEach(t => t.setAttribute("aria-pressed", t === b));
  $("#s-r").hidden = sub !== "r"; $("#s-b").hidden = sub !== "b"; syncMe();
};
function renderPlayers() {
  const L = Object.entries(players);
  $("#spl").innerHTML = L.length ? L.map(([u, p]) => `<div><span style="width:9px;height:9px;border-radius:50%;background:#22c55e"></span><b>${esc(p.pseudo)}${u === R.uid ? " (toi)" : ""}</b><span class="small">${p.coins ?? "?"} coins · ${p.table === "b" ? "blackjack" : "roulette"}</span></div>`).join("") : `<p class="small">Personne.</p>`;
}

/* ---------- chat ---------- */
function addChat(m) {
  if (!m) return; const c = $("#chat"), atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 30;
  const d = document.createElement("div");
  if (m.sys) { d.className = "sys"; d.textContent = m.text; } else d.innerHTML = `<b>${esc(m.pseudo)}</b> ${esc(m.text)}`;
  c.appendChild(d); while (c.children.length > 80) c.firstChild.remove(); if (atBottom) c.scrollTop = c.scrollHeight;
}
function say(text, sys) { if (!R) return; R.d.push(ref("chat"), { uid: R.uid, pseudo: R.pseudo, text: String(text).slice(0, 140), sys: !!sys, t: R.d.serverTimestamp() }); }
$("#cf").onsubmit = e => {
  e.preventDefault(); const v = $("#ci").value.trim(); if (!v || !R) return;
  if (Date.now() - lastChat < 900) return; lastChat = Date.now(); say(v); $("#ci").value = "";
};

/* ---------- jetons ---------- */
const CH = [1, 5, 10, 25, 50]; let chipR = 5, chipB = 10;
function chips(el, get, set) {
  el.innerHTML = CH.map(v => `<button class="chip c${v}" data-v="${v}" aria-pressed="${v === get()}" aria-label="Jeton de ${v}">${v}</button>`).join("");
  el.onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; set(+b.dataset.v); el.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c === b)); };
}

/* ---------- roulette partagée ---------- */
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const OUT = [["d1", "1-12", "out"], ["d2", "13-24", "out"], ["d3", "25-36", "out"], ["low", "1-18", "out6"], ["even", "Pair", "out6"], ["red", "Rouge", "out6 r"], ["black", "Noir", "out6 b"], ["odd", "Impair", "out6"], ["high", "19-36", "out6"]];
const LABEL = k => k.startsWith("n:") ? k.slice(2) : (OUT.find(o => o[0] === k) || [0, k])[1];
const roundR = () => Math.floor(now() / 1000 / RR), phaseR = () => (now() / 1000) % RR, resultOf = r => Math.floor(rng("roulette-saloon-" + r)() * 37);
let my = { round: -1, bets: {} }, paidR = -1, angS = 0;
function buildBoard() {
  let h = `<button class="cell z" data-k="n:0">0</button>`;
  for (let row = 0; row < 3; row++) for (let c = 0; c < 12; c++) { const n = c * 3 + (3 - row); h += `<button class="cell ${REDS.has(n) ? "r" : "b"}" data-k="n:${n}" style="grid-row:${row + 1};grid-column:${c + 2}">${n}</button>`; }
  h += `<span style="grid-row:4;grid-column:1"></span>` + OUT.slice(0, 3).map(([k, l, c], i) => `<button class="cell ${c}" data-k="${k}" style="grid-row:4;grid-column:${2 + i * 4} / span 4">${l}</button>`).join("");
  h += `<span style="grid-row:5;grid-column:1"></span>` + OUT.slice(3).map(([k, l, c], i) => `<button class="cell ${c}" data-k="${k}" style="grid-row:5;grid-column:${2 + i * 2} / span 2">${l}</button>`).join("");
  $("#sboard").innerHTML = h;
}
const myTotal = () => Object.values(my.bets).reduce((a, b) => a + b, 0);
$("#sboard").onclick = e => {
  const c = e.target.closest("[data-k]"); if (!c || !R) return;
  const r = roundR(); if (phaseR() >= RB - 0.5) return msgR("Les mises sont fermées pour cette manche.", "lose");
  if (my.round !== r) my = { round: r, bets: {} };
  if (!K().spend(chipR)) return msgR("Pas assez de coins.", "lose");
  my.bets[c.dataset.k] = (my.bets[c.dataset.k] || 0) + chipR; K().commit(); pushBets(); msgR("", "");
};
$("#sclear").onclick = () => { if (!R || phaseR() >= RB - 0.5 || my.round !== roundR()) return; const t = myTotal(); if (t) { K().gain(t); K().commit(); } my.bets = {}; pushBets(); };
function pushBets() { R.d.set(ref(`bets/${R.uid}`), { round: my.round, pseudo: R.pseudo, bets: my.bets }); syncMe(); }
function msgR(t, cls) { $("#smsg").textContent = t; $("#smsg").className = "msg " + (cls || ""); }
function renderBets() {
  const r = roundR(), totals = {};
  const lines = Object.entries(bets).filter(([, b]) => b.round === r && b.bets && Object.keys(b.bets).length).map(([u, b]) => { for (const [k, v] of Object.entries(b.bets)) totals[k] = (totals[k] || 0) + v; return `<b>${esc(b.pseudo)}</b> : ${Object.entries(b.bets).map(([k, v]) => `${v} sur ${LABEL(k)}`).join(", ")}`; });
  $("#sbets").innerHTML = lines.length ? "Sur la table : " + lines.join(" · ") : "Personne n'a encore misé sur cette manche.";
  document.querySelectorAll("#sboard .cell").forEach(c => { c.querySelector(".bet")?.remove(); const v = totals[c.dataset.k]; if (v) c.insertAdjacentHTML("beforeend", `<span class="bet">${v}</span>`); });
  $("#stotal").textContent = my.round === r && myTotal() ? `Ta mise : ${myTotal()} coins` : "Clique sur la table pour miser.";
}
function drawWheel(ang, res) {
  const cv = $("#swheel"), g = cv.getContext("2d"), Rr = 290, c = 300, n = 37;
  g.clearRect(0, 0, 600, 600); g.save(); g.translate(c, c); g.rotate(ang);
  g.fillStyle = "#3b2312"; g.beginPath(); g.arc(0, 0, Rr + 8, 0, 7); g.fill();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2 - Math.PI / n, a1 = a0 + 2 * Math.PI / n, num = ORDER[i];
    g.fillStyle = num === 0 ? "#15803d" : REDS.has(num) ? "#c81e2b" : "#151515"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, Rr, a0, a1); g.fill();
    g.save(); g.rotate((a0 + a1) / 2); g.fillStyle = "#fff"; g.font = "700 22px Inter"; g.textAlign = "center"; g.translate(Rr - 26, 0); g.rotate(Math.PI / 2); g.fillText(num, 0, 8); g.restore();
  }
  g.fillStyle = "#7a4a22"; g.beginPath(); g.arc(0, 0, Rr * 0.55, 0, 7); g.fill(); g.fillStyle = "#e8c16a"; g.beginPath(); g.arc(0, 0, 24, 0, 7); g.fill(); g.restore();
  if (res !== undefined) { g.fillStyle = "#fff"; g.beginPath(); g.arc(c, c - Rr + 50, 11, 0, 7); g.fill(); }
}
function rouletteTick() {
  const r = roundR(), t = phaseR(), res = resultOf(r), target = -ORDER.indexOf(res) * 2 * Math.PI / 37;
  if (t < RB) { $("#sphase").textContent = `Faites vos jeux : ${Math.ceil(RB - t)} s`; $("#sbar").style.width = (t / RB * 100) + "%"; const prev = resultOf(r - 1); drawWheel(-ORDER.indexOf(prev) * 2 * Math.PI / 37, prev); }
  else if (t < RS) { $("#sphase").textContent = "Rien ne va plus…"; $("#sbar").style.width = "100%"; const k = (t - RB) / (RS - RB), e = 1 - Math.pow(1 - k, 3); drawWheel(target - (1 - e) * 2 * Math.PI * 6); }
  else {
    drawWheel(target, res); $("#sphase").textContent = `${res} ${res === 0 ? "vert" : REDS.has(res) ? "rouge" : "noir"} · prochaine manche dans ${Math.ceil(RR - t)} s`;
    document.querySelectorAll("#sboard .cell").forEach(c => c.classList.toggle("hit", c.dataset.k === "n:" + res));
    if (my.round === r && paidR !== r) {
      paidR = r; const tot = myTotal(); let win = 0; const red = REDS.has(res);
      for (const [k, v] of Object.entries(my.bets)) {
        if (k === "n:" + res) win += v * 36;
        if (res !== 0) {
          if ((k === "red" && red) || (k === "black" && !red) || (k === "even" && res % 2 === 0) || (k === "odd" && res % 2 === 1) || (k === "low" && res <= 18) || (k === "high" && res >= 19)) win += v * 2;
          if ((k === "d1" && res <= 12) || (k === "d2" && res >= 13 && res <= 24) || (k === "d3" && res >= 25)) win += v * 3;
        }
      }
      if (tot) { if (win) K().gain(win); K().commit(); syncMe(); const net = win - tot; msgR(net > 0 ? `+${net} coins !` : net < 0 ? `${net} coins` : "Mise récupérée", net > 0 ? "win" : "lose"); if (net >= 100) say(`${R.pseudo} rafle ${net} coins à la roulette sur le ${res} !`, true); }
    }
  }
  if (t < 1 && Object.keys(my.bets).length && my.round !== r) { my = { round: r, bets: {} }; msgR("", ""); document.querySelectorAll("#sboard .cell.hit").forEach(c => c.classList.remove("hit")); }
}

/* ---------- blackjack partagé ---------- */
const SU = ["♠", "♥", "♦", "♣"], RK = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const roundB = () => Math.floor(now() / 1000 / BR), phaseB = () => (now() / 1000) % BR;
function deck(seed) { const f = rng(seed); const out = []; return i => { while (out.length <= i) { out.push({ r: RK[Math.floor(f() * 13)], s: SU[Math.floor(f() * 4)] }); } return out[i]; }; }
const val = h => { let t = 0, a = 0; for (const c of h) { if (c.r === "A") { a++; t += 11; } else t += ["J", "Q", "K"].includes(c.r) ? 10 : +c.r; } while (t > 21 && a) { t -= 10; a--; } return t; };
const cardH = c => `<div class="card${c.s === "♥" || c.s === "♦" ? " red" : ""}"><span>${c.r}</span><span class="s">${c.s}</span></div>`;
function dealerHand(r) { const D = deck("bj-dealer-" + r), h = [D(0), D(1)]; let i = 2; while (val(h) < 17) h.push(D(i++)); return h; }
let mine = null, paidB = -1;
function pushBJ() { R.d.set(ref(`bj/${R.uid}`), Object.assign({ pseudo: R.pseudo }, mine)); syncMe(); }
$("#bsit").onclick = () => {
  const r = roundB(); if (!R || phaseB() >= BB - 0.3) return; if (mine && mine.round === r) return;
  if (!K().spend(chipB)) { $("#bmsg").textContent = "Pas assez de coins."; return; }
  K().commit(); mine = { round: r, bet: chipB, cards: [], done: false, dbl: false }; pushBJ(); $("#bmsg").textContent = `Tu joues ${chipB} coins. Distribution dans quelques secondes…`; $("#bmsg").className = "msg";
};
const myDeck = () => deck(`bj-player-${mine.round}-${R.uid}`);
$("#bhit").onclick = () => { if (!canAct()) return; mine.cards.push(myDeck()(mine.cards.length)); if (val(mine.cards) >= 21) mine.done = true; pushBJ(); };
$("#bstand").onclick = () => { if (!canAct()) return; mine.done = true; pushBJ(); };
$("#bdbl").onclick = () => { if (!canAct() || mine.cards.length !== 2 || !K().spend(mine.bet)) return; K().commit(); mine.dbl = true; mine.cards.push(myDeck()(2)); mine.done = true; pushBJ(); };
const canAct = () => mine && mine.round === roundB() && phaseB() >= BB && phaseB() < BA && !mine.done;
function bjTick() {
  const r = roundB(), t = phaseB(), D = dealerHand(r);
  if (mine && mine.round === r && t >= BB && !mine.cards.length) { const d = myDeck(); mine.cards = [d(0), d(1)]; if (val(mine.cards) === 21) mine.done = true; pushBJ(); }
  if (mine && mine.round === r && t >= BA && !mine.done) { mine.done = true; pushBJ(); }
  const showAll = t >= BA;
  if (t < BB) { $("#bphase").textContent = `Prenez place : ${Math.ceil(BB - t)} s`; $("#bbar").style.width = (t / BB * 100) + "%"; }
  else if (t < BA) { $("#bphase").textContent = `À vous de jouer : ${Math.ceil(BA - t)} s`; $("#bbar").style.width = ((t - BB) / (BA - BB) * 100) + "%"; }
  else { $("#bphase").textContent = `Le croupier joue · nouvelle main dans ${Math.ceil(BR - t)} s`; $("#bbar").style.width = "100%"; }
  if (t >= BB) { $("#sdh").innerHTML = (showAll ? D : D.slice(0, 1)).map(cardH).join("") + (showAll ? "" : `<div class="card back"></div>`); $("#sdv").textContent = `(${showAll ? val(D) : val(D.slice(0, 1))})`; }
  else { $("#sdh").innerHTML = ""; $("#sdv").textContent = ""; }
  const seats = Object.entries(bjs).filter(([, b]) => b.round === r);
  $("#seats").innerHTML = seats.length ? seats.map(([u, b]) => { const v = b.cards ? val(b.cards) : 0; let st = !b.cards || !b.cards.length ? "attend ses cartes" : v > 21 ? "sauté" : b.done ? "reste" : "réfléchit…"; if (showAll && b.cards && b.cards.length) st = outcome(b, D).txt; return `<div class="seat${u === R.uid ? " me" : ""}"><b>${esc(b.pseudo)}</b> · ${b.bet * (b.dbl ? 2 : 1)} coins<div class="hand">${(b.cards || []).map(cardH).join("")}</div><span class="small">${b.cards && b.cards.length ? v + " · " : ""}${st}</span></div>`; }).join("") : `<p class="small">Aucun joueur à la table pour cette main.</p>`;
  const act = canAct(); $("#bhit").disabled = $("#bstand").disabled = !act; $("#bdbl").disabled = !act || !mine || mine.cards.length !== 2 || K().wal.coins < mine.bet;
  $("#bsit").disabled = t >= BB - 0.3 || (mine && mine.round === r) || K().wal.coins < 1;
  if (showAll && mine && mine.round === r && paidB !== r && mine.cards.length) {
    paidB = r; const o = outcome(mine, D); if (o.pay) K().gain(o.pay); K().commit(); syncMe();
    const net = o.pay - mine.bet * (mine.dbl ? 2 : 1); $("#bmsg").textContent = `${o.txt} ${net > 0 ? "+" + net : net} coins`; $("#bmsg").className = "msg " + (net > 0 ? "win" : net < 0 ? "lose" : "");
    if (net >= 100) say(`${R.pseudo} gagne ${net} coins au blackjack !`, true);
  }
}
function outcome(b, D) {
  const stake = b.bet * (b.dbl ? 2 : 1), pv = val(b.cards), dv = val(D), bjP = pv === 21 && b.cards.length === 2, bjD = dv === 21 && D.length === 2;
  if (pv > 21) return { pay: 0, txt: "Sauté." };
  if (bjP && !bjD) return { pay: stake + Math.floor(stake * 1.5), txt: "Blackjack !" };
  if (bjD && !bjP) return { pay: 0, txt: "Blackjack du croupier." };
  if (dv > 21 || pv > dv) return { pay: stake * 2, txt: "Gagné !" };
  if (pv === dv) return { pay: stake, txt: "Égalité." };
  return { pay: 0, txt: "Perdu." };
}

function loop() { if (R) { try { rouletteTick(); bjTick(); if ((++frameN) % 15 === 0) renderBets(); } catch (e) { console.error(e); } } requestAnimationFrame(loop); }
window.SALOON = { open, say };
}
