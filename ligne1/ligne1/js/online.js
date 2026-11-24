/* Ligne 1 : partie en ligne (Firebase) — pseudo, collègues, classement */
const V = "10.12.2";
const cfg = window.FIREBASE_CONFIG;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const configured = cfg && cfg.apiKey && !/COLLE/.test(cfg.apiKey);

let F = null, auth = null, db = null, me = null, prof = null, ready = false, busy = false;
const pending = (() => { try { const p = new URLSearchParams(location.search).get("ami"); if (p) { sessionStorage.setItem("l1-ami", p); history.replaceState(null, "", location.pathname + location.hash); } return sessionStorage.getItem("l1-ami"); } catch (e) { return null; } })();

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 3500); }
function pointsFor(n, stars, t) {
  const tg = (window.TARGETS || {})[n] || { t: 60 };
  return stars * 100 + Math.max(0, Math.round(100 * (2 * tg.t - t) / (2 * tg.t)));
}
const totals = levels => { let p = 0, s = 0, n = 0; for (const k in levels) { p += levels[k].pts || 0; s += levels[k].s || 0; n++; } return { points: p, stars: s, done: n }; };

async function boot() {
  if (!configured) { ready = true; render(); return; }
  const [app, a, f] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]);
  F = Object.assign({}, a, f);
  const fa = app.initializeApp(cfg); auth = a.getAuth(fa); db = f.getFirestore(fa);
  a.onAuthStateChanged(auth, async u => {
    me = u; prof = null;
    if (u) { const s = await F.getDoc(F.doc(db, "users", u.uid)); prof = s.exists() ? s.data() : null; if (prof) { await syncProgress(); await handleInvite(); } }
    ready = true; renderPill(); render();
  });
}

/* ---------- progression ---------- */
async function syncProgress() {
  const P = window.APP.progress, levels = Object.assign({}, prof.levels || {}); let changed = false;
  for (const k in levels) if ((P.stars[k] || 0) < levels[k].s) { P.stars[k] = levels[k].s; }
  for (const k in P.stars) if (!levels[k] && P.stars[k] > 0) { levels[k] = { s: P.stars[k], pts: P.stars[k] * 100, t: null }; changed = true; }
  window.APP.saveProgress(); window.APP.refresh();
  if (changed) await saveLevels(levels);
}
async function saveLevels(levels) {
  const t = totals(levels); prof.levels = levels; Object.assign(prof, t);
  await F.updateDoc(F.doc(db, "users", me.uid), { levels, points: t.points, stars: t.stars, done: t.done, updated: F.serverTimestamp() });
}
async function report(n, stars, time) {
  if (!prof || !stars) return;
  const pts = pointsFor(n, stars, time), old = (prof.levels || {})[n];
  if (old && old.pts >= pts && old.s >= stars) return;
  const levels = Object.assign({}, prof.levels || {}); levels[n] = { s: Math.max(stars, old ? old.s : 0), pts: Math.max(pts, old ? old.pts : 0), t: +time.toFixed(1) };
  try { await saveLevels(levels); toast(`+${levels[n].pts - (old ? old.pts : 0)} points · total ${prof.points}`); renderPill(); } catch (e) { toast("Score non envoyé (connexion ?)"); }
}

