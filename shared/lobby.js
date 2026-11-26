/* Salons multijoueurs communs aux jeux de l'arcade (Blast, Fenwick, Dessine et devine).
   Un joueur crée un salon (code à 5 caractères), les autres le rejoignent, l'hôte lance.
   Base temps réel : rooms/{code}/{meta, players, live, score, ev, state, draw, chat}. */
"use strict";
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PAL = ["#f59e0b", "#22c55e", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#3b82f6"];
const css = document.createElement("style");
css.textContent = `.lb{position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;padding:16px;background:#07051099;backdrop-filter:blur(4px)}
.lb[hidden]{display:none!important}
.lb-box{width:min(460px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#120c24;border:2px solid var(--lbc,#facc15);border-radius:16px;padding:22px;color:#f5f3ff;font:16px/1.5 Inter,system-ui,sans-serif;box-shadow:0 0 0 4px #0a0716,0 0 30px color-mix(in srgb,var(--lbc,#facc15) 35%,transparent);text-align:center}
.lb-box h1{font:800 34px "Inter Tight",Inter,sans-serif;margin:0 0 6px;letter-spacing:.02em}
.lb-box p{margin:8px 0;color:#c4b5fd}
.lb-code{font:800 46px "Inter Tight",Inter,sans-serif;letter-spacing:10px;color:var(--lbc,#facc15);margin:4px 0}
.lb-btn{min-height:50px;padding:10px 24px;border:0;border-radius:12px;background:var(--lbc,#facc15);color:#0a0716;font:800 17px Inter,sans-serif;cursor:pointer;margin:6px 4px}
.lb-btn:disabled{opacity:.45;cursor:not-allowed}
.lb-ghost{min-height:44px;padding:8px 16px;border:2px solid #4c1d95;border-radius:10px;background:transparent;color:#f5f3ff;font:600 15px Inter,sans-serif;cursor:pointer;margin:6px 4px;text-decoration:none;display:inline-flex;align-items:center}
.lb-ghost[aria-pressed=true]{background:#f5f3ff;color:#120c24;border-color:#f5f3ff}
.lb-btn:focus-visible,.lb-ghost:focus-visible,.lb-in:focus-visible{outline:3px solid #fff;outline-offset:2px}
.lb-in{min-height:52px;width:160px;text-align:center;font:800 24px Inter,sans-serif;letter-spacing:5px;text-transform:uppercase;border-radius:12px;border:2px solid #4c1d95;background:#0a0716;color:#fff}
.lb-row{display:flex;gap:10px;align-items:center;padding:8px 12px;margin:6px 0;border-radius:10px;background:#1a1235;text-align:left}
.lb-dot{width:12px;height:12px;border-radius:50%;flex:none}
.lb-err{color:#fca5a5;font-weight:700;min-height:1.4em}
.lb-small{font-size:14px;color:#a78bfa}
.lb-hr{border:0;border-top:1px dashed #3b2d6b;margin:16px 0}
.lb table{width:100%;border-collapse:collapse;font-size:15px;margin:10px 0}.lb th{color:#a78bfa;font-weight:600;text-align:left;padding:4px}.lb td{padding:6px 4px;border-top:1px solid #2a1f4f;text-align:left}.lb td.n,.lb th.n{text-align:right;font-variant-numeric:tabular-nums}`;
document.head.appendChild(css);
const box = document.createElement("div"); box.className = "lb"; box.hidden = true; box.innerHTML = `<div class="lb-box" role="dialog" aria-modal="true"></div>`; document.body.appendChild(box);
const show = html => { box.hidden = false; box.firstChild.innerHTML = html; const f = box.querySelector("input,.lb-btn"); if (f && !/Mobi/.test(navigator.userAgent)) f.focus(); };
const hide = () => { box.hidden = true; };

let G = null, R = null, code = null, meta = null, offset = 0, joinedAt = 0, unsub = [], playing = false, ended = false;
const ctx = { players: {}, live: {}, score: {}, state: null, get meta() { return meta; }, get code() { return code; }, get uid() { return R && R.uid; }, get pseudo() { return R && R.pseudo; } };
const now = () => Date.now() + offset;
const ref = path => R.d.ref(R.rdb, `rooms/${code}/${path}`);
const isHost = () => !!(meta && R && meta.host === R.uid);
const colorOf = uid => { const order = Object.entries(ctx.players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)).map(x => x[0]); const i = order.indexOf(uid); if (i >= 0) return PAL[i % PAL.length]; let h = 0; for (const c of String(uid)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
Object.assign(ctx, {
  now, isHost, colorOf, esc,
  setLive: v => code && R.d.set(ref(`live/${R.uid}`), v),
  setScore: v => code && R.d.update(ref(`score/${R.uid}`), v),
  setState: v => code && isHost() && R.d.set(ref("state"), v),
  updState: v => code && isHost() && R.d.update(ref("state"), v),
  push: (path, v) => code && R.d.push(ref(path), Object.assign({ from: R.uid, t: R.d.serverTimestamp() }, v)),
  ev: v => ctx.push("ev", v),
  clear: path => code && isHost() && R.d.remove(ref(path)),
  end: extra => code && isHost() && R.d.update(ref("meta"), Object.assign({ state: "end", endAt: R.d.serverTimestamp() }, extra || {})),
  sub: (path, cb, child) => { const r = child ? R.d.query(ref(path), R.d.limitToLast(child)) : ref(path); const u = child ? R.d.onChildAdded(r, s => cb(s.val(), s.key)) : R.d.onValue(r, s => cb(s.val())); unsub.push(u); return u; },
  serverTS: () => R.d.serverTimestamp()
});

async function ensure() {
  if (R) return true;
  const back = `<button class="lb-ghost" id="lbback">Retour</button>`;
  if (!window.ONLINE) { show(`<h1>Multijoueur</h1><p>Le service en ligne n'est pas encore chargé. Réessaie dans un instant.</p>${back}`); $("#lbback").onclick = hide; return false; }
  const prof = await new Promise(r => window.ONLINE.onReady(r));
  if (!prof) { show(`<h1>Multijoueur</h1><p>Il te faut un pseudo d'arcade pour jouer avec tes collègues.</p><a class="lb-btn" style="display:inline-flex;align-items:center;text-decoration:none" href="${document.documentElement.dataset.root || "../"}#profil">Créer mon pseudo</a><br>${back}`); $("#lbback").onclick = hide; return false; }
  try { R = await window.ONLINE.realtime(); } catch (e) { show(`<h1>Multijoueur</h1><p>${esc(e.message)}</p>${back}`); $("#lbback").onclick = hide; return false; }
  if (!R) { show(`<h1>Multijoueur</h1><p>Connexion impossible au serveur temps réel.</p>${back}`); $("#lbback").onclick = hide; return false; }
  R.d.onValue(R.d.ref(R.rdb, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
  return true;
}

async function menu() {
  if (!(await ensure())) return;
  const modes = G.modes ? Object.entries(G.modes) : [];
  let mode = modes.length ? modes[0][0] : "std";
  show(`<h1>${esc(G.title)}</h1><p>Crée un salon et donne le code à tes collègues, ou rejoins le leur.</p>
    ${modes.length > 1 ? `<div>${modes.map(([k, m]) => `<button class="lb-ghost lbmode" data-m="${k}" aria-pressed="${k === mode}">${esc(m.name)}</button>`).join("")}</div><p class="lb-small" id="lbmdesc"></p>` : ""}
    <button class="lb-btn" id="lbcreate">Créer un salon</button>
    <hr class="lb-hr">
    <form id="lbjf" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><input class="lb-in" id="lbcode" maxlength="5" placeholder="CODE" autocomplete="off" aria-label="Code du salon"><button class="lb-btn" style="background:#3b82f6;color:#fff;margin:0">Rejoindre</button></form>
    <p class="lb-err" id="lberr"></p><button class="lb-ghost" id="lbback">Retour</button>`);
  const pick = k => { mode = k; document.querySelectorAll(".lbmode").forEach(b => b.setAttribute("aria-pressed", b.dataset.m === k)); if ($("#lbmdesc")) $("#lbmdesc").textContent = G.modes[k].desc || ""; };
  document.querySelectorAll(".lbmode").forEach(b => b.onclick = () => pick(b.dataset.m)); if (modes.length > 1) pick(mode);
  $("#lbcreate").onclick = () => create(mode);
  $("#lbjf").onsubmit = e => { e.preventDefault(); join($("#lbcode").value.trim().toUpperCase()); };
  $("#lbback").onclick = () => { hide(); G.onBack && G.onBack(); };
}
async function create(mode) {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c = "";
  for (let k = 0; k < 6; k++) {
    c = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join("");
    const v = (await R.d.get(R.d.ref(R.rdb, `rooms/${c}/meta`))).val();
    if (!v || now() - (v.created || 0) > 6 * 3600e3) break;
  }
  await R.d.set(R.d.ref(R.rdb, `rooms/${c}/meta`), Object.assign({ game: G.id, host: R.uid, mode, state: "lobby", created: R.d.serverTimestamp(), round: 0 }, G.metaDefaults ? G.metaDefaults(mode) : {}));
  join(c);
}
async function join(c) {
  const err = m => { if ($("#lberr")) $("#lberr").textContent = m; };
  if (!/^[A-Z0-9]{5}$/.test(c)) return err("Le code fait 5 caractères.");
  const m = (await R.d.get(R.d.ref(R.rdb, `rooms/${c}/meta`))).val();
  if (!m) return err("Salon introuvable. Vérifie le code.");
  if ((m.game || "tir") !== G.id) { const g = (window.ARCADE_GAMES || []).find(x => x.id === (m.game || "tir")); return err(`Ce code est un salon de ${g ? g.name : "un autre jeu"}.`); }
  const ps = (await R.d.get(R.d.ref(R.rdb, `rooms/${c}/players`))).val() || {};
  if (Object.keys(ps).length >= G.max && !ps[R.uid]) return err(`Salon complet (${G.max} joueurs maximum).`);
  if (m.state === "play" && !G.lateJoin && !ps[R.uid]) return err("La partie a déjà commencé. Attends la fin pour rejoindre.");
  code = c; meta = m; joinedAt = now(); ended = m.state === "end";
  await R.d.set(ref(`players/${R.uid}`), { pseudo: R.pseudo, joined: R.d.serverTimestamp() });
  for (const k of ["players", "live", "score"]) R.d.onDisconnect(ref(`${k}/${R.uid}`)).remove();
  await R.d.set(ref(`score/${R.uid}`), { pseudo: R.pseudo });
  ctx.sub("meta", v => { meta = v; onMeta(); });
  ctx.sub("players", v => { const before = Object.keys(ctx.players).length; ctx.players = v || {}; if (Object.keys(ctx.players).length > before && before > 0 && window.SFX) window.SFX.play("join"); if (!playing && meta && meta.state === "lobby") lobby(); G.onPlayers && G.onPlayers(ctx); });
  ctx.sub("live", v => { ctx.live = v || {}; });
  ctx.sub("score", v => { ctx.score = v || {}; if (meta && meta.state === "end" && !playing) results(); });
  ctx.sub("state", v => { ctx.state = v; G.onState && G.onState(ctx); });
  ctx.sub("ev", (e, k) => { if (!e || (typeof e.t === "number" && e.t < joinedAt - 2000)) return; G.onEvent && G.onEvent(e, ctx, k); }, 60);
  if (window.ONLINE) window.ONLINE.setDetail(`salon ${c}`);
  onMeta();
}
async function leave() {
  try { for (const k of ["players", "live", "score"]) await R.d.remove(ref(`${k}/${R.uid}`)); } catch (e) {}
  location.reload();
}
function lobby() {
  if (!meta || playing) return;
  const list = Object.entries(ctx.players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)), n = list.length, host = ctx.players[meta.host];
  const md = G.modes && G.modes[meta.mode];
  show(`<p class="lb-small">Donne ce code à tes collègues${md ? ` · <b>${esc(md.name)}</b>` : ""}</p><div class="lb-code">${code}</div>
    <div>${list.map(([uid, x]) => `<div class="lb-row"><span class="lb-dot" style="background:${colorOf(uid)}"></span><b style="flex:1">${esc(x.pseudo)}</b>${uid === meta.host ? `<span style="color:#facc15;font-size:13px">hôte</span>` : ""}</div>`).join("")}</div>
    <p class="lb-small">${n} / ${G.max} joueurs</p>
    ${G.lobbyExtra ? G.lobbyExtra(ctx) : ""}
    ${isHost() ? `<button class="lb-btn" id="lblaunch" ${n < G.min ? "disabled" : ""}>Lancer la partie</button>${n < G.min ? `<p class="lb-small">Il faut au moins ${G.min} joueurs.</p>` : ""}` : `<p>En attente que <b>${esc(host ? host.pseudo : "l'hôte")}</b> lance la partie…</p>`}
    <br><button class="lb-ghost" id="lbquit">Quitter le salon</button>`);
  if ($("#lblaunch")) $("#lblaunch").onclick = launch;
  $("#lbquit").onclick = leave;
  G.lobbyBind && G.lobbyBind(ctx);
}
async function launch() {
  if (!isHost()) return;
  const seed = Math.floor(Math.random() * 1e9);
  await R.d.remove(ref("ev")).catch(() => {}); await R.d.remove(ref("draw")).catch(() => {}); await R.d.remove(ref("chat")).catch(() => {});
  if (G.initState) await R.d.set(ref("state"), G.initState(ctx, seed)); else await R.d.remove(ref("state"));
  await R.d.update(ref("meta"), { state: "play", startAt: R.d.serverTimestamp(), seed, winner: "", round: (meta.round || 0) + 1 });
}
function onMeta() {
  if (!meta) { playing = false; show(`<h1>Salon fermé</h1><button class="lb-btn" id="lbback">Retour</button>`); $("#lbback").onclick = () => location.reload(); return; }
  if (meta.state === "play" && !playing) { playing = true; if (window.SFX) window.SFX.play("ok"); ended = false; joinedAt = Math.min(joinedAt, meta.startAt || joinedAt); hide(); R.d.set(ref(`score/${R.uid}`), { pseudo: R.pseudo }); G.onStart(ctx); }
  else if (meta.state === "end" && playing) { playing = false; ended = true; G.onEnd && G.onEnd(ctx); results(); }
  else if (meta.state === "end" && !playing) results();
  else if (meta.state === "lobby") { if (playing) { playing = false; G.onStop && G.onStop(ctx); } ended = false; lobby(); }
}
function results() {
  if (!meta || meta.state !== "end") return;
  const r = G.results(ctx);
  show(`${r}${isHost() ? `<button class="lb-btn" id="lbre">Revanche</button><button class="lb-ghost" id="lblob">Retour au salon</button>` : `<p class="lb-small">En attente de l'hôte pour la revanche…</p>`}<br><button class="lb-ghost" id="lbquit">Quitter</button>`);
  if ($("#lbre")) $("#lbre").onclick = launch;
  if ($("#lblob")) $("#lblob").onclick = () => R.d.update(ref("meta"), { state: "lobby" });
  $("#lbquit").onclick = leave;
}
// passage d'hôte si l'hôte part
setInterval(() => {
  if (!code || !meta || ctx.players[meta.host]) return;
  const first = Object.entries(ctx.players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))[0];
  if (first && first[0] === R.uid) R.d.update(ref("meta"), { host: R.uid });
}, 1500);

function autoOpen() {
  const h = location.hash, mm = /^#salon=([A-Za-z0-9]{5})$/.exec(h); if (!mm && h !== "#multi") return;
  history.replaceState(null, "", location.pathname + location.search);
  const t = setInterval(async () => { if (!window.ONLINE) return; clearInterval(t); const pn = document.getElementById("panel"); if (pn) pn.hidden = true; if (!(await ensure())) return; if (mm) { show(`<h1>${esc(G.title)}</h1><p>Connexion au salon…</p><p class="lb-err" id="lberr"></p>`); join(mm[1].toUpperCase()).then(() => { if (!code) { const e = $("#lberr") && $("#lberr").textContent; menu().then(() => { if ($("#lberr")) $("#lberr").textContent = e || ""; }); } }); } else menu(); }, 200);
}
window.LOBBY = { init(game) { G = Object.assign({ min: 2, max: 8 }, game); autoOpen(); }, menu, leave, ctx, show, hide, esc, get playing() { return playing; } };
})();
