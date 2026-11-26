"use strict";
/* Bloc Assaut : multijoueur (Firebase Realtime Database) — salons à code, match à mort, domination */
{
const $ = s => document.querySelector(s), C = window.TIRCORE, T = C.T;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MODES = { ffa: { name: "Match à mort", desc: "Chacun pour soi. Le premier à 15 éliminations gagne.", limit: 15, time: 480 }, dom: { name: "Domination", desc: "Deux équipes, trois drapeaux A, B, C. Reste près d'un drapeau pour le capturer. Chaque drapeau tenu rapporte 1 point par seconde. Premier à 150.", limit: 150, time: 600 } };
const FLAGS = { A: { x: -27, z: -13 }, B: { x: -3.5, z: 13.5 }, C: { x: 27.5, z: -8 } };
const TEAMC = { A: 0x3b82f6, B: 0xef4444 }, TEAMN = { A: "Bleus", B: "Rouges" }, TEAMH = { A: "#3b82f6", B: "#ef4444" };
const PAL = [0xf59e0b, 0x22c55e, 0xa855f7, 0x06b6d4, 0xec4899, 0x84cc16, 0xf97316, 0x14b8a6];
const SP = [[-28, -14], [-26, 14], [-14, -1], [-8, 18], [-6, -21], [2, 12], [6, -14], [14, -2], [18, 21], [26, -18], [29, 6], [30, -6], [-31, -6], [-18, 21], [10, 22], [22, -10], [-24, -23], [0, 23]].filter(([x, z]) => !C.hitsAt(x, 0, z, 0.5, 0));
let R = null, code = null, meta = null, players = {}, live = {}, scores = {}, dom = null, offset = 0, joinedAt = 0, unsub = [], liveT = 0, hostT = 0, hostAcc = 0, inGame = false, lastAttacker = null, ended = false, feed = [], flagMeshes = {};
const me = { alive: true, hp: 100, kills: 0, deaths: 0, respawnT: 0, prot: 0, team: null, seq: 0 };
const avatars = {}, WNAME = Object.fromEntries(C.WEAPONS.map(w => [w.id, w.short]));
const now = () => Date.now() + offset;
const isHost = () => meta && R && meta.host === R.uid;
const colorOf = uid => { if (meta && meta.mode === "dom") { const p = players[uid]; return p && p.team ? TEAMC[p.team] : 0x9ca3af; } let h = 0; for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
const panel = html => { $("#panel").hidden = false; $("#panel").innerHTML = html; };
const p = path => R.d.ref(R.rdb, `rooms/${code}/${path}`);

/* ---------- interface du menu ---------- */
function ui() {
  if (!$("#mpgo")) return;
  $("#mpgo").onclick = menu;
}
async function ensure() {
  if (R) return true;
  if (!window.ONLINE) { panel(`<h1>Multijoueur</h1><p>Le service en ligne n'est pas encore chargé. Réessaie dans un instant.</p><button class="btn" id="back">Retour</button>`); $("#back").onclick = home; return false; }
  const prof = await new Promise(r => window.ONLINE.onReady(r));
  if (!prof) { panel(`<h1>Multijoueur</h1><p>Il te faut un pseudo d'arcade pour jouer avec tes collègues.</p><a class="btn" href="../#profil" style="text-decoration:none;display:inline-block">Créer mon pseudo</a><br><button class="ghost" id="back">Retour</button>`); $("#back").onclick = home; return false; }
  try { R = await window.ONLINE.realtime(); } catch (e) { panel(`<h1>Multijoueur</h1><p>${esc(e.message)}</p><button class="ghost" id="back">Retour</button>`); $("#back").onclick = home; return false; }
  if (!R) { panel(`<h1>Multijoueur</h1><p>Connexion impossible au serveur temps réel.</p><button class="ghost" id="back">Retour</button>`); $("#back").onclick = home; return false; }
  unsub.push(R.d.onValue(R.d.ref(R.rdb, ".info/serverTimeOffset"), s => { offset = s.val() || 0; }));
  return true;
}
function home() { location.reload(); }
async function menu() {
  if (!(await ensure())) return;
  let mode = "ffa";
  panel(`<h1>Multijoueur</h1><p>Crée un salon et donne le code à tes collègues, ou rejoins le leur.</p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${Object.entries(MODES).map(([k, m]) => `<button class="ghost mode" data-m="${k}" aria-pressed="${k === mode}">${m.name}</button>`).join("")}</div>
    <p class="small" id="mdesc" style="color:#94a3b8;font-size:14px">${MODES[mode].desc}</p>
    <button class="btn" id="create">Créer un salon</button>
    <hr style="border-color:#ffffff20;margin:16px 0">
    <form id="jf" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><input id="code" maxlength="5" placeholder="CODE" autocomplete="off" aria-label="Code du salon" style="min-height:50px;width:150px;text-align:center;font:800 24px Inter;letter-spacing:4px;text-transform:uppercase;border-radius:12px;border:2px solid #ffffff40;background:#0006;color:#fff"><button class="btn" style="background:#3b82f6;color:#fff">Rejoindre</button></form>
    <p id="err" style="color:#fca5a5;font-weight:700;min-height:1.4em"></p><button class="ghost" id="back">Retour</button>`);
  document.querySelectorAll(".mode").forEach(b => b.onclick = () => { mode = b.dataset.m; document.querySelectorAll(".mode").forEach(x => { x.setAttribute("aria-pressed", x === b); x.style.background = x === b ? "#fff" : ""; x.style.color = x === b ? "#111" : ""; }); $("#mdesc").textContent = MODES[mode].desc; });
  document.querySelector(".mode").click();
  $("#create").onclick = () => create(mode);
  $("#jf").onsubmit = e => { e.preventDefault(); join($("#code").value.trim().toUpperCase()); };
  $("#back").onclick = home;
}
async function create(mode) {
  const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c = "";
  for (let k = 0; k < 6; k++) {
    c = Array.from({ length: 5 }, () => A[Math.floor(Math.random() * A.length)]).join("");
    const s = await R.d.get(R.d.ref(R.rdb, `rooms/${c}/meta`)); const v = s.val();
    if (!v || now() - (v.created || 0) > 6 * 3600e3) break;
  }
  await R.d.set(R.d.ref(R.rdb, `rooms/${c}/meta`), { host: R.uid, mode, state: "lobby", created: R.d.serverTimestamp(), limit: MODES[mode].limit, time: MODES[mode].time });
  join(c);
}
async function join(c) {
  const err = m => { if ($("#err")) $("#err").textContent = m; };
  if (!/^[A-Z0-9]{5}$/.test(c)) return err("Le code fait 5 caractères.");
  const ms = await R.d.get(R.d.ref(R.rdb, `rooms/${c}/meta`)); const m = ms.val();
  if (!m) return err("Salon introuvable. Vérifie le code.");
  const ps = (await R.d.get(R.d.ref(R.rdb, `rooms/${c}/players`))).val() || {};
  if (Object.keys(ps).length >= 8 && !ps[R.uid]) return err("Salon complet (8 joueurs maximum).");
  if (m.game && m.game !== "tir") { const g = (window.ARCADE_GAMES || []).find(x => x.id === m.game); return err(`Ce code est un salon de ${g ? g.name : "un autre jeu"}.`); }
  code = c; meta = m; joinedAt = now(); ended = m.state === "end";
  if (window.ONLINE) window.ONLINE.setDetail(`salon ${c}`);
  const cnt = { A: 0, B: 0 }; Object.values(ps).forEach(x => { if (x.team) cnt[x.team]++; });
  me.team = (ps[R.uid] && ps[R.uid].team) || (cnt.A <= cnt.B ? "A" : "B");
  await R.d.set(p(`players/${R.uid}`), { pseudo: R.pseudo, team: me.team, joined: R.d.serverTimestamp() });
  R.d.onDisconnect(p(`players/${R.uid}`)).remove(); R.d.onDisconnect(p(`live/${R.uid}`)).remove(); R.d.onDisconnect(p(`score/${R.uid}`)).remove();
  await R.d.set(p(`score/${R.uid}`), { pseudo: R.pseudo, kills: 0, deaths: 0 });
  unsub.push(R.d.onValue(p("meta"), s => { meta = s.val(); onMeta(); }));
  unsub.push(R.d.onValue(p("players"), s => { players = s.val() || {}; const mine = players[R.uid]; if (mine) me.team = mine.team; if (!inGame) lobby(); }));
  unsub.push(R.d.onValue(p("live"), s => { live = s.val() || {}; }));
  unsub.push(R.d.onValue(p("score"), s => { scores = s.val() || {}; if (!inGame && meta && meta.state === "end") results(); }));
  unsub.push(R.d.onValue(p("dom"), s => { dom = s.val(); }));
  unsub.push(R.d.onChildAdded(R.d.query(p("ev"), R.d.limitToLast(40)), s => onEvent(s.val())));
  onMeta();
}
async function leave() {
  try { await R.d.remove(p(`players/${R.uid}`)); await R.d.remove(p(`live/${R.uid}`)); await R.d.remove(p(`score/${R.uid}`)); } catch (e) {}
  location.reload();
}
function lobby() {
  if (!meta || inGame || meta.state === "end") return;
  const list = Object.entries(players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)), n = list.length, host = players[meta.host];
  const M = MODES[meta.mode];
  panel(`<h1 style="letter-spacing:6px">${code}</h1><p>Donne ce code à tes collègues · <b>${M.name}</b></p>
    <div style="text-align:left;margin:12px 0">${list.map(([uid, x]) => `<div style="display:flex;gap:8px;align-items:center;padding:6px 10px;margin:4px 0;border-radius:10px;background:#ffffff10"><span style="width:12px;height:12px;border-radius:50%;background:#${colorOf(uid).toString(16).padStart(6, "0")}"></span><b style="flex:1">${esc(x.pseudo)}</b>${meta.mode === "dom" ? `<span style="color:${TEAMH[x.team]}">${TEAMN[x.team]}</span>` : ""}${uid === meta.host ? `<span style="color:#fde68a">hôte</span>` : ""}</div>`).join("")}</div>
    ${meta.mode === "dom" ? `<button class="ghost" id="swap">Changer d'équipe</button><br>` : ""}
    ${isHost() ? `<button class="btn" id="launch" ${n < 2 ? "disabled" : ""}>Lancer la partie</button>${n < 2 ? `<p class="small" style="color:#94a3b8">Il faut au moins 2 joueurs.</p>` : ""}` : `<p>En attente que <b>${esc(host ? host.pseudo : "l'hôte")}</b> lance la partie…</p>`}
    <br><button class="ghost" id="quit">Quitter le salon</button>`);
  if ($("#swap")) $("#swap").onclick = () => R.d.update(p(`players/${R.uid}`), { team: me.team === "A" ? "B" : "A" });
  if ($("#launch")) $("#launch").onclick = launch;
  $("#quit").onclick = leave;
}
async function launch() {
  if (!isHost()) return;
  if (meta.mode === "dom") await R.d.set(p("dom"), { sA: 0, sB: 0, flags: { A: { owner: "", cap: "", prog: 0 }, B: { owner: "", cap: "", prog: 0 }, C: { owner: "", cap: "", prog: 0 } } });
  await R.d.update(p("meta"), { state: "play", startAt: R.d.serverTimestamp(), winner: "", round: (meta.round || 0) + 1 });
}
function onMeta() {
  if (!meta) { panel(`<h1>Salon fermé</h1><button class="btn" id="back">Retour</button>`); $("#back").onclick = home; return; }
  if (meta.state === "play" && !inGame) startGame();
  else if (meta.state === "end" && !ended) endGame();
  else if (meta.state === "lobby") { if (inGame) { inGame = false; C.exitMP(); clearScene(); } ended = false; lobby(); }
}

/* ---------- partie ---------- */
function startGame() {
  inGame = true; ended = false; me.kills = 0; me.deaths = 0; me.alive = true; me.hp = 100; me.seq = 0; feed = [];
  R.d.set(p(`score/${R.uid}`), { pseudo: R.pseudo, kills: 0, deaths: 0 });
  buildFlags(); C.enterMP(); respawn(); hudSetup();
  C.floatTxt(meta.mode === "dom" ? `Domination · tu es chez les ${TEAMN[me.team]}` : "Match à mort : élimine tout le monde !");
}
function clearScene() { for (const k in avatars) { C.scene.remove(avatars[k].g); delete avatars[k]; } for (const k in flagMeshes) C.scene.remove(flagMeshes[k].g); flagMeshes = {}; }
function respawn() {
  let cand = SP;
  if (meta.mode === "dom") cand = SP.filter(([x]) => me.team === "A" ? x < 4 : x > -4);
  const enemies = Object.entries(live).filter(([u, l]) => u !== R.uid && l.alive && !(meta.mode === "dom" && l.team === me.team));
  const scored = cand.map(s => ({ s, d: enemies.length ? Math.min(...enemies.map(([, l]) => Math.hypot(l.x - s[0], l.z - s[1]))) : Math.random() * 10 })).sort((a, b) => b.d - a.d);
  const [x, z] = scored[Math.floor(Math.random() * Math.min(3, scored.length))].s;
  Object.assign(C.P, { x, y: 0, z, vy: 0, yaw: Math.atan2(x, z), pitch: 0, hp: 100, ground: true });
  me.alive = true; me.hp = 100; me.prot = 1.5; C.refill(); writeLive();
}
function die(killer, head, w) {
  window.SFX && window.SFX.play("die");
  me.alive = false; me.hp = 0; C.P.hp = 0; me.deaths++; me.respawnT = 3.2;
  R.d.update(p(`score/${R.uid}`), { deaths: me.deaths });
  R.d.push(p("ev"), { type: "kill", killer: killer || "", victim: R.uid, head: !!head, w: w || "", t: R.d.serverTimestamp() });
  writeLive();
}
function writeLive() {
  if (!code) return; const P = C.P;
  R.d.set(p(`live/${R.uid}`), { x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), alive: me.alive, team: me.team || "", s: me.seq, hp: Math.round(me.hp), w: C.weapon, c: C.crouch ? 1 : 0 });
}
function onEvent(e) {
  if (!e || !code || (e.t && e.t < joinedAt - 1500)) return;
  if (e.type === "hit" && e.to === R.uid && me.alive && inGame) {
    if (me.prot > 0) return;
    me.hp -= e.dmg; C.P.hp = Math.max(0, me.hp); C.setHurt(0.5); lastAttacker = e.from;
    if (me.hp <= 0) die(e.from, e.head, e.w);
  }
  if (e.type === "kill") {
    const kn = (players[e.killer] || scores[e.killer] || {}).pseudo || "?", vn = (players[e.victim] || scores[e.victim] || {}).pseudo || "?";
    feed.unshift({ html: `<b style="color:#${colorOf(e.killer).toString(16).padStart(6, "0")}">${esc(kn)}</b> <span style="color:#cbd5e1;font-weight:500;font-size:12px">[${esc(WNAME[e.w] || "›")}${e.head ? " ⌖" : ""}]</span> <b style="color:#${colorOf(e.victim).toString(16).padStart(6, "0")}">${esc(vn)}</b>`, t: 5 });
    if (e.killer === R.uid && e.victim !== R.uid) { me.kills++; R.d.update(p(`score/${R.uid}`), { kills: me.kills }); C.floatTxt(e.head ? "+1 · tir à la tête !" : `+1 · ${vn} éliminé`); }
    if (e.victim === R.uid) C.floatTxt(`Éliminé par ${kn}`);
  }
  if (e.type === "fx" && e.from !== R.uid) C.explode(e.x, e.y, e.z);
  if (e.type === "flag") C.floatTxt(`Les ${TEAMN[e.team]} capturent ${e.flag} !`);
}
function hit(uid, head, point, dmg, w) {
  if (!me.alive || !inGame) return false;
  const l = live[uid]; if (!l || !l.alive) return false;
  if (meta.mode === "dom" && l.team === me.team) return false;
  R.d.push(p("ev"), { type: "hit", from: R.uid, to: uid, dmg: Math.max(1, Math.min(200, Math.round(dmg || 22))), head: !!head, w: w || "", t: R.d.serverTimestamp() });
  return true;
}
// explosion du lance-briques : touche tous les adversaires dans le rayon
function blast(at, radius, dmg, w) {
  if (!inGame) return false;
  R.d.push(p("ev"), { type: "fx", from: R.uid, x: +at.x.toFixed(2), y: +at.y.toFixed(2), z: +at.z.toFixed(2), t: R.d.serverTimestamp() });
  let n = 0;
  for (const [uid, l] of Object.entries(live)) {
    if (uid === R.uid || !l.alive || (meta.mode === "dom" && l.team === me.team)) continue;
    const d = Math.hypot(l.x - at.x, l.y + 1 - at.y, l.z - at.z);
    if (d < radius && hit(uid, false, at, dmg * (1 - d / radius * 0.6), w)) n++;
  }
  return n > 0;
}

/* ---------- avatars des autres joueurs ---------- */
function nameTag(text, color) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
  g.fillStyle = "#000a"; g.fillRect(0, 8, 256, 48); g.fillStyle = color; g.font = "700 30px Inter, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text.slice(0, 14), 128, 33);
  const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false })); s.scale.set(1.6, 0.4, 1); s.position.y = 2.35; return s;
}
function avatar(uid) {
  if (avatars[uid]) return avatars[uid];
  const col = colorOf(uid), g = new T.Group(), geo = C.geo;
  const M = c => new T.MeshLambertMaterial({ color: c });
  const add = (w, h, d, x, y, z, m, head) => { const k = new T.Mesh(geo, m); k.scale.set(w, h, d); k.position.set(x, y, z); k.userData.remote = uid; k.userData.head = !!head; g.add(k); return k; };
  const body = M(col), dark = M(0x1f2937);
  const legL = add(0.26, 0.8, 0.3, -0.16, 0.4, 0, dark), legR = add(0.26, 0.8, 0.3, 0.16, 0.4, 0, dark);
  add(0.7, 0.8, 0.4, 0, 1.2, 0, body); add(0.45, 0.45, 0.45, 0, 1.85, 0, M(0xf1c27d), true); add(0.5, 0.18, 0.5, 0, 2.08, 0, body, true); add(0.4, 0.1, 0.05, 0, 1.88, 0.23, M(0x111111), true);
  add(0.18, 0.6, 0.18, -0.44, 1.2, 0.1, body); add(0.18, 0.6, 0.18, 0.44, 1.2, 0.1, body); add(0.1, 0.12, 0.7, 0.3, 1.3, 0.45, dark);
  const p0 = players[uid] || {}; g.add(nameTag(p0.pseudo || "?", "#" + col.toString(16).padStart(6, "0")));
  C.scene.add(g); const a = { g, legL, legR, s: null, t: 0, init: false }; avatars[uid] = a; return a;
}
function updateAvatars(dt) {
  for (const uid in avatars) if (!live[uid] || uid === R.uid) { C.scene.remove(avatars[uid].g); delete avatars[uid]; }
  for (const [uid, l] of Object.entries(live)) {
    if (uid === R.uid) continue;
    const a = avatar(uid);
    if (!a.init) { a.g.position.set(l.x, l.y, l.z); a.g.rotation.y = l.yaw + Math.PI; a.init = true; a.s = l.s; }
    const ox = a.g.position.x, oz = a.g.position.z, k = Math.min(1, dt * 12);
    a.g.position.x += (l.x - ox) * k; a.g.position.y += (l.y - a.g.position.y) * k; a.g.position.z += (l.z - oz) * k;
    let dy = (l.yaw + Math.PI) - a.g.rotation.y; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; a.g.rotation.y += dy * k;
    const sp = Math.hypot(a.g.position.x - ox, a.g.position.z - oz) / Math.max(dt, 1e-3); a.t += dt * Math.min(sp, 6) * 2;
    a.legL.rotation.x = Math.sin(a.t) * 0.6 * Math.min(1, sp / 3); a.legR.rotation.x = -a.legL.rotation.x;
    a.g.visible = !!l.alive;
    const cs = l.c ? 0.68 : 1; a.g.scale.y += (cs - a.g.scale.y) * k;
    if (l.s > a.s) { a.s = l.s; if (l.alive) tracerFrom(a, l); }
  }
}
function tracerFrom(a, l) {
  const st = new T.Vector3(0.3, 1.3, 0.8).applyMatrix4(a.g.matrixWorld), dir = new T.Vector3(-Math.sin(l.yaw) * Math.cos(l.pitch), Math.sin(l.pitch), -Math.cos(l.yaw) * Math.cos(l.pitch));
  const en = st.clone().addScaledVector(dir, 40);
  if (l.w === "rpg" || l.w === "knife") return;
  const tr = new T.Line(new T.BufferGeometry().setFromPoints([st, en]), new T.LineBasicMaterial({ color: l.w === "sniper" ? 0xbfffd0 : 0xffe08a })); tr.userData.l = 0.05; C.scene.add(tr); C.tracers.push(tr);
}

/* ---------- drapeaux (domination) ---------- */
function buildFlags() {
  for (const k in flagMeshes) C.scene.remove(flagMeshes[k].g); flagMeshes = {};
  if (meta.mode !== "dom") return;
  for (const [k, f] of Object.entries(FLAGS)) {
    const g = new T.Group(); g.position.set(f.x, 0, f.z);
    const ring = new T.Mesh(new T.RingGeometry(3.2, 3.5, 40), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: true, opacity: 0.85 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const pole = new T.Mesh(C.geo, new T.MeshLambertMaterial({ color: 0xe5e7eb })); pole.scale.set(0.12, 3.2, 0.12); pole.position.y = 1.6; g.add(pole);
    const flag = new T.Mesh(C.geo, new T.MeshLambertMaterial({ color: 0xffffff })); flag.scale.set(1.2, 0.7, 0.06); flag.position.set(0.66, 2.8, 0); g.add(flag);
    const c = document.createElement("canvas"); c.width = 64; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "#000b"; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill(); x.fillStyle = "#fff"; x.font = "800 40px Inter"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(k, 32, 34);
    const lab = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false })); lab.position.y = 4; lab.scale.set(0.9, 0.9, 1); g.add(lab);
    C.scene.add(g); flagMeshes[k] = { g, ring, flag };
  }
}
function updateFlags() {
  if (!dom || meta.mode !== "dom") return;
  for (const k in flagMeshes) {
    const f = dom.flags && dom.flags[k] || {}, m = flagMeshes[k], col = f.owner ? TEAMC[f.owner] : 0xffffff;
    m.flag.material.color.setHex(col); m.ring.material.color.setHex(f.cap && f.cap !== f.owner && f.prog > 0 ? TEAMC[f.cap] : col);
    m.flag.position.y = 0.6 + 2.2 * (f.owner ? 1 : (f.prog || 0));
  }
}

/* ---------- hôte : drapeaux, points, fin de partie ---------- */
function hostTick(dt) {
  hostT += dt; if (hostT < 0.5) return; const step = hostT; hostT = 0;
  if (!meta || meta.state !== "play") return;
  const elapsed = (now() - (meta.startAt || now())) / 1000, timeUp = elapsed >= meta.time;
  if (meta.mode === "dom" && dom) {
    const d = JSON.parse(JSON.stringify(dom)); let changed = false; hostAcc += step;
    for (const [k, f] of Object.entries(FLAGS)) {
      const fl = d.flags[k]; let a = 0, b = 0;
      for (const l of Object.values(live)) if (l.alive && Math.hypot(l.x - f.x, l.z - f.z) < 3.4) { if (l.team === "A") a++; else if (l.team === "B") b++; }
      const team = a && !b ? "A" : b && !a ? "B" : "";
      if (team && fl.owner !== team) {
        if (fl.cap !== team) { fl.cap = team; fl.prog = 0; }
        fl.prog = Math.min(1, fl.prog + step / 6); changed = true;
        if (fl.prog >= 1) { fl.owner = team; R.d.push(p("ev"), { type: "flag", flag: k, team, t: R.d.serverTimestamp() }); }
      } else if (!team && fl.cap && fl.cap !== fl.owner && fl.prog > 0) { fl.prog = Math.max(0, fl.prog - step / 12); changed = true; }
    }
    if (hostAcc >= 1) { const s = Math.floor(hostAcc); hostAcc -= s; for (const fl of Object.values(d.flags)) { if (fl.owner === "A") d.sA += s; if (fl.owner === "B") d.sB += s; } changed = true; }
    if (changed) R.d.set(p("dom"), d);
    if (d.sA >= meta.limit || d.sB >= meta.limit || timeUp) R.d.update(p("meta"), { state: "end", winner: d.sA === d.sB ? "" : d.sA > d.sB ? "A" : "B", endAt: R.d.serverTimestamp() });
  } else if (meta.mode === "ffa") {
    const rk = Object.entries(scores).sort((x, y) => (y[1].kills || 0) - (x[1].kills || 0) || (x[1].deaths || 0) - (y[1].deaths || 0)), top = rk[0], sec = rk[1];
    const solo = top && (!sec || (top[1].kills || 0) > (sec[1].kills || 0) || ((top[1].kills || 0) === (sec[1].kills || 0) && (top[1].deaths || 0) < (sec[1].deaths || 0)));
    if ((top && top[1].kills >= meta.limit) || timeUp) R.d.update(p("meta"), { state: "end", winner: solo && (top[1].kills || 0) > 0 ? top[0] : "", endAt: R.d.serverTimestamp() });
  }
}
function hostMigrate() {
  if (!meta || players[meta.host]) return;
  const first = Object.entries(players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))[0];
  if (first && first[0] === R.uid) R.d.update(p("meta"), { host: R.uid });
}

/* ---------- affichage ---------- */
let boardHeld = false;
function hudSetup() {
  if (!$("#feed")) { const f = document.createElement("div"); f.id = "feed"; f.className = "hud"; f.style.cssText = "right:14px;top:120px;text-align:right;font-size:14px;line-height:1.7"; document.body.appendChild(f); }
  if (!$("#timer")) { const t = document.createElement("div"); t.id = "timer"; t.className = "hud"; t.style.cssText = "left:50%;top:max(12px,env(safe-area-inset-top));transform:translateX(-50%);font:800 24px 'Inter Tight',sans-serif;text-align:center"; document.body.appendChild(t); }
  if (!$("#sboard")) { const b = document.createElement("div"); b.id = "sboard"; b.hidden = true; b.style.cssText = "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#0b1220ee;border:2px solid #ffffff30;border-radius:14px;padding:16px 20px;min-width:min(420px,92vw);z-index:4;pointer-events:none"; document.body.appendChild(b); }
  if (C.isTouch && !$("#tabbtn")) { const b = document.createElement("button"); b.id = "tabbtn"; b.textContent = "Scores"; b.className = "ghost"; b.style.cssText = "position:fixed;left:14px;top:110px;z-index:4;min-height:40px"; b.onpointerdown = () => { boardHeld = true; }; b.onpointerup = b.onpointerleave = () => { boardHeld = false; }; document.body.appendChild(b); }
}
addEventListener("keydown", e => { if (e.code === "Tab" && inGame) { e.preventDefault(); boardHeld = true; } });
addEventListener("keyup", e => { if (e.code === "Tab") boardHeld = false; });
function boardHtml() {
  const rows = Object.entries(scores).sort((a, b) => (b[1].kills || 0) - (a[1].kills || 0) || (a[1].deaths || 0) - (b[1].deaths || 0));
  const head = meta.mode === "dom" && dom ? `<div style="display:flex;justify-content:space-around;font:800 26px 'Inter Tight';margin-bottom:8px"><span style="color:${TEAMH.A}">Bleus ${dom.sA}</span><span style="color:${TEAMH.B}">Rouges ${dom.sB}</span></div>` : "";
  return head + `<table style="width:100%;border-collapse:collapse;font-size:15px"><tr style="color:#94a3b8;text-align:left"><th>Joueur</th><th style="text-align:right">Élim.</th><th style="text-align:right">Morts</th></tr>${rows.map(([u, s]) => `<tr style="${u === R.uid ? "color:#fde68a" : ""}"><td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#${colorOf(u).toString(16).padStart(6, "0")};margin-right:6px"></span>${esc(s.pseudo)}</td><td style="text-align:right">${s.kills || 0}</td><td style="text-align:right">${s.deaths || 0}</td></tr>`).join("")}</table>`;
}
function hud(dt) {
  const left = Math.max(0, meta.time - (now() - (meta.startAt || now())) / 1000), mm = Math.floor(left / 60), ss = String(Math.floor(left % 60)).padStart(2, "0");
  if (meta.mode === "dom" && dom) {
    $("#timer").innerHTML = `<span style="color:${TEAMH.A}">${dom.sA}</span> · ${mm}:${ss} · <span style="color:${TEAMH.B}">${dom.sB}</span><div style="font-size:16px;margin-top:2px">${Object.keys(FLAGS).map(k => { const f = dom.flags[k] || {}; return `<span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:50%;margin:0 3px;background:${f.owner ? TEAMH[f.owner] : "#ffffff30"};font-size:14px">${k}</span>`; }).join("")}</div>`;
    $("#score").textContent = `${me.kills} élim.`; $("#wave").innerHTML = `Équipe <b style="color:${TEAMH[me.team]}">${TEAMN[me.team]}</b>`;
  } else {
    $("#timer").textContent = `${mm}:${ss}`;
    const top = Object.entries(scores).sort((a, b) => (b[1].kills || 0) - (a[1].kills || 0))[0];
    $("#score").textContent = `${me.kills} / ${meta.limit}`; $("#wave").textContent = top && top[0] !== R.uid ? `En tête : ${top[1].pseudo} (${top[1].kills || 0})` : "Tu es en tête !";
  }
  $("#left").textContent = !me.alive ? `Réapparition dans ${Math.ceil(me.respawnT)}…` : me.prot > 0 ? "Protection d'apparition" : "";
  feed.forEach(f => f.t -= dt); feed = feed.filter(f => f.t > 0).slice(0, 5); $("#feed").innerHTML = feed.map(f => `<div>${f.html}</div>`).join("");
  $("#sboard").hidden = !boardHeld; if (boardHeld) $("#sboard").innerHTML = boardHtml();
}
let lastTick = performance.now();
// onglet en arrière-plan : le navigateur coupe requestAnimationFrame, on continue au ralenti
setInterval(() => { const t = performance.now(); if (t - lastTick > 450) update(Math.min(1, (t - lastTick) / 1000)); }, 500);
function update(dt) {
  lastTick = performance.now();
  if (!code || !meta || !R) return;
  hostMigrate();
  if (!inGame || meta.state !== "play") return;
  if (!me.alive) { me.respawnT -= dt; C.P.pitch = Math.max(C.P.pitch - dt, -0.6); if (me.respawnT <= 0) respawn(); }
  me.prot = Math.max(0, me.prot - dt);
  liveT += dt; if (liveT >= 0.1) { liveT = 0; writeLive(); }
  updateAvatars(dt); updateFlags();
  if (isHost()) hostTick(dt);
  hud(dt);
}
async function endGame() {
  ended = true; inGame = false; C.exitMP(); boardHeld = false; if ($("#sboard")) $("#sboard").hidden = true;
  const myWin = meta.mode === "dom" ? meta.winner && meta.winner === me.team : meta.winner === R.uid;
  if (window.ONLINE) window.ONLINE.submit("tir", g => Object.assign(g, { mpKills: (g.mpKills || 0) + me.kills, mpWins: (g.mpWins || 0) + (myWin ? 1 : 0), mpGames: (g.mpGames || 0) + 1 }));
  results();
}
function results() {
  if (!meta || meta.state !== "end") return;
  const myWin = meta.mode === "dom" ? meta.winner && meta.winner === me.team : meta.winner === R.uid;
  const title = meta.mode === "dom" ? (meta.winner ? `Victoire des ${TEAMN[meta.winner]}` : "Égalité") : (meta.winner ? `${esc((scores[meta.winner] || players[meta.winner] || {}).pseudo || "?")} gagne !` : "Égalité");
  panel(`<h1 style="color:${myWin ? "#4ade80" : "#fca5a5"}">${title}</h1><p>${myWin ? "Bien joué !" : "La revanche, vite."} · ${me.kills} élimination${me.kills > 1 ? "s" : ""}, ${me.deaths} mort${me.deaths > 1 ? "s" : ""}</p>
    <div style="text-align:left;margin:10px 0">${boardHtml()}</div>
    ${isHost() ? `<button class="btn" id="relobby">Retour au salon</button>` : `<p>En attente de l'hôte pour la revanche…</p>`}<br><button class="ghost" id="quit">Quitter</button>`);
  if ($("#relobby")) $("#relobby").onclick = () => R.d.update(p("meta"), { state: "lobby" });
  $("#quit").onclick = leave;
}

// ouverture directe depuis l'accueil : #multi ou #salon=CODE
(function autoOpen() {
  const h = location.hash, mm = /^#salon=([A-Za-z0-9]{5})$/.exec(h); if (!mm && h !== "#multi") return;
  history.replaceState(null, "", location.pathname + location.search);
  const t = setInterval(async () => { if (!window.ONLINE || !window.TIRCORE) return; clearInterval(t); if (!(await ensure())) return; if (mm) join(mm[1].toUpperCase()); else menu(); }, 200);
})();
window.MP = { blast, update: (dt) => update(dt), targets: () => Object.values(avatars).filter(a => a.g.visible).flatMap(a => a.g.children.filter(c => c.isMesh)), hit, onShot: () => { me.seq++; }, alive: () => me.alive && inGame, leave, get code() { return code; }, get me() { return me; } };
ui();
}