/* ---------- pseudo ---------- */
const PSEUDO = /^[A-Za-z0-9_-]{3,16}$/;
async function claim(pseudo) {
  if (!PSEUDO.test(pseudo)) throw new Error("3 à 16 caractères : lettres, chiffres, - ou _ (pas d'espace ni d'accent).");
  const low = pseudo.toLowerCase(), P = window.APP.progress, levels = {};
  for (const k in P.stars) if (P.stars[k] > 0) levels[k] = { s: P.stars[k], pts: P.stars[k] * 100, t: null };
  const t = totals(levels);
  await F.runTransaction(db, async tr => {
    const pr = F.doc(db, "pseudos", low), ur = F.doc(db, "users", me.uid);
    const ps = await tr.get(pr); if (ps.exists() && ps.data().uid !== me.uid) throw new Error(`Le pseudo « ${pseudo} » est déjà pris.`);
    const us = await tr.get(ur); const old = us.exists() ? us.data() : null;
    if (old && old.pseudoLower && old.pseudoLower !== low) tr.delete(F.doc(db, "pseudos", old.pseudoLower));
    tr.set(pr, { uid: me.uid });
    tr.set(ur, Object.assign({ friends: [], levels }, old || {}, { pseudo, pseudoLower: low, updated: F.serverTimestamp() }, old ? {} : t));
  });
  const s = await F.getDoc(F.doc(db, "users", me.uid)); prof = s.data();
}
async function findByPseudo(low) { const s = await F.getDocs(F.query(F.collection(db, "users"), F.where("pseudoLower", "==", low), F.limit(1))); return s.empty ? null : { id: s.docs[0].id, ...s.docs[0].data() }; }
async function handleInvite() {
  let p = null; try { p = sessionStorage.getItem("l1-ami"); } catch (e) {}
  if (!p || !prof) return; try { sessionStorage.removeItem("l1-ami"); } catch (e) {}
  const u = await findByPseudo(p.toLowerCase());
  if (!u) return toast(`Le joueur « ${p} » n'existe pas.`);
  if (u.id === me.uid) return;
  await addFriend(u.id); toast(`${u.pseudo} est maintenant dans tes collègues.`);
}
async function addFriend(id) { if ((prof.friends || []).includes(id)) return; await F.updateDoc(F.doc(db, "users", me.uid), { friends: F.arrayUnion(id) }); prof.friends = [...(prof.friends || []), id]; }
async function removeFriend(id) { await F.updateDoc(F.doc(db, "users", me.uid), { friends: F.arrayRemove(id) }); prof.friends = (prof.friends || []).filter(x => x !== id); }
async function usersByIds(ids) {
  const out = []; for (let i = 0; i < ids.length; i += 30) { const s = await F.getDocs(F.query(F.collection(db, "users"), F.where(F.documentId(), "in", ids.slice(i, i + 30)))); s.forEach(d => out.push({ id: d.id, ...d.data() })); }
  return out;
}
async function followers() { const s = await F.getDocs(F.query(F.collection(db, "users"), F.where("friends", "array-contains", me.uid), F.limit(100))); return s.docs.map(d => ({ id: d.id, ...d.data() })); }
const inviteLink = () => `${location.origin}${location.pathname}?ami=${encodeURIComponent(prof.pseudo)}`;

