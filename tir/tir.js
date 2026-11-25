"use strict";
{
const $ = s => document.querySelector(s);
if (!window.THREE) { $("#panel").innerHTML = "<h1>Oups</h1><p>La bibliothèque 3D n'a pas pu se charger. Vérifie ta connexion et recharge la page.</p>"; throw new Error("THREE absent"); }
const T = THREE, cv = $("#c");
const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
const scene = new T.Scene(); scene.background = new T.Color(0x8ecdf5); scene.fog = new T.Fog(0x8ecdf5, 30, 85);
const camera = new T.PerspectiveCamera(75, 1, 0.05, 200);
scene.add(new T.HemisphereLight(0xffffff, 0x557744, 0.85));
const sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(20, 40, 10); scene.add(sun);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();

/* ---------- la carte : un lotissement en blocs ---------- */
const solids = [], shootables = [], MATS = {};
const mat = c => MATS[c] || (MATS[c] = new T.MeshLambertMaterial({ color: c }));
const geo = new T.BoxGeometry(1, 1, 1);
function box(x, y, z, w, h, d, c, solid = true) {
  const m = new T.Mesh(geo, mat(c)); m.scale.set(w, h, d); m.position.set(x + w / 2, y + h / 2, z + d / 2); scene.add(m);
  if (solid) { solids.push({ x1: x, x2: x + w, y1: y, y2: y + h, z1: z, z2: z + d }); shootables.push(m); }
  return m;
}
const MX = 34, MZ = 26;
box(-MX, -1, -MZ, MX * 2, 1, MZ * 2, 0x6aa84f, false);
box(-MX, -0.98, -4, MX * 2, 1, 8, 0x4b5563, false);
for (let x = -MX + 2; x < MX; x += 6) box(x, 0.01, -0.15, 3, 0.02, 0.3, 0xf8fafc, false);
box(-MX, -0.97, 4, MX * 2, 1, 1.2, 0xd1d5db, false); box(-MX, -0.97, -5.2, MX * 2, 1, 1.2, 0xd1d5db, false);
// clôture du quartier (haies)
box(-MX - 1, 0, -MZ - 1, MX * 2 + 2, 2.2, 1, 0x2f6b2a); box(-MX - 1, 0, MZ, MX * 2 + 2, 2.2, 1, 0x2f6b2a);
box(-MX - 1, 0, -MZ, 1, 2.2, MZ * 2, 0x2f6b2a); box(MX, 0, -MZ, 1, 2.2, MZ * 2, 0x2f6b2a);
// maisons
function house(x0, z0, w, d, wall, roof, front) {
  const H = 3.2, t = 0.3, dw = 1.6, dx = x0 + w / 2 - dw / 2;
  const fz = front > 0 ? z0 + d - t : z0, bz = front > 0 ? z0 : z0 + d - t;
  box(x0, 0, fz, dx - x0, H, t, wall); box(dx + dw, 0, fz, x0 + w - dx - dw, H, t, wall); box(dx, 2.3, fz, dw, H - 2.3, t, wall);
  box(x0, 0, bz, w / 2 - 1.5, H, t, wall); box(x0 + w / 2 + 1.5, 0, bz, w / 2 - 1.5, H, t, wall); box(x0 + w / 2 - 1.5, 2.3, bz, 3, H - 2.3, t, wall);
  box(x0, 0, z0, t, H, d, wall); box(x0 + w - t, 0, z0, t, H, d, wall);
  box(x0 + w * 0.45, 0, z0 + d * 0.4, t, H, d * 0.35, wall);
  for (const wx of [x0 + 1.2, x0 + w - 3.2]) box(wx, 1.2, fz + (front > 0 ? t : -0.06), 2, 1.1, 0.06, 0x7dd3fc, false);
  box(x0 - 0.4, H, z0 - 0.4, w + 0.8, 0.35, d + 0.8, roof);
  box(x0 + 0.8, H + 0.35, z0 + 0.8, w - 1.6, 0.6, d - 1.6, roof); box(x0 + 2, H + 0.95, z0 + 2, w - 4, 0.5, d - 4, roof);
  box(x0 + 2, 0.01, z0 + 1, 3, 0.9, 1.2, 0x92400e); box(x0 + w - 5, 0.01, z0 + d - 3, 2.4, 0.8, 1.2, 0x9ca3af);
}
house(-20, -19, 16, 11, 0xf1f5f9, 0xb91c1c, 1);
house(4, 8, 16, 11, 0xfde68a, 0x1d4ed8, -1);
house(8, -19, 12, 10, 0xe9d5ff, 0x374151, 1);
house(-24, 9, 13, 10, 0xbbf7d0, 0x7c2d12, -1);
// clôtures de jardin basses (on saute par-dessus)
for (const [x, z, w] of [[-21, -7.6, 6], [-9, -7.6, 6], [7, -7.6, 4], [16, -7.6, 5], [3, 7, 7], [14, 7, 7], [-25, 7, 5], [-15, 7, 5]]) box(x, 0, z, w, 0.8, 0.25, 0xffffff);
// voitures
function car(x, z, c, rot) {
  const [w, d] = rot ? [1.9, 4.2] : [4.2, 1.9];
  box(x, 0.3, z, w, 0.9, d, c); box(x + (rot ? 0.15 : 1), 1.2, z + (rot ? 1 : 0.15), rot ? 1.6 : 2.2, 0.7, rot ? 2.2 : 1.6, 0x1f2937);
  for (const [a, b] of [[0.2, 0.2], [w - 0.7, 0.2], [0.2, d - 0.7], [w - 0.7, d - 0.7]]) box(x + a, 0, z + b, 0.5, 0.5, 0.5, 0x111111, false);
}
car(-6, -3, 0xdc2626, false); car(10, 1.2, 0x2563eb, false); car(-2, -12, 0x16a34a, true); car(24, 10, 0xf59e0b, true);
// le bus en travers
box(-31, 0.4, -3.5, 2.8, 2.6, 9, 0xfacc15); box(-31.05, 1.7, -3, 2.9, 0.8, 8, 0x1f2937); box(-31, 0, -3, 2.8, 0.5, 8, 0x111111, false);
// arbres et caisses
function tree(x, z) { box(x - 0.25, 0, z - 0.25, 0.5, 2.2, 0.5, 0x7c4a1d); box(x - 1.3, 2.2, z - 1.3, 2.6, 2, 2.6, 0x3f8f3a); box(x - 0.8, 4.2, z - 0.8, 1.6, 1, 1.6, 0x4ea84a); }
for (const [x, z] of [[-28, -20], [28, -14], [28, 20], [-4, 21], [0, -22], [-30, 18], [30, -24]]) tree(x, z);
for (const [x, z] of [[2, -6.5], [-14, 5.5], [21, 5.5], [-26, -6.5]]) box(x, 0, z, 1.2, 1.2, 1.2, 0xa16207);

/* ---------- joueur ---------- */
const P = { x: 0, y: 0, z: 0, vy: 0, yaw: Math.PI / 2, pitch: 0, hp: 100, ground: true }, R = 0.35, EYE = 1.6;
function hitsAt(x, y, z, r, minH) { for (const b of solids) { if (b.y2 - b.y1 < minH) continue; if (x + r > b.x1 && x - r < b.x2 && z + r > b.z1 && z - r < b.z2 && y + 1.7 > b.y1 && y + 0.45 < b.y2) return b; } return null; }
function groundAt(x, z, y) { let g = 0; for (const b of solids) if (x + R > b.x1 && x - R < b.x2 && z + R > b.z1 && z - R < b.z2 && b.y2 <= y + 0.46 && b.y2 > g) g = b.y2; return g; }
const keys = new Set(), mv = { x: 0, z: 0 };
let fireHeld = false, locked = false, state = "menu", mode = "solo";
const MPH = () => window.MP;
addEventListener("keydown", e => { keys.add(e.code); if (e.code === "KeyR") reload(); if (e.code === "Space") { jump(); e.preventDefault(); } if (e.code === "Escape" && state === "play" && !locked) pause(); });
addEventListener("keyup", e => keys.delete(e.code));
function jump() { if (state === "play" && P.ground) { P.vy = 5.6; P.ground = false; } }
cv.addEventListener("mousedown", e => { if (state !== "play") return; if (!locked && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} } if (e.button === 0) fireHeld = true; });
addEventListener("mouseup", () => { fireHeld = false; });
document.addEventListener("pointerlockchange", () => { locked = document.pointerLockElement === cv; if (!locked && state === "play" && !isTouch) pause(); });
let drag = null;
addEventListener("mousemove", e => { if (state !== "play") return; if (locked) look(e.movementX, e.movementY, 0.0024); else if (drag) { look(e.clientX - drag.x, e.clientY - drag.y, 0.005); drag = { x: e.clientX, y: e.clientY }; } });
cv.addEventListener("mousedown", e => { if (!locked && !isTouch) drag = { x: e.clientX, y: e.clientY }; });
addEventListener("mouseup", () => { drag = null; });
function look(dx, dy, s) { P.yaw -= dx * s; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - dy * s)); }
// tactile
const isTouch = matchMedia("(pointer:coarse)").matches;
const stick = $("#stick"), knob = $("#knob"); let sid = null, sc = null, lookId = null, lp = null;
stick.addEventListener("pointerdown", e => { e.preventDefault(); sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); sc = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; smove(e); });
stick.addEventListener("pointermove", e => { if (e.pointerId === sid) smove(e); });
const send = e => { if (e.pointerId !== sid) return; sid = null; mv.x = mv.z = 0; knob.style.transform = ""; };
stick.addEventListener("pointerup", send); stick.addEventListener("pointercancel", send);
function smove(e) { let dx = e.clientX - sc.x, dy = e.clientY - sc.y; const d = Math.hypot(dx, dy), m = Math.min(d, 50); if (d > 0) { dx = dx / d * m; dy = dy / d * m; } knob.style.transform = `translate(${dx}px,${dy}px)`; mv.x = dx / 50; mv.z = dy / 50; }
cv.addEventListener("pointerdown", e => { if (e.pointerType !== "touch" || state !== "play") return; lookId = e.pointerId; lp = { x: e.clientX, y: e.clientY }; });
cv.addEventListener("pointermove", e => { if (e.pointerId !== lookId) return; look(e.clientX - lp.x, e.clientY - lp.y, 0.006); lp = { x: e.clientX, y: e.clientY }; });
const lend = e => { if (e.pointerId === lookId) lookId = null; };
cv.addEventListener("pointerup", lend); cv.addEventListener("pointercancel", lend);
for (const [id, dn, up] of [["#fire", () => fireHeld = true, () => fireHeld = false], ["#reload", () => reload(), null], ["#jump", () => jump(), null]]) {
  const b = $(id); b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); dn(); });
  if (up) { b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up); b.addEventListener("pointerleave", up); }
}

