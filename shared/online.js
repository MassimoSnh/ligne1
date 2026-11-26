/* Arcade : partie en ligne commune (Firebase) — compte, pseudo, collègues, scores par jeu, classements */
const V = "10.12.2";
const cfg = window.FIREBASE_CONFIG, GAMES = window.ARCADE_GAMES || [], WEEK = window.ARCADE_WEEK;
const ROOT = document.documentElement.dataset.root || "./";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const configured = !!(cfg && cfg.apiKey && !/COLLE/.test(cfg.apiKey));
let F = null, auth = null, db = null, me = null, prof = null, ready = false, busy = false, appRef = null, RT = null;
const waiters = [];
const PAGES = { ligne1: "Ligne 1", volt: "Volt", casino: "Le Casino", tir: "Bloc Assaut", tour: "La Tour" };
const pageName = () => { if ((document.documentElement.dataset.root || "./") === "./") return "l'accueil"; const m = location.pathname.match(/\/([a-z0-9]+)\/(index\.html)?$/); const g = m && GAMES.find(x => x.id === m[1]); return g ? g.name : "l'accueil"; };
let PRES = {}, presOn = false; const presSubs = [];
let pageDetail = "";
try { const p = new URLSearchParams(location.search).get("ami"); if (p) { sessionStorage.setItem("arc-ami", p); history.replaceState(null, "", location.pathname + location.hash); } } catch (e) {}
const pendingInvite = () => { try { return sessionStorage.getItem("arc-ami"); } catch (e) { return null; } };

function toast(msg) { const t = $("#toast"); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3500); }
const gdef = id => GAMES.find(g => g.id === id);
function arcadeTotal(games) { let s = 0; for (const g of GAMES) if (games && games[g.id]) s += Math.round(g.arcade(games[g.id]) || 0); return s + Math.min(5000, (games && games.defis && games.defis.bonus) || 0); }
/* ---------- défis de la semaine ---------- */
const defisOf = () => (window.ARCADE_DEFIS_OF ? window.ARCADE_DEFIS_OF(WEEK) : []);
function freshDefis(games) {
  const old = games.defis || {}, base = {};
  for (const d of defisOf()) base[d.key] = window.ARCADE_STAT(games, d.key);
  return { week: WEEK, base, done: [], bonus: old.bonus || 0, total: old.total || 0 };
}
// met à jour les défis dans games ; renvoie la liste des défis réussis à l'instant
function applyDefis(games) {
  if (!window.ARCADE_DEFIS_OF) return [];
  if (!games.defis || games.defis.week !== WEEK) games.defis = freshDefis(games);
  const D = games.defis = Object.assign({}, games.defis, { done: (games.defis.done || []).slice(), base: Object.assign({}, games.defis.base) }), won = [];
  for (const d of defisOf()) {
    if (D.base[d.key] === undefined) D.base[d.key] = window.ARCADE_STAT(games, d.key);
    if (D.done.includes(d.id)) continue;
    if (window.ARCADE_STAT(games, d.key) - D.base[d.key] >= d.need) { D.done.push(d.id); D.bonus = (D.bonus || 0) + d.pts; D.total = (D.total || 0) + 1; won.push(d); }
  }
  return won;
}
function defisState() {
  const games = (prof && prof.games) || {}, D = games.defis && games.defis.week === WEEK ? games.defis : null;
  return defisOf().map(d => { const base = D && D.base[d.key] !== undefined ? D.base[d.key] : window.ARCADE_STAT(games, d.key), cur = window.ARCADE_STAT(games, d.key); return Object.assign({}, d, { prog: Math.max(0, Math.min(d.need, cur - base)), done: !!(D && D.done.includes(d.id)) }); });
}
/* ---------- fil d'activité (base temps réel) ---------- */
async function feedPush(txt) { try { const r = await realtime(); if (r) r.d.push(r.d.ref(r.rdb, "feed"), { uid: r.uid, pseudo: prof.pseudo, txt: String(txt).slice(0, 100), t: r.d.serverTimestamp() }); } catch (e) {} }
const pageGame = () => { const m = location.pathname.match(/\/([a-z0-9]+)\/(index\.html)?$/); return m && GAMES.find(x => x.id === m[1]); };
const levelTotals = levels => { let p = 0, s = 0, n = 0; for (const k in levels) { p += levels[k].pts || 0; s += levels[k].s || 0; n++; } return { points: p, stars: s, done: n }; };

