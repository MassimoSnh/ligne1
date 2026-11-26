/* L'Arcade de l'atelier : son (bruitages synthétisés + musique), bouton pour couper le son,
   et installation en appli sur téléphone (service worker). Chargé sur toutes les pages. */
"use strict";
(() => {
const ROOT = document.documentElement.dataset.root || "./";
const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
let on = store.get("arc-sound", "1") === "1", musicOn = store.get("arc-music", "0") === "1";
let A = null, master = null, sfxBus = null, musBus = null, noiseBuf = null;

function ctx() {
  if (A) return A;
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
  A = new C();
  const comp = A.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(A.destination);
  master = A.createGain(); master.gain.value = on ? 1 : 0; master.connect(comp);
  sfxBus = A.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  musBus = A.createGain(); musBus.gain.value = 0.16; musBus.connect(master);
  noiseBuf = A.createBuffer(1, A.sampleRate, A.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return A;
}
// le navigateur n'autorise le son qu'après un geste de l'utilisateur
const unlock = () => { const c = ctx(); if (c && c.state === "suspended") c.resume(); if (musicOn && wantMusic) music.start(); };
["pointerdown", "keydown", "touchstart"].forEach(ev => addEventListener(ev, unlock, { passive: true }));

/* ---------- briques de synthèse ---------- */
function tone(f, dur, o = {}) {
  const c = ctx(); if (!c || !on) return; const t = c.currentTime + (o.at || 0);
  const os = c.createOscillator(), gn = c.createGain(); os.type = o.type || "square"; os.frequency.setValueAtTime(f, t);
  if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
  const v = o.vol ?? 0.3; gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + (o.att || 0.005)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  os.connect(gn); gn.connect(o.bus || sfxBus); os.start(t); os.stop(t + dur + 0.02);
}
function noise(dur, o = {}) {
  const c = ctx(); if (!c || !on) return; const t = c.currentTime + (o.at || 0);
  const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const f = c.createBiquadFilter(); f.type = o.filter || "lowpass"; f.frequency.setValueAtTime(o.f || 2000, t); if (o.fto) f.frequency.exponentialRampToValueAtTime(o.fto, t + dur); f.Q.value = o.q || 0.8;
  const gn = c.createGain(), v = o.vol ?? 0.3; gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(v, t + (o.att || 0.004)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(gn); gn.connect(o.bus || sfxBus); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
const arp = (notes, step, o = {}) => notes.forEach((n, i) => tone(n, o.dur || step * 1.2, Object.assign({}, o, { at: (o.at || 0) + i * step })));
const N = n => 440 * Math.pow(2, (n - 69) / 12); // note MIDI -> Hz

/* ---------- les bruitages ---------- */
const S = {
  // Bloc Assaut
  ar: () => { noise(0.09, { f: 2600, fto: 600, vol: 0.32, filter: "bandpass", q: 0.7 }); tone(170, 0.07, { to: 70, vol: 0.18 }); },
  smg: () => { noise(0.06, { f: 3200, fto: 900, vol: 0.24, filter: "bandpass" }); tone(220, 0.05, { to: 90, vol: 0.12 }); },
  pompe: () => { noise(0.32, { f: 1400, fto: 160, vol: 0.5 }); tone(110, 0.2, { to: 38, vol: 0.4, type: "sine" }); noise(0.05, { at: 0.42, f: 2500, filter: "highpass", vol: 0.12 }); noise(0.05, { at: 0.55, f: 2000, filter: "highpass", vol: 0.12 }); },
  sniper: () => { tone(1500, 0.05, { to: 200, vol: 0.25 }); noise(0.5, { f: 3000, fto: 120, vol: 0.45 }); tone(80, 0.35, { to: 35, vol: 0.35, type: "sine" }); },
  pistol: () => { noise(0.07, { f: 2400, fto: 700, vol: 0.28, filter: "bandpass" }); tone(320, 0.06, { to: 120, vol: 0.16 }); },
  knife: () => noise(0.16, { f: 500, fto: 4200, filter: "bandpass", q: 2, vol: 0.22, att: 0.04 }),
  rpg: () => { noise(0.5, { f: 300, fto: 1600, vol: 0.32, att: 0.05 }); tone(90, 0.3, { to: 50, vol: 0.2, type: "sawtooth" }); },
  boom: () => { noise(1.0, { f: 900, fto: 60, vol: 0.7, att: 0.01 }); tone(70, 0.6, { to: 28, vol: 0.5, type: "sine" }); },
  reload: () => { tone(900, 0.03, { vol: 0.15 }); tone(600, 0.04, { at: 0.22, vol: 0.15 }); tone(1100, 0.03, { at: 0.4, vol: 0.12 }); },
  empty: () => tone(1200, 0.025, { vol: 0.1 }),
  hit: () => tone(1500, 0.05, { vol: 0.16, type: "sine" }),
  head: () => { tone(1800, 0.05, { vol: 0.18, type: "sine" }); tone(2400, 0.06, { at: 0.04, vol: 0.14, type: "sine" }); },
  hurt: () => { tone(180, 0.18, { to: 80, vol: 0.22 }); noise(0.12, { f: 600, vol: 0.12 }); },
  robotDie: () => { tone(700, 0.35, { to: 60, vol: 0.2, type: "sawtooth" }); noise(0.3, { f: 1800, fto: 200, vol: 0.2 }); },
  pew: () => tone(1000, 0.14, { to: 280, vol: 0.1, type: "sine" }),
  laser: () => tone(400, 1.0, { to: 1800, vol: 0.05, type: "sine", att: 0.3 }),
  zap: () => { tone(2200, 0.25, { to: 300, vol: 0.18, type: "sawtooth" }); },
  wave: () => arp([N(64), N(67), N(71), N(76)], 0.09, { vol: 0.16, type: "square" }),
  boss: () => { tone(N(40), 0.8, { vol: 0.3, type: "sawtooth" }); tone(N(41), 0.8, { at: 0.5, vol: 0.3, type: "sawtooth" }); },
  jump: () => tone(260, 0.12, { to: 560, vol: 0.12 }),
  heal: () => arp([N(72), N(76), N(79)], 0.07, { vol: 0.14, type: "triangle" }),
  over: () => arp([N(67), N(63), N(60), N(55)], 0.18, { vol: 0.2, type: "triangle", dur: 0.3 }),
  // Fenwick
  boost: () => { noise(0.6, { f: 500, fto: 3000, vol: 0.22, att: 0.05 }); tone(180, 0.5, { to: 520, vol: 0.12, type: "sawtooth" }); },
  box: () => arp([N(76), N(79), N(84), N(88)], 0.045, { vol: 0.13, type: "square" }),
  throw: () => noise(0.22, { f: 800, fto: 2600, filter: "bandpass", q: 1.5, vol: 0.2 }),
  spin: () => { tone(600, 0.6, { to: 120, vol: 0.18, type: "triangle" }); noise(0.4, { f: 1200, fto: 300, vol: 0.15 }); },
  wall: () => noise(0.12, { f: 400, vol: 0.28 }),
  klax: () => { tone(330, 0.45, { vol: 0.2, type: "sawtooth" }); tone(415, 0.45, { vol: 0.2, type: "sawtooth" }); },
  fork: () => { tone(520, 0.25, { vol: 0.18, type: "triangle" }); tone(785, 0.3, { vol: 0.14, type: "triangle", at: 0.02 }); noise(0.08, { f: 3000, filter: "highpass", vol: 0.12 }); },
  star: () => arp([N(72), N(76), N(79), N(84), N(88), N(91)], 0.05, { vol: 0.13, type: "square" }),
  beep: () => tone(N(69), 0.18, { vol: 0.2 }),
  go: () => tone(N(81), 0.45, { vol: 0.22 }),
  lap: () => arp([N(72), N(79)], 0.1, { vol: 0.17 }),
  finish: () => arp([N(72), N(76), N(79), N(84), N(79), N(84)], 0.11, { vol: 0.18, dur: 0.18 }),
  splash: () => noise(0.3, { f: 1600, fto: 400, filter: "bandpass", vol: 0.18 }),
  // Blast
  bomb: () => { tone(130, 0.12, { to: 60, vol: 0.3, type: "sine" }); tone(1400, 0.02, { at: 0.05, vol: 0.08 }); },
  pickup: () => arp([N(79), N(83), N(86)], 0.05, { vol: 0.14 }),
  die: () => { tone(500, 0.5, { to: 70, vol: 0.2 }); },
  win: () => arp([N(72), N(76), N(79), N(84)], 0.1, { vol: 0.18, dur: 0.22 }),
  lose: () => arp([N(67), N(64), N(60)], 0.14, { vol: 0.16, type: "triangle", dur: 0.25 }),
  // Casino, Tour, Volt, Dessin, interface
  coin: () => { tone(N(83), 0.07, { vol: 0.15 }); tone(N(88), 0.25, { at: 0.07, vol: 0.15 }); },
  chip: () => { tone(2400, 0.025, { vol: 0.1, type: "triangle" }); tone(1800, 0.03, { at: 0.03, vol: 0.08, type: "triangle" }); },
  card: () => noise(0.05, { f: 4000, filter: "highpass", vol: 0.14 }),
  tick: () => tone(2000, 0.015, { vol: 0.07, type: "triangle" }),
  reel: () => tone(300 + Math.random() * 200, 0.03, { vol: 0.06 }),
  place: () => { tone(260, 0.08, { vol: 0.2, type: "triangle" }); noise(0.05, { f: 900, vol: 0.12 }); },
  perfect: () => { tone(N(84), 0.12, { vol: 0.15, type: "sine" }); tone(N(91), 0.2, { at: 0.06, vol: 0.13, type: "sine" }); },
  crash: () => { noise(0.6, { f: 1500, fto: 100, vol: 0.4 }); },
  dash: () => noise(0.18, { f: 700, fto: 3500, filter: "bandpass", q: 1.2, vol: 0.2 }),
  ding: () => { tone(N(88), 0.5, { vol: 0.15, type: "sine" }); tone(N(95), 0.4, { at: 0.02, vol: 0.06, type: "sine" }); },
  ok: () => arp([N(79), N(84)], 0.08, { vol: 0.16, type: "sine" }),
  blip: () => tone(N(76), 0.04, { vol: 0.08 }),
  join: () => arp([N(72), N(79)], 0.07, { vol: 0.12, type: "triangle" }),
  error: () => tone(150, 0.25, { vol: 0.18, type: "sawtooth" })
};
let lastPlay = {};
function play(name) {
  if (!on || !S[name]) return; const c = ctx(); if (!c) return; if (c.state === "suspended") c.resume();
  const t = performance.now(); if (lastPlay[name] && t - lastPlay[name] < 30) return; lastPlay[name] = t; // évite les empilements
  try { S[name](); } catch (e) {}
}

/* ---------- moteur de chariot (son continu) ---------- */
const engine = {
  o1: null, o2: null, f: null, g: null,
  set(r, boost) {
    const c = ctx(); if (!c || !on) { this.stop(); return; }
    if (!this.o1) {
      this.o1 = c.createOscillator(); this.o2 = c.createOscillator(); this.o1.type = "sawtooth"; this.o2.type = "square";
      this.f = c.createBiquadFilter(); this.f.type = "lowpass"; this.f.frequency.value = 500; this.g = c.createGain(); this.g.gain.value = 0;
      this.o1.connect(this.f); this.o2.connect(this.f); this.f.connect(this.g); this.g.connect(sfxBus); this.o1.start(); this.o2.start();
    }
    const t = c.currentTime, fr = 48 + r * 120 + (boost ? 40 : 0);
    this.o1.frequency.setTargetAtTime(fr, t, 0.08); this.o2.frequency.setTargetAtTime(fr * 1.505, t, 0.08);
    this.f.frequency.setTargetAtTime(380 + r * 900 + (boost ? 600 : 0), t, 0.1); this.g.gain.setTargetAtTime(0.05 + r * 0.06, t, 0.1);
  },
  stop() { if (!this.o1) return; try { this.o1.stop(); this.o2.stop(); } catch (e) {} this.o1 = this.o2 = null; }
};

/* ---------- musique 8-bit (accueil) ---------- */
let wantMusic = false;
const music = {
  timer: null, step: 0, next: 0,
  start() {
    const c = ctx(); if (!c || !on || !musicOn || this.timer) return;
    const bpm = 112, s16 = 60 / bpm / 4;
    const bass = [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 43, 43, 55, 47];
    const lead = [69, 0, 72, 0, 76, 0, 74, 72, 67, 0, 71, 0, 74, 0, 72, 71, 65, 0, 69, 0, 72, 0, 71, 69, 67, 0, 71, 74, 76, 0, 0, 0];
    this.next = c.currentTime + 0.1;
    this.timer = setInterval(() => {
      while (this.next < c.currentTime + 0.25) {
        const st = this.step, at = this.next - c.currentTime;
        if (st % 2 === 0) tone(N(bass[(st / 2) % 16]), s16 * 1.8, { at, vol: 0.5, type: "triangle", bus: musBus });
        const ln = lead[st % 32]; if (ln && Math.floor(st / 32) % 2 === 1) tone(N(ln), s16 * 1.7, { at, vol: 0.22, type: "square", bus: musBus });
        if (st % 4 === 0) noise(0.05, { at, f: 120, vol: 0.5, bus: musBus }); if (st % 8 === 4) noise(0.08, { at, f: 2200, filter: "bandpass", vol: 0.3, bus: musBus }); if (st % 2 === 1) noise(0.02, { at, f: 7000, filter: "highpass", vol: 0.12, bus: musBus });
        this.step++; this.next += s16;
      }
    }, 60);
  },
  stop() { clearInterval(this.timer); this.timer = null; }
};

/* ---------- bouton son (sur toutes les pages) ---------- */
const ICON_ON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>`;
const ICON_OFF = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6"/></svg>`;
let btn = null;
function paint() { if (!btn) return; btn.innerHTML = on ? ICON_ON : ICON_OFF; btn.setAttribute("aria-pressed", String(!on)); btn.setAttribute("aria-label", on ? "Couper le son" : "Remettre le son"); btn.title = on ? "Couper le son (M)" : "Remettre le son (M)"; btn.style.opacity = on ? "1" : "0.7"; }
function setOn(v) {
  on = v; store.set("arc-sound", on ? "1" : "0");
  if (master) master.gain.value = on ? 1 : 0;
  if (!on) { engine.stop(); music.stop(); } else { unlock(); play("blip"); }
  paint(); document.dispatchEvent(new CustomEvent("arc-sound", { detail: on }));
}
function mountButton() {
  btn = document.createElement("button"); btn.type = "button"; btn.className = "arc-snd";
  const st = document.createElement("style");
  st.textContent = `.arc-snd{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:0 10px;border-radius:10px;border:2px solid #4c1d95;background:#120c24;color:#f5f3ff;cursor:pointer;flex:none}.arc-snd:focus-visible{outline:3px solid #fff;outline-offset:2px}.arc-snd.float{position:fixed;left:50%;transform:translateX(-50%);top:max(10px,env(safe-area-inset-top));z-index:60;background:#0b1220cc}`;
  document.head.appendChild(st);
  btn.onclick = e => { e.stopPropagation(); setOn(!on); };
  btn.addEventListener("pointerdown", e => e.stopPropagation());
  const side = document.querySelector("nav.side"), anchor = document.querySelector(".top > a.navbtn, header a.navbtn, .bar a.navbtn");
  if (side) side.prepend(btn);
  else if (anchor) {
    // on regroupe « ← Arcade » et le bouton son pour qu'ils restent côte à côte
    const wrap = document.createElement("span"); wrap.style.cssText = "display:inline-flex;align-items:center;gap:8px;flex:none";
    anchor.replaceWith(wrap); wrap.append(anchor, btn);
  } else { btn.classList.add("float"); document.body.appendChild(btn); }
  paint();
}
addEventListener("keydown", e => { if (e.code === "KeyM" && !e.repeat && !/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || "")) setOn(!on); });
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountButton); else mountButton();

/* ---------- appli installable (service worker) ---------- */
if ("serviceWorker" in navigator && location.protocol === "https:") addEventListener("load", () => { navigator.serviceWorker.register(ROOT + "sw.js").catch(() => {}); });
let installEvt = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; document.dispatchEvent(new Event("arc-installable")); });
const standalone = () => matchMedia("(display-mode: standalone), (display-mode: fullscreen)").matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

window.SFX = {
  play, engine, get on() { return on; }, set: setOn,
  music: { get on() { return musicOn; }, want(v) { wantMusic = v; if (v && musicOn) { const c = ctx(); if (c && c.state === "running") music.start(); } else music.stop(); }, toggle() { musicOn = !musicOn; store.set("arc-music", musicOn ? "1" : "0"); if (musicOn) { if (!on) setOn(true); unlock(); music.start(); } else music.stop(); return musicOn; } }
};
window.ARC_APP = { get canInstall() { return !!installEvt; }, standalone, isIOS, async install() { if (!installEvt) return false; installEvt.prompt(); const r = await installEvt.userChoice; installEvt = null; return r && r.outcome === "accepted"; } };
})();
