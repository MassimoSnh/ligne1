"use strict";
{
const $ = s => document.querySelector(s), WEEK = window.ARCADE_WEEK;
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
let wal = store.get("casino-wallet");
if (!wal || wal.week !== WEEK) wal = { week: WEEK, coins: 100, record: (wal && wal.record) || 0, rounds: 0 };
let online = false, busy = false;
function show() {
  $("#coins").textContent = wal.coins; $("#week").textContent = WEEK.split("-S")[1]; $("#rec").textContent = `Record : ${wal.record} coins${online ? "" : " · hors ligne (crée ton pseudo pour être classé)"}`;
  const broke = wal.coins <= 0;
  document.querySelectorAll("#spin,#deal,#pull").forEach(b => { if (!bj.active) b.disabled = broke; });
  if (broke) ["#msgR", "#msgB", "#msgS"].forEach(id => { if (!$(id).textContent) $(id).textContent = "Porte-monnaie vide : rendez-vous lundi pour 100 nouveaux coins."; });
}
async function save() {
  wal.record = Math.max(wal.record, wal.coins); wal.rounds++; store.set("casino-wallet", wal); show();
  if (online && window.ONLINE) await window.ONLINE.submit("casino", g => ({ week: WEEK, coins: wal.coins, record: Math.max(g.record || 0, wal.record), rounds: wal.rounds }));
}
// synchronisation avec le compte en ligne
const hook = setInterval(() => {
  if (!window.ONLINE) return; clearInterval(hook);
  window.ONLINE.onReady(async p => {
    if (!p) return show();
    online = true; const g = window.ONLINE.game("casino");
    if (g && g.week === WEEK) wal = { week: WEEK, coins: g.coins, record: Math.max(g.record || 0, wal.record), rounds: g.rounds || 0 };
    else { wal = { week: WEEK, coins: 100, record: Math.max((g && g.record) || 0, wal.record), rounds: 0 }; await window.ONLINE.submit("casino", () => ({ week: WEEK, coins: 100, record: wal.record, rounds: 0 })); }
    store.set("casino-wallet", wal); show();
  });
}, 100);

/* ---------- jetons ---------- */
const CH = [1, 5, 10, 25, 50];
function chips(el, get, set) {
  el.innerHTML = CH.map(v => `<button class="chip c${v}" data-v="${v}" aria-pressed="${v === get()}" aria-label="Jeton de ${v}">${v}</button>`).join("");
  el.onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; set(+b.dataset.v); el.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c === b)); };
}
document.querySelector(".tabs").onclick = e => {
  const b = e.target.closest("[data-g]"); if (!b || busy || bj.active) return;
  document.querySelectorAll(".tabs .tab").forEach(t => t.setAttribute("aria-pressed", t === b));
  ["roulette", "bj", "slot", "saloon"].forEach(g => $("#g-" + g).hidden = g !== b.dataset.g);
  if (b.dataset.g === "saloon" && window.SALOON) window.SALOON.open();
};