/* ---------- rendu ---------- */
function renderPill() {
  const el = $("#pill"); if (!el) return;
  if (!configured) { el.innerHTML = `<a class="pillbtn" href="#profil">Jouer en ligne</a>`; return; }
  el.innerHTML = prof ? `<a class="pillbtn me" href="#profil"><b>${esc(prof.pseudo)}</b>&nbsp;· ${prof.points || 0} pts</a>` : `<a class="pillbtn" href="#profil">Créer mon pseudo</a>`;
}
let view = "profil", tab = "coll";
function show(v) { view = v; render(); }
function shell(title, body, bind) { $("#online").onclick = null; $("#online").innerHTML = `<h1>${title}</h1>${body}`; if (bind) bind(); }
async function render() {
  if ($("#vonline").hidden) return;
  if (!configured) return shell("Jeu en ligne", `<p class="lead">Le classement et les collègues fonctionnent sur la version publiée du jeu, une fois Firebase configuré. Ici, tu peux jouer normalement : ta progression est gardée sur cet appareil.</p>`);
  if (!ready) return shell("Connexion…", `<p class="lead">Connexion au serveur…</p>`);
  if (!me) return shell("Rejoindre le classement", `<p class="lead">Choisis comment te connecter. Avec Google, tu retrouves ta partie sur ton téléphone et ton PC.</p>
    <div class="row"><button class="cta" id="g">Continuer avec Google</button><button class="ghost" id="anon">Jouer en invité</button></div>
    <p class="small">En invité, ta partie reste liée à ce navigateur : si tu effaces ses données, tu la perds. Tu pourras la lier à Google plus tard.</p>`, bindLogin());
  if (!prof) return shell("Choisis ton pseudo", `<p class="lead">C'est le nom que tes collègues verront et chercheront. Il est unique : personne d'autre ne pourra le prendre.</p>
    <form id="pf" class="row"><input id="ps" maxlength="16" autocomplete="off" placeholder="ex : Tony-Auto" aria-label="Pseudo"><button class="cta">Valider</button></form><p class="err" id="perr"></p>
    ${pending ? `<p class="small">Après ça, tu seras ajouté avec <b>${esc(pending)}</b> qui t'a invité.</p>` : ""}`, bindPseudo());
  if (view === "profil") {
    const anon = me.isAnonymous;
    shell(esc(prof.pseudo), `<div class="kpis"><div><b>${prof.points || 0}</b><span>points</span></div><div><b>${prof.stars || 0}</b><span>étoiles / 60</span></div><div><b>${prof.done || 0}</b><span>niveaux réussis</span></div><div><b>${(prof.friends || []).length}</b><span>collègues</span></div></div>
      <h2>Inviter des collègues</h2><p>Envoie ce lien : en l'ouvrant, ils créent leur pseudo et vous êtes reliés automatiquement.</p>
      <div class="row"><input readonly value="${esc(inviteLink())}" id="inv" aria-label="Lien d'invitation"><button class="cta" id="cp">Copier le lien</button></div>
      <h2>Mon compte</h2><div class="row">${anon ? `<button class="ghost" id="link">Lier à mon compte Google</button>` : ""}<button class="ghost" id="ren">Changer de pseudo</button><button class="ghost" id="out">Se déconnecter</button></div>
      ${anon ? `<p class="small">Tu joues en invité : lie ton compte à Google pour ne pas perdre ta partie.</p>` : ""}`);
    $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(inviteLink()); toast("Lien copié !"); } catch (e) { $("#inv").select(); toast("Sélectionne et copie le lien"); } };
    $("#out").onclick = () => F.signOut(auth);
    $("#ren").onclick = renderRename;
    if (anon) $("#link").onclick = async () => { try { await F.linkWithPopup(me, new F.GoogleAuthProvider()); toast("Compte lié à Google."); render(); } catch (e) { toast(e.code === "auth/credential-already-in-use" ? "Ce compte Google a déjà une partie." : "Liaison impossible."); } };
    return;
  }
  if (view === "collegues") return renderColleagues();
  if (view === "classement") return renderBoard();
}
function renderRename() {
  shell("Changer de pseudo", `<form id="pf" class="row"><input id="ps" maxlength="16" value="${esc(prof.pseudo)}" aria-label="Nouveau pseudo"><button class="cta">Valider</button><button type="button" class="ghost" id="cancel">Annuler</button></form><p class="err" id="perr"></p>`, bindPseudo());
  $("#cancel").onclick = () => render();
}
function bindLogin() { return () => {
  $("#g").onclick = async () => { try { await F.signInWithPopup(auth, new F.GoogleAuthProvider()); } catch (e) { toast("Connexion Google annulée."); } };
  $("#anon").onclick = async () => { try { await F.signInAnonymously(auth); } catch (e) { toast("Connexion impossible."); } };
}; }
function bindPseudo() { return () => {
  $("#pf").onsubmit = async e => {
    e.preventDefault(); if (busy) return; busy = true; $("#perr").textContent = "";
    try { await claim($("#ps").value.trim()); await handleInvite(); renderPill(); view = "profil"; render(); toast("Pseudo enregistré !"); }
    catch (err) { $("#perr").textContent = err.message.includes("permission") ? "Refusé par le serveur. Vérifie les règles Firestore." : err.message; }
    busy = false;
  };
}; }