async function boot() {
  if (!configured) { ready = true; flush(); renderPill(); render(); return; }
  const [app, a, f] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]);
  F = Object.assign({}, a, f);
  const fa = app.initializeApp(cfg); appRef = fa; auth = a.getAuth(fa); db = f.getFirestore(fa);
  a.onAuthStateChanged(auth, async u => {
    me = u; prof = null;
    try {
      if (u) { const s = await F.getDoc(F.doc(db, "users", u.uid)); prof = s.exists() ? s.data() : null; if (prof) { await migrate(); await syncLevels(); await handleInvite(); startPresence(); if (!prof.games.defis || prof.games.defis.week !== WEEK) { try { await writeGames(Object.assign({}, prof.games)); } catch (e) {} } } }
    } catch (e) { console.error(e); toast("Connexion au serveur difficile."); }
    ready = true; flush(); renderPill(); render();
  });
}
function flush() { while (waiters.length) { try { waiters.shift()(prof); } catch (e) { console.error(e); } } }

/* ---------- écriture des scores ---------- */
async function writeGames(games) {
  const won = prof && prof.pseudo ? applyDefis(games) : [];
  const points = arcadeTotal(games);
  prof.games = games; prof.points = points;
  await F.updateDoc(F.doc(db, "users", me.uid), { games, points, updated: F.serverTimestamp() });
  for (const d of won) { toast(`Défi réussi : ${d.txt} · +${d.pts} pts`); feedPush(`a réussi le défi « ${d.txt} »`); }
}
async function migrate() {
  if (prof.levels && !(prof.games && prof.games.ligne1)) {
    const games = Object.assign({}, prof.games || {}); games.ligne1 = Object.assign({ levels: prof.levels }, levelTotals(prof.levels));
    await writeGames(games); await F.updateDoc(F.doc(db, "users", me.uid), { levels: F.deleteField(), stars: F.deleteField(), done: F.deleteField() }); delete prof.levels;
  } else if (!prof.games) { await writeGames({}); }
}
async function syncLevels() {
  const A = window.APP; if (!A || !A.game || !A.progress) return;
  const P = A.progress, games = Object.assign({}, prof.games || {}), g = Object.assign({ levels: {} }, games[A.game] || {}), levels = Object.assign({}, g.levels);
  let up = false;
  for (const k in levels) { if ((P.stars[k] || 0) < levels[k].s) P.stars[k] = levels[k].s; if (P.best && (!P.best[k] || P.best[k].pts < levels[k].pts)) P.best[k] = { t: levels[k].t || 0, pts: levels[k].pts }; }
  for (const k in P.stars) { const pts = P.best && P.best[k] ? P.best[k].pts : P.stars[k] * 100; if (!levels[k] || levels[k].pts < pts) { levels[k] = { s: Math.max(P.stars[k], levels[k] ? levels[k].s : 0), pts, t: P.best && P.best[k] ? P.best[k].t : null }; up = true; } }
  A.saveProgress(); if (A.refresh) A.refresh();
  if (up) { games[A.game] = Object.assign(g, { levels }, levelTotals(levels)); await writeGames(games); }
}
// jeux à niveaux (Ligne 1, Volt)
async function report(game, n, stars, pts, t) {
  if (!prof) return;
  const games = Object.assign({}, prof.games || {}), g = Object.assign({ levels: {} }, games[game] || {}), levels = Object.assign({}, g.levels), old = levels[n];
  if (old && old.pts >= pts && old.s >= stars) return;
  levels[n] = { s: Math.max(stars, old ? old.s : 0), pts: Math.max(pts, old ? old.pts : 0), t: t == null ? null : +(+t).toFixed(2) };
  games[game] = Object.assign(g, { levels }, levelTotals(levels));
  try { const before = prof.points || 0; await writeGames(games); toast(`+${prof.points - before} points d'arcade · total ${prof.points}`); renderPill(); const gd = gdef(game); if (prof.points - before >= 50 && gd) feedPush(`+${prof.points - before} pts à ${gd.name}`); } catch (e) { console.error(e); toast("Score non envoyé (connexion ?)"); }
}
// jeux libres (casino, tir, tour) : fn reçoit les données du jeu et renvoie les nouvelles
async function submit(game, fn) {
  if (!prof) return null;
  const games = Object.assign({}, prof.games || {}), next = fn(Object.assign({}, games[game] || {}));
  if (!next) return games[game];
  games[game] = next;
  try { const before = prof.points || 0; await writeGames(games); if (prof.points > before) toast(`+${prof.points - before} points d'arcade · total ${prof.points}`); renderPill(); const gd = gdef(game); if (prof.points - before >= 50 && gd) feedPush(`+${prof.points - before} pts à ${gd.name}`); } catch (e) { console.error(e); toast("Score non envoyé (connexion ?)"); }
  return next;
}
const game = id => (prof && prof.games && prof.games[id]) || null;