/* ---------- roulette ---------- */
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
let chipR = 5, bets = {}, ang = 0;
chips($("#chipsR"), () => chipR, v => chipR = v);
const OUT = [["d1", "1-12", "out"], ["d2", "13-24", "out"], ["d3", "25-36", "out"], ["low", "1-18", "out6"], ["even", "Pair", "out6"], ["red", "Rouge", "out6 r"], ["black", "Noir", "out6 b"], ["odd", "Impair", "out6"], ["high", "19-36", "out6"]];
function board() {
  let h = `<button class="cell z" data-k="n:0">0</button>`;
  for (let row = 0; row < 3; row++) for (let c = 0; c < 12; c++) { const n = c * 3 + (3 - row); h += `<button class="cell ${REDS.has(n) ? "r" : "b"}" data-k="n:${n}" style="grid-row:${row + 1};grid-column:${c + 2}">${n}</button>`; }
  h += `<span style="grid-row:4;grid-column:1"></span>` + OUT.slice(0, 3).map(([k, l, c], i) => `<button class="cell ${c}" data-k="${k}" style="grid-row:4;grid-column:${2 + i * 4} / span 4">${l}</button>`).join("");
  h += `<span style="grid-row:5;grid-column:1"></span>` + OUT.slice(3).map(([k, l, c], i) => `<button class="cell ${c}" data-k="${k}" style="grid-row:5;grid-column:${2 + i * 2} / span 2">${l}</button>`).join("");
  $("#board").innerHTML = h; markBets();
}
const totalBets = () => Object.values(bets).reduce((a, b) => a + b, 0);
function markBets() {
  document.querySelectorAll("#board .cell").forEach(c => { const v = bets[c.dataset.k]; c.querySelector(".bet")?.remove(); if (v) c.insertAdjacentHTML("beforeend", `<span class="bet">${v}</span>`); });
  $("#totalR").textContent = totalBets() ? `Mise totale : ${totalBets()} coins` : "Clique sur la table pour miser.";
}
$("#board").onclick = e => {
  const c = e.target.closest("[data-k]"); if (!c || busy) return;
  if (totalBets() + chipR > wal.coins) { $("#msgR").textContent = "Pas assez de coins pour ce jeton."; $("#msgR").className = "msg lose"; return; }
  bets[c.dataset.k] = (bets[c.dataset.k] || 0) + chipR; $("#msgR").textContent = ""; markBets();
};
$("#clear").onclick = () => { if (!busy) { bets = {}; markBets(); } };
function drawWheel(hl) {
  const cv = $("#wheel"), g = cv.getContext("2d"), R = 290, c = 300, n = ORDER.length;
  g.clearRect(0, 0, 600, 600); g.save(); g.translate(c, c); g.rotate(ang);
  g.fillStyle = "#3b2312"; g.beginPath(); g.arc(0, 0, R + 8, 0, 7); g.fill();
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2 - Math.PI / n, a1 = a0 + 2 * Math.PI / n, num = ORDER[i];
    g.fillStyle = num === 0 ? "#15803d" : REDS.has(num) ? "#c81e2b" : "#151515"; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.fill();
    g.save(); g.rotate((a0 + a1) / 2); g.fillStyle = "#fff"; g.font = "700 22px Inter"; g.textAlign = "center"; g.translate(R - 26, 0); g.rotate(Math.PI / 2); g.fillText(num, 0, 8); g.restore();
  }
  g.fillStyle = "#7a4a22"; g.beginPath(); g.arc(0, 0, R * 0.55, 0, 7); g.fill(); g.fillStyle = "#e8c16a"; g.beginPath(); g.arc(0, 0, 24, 0, 7); g.fill();
  g.restore();
  if (hl !== undefined) { g.fillStyle = "#fff"; g.beginPath(); g.arc(c, c - R + 50, 11, 0, 7); g.fill(); }
}
$("#spin").onclick = () => {
  const tot = totalBets(); if (busy) return;
  if (!tot) { $("#msgR").textContent = "Place d'abord une mise sur la table."; $("#msgR").className = "msg lose"; return; }
  if (tot > wal.coins) return;
  busy = true; wal.coins -= tot; show(); $("#msgR").textContent = "Rien ne va plus…"; $("#msgR").className = "msg";
  const res = Math.floor(Math.random() * 37), idx = ORDER.indexOf(res), target = -idx * 2 * Math.PI / 37;
  const start = ang, end = target - 2 * Math.PI * (5 + Math.ceil((start - target) / (2 * Math.PI))), t0 = performance.now(), D = 3800;
  const anim = now => {
    const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); ang = start + (end - start) * e; drawWheel();
    if (k < 1) return requestAnimationFrame(anim);
    ang = target; drawWheel(res);
    let win = 0; const red = REDS.has(res);
    for (const [k2, v] of Object.entries(bets)) {
      if (k2 === "n:" + res) win += v * 36;
      if (res !== 0) {
        if ((k2 === "red" && red) || (k2 === "black" && !red) || (k2 === "even" && res % 2 === 0) || (k2 === "odd" && res % 2 === 1) || (k2 === "low" && res <= 18) || (k2 === "high" && res >= 19)) win += v * 2;
        if ((k2 === "d1" && res <= 12) || (k2 === "d2" && res >= 13 && res <= 24) || (k2 === "d3" && res >= 25)) win += v * 3;
      }
    }
    wal.coins += win; const net = win - tot;
    $("#msgR").textContent = `${res} ${res === 0 ? "vert" : red ? "rouge" : "noir"} · ${net > 0 ? `+${net} coins !` : net === 0 ? "rien de perdu" : `${net} coins`}`;
    $("#msgR").className = "msg " + (net > 0 ? "win" : "lose");
    document.querySelectorAll("#board .cell").forEach(c => c.classList.toggle("hit", c.dataset.k === "n:" + res));
    if (tot > wal.coins) bets = {}; markBets(); busy = false; save();
  };
  requestAnimationFrame(anim);
};

