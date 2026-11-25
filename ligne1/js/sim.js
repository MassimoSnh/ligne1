"use strict";
/* Ligne 1 : moteur de simulation (vue de dessus) + automate ladder */
window.SIM = (() => {
const PS = 34, CW = 46, WW = 1040, WH = 600;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * clamp(k, 0, 1);
let W = null, PID = 0;
const B = (c, id) => !!W.bits[c.a[id]];
const S = (c, id, v) => { if (c.a[id]) W.bits[c.a[id]] = !!v; };
function log(msg, cls = "") { W.logs.unshift({ t: W.t, msg, cls }); if (W.logs.length > 40) W.logs.length = 40; W.logV++; }
function fail(msg) { if (W.end) return; W.end = { kind: "fail", msg }; log(msg, "bad"); }
function mkPart(o) { return Object.assign({ id: ++PID, kind: "piece", color: "blue", metal: false, defect: false, x: 0, y: 0, state: "belt", conv: null, q: {}, ko: null, fill: 0, moving: false }, o); }
const under = (cv, x, tol = PS / 2) => W.parts.find(p => p.state === "belt" && p.conv === cv && Math.abs(p.x - x) < tol);
const T = {};
function put(id, p, x) { const t = W.byId[id]; (T[t.type].drop || T[t.type].put)(t, p, x); }

/* ---------- dessin : utilitaires ---------- */
function rr(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function circ(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
function txt(g, s, x, y, c = "#cfd6dc", sz = 13, al = "center", w = 600) { g.fillStyle = c; g.font = `${w} ${sz}px Inter,system-ui,sans-serif`; g.textAlign = al; g.textBaseline = "middle"; g.fillText(s, x, y); }
function tag(g, s, x, y, al = "center") {
  g.font = "600 12px 'JetBrains Mono',monospace"; const w = g.measureText(s).width + 10;
  const x0 = al === "center" ? x - w / 2 : al === "right" ? x - w : x;
  g.fillStyle = "#0d1013e6"; g.fillRect(x0, y - 9, w, 18); g.fillStyle = "#e9edf0"; g.textAlign = "left"; g.textBaseline = "middle"; g.fillText(s, x0 + 5, y + 0.5);
}
const addrs = (c, ids) => ids.filter(i => c.a[i]).map(i => c.a[i]).join(" ");

/* ---------- composants ---------- */
T.conv = {
  init: () => ({ speed: 120, thOK: true, on: false, off: 0, label: "Moteur convoyeur" }),
  io: c => [{ id: "m", dir: "out", label: c.label, f: "m" }].concat(c.thermal ? [{ id: "th", dir: "in", label: c.thLabel || "Disjoncteur moteur OK" }] : []),
  sense(c) { if (c.thermal) S(c, "th", c.thOK); },
  act(c, dt) {
    const on = B(c, "m") && c.thOK; c.on = on; if (on) c.off = (c.off + c.speed * dt) % 28;
    const nxt = c.end && c.end.to ? W.byId[c.end.to] : null;
    const ps = W.parts.filter(p => p.state === "belt" && p.conv === c).sort((a, b) => b.x - a.x);
    let lim = Infinity;
    if (nxt) for (const p of W.parts) if (p.state === "belt" && p.conv === nxt) lim = Math.min(lim, p.x - PS / 2 - 3);
    for (const p of ps) {
      const x0 = p.x; let f = x0 + PS / 2 + (on ? c.speed * dt : 0);
      for (const b of W.blockers) if (b.cv === c && b.up() && x0 + PS / 2 <= b.bx + 0.5) f = Math.min(f, b.bx);
      f = Math.min(f, lim);
      if (c.end === "block" || (nxt && !nxt.on)) f = Math.min(f, c.x2);
      const nx = Math.max(x0, f - PS / 2); p.moving = nx > x0 + 1e-4; p.x = nx; p.y = c.y; lim = p.x - PS / 2 - 3;
      if (p.x > c.x2) {
        if (nxt) p.conv = nxt;
        else if (c.end && c.end.boxer) put(c.end.boxer, p);
        else if (c.end && c.end.bin) put(c.end.bin, p);
        else { p.state = "fall"; p.ft = 0; fail(`Une pièce est tombée au bout du convoyeur (${c.a.m}) !`); }
      }
    }
  },
  draw(c, g) {
    const y = c.y - CW / 2, L = c.x2 - c.x1;
    rr(g, c.x1 - 2, y - 5, L + 4, CW + 10, "#48525b"); rr(g, c.x1, y, L, CW, "#252b30");
    g.save(); g.beginPath(); g.rect(c.x1, y, L, CW); g.clip(); for (let x = c.x1 - 28 + c.off; x < c.x2; x += 28) rr(g, x, y, 11, CW, "#2f373e"); g.restore();
    const mx = c.x1 + 4, my = c.y + CW / 2 + 7;
    rr(g, mx, my, 30, 20, c.thOK ? "#2c6fb0" : "#8a2a24"); circ(g, mx + 23, my + 10, 4, c.on ? "#3ddc7a" : "#1f3a2a");
    tag(g, addrs(c, ["m", "th"]), mx + 34, my + 10, "left");
  }
};

T.sens = {
  init: () => ({ kind: "presence", dead: false }),
  io: c => [{ id: "i", dir: "in", label: c.label }],
  sense(c) {
    const tol = c.kind === "zone" ? PS + 4 : PS / 2;
    const on = !c.dead && W.parts.some(p => p.state === "belt" && p.conv === c.cv && Math.abs(p.x - c.x) < tol && (c.kind === "red" ? p.color === "red" : c.kind === "metal" ? p.metal : true));
    c.on = on; S(c, "i", on);
  },
  draw(c, g) {
    const y = c.cv.y, s = c.side || -1, ey = y + s * (CW / 2 + 9);
    if (c.kind === "metal") { circ(g, c.x, y + (CW / 2 + 9) * s, 8, "#7b8691"); circ(g, c.x, y + (CW / 2 + 9) * s, 4, c.on ? "#3ddc7a" : "#2b3238"); }
    else {
      rr(g, c.x - 6, ey - 6, 12, 12, c.kind === "red" ? "#c44" : "#f2b705"); rr(g, c.x - 4, y - s * (CW / 2 + 9) - 4, 8, 8, "#59636d");
      g.strokeStyle = c.on ? "#ff3b30" : "#ff3b3040"; g.lineWidth = c.on ? 2.5 : 1.5; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(c.x, y - CW / 2 - 4); g.lineTo(c.x, y + CW / 2 + 4); g.stroke(); g.setLineDash([]);
    }
    tag(g, c.a.i, c.x + (c.tdx || 0), ey + s * 18 + (c.tdy || 0));
  }
};

T.pick = {
  init: () => ({ t: 0, delay: 0.6, anim: 0 }),
  io: () => [],
  act(c, dt) {
    if (c.anim > 0) c.anim -= dt;
    const p = W.parts.find(p => p.state === "belt" && p.conv === c.cv && Math.abs(p.x - c.x) < PS / 2);
    if (p && !p.moving) { c.t += dt; if (c.t >= c.delay) { c.t = 0; c.anim = 0.35; put(c.bin, p); } } else c.t = 0;
  },
  draw(c, g) {
    const y = c.cv.y + (CW / 2 + 40) * (c.side || 1);
    circ(g, c.x, y, 13, "#c9a27a"); circ(g, c.x, y, 7, "#2a3a55");
    if (c.anim > 0) { g.strokeStyle = "#c9a27a"; g.lineWidth = 6; g.beginPath(); g.moveTo(c.x, y); g.lineTo(c.x, c.cv.y); g.stroke(); }
  }
};

T.bin = {
  init: () => ({ n: 0, w: 80, h: 60, items: [] }),
  io: () => [],
  put(c, p) {
    p.state = "bin"; const err = c.accept ? c.accept(p) : null;
    if (err) return fail(err);
    c.n++; W.delivered++; c.items.push(p); if (c.items.length > 6) c.items.shift(); log(`${c.label} : ${c.n}${c.goal ? "/" + c.goal : ""}`, "ok");
  },
  draw(c, g) {
    rr(g, c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, "#20262b"); g.strokeStyle = "#59636d"; g.lineWidth = 2; g.strokeRect(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h);
    c.items.forEach((p, i) => drawPart(g, Object.assign({}, p, { x: c.x - c.w / 2 + 14 + (i % 3) * 20, y: c.y - 6 + Math.floor(i / 3) * 14 }), 0.55));
    txt(g, `${c.label} ${c.n}${c.goal ? "/" + c.goal : ""}`, c.x, c.y + c.h / 2 + 12, "#cfd6dc", 13);
  }
};

T.feed = {
  init: () => ({ i: 0, t: 0, delay: 1.2 }),
  io: () => [],
  spawn(c) { const o = c.seq[c.i++]; W.parts.push(mkPart(Object.assign({ x: c.x, y: c.cv.y, conv: c.cv }, o))); c.t = 0; },
  act(c, dt) {
    c.t += dt; if (c.i >= c.seq.length || !W.started) return;
    if (c.t >= c.delay && !W.parts.some(p => p.state === "belt" && p.conv === c.cv && p.x - PS / 2 < c.x + PS / 2 + (c.gap || 8))) T.feed.spawn(c);
  },
  left: c => c.seq.length - c.i,
  draw(c, g) { if (c.i < c.seq.length) txt(g, `reste ${c.seq.length - c.i}`, c.x, c.cv.y - CW / 2 - 16, "#9aa5ae", 12, "center", 500); }
};

T.stop = {
  init: () => ({}),
  io: c => [{ id: "q", dir: "out", label: c.label || "Butée : lever", f: "h" }],
  blocker: c => ({ cv: c.cv, bx: c.x, up: () => B(c, "q") }),
  draw(c, g) {
    const up = B(c, "q");
    rr(g, c.x - 3, c.cv.y - CW / 2 - 8, 6, CW + 16, up ? "#e8251a" : "#59636d");
    if (up) rr(g, c.x - 3, c.cv.y - CW / 2, 6, CW, "#f2b705");
    tag(g, c.a.q, c.x + (c.tdx || 0), c.cv.y - CW / 2 - 20 + (c.tdy || 0));
  }
};

T.push = {
  init: () => ({ s: 0, side: -1, deadIn: false, deadOut: false }),
  io: c => [{ id: "q", dir: "out", label: c.label || "Vérin éjecteur : sortir", f: "m" }, { id: "in", dir: "in", label: "Éjecteur rentré" }, { id: "out", dir: "in", label: "Éjecteur sorti" }],
  sense(c) { S(c, "in", c.s <= 0.02 && !c.deadIn); S(c, "out", c.s >= 0.98 && !c.deadOut); },
  blocker: c => ({ cv: c.cv, bx: c.x - PS / 2, up: () => c.s > 0.3 }),
  act(c, dt) {
    c.s = clamp(c.s + (B(c, "q") ? 1 : -1) * dt * 2.2, 0, 1);
    if (c.s > 0.12) for (const p of W.parts) if (p.state === "belt" && p.conv === c.cv && Math.abs(p.x - c.x) < PS * 0.55) { p.state = "pushed"; p.push = 0; p.pusher = c; }
    for (const p of W.parts) if (p.state === "pushed" && p.pusher === c) {
      p.push = Math.max(p.push, c.s); p.y = c.cv.y + c.side * p.push * (CW / 2 + PS / 2 + 16);
      if (p.push >= 0.98) put(c.bin, p);
    }
  },
  draw(c, g) {
    const s = -c.side, by = c.cv.y + s * (CW / 2 + 22);
    rr(g, c.x - 12, by - 14, 24, 28, "#6c7883"); rr(g, c.x - 8, by - 10, 16, 20, "#8a96a1");
    const ry = by - s * 14, len = c.s * (CW + 30);
    rr(g, c.x - 3, s > 0 ? ry - len : ry, 6, len, "#cfd6dc");
    rr(g, c.x - PS / 2, (s > 0 ? ry - len : ry + len) - 3, PS, 6, "#f2b705");
    tag(g, addrs(c, ["q", "in", "out"]), c.x, by + s * 28);
  }
};

T.tool = {
  init: () => ({ s: 0, kind: "press", thOK: true, ang: 0 }),
  io: c => {
    const L = [{ id: "d", dir: "out", label: c.lDown || "Outil : descendre", f: "m" }];
    if (c.kind === "drill") L.push({ id: "spin", dir: "out", label: "Broche perceuse : rotation", f: "m" });
    L.push({ id: "h", dir: "in", label: c.lUp || "Outil en haut" }, { id: "b", dir: "in", label: c.lBas || "Outil en bas" });
    if (c.kind === "probe") L.push({ id: "ok", dir: "in", label: "Palpeur : cote OK" });
    if (c.thermal) L.push({ id: "th", dir: "in", label: "Disjoncteur broche OK" });
    return L;
  },
  sense(c) {
    S(c, "h", c.s <= 0.02); S(c, "b", c.s >= 0.98);
    if (c.kind === "probe") { const p = under(c.cv, c.x, 8); S(c, "ok", c.s >= 0.98 && !!p && (p.q.drill || 0) >= 0.78 && !p.defect); }
    if (c.thermal) S(c, "th", c.thOK);
  },
  blocker: c => ({ cv: c.cv, bx: c.x - PS / 2, up: () => c.s > 0.2 }),
  act(c, dt) {
    const s0 = c.s; c.s = clamp(c.s + (B(c, "d") ? 1 : -1) * dt * 2, 0, 1);
    c.spin = c.kind === "drill" && B(c, "spin") && c.thOK; if (c.spin) c.ang += dt * 18;
    const p = under(c.cv, c.x, PS / 2);
    if (p && c.s > 0.6 && p.moving) return fail(`Collision : ${c.name} est descendu sur une pièce en mouvement.`);
    if (p && c.s >= 0.98) {
      if (c.kind === "drill" && !c.spin && s0 < 0.98) return fail("Foret cassé : la perceuse est descendue dans la pièce sans que la broche tourne.");
      if (c.kind !== "drill" || c.spin) p.q[c.kind] = (p.q[c.kind] || 0) + dt;
    }
  },
  draw(c, g) {
    const y = c.cv.y, sz = 40 - c.s * 10;
    rr(g, c.x - 30, y - CW / 2 - 34, 60, 22, "#4a545e");
    g.fillStyle = c.kind === "press" ? "#8b5cf6" : c.kind === "drill" ? "#0ea5e9" : "#14b8a6"; g.globalAlpha = 0.9; g.fillRect(c.x - sz / 2, y - sz / 2, sz, sz); g.globalAlpha = 1;
    g.strokeStyle = "#0d1013"; g.lineWidth = 2; g.strokeRect(c.x - sz / 2, y - sz / 2, sz, sz);
    if (c.kind === "drill") { g.save(); g.translate(c.x, y); g.rotate(c.ang); rr(g, -9, -1.5, 18, 3, c.thOK ? "#fff" : "#f66"); rr(g, -1.5, -9, 3, 18, c.thOK ? "#fff" : "#f66"); g.restore(); }
    else circ(g, c.x, y, 4 + c.s * 3, "#fff");
    txt(g, c.name, c.x, y - CW / 2 - 23, "#fff", 12);
    tag(g, addrs(c, ["d", "spin", "h", "b", "ok", "th"]), c.x, y + CW / 2 + 16);
  }
};

T.oven = {
  init: () => ({ tp: 20 }),
  io: () => [{ id: "h", dir: "out", label: "Résistances du four", f: "e" }, { id: "t180", dir: "in", label: "Four T ≥ 180 °C" }, { id: "t200", dir: "in", label: "Four T ≥ 200 °C" }, { id: "t230", dir: "in", label: "Four T ≥ 230 °C (alarme haute)" }],
  sense(c) { S(c, "t180", c.tp >= 180); S(c, "t200", c.tp >= 200); S(c, "t230", c.tp >= 230); },
  act(c, dt) {
    c.tp = B(c, "h") ? c.tp + 14 * dt : Math.max(20, c.tp - 4 * dt);
    if (c.tp > 260) return fail("Surchauffe : le four a dépassé 260 °C et sa sécurité a tout coupé.");
    for (const p of W.parts) if (p.state === "belt" && p.conv === c.cv && p.x > c.x1 && p.x < c.x2) {
      if (c.tp < 160 || c.tp > 240) p.ko = p.ko || (c.tp < 160 ? "mal cuite (four trop froid)" : "brûlée (four trop chaud)"); else p.q.cuit = true;
    }
  },
  draw(c, g) {
    const k = clamp((c.tp - 20) / 220, 0, 1), y = c.cv.y;
    g.fillStyle = `rgba(${Math.round(60 + 195 * k)},${Math.round(90 + 40 * k)},${Math.round(160 - 140 * k)},0.42)`;
    g.fillRect(c.x1, y - CW / 2 - 14, c.x2 - c.x1, CW + 28);
    g.strokeStyle = "#c2410c"; g.lineWidth = 2; g.strokeRect(c.x1, y - CW / 2 - 14, c.x2 - c.x1, CW + 28);
    txt(g, `FOUR ${Math.round(c.tp)} °C`, (c.x1 + c.x2) / 2, y - CW / 2 - 26, c.tp >= 180 && c.tp <= 230 ? "#fdba74" : "#fff", 14, "center", 700);
    tag(g, addrs(c, ["h", "t180", "t200", "t230"]), (c.x1 + c.x2) / 2, y + CW / 2 + 26);
  }
};

T.tank = {
  init: () => ({ lv: 0.3, tp: 20, mixT: 0, ang: 0 }),
  io: () => [{ id: "pump", dir: "out", label: "Pompe de remplissage cuve", f: "m" }, { id: "mix", dir: "out", label: "Agitateur", f: "m" }, { id: "heat", dir: "out", label: "Chauffe cuve", f: "e" },
    { id: "bas", dir: "in", label: "Niveau cuve bas" }, { id: "haut", dir: "in", label: "Niveau cuve haut" }, { id: "th", dir: "in", label: "Niveau très haut (alarme)" }, { id: "t60", dir: "in", label: "T produit ≥ 60 °C" }, { id: "t70", dir: "in", label: "T produit ≥ 70 °C" }],
  sense(c) { S(c, "bas", c.lv > 0.15); S(c, "haut", c.lv > 0.8); S(c, "th", c.lv > 0.92); S(c, "t60", c.tp >= 60); S(c, "t70", c.tp >= 70); },
  good: c => c.mixT >= 2.95 && c.tp >= 55 && c.tp <= 78,
  act(c, dt) {
    if (B(c, "pump")) { const d = 0.07 * dt; c.tp = (c.tp * c.lv + 20 * d) / (c.lv + d); c.lv += d; c.mixT = 0; if (c.lv >= 1) return fail("Débordement : la cuve a débordé !"); }
    if (B(c, "mix")) { c.ang += dt * 8; if (c.lv < 0.15) return fail("Agitateur à sec : il a tourné avec un niveau trop bas."); if (!B(c, "pump")) c.mixT += dt; }
    if (B(c, "heat")) { if (c.lv < 0.15) return fail("Résistance grillée : la chauffe était active avec un niveau trop bas."); c.tp += 4 * dt; } else c.tp = Math.max(20, c.tp - 0.4 * dt);
    if (c.tp > 90) return fail("Produit brûlé : la cuve a dépassé 90 °C.");
  },
  draw(c, g) {
    const x = c.x - 55, y = c.y - 80, w = 110, h = 160;
    rr(g, x - 4, y - 4, w + 8, h + 8, "#59636d"); rr(g, x, y, w, h, "#15191c");
    const k = clamp((c.tp - 20) / 60, 0, 1);
    rr(g, x, y + h * (1 - c.lv), w, h * c.lv, `rgb(${Math.round(40 + 180 * k)},${Math.round(110 - 40 * k)},${Math.round(200 - 150 * k)})`);
    for (const [v, lab] of [[0.15, "bas"], [0.8, "haut"], [0.92, "très haut"]]) { rr(g, x + w, y + h * (1 - v) - 1, 10, 2, "#f2b705"); }
    g.save(); g.translate(c.x, y + h * 0.7); g.rotate(c.ang); rr(g, -22, -3, 44, 6, "#cfd6dc"); g.restore();
    txt(g, `CUVE ${Math.round(c.lv * 100)} %`, c.x, y - 16, "#fff", 14, "center", 700);
    txt(g, `${Math.round(c.tp)} °C ${T.tank.good(c) ? "prêt" : c.mixT < 3 ? "à mélanger" : "pas à température"}`, c.x, y + h + 16, T.tank.good(c) ? "#3ddc7a" : "#fdba74", 13);
    tag(g, addrs(c, ["pump", "mix", "heat"]), c.x, y + h + 36);
    tag(g, addrs(c, ["bas", "haut", "th", "t60", "t70"]), c.x, y + h + 56);
  }
};

T.fill = {
  init: () => ({ rate: 0.5, closedAt: -9, vPrev: false }),
  io: () => [{ id: "v", dir: "out", label: "Vanne de remplissage", f: "e" }, { id: "plein", dir: "in", label: "Bouteille pleine (niveau atteint)" }],
  sense(c) { const p = under(c.cv, c.x, 10); S(c, "plein", !!p && p.fill >= 0.98); },
  act(c, dt) {
    const v = B(c, "v"); if (!v && c.vPrev) c.closedAt = W.t; c.vPrev = v; c.flow = false;
    if (v) {
      let fl = c.rate; const tk = c.tank ? W.byId[c.tank] : null;
      if (tk) { if (tk.lv < 0.04) fl = 0; else tk.lv -= fl * dt * 0.05; }
      if (fl > 0) {
        const p = under(c.cv, c.x, 10); c.flow = true;
        if (!p) return fail("Produit renversé : la vanne était ouverte sans bouteille dessous.");
        p.fill += fl * dt; if (tk && !T.tank.good(tk)) p.ko = p.ko || "remplie avec un produit pas prêt (pas mélangé ou pas à température)";
        if (p.fill > 1.15) return fail("Ça déborde : la bouteille a été trop remplie !");
      }
    }
    for (const q of W.parts) if (q.state === "belt" && q.conv === c.cv && q.moving && q.fill > 0 && Math.abs(q.x - c.x) < 10 && !v && W.t - c.closedAt < 0.9) q.ko = q.ko || "partie avant la fin de l'égouttage (ça coule)";
  },
  draw(c, g) {
    const y = c.cv.y; rr(g, c.x - 5, y - CW / 2 - 40, 10, 34, "#8a959f"); circ(g, c.x, y - CW / 2 - 6, 8, "#cfd6dc");
    if (c.flow) { g.strokeStyle = "#60a5fa"; g.lineWidth = 4; g.beginPath(); g.moveTo(c.x, y - CW / 2); g.lineTo(c.x, y); g.stroke(); }
    tag(g, addrs(c, ["v", "plein"]), c.x, y - CW / 2 - 52);
  }
};

T.bowl = {
  init: () => ({ queue: [], cnt: 5, ft: 0, jam: 0, si: 0, escPrev: false, sh: 0 }),
  io: () => [{ id: "vib", dir: "out", label: "Bol : vibreur", f: "m" }, { id: "tre", dir: "out", label: "Trémie : remplir le bol", f: "m" }, { id: "esc", dir: "out", label: "Échappement : lâcher 1 pièce", f: "m" },
    { id: "pr", dir: "in", label: "Pièce prête en sortie de rail" }, { id: "full", dir: "in", label: "Rail d'accumulation plein" }, { id: "low", dir: "in", label: "Niveau bol bas" }],
  sense(c) { S(c, "pr", c.queue.length > 0); S(c, "full", c.queue.length >= 4); S(c, "low", c.cnt < 4); },
  left: c => c.seq.length - c.si + c.queue.length,
  act(c, dt) {
    if (B(c, "vib")) {
      c.sh += dt * 60; c.ft += dt;
      if (c.ft >= 0.3) { c.ft = 0; if (c.cnt >= 1 && c.si < c.seq.length && c.queue.length < 5) { c.cnt -= 1; c.queue.push(mkPart(Object.assign({ state: "rail" }, c.seq[c.si++]))); } }
      if (c.queue.length >= 5) { c.jam += dt; if (c.jam > 2) return fail("Bourrage : le rail était plein et le vibreur a continué à pousser."); }
    } else c.jam = Math.max(0, c.jam - dt);
    if (B(c, "tre")) { c.cnt += 4 * dt; if (c.cnt > 26) return fail("Le bol déborde : la trémie a versé beaucoup trop de pièces."); }
    const e = B(c, "esc");
    if (e && !c.escPrev && c.queue.length) {
      if (W.parts.some(p => p.state === "belt" && p.conv === c.cv && Math.abs(p.x - c.dropX) < PS + 2)) return fail("Pièces empilées : l'échappement a lâché une pièce sur une autre.");
      const p = c.queue.shift(); p.state = "belt"; p.conv = c.cv; p.x = c.dropX; p.y = c.cv.y; W.parts.push(p);
    }
    c.escPrev = e;
  },
  draw(c, g) {
    const ox = B(c, "vib") ? Math.sin(c.sh) * 1.5 : 0;
    circ(g, c.x + ox, c.y, 70, "#59636d"); circ(g, c.x + ox, c.y, 62, "#2a3036");
    g.strokeStyle = "#7b8691"; g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 12.5; a += 0.2) { const r = 14 + a * 3.6; g.lineTo(c.x + ox + Math.cos(a) * r, c.y + Math.sin(a) * r); } g.stroke();
    txt(g, `${Math.floor(c.cnt)} pièces`, c.x, c.y, "#fff", 13);
    const rx1 = c.x + 70, rx2 = c.dropX - PS / 2 - 2;
    rr(g, rx1, c.cv.y - 14, rx2 - rx1, 28, "#3a434b");
    c.queue.forEach((p, i) => drawPart(g, Object.assign({}, p, { x: rx2 - 12 - i * 22, y: c.cv.y }), 0.62));
    if (B(c, "esc")) rr(g, rx2 - 2, c.cv.y - 16, 4, 32, "#3ddc7a"); else rr(g, rx2 - 2, c.cv.y - 16, 4, 32, "#e8251a");
    txt(g, "BOL VIBRANT", c.x, c.y - 84, "#fff", 13, "center", 700);
    tag(g, addrs(c, ["vib", "tre", "esc"]), c.x, c.y + 84);
    tag(g, addrs(c, ["pr", "full", "low"]), c.x, c.y + 104);
  }
};

T.boxer = {
  init: () => ({ n: 0, cap: 6, done: 0, present: true, t: 0, prev: false, slide: 0 }),
  io: () => [{ id: "evac", dir: "out", label: "Évacuer le carton", f: "h" }, { id: "pres", dir: "in", label: "Carton en place" }],
  sense(c) { S(c, "pres", c.present); },
  drop(c, p) {
    p.state = "bin";
    if (!c.present) { p.state = "fall"; p.ft = 0; return fail("Pièce par terre : il n'y avait pas de carton en place."); }
    const err = c.accept ? c.accept(p) : null; if (err) return fail(err);
    c.n++; W.delivered++; if (c.n > c.cap) return fail(`Carton trop plein : ${c.n} pièces pour ${c.cap} places.`);
  },
  act(c, dt) {
    const e = B(c, "evac");
    if (e && !c.prev && c.present) {
      if (c.n !== c.cap) return fail(`Carton incomplet expédié : ${c.n} pièce(s) au lieu de ${c.cap}.`);
      c.done++; c.present = false; c.t = 0; log(`Carton ${c.done} expédié.`, "ok");
    }
    c.prev = e;
    if (!c.present) { c.t += dt; c.slide = c.t; if (c.t > 2) { c.present = true; c.n = 0; c.slide = 0; } }
  },
  draw(c, g) {
    rr(g, c.x - 40, c.y - 40, 80, 80, "#2a3036");
    if (c.present || c.t < 1) {
      const dy = c.present ? 0 : c.t * 120;
      rr(g, c.x - 32, c.y - 32 + dy, 64, 64, "#b07a45"); rr(g, c.x - 28, c.y - 28 + dy, 56, 56, "#8a5c2e");
      txt(g, `${c.present ? c.n : c.cap}/${c.cap}`, c.x, c.y + dy, "#fff", 16, "center", 700);
    }
    txt(g, `Cartons ${c.done}${c.goal ? "/" + c.goal : ""}`, c.x, c.y - 52, "#cfd6dc", 13);
    tag(g, addrs(c, ["evac", "pres"]), c.x, c.y + 54);
  }
};

T.pallet = {
  init: () => ({ cap: 2, done: 0, present: true, t: 0, prev: false }),
  io: () => [{ id: "evac", dir: "out", label: "Évacuer la palette", f: "h" }, { id: "pres", dir: "in", label: "Palette en place" }],
  init2(c) { c.sl = c.slots.map(x => ({ x, n: 0 })); },
  sense(c) { S(c, "pres", c.present); },
  drop(c, p, x) {
    p.state = "bin";
    if (!c.present) return fail("Pièce posée dans le vide : pas de palette en place.");
    const s = c.sl.find(s => Math.abs(s.x - x) < 10); if (!s) return fail("Pièce posée à côté des emplacements de la palette.");
    s.n++; W.delivered++; if (s.n > c.cap) return fail(`Pile trop haute : ${s.n} pièces au même endroit (maximum ${c.cap}).`);
  },
  act(c, dt) {
    const e = B(c, "evac");
    if (e && !c.prev && c.present) {
      if (c.sl.some(s => s.n !== c.cap)) return fail("Palette incomplète évacuée.");
      c.done++; c.present = false; c.t = 0; log(`Palette ${c.done} évacuée.`, "ok");
    }
    c.prev = e;
    if (!c.present) { c.t += dt; if (c.t > 2) { c.present = true; c.sl.forEach(s => s.n = 0); } }
  },
  draw(c, g) {
    const x1 = c.slots[0] - 34, x2 = c.slots[c.slots.length - 1] + 34;
    if (c.present) {
      rr(g, x1, c.y - 34, x2 - x1, 68, "#9c7a4a"); for (let x = x1 + 6; x < x2; x += 18) rr(g, x, c.y - 34, 8, 68, "#b8935e");
      c.sl.forEach(s => { for (let i = 0; i < s.n; i++) drawPart(g, { kind: "carton", x: s.x + i * 4, y: c.y - i * 4, q: {} }, 1); txt(g, `${s.n}/${c.cap}`, s.x, c.y + 46, "#cfd6dc", 12); });
    } else txt(g, "nouvelle palette…", (x1 + x2) / 2, c.y, "#9aa5ae", 13);
    txt(g, `Palettes ${c.done}${c.goal ? "/" + c.goal : ""}`, (x1 + x2) / 2, c.y - 50, "#cfd6dc", 13);
    tag(g, addrs(c, ["evac", "pres"]), (x1 + x2) / 2, c.y + 66);
  }
};

T.axis = {
  init: () => ({ x: null, ref: false, s: 0, gr: 0, hold: null, warned: false, mv: false, speed: 280 }),
  io: c => {
    const L = []; c.pos.forEach((p, i) => L.push({ id: "go" + (i + 1), dir: "out", label: `Axe : aller en P${i + 1} (${p.label})`, f: "m" }));
    L.push({ id: "home", dir: "out", label: "Axe : prise d'origine", f: "m" });
    c.pos.forEach((p, i) => L.push({ id: "en" + (i + 1), dir: "in", label: `Axe en P${i + 1} (${p.label})` }));
    L.push({ id: "ref", dir: "in", label: "Axe référencé" }, { id: "zd", dir: "out", label: "Vérin Z : descendre", f: "h" }, { id: "zh", dir: "in", label: "Vérin Z en haut" }, { id: "zb", dir: "in", label: "Vérin Z en bas" },
      { id: "pf", dir: "out", label: "Pince : fermer", f: "h" }, { id: "pc", dir: "in", label: "Pince fermée" });
    return L;
  },
  sense(c) {
    if (c.x === null) c.x = c.start;
    c.pos.forEach((p, i) => S(c, "en" + (i + 1), c.ref && !c.mv && Math.abs(c.x - p.x) < 0.5));
    S(c, "ref", c.ref); S(c, "zh", c.s <= 0.02); S(c, "zb", c.s >= 0.98); S(c, "pc", c.gr >= 0.98);
  },
  act(c, dt) {
    const gos = c.pos.map((p, i) => B(c, "go" + (i + 1))), n = gos.filter(Boolean).length;
    if (n > 1) return fail("Axe en défaut : deux consignes de position actives en même temps.");
    let tg = null;
    if (B(c, "home")) tg = c.origin;
    else if (n === 1) { if (!c.ref) { if (!c.warned) { log("Axe non référencé : il refuse de bouger. Il faut d'abord faire la prise d'origine.", "warn"); c.warned = true; } } else tg = c.pos[gos.indexOf(true)].x; }
    const x0 = c.x;
    if (tg !== null) { const d = tg - c.x, st = c.speed * dt; c.x = Math.abs(d) <= st ? tg : c.x + Math.sign(d) * st; if (B(c, "home") && c.x === c.origin && !c.ref) { c.ref = true; log("Axe référencé.", "ok"); } }
    c.mv = Math.abs(c.x - x0) > 1e-6;
    if (c.mv && c.s > 0.05) return fail("Collision : l'axe a bougé alors que le vérin Z n'était pas en haut.");
    c.s = clamp(c.s + (B(c, "zd") ? 1 : -1) * dt * 2.5, 0, 1);
    const g0 = c.gr; c.gr = clamp(c.gr + (B(c, "pf") ? 1 : -1) * dt * 5, 0, 1);
    const P = c.pos.find(p => Math.abs(c.x - p.x) < 0.5);
    if (c.gr >= 0.98 && g0 < 0.98 && !c.hold && c.s >= 0.98 && P && P.pick) { const p = under(W.byId[P.pick], c.x, 14); if (p && !p.moving) { p.state = "held"; c.hold = p; } }
    if (c.hold && c.gr < 0.5) {
      const p = c.hold; c.hold = null;
      if (c.s >= 0.5 && P && P.place) { const t = W.byId[P.place]; if (T[t.type].drop) T[t.type].drop(t, p, c.x); else T[t.type].put(t, p); }
      else { p.state = "fall"; p.ft = 0; p.x = c.x; p.y = c.y; return fail("La pince a lâché la pièce dans le vide !"); }
    }
    if (c.hold) { c.hold.x = c.x; c.hold.y = c.y; }
  },
  draw(c, g) {
    const y = c.y;
    rr(g, c.x1, y - 62, c.x2 - c.x1, 12, "#59636d"); rr(g, c.x1, y + 50, c.x2 - c.x1, 12, "#59636d");
    c.pos.forEach((p, i) => { rr(g, p.x - 1, y - 70, 2, 8, "#f2b705"); txt(g, `P${i + 1}`, p.x, y - 80, "#f2b705", 12, "center", 700); });
    rr(g, c.origin - 1, y - 70, 2, 8, "#9aa5ae"); txt(g, "origine", c.origin, y - 80, "#9aa5ae", 12);
    g.globalAlpha = 0.85; rr(g, c.x - 10, y - 62, 20, 124, "#f2b705"); g.globalAlpha = 1;
    const sz = 30 - c.s * 8; rr(g, c.x - sz / 2, y - sz / 2, sz, sz, c.s > 0.02 ? "#fbbf24" : "#d97706");
    const op = (1 - c.gr) * 8; rr(g, c.x - sz / 2 - 4 - op, y - 6, 4, 12, "#e9edf0"); rr(g, c.x + sz / 2 + op, y - 6, 4, 12, "#e9edf0");
    tag(g, "Axe " + addrs(c, c.pos.map((p, i) => "go" + (i + 1)).concat(["home"])), (c.x1 + c.x2) / 2, y - 98);
    tag(g, addrs(c, c.pos.map((p, i) => "en" + (i + 1)).concat(["ref"])), (c.x1 + c.x2) / 2, y + 76);
    tag(g, "Z " + addrs(c, ["zd", "zh", "zb"]) + " · pince " + addrs(c, ["pf", "pc"]), (c.x1 + c.x2) / 2, y + 96);
  }
};

T.robot = {
  init: () => ({ st: "idle", t: 0, prog: null, hold: null, goPrev: false, ex: 0, ey: 0, vio: 0 }),
  io: () => [{ id: "A", dir: "out", label: "Robot : programme A", f: "h" }, { id: "B", dir: "out", label: "Robot : programme B", f: "h" }, { id: "go", dir: "out", label: "Robot : départ cycle", f: "h" },
    { id: "pret", dir: "in", label: "Robot prêt" }, { id: "fin", dir: "in", label: "Robot : fin de cycle" }, { id: "hz", dir: "in", label: "Robot hors zone convoyeur" }],
  paused: () => !W.auOK || W.doorOpen || (W.ev && W.ev.D.robot && W.ev.t < W.ev.D.marche),
  hz: c => c.st === "idle" || c.st === "done" || c.st === "back" || c.st === "rel" || (c.st === "place" && c.t > 0.3),
  sense(c) { S(c, "pret", c.st === "idle" && !T.robot.paused()); S(c, "fin", c.st === "done"); S(c, "hz", T.robot.hz(c)); },
  pts(c) { const tg = W.byId[c[c.prog || "A"]]; return { H: { x: c.bx, y: c.by + 60 }, P: { x: c.pick.x, y: c.pcv.y }, D: { x: tg.x, y: tg.y } }; },
  act(c, dt) {
    const go = B(c, "go"), rise = go && !c.goPrev; c.goPrev = go;
    if (c.st === "idle" && rise && !T.robot.paused()) {
      const a = B(c, "A"), b = B(c, "B");
      if (a === b) return fail("Robot en défaut : au départ cycle il faut UN programme actif (A ou B), pas zéro ni deux.");
      c.prog = a ? "A" : "B"; c.st = "to"; c.t = 0; log(`Robot : départ programme ${c.prog}.`);
    }
    if (c.st === "done" && !go) c.st = "idle";
    if (!T.robot.paused()) {
      const D = { to: 0.7, grab: 0.25, place: 0.8, rel: 0.2, back: 0.7 };
      if (D[c.st]) {
        c.t += dt;
        if (c.t >= D[c.st]) {
          c.t = 0;
          if (c.st === "to") c.st = "grab";
          else if (c.st === "grab") { const p = under(c.pcv, c.pick.x, PS / 2); if (!p || p.moving) return fail("Le robot a pris à vide : pas de pièce immobile en position de prise."); p.state = "held"; c.hold = p; c.st = "place"; }
          else if (c.st === "place") c.st = "rel";
          else if (c.st === "rel") { const tg = W.byId[c[c.prog]], p = c.hold; c.hold = null; if (T[tg.type].drop) T[tg.type].drop(tg, p); else T[tg.type].put(tg, p); c.st = "back"; }
          else if (c.st === "back") c.st = "done";
        }
      }
    }
    const { H, P, D } = T.robot.pts(c), k = c.t;
    let e = H;
    if (c.st === "to") e = { x: lerp(H.x, P.x, k / 0.7), y: lerp(H.y, P.y, k / 0.7) }; else if (c.st === "grab") e = P;
    else if (c.st === "place") e = { x: lerp(P.x, D.x, k / 0.8), y: lerp(P.y, D.y, k / 0.8) }; else if (c.st === "rel") e = D;
    else if (c.st === "back") e = { x: lerp(D.x, H.x, k / 0.7), y: lerp(D.y, H.y, k / 0.7) };
    c.ex = e.x; c.ey = e.y; if (c.hold) { c.hold.x = e.x; c.hold.y = e.y; }
    if (!T.robot.hz(c) && c.pcv.on) { c.vio += dt; if (c.vio > 0.12) return fail("Danger : le convoyeur tournait alors que le robot était dans la zone de prise."); } else c.vio = 0;
  },
  draw(c, g) {
    circ(g, c.bx, c.by, 30, "#e67e22"); circ(g, c.bx, c.by, 18, "#2a3036");
    const mx = (c.bx + c.ex) / 2 + (c.ey - c.by) * 0.25, my = (c.by + c.ey) / 2 - (c.ex - c.bx) * 0.25;
    g.strokeStyle = "#f39c12"; g.lineWidth = 14; g.lineCap = "round"; g.beginPath(); g.moveTo(c.bx, c.by); g.lineTo(mx, my); g.lineTo(c.ex, c.ey); g.stroke(); g.lineCap = "butt";
    circ(g, mx, my, 9, "#d35400"); circ(g, c.ex, c.ey, 10, "#2a3036");
    txt(g, T.robot.paused() ? "ROBOT EN PAUSE" : "ROBOT", c.bx, c.by - 44, T.robot.paused() ? "#f2b705" : "#fff", 13, "center", 700);
    tag(g, addrs(c, ["A", "B", "go"]), c.bx, c.by + 44); tag(g, addrs(c, ["pret", "fin", "hz"]), c.bx, c.by + 64);
  }
};

T.cam = {
  init: () => ({ on: false, t: 0, res: false, done: false, flash: 0, needDrill: false }),
  io: () => [{ id: "trig", dir: "out", label: "Caméra : déclencher", f: "h" }, { id: "done", dir: "in", label: "Caméra : résultat disponible" }, { id: "ok", dir: "in", label: "Caméra : pièce conforme" }],
  sense(c) { S(c, "done", c.done); S(c, "ok", c.done && c.res); },
  act(c, dt) {
    if (c.flash > 0) c.flash -= dt;
    const v = B(c, "trig");
    if (v && !c.on) {
      c.on = true; c.t = 0; c.done = false; const p = under(c.cv, c.x, 14);
      c.res = !!p && !p.moving && !p.defect && (!c.needDrill || (p.q.drill || 0) >= 0.78); c.flash = 0.25;
      if (p && p.moving) log("Caméra : image floue, la pièce bougeait encore. Résultat : non conforme.", "warn");
    }
    if (c.on && !c.done) { c.t += dt; if (c.t >= 0.4) c.done = true; }
    if (!v) { c.on = false; c.done = false; }
  },
  draw(c, g) {
    const y = c.cv.y - CW / 2 - 46;
    if (c.flash > 0) { g.fillStyle = "#ffffff55"; g.beginPath(); g.moveTo(c.x - 8, y + 10); g.lineTo(c.x + 8, y + 10); g.lineTo(c.x + 24, c.cv.y + 18); g.lineTo(c.x - 24, c.cv.y + 18); g.fill(); }
    rr(g, c.x - 16, y - 10, 32, 20, "#334155"); circ(g, c.x, y, 7, "#0ea5e9");
    if (c.done) circ(g, c.x + 22, y, 5, c.res ? "#3ddc7a" : "#e8251a");
    tag(g, addrs(c, ["trig", "done", "ok"]), c.x, y - 22);
  }
};

T.label = {
  init: () => ({ on: false, t0: 0, tg: null }),
  io: () => [{ id: "q", dir: "out", label: "Étiqueteuse : poser l'étiquette", f: "h" }],
  act(c) {
    const v = B(c, "q");
    if (v && !c.on) { c.on = true; c.t0 = W.t; c.tg = under(c.cv, c.x, 12); if (!c.tg || c.tg.moving) return fail("Étiquette collée sur le tapis : pas de pièce immobile sous l'étiqueteuse."); }
    if (!v && c.on) {
      c.on = false; const d = W.t - c.t0;
      if (c.tg) { if (d < 0.15) c.tg.ko = c.tg.ko || "étiquette mal posée (impulsion trop courte)"; else if (d > 0.8) c.tg.ko = c.tg.ko || "étiquette froissée (impulsion trop longue)"; else c.tg.q.label = true; }
    }
  },
  draw(c, g) {
    const y = c.cv.y + CW / 2 + 30; rr(g, c.x - 22, y - 16, 44, 32, "#475569"); circ(g, c.x, y, 11, "#f8fafc"); circ(g, c.x, y, 4, "#475569");
    if (B(c, "q")) rr(g, c.x - 8, c.cv.y - 4, 16, 8, "#f8fafc");
    tag(g, c.a.q, c.x, y + 28);
  }
};

T.door = {
  init: () => ({ open: false }),
  io: c => [{ id: "i", dir: "in", label: c.label || "Porte de sécurité fermée" }],
  sense(c) { S(c, "i", !c.open); },
  draw(c, g) {
    const [x, y, w, h] = c.rect;
    g.strokeStyle = "#f2b705"; g.lineWidth = 3; g.setLineDash([10, 6]); g.strokeRect(x, y, w, h); g.setLineDash([]);
    const dx = x + w - 90, dy = y + h;
    rr(g, dx, dy - 4, 60, 8, "#1c2125");
    g.strokeStyle = c.open ? "#e8251a" : "#3ddc7a"; g.lineWidth = 5; g.beginPath(); g.moveTo(dx, dy);
    if (c.open) g.lineTo(dx + 30, dy + 40); else g.lineTo(dx + 60, dy); g.stroke();
    tag(g, `${c.a.i} ${c.open ? "OUVERTE" : "fermée"}`, dx + 30, dy + 18 > WH - 12 ? dy - 18 : dy + 18);
  }
};

T.bim = {
  init: () => ({ L: false, R: false, tL: 0, tR: 0, pi: 0, ph: null, t: 0, vio: 0, wait: 0, wasDown: false }),
  io: () => [{ id: "g", dir: "in", label: "Bimanuelle : bouton gauche" }, { id: "d", dir: "in", label: "Bimanuelle : bouton droit" }],
  sense(c) { S(c, "g", c.L); S(c, "d", c.R); },
  act(c, dt) {
    const tool = W.byId[c.tool];
    const sync = c.L && c.R && Math.abs(c.tL - c.tR) <= 0.5;
    if (B(tool, "d") && !sync) { c.vio += dt; if (c.vio > 0.08) return fail("Commande bimanuelle non respectée : la presse est descendue sans les deux mains appuyées ensemble (moins de 0,5 s d'écart). L'opérateur aurait pu y laisser une main."); } else c.vio = 0;
    const set = (k, v) => { if (c[k] !== v) { c[k] = v; if (v) c["t" + k] = W.t; } };
    if (!c.ph) {
      const p = under(tool.cv, tool.x, 6);
      if (p && !p.moving && tool.s <= 0.02 && (p.q.press || 0) < 1 && W.started && W.auOK && !W.ev) { c.wait += dt; if (c.wait > 0.6) { c.ph = c.patterns[c.pi++] || "ok"; c.t = 0; c.wait = 0; c.p = p; c.wasDown = false; if (c.ph === "async") log("L'opérateur a coincé le bouton gauche avec du scotch…", "warn"); if (c.ph === "release") log("L'opérateur lâche une main pendant la descente…", "warn"); } }
      else c.wait = 0;
      return;
    }
    c.t += dt; const t = c.t;
    if (tool.s >= 0.98) c.wasDown = true;
    if (c.ph === "ok") { set("L", true); if (t >= 0.15) set("R", true); if (t > 0.3 && ((c.p.q.press || 0) >= 1.25 || (tool.s <= 0.02 && c.wasDown) || t > 5)) { set("L", false); set("R", false); c.ph = null; } }
    else if (c.ph === "async") { set("L", true); if (t >= 1.5) set("R", true); if (t >= 3.2) { set("L", false); set("R", false); c.ph = null; } }
    else if (c.ph === "release") { set("L", true); if (t >= 0.1) set("R", true); if (t >= 0.5) set("R", false); if (t >= 0.9) { set("L", false); c.ph = null; } }
  },
  draw(c, g) {
    const tool = W.byId[c.tool], y = tool.cv.y + CW / 2 + 64;
    for (const [k, dx] of [["L", -30], ["R", 30]]) { circ(g, tool.x + dx, y, 14, "#111"); circ(g, tool.x + dx, y, 10, c[k] ? "#3ddc7a" : "#1f6f3d"); }
    tag(g, addrs(c, ["g", "d"]), tool.x, y + 24);
  }
};

T.lamp = {
  init: () => ({}),
  io: c => [{ id: "q", dir: "out", label: c.label, f: "l" }],
  draw() {}
};

/* ---------- pièces ---------- */
function drawPart(g, p, sc = 1) {
  const s = PS * sc, x = p.x, y = p.y;
  if (p.kind === "carton") { rr(g, x - s / 2, y - s / 2, s, s, "#c48a50"); rr(g, x - s / 10, y - s / 2, s / 5, s, "#e8c995"); }
  else if (p.kind === "bottle") {
    circ(g, x, y, s / 2, "#d7e3ea"); circ(g, x, y, s / 2 - 3, "#10181d");
    if (p.fill > 0) circ(g, x, y, Math.max(2, (s / 2 - 4) * Math.min(1.1, p.fill)), p.fill > 1.08 ? "#f97316" : "#3b82f6");
    if (p.q && p.q.label) rr(g, x - s / 2, y - 4, s, 8, "#f8fafc");
  } else {
    const col = p.metal ? "#aeb8c2" : p.color === "red" ? "#e5484d" : p.color === "orange" ? "#f59e0b" : "#3b82f6";
    circ(g, x, y, s / 2, col); circ(g, x - s / 7, y - s / 7, s / 7, "#ffffff55");
    if (p.q && p.q.cuit) { g.strokeStyle = "#fbbf24"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, s / 2 - 2, 0, 7); g.stroke(); }
    if (p.q && (p.q.drill || 0) >= 0.8) circ(g, x, y, s / 7, "#0d1013");
    if (p.q && (p.q.press || 0) >= 1) { g.strokeStyle = "#0d1013"; g.lineWidth = 2; g.strokeRect(x - s / 4, y - s / 4, s / 2, s / 2); }
  }
  if (p.defect) { g.strokeStyle = "#111"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - s / 3, y - s / 5); g.lineTo(x - s / 10, y + s / 8); g.lineTo(x + s / 4, y - s / 10); g.stroke(); }
}

/* ---------- automate ---------- */
const MEM = []; for (let b = 0; b < 3; b++) for (let i = 0; i < 8; i++) MEM.push(`M${b}.${i}`);
const TIM = [0, 1, 2, 3, 4, 5, 6, 7].map(i => "T" + i), CNT = ["C0", "C1", "C2", "C3"];
function val(c) { const b = W.bits; return c.t === "nc" ? !b[c.a] : c.t === "p" ? (!!b[c.a] && !W.prev[c.a]) : !!b[c.a]; }
function scan(prog, dt) {
  const b = W.bits;
  for (const r of prog) {
    let ok = true; for (const bl of r.blocks) if (!bl.some(val)) ok = false;
    r._ok = ok; const k = r.coil; if (!k || !k.a) continue;
    if (k.t === "out") b[k.a] = ok;
    else if (k.t === "set") { if (ok) b[k.a] = true; }
    else if (k.t === "res") { if (ok) { b[k.a] = false; if (W.tim[k.a]) W.tim[k.a].acc = 0; if (W.cnt[k.a]) W.cnt[k.a].v = 0; } }
    else if (k.t === "ton" && W.tim[k.a]) { const t = W.tim[k.a]; t.pre = +k.p || 1; t.acc = ok ? Math.min(t.pre, t.acc + dt) : 0; b[k.a] = ok && t.acc >= t.pre - 1e-9; }
    else if (k.t === "ctu" && W.cnt[k.a]) { const t = W.cnt[k.a]; t.pre = Math.max(1, Math.round(+k.p || 1)); if (ok && !t.pin) t.v++; t.pin = ok; b[k.a] = t.v >= t.pre; }
  }
  W.prev = Object.assign({}, b);
}

/* ---------- événements ---------- */
const EVD = {
  stop: { rest: null, rearm: null, marche: 2.5, end: 2.8, red: false, robot: false },
  au: { rest: 2.5, rearm: 3.5, marche: 4.5, end: 4.8, red: true, robot: true },
  door: { rest: 2.5, rearm: 3.5, marche: 4.5, end: 4.8, red: true, robot: true },
  thermal: { rest: 3, rearm: 4, marche: 5, end: 5.3, red: true, robot: true },
  sensor: { rest: 2, rearm: 3, marche: 4, end: 4.3, red: true, robot: false }
};
const motionOn = () => W.outs.filter(o => o.f === "m" && W.bits[o.a]);
function evStart(E) {
  const k = E.kind;
  if (k === "stop") { W.op.arret = 0.3; log("Le chef d'équipe appuie sur Arrêt.", "warn"); }
  if (k === "au") { W.auEv = true; log("ARRÊT D'URGENCE ! Un opérateur a tapé sur le coup de poing.", "bad"); }
  if (k === "door") { const d = W.byId[E.target] || W.comps.find(c => c.type === "door"); d.open = true; E.d = d; log("Un opérateur ouvre la porte de sécurité.", "bad"); }
  if (k === "thermal") { const m = W.byId[E.target]; m.thOK = false; E.m = m; log(`Le disjoncteur moteur a déclenché (${m.a.th}) : surcharge !`, "bad"); }
  if (k === "sensor") { const p = W.byId[E.target]; p.deadOut = true; E.p = p; E.pre = true; E.ta = null; }
}
function evStep(dt) {
  const L = W.level.events || [];
  if (!W.ev) {
    const e = L[W.evi]; if (!e) return;
    if (W.delivered >= e.after && W.started && W.run && (e.kind === "sensor" || motionOn().length)) { W.ev = Object.assign({ t: 0, D: EVD[e.kind] }, e); evStart(W.ev); }
    return;
  }
  const E = W.ev, D = E.D;
  if (E.pre) {
    if (B(E.p, "q")) { if (E.ta === null) E.ta = W.t; }
    const red = W.sym.rouge ? W.bits[W.sym.rouge] : true;
    if (E.ta !== null && red && !motionOn().length) { E.pre = false; E.t = 0; log("Défaut détecté. Le technicien remplace le capteur « éjecteur sorti ».", "warn"); return; }
    if (E.ta !== null && W.t - E.ta > 3.5) fail("Défaut capteur non détecté : le vérin était commandé, son capteur « sorti » n'est jamais arrivé et la machine n'a pas réagi. Il faut une surveillance par tempo qui met la machine en défaut.");
    return;
  }
  const t0 = E.t; E.t += dt; const t = E.t, cross = v => v !== null && t0 < v && t >= v;
  if (cross(D.rest)) {
    if (E.kind === "au") { W.auEv = false; log("Le coup de poing est déverrouillé.", ""); }
    if (E.kind === "door") { E.d.open = false; log("La porte est refermée.", ""); }
    if (E.kind === "thermal") { E.m.thOK = true; log("Le disjoncteur est réenclenché.", ""); }
    if (E.kind === "sensor") { E.p.deadOut = false; log("Capteur remplacé.", ""); }
  }
  if (cross(D.rearm)) { W.op.rearm = 0.3; log("Le chef appuie sur Réarmement.", ""); }
  if (cross(D.marche)) { W.op.marche = 0.3; log("Il relance avec Marche.", ""); }
  if (t >= 0.15 && t < D.marche) {
    const bad = W.outs.find(o => W.bits[o.a] && (o.f === "m" || (o.f === "e" && E.kind === "au" && t < D.rest)));
    if (bad) {
      const why = { stop: "l'Arrêt", au: "l'arrêt d'urgence", door: "l'ouverture de porte", thermal: "le défaut disjoncteur", sensor: "le défaut capteur" }[E.kind];
      const late = D.rest !== null && t >= D.rest ? " La machine est repartie toute seule avant le réarmement et le Marche !" : "";
      return fail(`Pendant ${why}, la sortie ${bad.a} (${bad.label}) était active.${late}`);
    }
  }
  if (D.red && W.sym.rouge) {
    const red = W.bits[W.sym.rouge];
    if (t >= 0.6 && t < D.rearm && !red) return fail("Le voyant rouge « défaut » doit s'allumer et rester allumé jusqu'au réarmement.");
    if (t >= D.rearm + 0.8 && t < D.marche && red) return fail("Le réarmement doit acquitter le défaut : le voyant rouge est resté allumé.");
  }
  if (t >= D.end) { W.ev = null; W.evi++; }
}

/* ---------- monde ---------- */
function build(level) {
  PID = 0;
  W = { t: 0, level, parts: [], comps: [], byId: {}, bits: {}, prev: {}, sym: {}, ins: [], outs: [], logs: [], logV: 0, end: null, started: false, delivered: 0, blockers: [],
    btn: { marche: false, arret: false, rearm: false }, op: { marche: 0, arret: 0, rearm: 0 }, auPlayer: false, auEv: false, auOK: true, doorOpen: false,
    marcheCount: 0, t0: 0, evi: 0, ev: null, tim: {}, cnt: {}, run: false, unsafeT: 0, greenT: 0, held: false, stopT: 0, sPrev: false };
  [["marche", "BP Marche"], ["arret", "BP Arrêt"], ["rearm", "BP Réarmement"], ["au", "Arrêt d'urgence OK (contact NF)"]].forEach(([id, l], i) => {
    if (id === "rearm" && !level.rearm) return; if (id === "au" && !level.au) return;
    const a = `I0.${i}`; W.sym[id] = a; W.ins.push({ a, label: l, sym: id });
  });
  let ni = 4, no = 0;
  for (const [type, o] of level.build()) {
    const c = Object.assign({ type, a: {} }, T[type].init ? T[type].init(o) : {}, o);
    W.comps.push(c); if (c.id) W.byId[c.id] = c;
  }
  for (const c of W.comps) {
    c.io = T[c.type].io(c);
    for (const io of c.io) {
      let a; if (io.dir === "in") { a = `I${ni >> 3}.${ni & 7}`; ni++; } else { a = `Q${no >> 3}.${no & 7}`; no++; }
      c.a[io.id] = a; const sym = c.type === "lamp" ? c.id : `${c.id}.${io.id}`; W.sym[sym] = a;
      (io.dir === "in" ? W.ins : W.outs).push({ a, label: io.label, sym, f: io.f, c });
    }
  }
  for (const c of W.comps) {
    if (c.conv) c.cv = W.byId[c.conv];
    if (c.pick && c.pick.conv) c.pcv = W.byId[c.pick.conv];
    if (T[c.type].blocker) { const b = T[c.type].blocker(c); W.blockers.push(b); }
    if (T[c.type].init2) T[c.type].init2(c);
    if (c.type === "bin" || c.type === "boxer" || c.type === "pallet") { const G = level.goal; const k = c.type === "bin" ? "bins" : c.type === "boxer" ? "boxer" : "pallet"; if (G[k] && G[k][c.id]) c.goal = G[k][c.id]; }
  }
  TIM.forEach(k => W.tim[k] = { acc: 0, pre: 1 }); CNT.forEach(k => W.cnt[k] = { v: 0, pre: 1, pin: false });
  [...W.ins.map(i => i.a), ...W.outs.map(o => o.a), ...MEM, ...TIM, ...CNT].forEach(a => W.bits[a] = false);
  if (W.sym.au) W.bits[W.sym.au] = true;
  for (const c of W.comps) if (c.type === "feed") T.feed.spawn(c);
  W.prev = Object.assign({}, W.bits);
  return W;
}
function setRun(on) {
  W.run = on;
  if (on) { MEM.concat(TIM, CNT).forEach(a => W.bits[a] = false); TIM.forEach(k => W.tim[k].acc = 0); CNT.forEach(k => { W.cnt[k].v = 0; W.cnt[k].pin = false; }); }
  log(on ? "Automate en RUN." : "Automate en STOP : sorties à 0.", on ? "ok" : "");
}
function remaining() {
  let n = 0;
  for (const c of W.comps) { if (c.type === "feed") n += T.feed.left(c); if (c.type === "bowl") n += T.bowl.left(c); }
  n += W.parts.filter(p => ["belt", "held", "pushed"].includes(p.state)).length;
  return n;
}
function goals(dt) {
  const G = W.level.goal; let ok = true, possible = true; const left = remaining();
  if (G.bins) for (const k in G.bins) { const b = W.byId[k]; if (b.n < G.bins[k]) { ok = false; if (left === 0) possible = false; } }
  if (G.boxer) for (const k in G.boxer) { const b = W.byId[k]; if (b.done < G.boxer[k]) { ok = false; if (left === 0 && b.done + (b.present && b.n === b.cap ? 1 : 0) < G.boxer[k]) possible = false; } }
  if (G.pallet) for (const k in G.pallet) { const b = W.byId[k]; if (b.done < G.pallet[k]) { ok = false; if (left === 0 && b.done + (b.present && b.sl.every(s => s.n === b.cap) ? 1 : 0) < G.pallet[k]) possible = false; } }
  if (G.stopAt) {
    const s = W.byId[G.stopAt.sensor], cv = W.byId[G.stopAt.conv], on = W.bits[s.a.i];
    if (on && !W.sPrev && W.btn.marche) W.held = true; W.sPrev = on;
    W.stopT = on && !cv.on && W.run ? W.stopT + dt : 0;
    ok = W.stopT > G.stopAt.t;
  }
  if (ok && !W.ev && W.evi >= (W.level.events || []).length) { W.end = W.held ? { kind: "warn", msg: "La pièce est arrêtée… mais tu tenais Marche appuyé quand elle est arrivée au capteur. Sur une vraie machine, l'opérateur appuie une fois et s'en va : il te faut un auto-maintien." } : { kind: "win" }; log(W.held ? "Presque…" : "Objectif atteint !", W.held ? "warn" : "ok"); return; }
  if (!possible) return fail("Il n'y a plus de pièces et l'objectif n'est pas atteint.");
  if (W.started && W.t - W.t0 > W.level.tmax) return fail(`Trop lent : au bout de ${W.level.tmax} s le client attend toujours.`);
}
function step(dt, prog) {
  if (W.end) { for (const p of W.parts) if (p.state === "fall") p.ft += dt; return; }
  W.t += dt;
  for (const k of ["marche", "arret", "rearm"]) if (W.op[k] > 0) W.op[k] -= dt;
  W.doorOpen = W.comps.some(c => c.type === "door" && c.open); W.auOK = !(W.auPlayer || W.auEv);
  W.bits[W.sym.marche] = W.btn.marche || W.op.marche > 0;
  if (W.sym.arret) W.bits[W.sym.arret] = W.btn.arret || W.op.arret > 0;
  if (W.sym.rearm) W.bits[W.sym.rearm] = W.btn.rearm || W.op.rearm > 0;
  if (W.sym.au) W.bits[W.sym.au] = W.auOK;
  for (const c of W.comps) if (T[c.type].sense) T[c.type].sense(c);
  if (W.run) { if (W.bits[W.sym.marche] && !W.started) { W.started = true; W.t0 = W.t; } scan(prog, dt); }
  else { for (const o of W.outs) W.bits[o.a] = false; W.prev = Object.assign({}, W.bits); }
  for (const c of W.comps) { if (W.end) break; if (T[c.type].act) T[c.type].act(c, dt); }
  for (const p of W.parts) if (p.state !== "belt") p.moving = false;
  if (!W.end) {
    const unsafe = !W.auOK || W.doorOpen;
    const bad = unsafe && W.outs.find(o => W.bits[o.a] && (o.f === "m" || (o.f === "e" && !W.auOK)));
    if (bad && !W.ev) { W.unsafeT += dt; if (W.unsafeT > 0.15) fail(`${!W.auOK ? "Arrêt d'urgence" : "Porte ouverte"} : la sortie ${bad.a} (${bad.label}) est restée active. Sur une vraie machine, c'est l'accident.`); } else W.unsafeT = 0;
    if (W.level.greenRule && W.sym.vert) {
      const moving = W.comps.some(c => c.type === "conv" && c.on);
      if (moving && !W.bits[W.sym.vert]) { W.greenT += dt; if (W.greenT > 0.3) fail("Le voyant vert « en cycle » doit être allumé quand la ligne tourne."); } else W.greenT = 0;
    }
  }
  if (!W.end) evStep(dt);
  if (!W.end) goals(dt);
  for (const p of W.parts) if (p.state === "fall") p.ft = (p.ft || 0) + dt;
  W.parts = W.parts.filter(p => p.state !== "bin" && !(p.state === "fall" && p.ft > 1.4));
}

/* ---------- rendu ---------- */
function draw(g) {
  rr(g, 0, 0, WW, WH, "#1b2024");
  g.strokeStyle = "#222a30"; g.lineWidth = 1; g.beginPath();
  for (let x = 0; x <= WW; x += 40) { g.moveTo(x, 0); g.lineTo(x, WH); } for (let y = 0; y <= WH; y += 40) { g.moveTo(0, y); g.lineTo(WW, y); } g.stroke();
  const order = ["door", "tank", "bin", "boxer", "pallet", "conv", "oven", "sens", "stop", "fill", "label", "pick", "bowl", "push", "tool", "bim", "axis", "cam", "robot", "feed"];
  for (const ty of order) for (const c of W.comps) if (c.type === ty && T[ty].draw && ty !== "axis" && ty !== "robot") T[ty].draw(c, g);
  for (const p of W.parts) {
    if (p.state === "belt" || p.state === "pushed") drawPart(g, p);
    if (p.state === "fall") { g.globalAlpha = Math.max(0, 1 - p.ft / 1.4); drawPart(g, p, Math.max(0.2, 1 - p.ft * 0.5)); g.globalAlpha = 1; }
  }
  for (const c of W.comps) if (c.type === "axis" || c.type === "robot") T[c.type].draw(c, g);
  for (const p of W.parts) if (p.state === "held") drawPart(g, p, 1.05);
  overlay(g);
}
function overlay(g) {
  const lamps = W.comps.filter(c => c.type === "lamp");
  if (lamps.length) {
    const x = WW - 34; rr(g, x - 16, 14, 32, 18 + lamps.length * 30, "#0d1013");
    lamps.forEach((l, i) => { const on = W.bits[l.a.q], col = l.color === "red" ? (on ? "#ff3b30" : "#4a1714") : l.color === "green" ? (on ? "#3ddc7a" : "#173b24") : (on ? "#f2b705" : "#4a3b10"); circ(g, x, 36 + i * 30, 11, col); tag(g, l.a.q, x - 22, 36 + i * 30, "right"); });
  }
  tag(g, W.run ? "● AUTOMATE EN RUN" : "■ AUTOMATE EN STOP", 14, 22, "left");
  if (!W.auOK) { rr(g, 0, WH - 40, WW, 40, "#e8251acc"); txt(g, "ARRÊT D'URGENCE ENFONCÉ", WW / 2, WH - 20, "#fff", 18, "center", 800); }
  else if (W.doorOpen) { rr(g, 0, WH - 40, WW, 40, "#f2b705cc"); txt(g, "PORTE DE SÉCURITÉ OUVERTE", WW / 2, WH - 20, "#111", 18, "center", 800); }
  if (W.end) {
    const k = W.end.kind; rr(g, WW / 2 - 220, WH / 2 - 40, 440, 80, "#0d1013e6");
    txt(g, { win: "RÉUSSI", fail: "RATÉ", warn: "PRESQUE" }[k], WW / 2, WH / 2, { win: "#3ddc7a", fail: "#ff5a4f", warn: "#f2b705" }[k], 40, "center", 800);
  }
}


/* ---------- vue 3D (projection axonométrique) ---------- */
const isoOK = () => true;
const IS = { k: 1, ox: 0, oy: 0 };
const P = (x, y, z) => [(x * 0.94 - y * 0.42) * IS.k + IS.ox, (x * 0.24 + y * 0.52 - z * 0.95) * IS.k + IS.oy];
const DEP = (x, y) => x * 0.24 + y * 0.52;
const BZ = 44;
function shade(col, f) {
  let r, gg, b;
  if (col[0] === "#") { const n = parseInt(col.slice(1, 7), 16); r = n >> 16; gg = (n >> 8) & 255; b = n & 255; } else { [r, gg, b] = col.match(/\d+/g).map(Number); }
  return `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(gg * f))},${Math.min(255, Math.round(b * f))})`;
}
function poly(g, pts, fill, stroke, lw = 1) { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
function box(g, x, y, z, w, d, h, col, top) {
  poly(g, [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], shade(col, 0.8));
  poly(g, [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], shade(col, 0.62));
  poly(g, [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], top || shade(col, 1.12));
}
const cbox = (g, x, y, z, w, d, h, col, top) => box(g, x - w / 2, y - d / 2, z, w, d, h, col, top);
function cyl(g, x, y, z, r, h, col, n = 22) {
  const pt = (a, zz) => P(x + r * Math.cos(a), y + r * Math.sin(a), zz), sides = [];
  for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, am = (a0 + a1) / 2, f = Math.cos(am) * 0.24 + Math.sin(am) * 0.52; if (f > -0.05) sides.push([f, a0, a1]); }
  sides.sort((u, v) => u[0] - v[0]);
  for (const [f, a0, a1] of sides) poly(g, [pt(a0, z), pt(a1, z), pt(a1, z + h), pt(a0, z + h)], shade(col, 0.6 + f * 0.5));
  const top = []; for (let i = 0; i < n; i++) top.push(pt(i / n * 6.2832, z + h)); poly(g, top, shade(col, 1.15));
}
function ellipse(g, x, y, z, r, fill, stroke, lw) { const pts = []; for (let i = 0; i < 20; i++) { const a = i / 20 * 6.2832; pts.push(P(x + r * Math.cos(a), y + r * Math.sin(a), z)); } poly(g, pts, fill, stroke, lw); }
function seg3(g, a, b, col, w) { const p = P(...a), q = P(...b); g.strokeStyle = col; g.lineWidth = w * IS.k; g.lineCap = "round"; g.beginPath(); g.moveTo(...p); g.lineTo(...q); g.stroke(); g.lineCap = "butt"; }
const PH = p => p.kind === "carton" ? 30 : p.kind === "bottle" ? 40 : 16;
function isoPart(g, p, x, y, z, sc = 1) {
  if (p.kind === "carton") { const s = PS * sc; box(g, x - s / 2, y - s / 2, z, s, s, 30 * sc, "#c48a50"); poly(g, [P(x - s / 2, y - 4 * sc, z + 30 * sc), P(x + s / 2, y - 4 * sc, z + 30 * sc), P(x + s / 2, y + 4 * sc, z + 30 * sc), P(x - s / 2, y + 4 * sc, z + 30 * sc)], "#e8c995"); return; }
  if (p.kind === "bottle") {
    const r = 12 * sc, h = 40 * sc; cyl(g, x, y, z, r, h, "#9fb4c2");
    if (p.fill > 0) { const fh = Math.min(1.12, p.fill) * (h - 6 * sc); cyl(g, x, y, z + 2 * sc, r - 3 * sc, fh, p.fill > 1.08 ? "#f97316" : "#3b82f6"); }
    if (p.q && p.q.label) cyl(g, x, y, z + h * 0.35, r + 0.5, h * 0.3, "#f1f5f9");
    cyl(g, x, y, z + h, r * 0.45, 8 * sc, "#cbd5e1"); return;
  }
  const col = p.metal ? "#aeb8c2" : p.color === "red" ? "#e5484d" : p.color === "orange" ? "#f59e0b" : "#3b82f6";
  const r = 15 * sc, h = 16 * sc; cyl(g, x, y, z, r, h, col);
  if (p.q && p.q.cuit) ellipse(g, x, y, z + h, r - 2, null, "#fbbf24", 2.5 * IS.k);
  if (p.q && (p.q.drill || 0) >= 0.78) ellipse(g, x, y, z + h, 4.5 * sc, "#0d1013");
  if (p.q && (p.q.press || 0) >= 0.98) poly(g, [P(x - 7, y - 7, z + h), P(x + 7, y - 7, z + h), P(x + 7, y + 7, z + h), P(x - 7, y + 7, z + h)], null, "#0d1013", 2);
  if (p.defect) { const a = P(x - 9, y - 4, z + h), b = P(x - 2, y + 5, z + h), c = P(x + 8, y - 2, z + h); g.strokeStyle = "#111"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.stroke(); }
}
function footprint(c) {
  switch (c.type) {
    case "conv": return [c.x1 - 30, c.y - 70, c.x2 + 50, c.y + 90];
    case "bin": return [c.x - c.w / 2, c.y - c.h / 2, c.x + c.w / 2, c.y + c.h / 2 + 20];
    case "tank": return [c.x - 70, c.y - 70, c.x + 70, c.y + 90];
    case "bowl": return [c.x - 80, c.y - 80, c.x + 80, c.y + 90];
    case "robot": return [c.bx - 60, c.by - 60, c.bx + 60, c.by + 90];
    case "boxer": return [c.x - 45, c.y - 45, c.x + 45, c.y + 60];
    case "door": return [c.rect[0], c.rect[1], c.rect[0] + c.rect[2], c.rect[1] + c.rect[3]];
    default: return null;
  }
}
function isoFit() {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const c of W.comps) { const f = footprint(c); if (!f) continue; x0 = Math.min(x0, f[0]); y0 = Math.min(y0, f[1]); x1 = Math.max(x1, f[2]); y1 = Math.max(y1, f[3]); }
  IS.k = 1; IS.ox = 0; IS.oy = 0;
  const pts = [[x0, y0, 0], [x1, y0, 0], [x0, y1, 0], [x1, y1, 0], [x0, y0, 190], [x1, y0, 190]];
  const sx = pts.map(p => P(...p)[0]), sy = pts.map(p => P(...p)[1]);
  const bw = Math.max(...sx) - Math.min(...sx), bh = Math.max(...sy) - Math.min(...sy);
  IS.k = Math.min((WW - 30) / bw, (WH - 60) / bh, 1.8);
  IS.ox = WW / 2 - (Math.max(...sx) + Math.min(...sx)) / 2 * IS.k; IS.oy = WH / 2 - (Math.max(...sy) + Math.min(...sy)) / 2 * IS.k + 12;
}
function robotPose(c) {
  const D = { to: 0.7, grab: 0.25, place: 0.8, rel: 0.2, back: 0.7 }, k = D[c.st] ? clamp(c.t / D[c.st], 0, 1) : 0;
  let z = 125; if (c.st === "grab" || c.st === "rel") z = 66; else if (c.st === "to") z = lerp(125, 66, k); else if (c.st === "place") z = 66 + Math.sin(k * Math.PI) * 70 + (k > 0.5 ? 0 : 0); else if (c.st === "back") z = lerp(66, 125, k);
  return z;
}
function drawIso(g) {
  isoFit();
  rr(g, 0, 0, WW, WH, "#1b2024");
  g.strokeStyle = "#232b31"; g.lineWidth = 1; g.beginPath();
  for (let x = -400; x <= 1500; x += 40) { g.moveTo(...P(x, -300, 0)); g.lineTo(...P(x, 900, 0)); }
  for (let y = -300; y <= 900; y += 40) { g.moveTo(...P(-400, y, 0)); g.lineTo(...P(1500, y, 0)); }
  g.stroke();
  const hw = CW / 2, items = [], late = [], tags = [];
  const add = (x, y, f, dz = 0) => items.push({ d: DEP(x, y) + dz, f });
  const T3 = (s, x, y, z, dy = 0) => tags.push([s, x, y, z, dy]);
  // sol : zones et clôtures
  for (const c of W.comps) if (c.type === "door") {
    const [x, y, w, h] = c.rect;
    g.setLineDash([10, 7]); poly(g, [P(x, y, 0), P(x + w, y, 0), P(x + w, y + h, 0), P(x, y + h, 0)], "#f2b7050d", "#f2b705aa", 2.5); g.setLineDash([]);
    for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) add(px, py, () => cbox(g, px, py, 0, 6, 6, 110, "#d4a106"));
    const dx = x + w - 90, dy = y + h;
    add(dx + 30, dy, () => { if (c.open) poly(g, [P(dx, dy, 2), P(dx + 22, dy + 52, 2), P(dx + 22, dy + 52, 100), P(dx, dy, 100)], "#e8251a55", "#e8251a", 2.5); else poly(g, [P(dx, dy, 2), P(dx + 60, dy, 2), P(dx + 60, dy, 100), P(dx, dy, 100)], "#3ddc7a33", "#3ddc7a", 2.5); });
    T3(`${c.a.i} ${c.open ? "OUVERTE" : "fermée"}`, dx + 30, dy, 112);
  }
  // convoyeurs : ombre, pieds, bande
  for (const c of W.comps) if (c.type === "conv") {
    poly(g, [P(c.x1 - 6, c.y - hw - 10, 0), P(c.x2 + 6, c.y - hw - 10, 0), P(c.x2 + 6, c.y + hw + 40, 0), P(c.x1 - 6, c.y + hw + 40, 0)], "#14181b");
    if (c.end === "fall") for (let k = 0; k < 5; k++) poly(g, [P(c.x2 + 14 + k * 14, c.y - hw - 10, 0), P(c.x2 + 21 + k * 14, c.y - hw - 10, 0), P(c.x2 + 21 + k * 14, c.y + hw + 30, 0), P(c.x2 + 14 + k * 14, c.y + hw + 30, 0)], "#f2b70555");
    for (let x = c.x1 + 20; x < c.x2 - 10; x += 150) box(g, x, c.y - hw - 6, 0, 8, 6, BZ - 4, "#48525b");
    poly(g, [P(c.x1, c.y - hw, BZ), P(c.x2, c.y - hw, BZ), P(c.x2, c.y + hw, BZ), P(c.x1, c.y + hw, BZ)], "#262c31");
    for (let x = c.x1 + (c.off % 28); x < c.x2 - 11; x += 28) poly(g, [P(x, c.y - hw, BZ), P(x + 11, c.y - hw, BZ), P(x + 11, c.y + hw, BZ), P(x, c.y + hw, BZ)], "#323a41");
    for (let x = c.x1; x < c.x2; x += 40) { const w = Math.min(40, c.x2 - x); add(x + w / 2, c.y - hw - 3, () => box(g, x, c.y - hw - 6, BZ - 6, w, 6, 10, "#5b6670")); add(x + w / 2, c.y + hw + 3, () => { box(g, x, c.y + hw, BZ - 6, w, 6, 10, "#5b6670"); if ((x - c.x1) % 160 === 0 && x + 20 < c.x2) box(g, x + 20, c.y + hw, 0, 8, 6, BZ - 6, "#48525b"); }); }
    if (c.end !== "fall" && !(c.end && c.end.to)) add(c.x2 + 4, c.y, () => box(g, c.x2, c.y - hw - 6, BZ - 8, 8, CW + 12, 18, "#5b6670"));
    add(c.x1 + 23, c.y + hw + 22, () => { box(g, c.x1 + 6, c.y + hw + 10, 10, 34, 24, 26, c.thOK ? "#2c6fb0" : "#8a2a24"); const led = P(c.x1 + 23, c.y + hw + 22, 37); circ(g, led[0], led[1], 4 * IS.k, c.on ? "#3ddc7a" : "#1f3a2a"); });
    T3(addrs(c, ["m", "th"]), c.x1 + 23, c.y + hw + 30, 0, 16);
  }
  // matériel
  for (const c of W.comps) {
    const y = c.cv ? c.cv.y : 0;
    switch (c.type) {
      case "sens": {
        if (c.kind === "metal") { const sy = y + (c.side || -1) * (hw + 10); add(c.x, sy, () => { cbox(g, c.x, sy, 0, 8, 8, BZ - 6, "#59636d"); cyl(g, c.x, sy, BZ - 6, 8, 10, c.on ? "#3ddc7a" : "#7b8691"); }); T3(c.a.i, c.x + (c.tdx || 0), sy, 60); break; }
        const col = c.kind === "red" ? "#d33" : "#f2b705";
        add(c.x, y - hw - 15, () => { cbox(g, c.x, y - hw - 15, 0, 10, 10, 74, "#59636d"); cbox(g, c.x, y - hw - 15, 58, 16, 14, 16, "#8a959f"); });
        add(c.x, y + hw + 15, () => {
          seg3(g, [c.x, y - hw - 10, 64], [c.x, y + hw + 10, 64], c.on ? "#ff3b30" : "#ff3b3040", c.on ? 2.5 : 1.2);
          cbox(g, c.x, y + hw + 15, 0, 10, 10, 74, "#59636d"); cbox(g, c.x, y + hw + 15, 58, 16, 14, 16, c.on ? shade(col, 1.3) : col);
        });
        T3(c.a.i, c.x + (c.tdx || 0), y - hw - 15, 86, (c.tdy || 0) * 0.5);
        break;
      }
      case "pick": {
        const py = y + (CW / 2 + 40) * (c.side || 1);
        add(c.x, py, () => { cyl(g, c.x, py, 0, 13, 62, "#2a3a55"); cyl(g, c.x, py, 62, 10, 18, "#c9a27a"); if (c.anim > 0) seg3(g, [c.x, py, 58], [c.x, y, BZ + 20], "#c9a27a", 7); });
        break;
      }
      case "bin": {
        add(c.x, c.y, () => {
          const x0 = c.x - c.w / 2, y0 = c.y - c.h / 2;
          poly(g, [P(x0, y0, 2), P(x0 + c.w, y0, 2), P(x0 + c.w, y0 + c.h, 2), P(x0, y0 + c.h, 2)], "#15191c");
          box(g, x0, y0, 0, c.w, 4, 28, "#3f4850"); box(g, x0, y0, 0, 4, c.h, 28, "#3f4850");
          c.items.forEach((p, i) => isoPart(g, p, x0 + 14 + (i % 3) * 22, y0 + 16 + Math.floor(i / 3) * 20, 4, 0.6));
          box(g, x0 + c.w - 4, y0, 0, 4, c.h, 28, "#4a545e"); box(g, x0, y0 + c.h - 4, 0, c.w, 4, 28, "#4a545e");
        });
        tags.push([`${c.label} ${c.n}${c.goal ? "/" + c.goal : ""}`, c.x, c.y + c.h / 2, 0, 16, "txt"]);
        break;
      }
      case "stop": {
        const up = B(c, "q");
        add(c.x, y - hw - 12, () => cbox(g, c.x, y - hw - 12, BZ - 20, 12, 14, 24, "#6c7883"));
        add(c.x, y, () => cbox(g, c.x, y, up ? BZ : BZ - 6, 6, CW, up ? 20 : 6, up ? "#e8251a" : "#59636d", up ? "#f2b705" : null), 0.5);
        T3(c.a.q, c.x + (c.tdx || 0), y - hw - 12, 62, -14);
        break;
      }
      case "push": {
        const s = -c.side, by = y + s * (hw + 26), len = c.s * (CW + 32);
        const bodyFirst = s < 0;
        const drawBody = () => cbox(g, c.x, by, BZ - 10, 26, 30, 26, "#6c7883");
        const rod = () => { const y1 = by - s * 15, y2 = y1 - s * len; const ya = Math.min(y1, y2), yb = Math.max(y1, y2); box(g, c.x - 3, ya, BZ + 6, 6, yb - ya, 6, "#cfd6dc"); cbox(g, c.x, y2, BZ + 2, PS, 6, 16, "#f2b705"); };
        add(c.x, by, drawBody); add(c.x, y + (bodyFirst ? -1 : 1) * 2, rod, 0.3);
        T3(addrs(c, ["q", "in", "out"]), c.x, by, 50, s * 10);
        break;
      }
      case "tool": {
        const col = c.kind === "press" ? "#8b5cf6" : c.kind === "drill" ? "#0ea5e9" : "#14b8a6";
        const zb = lerp(140, BZ + 18, c.s);
        late.push(() => {
          cbox(g, c.x, y - hw - 30, 0, 22, 22, 170, "#4a545e"); box(g, c.x - 11, y - hw - 30, 160, 22, hw + 30, 12, "#59636d");
          seg3(g, [c.x, y, 170], [c.x, y, zb + 26], "#9aa5ae", 6);
          if (c.kind === "drill") { cbox(g, c.x, y, zb + 10, 26, 26, 24, col); const a = c.ang || 0; seg3(g, [c.x, y, zb + 10], [c.x + Math.cos(a) * 2, y + Math.sin(a) * 2, zb - 2], c.thOK ? "#e9edf0" : "#f66", 4); }
          else if (c.kind === "press") cbox(g, c.x, y, zb, 40, 40, 26, col);
          else { cbox(g, c.x, y, zb + 10, 20, 20, 18, col); seg3(g, [c.x, y, zb + 10], [c.x, y, zb - 2], "#e9edf0", 3); }
        });
        T3(c.name, c.x, y - hw - 30, 186, 0); T3(addrs(c, ["d", "spin", "h", "b", "ok", "th"]), c.x, y + hw, 0, 34);
        break;
      }
      case "oven": {
        const k = clamp((c.tp - 20) / 220, 0, 1), glow = `rgba(${Math.round(255 * k)},${Math.round(100 + 40 * k)},${Math.round(40)},${0.15 + 0.35 * k})`;
        const x0 = c.x1, x1 = c.x2, y0 = y - hw - 16, y1 = y + hw + 16;
        poly(g, [P(x0, y0, 0), P(x1, y0, 0), P(x1, y0, 110), P(x0, y0, 110)], "#5a3420");
        poly(g, [P(x0, y0, BZ), P(x1, y0, BZ), P(x1, y1, BZ), P(x0, y1, BZ)], glow);
        late.push(() => {
          poly(g, [P(x0, y0, 110), P(x1, y0, 110), P(x1, y1, 110), P(x0, y1, 110)], "#7c4a2a");
          poly(g, [P(x0, y1, 0), P(x1, y1, 0), P(x1, y1, 110), P(x0, y1, 110)], "rgba(124,74,42,0.55)", "#c2410c", 2);
          poly(g, [P(x1, y0, 0), P(x1, y1, 0), P(x1, y1, 110), P(x1, y0, 110)], "rgba(90,52,32,0.6)");
          poly(g, [P(x0, y1, BZ), P(x1, y1, BZ), P(x1, y1, BZ + 40), P(x0, y1, BZ + 40)], glow);
        });
        tags.push([`FOUR ${Math.round(c.tp)} °C`, (x0 + x1) / 2, y0, 124, -6, "big", c.tp >= 180 && c.tp <= 230 ? "#fdba74" : "#fff"]);
        T3(addrs(c, ["h", "t180", "t200", "t230"]), (x0 + x1) / 2, y1, 0, 20);
        break;
      }
      case "fill": {
        late.push(() => {
          cbox(g, c.x, y - hw - 26, 0, 16, 16, 150, "#6b7280"); box(g, c.x - 8, y - hw - 26, 140, 16, hw + 26, 10, "#6b7280");
          cyl(g, c.x, y, 112, 7, 28, "#cbd5e1");
          if (c.flow) seg3(g, [c.x, y, 112], [c.x, y, BZ + 30], "#60a5fa", 4);
        });
        T3(addrs(c, ["v", "plein"]), c.x, y - hw - 26, 165, -8);
        break;
      }
      case "label": {
        const ly = y + hw + 28;
        add(c.x, ly, () => { cbox(g, c.x, ly, 0, 44, 28, 70, "#475569"); cyl(g, c.x, ly, 70, 12, 8, "#f8fafc"); if (B(c, "q")) seg3(g, [c.x, ly - 10, 60], [c.x, y + 6, BZ + 34], "#f8fafc", 6); });
        T3(c.a.q, c.x, ly, 86, -8);
        break;
      }
      case "cam": {
        late.push(() => {
          cbox(g, c.x, y - hw - 26, 0, 10, 10, 160, "#475569"); box(g, c.x - 5, y - hw - 26, 152, 10, hw + 26, 8, "#475569");
          cbox(g, c.x, y, 132, 26, 20, 18, "#334155");
          if (c.flash > 0) poly(g, [P(c.x - 4, y, 132), P(c.x + 4, y, 132), P(c.x + 26, y + 20, BZ), P(c.x - 26, y - 20, BZ)], "#ffffff44");
          if (c.done) { const q = P(c.x + 16, y, 150); circ(g, q[0], q[1], 5 * IS.k, c.res ? "#3ddc7a" : "#e8251a"); }
        });
        T3(addrs(c, ["trig", "done", "ok"]), c.x, y - hw - 26, 176, -6);
        break;
      }
      case "tank": {
        add(c.x, c.y, () => {
          cyl(g, c.x, c.y, 0, 58, 170, "#8a959f");
          const a0 = Math.atan2(0.52, 0.24), w = 0.22, x1 = c.x + 59 * Math.cos(a0 - w), y1 = c.y + 59 * Math.sin(a0 - w), x2 = c.x + 59 * Math.cos(a0 + w), y2 = c.y + 59 * Math.sin(a0 + w);
          poly(g, [P(x1, y1, 15), P(x2, y2, 15), P(x2, y2, 155), P(x1, y1, 155)], "#15191c");
          const k = clamp((c.tp - 20) / 60, 0, 1), lc = `rgb(${Math.round(40 + 180 * k)},${Math.round(110 - 40 * k)},${Math.round(200 - 150 * k)})`, lz = 15 + 140 * c.lv;
          poly(g, [P(x1, y1, 15), P(x2, y2, 15), P(x2, y2, lz), P(x1, y1, lz)], lc);
          for (const v of [0.15, 0.8, 0.92]) seg3(g, [x2 + 3, y2, 15 + 140 * v], [x2 + 12, y2, 15 + 140 * v], "#f2b705", 2);
          cyl(g, c.x, c.y, 170, 10, 20, "#4a545e");
          if (B(c, "mix")) { const a = c.ang; seg3(g, [c.x - Math.cos(a) * 30, c.y - Math.sin(a) * 30, 195], [c.x + Math.cos(a) * 30, c.y + Math.sin(a) * 30, 195], "#e9edf0", 4); }
        });
        tags.push([`CUVE ${Math.round(c.lv * 100)} % · ${Math.round(c.tp)} °C`, c.x, c.y, 215, 0, "big", T.tank.good(c) ? "#3ddc7a" : "#fdba74"]);
        T3(addrs(c, ["pump", "mix", "heat"]), c.x, c.y + 60, 0, 16); T3(addrs(c, ["bas", "haut", "th", "t60", "t70"]), c.x, c.y + 60, 0, 36);
        break;
      }
      case "bowl": {
        const sh = B(c, "vib") ? Math.sin(c.sh) * 1.5 : 0, bx = c.x + sh;
        add(c.x, c.y, () => {
          cyl(g, bx, c.y, 0, 30, 40, "#48525b"); cyl(g, bx, c.y, 40, 72, 30, "#7b8691");
          ellipse(g, bx, c.y, 70, 62, "#2a3036");
          const pts = []; for (let a = 0; a < 12.5; a += 0.25) { const r = 12 + a * 3.8; pts.push(P(bx + Math.cos(a) * r, c.y + Math.sin(a) * r, 70)); }
          g.strokeStyle = "#8a959f"; g.lineWidth = 2.5; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(...p) : g.moveTo(...p)); g.stroke();
        });
        const rx1 = c.x + 70, rx2 = c.dropX - PS / 2 - 2;
        add((rx1 + rx2) / 2, c.cv.y, () => {
          box(g, rx1, c.cv.y - 12, 0, 6, 6, BZ, "#48525b"); box(g, rx1, c.cv.y - 14, BZ, rx2 - rx1, 28, 6, "#59636d");
          c.queue.forEach((p, i) => isoPart(g, p, rx2 - 14 - i * 24, c.cv.y, BZ + 6, 0.8));
          cbox(g, rx2, c.cv.y, BZ + 6, 5, 30, 20, B(c, "esc") ? "#3ddc7a" : "#e8251a");
        });
        tags.push([`BOL VIBRANT · ${Math.floor(c.cnt)} pièces`, c.x, c.y - 70, 90, 0, "big", "#fff"]);
        T3(addrs(c, ["vib", "tre", "esc"]), c.x, c.y + 72, 0, 16); T3(addrs(c, ["pr", "full", "low"]), c.x, c.y + 72, 0, 36);
        break;
      }
      case "boxer": {
        add(c.x, c.y, () => {
          box(g, c.x - 42, c.y - 42, 0, 84, 84, 14, "#3a434b");
          if (c.present || c.t < 1) {
            const dy = c.present ? 0 : c.t * 120, x0 = c.x - 32, y0 = c.y - 32 + dy;
            poly(g, [P(x0, y0, 15), P(x0 + 64, y0, 15), P(x0 + 64, y0 + 64, 15), P(x0, y0 + 64, 15)], "#6b4520");
            box(g, x0, y0, 14, 64, 3, 40, "#b07a45"); box(g, x0, y0, 14, 3, 64, 40, "#b07a45");
            const n = c.present ? c.n : c.cap; for (let i = 0; i < Math.min(n, 9); i++) cyl(g, x0 + 14 + (i % 3) * 18, y0 + 14 + Math.floor(i / 3) * 18, 15, 7, 10, "#9aa5ae");
            box(g, x0 + 61, y0, 14, 3, 64, 40, "#c48a50"); box(g, x0, y0 + 61, 14, 64, 3, 40, "#c48a50");
          }
        });
        tags.push([`Carton ${c.present ? c.n : "—"}/${c.cap} · cartons ${c.done}${c.goal ? "/" + c.goal : ""}`, c.x, c.y - 42, 70, 0, "txt"]);
        T3(addrs(c, ["evac", "pres"]), c.x, c.y + 42, 0, 16);
        break;
      }
      case "pallet": {
        const x0 = c.slots[0] - 36, x1 = c.slots[c.slots.length - 1] + 36;
        add((x0 + x1) / 2, c.y, () => {
          if (!c.present) return;
          box(g, x0, c.y - 38, 0, x1 - x0, 76, 12, "#9c7a4a"); for (let x = x0 + 4; x < x1 - 8; x += 20) box(g, x, c.y - 38, 12, 10, 76, 3, "#b8935e");
          c.sl.forEach(s => { for (let i = 0; i < s.n; i++) isoPart(g, { kind: "carton", q: {} }, s.x, c.y, 15 + i * 30); });
        });
        tags.push([`Palettes ${c.done}${c.goal ? "/" + c.goal : ""}${c.present ? "" : " · nouvelle palette…"}`, (x0 + x1) / 2, c.y + 40, 0, 18, "txt"]);
        T3(addrs(c, ["evac", "pres"]), (x0 + x1) / 2, c.y + 40, 0, 38);
        break;
      }
      case "axis": {
        late.push(() => {
          const zt = 175, y0 = c.y - 60, y1 = c.y + 60;
          for (const x of [c.x1, c.x2]) { cbox(g, x, y0, 0, 12, 12, zt, "#59636d"); cbox(g, x, y1, 0, 12, 12, zt, "#59636d"); }
          box(g, c.x1 - 6, y0 - 6, zt, c.x2 - c.x1 + 12, 12, 12, "#6b7480"); box(g, c.x1 - 6, y1 - 6, zt, c.x2 - c.x1 + 12, 12, 12, "#6b7480");
          box(g, c.x - 14, y0 - 6, zt + 12, 28, y1 - y0 + 12, 14, "#f2b705");
          const gz = lerp(150, BZ + PH(c.hold || { kind: "piece" }) + 4, c.s);
          seg3(g, [c.x, c.y, zt + 12], [c.x, c.y, gz + 14], "#cfd6dc", 7);
          if (c.hold) isoPart(g, c.hold, c.x, c.y, gz - PH(c.hold));
          cbox(g, c.x, c.y, gz, 26, 26, 14, "#d97706");
          const op = (1 - c.gr) * 8; cbox(g, c.x - 15 - op, c.y, gz - 14, 4, 16, 16, "#e9edf0"); cbox(g, c.x + 15 + op, c.y, gz - 14, 4, 16, 16, "#e9edf0");
          c.pos.forEach((p, i) => { const q = P(p.x, y0 - 6, zt + 26); txt(g, `P${i + 1}`, q[0], q[1] - 6, "#f2b705", 12, "center", 700); });
          const q = P(c.origin, y0 - 6, zt + 26); txt(g, "origine", q[0], q[1] - 6, "#9aa5ae", 12);
        });
        T3("Axe " + addrs(c, c.pos.map((p, i) => "go" + (i + 1)).concat(["home"])), (c.x1 + c.x2) / 2, c.y - 60, 200, -10);
        T3(addrs(c, c.pos.map((p, i) => "en" + (i + 1)).concat(["ref"])), (c.x1 + c.x2) / 2, c.y + 60, 0, 18);
        T3("Z " + addrs(c, ["zd", "zh", "zb"]) + " · pince " + addrs(c, ["pf", "pc"]), (c.x1 + c.x2) / 2, c.y + 60, 0, 38);
        break;
      }
      case "robot": {
        late.push(() => {
          cyl(g, c.bx, c.by, 0, 34, 30, "#c2410c"); cyl(g, c.bx, c.by, 30, 24, 30, "#e67e22");
          const ez = robotPose(c), sh = [c.bx, c.by, 60], el = [(c.bx + c.ex) / 2 + (c.ey - c.by) * 0.15, (c.by + c.ey) / 2 - (c.ex - c.bx) * 0.15, 175];
          seg3(g, sh, el, "#d35400", 18); seg3(g, el, [c.ex, c.ey, ez + 24], "#f39c12", 13);
          const pe = P(...el); circ(g, pe[0], pe[1], 11 * IS.k, "#a04000");
          seg3(g, [c.ex, c.ey, ez + 24], [c.ex, c.ey, ez + 4], "#2a3036", 8);
          if (c.hold) isoPart(g, c.hold, c.ex, c.ey, ez - PH(c.hold) + 4);
        });
        tags.push([T.robot.paused() ? "ROBOT EN PAUSE" : "ROBOT", c.bx, c.by, 70, -10, "big", T.robot.paused() ? "#f2b705" : "#fff"]);
        T3(addrs(c, ["A", "B", "go"]), c.bx, c.by + 40, 0, 16); T3(addrs(c, ["pret", "fin", "hz"]), c.bx, c.by + 40, 0, 36);
        break;
      }
      case "bim": {
        const tool = W.byId[c.tool], ty = tool.cv.y + hw + 64;
        add(tool.x, ty, () => { cbox(g, tool.x, ty, 0, 90, 24, 70, "#334155"); for (const [k, dx] of [["L", -28], ["R", 28]]) cyl(g, tool.x + dx, ty, 70, 10, c[k] ? 3 : 8, c[k] ? "#3ddc7a" : "#1f6f3d"); });
        T3(addrs(c, ["g", "d"]), tool.x, ty + 12, 0, 16);
        break;
      }
      case "feed": if (c.i < c.seq.length) tags.push([`reste ${c.seq.length - c.i}`, c.x, y - hw, 70, 0, "txt"]); break;
    }
  }
  // pièces
  for (const p of W.parts) {
    if (p.state === "belt" || p.state === "pushed") add(p.x, p.y, () => isoPart(g, p, p.x, p.y, BZ), 0.2);
    else if (p.state === "fall") add(p.x, p.y, () => { const t = p.ft || 0; g.globalAlpha = Math.max(0, 1 - t / 1.4); isoPart(g, p, p.x + t * 70, p.y, Math.max(-30, BZ - 900 * t * t)); g.globalAlpha = 1; }, 0.2);
  }
  items.sort((a, b) => a.d - b.d); for (const it of items) it.f();
  for (const f of late) f();
  for (const [s, x, y, z, dy, kind, col] of tags) { const q = P(x, y, z); if (kind === "big") txt(g, s, q[0], q[1] + dy, col || "#fff", 14, "center", 700); else if (kind === "txt") txt(g, s, q[0], q[1] + dy, "#cfd6dc", 13); else tag(g, s, q[0], q[1] + dy); }
  overlay(g);
}

const elapsed = () => W.started ? W.t - W.t0 : 0;
return { build, step, draw, drawIso, isoOK, setRun, scan, elapsed, get W() { return W; }, MEM, TIM, CNT, WW, WH, T, PS };
})();
