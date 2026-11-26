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
  R.d.onValue(ref("rr"), s => { rr = s.val(); rrSeen(); });
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
  $("#s-r").hidden = sub !== "r"; $("#s-b").hidden = sub !== "b"; $("#s-rr").hidden = sub !== "rr"; syncMe();
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

/* ---------- roulette russe (version cartoon, pistolet à bouchon) ---------- */
const FEE = 20, MAXS = 6, WAITS = 15000, TURN = 15000, ENDW = 9000, SEATC = ["#f59e0b", "#38bdf8", "#f472b6", "#4ade80", "#a78bfa", "#fb7185"];
let rr = null, rrLast = 0, rrAng = 0, rrBusy = false, rrSeenTurn = "", rrPaidId = "";
const snd = n => window.SFX && window.SFX.play(n);
const rrRef = () => ref("rr");
const seatsOf = g => Object.entries((g && g.seats) || {}).sort((a, b) => a[1].i - b[1].i);
const aliveOf = g => (g.order || []).filter(u => g.seats[u] && !g.seats[u].out);
function rrMsg(t, cls) { $("#rrmsg").textContent = t; $("#rrmsg").className = "msg " + (cls || ""); }
async function tx(fn) { if (!R || rrBusy) return null; rrBusy = true; try { return await R.d.runTransaction(rrRef(), fn); } catch (e) { console.error(e); return null; } finally { rrBusy = false; } }
const fresh = () => ({ id: Math.random().toString(36).slice(2, 9), state: "wait", seats: {}, pot: 0 });
$("#rrsit").onclick = async () => {
  if (!R) return; if (rr && rr.seats && rr.seats[R.uid]) return;
  if (!K().spend(FEE)) return rrMsg(`Il faut ${FEE} coins pour s'asseoir.`, "lose");
  K().commit(); let ok = false;
  const r = await tx(g => {
    ok = false; if (!g || (g.state === "end" && now() > (g.endAt || 0) + ENDW)) g = fresh();
    if (g.state !== "wait") return g; g.seats = g.seats || {}; const n = Object.keys(g.seats).length;
    if (g.seats[R.uid] || n >= MAXS) return g;
    const used = new Set(Object.values(g.seats).map(x => x.i)); let i = 0; while (used.has(i)) i++;
    g.seats[R.uid] = { p: R.pseudo, i, out: false }; g.pot = (g.pot || 0) + FEE; ok = true;
    if (n + 1 >= 2 && !g.startAt) g.startAt = now() + WAITS;
    return g;
  });
  if (!r || !ok) { K().gain(FEE); K().commit(); return rrMsg("Impossible de s'asseoir : la partie a commencé ou la table est pleine.", "lose"); }
  syncMe(); snd("chip"); say(`${R.pseudo} s'assoit à la table de la roulette russe.`, true); rrMsg("Tu es assis. La partie démarre dès qu'il y a au moins 2 joueurs.", "");
};
$("#rrleave").onclick = async () => {
  let ok = false;
  await tx(g => { ok = false; if (!g || g.state !== "wait" || !g.seats || !g.seats[R.uid]) return g; delete g.seats[R.uid]; g.pot = Math.max(0, (g.pot || 0) - FEE); if (Object.keys(g.seats).length < 2) g.startAt = null; ok = true; return g; });
  if (ok) { K().gain(FEE); K().commit(); syncMe(); rrMsg("Tu t'es levé, mise rendue.", ""); }
};
$("#rrpull").onclick = () => pull(false);
async function pull(forced) {
  const by = R.uid; let res = null;
  await tx(g => {
    res = null; if (!g || g.state !== "play") return g;
    const u = g.order[g.turn]; if (!u) return g;
    if (!forced && u !== by) return g; if (forced && now() < g.turnAt + TURN) return g;
    if (!forced && now() < g.turnAt) return g;
    const bang = g.pos === g.ch;
    if (bang) { g.seats[u].out = true; g.ch = Math.floor(Math.random() * 6); g.pos = 0; g.shots = 0; } else { g.pos++; g.shots = (g.shots || 0) + 1; }
    g.last = { u, bang, at: now(), forced: !!forced };
    const alive = aliveOf(g);
    if (alive.length <= 1) { g.state = "end"; g.winner = alive[0] || ""; g.endAt = now(); }
    else { let t = g.turn; do { t = (t + 1) % g.order.length; } while (g.seats[g.order[t]].out); g.turn = t; g.turnAt = now() + 1800; }
    res = g.last; return g;
  });
  return res;
}
function rrSeen() {
  if (!rr) return;
  if (rr.last && rr.last.at !== rrLast) {
    const fresh2 = rrLast !== 0 || now() - rr.last.at < 3000; rrLast = rr.last.at;
    if (fresh2 && now() - rr.last.at < 4000) {
      const who = (rr.seats[rr.last.u] || {}).p || "?";
      if (rr.last.bang) { snd("boom"); if (rr.last.u === R.uid) rrMsg("BANG ! Ton chapeau s'envole… tu es éliminé.", "lose"); else rrMsg(`BANG ! ${who} est éliminé.`, ""); }
      else { snd("empty"); rrMsg(`Clic… ${who} s'en sort${rr.last.forced ? " (le croupier a tiré pour lui)" : ""}.`, ""); }
    }
  }
  if (rr.state === "play") { const u = rr.order[rr.turn]; const key = rr.id + ":" + rr.turnAt; if (u === R.uid && rrSeenTurn !== key) { rrSeenTurn = key; snd("ding"); } }
  if (rr.state === "end" && rr.winner === R.uid && !rr.paid && rrPaidId !== rr.id) {
    rrPaidId = rr.id; let ok = false, pot = 0;
    tx(g => { ok = false; if (!g || g.state !== "end" || g.winner !== R.uid || g.paid) return g; g.paid = true; pot = g.pot || 0; ok = true; return g; }).then(() => {
      if (!ok) return; K().gain(pot); K().commit(); syncMe(); snd("win"); rrMsg(`Dernier survivant ! Tu rafles le pot : +${pot} coins.`, "win");
      say(`${R.pseudo} survit à la roulette russe et rafle ${pot} coins !`, true);
    });
  }
}
function rrTick() {
  const g = rr, T = now(), seats = seatsOf(g), me = g && g.seats && g.seats[R.uid];
  // automatismes partagés : démarrage, tour trop long, remise à zéro
  if (g && !rrBusy) {
    if (g.state === "wait" && g.startAt && T >= g.startAt) tx(x => { if (!x || x.state !== "wait" || !x.startAt || now() < x.startAt) return x; const ks = seatsOf(x).map(e => e[0]); if (ks.length < 2) { x.startAt = null; return x; } x.state = "play"; x.order = ks; x.ch = Math.floor(Math.random() * 6); x.pos = 0; x.shots = 0; x.turn = 0; x.turnAt = now() + 2500; x.last = null; return x; }).then(() => snd("spin"));
    else if (g.state === "play" && T > g.turnAt + TURN) pull(true);
    else if (g.state === "end" && T > (g.endAt || 0) + ENDW) tx(x => (x && x.state === "end" && now() > (x.endAt || 0) + ENDW ? fresh() : x));
  }
  // interface
  const st = !g ? "wait" : g.state, n = seats.length;
  let ph;
  if (st === "wait") ph = n < 2 ? `Table libre · ${n}/${MAXS} joueurs · mise ${FEE} coins` : `Le barillet tourne dans ${Math.max(0, Math.ceil((g.startAt - T) / 1000))} s · ${n}/${MAXS} joueurs`;
  else if (st === "play") { const u = g.order[g.turn], left = Math.max(0, Math.ceil((g.turnAt + TURN - T) / 1000)); ph = T < g.turnAt ? "…" : u === R.uid ? `À toi ! ${left} s pour appuyer` : `Au tour de ${(g.seats[u] || {}).p} · ${left} s`; }
  else ph = g.winner ? `${(g.seats[g.winner] || {}).p} remporte ${g.pot} coins · nouvelle table dans ${Math.max(0, Math.ceil((g.endAt + ENDW - T) / 1000))} s` : "Partie terminée";
  $("#rrphase").textContent = ph;
  $("#rrpot").textContent = `Pot : ${(g && g.pot) || 0} coins`;
  $("#rrsit").hidden = !(st === "wait" && !me) && !(st === "end" && !me && T > (g.endAt || 0) + ENDW);
  $("#rrsit").disabled = n >= MAXS || K().wal.coins < FEE;
  $("#rrleave").hidden = !(st === "wait" && me);
  const myTurn = st === "play" && g.order[g.turn] === R.uid && T >= g.turnAt;
  $("#rrpull").hidden = !(st === "play" && me && !me.out); $("#rrpull").disabled = !myTurn;
  drawRR(g, seats, T);
}
function drawRR(g, seats, T) {
  const cv = $("#rrcv"), x = cv.getContext("2d"), W = 640, H = 520, cx = 320, cy = 250;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
  // plancher du saloon
  for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? "#2e1b0e" : "#352010"; x.fillRect(0, i * 44, W, 44); x.fillStyle = "#00000040"; x.fillRect(0, i * 44, W, 2); for (let k = 0; k < 3; k++) { x.fillStyle = "#1a0f08"; x.fillRect(((i * 173 + k * 241) % W), i * 44 + 8, 2, 28); } }
  // piano dans le coin et notes qui flottent
  x.fillStyle = "#140a04"; x.fillRect(0, 0, 120, 70); x.fillStyle = "#f5f5f4"; x.fillRect(8, 52, 104, 12); x.fillStyle = "#111"; for (let k = 0; k < 13; k++) if (k % 7 !== 2 && k % 7 !== 6) x.fillRect(12 + k * 8, 52, 4, 7);
  for (let k = 0; k < 3; k++) { const ph = ((T / 2400 + k / 3) % 1), nx = 110 + ph * 70 + Math.sin(ph * 9 + k) * 8, ny = 60 - ph * 50; x.globalAlpha = 1 - ph; x.fillStyle = "#fde68a"; x.beginPath(); x.ellipse(nx, ny, 5, 3.6, -0.4, 0, 7); x.fill(); x.fillRect(nx + 3.5, ny - 16, 1.6, 16); x.globalAlpha = 1; }
  // zoom doux sur le joueur dont c'est le tour
  const tU = g && g.state === "play" ? g.order[g.turn] : null;
  if (tU && g.seats[tU]) { const a = -Math.PI / 2 + g.seats[tU].i * Math.PI * 2 / MAXS, zx = cx + Math.cos(a) * 268, zy = cy + Math.sin(a) * 186; rrZoom.x += (zx - rrZoom.x) * 0.05; rrZoom.y += (zy - rrZoom.y) * 0.05; rrZoom.k += (1.12 - rrZoom.k) * 0.05; }
  else { rrZoom.x += (cx - rrZoom.x) * 0.05; rrZoom.y += (cy - rrZoom.y) * 0.05; rrZoom.k += (1 - rrZoom.k) * 0.05; }
  const fx2 = cx + (rrZoom.x - cx) * 0.35, fy2 = cy + (rrZoom.y - cy) * 0.35; x.translate(cx, cy); x.scale(rrZoom.k, rrZoom.k); x.translate(-fx2, -fy2);
  // table
  x.fillStyle = "#00000055"; x.beginPath(); x.ellipse(cx, cy + 18, 230, 150, 0, 0, 7); x.fill();
  x.fillStyle = "#5b3418"; x.beginPath(); x.ellipse(cx, cy, 228, 148, 0, 0, 7); x.fill();
  x.fillStyle = "#7a4a22"; x.beginPath(); x.ellipse(cx, cy - 4, 222, 142, 0, 0, 7); x.fill();
  const fg = x.createRadialGradient(cx, cy - 20, 20, cx, cy, 200); fg.addColorStop(0, "#1f7a4a"); fg.addColorStop(1, "#0f4a2c");
  x.fillStyle = fg; x.beginPath(); x.ellipse(cx, cy - 6, 196, 120, 0, 0, 7); x.fill();
  x.strokeStyle = "#e8c16a55"; x.lineWidth = 2; x.beginPath(); x.ellipse(cx, cy - 6, 176, 104, 0, 0, 7); x.stroke();
  // lampe
  const lg = x.createRadialGradient(cx, cy - 10, 10, cx, cy - 10, 260); lg.addColorStop(0, "#fde68a22"); lg.addColorStop(1, "#0000"); x.fillStyle = lg; x.fillRect(0, 0, W, H);
  // jetons du pot
  const pot = (g && g.pot) || 0;
  for (let i = 0; i < Math.min(14, Math.ceil(pot / 20)); i++) { const a = i * 2.4, r = 18 + (i % 4) * 7; x.fillStyle = ["#dc2626", "#2563eb", "#16a34a", "#e8c16a"][i % 4]; x.beginPath(); x.ellipse(cx - 90 + Math.cos(a) * r, cy + 40 + Math.sin(a) * r * 0.5, 13, 8, 0, 0, 7); x.fill(); x.strokeStyle = "#fff8"; x.lineWidth = 1.5; x.stroke(); }
  // sièges
  const pos = i => { const a = -Math.PI / 2 + i * Math.PI * 2 / MAXS; return [cx + Math.cos(a) * 268, cy + Math.sin(a) * 186]; };
  const turnU = g && g.state === "play" ? g.order[g.turn] : null;
  for (let i = 0; i < MAXS; i++) {
    const e = seats.find(s => s[1].i === i), [px, py] = pos(i);
    if (!e) { x.strokeStyle = "#ffffff22"; x.setLineDash([5, 5]); x.lineWidth = 2; x.beginPath(); x.arc(px, py, 30, 0, 7); x.stroke(); x.setLineDash([]); continue; }
    const [u, s] = e, out = s.out, col = out ? "#52525b" : SEATC[i], hit = g.last && g.last.bang && g.last.u === u && T - g.last.at < 1600;
    if (u === turnU) { x.save(); x.shadowColor = "#fde047"; x.shadowBlur = 24; x.strokeStyle = "#fde047"; x.lineWidth = 4; x.beginPath(); x.arc(px, py, 38, 0, 7); x.stroke(); x.restore(); }
    const shake = hit ? Math.sin(T / 20) * 4 : 0;
    x.fillStyle = col; x.beginPath(); x.arc(px + shake, py, 30, 0, 7); x.fill();
    // visage
    x.fillStyle = "#1a1a1a";
    if (out) { x.strokeStyle = "#1a1a1a"; x.lineWidth = 3; for (const ex of [-10, 10]) { x.beginPath(); x.moveTo(px + ex - 5, py - 6); x.lineTo(px + ex + 5, py + 2); x.moveTo(px + ex + 5, py - 6); x.lineTo(px + ex - 5, py + 2); x.stroke(); } }
    else { x.beginPath(); x.arc(px - 10 + shake, py - 3, 4, 0, 7); x.arc(px + 10 + shake, py - 3, 4, 0, 7); x.fill(); x.strokeStyle = "#1a1a1a"; x.lineWidth = 2.5; x.beginPath(); if (u === turnU) x.arc(px + shake, py + 13, 6, 0, 7); else x.arc(px + shake, py + 8, 8, 0.2, Math.PI - 0.2); x.stroke(); if (u === turnU) { x.fillStyle = "#7dd3fc"; x.beginPath(); x.ellipse(px + 22, py - 10, 4, 6, 0, 0, 7); x.fill(); } }
    // chapeau de cowboy (il s'envole quand on est éliminé)
    let hx = px + shake, hy = py - 26, hr = 0;
    if (out) { const k = g.last && g.last.u === u && g.last.bang ? Math.min(1, (T - g.last.at) / 900) : 1; hx += k * 34; hy -= k * 44; hr = k * 0.9; }
    x.save(); x.translate(hx, hy); x.rotate(hr); x.fillStyle = out ? "#3f3f46" : "#8b5a2b"; x.beginPath(); x.ellipse(0, 0, 32, 7, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(-16, 0); x.quadraticCurveTo(-16, -22, -4, -20); x.lineTo(0, -16); x.lineTo(4, -20); x.quadraticCurveTo(16, -22, 16, 0); x.fill(); x.fillStyle = "#1a1a1a"; x.fillRect(-16, -6, 32, 4); x.restore();
    x.font = "700 15px Inter"; x.textAlign = "center"; const nm = (u === R.uid ? "Toi" : s.p).slice(0, 12), tw = x.measureText(nm).width + 14;
    x.fillStyle = "#000b"; rrR(x, px - tw / 2, py + 36, tw, 22, 8); x.fill(); x.fillStyle = out ? "#a1a1aa" : "#fff"; x.fillText(nm, px, py + 52);
    if (out) { x.fillStyle = "#fca5a5"; x.font = "700 12px Inter"; x.fillText("éliminé", px, py + 72); }
  }
  // le pistolet au centre, pointé vers le joueur dont c'est le tour
  let target = rrAng;
  if (turnU && g.seats[turnU]) { const [px, py] = pos(g.seats[turnU].i); target = Math.atan2(py - cy, px - cx); }
  else if (g && g.state === "wait") target = T / 1400;
  let d = target - rrAng; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; rrAng += d * 0.12;
  x.save(); x.translate(cx, cy - 6); x.rotate(rrAng);
  const kick = g && g.last && T - g.last.at < 300 ? (1 - (T - g.last.at) / 300) * 0.25 : 0; x.rotate(-kick);
  x.fillStyle = "#00000055"; x.fillRect(-36, 6, 110, 14);
  x.fillStyle = "#6b4423"; x.beginPath(); x.moveTo(-40, -6); x.lineTo(-14, -6); x.lineTo(-8, 18); x.quadraticCurveTo(-30, 26, -48, 14); x.closePath(); x.fill();
  x.fillStyle = "#9ca3af"; rrR(x, -16, -12, 34, 20, 6); x.fill(); x.fillStyle = "#6b7280"; x.fillRect(16, -9, 66, 10); x.fillStyle = "#d1d5db"; x.fillRect(16, -9, 66, 3); x.fillRect(78, -13, 4, 5);
  x.fillStyle = "#4b5563"; x.beginPath(); x.arc(1, -2, 9, 0, 7); x.fill();
  x.restore();
  // effets : BANG ou clic
  if (g && g.last && T - g.last.at < 1700) {
    const k = (T - g.last.at) / 1700, mx = cx + Math.cos(rrAng) * 96, my = cy - 6 + Math.sin(rrAng) * 96;
    if (g.last.bang) {
      for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.4, r = 16 + k * 60; x.fillStyle = `rgba(200,200,210,${0.55 * (1 - k)})`; x.beginPath(); x.arc(mx + Math.cos(a) * r * 0.6, my + Math.sin(a) * r * 0.4 - k * 30, 14 + k * 22, 0, 7); x.fill(); }
      if (k < 0.55) {
        const s = 1 + Math.sin(k * 20) * 0.06; x.save(); x.translate(cx, cy - 40); x.scale(s, s); x.fillStyle = "#fde047"; x.strokeStyle = "#b45309"; x.lineWidth = 5; x.beginPath();
        for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 58 : 100; x.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 0.8); } x.closePath(); x.fill(); x.stroke();
        x.fillStyle = "#dc2626"; x.font = "900 54px 'Rye', Georgia, serif"; x.textAlign = "center"; x.fillText("BANG !", 0, 18); x.restore();
      }
    } else if (k < 0.7) { const sl = Math.min(1, k * 4); x.save(); x.translate(mx, my - 30); x.scale(0.6 + sl * 0.5, 0.6 + sl * 0.5); x.fillStyle = "#fff"; x.strokeStyle = "#1a1a1a"; x.lineWidth = 3; rrR(x, -40, -22, 80, 38, 14); x.fill(); x.stroke(); x.fillStyle = "#1a1a1a"; x.font = "800 22px Inter"; x.textAlign = "center"; x.fillText("clic", 0, 5); x.restore(); }
  }
  // barillet : coups tirés
  const bx = 560, by = 450, shots = g && g.state === "play" ? g.shots || 0 : 0;
  x.fillStyle = "#1f2937"; x.beginPath(); x.arc(bx, by, 46, 0, 7); x.fill(); x.strokeStyle = "#9ca3af"; x.lineWidth = 3; x.stroke();
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3, ox = bx + Math.cos(a) * 27, oy = by + Math.sin(a) * 27; x.fillStyle = i < shots ? "#111827" : "#b45309"; x.beginPath(); x.arc(ox, oy, 10, 0, 7); x.fill(); x.strokeStyle = i === shots && g && g.state === "play" ? "#fde047" : "#4b5563"; x.lineWidth = 2.5; x.stroke(); }
  x.fillStyle = "#e5e7eb"; x.font = "700 13px Inter"; x.textAlign = "center"; x.fillText(g && g.state === "play" ? `1 chance sur ${6 - shots}` : "6 chambres, 1 bouchon", bx, by + 66);
  // lampe qui se balance au-dessus de la table : cône de lumière et poussière
  x.setTransform(1, 0, 0, 1, 0, 0);
  const sw = Math.sin(T / 1300) * 60, lx = cx + sw, ly = cy - 10;
  const lg2 = x.createRadialGradient(lx, ly, 10, lx, ly, 240); lg2.addColorStop(0, "rgba(253,230,138,.22)"); lg2.addColorStop(0.6, "rgba(253,230,138,.06)"); lg2.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = lg2; x.fillRect(0, 0, W, H);
  const vg2 = x.createRadialGradient(lx, ly, 180, cx, cy, 420); vg2.addColorStop(0, "rgba(0,0,0,0)"); vg2.addColorStop(1, "rgba(0,0,0,.55)"); x.fillStyle = vg2; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const a = i * 2.39996, r = ((i * 37) % 200) + Math.sin(T / 1700 + i) * 12, dx = lx + Math.cos(a + T / 9000) * r, dy = ly + Math.sin(a + T / 9000) * r * 0.7; x.fillStyle = `rgba(255,240,200,${0.15 + 0.35 * (1 - r / 220)})`; x.fillRect(dx, dy, 1.6, 1.6); }
  // fil et abat-jour vus du dessus
  x.strokeStyle = "#0008"; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, -10); x.lineTo(lx, ly - 30); x.stroke();
  x.fillStyle = "#14532d"; x.beginPath(); x.arc(lx, ly - 30, 16, 0, 7); x.fill(); x.fillStyle = "#fef3c7"; x.beginPath(); x.arc(lx, ly - 30, 7, 0, 7); x.fill();
  // battement de cœur quand c'est ton tour
  if (g && g.state === "play" && g.order[g.turn] === R.uid && T >= g.turnAt) {
    const left = Math.max(0, (g.turnAt + TURN - T) / TURN), bpm = 90 + (1 - left) * 90 + (g.shots || 0) * 12, per = 60000 / bpm, ph = (T % per) / per;
    x.save(); x.strokeStyle = "#ef4444"; x.shadowColor = "#ef4444"; x.shadowBlur = 10; x.lineWidth = 2.5; x.beginPath();
    for (let i = 0; i <= 120; i++) { const t = ((i / 120) + T / per * 0.5) % 1, yv = t > 0.4 && t < 0.44 ? -18 : t > 0.44 && t < 0.48 ? 22 : t > 0.48 && t < 0.52 ? -8 : 0; const px = 20 + i * 1.6, py = 488 + yv; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke(); x.restore();
    x.fillStyle = "#fca5a5"; x.font = "800 15px Inter"; x.textAlign = "left"; x.fillText(`♥ ${Math.round(bpm)}`, 220, 494);
    if (ph < 0.05 && rrBeat !== Math.floor(T / per)) { rrBeat = Math.floor(T / per); snd("tick"); }
  }
}
let rrZoom = { x: 320, y: 250, k: 1 }, rrBeat = 0;
function rrR(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

function loop() { if (R) { try { rouletteTick(); bjTick(); if (sub === "rr") rrTick(); if ((++frameN) % 15 === 0) renderBets(); } catch (e) { console.error(e); } } requestAnimationFrame(loop); }
window.SALOON = { open, say, get rr() { return rr; }, pull: () => pull(false) };
}