/* ---------- blackjack ---------- */
const bj = { active: false, bet: 5, p: [], d: [], doubled: false };
chips($("#chipsB"), () => bj.bet, v => bj.bet = v);
const SUITS = ["♠", "♥", "♦", "♣"], RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const draw1 = () => ({ r: RANKS[Math.floor(Math.random() * 13)], s: SUITS[Math.floor(Math.random() * 4)] });
function val(h) { let t = 0, a = 0; for (const c of h) { if (c.r === "A") { a++; t += 11; } else t += ["J", "Q", "K"].includes(c.r) ? 10 : +c.r; } while (t > 21 && a) { t -= 10; a--; } return t; }
const cardH = c => `<div class="card${c.s === "♥" || c.s === "♦" ? " red" : ""}"><span>${c.r}</span><span class="s">${c.s}</span></div>`;
function renderBJ(hide) {
  $("#ph").innerHTML = bj.p.map(cardH).join(""); $("#pv").textContent = bj.p.length ? `(${val(bj.p)})` : "";
  $("#dh").innerHTML = bj.d.map((c, i) => i === 1 && hide ? `<div class="card back"></div>` : cardH(c)).join(""); $("#dv").textContent = bj.d.length ? `(${hide ? val([bj.d[0]]) : val(bj.d)})` : "";
  $("#hit").disabled = $("#stand").disabled = !bj.active; $("#dbl").disabled = !bj.active || bj.p.length !== 2 || wal.coins < bj.bet;
  $("#deal").disabled = bj.active || wal.coins <= 0;
}
$("#deal").onclick = () => {
  if (bj.active || wal.coins < 1) return; if (bj.bet > wal.coins) bj.bet = wal.coins;
  wal.coins -= bj.bet; show(); bj.active = true; bj.doubled = false; bj.p = [draw1(), draw1()]; bj.d = [draw1(), draw1()];
  $("#msgB").textContent = ""; $("#msgB").className = "msg";
  if (val(bj.p) === 21) return endBJ(); renderBJ(true);
};
$("#hit").onclick = () => { if (!bj.active) return; bj.p.push(draw1()); if (val(bj.p) >= 21) return endBJ(); renderBJ(true); };
$("#stand").onclick = () => { if (bj.active) endBJ(); };
$("#dbl").onclick = () => { if (!bj.active || wal.coins < bj.bet) return; wal.coins -= bj.bet; bj.doubled = true; bj.p.push(draw1()); show(); endBJ(); };
function endBJ() {
  const stake = bj.bet * (bj.doubled ? 2 : 1), pv = val(bj.p), bjP = pv === 21 && bj.p.length === 2;
  if (pv <= 21 && !bjP) while (val(bj.d) < 17) bj.d.push(draw1());
  const dv = val(bj.d), bjD = dv === 21 && bj.d.length === 2;
  let pay = 0, msg;
  if (pv > 21) msg = "Tu dépasses 21. Perdu.";
  else if (bjP && !bjD) { pay = stake + Math.floor(stake * 1.5); msg = "Blackjack !"; }
  else if (bjD && !bjP) msg = "Blackjack du croupier. Perdu.";
  else if (dv > 21) { pay = stake * 2; msg = "Le croupier saute. Gagné !"; }
  else if (pv > dv) { pay = stake * 2; msg = "Gagné !"; }
  else if (pv === dv) { pay = stake; msg = "Égalité, mise rendue."; }
  else msg = "Le croupier gagne.";
  wal.coins += pay; bj.active = false; const net = pay - stake;
  $("#msgB").textContent = `${msg} ${net > 0 ? `+${net}` : net < 0 ? net : "±0"} coins`; $("#msgB").className = "msg " + (net > 0 ? "win" : net < 0 ? "lose" : "");
  renderBJ(false); save();
}