/* ---------- pseudo et collègues ---------- */
const PSEUDO = /^[A-Za-z0-9_-]{3,16}$/;
async function claim(pseudo) {
  if (!PSEUDO.test(pseudo)) throw new Error("3 à 16 caractères : lettres, chiffres, - ou _ (pas d'espace ni d'accent).");
  const low = pseudo.toLowerCase();
  await F.runTransaction(db, async tr => {
    const pr = F.doc(db, "pseudos", low), ur = F.doc(db, "users", me.uid);
    const ps = await tr.get(pr); if (ps.exists() && ps.data().uid !== me.uid) throw new Error(`Le pseudo « ${pseudo} » est déjà pris.`);
    const us = await tr.get(ur), old = us.exists() ? us.data() : null;
    if (old && old.pseudoLower && old.pseudoLower !== low) tr.delete(F.doc(db, "pseudos", old.pseudoLower));
    tr.set(pr, { uid: me.uid });
    tr.set(ur, Object.assign({ friends: [], games: {}, points: 0 }, old || {}, { pseudo, pseudoLower: low, updated: F.serverTimestamp() }));
  });
  prof = (await F.getDoc(F.doc(db, "users", me.uid))).data();
  await migrate(); await syncLevels(); startPresence();
}
async function findByPseudo(low) { const s = await F.getDocs(F.query(F.collection(db, "users"), F.where("pseudoLower", "==", low), F.limit(1))); return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }; }
async function handleInvite() {
  const p = pendingInvite(); if (!p || !prof) return; try { sessionStorage.removeItem("arc-ami"); } catch (e) {}
  const u = await findByPseudo(p.toLowerCase()); if (!u) return toast(`Le joueur « ${p} » n'existe pas.`); if (u.id === me.uid) return;
  await addFriend(u.id); toast(`${u.pseudo} est maintenant dans tes collègues.`);
}
async function addFriend(id) { if ((prof.friends || []).includes(id)) return; await F.updateDoc(F.doc(db, "users", me.uid), { friends: F.arrayUnion(id) }); prof.friends = [...(prof.friends || []), id]; }
async function removeFriend(id) { await F.updateDoc(F.doc(db, "users", me.uid), { friends: F.arrayRemove(id) }); prof.friends = (prof.friends || []).filter(x => x !== id); }
async function usersByIds(ids) { const out = []; for (let i = 0; i < ids.length; i += 30) { const s = await F.getDocs(F.query(F.collection(db, "users"), F.where(F.documentId(), "in", ids.slice(i, i + 30)))); s.forEach(d => out.push({ id: d.id, ...d.data() })); } return out; }
async function followers() { const s = await F.getDocs(F.query(F.collection(db, "users"), F.where("friends", "array-contains", me.uid), F.limit(100))); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
const inviteLink = () => new URL(ROOT + "?ami=" + encodeURIComponent(prof.pseudo), location.href).href;

/* ---------- rendu ---------- */
function renderPill() {
  const el = $("#pill"); if (!el) return;
  const href = ROOT + "#profil";
  if (!configured) { el.innerHTML = `<a class="pillbtn" href="${href}">Jeu en ligne</a>`; return; }
  const n = Object.keys(PRES).length;
  el.innerHTML = (prof ? `<a class="pillbtn me" href="${href}"><b>${esc(prof.pseudo)}</b>&nbsp;· ${prof.points || 0} pts</a>` : `<a class="pillbtn" href="${href}">Créer mon pseudo</a>`) + (n ? `<a class="pillbtn" href="${ROOT}#enligne" style="background:#14532d;border-color:#22c55e;color:#bbf7d0;margin-left:6px"><span style="width:9px;height:9px;border-radius:50%;background:#22c55e;margin-right:6px"></span>${n} en ligne</a>` : "");
}
let view = null, tab = "general", scope = "coll";
function show(v) { view = v; render(); }
function shell(title, body, bind) { const o = $("#online"); if (!o) return; o.onclick = null; o.innerHTML = `<h1>${title}</h1>${body}`; if (bind) bind(); }
async function render() {
  const o = $("#online"); if (!o || !view) return;
  if (!configured) return shell("Jeu en ligne", `<p class="lead">Le classement et les collègues fonctionnent sur la version publiée de l'arcade, une fois Firebase configuré.</p>`);
  if (!ready) return shell("Connexion…", `<p class="lead">Connexion au serveur…</p>`);
  if (!me) return shell("Rejoindre l'arcade", `<p class="lead">Un seul compte pour tous les jeux. Avec Google, tu retrouves ta partie sur ton téléphone et ton PC.</p>
    <div class="row"><button class="cta" id="g">Continuer avec Google</button><button class="ghost" id="anon">Jouer en invité</button></div>
    <p class="small">En invité, ta partie reste liée à ce navigateur. Tu pourras la lier à Google plus tard.</p>`, () => {
      $("#g").onclick = async () => { try { await F.signInWithPopup(auth, new F.GoogleAuthProvider()); } catch (e) { toast("Connexion Google annulée."); } };
      $("#anon").onclick = async () => { try { await F.signInAnonymously(auth); } catch (e) { toast("Connexion impossible."); } };
    });
  if (!prof) return pseudoForm("Choisis ton pseudo", "");
  if (view === "profil") return renderProfile();
  if (view === "collegues") return renderColleagues();
  if (view === "classement") return renderBoard();
}
function pseudoForm(title, value) {
  const inv = pendingInvite();
  shell(title, `<p class="lead">C'est le nom que tes collègues verront et chercheront. Il est unique : personne d'autre ne pourra le prendre.</p>
    <form id="pf" class="row"><input id="ps" maxlength="16" autocomplete="off" placeholder="ex : Tony-Auto" value="${esc(value)}" aria-label="Pseudo"><button class="cta">Valider</button>${prof ? `<button type="button" class="ghost" id="cancel">Annuler</button>` : ""}</form><p class="err" id="perr"></p>
    ${inv && !prof ? `<p class="small">Après ça, tu seras relié à <b>${esc(inv)}</b>, qui t'a invité.</p>` : ""}`, () => {
      if ($("#cancel")) $("#cancel").onclick = () => render();
      $("#pf").onsubmit = async e => {
        e.preventDefault(); if (busy) return; busy = true; $("#perr").textContent = "";
        try { await claim($("#ps").value.trim()); await handleInvite(); renderPill(); view = "profil"; render(); toast("Pseudo enregistré !"); }
        catch (err) { $("#perr").textContent = /permission/i.test(err.message) ? "Refusé par le serveur. Vérifie les règles Firestore." : err.message; }
        busy = false;
      };
    });
}
function renderProfile() {
  const anon = me.isAnonymous, G = prof.games || {};
  shell(esc(prof.pseudo), `<div class="kpis"><div><b>${prof.points || 0}</b><span>points d'arcade</span></div><div><b>${(prof.friends || []).length}</b><span>collègues</span></div></div>
    <h2>Mes jeux</h2><div class="list">${(G.defis && G.defis.bonus) ? `<div class="prow"><span class="dotc" style="background:#facc15"></span><span class="pn">Défis de la semaine</span><span class="pp">${G.defis.total || 0} réussi${(G.defis.total || 0) > 1 ? "s" : ""}</span><span class="small">+${Math.min(5000, G.defis.bonus)}</span></div>` : ""}${GAMES.map(g => `<a class="prow" href="${ROOT}${g.url}" style="text-decoration:none;color:inherit"><span class="dotc" style="background:${g.color}"></span><span class="pn">${g.name}</span><span class="pp">${G[g.id] ? g.metric(G[g.id]) : "pas encore joué"}</span><span class="small">+${G[g.id] ? Math.round(g.arcade(G[g.id])) : 0}</span></a>`).join("")}</div>
    <h2>Inviter des collègues</h2><p>Envoie ce lien : en l'ouvrant, ils créent leur pseudo et vous êtes reliés.</p>
    <div class="row"><input readonly value="${esc(inviteLink())}" id="inv" aria-label="Lien d'invitation"><button class="cta" id="cp">Copier le lien</button></div>
    <h2>Mon compte</h2><div class="row">${anon ? `<button class="ghost" id="link">Lier à Google</button>` : ""}<button class="ghost" id="ren">Changer de pseudo</button><button class="ghost" id="out">Se déconnecter</button></div>
    ${anon ? `<p class="small">Tu joues en invité : lie ton compte à Google pour ne pas perdre ta partie.</p>` : ""}`, () => {
      $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(inviteLink()); toast("Lien copié !"); } catch (e) { $("#inv").select(); toast("Sélectionne et copie le lien"); } };
      $("#out").onclick = () => F.signOut(auth);
      $("#ren").onclick = () => pseudoForm("Changer de pseudo", prof.pseudo);
      if (anon) $("#link").onclick = async () => { try { await F.linkWithPopup(me, new F.GoogleAuthProvider()); toast("Compte lié à Google."); render(); } catch (e) { toast(e.code === "auth/credential-already-in-use" ? "Ce compte Google a déjà une partie." : "Liaison impossible."); } };
    });
}
const row = (u, right, rank) => `<div class="prow${me && u.id === me.uid ? " meRow" : ""}" data-uid="${esc(u.id)}">${rank ? `<span class="rk">${rank}</span>` : ""}<span class="pn">${esc(u.pseudo)}</span>${right || ""}</div>`;
async function renderColleagues() {
  shell("Mes collègues", `<form id="sf" class="row"><input id="q" placeholder="Chercher un pseudo" autocomplete="off" aria-label="Chercher un pseudo"><button class="cta">Chercher</button></form>
    <div id="res"></div><h2>Mes collègues</h2><div id="mine" class="list"><p class="small">Chargement…</p></div><h2>Ils m'ont ajouté</h2><div id="fol" class="list"><p class="small">Chargement…</p></div>`, () => {
      $("#sf").onsubmit = async e => {
        e.preventDefault(); const q = $("#q").value.trim().toLowerCase(); if (q.length < 2) return;
        const s = await F.getDocs(F.query(F.collection(db, "users"), F.orderBy("pseudoLower"), F.where("pseudoLower", ">=", q), F.where("pseudoLower", "<=", q + ""), F.limit(10)));
        const rows = s.docs.filter(d => d.id !== me.uid).map(d => row({ id: d.id, ...d.data() }, `<span class="pp">${d.data().points || 0} pts</span>${(prof.friends || []).includes(d.id) ? `<span class="small">déjà ajouté</span>` : `<button class="mini2" data-add="${d.id}">Ajouter</button>`}`));
        $("#res").innerHTML = rows.length ? `<div class="list">${rows.join("")}</div>` : `<p class="small">Personne avec ce pseudo.</p>`;
      };
      $("#online").onclick = async e => {
        const a = e.target.closest("[data-add]"), d = e.target.closest("[data-del]");
        if (a) { await addFriend(a.dataset.add); toast("Collègue ajouté."); renderColleagues(); }
        if (d) { await removeFriend(d.dataset.del); renderColleagues(); }
      };
    });
  const mine = await usersByIds(prof.friends || []), fol = await followers();
  $("#mine").innerHTML = mine.length ? mine.map(u => row(u, `<span class="pp">${u.points || 0} pts</span><button class="mini2" data-del="${u.id}">Retirer</button>`)).join("") : `<p class="small">Aucun collègue pour l'instant. Partage ton lien d'invitation depuis ton profil.</p>`;
  const back = fol.filter(u => !(prof.friends || []).includes(u.id));
  setTimeout(markOnline, 0);
  $("#fol").innerHTML = back.length ? back.map(u => row(u, `<button class="mini2" data-add="${u.id}">Ajouter aussi</button>`)).join("") : `<p class="small">Rien de nouveau.</p>`;
}
async function renderBoard() {
  const tabs = [{ id: "general", name: "Général" }, ...GAMES];
  const g = gdef(tab);
  shell("Classement", `<div class="row tabs2" role="tablist">${tabs.map(t => `<button class="ghost" aria-pressed="${tab === t.id}" data-t="${t.id}">${t.name}</button>`).join("")}</div>
    <div class="row tabs2" style="margin-top:8px"><button class="ghost" aria-pressed="${scope === "coll"}" data-s="coll">Mes collègues</button><button class="ghost" aria-pressed="${scope === "all"}" data-s="all">Tout le monde</button></div>
    <p class="small">${g ? g.rule : "Le général additionne les points d'arcade de chaque jeu."}${g && g.weekly ? ` Semaine ${WEEK}.` : ""}</p><div id="board" class="list"><p class="small">Chargement…</p></div>`, () => {
      $("#online").onclick = e => { const b = e.target.closest("[data-t]"), s = e.target.closest("[data-s]"); if (b) { tab = b.dataset.t; renderBoard(); } if (s) { scope = s.dataset.s; renderBoard(); } };
    });
  const val = u => { const d = u.games && g ? u.games[g.id] : null; if (!g) return u.points || 0; if (!d) return -1; if (g.weekly && d.week !== WEEK) return -1; return d[g.rank] || 0; };
  let list;
  if (scope === "all") {
    const field = g ? `games.${g.id}.${g.rank}` : "points";
    const s = await F.getDocs(F.query(F.collection(db, "users"), F.orderBy(field, "desc"), F.limit(100))); list = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } else { const ids = new Set(prof.friends || []); (await followers()).forEach(u => ids.add(u.id)); list = await usersByIds([...ids]); list.push({ id: me.uid, ...prof }); }
  list = list.filter(u => val(u) >= 0 || u.id === me.uid).sort((a, b) => val(b) - val(a)).slice(0, 50);
  setTimeout(markOnline, 0);
  $("#board").innerHTML = list.length ? list.map((u, i) => row(u, `<span class="pp">${g ? (u.games && u.games[g.id] && val(u) >= 0 ? g.metric(u.games[g.id]) : "—") : (u.points || 0) + " pts"}</span>`, i + 1)).join("") + (scope === "coll" && list.length < 2 ? `<p class="small">Ajoute des collègues pour te comparer à eux.</p>` : "") : `<p class="small">Personne n'a encore joué ici.</p>`;
}