/* ---------- arme ---------- */
const gun = new T.Group();
const gm = c => new T.MeshLambertMaterial({ color: c });
const part = (w, h, d, x, y, z, c) => { const m = new T.Mesh(geo, gm(c)); m.scale.set(w, h, d); m.position.set(x, y, z); gun.add(m); return m; };
part(0.09, 0.11, 0.6, 0, 0, -0.25, 0x374151); part(0.05, 0.05, 0.3, 0, 0.02, -0.65, 0x111827); part(0.07, 0.18, 0.08, 0, -0.13, -0.12, 0x1f2937); part(0.06, 0.15, 0.1, 0, -0.1, -0.35, 0x4b5563); part(0.03, 0.04, 0.1, 0, 0.08, -0.2, 0x22c55e);
const flash = new T.Mesh(new T.SphereGeometry(0.07, 6, 6), new T.MeshBasicMaterial({ color: 0xffd166 })); flash.position.set(0, 0.02, -0.85); flash.visible = false; gun.add(flash);
gun.scale.setScalar(0.55); gun.position.set(0.2, -0.17, -0.32); camera.add(gun); scene.add(camera);
const MAG = 30; let ammo = MAG, reloadT = 0, cool = 0, recoil = 0, shots = 0, hits = 0;
function reload() { if (state !== "play" || reloadT > 0 || ammo === MAG) return; reloadT = 1.4; $("#reloadTxt").textContent = "Rechargement…"; }