/* ---------- machine à sous ---------- */
const SYM = {
  cherry: `<svg viewBox="0 0 80 80"><path d="M40 12 Q30 30 24 46 M40 12 Q50 30 56 50" stroke="#15803d" stroke-width="4" fill="none"/><circle cx="24" cy="54" r="14" fill="#dc2626"/><circle cx="56" cy="56" r="14" fill="#b91c1c"/><circle cx="20" cy="50" r="4" fill="#fff8"/></svg>`,
  lemon: `<svg viewBox="0 0 80 80"><ellipse cx="40" cy="42" rx="28" ry="20" fill="#facc15"/><ellipse cx="32" cy="36" rx="8" ry="4" fill="#fff8"/></svg>`,
  bell: `<svg viewBox="0 0 80 80"><path d="M40 12c14 0 20 12 20 26v12l8 8H12l8-8V38c0-14 6-26 20-26z" fill="#f59e0b"/><circle cx="40" cy="64" r="7" fill="#b45309"/></svg>`,
  bar: `<svg viewBox="0 0 80 80"><rect x="8" y="26" width="64" height="28" rx="5" fill="#111"/><text x="40" y="48" text-anchor="middle" font-family="Inter" font-weight="900" font-size="20" fill="#fff">BAR</text></svg>`,
  star: `<svg viewBox="0 0 80 80"><path d="M40 8l9 20 22 2-17 15 5 22-19-12-19 12 5-22L9 30l22-2z" fill="#eab308" stroke="#a16207" stroke-width="2"/></svg>`,
  seven: `<svg viewBox="0 0 80 80"><text x="40" y="66" text-anchor="middle" font-family="Playfair Display,serif" font-weight="900" font-size="68" fill="#dc2626" stroke="#7f1d1d" stroke-width="2">7</text></svg>`
};
const REEL = ["cherry", "cherry", "cherry", "cherry", "lemon", "lemon", "lemon", "lemon", "bell", "bell", "bell", "bar", "bar", "star", "star", "seven"];
const PAY = { seven: 60, star: 25, bar: 12, bell: 8, lemon: 5, cherry: 4 };
let chipS = 1;
chips($("#chipsS"), () => chipS, v => chipS = v);
$("#pay").innerHTML = Object.entries(PAY).map(([k, v]) => `<span>${SYM[k]}${SYM[k]}${SYM[k]} × ${v}</span>`).join("") + `<span>${SYM.cherry}${SYM.cherry} × 2</span><span>${SYM.cherry} × 1</span>`;
for (let i = 0; i < 3; i++) $("#r" + i).innerHTML = SYM[["seven", "star", "bell"][i]];
$("#pull").onclick = () => {
  if (busy || wal.coins < 1) return; const bet = Math.min(chipS, wal.coins);
  busy = true; wal.coins -= bet; show(); $("#msgS").textContent = ""; $("#msgS").className = "msg";
  const res = [0, 1, 2].map(() => REEL[Math.floor(Math.random() * REEL.length)]);
  [0, 1, 2].forEach(i => { const r = $("#r" + i); r.classList.add("spin"); const iv = setInterval(() => { r.innerHTML = SYM[REEL[Math.floor(Math.random() * REEL.length)]]; }, 80); setTimeout(() => { clearInterval(iv); r.classList.remove("spin"); r.innerHTML = SYM[res[i]]; if (i === 2) finish(); }, 900 + i * 450); });
  function finish() {
    let mult = 0; if (res[0] === res[1] && res[1] === res[2]) mult = PAY[res[0]];
    else { const ch = res.filter(s => s === "cherry").length; mult = ch === 2 ? 2 : ch === 1 ? 1 : 0; }
    const win = bet * mult; wal.coins += win; const net = win - bet;
    $("#msgS").textContent = mult >= 8 ? `JACKPOT ! +${net} coins` : net > 0 ? `+${net} coins` : net === 0 ? "Mise récupérée" : `${net} coin${-net > 1 ? "s" : ""}`;
    $("#msgS").className = "msg " + (net > 0 ? "win" : net < 0 ? "lose" : ""); busy = false; save();
  }
};

board(); drawWheel(); renderBJ(); show();
window.CASINO = { get wal() { return wal; }, spend(n) { if (n > wal.coins || n <= 0) return false; wal.coins -= n; show(); return true; }, gain(n) { wal.coins += n; show(); }, commit: save, get online() { return online; } };
}