window.ONLINE_LEADERS = async () => {
  if (!prof) return [];
  const out = await Promise.all(GAMES.filter(g => g.rank && g.id !== "casino").map(async g => { try { const s = await F.getDocs(F.query(F.collection(db, "users"), F.orderBy(`games.${g.id}.${g.rank}`, "desc"), F.limit(1))); const d = s.docs[0]; return d && d.data().games && d.data().games[g.id] ? { game: g, pseudo: d.data().pseudo, metric: g.metric(d.data().games[g.id]), me: d.id === me.uid } : null; } catch (e) { return null; } }));
  return out.filter(Boolean);
};
window.ONLINE_TOP = async () => { if (!prof) return []; const s = await F.getDocs(F.query(F.collection(db, "users"), F.orderBy("points", "desc"), F.limit(5))); return s.docs.map(d => ({ ...d.data(), me: d.id === me.uid })); };
async function realtime() {
  if (!configured || !me || !prof || !appRef) return null;
  if (!cfg.databaseURL) throw new Error("La base temps réel n'est pas configurée (databaseURL manquant dans firebase-config.js).");
  if (!RT) { const d = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-database.js`); RT = { d, rdb: d.getDatabase(appRef) }; }
  return { d: RT.d, rdb: RT.rdb, uid: me.uid, pseudo: prof.pseudo };
}
async function startPresence() {
  if (presOn) return; presOn = true;
  try {
    const r = await realtime(); if (!r) { presOn = false; return; }
    const { d, rdb, uid } = r, ref = d.ref(rdb, `presence/${uid}`);
    d.onValue(d.ref(rdb, ".info/connected"), s => { if (s.val() === true) { d.onDisconnect(ref).remove(); d.set(ref, { pseudo: prof.pseudo, page: pageName(), detail: pageDetail, t: d.serverTimestamp() }); } });
    d.onValue(d.ref(rdb, "presence"), s => { PRES = s.val() || {}; presSubs.forEach(f => { try { f(PRES); } catch (e) {} }); renderPill(); if (view === "collegues" || view === "classement") markOnline(); });
  } catch (e) { console.warn("présence", e); presOn = false; }
}
async function setDetail(txt) { pageDetail = txt || ""; try { const r = await realtime(); if (r) r.d.update(r.d.ref(r.rdb, `presence/${r.uid}`), { detail: pageDetail }); } catch (e) {} }
function markOnline() { document.querySelectorAll("[data-uid]").forEach(el => { const on = PRES[el.dataset.uid]; el.querySelector(".ondot")?.remove(); if (on) el.insertAdjacentHTML("afterbegin", `<span class="ondot" title="En ligne : ${esc(on.page)}" style="width:10px;height:10px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;flex:none"></span>`); }); }
function feed(cb) { realtime().then(r => { if (!r) return; r.d.onValue(r.d.query(r.d.ref(r.rdb, "feed"), r.d.limitToLast(12)), s => { const v = s.val() || {}; cb(Object.values(v).sort((a, b) => (b.t || 0) - (a.t || 0))); }); }).catch(() => {}); }
window.ONLINE = { feed, get defis() { return defisState(); }, report, submit, game, realtime, presence: cb => { presSubs.push(cb); cb(PRES); }, setDetail, get online() { return PRES; }, show, toast, configured, onReady: cb => { if (ready) cb(prof); else waiters.push(cb); }, get profile() { return prof; } };
renderPill();
if (window.ONLINE_VIEW) show(window.ONLINE_VIEW);
boot().catch(e => { console.error(e); ready = true; flush(); toast("Serveur injoignable : jeu hors ligne."); });