/* ---------- robots ---------- */
const enemies = [], ray = new T.Raycaster(), tracers = [], sparks = [];
const SPAWNS = [[-32, -24], [32, -24], [-32, 24], [32, 24], [-32, 0], [32, 0], [0, -24], [0, 24]];
function makeRobot(wave) {
  const g = new T.Group(), body = new T.MeshLambertMaterial({ color: 0x9ca3af }), dark = new T.MeshLambertMaterial({ color: 0x4b5563 });
  const add = (w, h, d, x, y, z, m, head) => { const k = new T.Mesh(geo, m); k.scale.set(w, h, d); k.position.set(x, y, z); k.userData.head = !!head; g.add(k); return k; };
  const torso = add(0.8, 0.9, 0.5, 0, 1.05, 0, body), head = add(0.55, 0.5, 0.5, 0, 1.78, 0, body, true);
  const eyeM = new T.MeshBasicMaterial({ color: 0xef4444 }); const e1 = new T.Mesh(geo, eyeM); e1.scale.set(0.12, 0.08, 0.02); e1.position.set(-0.12, 1.82, 0.26); const e2 = e1.clone(); e2.position.x = 0.12; g.add(e1, e2);
  const legL = add(0.25, 0.6, 0.25, -0.2, 0.3, 0, dark), legR = add(0.25, 0.6, 0.25, 0.2, 0.3, 0, dark), armL = add(0.2, 0.7, 0.2, -0.52, 1.1, 0, dark), armR = add(0.2, 0.7, 0.2, 0.52, 1.1, 0, dark);
  const [sx, sz] = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
  g.position.set(sx + (Math.random() - 0.5) * 3, 0, sz + (Math.random() - 0.5) * 3); scene.add(g);
  const tough = wave >= 4 && Math.random() < 0.25;
  if (tough) { body.color.set(0x7f1d1d); g.scale.setScalar(1.25); }
  const e = { g, body, legL, legR, armL, armR, hp: tough ? 6 : 3, speed: 2.1 + wave * 0.18 + Math.random() * 0.4, t: Math.random() * 6, flash: 0, stuck: 0, side: 0, lastD: 1e9, tough };
  g.traverse(o => { if (o.isMesh) o.userData.enemy = e; });
  enemies.push(e);
}
function killRobot(e, head) {
  scene.remove(e.g); enemies.splice(enemies.indexOf(e), 1); kills++;
  const pts = (e.tough ? 250 : 100) + (head ? 50 : 0); score += pts; floatTxt(head ? `+${pts} tête !` : `+${pts}`);
  for (let i = 0; i < 10; i++) spark(e.g.position.x, 1 + Math.random(), e.g.position.z, 0x9ca3af);
}
function spark(x, y, z, c) { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: c })); m.scale.setScalar(0.12); m.position.set(x, y, z); m.userData.v = new T.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6); m.userData.l = 0.6; scene.add(m); sparks.push(m); }
let ft = 0; function floatTxt(s) { $("#banner").textContent = s; ft = 0.7; }

