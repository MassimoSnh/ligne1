"use strict";
/* Volt : moteur de plateforme déterministe (pas fixe 1/60 s) */
(function (root) {
const TS = 24, COLS = 40, ROWS = 22, DT = 1 / 60;
const K = {
  G: 2000, MAXF: 540, RUN: 170, ACC_G: 2600, ACC_A: 1700, FRIC: 2600,
  JV: 580, CUT: 0.45, DASH: 480, DASHT: 0.15, WJX: 220, WJY: 560, SLIDE: 115,
  COY: 0.1, BUF: 0.12, SPRING: 880, PW: 14, PH: 20, LOCK: 0.13
};
const SOLID = new Set(["#", "c"]);

function parse(map) {
  const rows = map.map(r => r.padEnd(COLS, " ").slice(0, COLS));
  const L = { rows, stars: [], crystals: [], springs: [], crumbles: [], start: null, exit: null };
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === "P") L.start = { x: x * TS + TS / 2, y: (y + 1) * TS };
    if (ch === "E") L.exit = { x, y };
    if (ch === "*") L.stars.push({ x: x * TS + TS / 2, y: y * TS + TS / 2 });
    if (ch === "o") L.crystals.push({ x: x * TS + TS / 2, y: y * TS + TS / 2 });
    if (ch === "s") L.springs.push({ x, y });
    if (ch === "c") L.crumbles.push({ x, y });
  }));
  return L;
}
function newState(L) {
  return {
    x: L.start.x, y: L.start.y, vx: 0, vy: 0, face: 1, ground: false, coyote: 0, buf: 0, jumped: false,
    dashOK: true, dashT: 0, dvx: 0, dvy: 0, lock: 0, held: false, dashHeld: false,
    got: 0, cr: L.crystals.map(() => 0), cb: L.crumbles.map(() => ({ t: -1, off: 0 })),
    t: 0, dead: false, won: false, spring: 0
  };
}
function tileAt(L, S, tx, ty) {
  if (tx < 0 || tx >= COLS) return "#";
  if (ty < 0) return " ";
  if (ty >= ROWS) return " ";
  const ch = L.rows[ty][tx];
  if (ch === "c") { const i = L.crumbles.findIndex(c => c.x === tx && c.y === ty); if (S.cb[i].off > 0) return " "; }
  return ch;
}
const solidAt = (L, S, tx, ty) => SOLID.has(tileAt(L, S, tx, ty));
function boxHits(L, S, x, y, w, h, fn) {
  const x0 = Math.floor(x / TS), x1 = Math.floor((x + w - 0.001) / TS), y0 = Math.floor(y / TS), y1 = Math.floor((y + h - 0.001) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (fn(tx, ty)) return true;
  return false;
}
// le joueur : (x = centre, y = bas)
const left = S => S.x - K.PW / 2, top = S => S.y - K.PH;
function collides(L, S, x, y) {
  const lx = x - K.PW / 2, ty = y - K.PH;
  return boxHits(L, S, lx, ty, K.PW, K.PH, (tx, tyy) => solidAt(L, S, tx, tyy));
}
function oneWayBelow(L, S, prevY, y) {
  // plateforme traversante '-' : bloque seulement en descendant, si les pieds étaient au-dessus
  const lx = S.x - K.PW / 2, x0 = Math.floor(lx / TS), x1 = Math.floor((lx + K.PW - 0.001) / TS);
  const ty = Math.floor((y - 0.001) / TS);
  for (let tx = x0; tx <= x1; tx++) if (tileAt(L, S, tx, ty) === "-" && prevY <= ty * TS + 0.01) return ty * TS;
  return null;
}
function hazard(L, S) {
  const lx = left(S) + 2, ty = top(S) + 2, w = K.PW - 4, h = K.PH - 4;
  return boxHits(L, S, lx, ty, w, h, (tx, tyy) => {
    const ch = tileAt(L, S, tx, tyy), X = tx * TS, Y = tyy * TS;
    let hb = null;
    if (ch === "^") hb = [X + 3, Y + 12, TS - 6, 12]; else if (ch === "v") hb = [X + 3, Y, TS - 6, 12];
    else if (ch === ">") hb = [X, Y + 3, 12, TS - 6]; else if (ch === "<") hb = [X + 12, Y + 3, 12, TS - 6];
    if (!hb) return false;
    return lx < hb[0] + hb[2] && lx + w > hb[0] && ty < hb[1] + hb[3] && ty + h > hb[1];
  });
}
function touchingWall(L, S, dir) { return collides(L, S, S.x + dir * 2, S.y - 2); }

// in : {h:-1|0|1, v:-1|0|1, jump:bool (tenu), dash:bool (tenu)}
function step(L, S, inp) {
  if (S.dead || S.won) return;
  S.t += DT;
  const jp = inp.jump && !S.held; S.held = inp.jump;
  const dp = inp.dash && !S.dashHeld; S.dashHeld = inp.dash;
  if (jp) S.buf = K.BUF; else S.buf = Math.max(0, S.buf - DT);
  if (inp.h) S.face = inp.h;
  // timers des objets
  S.cr = S.cr.map(t => Math.max(0, t - DT));
  L.crumbles.forEach((c, i) => {
    const b = S.cb[i];
    if (b.off > 0) { b.off -= DT; if (b.off <= 0) { b.off = 0; if (boxHits(L, S, left(S), top(S), K.PW, K.PH, (tx, ty) => tx === c.x && ty === c.y)) b.off = 0.1; } }
    else if (b.t >= 0) { b.t -= DT; if (b.t < 0) { b.off = 2.5; b.t = -1; } }
  });
  // dash
  if (dp && S.dashOK && S.dashT <= 0) {
    let dx = inp.h, dy = inp.v; if (!dx && !dy) dx = S.face;
    const n = Math.hypot(dx, dy); S.dvx = dx / n * K.DASH; S.dvy = dy / n * K.DASH;
    S.dashT = K.DASHT; S.dashOK = false; S.vx = S.dvx; S.vy = S.dvy; S.jumped = false;
  }
  if (S.dashT > 0) {
    S.dashT -= DT; S.vx = S.dvx; S.vy = S.dvy;
    if (S.dashT <= 0) { S.vx *= 0.55; if (S.vy < 0) S.vy *= 0.5; else S.vy *= 0.6; }
  } else {
    // horizontal
    S.lock = Math.max(0, S.lock - DT);
    const target = S.lock > 0 ? S.vx : inp.h * K.RUN, acc = S.ground ? K.ACC_G : K.ACC_A;
    if (S.lock <= 0) { const d = target - S.vx, a = (inp.h ? acc : (S.ground ? K.FRIC : K.ACC_A * 0.5)) * DT; S.vx += Math.abs(d) <= a ? d : Math.sign(d) * a; }
    // gravité, saut variable
    S.vy = Math.min(K.MAXF, S.vy + K.G * DT * (Math.abs(S.vy) < 60 && S.held ? 0.6 : 1));
    if (S.jumped && S.vy < 0 && !S.held) { S.vy *= K.CUT; S.jumped = false; }
    // glissade le long du mur
    const wl = touchingWall(L, S, -1), wr = touchingWall(L, S, 1);
    if (!S.ground && S.vy > K.SLIDE && ((wl && inp.h < 0) || (wr && inp.h > 0))) S.vy = K.SLIDE;
    // saut
    if (S.buf > 0) {
      if (S.ground || S.coyote > 0) { S.vy = -K.JV; S.buf = 0; S.coyote = 0; S.jumped = true; S.ground = false; }
      else if (wl || wr) { const d = wl ? 1 : -1; S.vx = d * K.WJX; S.vy = -K.WJY; S.buf = 0; S.lock = K.LOCK; S.jumped = true; S.face = d; }
    }
  }
  // déplacement axe par axe
  const nx = S.x + S.vx * DT;
  if (!collides(L, S, nx, S.y)) S.x = nx;
  else { const st = Math.sign(S.vx); let k = 0; while (k < 30 && !collides(L, S, S.x + st * 0.5, S.y)) { S.x += st * 0.5; k++; } S.vx = 0; if (S.dashT > 0) S.dvx = 0; }
  const py = S.y, ny = S.y + S.vy * DT;
  let landed = false;
  if (!collides(L, S, S.x, ny)) {
    const ow = S.vy > 0 ? oneWayBelow(L, S, py, ny) : null;
    if (ow !== null) { S.y = ow; S.vy = 0; landed = true; } else S.y = ny;
  } else {
    const st = Math.sign(S.vy); let k = 0; while (k < 40 && !collides(L, S, S.x, S.y + st * 0.5)) { S.y += st * 0.5; k++; }
    if (S.vy > 0) landed = true; S.vy = 0; if (S.dashT > 0) S.dvy = 0;
  }
  const g = landed || collides(L, S, S.x, S.y + 1) || (S.vy >= 0 && oneWayBelow(L, S, S.y - 1, S.y + 1) !== null);
  if (g) { S.ground = true; S.coyote = K.COY; if (S.dashT <= 0) S.dashOK = true; S.jumped = false; }
  else { if (S.ground) S.coyote = K.COY; S.ground = false; S.coyote = Math.max(0, S.coyote - DT); }
  // blocs qui s'effondrent sous les pieds
  if (S.ground) L.crumbles.forEach((c, i) => { const b = S.cb[i]; if (b.off <= 0 && b.t < 0 && boxHits(L, S, left(S), S.y, K.PW, 2, (tx, ty) => tx === c.x && ty === c.y)) b.t = 0.45; });
  // ressorts
  for (const sp of L.springs) {
    const X = sp.x * TS, Y = sp.y * TS + 12;
    if (S.vy >= 0 && left(S) < X + TS && left(S) + K.PW > X && S.y >= Y && top(S) < Y + 12) { S.vy = -K.SPRING; S.dashOK = true; S.dashT = 0; S.jumped = false; S.spring = 0.25; S.ground = false; }
  }
  S.spring = Math.max(0, S.spring - DT);
  // cristaux
  L.crystals.forEach((c, i) => { if (S.cr[i] <= 0 && !S.dashOK && Math.abs(S.x - c.x) < 16 && Math.abs(S.y - K.PH / 2 - c.y) < 18) { S.dashOK = true; S.cr[i] = 2.5; } });
  // étoiles
  L.stars.forEach((s, i) => { if (!(S.got & (1 << i)) && Math.abs(S.x - s.x) < 17 && Math.abs(S.y - K.PH / 2 - s.y) < 19) S.got |= 1 << i; });
  // mort / sortie
  if (S.y - K.PH > ROWS * TS + 10 || hazard(L, S)) S.dead = true;
  if (L.exit && boxHits(L, S, left(S), top(S), K.PW, K.PH, (tx, ty) => tx === L.exit.x && ty === L.exit.y)) S.won = true;
}
function clone(S) { return { ...S, cr: S.cr.slice(), cb: S.cb.map(b => ({ ...b })) }; }
root.VOLT = { TS, COLS, ROWS, DT, K, parse, newState, step, clone, tileAt };
})(typeof window !== "undefined" ? window : globalThis);
if (typeof module !== "undefined") module.exports = globalThis.VOLT;