async function renderColleagues() {
  shell("Mes collègues", `<form id="sf" class="row"><input id="q" placeholder="Chercher un pseudo" autocomplete="off" aria-label="Chercher un pseudo"><button class="cta">Chercher</button></form>
    <div id="res"></div><h2>Mes collègues</h2><div id="mine" class="list"><p class="small">Chargement…</p></div><h2>Ils m'ont ajouté</h2><div id="fol" class="list"><p class="small">Chargement…</p></div>
    <p class="small">Astuce : le lien d'invitation de ta page profil ajoute les collègues automatiquement.</p>`);
  $("#sf").onsubmit = async e => {
    e.preventDefault(); const q = $("#q").value.trim().toLowerCase(); if (q.length < 2) return;
    const s = await F.getDocs(F.query(F.collection(db, "users"), F.orderBy("pseudoLower"), F.where("pseudoLower", ">=", q), F.where("pseudoLower", "<=", q + ""), F.limit(10)));
    const rows = s.docs.filter(d => d.id !== me.uid).map(d => row({ id: d.id, ...d.data() }, (prof.friends || []).includes(d.id) ? `<span class="small">déjà ajouté</span>` : `<button class="mini2" data-add="${d.id}">Ajouter</button>`));
    $("#res").innerHTML = rows.length ? `<div class="list">${rows.join("")}</div>` : `<p class="small">Personne avec ce pseudo.</p>`;
  };
  const mine = await usersByIds(prof.friends || []), fol = await followers();
  $("#mine").innerHTML = mine.length ? mine.map(u => row(u, `<button class="mini2" data-del="${u.id}">Retirer</button>`)).join("") : `<p class="small">Aucun collègue pour l'instant.</p>`;
  const back = fol.filter(u => !(prof.friends || []).includes(u.id));
  $("#fol").innerHTML = back.length ? back.map(u => row(u, `<button class="mini2" data-add="${u.id}">Ajouter aussi</button>`)).join("") : `<p class="small">Rien de nouveau.</p>`;
  $("#online").onclick = async e => {
    const a = e.target.closest("[data-add]"), d = e.target.closest("[data-del]");
    if (a) { await addFriend(a.dataset.add); toast("Collègue ajouté."); renderColleagues(); }
    if (d) { await removeFriend(d.dataset.del); renderColleagues(); }
  };
}
const row = (u, right, rank) => `<div class="prow${u.id === (me && me.uid) ? " meRow" : ""}">${rank ? `<span class="rk">${rank}</span>` : ""}<span class="pn">${esc(u.pseudo)}</span><span class="pp">${u.points || 0} pts · ${u.stars || 0}★</span>${right || ""}</div>`;
async function renderBoard() {
  shell("Classement", `<div class="row tabs2"><button class="ghost" aria-pressed="${tab === "coll"}" data-t="coll">Mes collègues</button><button class="ghost" aria-pressed="${tab === "all"}" data-t="all">Tout le monde</button></div><div id="board" class="list"><p class="small">Chargement…</p></div>`);
  $("#online").onclick = e => { const b = e.target.closest("[data-t]"); if (b) { tab = b.dataset.t; renderBoard(); } };
  let list;
  if (tab === "all") { const s = await F.getDocs(F.query(F.collection(db, "users"), F.orderBy("points", "desc"), F.limit(50))); list = s.docs.map(d => ({ id: d.id, ...d.data() })); }
  else { const ids = new Set([...(prof.friends || [])]); (await followers()).forEach(u => ids.add(u.id)); list = await usersByIds([...ids]); list.push({ id: me.uid, ...prof }); list.sort((a, b) => (b.points || 0) - (a.points || 0)); }
  $("#board").innerHTML = list.length > 1 || tab === "all" ? list.map((u, i) => row(u, `<span class="small">${u.done || 0} niv.</span>`, i + 1)).join("") : row({ id: me.uid, ...prof }, "", 1) + `<p class="small">Ajoute des collègues pour te comparer à eux.</p>`;
}

window.ONLINE = { report, show, configured, renderPill };
renderPill();
boot().catch(e => { console.error(e); ready = true; toast("Serveur injoignable : jeu hors ligne."); });