/* ---------- tir ---------- */
function shoot() {
  if (ammo <= 0) { reload(); return; }
  ammo--; shots++; cool = 0.11; recoil = 1; flash.visible = true; setTimeout(() => flash.visible = false, 40);
  ray.setFromCamera({ x: (Math.random() - 0.5) * 0.02, y: (Math.random() - 0.5) * 0.02 }, camera);
  const targets = shootables.concat(mode === "mp" ? MPH().targets() : enemies.flatMap(e => e.g.children)), hit = ray.intersectObjects(targets, false)[0];
  const end = hit ? hit.point : ray.ray.at(80, new T.Vector3());
  const start = new T.Vector3(0.22, -0.18, -1).applyMatrix4(camera.matrixWorld);
  const tr = new T.Line(new T.BufferGeometry().setFromPoints([start, end]), new T.LineBasicMaterial({ color: 0xfff3b0 })); tr.userData.l = 0.05; scene.add(tr); tracers.push(tr);
  if (mode === "mp") MPH().onShot();
  if (hit && hit.object.userData.remote) { hits++; if (MPH().hit(hit.object.userData.remote, hit.object.userData.head, end)) { $("#cross").classList.add("hit"); setTimeout(() => $("#cross").classList.remove("hit"), 90); } }
  else if (hit && hit.object.userData.enemy) {
    const e = hit.object.userData.enemy, head = hit.object.userData.head; hits++;
    e.hp -= head ? 2 : 1; e.flash = 0.08; $("#cross").classList.add("hit"); setTimeout(() => $("#cross").classList.remove("hit"), 90);
    if (e.hp <= 0) killRobot(e, head);
  } else if (hit) spark(end.x, end.y, end.z, 0xdddddd);
  if (ammo === 0) reload();
}

/* ---------- vagues ---------- */
let wave = 0, toSpawn = 0, spawnT = 0, between = 0, score = 0, kills = 0, medkits = [];
function nextWave() {
  wave++; toSpawn = 4 + wave * 2; spawnT = 1.5; $("#wave").textContent = `Vague ${wave}`;
  $("#banner").textContent = `Vague ${wave}`; ft = 1.6;
}
function medkit() { const x = (Math.random() - 0.5) * 40, z = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 1.5); const m = new T.Mesh(geo, new T.MeshLambertMaterial({ color: 0xffffff })); m.scale.set(0.6, 0.4, 0.6); m.position.set(x, 0.3, z); const c1 = new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0xdc2626 })); c1.scale.set(0.7, 0.3, 0.3); const c2 = c1.clone(); c2.scale.set(0.3, 0.3, 0.7); c1.position.y = c2.position.y = 0.05; m.add(c1, c2); scene.add(m); medkits.push(m); }

/* ---------- partie ---------- */
let best = 0; try { best = +localStorage.getItem("tir-best") || 0; } catch (e) {}
$("#best").textContent = best ? `Record : ${best} points` : "";
function start() {
  enemies.slice().forEach(e => scene.remove(e.g)); enemies.length = 0; medkits.forEach(m => scene.remove(m)); medkits = [];
  Object.assign(P, { x: 6, y: 0, z: 2.2, vy: 0, yaw: Math.PI / 2, pitch: 0, hp: 100, ground: true });
  ammo = MAG; reloadT = 0; score = 0; kills = 0; shots = 0; hits = 0; wave = 0; between = 0;
  state = "play"; $("#panel").hidden = true; nextWave(); hud();
  if (!isTouch && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
}
function pause() { state = "pause"; $("#panel").hidden = false; $("#panel").innerHTML = mode === "mp" ? `<h1>Pause</h1><p>La partie continue pendant ta pause !</p><button class="btn" id="resume">Reprendre</button><br><button class="ghost" id="quitmp">Quitter la partie</button>` : `<h1>Pause</h1><p>Vague ${wave} · ${score} points</p><button class="btn" id="resume">Reprendre</button><br><a class="ghost" href="../">← Arcade</a>`; if (mode === "mp") $("#quitmp").onclick = () => MPH().leave(); $("#resume").onclick = () => { state = "play"; $("#panel").hidden = true; if (!isTouch && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} } }; }
function gameOver() {
  state = "over"; if (document.exitPointerLock) document.exitPointerLock();
  const acc = shots ? Math.round(hits / shots * 100) : 0, bonus = Math.round(score * acc / 400), total = score + bonus;
  const rec = total > best; if (rec) { best = total; try { localStorage.setItem("tir-best", total); } catch (e) {} }
  if (window.ONLINE) window.ONLINE.submit("tir", g => ({ best: Math.max(total, g.best || 0), wave: Math.max(wave, g.wave || 0), kills: (g.kills || 0) + kills, games: (g.games || 0) + 1 }));
  $("#panel").hidden = false;
  $("#panel").innerHTML = `<h1>${rec ? "Nouveau record !" : "Éliminé"}</h1><p>Vague ${wave} · ${kills} robots · précision ${acc} %</p><p><b>${score}</b> + bonus précision ${bonus} = <b style="color:#4ade80;font-size:22px">${total} points</b></p><p>Record : ${best}</p><button class="btn" id="again">Rejouer</button><br><a class="ghost" href="../">← Arcade</a>`;
  $("#again").onclick = start;
}
$("#go").onclick = start;
function hud() {
  if (mode === "mp") { $("#ammo").textContent = `${ammo} / ${MAG}`; $("#hp").style.width = Math.max(0, P.hp) + "%"; return; }
  $("#score").textContent = score; $("#ammo").textContent = `${ammo} / ${MAG}`; $("#hp").style.width = Math.max(0, P.hp) + "%";
  $("#left").textContent = state === "play" ? `${enemies.length + toSpawn} robot${enemies.length + toSpawn > 1 ? "s" : ""} restant${enemies.length + toSpawn > 1 ? "s" : ""}` : "";
}

/* ---------- boucle ---------- */
let last = performance.now(), hurt = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const aliveMP = mode !== "mp" || (MPH() && MPH().alive());
  if (mode === "mp" && MPH()) MPH().update(dt, state === "play");
  if (state === "play" && aliveMP) {
    // déplacement
    let fx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") || keys.has("KeyQ") ? 1 : 0) + mv.x, fz = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") || keys.has("KeyZ") ? 1 : 0) + mv.z;
    const l = Math.hypot(fx, fz); if (l > 1) { fx /= l; fz /= l; }
    const sp = (keys.has("ShiftLeft") ? 7.5 : 5.2) * dt, sn = Math.sin(P.yaw), cs = Math.cos(P.yaw);
    const dx = (fx * cs + fz * sn) * sp, dz = (-fx * sn + fz * cs) * sp;
    if (!hitsAt(P.x + dx, P.y, P.z, R, 0)) P.x += dx; if (!hitsAt(P.x, P.y, P.z + dz, R, 0)) P.z += dz;
    P.vy -= 16 * dt; P.y += P.vy * dt; const gy = groundAt(P.x, P.z, P.y);
    if (P.y <= gy) { P.y = gy; P.vy = 0; P.ground = true; } else if (P.y - gy > 0.05) P.ground = false;
    if (hitsAt(P.x, P.y, P.z, R, 0) && P.vy > 0) P.vy = 0;
    // arme
    cool -= dt; if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) { ammo = MAG; $("#reloadTxt").textContent = ""; } }
    if (fireHeld && cool <= 0 && reloadT <= 0) shoot();
    recoil = Math.max(0, recoil - dt * 10); gun.position.z = -0.32 + recoil * 0.04; gun.rotation.x = recoil * 0.08 - (reloadT > 0 ? 0.6 : 0);
    if (mode === "solo") {
    // vagues
    if (toSpawn > 0) { spawnT -= dt; if (spawnT <= 0) { makeRobot(wave); toSpawn--; spawnT = Math.max(0.35, 1.1 - wave * 0.06); } }
    else if (!enemies.length) { if (between <= 0) { between = 3; const b = 250 * wave; score += b; $("#banner").textContent = `Vague ${wave} nettoyée · +${b}`; ft = 2.2; medkit(); P.hp = Math.min(100, P.hp + 15); } else { between -= dt; if (between <= 0) nextWave(); } }
    // robots
    for (const e of enemies.slice()) {
      const ex = P.x - e.g.position.x, ez = P.z - e.g.position.z, d = Math.hypot(ex, ez);
      e.g.rotation.y = Math.atan2(ex, ez); e.t += dt * e.speed * 3;
      e.legL.rotation.x = Math.sin(e.t) * 0.6; e.legR.rotation.x = -Math.sin(e.t) * 0.6; e.armL.rotation.x = -Math.sin(e.t) * 0.5; e.armR.rotation.x = Math.sin(e.t) * 0.5;
      if (d > 1.3) {
        let vx = ex / d, vz = ez / d; if (e.side) { const s = e.side; [vx, vz] = [vx * 0.3 - vz * s, vz * 0.3 + vx * s]; e.stuck -= dt; if (e.stuck <= 0) e.side = 0; }
        const s = e.speed * dt, ox = e.g.position.x, oz = e.g.position.z;
        if (!hitsAt(ox + vx * s, 0, oz, 0.35, 1.0)) e.g.position.x += vx * s; if (!hitsAt(e.g.position.x, 0, oz + vz * s, 0.35, 1.0)) e.g.position.z += vz * s;
        const moved = Math.hypot(e.g.position.x - ox, e.g.position.z - oz);
        if (moved < s * 0.3 && !e.side) { e.side = Math.random() < 0.5 ? -1 : 1; e.stuck = 1.2; }
      } else { P.hp -= (e.tough ? 22 : 13) * dt; hurt = 0.4; }
      if (e.flash > 0) { e.flash -= dt; e.body.emissive.set(0xffffff); } else e.body.emissive.set(0x000000);
    }
    for (const m of medkits.slice()) { m.rotation.y += dt * 2; if (Math.hypot(m.position.x - P.x, m.position.z - P.z) < 1.2) { P.hp = Math.min(100, P.hp + 40); scene.remove(m); medkits.splice(medkits.indexOf(m), 1); floatTxt("+40 santé"); } }
    if (P.hp <= 0) { P.hp = 0; gameOver(); }
    }
    hud();
  }
  hurt = Math.max(0, hurt - dt); $("#hurt").style.opacity = Math.min(1, hurt * 2);
  if (ft > 0) { ft -= dt; if (ft <= 0) $("#banner").textContent = ""; }
  for (const t of tracers.slice()) { t.userData.l -= dt; if (t.userData.l <= 0) { scene.remove(t); tracers.splice(tracers.indexOf(t), 1); } }
  for (const s of sparks.slice()) { s.userData.l -= dt; s.userData.v.y -= 12 * dt; s.position.addScaledVector(s.userData.v, dt); if (s.userData.l <= 0) { scene.remove(s); sparks.splice(sparks.indexOf(s), 1); } }
  camera.position.set(P.x, P.y + EYE, P.z); camera.rotation.set(P.pitch, P.yaw, 0, "YXZ");
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
camera.position.set(6, EYE, 2.2); camera.rotation.set(0, Math.PI / 2, 0, "YXZ");
requestAnimationFrame(frame);
function lockPointer() { if (!isTouch && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (_) {} } }
function enterMP() { enemies.slice().forEach(e => scene.remove(e.g)); enemies.length = 0; medkits.forEach(m => scene.remove(m)); medkits = []; mode = "mp"; ammo = MAG; reloadT = 0; shots = 0; hits = 0; state = "play"; $("#panel").hidden = true; $("#wave").textContent = ""; $("#left").textContent = ""; lockPointer(); }
function exitMP() { mode = "solo"; state = "menu"; if (document.exitPointerLock) document.exitPointerLock(); }
function setHurt(v) { hurt = v; }
window.TIRCORE = { T, scene, camera, P, geo, solids, hitsAt, groundAt, spark, floatTxt, enterMP, exitMP, lockPointer, setHurt, isTouch, tracers, gunFlash: flash,
  set state(v) { state = v; }, get state() { return state; }, get mode() { return mode; }, refill() { ammo = MAG; reloadT = 0; $("#reloadTxt").textContent = ""; }, get acc() { return shots ? hits / shots : 0; } };
window.TIR = { start, get state() { return state; }, P, enemies, shoot, get score() { return score; }, look };
}
